// "Living plates" for design v2 (D43, PO: "das Design muss viel lebendiger sein, nicht wie Standbilder"). The PO's
// painted master behind each screen is drawn by the menus' shared WebGL context (one context on phones, D41) with a
// depth map (MiDaS, tools/ui-extract/depth.py): the far parts of the painting drift in a slow 2.5D parallax while the
// UI panels stay pixel-exact, the crowd hops on the beat, the painted light sources flicker and breathe, haze drifts
// through the depth and camera flashes pop in the stands. The 3D fighters render into the same picture right after
// it, with the same parallax at their depth, so painting and fighters move as one scene. Presentation only.
import * as THREE from 'three';
import { isPhone } from '../../render/textureBudget';
import type { ScreenArt } from './stage';

const REF_H = 941;
const MAX_LIGHTS = 20;

const VERT = /* glsl */ `
uniform vec4 uRect; // plate rect in clip space: x0, y0, x1, y1
varying vec2 vUv;
void main() {
  vUv = uv;
  vec2 p = mix(uRect.xy, uRect.zw, uv);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tL;
uniform sampler2D tC;
uniform sampler2D tR;
uniform vec2 uCX; // the centre tile's x range in plate UV (the wings fill the rest)
uniform vec2 uLX;
uniform vec2 uRX;
uniform sampler2D tDepth;
uniform sampler2D tRigid;
uniform float uTime;
uniform float uBeat;
uniform vec2 uPar;
uniform float uAspect;
uniform float uCrowdY;
uniform vec3 uHaze;
uniform vec4 uLights[${MAX_LIGHTS}];
uniform vec3 uLightCol[${MAX_LIGHTS}];
uniform vec4 uFlash[3];
uniform float uIntro;
uniform float uProbe;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
// the painting is the three tiles of the master (no composite canvas: iOS caps the canvas memory, S12)
vec3 plate(vec2 p) {
  if (p.x >= uCX.x && p.x <= uCX.y) return texture2D(tC, vec2((p.x - uCX.x) / (uCX.y - uCX.x), p.y)).rgb;
  if (p.x < uCX.x) return texture2D(tL, vec2((p.x - uLX.x) / (uLX.y - uLX.x), p.y)).rgb;
  return texture2D(tR, vec2((p.x - uRX.x) / (uRX.y - uRX.x), p.y)).rgb;
}

void main() {
  vec2 uv = vUv;
  if (uProbe > 0.5) { gl_FragColor = vec4(plate(uv), 1.0); return; }
  float d = texture2D(tDepth, uv).r;
  float rigid = max(texture2D(tRigid, uv).r, smoothstep(0.82, 0.95, d));
  float far = 1.0 - d;
  float w = pow(far, 1.35) * (1.0 - rigid);
  vec2 puv = uv + uPar * w;
  // crowd: far, not UI, not a light, in the stands band; every column hops on the beat with its own lag
  vec3 probe = plate(puv);
  float lum = dot(probe, vec3(0.299, 0.587, 0.114));
  float crowd = smoothstep(0.62, 0.3, d) * (1.0 - rigid) * (1.0 - smoothstep(0.62, 0.85, lum)) * smoothstep(uCrowdY - 0.06, uCrowdY + 0.02, uv.y);
  float col = floor(uv.x * 260.0);
  float ph = hash(vec2(col, 7.0));
  float hop = pow(max(0.0, 1.0 - fract(uBeat - ph * 0.35) * 2.2), 2.0);
  puv.y -= (hop * 2.4 + sin(uTime * 2.6 + ph * 6.283) * 0.5) / ${REF_H}.0 * crowd;
  vec3 c = crowd > 0.001 ? plate(puv) : probe;
  lum = dot(c, vec3(0.299, 0.587, 0.114));
  // the painting's own lights: flicker + a breath on the beat
  float pulse = pow(1.0 - fract(uBeat), 2.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    vec4 L = uLights[i];
    if (L.z <= 0.0) continue;
    vec2 dl = (uv - L.xy) * vec2(uAspect, 1.0);
    float g = exp(-dot(dl, dl) / (L.z * L.z));
    float fl = 0.55 + 0.45 * sin(uTime * (2.0 + L.w) + L.w * 9.0) * sin(uTime * (0.7 + L.w * 0.5));
    c += uLightCol[i] * g * (0.18 + 0.22 * fl + 0.18 * pulse);
  }
  c += c * smoothstep(0.62, 0.95, lum) * 0.16 * pulse * (1.0 - rigid);
  // haze drifting through the depth (thicker far away)
  float n = fbm(uv * vec2(5.0 * uAspect / 2.6, 5.0) + vec2(uTime * 0.035, -uTime * 0.012));
  c = mix(c, uHaze, smoothstep(0.35, 0.9, n) * far * 0.24 * (1.0 - rigid));
  // camera flashes in the stands
  for (int i = 0; i < 3; i++) {
    vec4 F = uFlash[i];
    if (F.w <= 0.0) continue;
    vec2 df = (uv - F.xy) * vec2(uAspect, 1.0);
    c += vec3(1.0, 0.97, 0.92) * exp(-dot(df, df) / (F.z * F.z)) * F.w;
  }
  // entrance: the painting wakes up from a darker, cooler frame
  c = mix(c * vec3(0.55, 0.6, 0.75), c, uIntro);
  gl_FragColor = vec4(c, 1.0);
}`;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const i = new Image();
    i.decoding = 'async';
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

