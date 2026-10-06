// Stylized arena crowds (PO: festival = hipsters partying and cheering, moshpit; Bahnhofsviertel = dangerous-looking
// rocker gangs). Chunky game-art people (big head with nose, ears, eyes and brows; tapered torso; two-segment arms and
// legs with elbows/knees; sneakers/boots) built from a few primitives with baked shading (vertex colours) and drawn as
// one InstancedMesh per body part, so a crowd of 60 costs ~25 draw calls on a phone. Every person gets a look (hair,
// hat, beard, glasses, open overshirt / leather vest, shorts, phone / cup / beer) and a behaviour (jump, cheer, film,
// fist pump, clap, sway, circle pit, arms crossed, nod, drink, point) driven by the music beat and the crowd's
// excitement (hits, KOs, hype).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type CrowdStyle = 'hipster' | 'rocker';
export type Behaviour = 'jump' | 'cheer' | 'film' | 'pump' | 'clap' | 'sway' | 'mosh' | 'crossed' | 'nod' | 'drink' | 'point';

export interface CrowdSpot {
  x: number;
  z: number;
  /** extra yaw (rad); people face the fight (+z / toward x=0) by default */
  yaw?: number;
  behaviour?: Behaviour;
  /** circle pit: run around (cx, cz) on an ellipse (radius r, z squashed) from angle a0 at `speed` rad/s */
  pit?: { cx: number; cz: number; r: number; a0: number; speed: number };
}

type Hair = 'short' | 'long' | 'bun' | 'afro' | 'mohawk' | 'bald';
type Hat = 'beanie' | 'cap' | 'capBack' | 'bucket' | 'bandana' | null;
/** shoulder forward raise, shoulder raise out to the side, elbow bend, forearm twist inward (rad) */
type Arm = [number, number, number, number];

interface Person {
  x: number;
  z: number;
  yaw: number;
  scale: number;
  wide: number;
  phase: number;
  speed: number;
  beh: Behaviour;
  pit?: CrowdSpot['pit'];
  hair: Hair;
  hat: Hat;
  beard: 'short' | 'long' | null;
  glasses: 'round' | 'shades' | null;
  open: boolean;
  shorts: boolean;
  tank: boolean;
  prop: 'phone' | 'bottle' | 'cup' | null;
}

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

const SKIN = [0xf1c7a5, 0xe0a982, 0xc68863, 0x9a6444, 0x6e4430, 0xf5d2b8, 0xd8a47c];
const HIP = {
  shirt: [0xd9a441, 0x2f8f83, 0xb5523b, 0x5b6fb0, 0xe8e0cf, 0x7a9a4e, 0xd97aa0, 0x2e2e38, 0xa58fd0, 0xf0ece4],
  open: [0x8a2f2f, 0x3f5f8a, 0x5a6b3a, 0xc28a4a, 0x6a4a8a],
  pants: [0x2b3a55, 0x6c86a8, 0x1f1f26, 0xbfa57e, 0x6b5b45, 0x56603f],
  shoes: [0xf2f2f2, 0xf2f2f2, 0x262626, 0xc8a070, 0xc0392b],
  hat: [0xd9813a, 0x2f6f8f, 0x8f2f3a, 0xe8d9b0, 0x2a2a2a, 0xe8c040, 0x4a8a5a],
  hair: [0x2a1a10, 0x5a3a20, 0x8a6a40, 0x1a1410, 0xb08850, 0xc8a878, 0x7a2a1a],
};
const ROCK = {
  shirt: [0x1a1a1e, 0x2e2e34, 0xd8d8d8, 0x7a2424, 0x22262e, 0x4a5a6a, 0xc8c0b0],
  open: [0x16161a, 0x34465e, 0x3a2618, 0x1c1c20, 0x4a3020],
  pants: [0x1c2638, 0x15151a, 0x2f3d5a, 0x3a4a68],
  shoes: [0x121212, 0x3a2414, 0x1a1a1a],
  hat: [0x9a1a1a, 0x1a1a1a, 0x23305a],
  hair: [0x1a1410, 0x3a2a20, 0x6a6a6a, 0x9a9a9a, 0xb8b8b0],
};

