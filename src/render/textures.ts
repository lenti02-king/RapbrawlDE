// Procedural PBR texture sets (albedo + normal + roughness), generated once at startup into
// canvases. Tileable value-noise fbm; no external images (zero licensing risk).
import * as THREE from 'three';

export interface PBRSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

// ------------------------------------------------------------------ noise

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Tileable value noise: period in lattice cells. */
function vnoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const a = hash(x0, y0, seed);
  const b = hash(x1, y0, seed);
  const c = hash(x0, y1, seed);
  const d = hash(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** fbm in [0,1]; (x,y) in texture space [0,1). */
function fbm(x: number, y: number, base: number, oct: number, seed: number): number {
  let s = 0;
  let amp = 0.5;
  let f = base;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x * f, y * f, f, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / norm;
}

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

// ------------------------------------------------------------------ field -> textures

class Field {
  readonly h: Float32Array;
  readonly r: Float32Array;
  readonly g: Float32Array;
  readonly b: Float32Array;
  readonly rough: Float32Array;
  constructor(readonly w: number, readonly hgt: number) {
    const n = w * hgt;
    this.h = new Float32Array(n);
    this.r = new Float32Array(n);
    this.g = new Float32Array(n);
    this.b = new Float32Array(n);
    this.rough = new Float32Array(n).fill(0.8);
  }
}

function toCanvas(w: number, h: number, write: (d: Uint8ClampedArray) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  write(img.data);
  g.putImageData(img, 0, 0);
  return c;
}

function tex(c: HTMLCanvasElement, srgb: boolean, repeat: [number, number]): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function finish(f: Field, normalStrength: number, repeat: [number, number] = [1, 1], drawOver?: (g: CanvasRenderingContext2D) => void): PBRSet {
  const { w, hgt } = f;
  const albedo = toCanvas(w, hgt, (d) => {
    for (let i = 0; i < w * hgt; i++) {
      d[i * 4] = Math.max(0, Math.min(255, f.r[i] * 255));
      d[i * 4 + 1] = Math.max(0, Math.min(255, f.g[i] * 255));
      d[i * 4 + 2] = Math.max(0, Math.min(255, f.b[i] * 255));
      d[i * 4 + 3] = 255;
    }
  });
  if (drawOver) drawOver(albedo.getContext('2d')!);
  const normal = toCanvas(w, hgt, (d) => {
    for (let y = 0; y < hgt; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const l = f.h[y * w + ((x - 1 + w) % w)];
        const r = f.h[y * w + ((x + 1) % w)];
        const u = f.h[((y - 1 + hgt) % hgt) * w + x];
        const dn = f.h[((y + 1) % hgt) * w + x];
        let nx = (l - r) * normalStrength;
        let ny = (dn - u) * normalStrength;
        let nz = 1;
        const len = Math.hypot(nx, ny, nz);
        nx /= len;
        ny /= len;
        nz /= len;
        d[i * 4] = (nx * 0.5 + 0.5) * 255;
        d[i * 4 + 1] = (ny * 0.5 + 0.5) * 255;
        d[i * 4 + 2] = (nz * 0.5 + 0.5) * 255;
        d[i * 4 + 3] = 255;
      }
  });
  const rough = toCanvas(w, hgt, (d) => {
    for (let i = 0; i < w * hgt; i++) {
      const v = Math.max(0, Math.min(255, f.rough[i] * 255));
      d[i * 4] = v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
  });
  return { map: tex(albedo, true, repeat), normalMap: tex(normal, false, repeat), roughnessMap: tex(rough, false, repeat) };
}

const cache = new Map<string, PBRSet>();
function cached(key: string, make: () => PBRSet): PBRSet {
  let s = cache.get(key);
  if (!s) {
    s = make();
    cache.set(key, s);
  }
  return s;
}

/** Clone a set with a different repeat (shares the canvases). */
export function withRepeat(s: PBRSet, rx: number, ry: number): PBRSet {
  const c = (t: THREE.Texture) => {
    const n = t.clone();
    n.repeat.set(rx, ry);
    n.needsUpdate = true;
    return n;
  };
  return { map: c(s.map), normalMap: c(s.normalMap), roughnessMap: c(s.roughnessMap) };
}

// ------------------------------------------------------------------ materials

/** Weathered asphalt with aggregate, cracks, patch repairs and oil stains. 1 tile ≈ 4 m. */
export function asphalt(): PBRSet {
  return cached('asphalt', () => {
    const N = 512;
    const f = new Field(N, N);
    const r = rng(11);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const u = x / N;
        const v = y / N;
        const large = fbm(u, v, 3, 3, 1);
        const grain = hash(x, y, 3);
        const fine = fbm(u, v, 64, 2, 5);
        let c = 0.2 + large * 0.07 + (fine - 0.5) * 0.05;
        if (grain > 0.97) c += 0.12; // light aggregate
        else if (grain < 0.03) c -= 0.06;
        f.r[i] = c * 1.0;
        f.g[i] = c * 0.99;
        f.b[i] = c * 1.03;
        f.h[i] = fine * 0.6 + (grain > 0.97 ? 0.4 : 0);
        f.rough[i] = 0.82 + (fine - 0.5) * 0.1;
      }
    // repaired patches (darker, smoother rectangles)
    for (let k = 0; k < 4; k++) {
      const px = Math.floor(r() * N);
      const py = Math.floor(r() * N);
      const pw = 60 + Math.floor(r() * 120);
      const ph = 40 + Math.floor(r() * 90);
      for (let y = py; y < py + ph; y++)
        for (let x = px; x < px + pw; x++) {
          const i = (y % N) * N + (x % N);
          f.r[i] *= 0.82;
          f.g[i] *= 0.82;
          f.b[i] *= 0.84;
          f.rough[i] = 0.7;
          if (y === py || x === px || y === py + ph - 1 || x === px + pw - 1) f.h[i] -= 0.5;
        }
    }
    // cracks: random walks, lowered and darkened
    for (let k = 0; k < 18; k++) {
      let x = r() * N;
      let y = r() * N;
      let a = r() * Math.PI * 2;
      const len = 40 + r() * 160;
      for (let s = 0; s < len; s++) {
        a += (r() - 0.5) * 0.6;
        x += Math.cos(a);
        y += Math.sin(a);
        for (let o = -1; o <= 1; o++) {
          const i = (((Math.floor(y) + o) % N + N) % N) * N + ((Math.floor(x) % N) + N) % N;
          f.h[i] -= o === 0 ? 1.2 : 0.5;
          f.r[i] *= 0.6;
          f.g[i] *= 0.6;
          f.b[i] *= 0.6;
        }
      }
    }
    // oil stains: darker, glossier blobs
    for (let k = 0; k < 7; k++) {
      const cx = r() * N;
      const cy = r() * N;
      const rad = 14 + r() * 30;
      for (let y = -rad; y < rad; y++)
        for (let x = -rad; x < rad; x++) {
          const d = Math.hypot(x, y) / rad;
          if (d > 1) continue;
          const i = (((Math.floor(cy + y) % N) + N) % N) * N + (((Math.floor(cx + x) % N) + N) % N);
          const k2 = (1 - d) * 0.35;
          f.r[i] *= 1 - k2;
          f.g[i] *= 1 - k2;
          f.b[i] *= 1 - k2 * 0.8;
          f.rough[i] = Math.min(f.rough[i], 0.35 + d * 0.4);
        }
    }
    return finish(f, 6);
  });
}

/** Old-building plaster (Altbau facade). tint = base colour 0..1. */
export function plaster(tint: [number, number, number], seed: number): PBRSet {
  return cached(`plaster${seed}${tint.join()}`, () => {
    const N = 512;
    const f = new Field(N, N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const u = x / N;
        const v = y / N;
        const big = fbm(u, v, 2, 4, seed);
        const fine = fbm(u, v, 48, 2, seed + 7);
        // vertical rain streaks
        const streak = fbm(u * 1, v * 0.08, 24, 2, seed + 31);
        let k = 0.9 + (big - 0.5) * 0.22 + (fine - 0.5) * 0.06 - Math.max(0, streak - 0.55) * 0.5;
        k = Math.max(0.45, k);
        f.r[i] = tint[0] * k;
        f.g[i] = tint[1] * k;
        f.b[i] = tint[2] * k;
        f.h[i] = fine * 0.8 + big * 0.2;
        f.rough[i] = 0.9;
      }
    return finish(f, 3);
  });
}

/** Brick wall, running bond. 1 tile ≈ 2 m × 1 m (repeat accordingly). */
export function brick(seed: number, palette: [number, number, number][] = [
  [0.48, 0.2, 0.14],
  [0.56, 0.25, 0.16],
  [0.42, 0.18, 0.13],
  [0.6, 0.32, 0.22],
  [0.35, 0.17, 0.13],
]): PBRSet {
  return cached(`brick${seed}`, () => {
    const W = 512;
    const H = 256;
    const f = new Field(W, H);
    const bw = 64;
    const bh = 21; // 12 rows (H/bh ~ 12.2) -> use 256/12
    const rows = 12;
    const rowH = H / rows;
    const mortar = 3;
    for (let y = 0; y < H; y++) {
      const row = Math.floor(y / rowH);
      const off = row % 2 ? bw / 2 : 0;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const bx = Math.floor((x + off) / bw);
        const lx = (x + off) % bw;
        const ly = y - row * rowH;
        const inMortar = lx < mortar || ly < mortar;
        const u = x / W;
        const v = y / H;
        const fine = fbm(u, v, 64, 2, seed);
        if (inMortar) {
          const m = 0.55 + (fine - 0.5) * 0.15;
          f.r[i] = m * 0.95;
          f.g[i] = m * 0.92;
          f.b[i] = m * 0.86;
          f.h[i] = 0;
          f.rough[i] = 0.95;
        } else {
          const p = palette[Math.floor(hash(bx, row, seed) * palette.length)];
          const vari = 0.85 + hash(bx + 7, row, seed) * 0.3;
          const edge = Math.min(lx - mortar, ly - mortar, bw - lx, rowH - ly) / 4;
          const spots = fbm(u, v, 32, 3, seed + 3);
          const k = vari * (0.9 + (fine - 0.5) * 0.25) * (spots > 0.62 ? 0.75 : 1);
          f.r[i] = p[0] * k;
          f.g[i] = p[1] * k;
          f.b[i] = p[2] * k;
          f.h[i] = Math.min(1, edge) * 0.8 + fine * 0.2;
          f.rough[i] = 0.85;
        }
      }
    }
    void bh;
    return finish(f, 5);
  });
}