// ------------------------------------------------------------------------------------------------ plate resources
// S12 (iPhone: screens without their painting): the plate used to be composited into a fresh ~4.6 MB canvas on
// every screen change; iOS caps the total canvas memory and a capped canvas uploads as an empty (black) texture,
// while the CSS painting was already hidden. Now the master's three tiles are textures as they are (no canvas),
// the UI mask is a small data texture, the depth is read back at 1/3 size, and every screen's set stays cached on
// the GPU (a few screens, LRU): going back to a screen costs no reload, no decode, no upload.

interface PlateRes {
  key: string;
  x0: number;
  x1: number;
  tiles: [THREE.Texture, THREE.Texture, THREE.Texture];
  depth: THREE.Texture;
  rigid: THREE.DataTexture;
  depthPx: Uint8Array;
  depthW: number;
  depthH: number;
  /** Expected brightness (0..255 sum of rgb) at the probe points of the centre tile, for the upload check. */
  expect: number[];
  /** Upload verified in the current GL context. */
  ok: boolean;
}

const cache = new Map<string, Promise<PlateRes | null>>();
/** Test hook: ?livingfail makes every upload check fail (the CSS painting must stay). */
const failTest = typeof location !== 'undefined' && new URLSearchParams(location.search).has('livingfail');
const cacheMax = () => (isPhone() ? 3 : 5);

