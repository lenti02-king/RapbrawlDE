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
uniform sampler2D tPlate;
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

void main() {
  vec2 uv = vUv;
  float d = texture2D(tDepth, uv).r;
  float rigid = max(texture2D(tRigid, uv).r, smoothstep(0.82, 0.95, d));
  float far = 1.0 - d;
  float w = pow(far, 1.35) * (1.0 - rigid);
  vec2 puv = uv + uPar * w;
  // crowd: far, not UI, not a light, in the stands band; every column hops on the beat with its own lag
  vec3 probe = texture2D(tPlate, puv).rgb;
  float lum = dot(probe, vec3(0.299, 0.587, 0.114));
  float crowd = smoothstep(0.62, 0.3, d) * (1.0 - rigid) * (1.0 - smoothstep(0.62, 0.85, lum)) * smoothstep(uCrowdY - 0.06, uCrowdY + 0.02, uv.y);
  float col = floor(uv.x * 260.0);
  float ph = hash(vec2(col, 7.0));
  float hop = pow(max(0.0, 1.0 - fract(uBeat - ph * 0.35) * 2.2), 2.0);
  puv.y -= (hop * 2.4 + sin(uTime * 2.6 + ph * 6.283) * 0.5) / ${REF_H}.0 * crowd;
  vec3 c = texture2D(tPlate, puv).rgb;
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

/** One screen's living plate: the painting + depth + UI mask as textures, drawn as one quad. */
export class LivingPlate {
  readonly scene = new THREE.Scene();
  readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  private tex: THREE.Texture[] = [];
  private x0 = -400;
  private x1 = 2072;
  private depthPx: Uint8ClampedArray | null = null;
  private depthW = 0;
  private depthH = 0;
  private flashes = [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()];
  private nextFlash = 0.6;
  private t0 = performance.now();
  private pointer = new THREE.Vector2();
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
        tPlate: { value: null },
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
    const keys = ['l', 'c', 'r'] as const;
    this.x0 = Math.min(...keys.map((k) => a.plate[k][0]));
    this.x1 = Math.max(...keys.map((k) => a.plate[k][0] + a.plate[k][2]));
    const [imgs, depth] = await Promise.all([Promise.all(keys.map((k) => loadImage(`${a.dir}plate_${k}.webp`))), loadImage(`${a.dir}depth.webp`)]);
    if (!depth || imgs.some((i) => !i) || !this.root.isConnected) return;
    // painting: one canvas over the whole extended plate (phones at 0.7 scale: ~4 MB of texture)
    const s = isPhone() ? 0.7 : 1;
    const W = Math.round((this.x1 - this.x0) * s);
    const H = Math.round(REF_H * s);
    const pc = document.createElement('canvas');
    pc.width = W;
    pc.height = H;
    const pg = pc.getContext('2d');
    if (!pg) return;
    keys.forEach((k, i) => {
      if (k === 'c') return;
      const [x, y, w, h] = a.plate[k];
      pg.drawImage(imgs[i]!, (x - this.x0) * s, y * s, w * s, h * s);
    });
    const [cx, cy, cw, ch] = a.plate.c;
    pg.drawImage(imgs[1]!, (cx - this.x0) * s, cy * s, cw * s, ch * s);
    // UI mask: every sprite / button box of the screen stays rigid (feathered so nothing tears at the edges)
    const mw = 620;
    const mh = Math.round((mw * REF_H) / (this.x1 - this.x0));
    const ms = mw / (this.x1 - this.x0);
    const mc = document.createElement('canvas');
    mc.width = mw;
    mc.height = mh;
    const mg = mc.getContext('2d');
    if (!mg) return;
    mg.fillStyle = '#000';
    mg.fillRect(0, 0, mw, mh);
    mg.filter = 'blur(2px)';
    mg.fillStyle = '#fff';
    for (const [x, y, w, h] of [...Object.values(a.art), ...(this.opts.rigid ?? [])]) mg.fillRect((x - this.x0 - 8) * ms, (y - 8) * ms, (w + 16) * ms, (h + 16) * ms);
    // depth on the CPU too (the figures read it for their parallax)
    const dc = document.createElement('canvas');
    dc.width = this.depthW = depth.naturalWidth;
    dc.height = this.depthH = depth.naturalHeight;
    const dg = dc.getContext('2d', { willReadFrequently: true });
    if (dg) {
      dg.drawImage(depth, 0, 0);
      this.depthPx = dg.getImageData(0, 0, dc.width, dc.height).data;
    }
    const mk = (src: HTMLCanvasElement | HTMLImageElement) => {
      const t = new THREE.Texture(src);
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.needsUpdate = true;
      this.tex.push(t);
      return t;
    };
    const u = this.mat.uniforms;
    u.tPlate.value = mk(pc);
    u.tDepth.value = mk(depth);
    u.tRigid.value = mk(mc);
    u.uAspect.value = (this.x1 - this.x0) / REF_H;
    // the painting's light sources (found at extraction): brightest first
    const lights = [...a.lights].sort((p, q) => q[2] - p[2]).slice(0, MAX_LIGHTS);
    lights.forEach(([x, y, r, c], i) => {
      u.uLights.value[i].set((x - this.x0) / (this.x1 - this.x0), 1 - y / REF_H, (Math.max(6, Math.min(28, r)) * 3.2) / REF_H, ((i * 7919) % 17) / 17);
      u.uLightCol.value[i].set(c[0] / 255, c[1] / 255, c[2] / 255);
    });
    this.ready = true;
    this.t0 = performance.now();
    this.root.classList.add('v2-living');
    // light cones stay above the painting (they were behind the plate images in the back stage)
    const beams = this.root.querySelector('.v2-beams');
    const canvas = this.root.querySelector('canvas.mm-figures');
    if (beams && canvas) this.root.insertBefore(beams, canvas.nextSibling);
  }

  /** Left edge of the extended plate in reference px. */
  get x0Ref(): number {
    return this.x0;
  }

  /** Relative depth (0 far .. 1 near) at a reference-px point of the painting. */
  depthAt(rx: number, ry: number): number {
    if (!this.depthPx) return 0.6;
    const x = Math.round(((rx - this.x0) / (this.x1 - this.x0)) * (this.depthW - 1));
    const y = Math.round((ry / REF_H) * (this.depthH - 1));
    const i = (Math.max(0, Math.min(this.depthH - 1, y)) * this.depthW + Math.max(0, Math.min(this.depthW - 1, x))) * 4;
    return this.depthPx[i] / 255;
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

  /** Update the uniforms and draw (the renderer's viewport covers the whole root). */
  draw(r: THREE.WebGLRenderer, W: number, H: number, rootBox: DOMRect): void {
    if (!this.ready) return;
    const p = this.rect(rootBox);
    if (!p) return;
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
    r.render(this.scene, this.cam);
  }

  dispose(): void {
    window.removeEventListener('pointermove', this.onPointer);
    for (const t of this.tex) t.dispose();
    this.mat.dispose();
    this.root.classList.remove('v2-living');
  }
}
