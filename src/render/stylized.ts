// Stylized chunky character looks (Clash-Royale-inspired proportions: big head, big
// hands/feet, soft shading, expressive faces). Built from primitives and baked into
// one skinned mesh per fighter. Real artists' likeness is approximated from the
// product owner's reference images; third-party brand logos are intentionally omitted.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterVisual } from './characters';
import type { HumanoidSpec, Rig } from './rig';
import { addPart, latheProfile } from './toon';

const NO = { outline: 0 };

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

interface FaceOpts {
  iris: number;
  brow: number;
  browTilt: number;
  browThick?: number;
  mouth: number;
  smirk?: number;
  noseScale?: number;
}

/** Head-center group: the head sphere is centred at (0.01, r*0.95) in head-joint space. */
function headCenter(rig: Rig): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0.01, rig.spec.headR * 0.95, 0);
  rig.joints.head.add(g);
  return g;
}

function buildFace(rig: Rig, c: THREE.Group, o: FaceOpts): void {
  const r = rig.spec.headR;
  const [sx, sy, sz] = rig.spec.headScale ?? [1, 1, 1];
  const skin = rig.palette.skin;
  const white = rig.mat(0xffffff);
  const iris = rig.mat(o.iris);
  const pupil = rig.mat(0x0d0a0c);
  const brow = rig.mat(o.brow);
  for (const z of [-1, 1]) {
    const ex = r * sx * 0.8;
    const ey = r * sy * 0.14;
    const ez = z * r * sz * 0.4;
    addPart(c, new THREE.SphereGeometry(r * 0.25, 18, 14), white, { pos: [ex, ey, ez], scale: [0.62, 1.12, 0.9], ...NO });
    addPart(c, new THREE.SphereGeometry(r * 0.155, 16, 12), iris, { pos: [ex + r * 0.1, ey - r * 0.02, ez + z * r * 0.01], scale: [0.45, 1, 1], ...NO });
    addPart(c, new THREE.SphereGeometry(r * 0.085, 12, 10), pupil, { pos: [ex + r * 0.15, ey - r * 0.02, ez + z * r * 0.01], scale: [0.4, 1, 1], ...NO });
    addPart(c, new THREE.SphereGeometry(r * 0.04, 8, 6), white, { pos: [ex + r * 0.165, ey + r * 0.05, ez - z * r * 0.03], ...NO });
    const b = addPart(c, new RoundedBoxGeometry(r * 0.15, r * (o.browThick ?? 0.11), r * 0.46, 2, r * 0.045), brow, {
      pos: [ex + r * 0.05, ey + r * 0.38, ez + z * r * 0.02],
      ...NO,
    });
    b.rotation.x = z * o.browTilt;
  }
  addPart(c, new THREE.SphereGeometry(r * 0.17, 14, 10), rig.mat(shade(skin, 0.9)), {
    pos: [r * sx * 0.97, -r * sy * 0.08, 0],
    scale: [1.05, 0.85 * (o.noseScale ?? 1), 0.85 * (o.noseScale ?? 1)],
    ...NO,
  });
  const mouth = addPart(c, new RoundedBoxGeometry(r * 0.08, r * 0.075, r * 0.46, 2, r * 0.03), rig.mat(o.mouth), {
    pos: [r * sx * 0.86, -r * sy * 0.42, 0],
    ...NO,
  });
  mouth.rotation.x = o.smirk ?? 0;
  for (const z of [-1, 1])
    addPart(c, new THREE.SphereGeometry(r * 0.22, 12, 10), rig.mat(skin), { pos: [-r * 0.02, -r * 0.02, z * r * sz * 0.97], scale: [0.62, 1, 0.42], ...NO });
}

/** Curls scattered over the hair area of the head ellipsoid. */
function curls(
  rig: Rig,
  c: THREE.Group,
  o: { count: number; minY: number; size: [number, number]; lift: number; colors: number[]; seed: number; avoidFace?: boolean },
): void {
  const r = rig.spec.headR;
  const [sx, sy, sz] = rig.spec.headScale ?? [1, 1, 1];
  const rand = rng(o.seed);
  const mats = o.colors.map((col) => rig.mat(col));
  let placed = 0;
  let guard = 0;
  while (placed < o.count && guard++ < o.count * 40) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const k = Math.sqrt(1 - u * u);
    const d = new THREE.Vector3(k * Math.cos(th), u, k * Math.sin(th));
    if (d.y < o.minY) continue;
    if (o.avoidFace !== false && d.x > 0.3 && d.y < 0.62) continue; // keep forehead + face free
    const rr = r * (o.size[0] + rand() * (o.size[1] - o.size[0]));
    const lift = 1 + o.lift * rand();
    addPart(c, new THREE.SphereGeometry(rr, 9, 7), mats[placed % mats.length], {
      pos: [d.x * r * sx * lift, d.y * r * sy * lift, d.z * r * sz * lift],
      ...NO,
    });
    placed++;
  }
}