function texOf(src: HTMLImageElement): THREE.Texture {
  const t = new THREE.Texture(src);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

function freeRes(r: PlateRes): void {
  for (const t of [...r.tiles, r.depth, r.rigid]) t.dispose();
}

/** Drop every cached plate (the menus' GL context goes away or was lost). */
export function clearPlateCache(): void {
  for (const p of cache.values()) void p.then((r) => r && freeRes(r));
  cache.clear();
}

/** Small throwaway 2D canvas: read pixels, then give the memory back at once (iOS counts it until GC). */
function readPixels(img: HTMLImageElement, w: number, h: number): Uint8ClampedArray | null {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  let px: Uint8ClampedArray | null = null;
  if (g) {
    try {
      g.drawImage(img, 0, 0, w, h);
      px = g.getImageData(0, 0, w, h).data;
    } catch {
      px = null; // tainted or out of canvas memory
    }
  }
  c.width = c.height = 0;
  return px;
}

/** Probe points (tile index, tile UV with y down) used by the upload check: a grid over the centre tile, three points in
 *  each wing (skipped where off screen). */
const PROBES: [number, number, number][] = [];
for (const v of [0.3, 0.55, 0.8]) for (const u of [0.25, 0.5, 0.75]) PROBES.push([1, u, v]);
PROBES.push([0, 0.35, 0.45], [0, 0.65, 0.7], [0, 0.5, 0.25], [2, 0.35, 0.45], [2, 0.65, 0.7], [2, 0.5, 0.25]);

async function buildRes(a: ScreenArt, rigidExtra: readonly (readonly number[])[], key: string): Promise<PlateRes | null> {
  const keys = ['l', 'c', 'r'] as const;
  const x0 = Math.min(...keys.map((k) => a.plate[k][0]));
  const x1 = Math.max(...keys.map((k) => a.plate[k][0] + a.plate[k][2]));
  const dir = a.plateDir ?? a.dir;
  const [imgs, depth] = await Promise.all([Promise.all(keys.map((k) => loadImage(`${dir}plate_${k}.webp`))), loadImage(`${dir}depth.webp`)]);
  if (!depth || imgs.some((i) => !i)) return null;
  // UI mask: every sprite / button box of the screen stays rigid, feathered (two box blurs) so nothing tears
  const mw = 620;
  const mh = Math.round((mw * REF_H) / (x1 - x0));
  const ms = mw / (x1 - x0);
  let m: Uint8Array = new Uint8Array(mw * mh);
  for (const [x, y, w, h] of [...Object.values(a.art), ...rigidExtra]) {
    const ax = Math.max(0, Math.floor((x - x0 - 8) * ms));
    const bx = Math.min(mw, Math.ceil((x - x0 + w + 8) * ms));
    const ay = Math.max(0, Math.floor((y - 8) * ms));
    const by = Math.min(mh, Math.ceil((y + h + 8) * ms));
    // rows bottom-up: data textures are not flipped
    for (let yy = ay; yy < by; yy++) m.fill(255, (mh - 1 - yy) * mw + ax, (mh - 1 - yy) * mw + bx);
  }
  for (let pass = 0; pass < 2; pass++) m = boxBlur(m, mw, mh, 2);
  const rigid = new THREE.DataTexture(m, mw, mh, THREE.RedFormat, THREE.UnsignedByteType);
  rigid.minFilter = rigid.magFilter = THREE.LinearFilter;
  rigid.unpackAlignment = 1;
  rigid.needsUpdate = true;
  // depth on the CPU too (the figures read it for their parallax), at a third of the size
  const dw = Math.max(1, Math.round(depth.naturalWidth / 3));
  const dh = Math.max(1, Math.round(depth.naturalHeight / 3));
  const dpx = readPixels(depth, dw, dh);
  const depthPx = new Uint8Array(dw * dh);
  if (dpx) for (let i = 0; i < dw * dh; i++) depthPx[i] = dpx[i * 4];
  else depthPx.fill(150);
  // expected colours for the upload check: every tile, tiny
  const PW = 24;
  const PH = 27;
  const small = imgs.map((im) => readPixels(im!, PW, PH));
  const expect = PROBES.map(([k, u, v]) => {
    const px = small[k];
    if (!px) return -1;
    const i = (Math.min(PH - 1, Math.round(v * (PH - 1))) * PW + Math.min(PW - 1, Math.round(u * (PW - 1)))) * 4;
    return px[i] + px[i + 1] + px[i + 2];
  });
  return {
    key,
    x0,
    x1,
    tiles: [texOf(imgs[0]!), texOf(imgs[1]!), texOf(imgs[2]!)],
    depth: texOf(depth),
    rigid,
    depthPx,
    depthW: dw,
    depthH: dh,
    expect,
    ok: false,
  };
}

function boxBlur(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(src.length);
  const out = new Uint8Array(src.length);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[o + Math.max(0, Math.min(w - 1, x + k))];
      tmp[o + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.max(0, Math.min(h - 1, y + k)) * w + x];
      out[y * w + x] = s / n;
    }
  }
  return out;
}