// ---- geometry -------------------------------------------------------------------------------------------------------
/** Non-indexed copy with a baked shading colour (undersides darker), no uvs: every part merges and instances alike. */
function prep(g: THREE.BufferGeometry, ao = 0.34): THREE.BufferGeometry {
  if (g.getAttribute('color')) return g;
  const geo = g.index ? g.toNonIndexed() : g;
  geo.deleteAttribute('uv');
  const n = geo.getAttribute('normal');
  const c = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) c.fill(1 - ao * (0.5 - 0.5 * n.getY(i)), i * 3, i * 3 + 3);
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
const merge = (...gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map((g) => prep(g)))!;
const capsule = (r: number, len: number, rad = 10) => new THREE.CapsuleGeometry(r, len, 4, rad);
const sphere = (r: number, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h);
const HC = 0.19; // head centre above the neck pivot

function torsoGeo(): THREE.BufferGeometry {
  // tapered: broad shoulders, slimmer waist, flatter chest/back; spans y 0..0.56 above the waist pivot
  const g = new THREE.CapsuleGeometry(0.17, 0.22, 6, 14).translate(0, 0.28, 0);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const k = Math.min(1, Math.max(0, p.getY(i) / 0.56));
    const w = 0.94 + 0.3 * Math.pow(k, 1.5) - (k > 0.85 ? (k - 0.85) * 1.2 : 0);
    p.setX(i, p.getX(i) * w);
    p.setZ(i, p.getZ(i) * (0.78 + 0.06 * k));
  }
  g.computeVertexNormals();
  return g;
}

/** Open vest / overshirt: a slightly bigger torso shell (vest colour) ... */
function vestGeo(): THREE.BufferGeometry {
  return prep(torsoGeo().scale(1.08, 0.95, 1.14).translate(0, 0.02, 0), 0.4);
}

/** ... and the shirt showing through its open front: a V-shaped panel lying on the shell (clean edges, shirt colour). */
function placketGeo(): THREE.BufferGeometry {
  const rho = (y: number) => {
    const d = Math.abs(y - 0.28) - 0.11;
    return d <= 0 ? 0.17 : Math.sqrt(Math.max(0, 0.17 * 0.17 - d * d));
  };
  const front = (xv: number, yv: number) => {
    const yt = (yv - 0.02) / 0.95;
    const k = Math.min(1, Math.max(0, yt / 0.56));
    const w = 0.94 + 0.3 * Math.pow(k, 1.5) - (k > 0.85 ? (k - 0.85) * 1.2 : 0);
    const xc = xv / 1.08 / w;
    return Math.sqrt(Math.max(0, rho(yt) ** 2 - xc * xc)) * (0.78 + 0.06 * k) * 1.14 + 0.006;
  };
  const NX = 6;
  const NY = 14;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= NY; j++) {
    const y = 0.07 + (j / NY) * 0.47;
    const gap = 0.035 + 0.07 * Math.pow(j / NY, 1.2);
    for (let i = 0; i <= NX; i++) {
      const x = (i / NX - 0.5) * 2 * gap;
      pos.push(x, y, front(x, y));
    }
  }
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i;
      const b = a + 1;
      const c = a + NX + 2;
      const d = a + NX + 1;
      idx.push(a, b, c, a, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return prep(g, 0.2);
}