function shade(hex: number, k: number): number {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return c.getHex();
}

/** Flat-ish dark blobs on the skin as stylized tattoos. */
function tattoos(rig: Rig, joint: THREE.Object3D, len: number, radius: number, z: number, color: number, seed: number, n = 3): void {
  const rand = rng(seed);
  const m = rig.mat(color);
  for (let i = 0; i < n; i++) {
    const y = -len * (0.25 + 0.55 * rand());
    const a = (rand() - 0.5) * 1.6 + (z > 0 ? Math.PI / 2 : -Math.PI / 2) * 0.6;
    const dir = new THREE.Vector3(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4 + z * 0.75).normalize();
    const blob = addPart(joint, new THREE.SphereGeometry(radius * 0.48, 10, 8), m, {
      pos: [dir.x * radius * 0.86, y, dir.z * radius * 0.86],
      scale: [1, 1.5, 0.22],
      ...NO,
    });
    // local orientation: flat side (local +Z) faces outward from the limb axis
    blob.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  }
}

// ------------------------------------------------------------------ JAZEEK

const JAZEEK_SPEC: HumanoidSpec = {
  thigh: 0.34,
  shin: 0.33,
  ankle: 0.09,
  hipHalf: 0.1,
  pelvisR: 0.16,
  waistR: 0.15,
  chestR: 0.2,
  shoulderR: 0.23,
  depth: 0.66,
  torsoLow: 0.2,
  torsoHigh: 0.32,
  shoulderHalf: 0.22,
  neckLen: 0.05,
  headR: 0.175,
  headScale: [0.95, 1.05, 0.92],
  upperArm: 0.27,
  foreArm: 0.26,
  armR: [0.072, 0.06],
  foreR: [0.06, 0.05],
  hand: 0.12,
  thighR: [0.095, 0.078],
  shinR: [0.076, 0.062],
  foot: [0.31, 0.12, 0.15],
  sleeve: 0,
  stylized: true,
};