/** Corrugated roller shutter (garage door) with dirt; graffiti drawn on top. */
export function shutter(seed: number, withTags = true): PBRSet {
  return cached(`shutter${seed}${withTags}`, () => {
    const N = 512;
    const f = new Field(N, N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const u = x / N;
        const v = y / N;
        const slat = (y % 32) / 32;
        const prof = Math.sin(slat * Math.PI) * 0.8 + (slat < 0.06 ? -0.6 : 0);
        const dirt = fbm(u, v, 6, 4, seed);
        const k = 0.52 + (dirt - 0.5) * 0.25 - v * 0.08;
        f.r[i] = k * 0.92;
        f.g[i] = k * 0.95;
        f.b[i] = k * 0.98;
        f.h[i] = prof;
        f.rough[i] = 0.5 + dirt * 0.3;
      }
    return finish(f, 4, [1, 1], withTags ? (g) => drawTags(g, N, N, seed) : undefined);
  });
}

/** Plank wood (stage deck, pallets). */
export function wood(seed: number): PBRSet {
  return cached(`wood${seed}`, () => {
    const N = 512;
    const f = new Field(N, N);
    const planks = 6;
    const pw = N / planks;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const p = Math.floor(x / pw);
        const lx = x - p * pw;
        const u = x / N;
        const v = y / N;
        const grain = fbm(u * 0.15 + p * 0.37, v * 3, 32, 3, seed + p);
        const tone = 0.75 + hash(p, 1, seed) * 0.35;
        const gap = lx < 2 || lx > pw - 2;
        const k = gap ? 0.15 : tone * (0.7 + grain * 0.45);
        f.r[i] = 0.42 * k;
        f.g[i] = 0.3 * k;
        f.b[i] = 0.2 * k;
        f.h[i] = gap ? 0 : 0.6 + grain * 0.4;
        f.rough[i] = 0.72;
      }
    return finish(f, 3);
  });
}