function buildGeometry(style: CrowdStyle) {
  const head = merge(
    sphere(0.17, 16, 12).scale(0.96, 1.06, 1).translate(0, HC, 0),
    new THREE.CylinderGeometry(0.066, 0.074, 0.15, 10).translate(0, 0.05, -0.012),
    sphere(0.034, 8, 6).scale(1, 0.9, 1.3).translate(0, HC - 0.012, 0.162),
    sphere(0.042, 8, 6).scale(0.45, 1, 0.8).translate(-0.16, HC, -0.005),
    sphere(0.042, 8, 6).scale(0.45, 1, 0.8).translate(0.16, HC, -0.005),
  );
  const eye = (x: number) => sphere(0.025, 8, 6).scale(1, 1.15, 0.5).translate(x, HC + 0.03, 0.152);
  const brow = (x: number) => new THREE.BoxGeometry(0.066, 0.017, 0.02).rotateZ(x < 0 ? -0.12 : 0.12).translate(x, HC + 0.08, 0.14);
  // hipsters cheer with open mouths; rockers keep a grim line
  const mouth =
    style === 'hipster'
      ? sphere(0.036, 10, 6).scale(1.15, 0.7, 0.4).translate(0, HC - 0.078, 0.147)
      : new THREE.BoxGeometry(0.07, 0.013, 0.02).translate(0, HC - 0.074, 0.151);
  const features = merge(eye(-0.056), eye(0.056), brow(-0.058), brow(0.058), mouth);
  const cap = (thetaLen: number, r = 0.182) => new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, thetaLen);
  const hairShort = cap(Math.PI * 0.5, 0.178).scale(0.97, 1.08, 1.02).rotateX(-0.32).translate(0, HC + 0.004, -0.012);
  const hair = {
    short: merge(hairShort.clone()),
    long: merge(hairShort.clone(), capsule(0.13, 0.17).scale(1.12, 1, 0.55).translate(0, HC - 0.1, -0.095)),
    bun: merge(hairShort.clone(), sphere(0.072).translate(0, HC + 0.17, -0.075)),
    afro: merge(new THREE.IcosahedronGeometry(0.225, 2).scale(1, 0.9, 0.95).translate(0, HC + 0.05, -0.03)),
    mohawk: merge(capsule(0.035, 0.26, 8).rotateX(Math.PI / 2).scale(0.8, 1.9, 1).translate(0, HC + 0.17, -0.03)),
  };
  const hats = {
    beanie: merge(
      cap(Math.PI * 0.42, 0.19).scale(1, 1.2, 1),
      new THREE.TorusGeometry(0.178, 0.034, 6, 18).rotateX(Math.PI / 2).translate(0, 0.06, 0),
      sphere(0.048).translate(0, 0.235, 0),
    )
      .rotateX(-0.2)
      .translate(0, HC, -0.005),
    cap: merge(
      cap(Math.PI * 0.42, 0.186),
      new THREE.CylinderGeometry(0.16, 0.16, 0.018, 16, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 1.25).translate(0, 0.07, 0.11),
    )
      .rotateX(-0.12)
      .translate(0, HC, 0),
    bucket: merge(
      new THREE.LatheGeometry(
        [
          [0.0, 0.0],
          [0.18, 0.0],
          [0.285, -0.035],
          [0.29, -0.015],
          [0.19, 0.03],
          [0.165, 0.15],
          [0.1, 0.18],
          [0.0, 0.185],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        20,
      ),
    )
      .rotateX(-0.12)
      .translate(0, HC + 0.04, 0),
    bandana: merge(
      cap(Math.PI * 0.46, 0.185).rotateX(-0.18),
      sphere(0.046).translate(0, 0.03, -0.19),
      capsule(0.022, 0.08, 6).rotateZ(0.4).translate(0.03, -0.04, -0.2),
      capsule(0.022, 0.07, 6).rotateZ(-0.3).translate(-0.025, -0.04, -0.2),
    ).translate(0, HC, 0),
  };
  const beardShort = new THREE.SphereGeometry(0.172, 14, 8, 0, Math.PI, Math.PI * 0.64, Math.PI * 0.3).scale(0.98, 1.04, 1.06).translate(0, HC, 0.004);
  const beards = {
    short: merge(beardShort.clone()),
    long: merge(beardShort.clone(), capsule(0.07, 0.1).scale(1.25, 1, 0.75).translate(0, HC - 0.2, 0.115)),
  };
  const lens = (x: number) => new THREE.TorusGeometry(0.043, 0.01, 6, 14).translate(x, HC + 0.03, 0.166);
  const shade = (x: number) => sphere(0.05, 10, 8).scale(1.25, 0.82, 0.35).translate(x, HC + 0.028, 0.162);
  const glasses = {
    round: merge(lens(-0.058), lens(0.058), new THREE.BoxGeometry(0.03, 0.01, 0.01).translate(0, HC + 0.035, 0.17)),
    shades: merge(shade(-0.058), shade(0.058), new THREE.BoxGeometry(0.25, 0.018, 0.02).translate(0, HC + 0.055, 0.158)),
  };
  return {
    // legs: pivots at the hip / knee / ankle, 0.33 m segments (short, chunky game-art proportions)
    thigh: merge(capsule(0.098, 0.2).translate(0, -0.165, 0)),
    shin: merge(capsule(0.08, 0.2).translate(0, -0.165, 0)),
    shoe: merge(capsule(style === 'rocker' ? 0.074 : 0.07, 0.13).rotateX(Math.PI / 2).scale(1, 0.74, 1).translate(0, -0.045, 0.05)),
    pelvis: merge(capsule(0.12, 0.13).rotateZ(Math.PI / 2).scale(1, 1, 0.85)),
    torso: merge(torsoGeo()),
    vest: vestGeo(),
    placket: placketGeo(),
    // arms: pivots at the shoulder / elbow; the hand is part of the forearm
    sleeve: merge(capsule(0.07, 0.2).translate(0, -0.13, 0)),
    forearm: merge(capsule(0.058, 0.17).translate(0, -0.12, 0), sphere(0.07, 10, 8).scale(0.85, 1.1, 0.95).translate(0, -0.3, 0.005)),
    head,
    features,
    hair,
    hats,
    beards,
    glasses,
    bottle: merge(new THREE.CylinderGeometry(0.032, 0.036, 0.19, 10), new THREE.CylinderGeometry(0.013, 0.03, 0.08, 8).translate(0, 0.13, 0)),
    cup: merge(new THREE.CylinderGeometry(0.046, 0.034, 0.12, 12)),
    phone: merge(new THREE.BoxGeometry(0.075, 0.15, 0.012)),
    shadow: new THREE.CircleGeometry(0.36, 18).rotateX(-Math.PI / 2).translate(0, 0.012, 0),
  };
}