export const JAZEEK_VISUAL: CharacterVisual = {
  id: 'jazeek',
  spec: JAZEEK_SPEC,
  soft: true,
  accents: ['#ff4fa3', '#45c8ff'],
  palettes: [
    { skin: 0xc58c63, top: 0xf3f1ea, top2: 0xffffff, pants: 0xcdb38a, pants2: 0xb39a70, shoes: 0xf6f6f6, sole: 0xd0d0d4, hat: 0x141015, metal: 0xd9dee6, shades: 0x141015 },
    { skin: 0xc58c63, top: 0x1d1d22, top2: 0x2c2c33, pants: 0x3b3f4a, pants2: 0x2a2d35, shoes: 0x1a1a1e, sole: 0xf0f0f0, hat: 0x141015, metal: 0xffd24a, shades: 0x141015 },
  ],
  decorate(rig, p) {
    const s = rig.spec;
    const j = rig.joints;
    const c = headCenter(rig);
    buildFace(rig, c, { iris: 0x3a2516, brow: 0x141015, browTilt: 0.12, mouth: 0x6a3a32, smirk: 0.1 });
    // dense black curls
    curls(rig, c, { count: 70, minY: -0.15, size: [0.2, 0.27], lift: 0.12, colors: [0x141015, 0x1e171b, 0x0f0c0e], seed: 7 });
    curls(rig, c, { count: 26, minY: 0.45, size: [0.2, 0.26], lift: 0.3, colors: [0x141015, 0x1e171b], seed: 11 });
    // thin mustache + short chin beard
    const r = s.headR;
    const [sx, sy] = s.headScale!;
    addPart(c, new RoundedBoxGeometry(r * 0.05, r * 0.05, r * 0.42, 1, r * 0.02), rig.mat(0x181214), { pos: [r * sx * 0.9, -r * sy * 0.31, 0], ...NO });
    addPart(c, new THREE.SphereGeometry(r * 0.16, 12, 10), rig.mat(0x181214), { pos: [r * sx * 0.78, -r * sy * 0.68, 0], scale: [0.7, 0.9, 1.1], ...NO });
    // waistband (covers the torso/pelvis seam) + drawstring
    addPart(j.hips, new THREE.TorusGeometry(s.waistR * 0.96, 0.042, 10, 28), rig.mat(p.pants2), { pos: [0, 0.075, 0], rot: [Math.PI / 2, 0, 0], scale: [s.depth * 1.04, 1.04, 1], ...NO });
    addPart(j.hips, new RoundedBoxGeometry(0.02, 0.09, 0.012, 1, 0.004), rig.mat(0xffffff), { pos: [s.waistR * s.depth + 0.01, 0.04, 0.03], ...NO });
    addPart(j.hips, new RoundedBoxGeometry(0.02, 0.08, 0.012, 1, 0.004), rig.mat(0xffffff), { pos: [s.waistR * s.depth + 0.01, 0.045, -0.03], ...NO });
    // silver chains + pendant
    addPart(j.chest, new THREE.TorusGeometry(0.13, 0.014, 8, 28), rig.mat(p.metal), { pos: [0.06, s.torsoHigh * 0.86, 0], rot: [Math.PI / 2, 0.8, 0], scale: [0.72, 1, 1], ...NO });
    addPart(j.chest, new THREE.TorusGeometry(0.16, 0.012, 8, 28), rig.mat(p.metal), { pos: [0.08, s.torsoHigh * 0.74, 0], rot: [Math.PI / 2, 0.95, 0], scale: [0.68, 1, 1], ...NO });
    addPart(j.chest, new RoundedBoxGeometry(0.03, 0.05, 0.05, 2, 0.01), rig.mat(p.metal), { pos: [s.chestR * s.depth + 0.015, s.torsoHigh * 0.5, 0], rot: [Math.PI / 4, 0, 0], ...NO });
    // watch (far/left wrist) + bracelet (near/right)
    addPart(j.haL, new THREE.CylinderGeometry(s.foreR[1] * 1.25, s.foreR[1] * 1.25, 0.05, 14), rig.mat(p.metal), { pos: [0, 0.03, 0], ...NO });
    addPart(j.haR, new THREE.TorusGeometry(s.foreR[1] * 1.1, 0.008, 6, 16), rig.mat(p.metal), { pos: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0], ...NO });
    // tattoos on arms
    tattoos(rig, j.shR, s.upperArm, s.armR[0], 1, 0x3a2b2c, 3, 3);
    tattoos(rig, j.elR, s.foreArm, s.foreR[0], 1, 0x3a2b2c, 5, 3);
    tattoos(rig, j.shL, s.upperArm, s.armR[0], -1, 0x3a2b2c, 9, 2);
    tattoos(rig, j.elL, s.foreArm, s.foreR[0], -1, 0x3a2b2c, 13, 3);
    // chunky sneaker details: toe caps + laces
    for (const side of ['L', 'R'] as const) {
      const [fl, fh, fw] = s.foot;
      addPart(j[`ft${side}`], new RoundedBoxGeometry(fl * 0.35, fh * 0.35, fw * 0.6, 1, fh * 0.12), rig.mat(0xdedee4), {
        pos: [fl * 0.2, -s.ankle + fh * 1.02, 0],
        ...NO,
      });
    }
  },
};

// ------------------------------------------------------------------- BONEZ

const BONEZ_SPEC: HumanoidSpec = {
  thigh: 0.4,
  shin: 0.39,
  ankle: 0.09,
  hipHalf: 0.11,
  pelvisR: 0.18,
  waistR: 0.18,
  chestR: 0.23,
  shoulderR: 0.27,
  depth: 0.7,
  torsoLow: 0.22,
  torsoHigh: 0.36,
  shoulderHalf: 0.26,
  neckLen: 0.06,
  headR: 0.17,
  headScale: [0.95, 1.22, 0.88],
  upperArm: 0.31,
  foreArm: 0.3,
  armR: [0.085, 0.07],
  foreR: [0.068, 0.056],
  hand: 0.13,
  thighR: [0.1, 0.085],
  shinR: [0.085, 0.07],
  foot: [0.34, 0.12, 0.155],
  sleeve: 0.55,
  stylized: true,
};