function plateRes(a: ScreenArt, rigidExtra: readonly (readonly number[])[]): Promise<PlateRes | null> {
  const key = (a.plateDir ?? a.dir) + JSON.stringify(rigidExtra);
  let p = cache.get(key);
  if (p) {
    cache.delete(key); // LRU: most recent last
    cache.set(key, p);
    return p;
  }
  p = buildRes(a, rigidExtra, key);
  cache.set(key, p);
  while (cache.size > cacheMax()) {
    const [k, old] = cache.entries().next().value as [string, Promise<PlateRes | null>];
    cache.delete(k);
    void old.then((r) => r && freeRes(r));
  }
  void p.then((r) => {
    if (!r && cache.get(key) === p) cache.delete(key); // failed loads are retried next time
  });
  return p;
}

/** One screen's living plate: the painting + depth + UI mask as textures, drawn as one quad. */
export class LivingPlate {
  readonly scene = new THREE.Scene();
  readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  private res: PlateRes | null = null;
  private x0 = -400;
  private x1 = 2072;
  private flashes = [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()];
  private nextFlash = 0.6;
  private t0 = performance.now();
  private pointer = new THREE.Vector2();
  private disposed = false;
  /** The GL painting has replaced the CSS one (upload checked in this context). */
  private live = false;
  private failed = false;
  private tries = 0;
  /** Resources loaded (the plate may still fail its upload check). */
  ready = false;
  /** Current parallax offset in plate UV (read by the figures for their own shift). */
  readonly par = new THREE.Vector2();

