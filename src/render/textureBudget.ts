// GPU texture budget (D41): iOS Safari kills a tab that holds too much memory ("bricht andauernd ab" on the PO's
// iPhone). The PO's models ship 4K/2K textures; on phones and below 'high' quality they are downscaled once at load
// (characters to 2K, props to 1K); on phones the game's view is dropped while the menus show their own figures. A 4K RGBA texture with mips is
// ~85 MB of GPU memory, a 2K one ~21 MB, a 1K one ~5 MB.
import * as THREE from 'three';
import { detectQuality } from './post';

const KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap'] as const;
type TexHolder = Partial<Record<(typeof KEYS)[number], THREE.Texture | null>>;

export type TexKind = 'character' | 'prop';

export function isPhone(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
}

/** Largest texture side for a kind of asset on this device / quality tier. */
export function texLimit(kind: TexKind): number {
  const q = new URLSearchParams(location.search).get('tex');
  if (q) return Number(q) || 4096; // test hook: ?tex=1024
  if (detectQuality() === 'high' && !isPhone()) return kind === 'character' ? 4096 : 2048;
  return kind === 'character' ? 2048 : 1024;
}

function materialsOf(root: THREE.Object3D): THREE.Material[] {
  const out: THREE.Material[] = [];
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (m) out.push(...(Array.isArray(m) ? m : [m]));
  });
  return out;
}

type Img = CanvasImageSource & { width: number; height: number };

function shrunk(img: Img, max: number): HTMLCanvasElement | null {
  const w = img.width;
  const h = img.height;
  if (!w || !h || Math.max(w, h) <= max) return null;
  const k = max / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext('2d');
  if (!g) return null;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** Swap the canvas for an ImageBitmap when possible: canvases count against Safari's canvas memory cap. */
function settle(tex: THREE.Texture, c: HTMLCanvasElement): void {
  tex.image = c;
  tex.needsUpdate = true;
  if (typeof createImageBitmap !== 'function') return;
  createImageBitmap(c, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
    .then((bmp) => {
      tex.image = bmp;
      tex.needsUpdate = true;
      c.width = c.height = 0;
    })
    .catch(() => undefined);
}

/** Downscale, in place, every texture of `root` larger than `max` px (call once, right after loading). Below 4K the
 *  detail maps (normal, roughness, ...) get half the colour map's size: on a phone screen nobody sees the difference. */
export function limitTextures(root: THREE.Object3D, max: number): number {
  const seen = new Set<THREE.Texture>();
  let n = 0;
  for (const m of materialsOf(root)) {
    for (const k of KEYS) {
      const t = (m as unknown as TexHolder)[k];
      if (!t || seen.has(t)) continue;
      seen.add(t);
      const lim = k === 'map' || k === 'emissiveMap' || max >= 4096 ? max : Math.max(512, max / 2);
      const c = t.image ? shrunk(t.image as Img, lim) : null;
      if (!c) continue;
      settle(t, c);
      n++;
    }
  }
  return n;
}
