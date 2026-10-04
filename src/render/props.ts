// Procedural 3D props for specials and signature cinematics (hearts, crocodile jaws,
// palms, spotlight, smoke, notes). Original stylized shapes; no external assets.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const memo = new Map<string, unknown>();
function once<T>(key: string, make: () => T): T {
  if (!memo.has(key)) memo.set(key, make());
  return memo.get(key) as T;
}

// ------------------------------------------------------------------ hearts

const ZIGZAG: [number, number][] = [
  [0, 0.6],
  [0.13, 0.36],
  [-0.1, 0.12],
  [0.11, -0.18],
  [-0.08, -0.5],
  [0, -1],
];

function heartSide(sign: 1 | -1, split: boolean): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -1);
  s.bezierCurveTo(sign * 0.2, -0.7, sign * 1.0, -0.3, sign * 1.0, 0.25);
  s.bezierCurveTo(sign * 1.0, 0.78, sign * 0.48, 1.02, 0, 0.6);
  if (split) for (const [x, y] of ZIGZAG.slice(1)) s.lineTo(x, y);
  return s;
}

function fullHeartShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -1);
  s.bezierCurveTo(-0.2, -0.7, -1.0, -0.3, -1.0, 0.25);
  s.bezierCurveTo(-1.0, 0.78, -0.48, 1.02, 0, 0.6);
  s.bezierCurveTo(0.48, 1.02, 1.0, 0.78, 1.0, 0.25);
  s.bezierCurveTo(1.0, -0.3, 0.2, -0.7, 0, -1);
  return s;
}

const EXTRUDE = { depth: 0.34, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.12, bevelSegments: 4, curveSegments: 18 };

export function heartGeometry(): THREE.BufferGeometry {
  return once('heart', () => {
    const g = new THREE.ExtrudeGeometry(fullHeartShape(), EXTRUDE);
    g.translate(0, 0, -EXTRUDE.depth / 2);
    return g;
  });
}

export function heartMaterial(color = 0xff3d7f): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.32, metalness: 0.05, transparent: true });
}

/** A big heart made of two halves that can break apart along a zigzag crack. */
export function makeSplitHeart(): { group: THREE.Group; left: THREE.Mesh; right: THREE.Mesh; mat: THREE.MeshStandardMaterial } {
  const mat = heartMaterial();
  const mk = (sign: 1 | -1) => {
    const g = new THREE.ExtrudeGeometry(heartSide(sign, true), EXTRUDE);
    g.translate(0, 0, -EXTRUDE.depth / 2);
    return new THREE.Mesh(g, mat);
  };
  const group = new THREE.Group();
  const left = mk(-1);
  const right = mk(1);
  group.add(left, right);
  // glossy highlight blob on the left lobe
  const hl = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd6e6, transparent: true, opacity: 0.85 }),
  );
  hl.scale.set(1.2, 0.7, 0.3);
  hl.position.set(-0.52, 0.45, 0.32);
  hl.rotation.z = 0.6;
  left.add(hl);
  return { group, left, right, mat };
}

// ------------------------------------------------------------------ crocodile

export interface Croc {
  group: THREE.Group;
  upper: THREE.Group;
  lower: THREE.Group;
  setOpen(deg: number): void;
  setOpacity(a: number): void;
}

