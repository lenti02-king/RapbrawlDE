// Design v2 runtime (D42): screens cut from the PO's second master set (tools/ui-extract/v2*.py). The plate is the
// master itself with only the changing parts removed (baked English text, badges, placeholder figures), so every
// panel sprite lies on its own pixels and the UI stays glued to the painted scene: nothing looks pasted on. Depth
// comes from what moves in front of and between the layers: flickering stage lights, sweeping beams, floor haze,
// floating embers and the live 3D fighters between the scene and the UI.
//
// Layout: the 1672x941 master is scaled to the screen height (or width on tall screens) and centred; wider screens
// see the mirrored, darkened wings of the plate (outside the UI). Nothing is ever cropped. Bottom UI lifts above
// the iPhone home indicator.
import './v2.css';
import { esc, fitTexts, keepLaidOut, pos, safeInsets, text, type Box, type TextOpts } from '../menu/kit';
import { menuFigures } from '../menu/figures';
import { LivingPlate } from './living';

export const REF_W = 1672;
export const REF_H = 941;

export interface ScreenArt {
  dir: string;
  plate: { readonly l: readonly number[]; readonly c: readonly number[]; readonly r: readonly number[] };
  art: Readonly<Record<string, readonly number[]>>;
  lights: readonly (readonly [number, number, number, readonly number[]])[];
}

export const src = (a: ScreenArt, id: string) => `${a.dir}${id}.webp`;
export const box = (a: ScreenArt, id: string): Box => {
  const [x, y, w, h] = a.art[id];
  return [x, y, x + w, y + h];
};
/** A text/mark box from the generated table ([x0, y0, x1, y1] in reference px). */
export const zone = (b: readonly number[]): Box => [b[0], b[1], b[2], b[3]];

export function plateHtml(a: ScreenArt): string {
  return `<div class="v2-plate">${(['l', 'c', 'r'] as const)
    .map((k) => {
      const [x, y, w, h] = a.plate[k];
      return `<img alt="" draggable="false" decoding="async" src="${a.dir}plate_${k}.webp" style="${pos(x, y, w, h)}">`;
    })
    .join('')}</div>`;
}

export function sprite(a: ScreenArt, id: string, cls = '', extra = ''): string {
  const [x, y, w, h] = a.art[id];
  return `<img class="v2-art ${cls}" alt="" draggable="false" decoding="async" src="${src(a, id)}" style="${pos(x, y, w, h)}${extra}">`;
}

/** Button whose face is an extracted sprite; `inner` gets the sprite's origin for relative children. */
export function button(a: ScreenArt, id: string, act: string, label: string, inner: (ox: number, oy: number) => string = () => '', cls = '', style = ''): string {
  const [x, y, w, h] = a.art[id];
  return `<button class="v2-btn ${cls}" data-act="${act}" aria-label="${esc(label)}" style="${pos(x, y, w, h)};${style}"><img class="v2-face" alt="" draggable="false" decoding="async" src="${src(
    a,
    id,
  )}">${inner(x, y)}</button>`;
}

/** Invisible hit area over painted art (e.g. a tab of the baked nav bar). */
export function hit(b: Box, act: string, label: string, inner = '', cls = ''): string {
  return `<button class="v2-hit ${cls}" data-act="${act}" aria-label="${esc(label)}" style="${pos(b[0], b[1], b[2] - b[0], b[3] - b[1])}">${inner}</button>`;
}

/** Native text (kit.text) in the v2 type styles. */
export function t(s: string, b: Box, ox: number, oy: number, o: TextOpts): string {
  return text(s, b, ox, oy, o).replace('class="mm-t ', 'class="mm-t v2-t ');
}

// ------------------------------------------------------------------------------------------------ depth effects

/** Glows over the plate's light sources (detected at extraction), each flickering on its own beat. */
export function lightsHtml(a: ScreenArt, max = 26): string {
  return `<div class="v2-lights">${a.lights
    .slice(0, max)
    .map(([x, y, r, c], i) => {
      const rr = Math.max(5, Math.min(26, r)) * 5;
      const p = (2.2 + ((i * 7919) % 23) / 10).toFixed(2);
      const d = (-((i * 104729) % 37) / 10).toFixed(2);
      return `<i style="${pos(x - rr, y - rr, 2 * rr, 2 * rr)};--c:${c[0]} ${c[1]} ${c[2]};--p:${p}s;--d:${d}s"></i>`;
    })
    .join('')}</div>`;
}