  constructor(
    private art: ScreenArt,
    private root: HTMLElement,
    private opts: { haze?: [number, number, number]; crowdY?: number; rigid?: [number, number, number, number][] } = {},
  ) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tL: { value: null },
        tC: { value: null },
        tR: { value: null },
        uCX: { value: new THREE.Vector2(0, 1) },
        uLX: { value: new THREE.Vector2(0, 1) },
        uRX: { value: new THREE.Vector2(0, 1) },
        tDepth: { value: null },
        tRigid: { value: null },
        uRect: { value: new THREE.Vector4(-1, -1, 1, 1) },
        uTime: { value: 0 },
        uBeat: { value: 0 },
        uPar: { value: this.par },
        uAspect: { value: 2472 / REF_H },
        uCrowdY: { value: opts.crowdY ?? 0.38 },
        uHaze: { value: new THREE.Vector3(...(opts.haze ?? [0.55, 0.45, 0.75])) },
        uLights: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
        uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
        uFlash: { value: this.flashes },
        uIntro: { value: 0 },
        uProbe: { value: 0 },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    quad.frustumCulled = false;
    this.scene.add(quad);
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    void this.load();
  }

  private onPointer = (e: PointerEvent): void => {
    this.pointer.set((e.clientX / Math.max(1, innerWidth)) * 2 - 1, (e.clientY / Math.max(1, innerHeight)) * 2 - 1);
  };

  private async load(): Promise<void> {
    const a = this.art;
    const res = await plateRes(a, this.opts.rigid ?? []);
    if (!res || this.disposed || !this.root.isConnected) return;
    this.res = res;
    this.x0 = res.x0;
    this.x1 = res.x1;
    const u = this.mat.uniforms;
    const span = (k: 'l' | 'c' | 'r') => new THREE.Vector2((a.plate[k][0] - res.x0) / (res.x1 - res.x0), (a.plate[k][0] + a.plate[k][2] - res.x0) / (res.x1 - res.x0));
    u.tL.value = res.tiles[0];
    u.tC.value = res.tiles[1];
    u.tR.value = res.tiles[2];
    u.uLX.value = span('l');
    u.uCX.value = span('c');
    u.uRX.value = span('r');
    u.tDepth.value = res.depth;
    u.tRigid.value = res.rigid;
    u.uAspect.value = (this.x1 - this.x0) / REF_H;
    // the painting's light sources (found at extraction): brightest first
    const lights = [...a.lights].sort((p, q) => q[2] - p[2]).slice(0, MAX_LIGHTS);
    lights.forEach(([x, y, r, c], i) => {
      u.uLights.value[i].set((x - this.x0) / (this.x1 - this.x0), 1 - y / REF_H, (Math.max(6, Math.min(28, r)) * 3.2) / REF_H, ((i * 7919) % 17) / 17);
      u.uLightCol.value[i].set(c[0] / 255, c[1] / 255, c[2] / 255);
    });
    this.ready = true;
    this.t0 = performance.now();
  }

  /** Left edge of the extended plate in reference px. */
  get x0Ref(): number {
    return this.x0;
  }

  /** Relative depth (0 far .. 1 near) at a reference-px point of the painting. */
  depthAt(rx: number, ry: number): number {
    const r = this.res;
    if (!r) return 0.6;
    const x = Math.round(((rx - this.x0) / (this.x1 - this.x0)) * (r.depthW - 1));
    const y = Math.round((ry / REF_H) * (r.depthH - 1));
    return r.depthPx[Math.max(0, Math.min(r.depthH - 1, y)) * r.depthW + Math.max(0, Math.min(r.depthW - 1, x))] / 255;
  }

  /** Parallax shift (px on screen) of something standing at depth `d`, for the current frame. */
  shiftPx(d: number, plateWpx: number, plateHpx: number): [number, number] {
    const w = Math.pow(1 - d, 1.35);
    return [-this.par.x * w * plateWpx, this.par.y * w * plateHpx];
  }

  /** Plate placement on screen: the centre piece's image box gives the reference scale and origin. */
  rect(rootBox: DOMRect): { x: number; y: number; w: number; h: number; u: number } | null {
    const img = this.root.querySelector<HTMLImageElement>('.v2-plate img:nth-child(2)');
    if (!img) return null;
    const b = img.getBoundingClientRect();
    if (!b.width) return null;
    const u = b.width / this.art.plate.c[2];
    const ox = b.left - rootBox.left - this.art.plate.c[0] * u;
    const oy = b.top - rootBox.top - this.art.plate.c[1] * u;
    return { x: ox + this.x0 * u, y: oy, w: (this.x1 - this.x0) * u, h: REF_H * u, u };
  }

  /** Upload check: the raw painting was just drawn; a few pixels must match the image (a texture that iOS failed
   *  to upload samples black). */
  private check(r: THREE.WebGLRenderer, p: { x: number; y: number; u: number }, W: number, H: number): boolean {
    const res = this.res!;
    if (res.expect.some((e) => e < 0)) return true; // no reference pixels: trust the upload
    const gl = r.getContext();
    const dpr = r.getPixelRatio();
    const bh = gl.drawingBufferHeight;
    const tiles = [this.art.plate.l, this.art.plate.c, this.art.plate.r];
    const px = new Uint8Array(4);
    const got = [0, 0, 0];
    const want = [0, 0, 0];
    const n = [0, 0, 0];
    PROBES.forEach(([k, u, v], i) => {
      const sx = p.x + (tiles[k][0] - this.x0 + u * tiles[k][2]) * p.u;
      const sy = p.y + v * REF_H * p.u;
      if (sx < 1 || sy < 1 || sx > W - 1 || sy > H - 1) return;
      gl.readPixels(Math.floor(sx * dpr), bh - 1 - Math.floor(sy * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      got[k] += px[0] + px[1] + px[2];
      want[k] += res.expect[i];
      n[k]++;
    });
    // every tile on screen that is bright enough to tell must come out at least half as bright as the image
    const ok = [0, 1, 2].every((k) => n[k] < 2 || want[k] < 60 * n[k] || got[k] >= want[k] * 0.4);
    return ok && !failTest;
  }

  /** Update the uniforms and draw (the renderer's viewport covers the whole root). False = nothing drawn (the CSS
   *  painting stays visible). */
  draw(r: THREE.WebGLRenderer, W: number, H: number, rootBox: DOMRect): boolean {
    const res = this.res;
    if (!this.ready || this.failed || !res) return false;
    const p = this.rect(rootBox);
    if (!p) return false;
    const t = (performance.now() - this.t0) / 1000;
    const u = this.mat.uniforms;
    u.uTime.value = t;
    u.uBeat.value = t * 1.5; // 90 BPM, the menu beat
    u.uIntro.value = Math.min(1, t / 0.9);
    // slow drift + a little pointer influence (desktop); ~8 reference px at the far wall
    const amp = 8 / (this.x1 - this.x0);
    this.par.set(amp * (Math.sin(t * 0.21) * 0.8 + this.pointer.x * 0.5), ((amp * (this.x1 - this.x0)) / REF_H) * (Math.sin(t * 0.15 + 1.3) * 0.45 - this.pointer.y * 0.3));
    // camera flashes: a new one every ~0.5-1.4 s somewhere in the stands
    if (t > this.nextFlash) {
      this.nextFlash = t + 0.45 + Math.random() * 1.0;
      const f = this.flashes.reduce((a, b) => (a.w < b.w ? a : b));
      for (let k = 0; k < 8; k++) {
        const fx = 0.08 + Math.random() * 0.84;
        const fy = 0.5 + Math.random() * 0.45;
        if (this.depthAt(this.x0 + fx * (this.x1 - this.x0), (1 - fy) * REF_H) < 0.35) {
          f.set(fx, fy, (3 + Math.random() * 4) / REF_H, 0.9 + Math.random() * 0.6);
          break;
        }
      }
    }
    for (const f of this.flashes) f.w = Math.max(0, f.w - 0.06);
    // clip-space rect of the plate (y up)
    u.uRect.value.set((p.x / W) * 2 - 1, 1 - ((p.y + p.h) / H) * 2, ((p.x + p.w) / W) * 2 - 1, 1 - (p.y / H) * 2);
    if (!res.ok) {
      u.uProbe.value = 1;
      r.render(this.scene, this.cam);
      u.uProbe.value = 0;
      const pass = this.check(r, p, W, H);
      r.clear();
      if (!pass) {
        // one more upload attempt next frame, then the CSS painting for good
        if (++this.tries >= 2) this.fail();
        else for (const tx of res.tiles) tx.needsUpdate = true;
        return false;
      }
      res.ok = true;
    }
    r.render(this.scene, this.cam);
    if (!this.live) {
      this.live = true;
      this.root.classList.add('v2-living');
      this.root.dataset.living = 'ok';
      // light cones stay above the painting (they were behind the plate images in the back stage)
      const beams = this.root.querySelector('.v2-beams');
      const canvas = this.root.querySelector('canvas.mm-figures');
      if (beams && canvas) this.root.insertBefore(beams, canvas.nextSibling);
    }
    return true;
  }

  private fail(): void {
    this.failed = true;
    this.live = false;
    this.root.classList.remove('v2-living');
    this.root.dataset.living = 'fail';
    console.warn('living plate: texture upload check failed, keeping the static painting');
  }

  /** The GL context went away: show the CSS painting until a draw has been checked again. */
  contextLost(): void {
    this.live = false;
    this.failed = false;
    this.tries = 0;
    if (this.res) this.res.ok = false;
    this.root.classList.remove('v2-living');
    this.root.dataset.living = 'lost';
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('pointermove', this.onPointer);
    this.mat.dispose(); // the textures stay cached for the next visit
    this.root.classList.remove('v2-living');
  }
}