/** Stylized crocodile head, hinge at the origin, snout pointing +x. Length ~1 m (scale it). */
export function makeCroc(palette: { top: number; side: number; belly: number } = { top: 0x3f9a45, side: 0x5cbf4e, belly: 0xf0e2a8 }): Croc {
  const mats: THREE.Material[] = [];
  const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, transparent: true, ...extra });
    mats.push(m);
    return m;
  };
  const top = std(palette.top);
  const side = std(palette.side);
  const belly = std(palette.belly);
  const mouth = std(0xb8344a, { roughness: 0.8 });
  const tooth = std(0xfffaf0, { roughness: 0.3 });
  const eyeW = std(0xffe14a, { emissive: 0xffc400, emissiveIntensity: 0.6 });
  const pupil = std(0x111111);

  const jaw = (len: number, h: number, w: number, taper: number) => {
    const g = new RoundedBoxGeometry(len, h, w, 3, Math.min(h, w) * 0.45);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + len / 2;
      const k = 1 - taper * (x / len);
      p.setZ(i, p.getZ(i) * k);
      p.setY(i, p.getY(i) * (1 - taper * 0.4 * (x / len)));
      p.setX(i, x);
    }
    g.computeVertexNormals();
    return g;
  };
  const L = 1.0;
  const upper = new THREE.Group();
  const lower = new THREE.Group();
  // upper jaw
  const uj = new THREE.Mesh(jaw(L, 0.2, 0.46, 0.35), side);
  uj.position.y = 0.1;
  upper.add(uj);
  const ujTop = new THREE.Mesh(jaw(L * 0.96, 0.08, 0.4, 0.38), top);
  ujTop.position.set(0.01, 0.19, 0);
  upper.add(ujTop);
  const upMouth = new THREE.Mesh(jaw(L * 0.92, 0.02, 0.36, 0.4), mouth);
  upMouth.position.set(0.03, 0.005, 0);
  upper.add(upMouth);
  // brow bumps + eyes
  for (const z of [-0.14, 0.14]) {
    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), top);
    brow.scale.set(1.2, 0.9, 1);
    brow.position.set(0.16, 0.24, z);
    upper.add(brow);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 10), eyeW);
    eye.position.set(0.2, 0.28, z * 1.05);
    upper.add(eye);
    const pu = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.02), pupil);
    pu.position.set(0.26, 0.29, z * 1.08);
    upper.add(pu);
  }
  // nostrils
  for (const z of [-0.06, 0.06]) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), top);
    n.position.set(L - 0.08, 0.19, z);
    upper.add(n);
  }
  // back scutes
  for (let i = 0; i < 4; i++) {
    const sc = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.06, 0.06, 1, 0.02), top);
    sc.position.set(-0.04 - i * 0.02, 0.2 + 0.02 * (i % 2), (i % 2 ? 1 : -1) * 0.09);
    upper.add(sc);
  }
  // lower jaw
  const lj = new THREE.Mesh(jaw(L * 0.97, 0.14, 0.42, 0.35), belly);
  lj.position.y = -0.07;
  lower.add(lj);
  const ljSide = new THREE.Mesh(jaw(L * 0.95, 0.1, 0.44, 0.36), side);
  ljSide.position.set(0.0, -0.09, 0);
  lower.add(ljSide);
  const loMouth = new THREE.Mesh(jaw(L * 0.9, 0.02, 0.34, 0.4), mouth);
  loMouth.position.set(0.03, -0.005, 0);
  lower.add(loMouth);
  // teeth (cones along both edges)
  const toothGeo = new THREE.ConeGeometry(0.03, 0.09, 6);
  for (let i = 0; i < 7; i++) {
    const x = 0.14 + i * 0.12;
    const k = 1 - 0.35 * (x / L);
    for (const zs of [-1, 1]) {
      const tu = new THREE.Mesh(toothGeo, tooth);
      tu.position.set(x, -0.03, zs * 0.19 * k);
      tu.rotation.x = Math.PI;
      upper.add(tu);
      const tl = new THREE.Mesh(toothGeo, tooth);
      tl.position.set(x + 0.06, 0.03, zs * 0.18 * k);
      lower.add(tl);
    }
  }
  const group = new THREE.Group();
  group.add(upper, lower);
  return {
    group,
    upper,
    lower,
    setOpen(deg: number) {
      const r = (deg * Math.PI) / 180;
      upper.rotation.z = r * 0.62;
      lower.rotation.z = -r * 0.38;
    },
    setOpacity(a: number) {
      for (const m of mats) m.opacity = a;
      group.visible = a > 0.01;
    },
  };
}

// ------------------------------------------------------------------ palms + sunset

function leafGeometry(): THREE.BufferGeometry {
  return once('leaf', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(0.5, 0.22, 1.6, 0.0);
    s.quadraticCurveTo(0.5, -0.22, 0, 0);
    const g = new THREE.ShapeGeometry(s, 10);
    // rotate into the XZ plane and droop the tip
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      p.setXYZ(i, x, -0.28 * x * x + 0.18 * x, y);
    }
    g.computeVertexNormals();
    return g;
  });
}