// ---- runtime --------------------------------------------------------------------------------------------------------
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _t = new THREE.Matrix4();
const M = {
  base: new THREE.Matrix4(),
  body: new THREE.Matrix4(),
  torso: new THREE.Matrix4(),
  head: new THREE.Matrix4(),
  hip: new THREE.Matrix4(),
  knee: new THREE.Matrix4(),
  ankle: new THREE.Matrix4(),
  sh: new THREE.Matrix4(),
  el: new THREE.Matrix4(),
  out: new THREE.Matrix4(),
};

/** out = parent * T(x,y,z) * R(rx,ry,rz; order) * S */
function chain(out: THREE.Matrix4, parent: THREE.Matrix4, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, order: THREE.EulerOrder = 'XYZ', sx = 1, sy = 1, sz = 1) {
  _t.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, order)), _s.set(sx, sy, sz));
  return out.multiplyMatrices(parent, _t);
}

const OPTIONAL_HEAD = ['hair_short', 'hair_long', 'hair_bun', 'hair_afro', 'hair_mohawk', 'hat_beanie', 'hat_bucket', 'hat_bandana', 'beard_short', 'beard_long', 'glasses_round', 'glasses_shades'];

export class Crowd {
  readonly group = new THREE.Group();
  private people: Person[] = [];
  private parts: Record<string, THREE.InstancedMesh> = {};
  /** per optional part: person index -> instance slot (-1 = none) */
  private slot: Record<string, Int16Array> = {};
  private heat = 0;
  private mats: THREE.Material[] = [];