export interface Beam {
  x: number;
  y: number;
  len: number;
  w: number;
  rot: number; // degrees from straight down (positive = toward +x)
  swing: number; // sweep amplitude in degrees
  color: string; // r g b
  period: number;
  delay?: number;
  alpha?: number;
}
/** Sweeping light cones from the truss (screen-blended, behind the fighters). */
export function beamsHtml(list: Beam[]): string {
  return `<div class="v2-beams">${list
    .map(
      (b) =>
        `<i style="${pos(b.x - b.w / 2, b.y, b.w, b.len)};--r0:${b.rot - b.swing}deg;--r1:${b.rot + b.swing}deg;--c:${b.color};--p:${b.period}s;--d:${-(b.delay ?? 0)}s;--a:${b.alpha ?? 0.22}"></i>`,
    )
    .join('')}</div>`;
}

let hazeUrl = '';
/** Soft tileable smoke texture (made once, procedurally). */
function hazeTexture(): string {
  if (hazeUrl) return hazeUrl;
  const W = 512;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return '';
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W;
    const y = H * (0.35 + rnd() * 0.5);
    const r = 18 + rnd() * 46;
    const a = 0.05 + rnd() * 0.08;
    for (const dx of [-W, 0, W]) {
      const grd = g.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      grd.addColorStop(0, `rgba(255,255,255,${a})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(x + dx - r, y - r, 2 * r, 2 * r);
    }
  }
  hazeUrl = c.toDataURL('image/png');
  return hazeUrl;
}

let grungeUrl = '';
/** Dry-brush grain for painted lettering: an alpha mask with specks and streaks punched out. */
function grungeTexture(): string {
  if (grungeUrl) return grungeUrl;
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  if (!g) return '';
  g.fillStyle = '#fff';
  g.fillRect(0, 0, N, N);
  let seed = 11;
  const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 520; i++) {
    const x = rnd() * N;
    const y = rnd() * N;
    const r = 0.4 + rnd() * rnd() * 2.6;
    g.globalAlpha = 0.5 + rnd() * 0.5;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.lineCap = 'round';
  for (let i = 0; i < 36; i++) {
    const x = rnd() * N;
    const y = rnd() * N;
    g.globalAlpha = 0.25 + rnd() * 0.45;
    g.lineWidth = 0.6 + rnd() * 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 10 + rnd() * 40, y + (rnd() - 0.5) * 3);
    g.stroke();
  }
  grungeUrl = c.toDataURL('image/png');
  return grungeUrl;
}

/** Drifting floor haze over a band of the scene (in front of the fighters' legs). */
export function hazeHtml(b: Box, tint = '205 190 255', alpha = 0.55): string {
  return `<div class="v2-haze" style="${pos(b[0], b[1], b[2] - b[0], b[3] - b[1])};--c:${tint};--a:${alpha}"><b></b><b></b></div>`;
}

/** Floating embers / dust (one small 2D canvas over the whole screen, under the UI). */
export class Embers {
  readonly canvas = document.createElement('canvas');
  private raf = 0;
  private parts: { x: number; y: number; vx: number; vy: number; r: number; a: number; hue: number; ph: number }[] = [];
  private last = performance.now();
  constructor(
    private root: HTMLElement,
    private count = 34,
    private hues = [38, 320, 205],
  ) {
    this.canvas.className = 'v2-embers';
  }
  start(): void {
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (!this.root.isConnected) return this.stop();
      this.frame(Math.min(0.05, (now - this.last) / 1000));
      this.last = now;
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop(): void {
    cancelAnimationFrame(this.raf);
  }
  private frame(dt: number): void {
    const c = this.canvas;
    const W = this.root.clientWidth;
    const H = this.root.clientHeight;
    if (!W || !H) return; // not laid out yet (0/0 alphas would throw in addColorStop)
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    while (this.parts.length < this.count) {
      const fresh = this.parts.length < this.count * 0.6 && this.last < 1e12;
      this.parts.push({
        x: Math.random() * W,
        y: fresh ? Math.random() * H : H + 10,
        vx: (Math.random() - 0.5) * 12,
        vy: -(14 + Math.random() * 36),
        r: 0.6 + Math.random() * 1.9,
        a: 0.35 + Math.random() * 0.55,
        hue: this.hues[Math.floor(Math.random() * this.hues.length)],
        ph: Math.random() * 6.28,
      });
    }
    g.globalCompositeOperation = 'lighter';
    const s = H / 430;
    for (const p of this.parts) {
      p.ph += dt * 2;
      p.x += (p.vx + Math.sin(p.ph) * 8) * dt * s;
      p.y += p.vy * dt * s;
      const fade = Math.min(1, p.y / (H * 0.25));
      const tw = 0.6 + 0.4 * Math.sin(p.ph * 1.7);
      const r = p.r * s;
      const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
      grd.addColorStop(0, `hsla(${p.hue},100%,75%,${p.a * fade * tw})`);
      grd.addColorStop(0.35, `hsla(${p.hue},100%,60%,${p.a * fade * tw * 0.35})`);
      grd.addColorStop(1, `hsla(${p.hue},100%,50%,0)`);
      g.fillStyle = grd;
      g.fillRect(p.x - r * 4, p.y - r * 4, r * 8, r * 8);
    }
    this.parts = this.parts.filter((p) => p.y > -20 && p.x > -40 && p.x < W + 40);
  }
}

// ------------------------------------------------------------------------------------------------ layout + mount

/** Scale the reference stage to the screen: height-fit, centred; tall screens width-fit. Returns px per ref px. */
export function layoutV2(root: HTMLElement): number {
  const W = root.clientWidth;
  const H = root.clientHeight;
  if (!W || !H) return 0;
  const ins = safeInsets(root);
  const s = Math.min(H / REF_H, (W - ins.l - ins.r) / REF_W);
  const tx = Math.round((W - REF_W * s) / 2 + (ins.l - ins.r) / 2);
  const ty = Math.round((H - REF_H * s) / 2);
  root.querySelectorAll<HTMLElement>('.v2-stage').forEach((st) => (st.style.transform = `translate(${tx}px, ${ty}px)`));
  root.style.setProperty('--u', `${s}px`);
  root.style.setProperty('--lift', `${Math.max(0, ins.b - ty)}px`);
  fitTexts(root);
  return s;
}

export interface MountOpts {
  embers?: number | false;
  hues?: number[];
  /** Living plate (D43): the screen's painting drawn with depth parallax, crowd, lights and haze (needs depth.webp). */
  living?: ScreenArt;
  /** Haze colour (0..1 rgb) and the lowest row of the crowd (plate UV, 0 = bottom) for the living plate. */
  haze?: [number, number, number];
  crowdY?: number;
  /** Extra boxes of the painting that must not move (logo etc., [x, y, w, h] reference px). */
  rigid?: [number, number, number, number][];
}

/** Mount a v2 screen: layout (resize, fonts), embers, fade in once the plate is decoded (no half-loaded frame).
 *  Returns the stop function. */
export function mountV2(root: HTMLElement, o: MountOpts = {}): () => void {
  root.classList.add('mm', 'v2');
  const stop = keepLaidOut(root, () => layoutV2(root));
  let embers: Embers | null = null;
  if (root.querySelector('.v2-haze')) root.style.setProperty('--haze', `url(${hazeTexture()})`);
  root.style.setProperty('--grunge', `url(${grungeTexture()})`);
  if (o.embers !== false) {
    embers = new Embers(root, o.embers ?? 34, o.hues);
    const front = root.querySelector('.v2-stage.front');
    root.insertBefore(embers.canvas, front);
    embers.start();
  }
  const figs = o.living && !new URLSearchParams(location.search).has('still') ? menuFigures(root) : null;
  figs?.setBackground(new LivingPlate(o.living!, root, { haze: o.haze, crowdY: o.crowdY, rigid: o.rigid }));
  const imgs = [...root.querySelectorAll<HTMLImageElement>('.v2-plate img')];
  const ready = () => root.classList.add('ready');
  const timer = window.setTimeout(ready, 1500);
  void Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => undefined) : Promise.resolve()))).then(() => {
    window.clearTimeout(timer);
    ready();
  });
  return () => {
    stop();
    embers?.stop();
    figs?.dispose();
    window.clearTimeout(timer);
  };
}

/** Root markup: back stage (plate, lights, beams), [3D figures + embers are inserted between], front stage (haze, UI). */
export function screenHtml(back: string, front: string): string {
  return `<div class="v2-stage back">${back}</div><div class="v2-stage front">${front}</div><div class="mm-toast" hidden></div>`;
}