/** Silhouette palm tree, base at the origin, ~height m tall, curving toward +x by `lean`. */
export function makePalm(height: number, lean: number, color = 0x2a1540): THREE.Group {
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false });
  const g = new THREE.Group();
  const segs = 8;
  let x = 0;
  let y = 0;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const len = height / segs;
    const ang = lean * t * t * 0.9;
    const r0 = 0.16 * (1 - t * 0.45);
    const r1 = 0.16 * (1 - (t + 1 / segs) * 0.45);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0 * 1.08, len * 1.04, 10), mat);
    const dx = Math.sin(ang) * len;
    const dy = Math.cos(ang) * len;
    seg.position.set(x + dx / 2, y + dy / 2, 0);
    seg.rotation.z = -ang;
    g.add(seg);
    x += dx;
    y += dy;
  }
  const crown = new THREE.Group();
  crown.position.set(x, y, 0);
  g.add(crown);
  const leaf = leafGeometry();
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(leaf, mat);
    m.rotation.y = (i / 9) * Math.PI * 2 + 0.3;
    m.rotation.z = 0.25 - (i % 3) * 0.12;
    m.scale.setScalar(0.9 + (i % 2) * 0.25);
    crown.add(m);
  }
  const coco = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat);
  coco.position.set(0.05, -0.08, 0.06);
  crown.add(coco);
  g.userData.crown = crown;
  return g;
}

export function makeSunset(size: number): THREE.Mesh {
  const tex = once('sunsetTex', () =>
    canvasTexture(512, 512, (g) => {
      const grd = g.createLinearGradient(0, 40, 0, 470);
      grd.addColorStop(0, '#fff27a');
      grd.addColorStop(0.45, '#ffa23a');
      grd.addColorStop(0.75, '#ff4f7b');
      grd.addColorStop(1, '#c2338f');
      // glow
      const glow = g.createRadialGradient(256, 256, 150, 256, 256, 256);
      glow.addColorStop(0, 'rgba(255,170,90,0.55)');
      glow.addColorStop(1, 'rgba(255,120,120,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, 512, 512);
      g.save();
      g.beginPath();
      g.arc(256, 256, 190, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = grd;
      g.fillRect(0, 0, 512, 512);
      // retro stripes in the lower half
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 6; i++) {
        const y = 290 + i * 26;
        g.fillRect(0, y, 512, 4 + i * 2.2);
      }
      g.restore();
    }),
  );
  return new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }),
  );
}

// ------------------------------------------------------------------ spotlight