/** Perforated metal speaker grille. */
export function grille(): PBRSet {
  return cached('grille', () => {
    const N = 256;
    const f = new Field(N, N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const cx = (x % 8) - 4;
        const cy = (y % 8) - 4;
        const hole = cx * cx + cy * cy < 6;
        const k = hole ? 0.02 : 0.12;
        f.r[i] = k;
        f.g[i] = k;
        f.b[i] = k * 1.1;
        f.h[i] = hole ? 0 : 1;
        f.rough[i] = hole ? 1 : 0.45;
      }
    return finish(f, 2);
  });
}

/** Smooth concrete (slabs, sills, curbs). */
export function concrete(seed: number): PBRSet {
  return cached(`concrete${seed}`, () => {
    const N = 256;
    const f = new Field(N, N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const n = fbm(x / N, y / N, 8, 4, seed);
        const k = 0.62 + (n - 0.5) * 0.18;
        f.r[i] = k;
        f.g[i] = k * 0.98;
        f.b[i] = k * 0.95;
        f.h[i] = n;
        f.rough[i] = 0.88;
      }
    return finish(f, 2);
  });
}

/** Hand-style graffiti tags: thick outlined strokes with spray fade (original, abstract). */
export function drawTags(g: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  const r = rng(seed * 13 + 5);
  const cols = ['#e8364f', '#2fb6e8', '#f3c623', '#f2f2f2', '#9b5de5', '#3ddc84'];
  const n = 2 + Math.floor(r() * 2);
  for (let k = 0; k < n; k++) {
    const x0 = w * (0.1 + r() * 0.5);
    const y0 = h * (0.25 + r() * 0.5);
    const size = h * (0.08 + r() * 0.1);
    const pts: [number, number][] = [];
    let x = x0;
    let y = y0;
    for (let s = 0; s < 14; s++) {
      x += size * (0.25 + r() * 0.35);
      y = y0 + (r() - 0.5) * size * 1.6;
      pts.push([x, y]);
    }
    const col = cols[Math.floor(r() * cols.length)];
    const stroke = (lw: number, style: string, alpha: number) => {
      g.globalAlpha = alpha;
      g.strokeStyle = style;
      g.lineWidth = lw;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(x0, y0);
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        g.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
      }
      g.stroke();
    };
    stroke(size * 0.42, '#111', 0.85);
    stroke(size * 0.3, col, 0.9);
    stroke(size * 0.08, 'rgba(255,255,255,0.6)', 0.6);
    // overspray dots
    g.globalAlpha = 0.35;
    g.fillStyle = col;
    for (let i = 0; i < 120; i++) g.fillRect(x0 + r() * (x - x0), y0 + (r() - 0.5) * size * 2.2, 1.5, 1.5);
  }
  g.globalAlpha = 1;
}