export const BONEZ_VISUAL: CharacterVisual = {
  id: 'bonez',
  spec: BONEZ_SPEC,
  soft: true,
  accents: ['#3ddc84', '#ffb02e'],
  palettes: [
    { skin: 0xe9b796, top: 0x1c1c21, top2: 0x2a2a31, pants: 0x1d1d22, pants2: 0x141418, shoes: 0x222227, sole: 0xf1f1f1, hat: 0x9a7444, metal: 0xffc63a, shades: 0x6fb6e6 },
    { skin: 0xe9b796, top: 0xe8453c, top2: 0x2f7de1, pants: 0x2a2f3a, pants2: 0x1d2028, shoes: 0xf2f2f2, sole: 0x2f7de1, hat: 0x9a7444, metal: 0xffc63a, shades: 0x6fb6e6 },
  ],
  decorate(rig, p) {
    const s = rig.spec;
    const j = rig.joints;
    const c = headCenter(rig);
    const r = s.headR;
    const [sx, sy, sz] = s.headScale!;
    buildFace(rig, c, { iris: p.shades, brow: 0x8a6438, browTilt: -0.05, browThick: 0.085, mouth: 0x5e3028, smirk: -0.06, noseScale: 1.1 });
    // short faded sides + curls on top (dark blond)
    addPart(c, new THREE.SphereGeometry(r * 1.02, 26, 14, 0, Math.PI * 2, 0, 1.18), rig.mat(shade(p.hat, 0.7)), { scale: [sx, sy, sz], ...NO });
    curls(rig, c, { count: 40, minY: 0.55, size: [0.15, 0.2], lift: 0.1, colors: [p.hat, shade(p.hat, 0.85), shade(p.hat, 1.12)], seed: 23, avoidFace: false });
    // light short beard along the jaw + mustache
    const beard = rig.mat(0xb48a54);
    addPart(c, new THREE.SphereGeometry(r * 1.03, 26, 12, Math.PI - 1.75, 3.5, 1.9, Math.PI - 1.9), beard, { scale: [sx, sy, sz], ...NO });
    addPart(c, new RoundedBoxGeometry(r * 0.08, r * 0.08, r * 0.5, 1, r * 0.03), beard, { pos: [r * sx * 0.91, -r * sy * 0.3, 0], ...NO });
    // gold teeth (shown when grinning)
    const teeth = new THREE.Group();
    addPart(teeth, new RoundedBoxGeometry(r * 0.05, r * 0.09, r * 0.4, 1, r * 0.02), rig.mat(p.metal), { pos: [r * sx * 0.9, -r * sy * 0.43, 0], ...NO });
    c.add(teeth);
    teeth.visible = false;
    rig.props.teeth = teeth;
    // quilted puffer vest over the tee: a slightly larger shell following the torso + thin seams
    const vest = rig.mat(0x26262c);
    const seam = rig.mat(0x121216);
    const chestProf: [number, number][] = [
      [-0.06, s.waistR * 1.12],
      [s.torsoHigh * 0.45, s.chestR * 1.09],
      [s.torsoHigh * 0.85, s.shoulderR * 1.07],
      [s.torsoHigh + 0.03, s.shoulderR * 0.82],
      [s.torsoHigh + 0.06, s.shoulderR * 0.56],
    ];
    const spineProf: [number, number][] = [
      [-0.03, s.waistR * 1.08],
      [0.08, s.waistR * 1.12],
      [s.torsoLow + 0.05, s.waistR * 1.14],
    ];
    addPart(j.chest, latheProfile(chestProf), vest, { scale: [s.depth, 1, 1], ...NO });
    addPart(j.spine, latheProfile(spineProf), vest, { scale: [s.depth, 1, 1], ...NO });
    const radAt = (prof: [number, number][], y: number) => {
      for (let i = 1; i < prof.length; i++)
        if (y <= prof[i][0]) {
          const [y0, r0] = prof[i - 1];
          const [y1, r1] = prof[i];
          return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
        }
      return prof[prof.length - 1][1];
    };
    for (const [joint, prof, ys] of [
      [j.chest, chestProf, [s.torsoHigh * 0.12, s.torsoHigh * 0.36, s.torsoHigh * 0.6]],
      [j.spine, spineProf, [0.1, s.torsoLow * 0.6]],
    ] as const)
      for (const y of ys)
        addPart(joint, new THREE.TorusGeometry(radAt(prof as [number, number][], y) * 1.004, 0.008, 6, 36), seam, {
          pos: [0, y, 0],
          rot: [Math.PI / 2, 0, 0],
          scale: [s.depth, 1, 1],
          ...NO,
        });
    addPart(j.chest, new RoundedBoxGeometry(0.02, s.torsoHigh + 0.2, 0.018, 1, 0.006), seam, { pos: [s.chestR * s.depth + 0.04, s.torsoHigh * 0.3, 0], ...NO });
    // stand collar
    addPart(j.neck, new THREE.CylinderGeometry(r * 0.62, r * 0.66, 0.08, 20), vest, { pos: [0, 0.02, 0], scale: [0.95, 1, 1.05], ...NO });
    // scarf on the near shoulder: black with white lettering blocks
    const scarf = rig.mat(0x141417);
    const scarfTxt = rig.mat(0xeeeeee);
    const sc = new THREE.Group();
    sc.position.set(s.chestR * s.depth * 0.6, s.torsoHigh + 0.03, s.shoulderHalf * 0.55);
    sc.rotation.set(0.1, -0.75, -0.08);
    j.chest.add(sc);
    addPart(sc, new RoundedBoxGeometry(0.07, 0.66, 0.2, 2, 0.025), scarf, { pos: [0, -0.33, 0], ...NO });
    for (let k = 0; k < 5; k++)
      addPart(sc, new RoundedBoxGeometry(0.02, 0.075, 0.12, 1, 0.006), scarfTxt, { pos: [0.036, -0.1 - k * 0.1, 0], ...NO });
    for (let k = 0; k < 4; k++)
      addPart(sc, new RoundedBoxGeometry(0.03, 0.06, 0.035, 1, 0.008), rig.mat(0x9a9aa2), { pos: [0, -0.68, -0.075 + k * 0.05], ...NO });
    addPart(j.neck, new THREE.TorusGeometry(s.headR * 0.68, 0.035, 8, 20), scarf, { pos: [0, 0.06, 0], rot: [Math.PI / 2, 0, 0], ...NO });
    // gold chain with cross
    addPart(j.chest, new THREE.TorusGeometry(0.15, 0.014, 8, 28), rig.mat(p.metal), { pos: [0.1, s.torsoHigh * 0.68, 0], rot: [Math.PI / 2, 0.9, 0], scale: [0.68, 1, 1], ...NO });
    addPart(j.chest, new RoundedBoxGeometry(0.02, 0.1, 0.022, 1, 0.006), rig.mat(p.metal), { pos: [s.chestR * s.depth + 0.05, s.torsoHigh * 0.38, 0], ...NO });
    addPart(j.chest, new RoundedBoxGeometry(0.02, 0.022, 0.065, 1, 0.006), rig.mat(p.metal), { pos: [s.chestR * s.depth + 0.05, s.torsoHigh * 0.42, 0], ...NO });
    // gold watch (left wrist) + rings
    addPart(j.haL, new THREE.CylinderGeometry(s.foreR[1] * 1.28, s.foreR[1] * 1.28, 0.055, 14), rig.mat(p.metal), { pos: [0, 0.03, 0], ...NO });
    for (const side of ['L', 'R'] as const)
      for (let k = 0; k < 2; k++)
        addPart(j[`ha${side}`], new THREE.SphereGeometry(0.016, 8, 6), rig.mat(k ? 0xd9dde5 : p.metal), {
          pos: [s.hand * 0.42, -s.hand * 0.75, (k - 0.5) * 0.05],
          ...NO,
        });
    // forearm + hand tattoos
    tattoos(rig, j.elR, s.foreArm, s.foreR[0], 1, 0x3b3236, 31, 4);
    tattoos(rig, j.elL, s.foreArm, s.foreR[0], -1, 0x3b3236, 37, 4);
    // sneakers: white midsole stripe
    for (const side of ['L', 'R'] as const) {
      const [fl, fh, fw] = s.foot;
      addPart(j[`ft${side}`], new RoundedBoxGeometry(fl * 0.96, fh * 0.16, fw * 1.03, 1, fh * 0.06), rig.mat(p.sole), {
        pos: [fl * 0.28, -s.ankle + fh * 0.36, 0],
        ...NO,
      });
    }
  },
};