export function makeSpotlight(color = 0xfff1c8): { group: THREE.Group; cone: THREE.Mesh; pool: THREE.Mesh; setIntensity(a: number): void } {
  const coneTex = once('coneTex', () =>
    canvasTexture(8, 128, (g) => {
      const grd = g.createLinearGradient(0, 0, 0, 128);
      grd.addColorStop(0, 'rgba(255,255,255,0.0)');
      grd.addColorStop(0.15, 'rgba(255,255,255,0.5)');
      grd.addColorStop(1, 'rgba(255,255,255,0.15)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 8, 128);
    }),
  );
  const poolTex = once('poolTex', () =>
    canvasTexture(128, 128, (g) => {
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.7, 'rgba(255,255,255,0.45)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
    }),
  );
  const h = 7;
  const coneMat = new THREE.MeshBasicMaterial({
    color,
    map: coneTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1.0, h, 28, 1, true), coneMat);
  cone.position.y = h / 2;
  const poolMat = new THREE.MeshBasicMaterial({ color, map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.15, 32), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.015;
  const group = new THREE.Group();
  group.add(cone, pool);
  return {
    group,
    cone,
    pool,
    setIntensity(a: number) {
      coneMat.opacity = a * 0.75;
      poolMat.opacity = a;
      group.visible = a > 0.01;
    },
  };
}

// ------------------------------------------------------------------ sprites

export function noteTexture(): THREE.CanvasTexture {
  return once('noteTex', () =>
    canvasTexture(64, 64, (g) => {
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#ffffff';
      g.save();
      g.translate(22, 46);
      g.rotate(-0.4);
      g.beginPath();
      g.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(31, 43);
      g.lineTo(31, 8);
      g.stroke();
      g.beginPath();
      g.moveTo(31, 8);
      g.quadraticCurveTo(46, 14, 48, 30);
      g.quadraticCurveTo(44, 22, 31, 20);
      g.fill();
    }),
  );
}

export function smokeTexture(): THREE.CanvasTexture {
  return once('smokeTex', () =>
    canvasTexture(128, 128, (g) => {
      // a few overlapping soft blobs = cartoon puff
      const blobs: [number, number, number][] = [
        [64, 70, 44],
        [40, 60, 30],
        [88, 58, 32],
        [62, 40, 30],
      ];
      for (const [x, y, r] of blobs) {
        const grd = g.createRadialGradient(x, y - r * 0.3, r * 0.2, x, y, r);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.75, 'rgba(225,225,235,0.9)');
        grd.addColorStop(1, 'rgba(200,200,215,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
    }),
  );
}

/** Pool of camera-facing sprites with simple ballistic motion (presentation-only, uses wall time). */
export class SpritePool {
  readonly group = new THREE.Group();
  private items: { s: THREE.Sprite; v: THREE.Vector3; life: number; max: number; spin: number; size: number; grow: number }[] = [];

  constructor(
    tex: THREE.Texture,
    n: number,
    blending: THREE.Blending = THREE.NormalBlending,
  ) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending, fog: false }));
      s.visible = false;
      this.group.add(s);
      this.items.push({ s, v: new THREE.Vector3(), life: 0, max: 1, spin: 0, size: 0.3, grow: 0 });
    }
  }

  spawn(p: THREE.Vector3, v: THREE.Vector3, color: THREE.ColorRepresentation, size: number, life: number, grow = 0, spin = 0): void {
    const it = this.items.find((q) => q.life <= 0) ?? this.items[0];
    it.s.position.copy(p);
    it.v.copy(v);
    it.life = it.max = life;
    it.size = size;
    it.grow = grow;
    it.spin = spin;
    (it.s.material as THREE.SpriteMaterial).color.set(color);
    (it.s.material as THREE.SpriteMaterial).rotation = (Math.random() - 0.5) * 0.6;
    it.s.visible = true;
  }

  update(dt: number): void {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      if (it.life <= 0) {
        it.s.visible = false;
        continue;
      }
      it.s.position.addScaledVector(it.v, dt);
      it.v.multiplyScalar(Math.exp(-dt * 1.2));
      const k = it.life / it.max;
      const m = it.s.material as THREE.SpriteMaterial;
      m.opacity = Math.min(1, k * 3) * Math.min(1, (1 - k) * 8);
      m.rotation += it.spin * dt;
      const sz = it.size * (1 + it.grow * (1 - k));
      it.s.scale.set(sz, sz, 1);
    }
  }
}

/** 3D hearts with simple float-up motion (presentation-only). */
export class HeartPool {
  readonly group = new THREE.Group();
  private items: { m: THREE.Mesh; v: THREE.Vector3; life: number; max: number; size: number; spin: number }[] = [];

  constructor(n: number) {
    const geo = heartGeometry();
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, heartMaterial(i % 3 === 0 ? 0xff6fae : 0xff3d7f));
      m.visible = false;
      this.group.add(m);
      this.items.push({ m, v: new THREE.Vector3(), life: 0, max: 1, size: 0.1, spin: 0 });
    }
  }

  spawn(p: THREE.Vector3, v: THREE.Vector3, size: number, life: number): void {
    const it = this.items.find((q) => q.life <= 0) ?? this.items[0];
    it.m.position.copy(p);
    it.v.copy(v);
    it.life = it.max = life;
    it.size = size;
    it.spin = (Math.random() - 0.5) * 3;
    it.m.rotation.set(0, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.5);
    it.m.visible = true;
  }

  update(dt: number): void {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      if (it.life <= 0) {
        it.m.visible = false;
        continue;
      }
      it.m.position.addScaledVector(it.v, dt);
      it.m.rotation.y += it.spin * dt;
      const k = it.life / it.max;
      const pop = Math.min(1, (1 - k) * 6);
      const s = it.size * (pop < 1 ? 1.25 * pop : 1) * Math.min(1, k * 4);
      it.m.scale.setScalar(Math.max(0.001, s));
    }
  }

  clear(): void {
    for (const it of this.items) {
      it.life = 0;
      it.m.visible = false;
    }
  }
}