/** Building windows atlas (4×2 variants): lit interiors, curtains, dark rooms. Emissive + albedo. */
export function windowAtlas(): { map: THREE.Texture; emissive: THREE.Texture } {
  const W = 512;
  const H = 384;
  const r = rng(91);
  const mk = (emissive: boolean) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    for (let k = 0; k < 8; k++) {
      const x = (k % 4) * 128;
      const y = Math.floor(k / 4) * 192;
      const lit = k % 3 !== 2;
      const warm = k % 2 ? '255,196,120' : '255,170,90';
      if (emissive) {
        g.fillStyle = lit ? `rgba(${warm},1)` : '#000';
        g.fillRect(x, y, 128, 192);
        if (lit) {
          const grd = g.createRadialGradient(x + 64, y + 40, 10, x + 64, y + 90, 120);
          grd.addColorStop(0, 'rgba(255,240,210,0.9)');
          grd.addColorStop(1, 'rgba(120,60,20,0.6)');
          g.fillStyle = grd;
          g.fillRect(x, y, 128, 192);
          // furniture / person silhouettes
          g.fillStyle = 'rgba(40,20,10,0.75)';
          if (k % 4 === 1) {
            g.beginPath();
            g.arc(x + 80, y + 95, 14, 0, Math.PI * 2);
            g.fill();
            g.fillRect(x + 64, y + 108, 32, 84);
          } else g.fillRect(x + 10 + r() * 40, y + 120, 50, 72);
        }
      } else {
        g.fillStyle = lit ? '#2a2018' : '#141820';
        g.fillRect(x, y, 128, 192);
      }
      // curtains (both maps)
      g.fillStyle = emissive ? (lit ? 'rgba(160,90,40,0.85)' : '#000') : '#5a4a3c';
      if (k % 2 === 0) {
        g.fillRect(x, y, 26, 192);
        g.fillRect(x + 102, y, 26, 192);
      }
      // frame cross
      g.fillStyle = emissive ? '#000' : '#e8e2d6';
      g.fillRect(x + 61, y, 6, 192);
      g.fillRect(x, y + 70, 128, 6);
      g.fillRect(x, y, 128, 5);
      g.fillRect(x, y + 187, 128, 5);
      g.fillRect(x, y, 5, 192);
      g.fillRect(x + 123, y, 5, 192);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { map: mk(false), emissive: mk(true) };
}
