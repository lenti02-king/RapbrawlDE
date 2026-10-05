// Shared helpers for screens built from the PO master screenshots (D38): reference-pixel positioning, native text
// boxes that shrink to fit, safe-area insets. Screens set --u (px per reference pixel) on their root.
import './kit.css';

export type Box = readonly [number, number, number, number];

export const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const de = (n: number) => Math.round(n).toLocaleString('de-DE');
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const pos = (x: number, y: number, w: number, h: number) => `--x:${x};--y:${y};--w:${w};--h:${h}`;

export interface TextOpts {
  cls: string; // style class (mm-title, mm-sub, ...)
  fs: number; // font size in reference px
  align?: 'left' | 'center' | 'right';
  html?: string; // rich content (already escaped)
}

/** Native text in a reference box (relative to the parent at ox/oy); shrinks to fit if a German word is longer. */
export function text(t: string, box: Box, ox: number, oy: number, o: TextOpts): string {
  const [x0, y0, x1, y1] = box;
  const inner = o.html ?? esc(t);
  return `<span class="mm-t ${o.cls}" style="${pos(x0 - ox, y0 - oy, x1 - x0, y1 - y0)};--fs:${o.fs};justify-content:${
    o.align === 'center' ? 'center' : o.align === 'right' ? 'flex-end' : 'flex-start'
  }"><i data-t="${esc(t)}">${inner}</i></span>`;
}

export function safeInsets(root: HTMLElement): { l: number; r: number; t: number; b: number } {
  const forced = new URLSearchParams(location.search).get('safe'); // test hook: ?safe=47 simulates a notch phone
  if (forced) {
    const v = Number(forced) || 0;
    return { l: v, r: v, t: 0, b: Math.round(v * 0.45) };
  }
  let probe = root.querySelector<HTMLElement>('.mm-safe');
  if (!probe) {
    probe = document.createElement('div');
    probe.className = 'mm-safe';
    root.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  return { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 };
}

/** Shrink native text that is wider than its box (German words run longer than the English master). */
export function fitTexts(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.mm-t').forEach((el) => {
    el.style.setProperty('--fit', '1');
    const i = el.firstElementChild as HTMLElement | null;
    if (!i) return;
    const need = i.scrollWidth;
    const have = el.clientWidth;
    if (need > have && need > 0) el.style.setProperty('--fit', (have / need).toFixed(3));
  });
}

/** Background-size: cover of a REF_W x REF_H image anchored at (ax, ay) in 0..1: scale and offset in screen px. */
export function coverOf(W: number, H: number, refW: number, refH: number, ax = 0.5, ay = 0.5): { s: number; ox: number; oy: number } {
  const s = Math.max(W / refW, H / refH);
  return { s, ox: (W - refW * s) * ax, oy: (H - refH * s) * ay };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Stage in the master's coordinate space (2000x1125), scaled as large as the `safe` rect (everything interactive)
 *  allows inside the usable screen (safe-area insets), the safe rect centred; then slid (not scaled) so the outpainted
 *  `plate` keeps covering the screen. Phones of any aspect are filled edge to edge; nothing interactive is cut off.
 *  Returns the scale (px per reference pixel). */
export function layoutStage(root: HTMLElement, stage: HTMLElement, safe: Box = [0, 0, 2000, 1125], plate?: Rect): number {
  const W = root.clientWidth;
  const H = root.clientHeight;
  if (!W || !H) return 0;
  const ins = safeInsets(root);
  const aw = W - ins.l - ins.r;
  const ah = H - ins.t - ins.b;
  const sw = safe[2] - safe[0];
  const sh = safe[3] - safe[1];
  const s = Math.min(aw / sw, ah / sh);
  let tx = ins.l + aw / 2 - (safe[0] + sw / 2) * s;
  let ty = ins.t + ah / 2 - (safe[1] + sh / 2) * s;
  if (plate) {
    const slide = (t: number, p0: number, p1: number, view: number, s0: number, s1: number, lo: number, hi: number) => {
      // plate covering needs t in [view - p1*s, -p0*s]; the safe rect visible needs t in [lo - s0*s, hi - s1*s]
      const a = Math.max(view - p1 * s, lo - s0 * s);
      const b = Math.min(-p0 * s, hi - s1 * s);
      return a <= b ? clamp(t, a, b) : t;
    };
    tx = slide(tx, plate.x, plate.x + plate.w, W, safe[0], safe[2], ins.l, W - ins.r);
    ty = slide(ty, plate.y, plate.y + plate.h, H, safe[1], safe[3], ins.t, H - ins.b);
  }
  stage.style.transform = `translate(${tx}px, ${ty}px)`;
  root.style.setProperty('--u', `${s}px`);
  fitTexts(root);
  return s;
}

/** Mount helper: layout now, after fonts, on resize; returns the disconnect function. */
export function keepLaidOut(root: HTMLElement, layout: () => void): () => void {
  layout();
  document.fonts?.ready.then(layout).catch(() => undefined);
  const ro = new ResizeObserver(layout);
  ro.observe(root);
  return () => ro.disconnect();
}

let toastTimer = 0;
/** Short message over the screen (needs a `.mm-toast` element in `root`). */
export function toast(root: HTMLElement, msg: string): void {
  const t = root.querySelector<HTMLElement>('.mm-toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  t.classList.remove('on');
  void t.offsetWidth;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 2200);
}