  constructor(
    readonly style: CrowdStyle,
    spots: CrowdSpot[],
    seed = 7,
    quality: 'low' | 'medium' | 'high' = 'high',
  ) {
    const r = rng(seed);
    const hipster = style === 'hipster';
    const pal = hipster ? HIP : ROCK;
    const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length) % a.length];
    const hipBeh: Behaviour[] = ['jump', 'cheer', 'film', 'pump', 'clap', 'sway', 'cheer', 'jump', 'pump'];
    const rockBeh: Behaviour[] = ['crossed', 'nod', 'drink', 'crossed', 'point', 'nod', 'drink'];
    for (const s of spots) {
      const beh = s.behaviour ?? (s.pit ? 'mosh' : pick(hipster ? hipBeh : rockBeh));
      const hair: Hair = hipster ? pick<Hair>(['short', 'long', 'bun', 'afro', 'short', 'bun', 'long']) : pick<Hair>(['bald', 'long', 'short', 'mohawk', 'bald', 'long']);
      let hat: Hat = hipster ? pick<Hat>(['beanie', 'cap', 'capBack', 'bucket', null, null, 'beanie', 'bucket']) : pick<Hat>(['bandana', null, null, 'bandana', 'cap']);
      if (hair === 'afro' || hair === 'mohawk' || hair === 'bun') hat = null;
      this.people.push({
        x: s.x,
        z: s.z,
        yaw: (s.yaw ?? 0) + Math.atan2(-s.x * 0.15, 1) + (r() - 0.5) * 0.4,
        scale: (hipster ? 0.93 : 1.0) + r() * 0.13,
        wide: hipster ? 0.92 + r() * 0.16 : 1.08 + r() * 0.24,
        phase: r() * Math.PI * 2,
        speed: 0.85 + r() * 0.3,
        beh,
        pit: s.pit,
        hair,
        hat,
        beard: r() < (hipster ? 0.3 : 0.75) ? (hipster ? 'short' : r() < 0.5 ? 'long' : 'short') : null,
        glasses: hipster ? (r() < 0.4 ? 'round' : r() < 0.15 ? 'shades' : null) : r() < 0.55 ? 'shades' : null,
        open: hipster ? r() < 0.35 : r() < 0.85,
        shorts: hipster && r() < 0.3,
        tank: !hipster && r() < 0.5,
        prop: beh === 'film' ? 'phone' : beh === 'drink' ? 'bottle' : beh === 'sway' ? 'cup' : !hipster && beh === 'nod' && r() < 0.4 ? 'bottle' : null,
      });
    }
    const P = this.people;
    const n = P.length;
    const geo = buildGeometry(style);
    const low = quality === 'low';
    const mat = () => {
      const m = low ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
      this.mats.push(m);
      return m;
    };
    const body = mat();
    const part = (key: string, g: THREE.BufferGeometry, count: number, m: THREE.Material = body) => {
      const im = new THREE.InstancedMesh(g, m, Math.max(1, count));
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = false;
      im.receiveShadow = false;
      im.frustumCulled = false;
      im.count = count;
      this.parts[key] = im;
      this.group.add(im);
      return im;
    };
    for (const k of ['thigh', 'shin', 'shoe', 'sleeve', 'forearm'] as const) part(k, geo[k], n * 2);
    for (const k of ['pelvis', 'torso', 'head', 'features'] as const) part(k, geo[k], n);
    // soft contact shadow under everyone (they cast no real shadows: cheap on phones)
    part('shadow', geo.shadow, n, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    const optional = (key: string, g: THREE.BufferGeometry, pred: (p: Person) => boolean, m: THREE.Material = body) => {
      const map = new Int16Array(n).fill(-1);
      let c = 0;
      P.forEach((p, i) => {
        if (pred(p)) map[i] = c++;
      });
      this.slot[key] = map;
      if (c) part(key, g, c, m);
    };
    for (const h of ['short', 'long', 'bun', 'afro', 'mohawk'] as const)
      optional(`hair_${h}`, geo.hair[h], (p) => p.hair === h && !(h === 'short' && (p.hat === 'beanie' || p.hat === 'bucket')));
    optional('hat_beanie', geo.hats.beanie, (p) => p.hat === 'beanie');
    optional('hat_cap', geo.hats.cap, (p) => p.hat === 'cap' || p.hat === 'capBack');
    optional('hat_bucket', geo.hats.bucket, (p) => p.hat === 'bucket');
    optional('hat_bandana', geo.hats.bandana, (p) => p.hat === 'bandana');
    optional('beard_short', geo.beards.short, (p) => p.beard === 'short');
    optional('beard_long', geo.beards.long, (p) => p.beard === 'long');
    optional('glasses_round', geo.glasses.round, (p) => p.glasses === 'round');
    optional('glasses_shades', geo.glasses.shades, (p) => p.glasses === 'shades');
    optional('vest', geo.vest, (p) => p.open);
    optional('placket', geo.placket, (p) => p.open);
    const glass = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.88 });
    this.mats.push(glass);
    optional('bottle', geo.bottle, (p) => p.prop === 'bottle', glass);
    optional('cup', geo.cup, (p) => p.prop === 'cup');
    optional('phone', geo.phone, (p) => p.prop === 'phone');
    // colours
    const col = new THREE.Color();
    const set = (key: string, idx: number, c: number) => {
      const im = this.parts[key];
      if (!im || idx < 0) return;
      im.setColorAt(idx, col.set(c));
    };
    const setOpt = (key: string, i: number, c: number) => set(key, this.slot[key]?.[i] ?? -1, c);
    P.forEach((p, i) => {
      const skin = pick(SKIN);
      const ink = new THREE.Color(skin).lerp(new THREE.Color(0x2a3a5a), 0.3).getHex(); // tattooed rocker arms
      const shirt = pick(pal.shirt);
      const pants = pick(pal.pants);
      const shoes = pick(pal.shoes);
      const hairC = pick(pal.hair);
      for (const side of [0, 1]) {
        set('thigh', i * 2 + side, pants);
        set('shin', i * 2 + side, p.shorts ? skin : pants);
        set('shoe', i * 2 + side, shoes);
        set('sleeve', i * 2 + side, p.tank ? (hipster ? skin : ink) : shirt);
        set('forearm', i * 2 + side, hipster ? skin : ink);
      }
      set('pelvis', i, pants);
      set('torso', i, shirt);
      set('head', i, skin);
      set('features', i, 0x1c1210);
      for (const h of ['short', 'long', 'bun', 'afro', 'mohawk']) setOpt(`hair_${h}`, i, h === 'mohawk' && r() < 0.5 ? pick([0xc0392b, 0x2a6aa8, 0x1a1410]) : hairC);
      const hatC = pick(pal.hat);
      for (const h of ['hat_beanie', 'hat_cap', 'hat_bucket', 'hat_bandana']) setOpt(h, i, hatC);
      setOpt('beard_short', i, hairC);
      setOpt('beard_long', i, hairC);
      setOpt('glasses_round', i, 0x1a1412);
      setOpt('glasses_shades', i, 0x0c0c10);
      setOpt('vest', i, pick(pal.open));
      setOpt('placket', i, shirt);
      setOpt('bottle', i, 0xffffff);
      setOpt('cup', i, pick([0xe8e4dc, 0xc0392b, 0x2f6f8f]));
      setOpt('phone', i, 0x1a1a20);
    });
    for (const im of Object.values(this.parts)) if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  /** 0..1 burst of excitement (hits, KO); decays. */
  excite(amount: number): void {
    this.heat = Math.min(1.5, this.heat + amount);
  }

  setDim(d: number): void {
    const k = 1 - d * 0.6;
    for (const m of this.mats) (m as THREE.MeshStandardMaterial).color?.setScalar(k);
  }

  update(t: number, beat: number, hype: number, dt = 1 / 60): void {
    this.heat = Math.max(0, this.heat - dt * 0.35);
    const pulse = Math.pow(1 - (beat % 1), 3);
    const energy = Math.min(1.3, 0.35 + hype * 0.4 + this.heat);
    const rocker = this.style === 'rocker';
    const parts = this.parts;
    const put = (key: string, idx: number, m: THREE.Matrix4) => {
      const im = parts[key];
      if (im && idx >= 0 && idx < im.count) im.setMatrixAt(idx, m);
    };
    const putOpt = (key: string, i: number, m: THREE.Matrix4) => put(key, this.slot[key]?.[i] ?? -1, m);
    this.people.forEach((p, i) => {
      const ph = t * 6.28 * 0.75 * p.speed + p.phase;
      let x = p.x;
      let z = p.z;
      let yaw = p.yaw;
      let y = 0; // jump height
      let bend = 0; // knee bend (rad)
      let lean = 0;
      let twist = 0;
      let nod = 0;
      let tilt = 0;
      let run = 0; // running leg swing (circle pit)
      let runKnee = 0;
      let L: Arm = [0.08, 0.14, 0.25, 0.1];
      let R: Arm = [0.08, 0.14, 0.25, 0.1];
      let tiltProp = 0;
      switch (p.beh) {
        case 'jump': {
          const j = Math.sin(ph * 1.3);
          y = Math.max(0, j) * 0.24 * energy;
          bend = Math.max(0, -j) * 0.4 * Math.min(1, energy + 0.2) + 0.05;
          const a = 2.45 + 0.25 * Math.max(0, j);
          L = [0.25, a, 0.3, 0.1];
          R = [0.25, a, 0.3, 0.1];
          break;
        }
        case 'cheer':
          bend = pulse * 0.2 * energy + 0.04;
          L = [0.2, 2.3 + Math.sin(ph * 2) * 0.22, 0.35, 0];
          R = [0.2, 2.3 + Math.sin(ph * 2 + 1.2) * 0.22, 0.35, 0];
          nod = -0.12;
          break;
        case 'film':
          bend = pulse * 0.1;
          R = [2.35, 0.3, 0.55, 0.25];
          L = [0.12, 0.18, 0.45, 0.2];
          nod = -0.16;
          twist = Math.sin(ph * 0.4) * 0.1;
          break;
        case 'pump': {
          const k = Math.max(0, Math.sin(ph * 2));
          bend = pulse * 0.2 * energy + 0.04;
          R = [0.35, 2.3 + 0.15 * k, 1.35 - 1.0 * k * Math.min(1, energy + 0.2), 0.3];
          L = [0.25, 0.25, 0.6, 0.35];
          nod = pulse * 0.12;
          break;
        }
        case 'clap': {
          const c = Math.pow(Math.abs(Math.cos(beat * Math.PI)), 6);
          bend = pulse * 0.15;
          L = [1.05, 0.3, 1.1, 0.45 + 0.4 * c];
          R = [1.05, 0.3, 1.1, 0.45 + 0.4 * c];
          nod = pulse * 0.1;
          break;
        }
        case 'sway':
          twist = Math.sin(ph) * 0.25;
          lean = Math.sin(ph) * 0.06;
          tilt = Math.sin(ph) * 0.08;
          bend = pulse * 0.1;
          R = [0.25, 2.3 + 0.12 * Math.sin(ph * 2), 0.4, 0];
          L = [0.3, 0.2, 1.45, 0.45];
          break;
        case 'mosh': {
          // circle pit: running around the pit centre, arms pumping
          if (p.pit) {
            const a = p.pit.a0 + t * p.pit.speed;
            x = p.pit.cx + Math.cos(a) * p.pit.r;
            z = p.pit.cz + Math.sin(a) * p.pit.r * 0.75;
            const dir = Math.sign(p.pit.speed) || 1;
            yaw = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * 0.75 * dir);
          }
          const rp = t * 6.28 * 1.6 * p.speed + p.phase;
          run = Math.sin(rp);
          runKnee = Math.cos(rp);
          y = Math.abs(Math.cos(rp)) * 0.07;
          lean = 0.22;
          twist = Math.sin(rp) * 0.18;
          L = [0.3 - run * 0.7, 0.18, 1.4, 0.15];
          R = [0.3 + run * 0.7, 0.18, 1.4, 0.15];
          if (Math.sin(ph * 0.5) > 0.6) R = [0.4, 2.4, 0.4, 0]; // a fist in the air now and then
          break;
        }
        case 'crossed':
          nod = Math.max(0, Math.sin(ph * 0.5)) * 0.1 + pulse * 0.06;
          L = [0.32, 0.22, 1.85, 1.3];
          R = [0.26, 0.22, 1.95, 1.3];
          lean = -0.05;
          break;
        case 'nod':
          nod = pulse * 0.2;
          bend = pulse * 0.06;
          L = [0.05, 0.14, 0.3, 0.15];
          R = p.prop === 'bottle' ? [0.25, 0.18, 1.1, 0.3] : [0.05, 0.14, 0.3, 0.15];
          twist = Math.sin(ph * 0.3) * 0.15;
          break;
        case 'drink': {
          const k = Math.pow(Math.max(0, Math.sin(ph * 0.4)), 0.7);
          R = [0.3 + 0.65 * k, 0.25, 1.1 + 1.15 * k, 0.55 * k];
          L = [0.05, 0.16, 0.3, 0.15];
          nod = -0.3 * k;
          tiltProp = 1.6 * k;
          break;
        }
        case 'point': {
          const k = 0.5 + 0.5 * Math.sin(ph * 1.5);
          R = [1.45 + 0.1 * k, 0.12, 0.08, 0];
          L = [0.1, 0.16, 0.35, 0.15];
          lean = 0.06;
          nod = pulse * 0.1;
          break;
        }
      }
      // hits make everyone react: rockers shove a fist up, hipsters jump higher
      if (this.heat > 0.4) {
        const k = Math.min(1, this.heat - 0.4);
        if (rocker && p.beh !== 'drink') R = [R[0] * (1 - k) + 0.3 * k, R[1] * (1 - k) + 2.4 * k, R[2] * (1 - k) + 0.9 * k, R[3] * (1 - k)];
        else if (!rocker) y += Math.max(0, Math.sin(ph * 2.2)) * 0.12 * k;
      }
      const s = p.scale;
      const w = p.wide;
      M.base.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, yaw + twist * 0.3, 0)), _s.set(s, s, s));
      // contact shadow stays on the ground (shrinks while jumping)
      M.out.compose(_p.set(x, 0, z), _q.identity(), _s.setScalar(s * (0.9 + 0.2 * w) * (1 - Math.min(0.5, y * 1.5))));
      put('shadow', i, M.out);
      // knee bend lowers the body so the feet stay planted (two 0.33 m segments)
      chain(M.body, M.base, 0, 0.66 * (Math.cos(bend) - 1), 0);
      for (const side of [-1, 1]) {
        const k = i * 2 + (side > 0 ? 1 : 0);
        const thigh = -bend - lean * 0.3 - run * 0.75 * side;
        const shin = 2 * bend + Math.max(0, side * runKnee) * 1.1;
        const lw = 0.85 + 0.15 * w; // heavier guys, thicker legs
        chain(M.hip, M.body, side * 0.1 * w, 0.76, 0, thigh, 0, 0);
        put('thigh', k, chain(M.out, M.hip, 0, 0, 0, 0, 0, 0, 'XYZ', lw, 1, lw));
        chain(M.knee, M.hip, 0, -0.33, 0, shin, 0, 0);
        put('shin', k, chain(M.out, M.knee, 0, 0, 0, 0, 0, 0, 'XYZ', lw, 1, lw));
        chain(M.ankle, M.knee, 0, -0.33, 0, -(thigh + shin), side * 0.12, 0, 'YXZ');
        put('shoe', k, M.ankle);
      }
      chain(M.out, M.body, 0, 0.78, 0, 0, 0, 0, 'XYZ', w, 1, w);
      put('pelvis', i, M.out);
      // torso pivots at the waist
      chain(M.torso, M.body, 0, 0.8, 0, lean, twist, tilt);
      chain(M.out, M.torso, 0, 0, 0, 0, 0, 0, 'XYZ', w, 1, 0.92 + 0.08 * w);
      put('torso', i, M.out);
      putOpt('vest', i, M.out);
      putOpt('placket', i, M.out);
      for (const side of [-1, 1]) {
        const a = side < 0 ? L : R;
        const k = i * 2 + (side > 0 ? 1 : 0);
        chain(M.sh, M.torso, side * 0.235 * w, 0.455, 0, -a[0], 0, side * a[1]);
        put('sleeve', k, M.sh);
        chain(M.el, M.sh, 0, -0.28, 0, -a[2], -side * a[3], 0, 'YXZ');
        put('forearm', k, M.el);
        // phone / beer in the right hand, the festival cup in the left (the right one waves)
        if (p.prop && (side > 0) === (p.prop !== 'cup')) {
          if (p.prop === 'phone') {
            chain(M.out, M.el, 0, -0.33, 0.05, -0.3, 0, 0);
            putOpt('phone', i, M.out);
          } else {
            // cup / bottle: held upright in the fist (world-up), the beer tips into the mouth while drinking
            _p.set(0, -0.3, 0.02).applyMatrix4(M.el);
            M.out.compose(_p, _q.setFromEuler(_e.set(-tiltProp, yaw, 0, 'YXZ')), _s.set(s, s, s));
            putOpt(p.prop, i, M.out);
          }
        }
      }
      // head on the neck, nodding
      chain(M.head, M.torso, 0, 0.54, 0.01, nod, 0, -tilt * 0.6);
      put('head', i, M.head);
      put('features', i, M.head);
      for (const key of OPTIONAL_HEAD) putOpt(key, i, M.head);
      if (p.hat === 'cap' || p.hat === 'capBack') putOpt('hat_cap', i, p.hat === 'capBack' ? chain(M.out, M.head, 0, 0, 0, 0, Math.PI, 0) : M.head);
    });
    for (const im of Object.values(parts)) im.instanceMatrix.needsUpdate = true;
  }
}
