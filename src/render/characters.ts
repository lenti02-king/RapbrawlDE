// Visual definitions for the placeholder fighters (procedural toon models).
// Replaceable later by authored glTF models exposing the same joint names.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { type HumanoidSpec, type Palette, Rig } from './rig';
import { addPart, taperedCapsule } from './toon';

export interface CharacterVisual {
  id: string;
  spec: HumanoidSpec;
  palettes: Palette[];
  /** UI accent colors per palette (css). */
  accents: string[];
  decorate(rig: Rig, palette: Palette): void;
}

const VOLT_SPEC: HumanoidSpec = {
  thigh: 0.42,
  shin: 0.42,
  ankle: 0.08,
  hipHalf: 0.095,
  pelvisR: 0.15,
  waistR: 0.14,
  chestR: 0.18,
  shoulderR: 0.2,
  depth: 0.68,
  torsoLow: 0.2,
  torsoHigh: 0.3,
  shoulderHalf: 0.2,
  neckLen: 0.07,
  headR: 0.115,
  upperArm: 0.27,
  foreArm: 0.25,
  armR: [0.058, 0.048],
  foreR: [0.045, 0.036],
  hand: 0.085,
  thighR: [0.075, 0.058],
  shinR: [0.055, 0.042],
  foot: [0.27, 0.09, 0.11],
};

const BRICK_SPEC: HumanoidSpec = {
  thigh: 0.45,
  shin: 0.44,
  ankle: 0.09,
  hipHalf: 0.12,
  pelvisR: 0.19,
  waistR: 0.2,
  chestR: 0.25,
  shoulderR: 0.27,
  depth: 0.72,
  torsoLow: 0.22,
  torsoHigh: 0.34,
  shoulderHalf: 0.27,
  neckLen: 0.06,
  headR: 0.12,
  upperArm: 0.3,
  foreArm: 0.27,
  armR: [0.085, 0.07],
  foreR: [0.068, 0.052],
  hand: 0.11,
  thighR: [0.1, 0.075],
  shinR: [0.075, 0.058],
  foot: [0.3, 0.11, 0.13],
};

function stripe(rig: Rig, joint: THREE.Object3D, len: number, r: number, color: number, z: number, y0 = 0): void {
  addPart(joint, taperedCapsule(len, r, r, 6, 2), rig.mat(color), { pos: [0, -y0, z], outline: 0 });
}

const VOLT: CharacterVisual = {
  id: 'volt',
  spec: VOLT_SPEC,
  accents: ['#2f7bff', '#ff3b4f'],
  palettes: [
    { skin: 0xa86b47, top: 0x1f5fff, top2: 0xffd21f, pants: 0x15161c, pants2: 0xffd21f, shoes: 0xf2f2f2, sole: 0xffd21f, hat: 0x101014, metal: 0xffc63a, shades: 0x1a1a1a },
    { skin: 0xa86b47, top: 0xe8203a, top2: 0xf5f5f5, pants: 0x1b1b1f, pants2: 0xf5f5f5, shoes: 0x101010, sole: 0xe8203a, hat: 0xf5f5f5, metal: 0xd9d9e3, shades: 0x101010 },
  ],
  decorate(rig, p) {
    const s = rig.spec;
    const j = rig.joints;
    // sleeve stripes + cuffs
    for (const side of ['L', 'R'] as const) {
      const z = side === 'L' ? -1 : 1;
      stripe(rig, j[`sh${side}`], s.upperArm * 0.9, 0.012, p.top2, z * s.armR[0] * 0.95, 0.02);
      addPart(j[`el${side}`], new THREE.CylinderGeometry(s.foreR[0] * 1.25, s.foreR[0] * 1.25, 0.06, 12), rig.mat(p.top), {
        pos: [0, -0.02, 0],
      });
      stripe(rig, j[`th${side}`], s.thigh * 0.95, 0.011, p.pants2, z * s.thighR[0] * 0.98);
      stripe(rig, j[`kn${side}`], s.shin * 0.9, 0.01, p.pants2, z * s.shinR[0] * 0.98);
    }
    // hood bunched behind the neck
    addPart(j.chest, new THREE.TorusGeometry(0.11, 0.045, 8, 16), rig.mat(p.top), {
      pos: [-0.04, s.torsoHigh + 0.0, 0],
      rot: [Math.PI / 2, 0, 0.35],
      scale: [0.9, 1.0, 1],
    });
    // jacket zip line
    addPart(j.chest, new THREE.BoxGeometry(0.012, s.torsoHigh * 0.95, 0.012), rig.mat(p.top2), {
      pos: [s.chestR * s.depth + 0.0, s.torsoHigh * 0.45, 0],
      outline: 0,
    });
    // gold chain
    addPart(j.chest, new THREE.TorusGeometry(0.12, 0.013, 6, 24), rig.mat(p.metal), {
      pos: [0.07, s.torsoHigh * 0.72, 0],
      rot: [Math.PI / 2, 0.75, 0],
      scale: [0.75, 1, 1],
      outline: 0.006,
    });
    addPart(j.chest, new THREE.OctahedronGeometry(0.035), rig.mat(p.metal), {
      pos: [0.15, s.torsoHigh * 0.42, 0],
      outline: 0.006,
    });
    // backwards cap
    const hr = s.headR;
    addPart(j.head, new THREE.SphereGeometry(hr * 1.06, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), rig.mat(p.hat), {
      pos: [0.0, hr * 1.18, 0],
      scale: [1.02, 0.8, 0.95],
    });
    addPart(j.head, new RoundedBoxGeometry(hr * 1.1, 0.025, hr * 1.4, 1, 0.01), rig.mat(p.hat), {
      pos: [-hr * 1.15, hr * 1.25, 0],
      rot: [0, 0, 0.2],
    });
    // wraparound shades
    addPart(j.head, new RoundedBoxGeometry(0.05, 0.045, hr * 1.85, 2, 0.015), rig.mat(p.shades), {
      pos: [hr * 0.78, hr * 1.05, 0],
      outline: 0.006,
    });
    addPart(j.head, new RoundedBoxGeometry(0.02, 0.012, hr * 1.7, 1, 0.005), rig.mat(p.top2), {
      pos: [hr * 0.82, hr * 1.13, 0],
      outline: 0,
    });
    // microphone in the rear (near-camera) hand
    const mic = new THREE.Group();
    addPart(mic, new THREE.CylinderGeometry(0.018, 0.024, 0.16, 10), rig.mat(0x16161a), { pos: [0, -0.06, 0], outline: 0.006 });
    addPart(mic, new THREE.SphereGeometry(0.036, 12, 10), rig.mat(0xc9ccd6), { pos: [0, 0.035, 0], outline: 0.006 });
    mic.position.set(0.02, -s.hand * 0.5, 0.0);
    mic.rotation.set(0, 0, -1.2);
    j.haR.add(mic);
    rig.props.mic = mic;
  },
};

const BRICK: CharacterVisual = {
  id: 'brick',
  spec: BRICK_SPEC,
  accents: ['#ff2d55', '#18c3c9'],
  palettes: [
    { skin: 0xd9a37c, top: 0xb3122e, top2: 0xf2f2f2, pants: 0x3a3d45, pants2: 0x2a2c33, shoes: 0x141414, sole: 0x5a5a5a, hat: 0x26272d, metal: 0xffc63a, shades: 0x0b0b0d },
    { skin: 0xd9a37c, top: 0x12324f, top2: 0x18c3c9, pants: 0x202227, pants2: 0x18c3c9, shoes: 0xe9e9e9, sole: 0x18c3c9, hat: 0x18c3c9, metal: 0xd9d9e3, shades: 0x0b0b0d },
  ],
  decorate(rig, p) {
    const s = rig.spec;
    const j = rig.joints;
    for (const side of ['L', 'R'] as const) {
      const z = side === 'L' ? -1 : 1;
      stripe(rig, j[`sh${side}`], s.upperArm * 0.9, 0.016, p.top2, z * s.armR[0] * 0.96, 0.02);
      stripe(rig, j[`sh${side}`], s.upperArm * 0.9, 0.016, p.top2, z * s.armR[0] * 0.96 - z * 0.035, 0.02);
      addPart(j[`el${side}`], new THREE.CylinderGeometry(s.foreR[0] * 1.2, s.foreR[0] * 1.2, 0.07, 12), rig.mat(p.top), {
        pos: [0, -0.03, 0],
      });
      // cargo pocket
      addPart(j[`th${side}`], new RoundedBoxGeometry(0.1, 0.12, 0.04, 1, 0.01), rig.mat(p.pants2), {
        pos: [0, -s.thigh * 0.55, z * s.thighR[0] * 0.95],
        outline: 0.006,
      });
    }
    // jacket zip line
    addPart(j.chest, new THREE.BoxGeometry(0.014, s.torsoHigh * 0.95, 0.014), rig.mat(p.top2), {
      pos: [s.chestR * s.depth + 0.004, s.torsoHigh * 0.45, 0],
      outline: 0,
    });
    // headphones around the neck
    addPart(j.neck, new THREE.TorusGeometry(0.1, 0.018, 8, 20), rig.mat(0x15151a), {
      pos: [0, 0.02, 0],
      rot: [Math.PI / 2, 0, 0],
      outline: 0.006,
    });
    for (const z of [-1, 1])
      addPart(j.neck, new THREE.CylinderGeometry(0.045, 0.045, 0.035, 14), rig.mat(p.top), {
        pos: [0.04, 0.0, z * 0.1],
        rot: [Math.PI / 2, 0, 0],
        outline: 0.006,
      });
    // gold rope chain
    addPart(j.chest, new THREE.TorusGeometry(0.15, 0.018, 6, 24), rig.mat(p.metal), {
      pos: [0.11, s.torsoHigh * 0.7, 0],
      rot: [Math.PI / 2, 0.8, 0],
      scale: [0.72, 1, 1],
      outline: 0.006,
    });
    const hr = s.headR;
    // beanie
    addPart(j.head, new THREE.SphereGeometry(hr * 1.08, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), rig.mat(p.hat), {
      pos: [-0.005, hr * 1.12, 0],
      scale: [1.0, 1.15, 0.95],
    });
    addPart(j.head, new THREE.CylinderGeometry(hr * 1.1, hr * 1.12, 0.05, 18), rig.mat(p.hat), {
      pos: [-0.005, hr * 1.15, 0],
      scale: [1.0, 1, 0.88],
    });
    // short boxed beard along the jaw + mustache
    addPart(j.head, new THREE.SphereGeometry(hr * 0.92, 16, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), rig.mat(0x3a2619), {
      pos: [hr * 0.12, hr * 0.78, 0],
      scale: [1.12, 1.15, 1.02],
      outline: 0.006,
    });
    addPart(j.head, new RoundedBoxGeometry(0.03, 0.022, hr * 0.8, 1, 0.008), rig.mat(0x3a2619), {
      pos: [hr * 0.93, hr * 0.62, 0],
      outline: 0,
    });
    // square shades
    addPart(j.head, new RoundedBoxGeometry(0.05, 0.05, hr * 1.8, 1, 0.01), rig.mat(p.shades), {
      pos: [hr * 0.8, hr * 1.02, 0],
      outline: 0.006,
    });
  },
};

/** Non-playable extra used by BRICK's "Security!" cinematic. */
const GUARD: CharacterVisual = {
  id: 'guard',
  spec: { ...BRICK_SPEC, chestR: 0.22, shoulderR: 0.24, shoulderHalf: 0.24, armR: [0.075, 0.062], foreR: [0.06, 0.048] },
  accents: ['#ffd21f'],
  palettes: [
    { skin: 0x8a5a3c, top: 0x111114, top2: 0xffd21f, pants: 0x18181c, pants2: 0x18181c, shoes: 0x0a0a0a, sole: 0x333333, hat: 0x111114, metal: 0xc0c0c0, shades: 0x050505 },
  ],
  decorate(rig, p) {
    const s = rig.spec;
    const j = rig.joints;
    // SECURITY band across the chest + armbands
    addPart(j.chest, new THREE.CylinderGeometry(s.chestR * 1.02, s.chestR * 1.02, 0.07, 24), rig.mat(p.top2), {
      pos: [0, s.torsoHigh * 0.5, 0],
      scale: [s.depth, 1, 1],
      outline: 0,
    });
    for (const side of ['L', 'R'] as const)
      addPart(j[`sh${side}`], new THREE.CylinderGeometry(s.armR[0] * 1.08, s.armR[0] * 1.08, 0.05, 12), rig.mat(p.top2), {
        pos: [0, -s.upperArm * 0.35, 0],
        outline: 0,
      });
    const hr = s.headR;
    addPart(j.head, new RoundedBoxGeometry(0.05, 0.045, hr * 1.8, 1, 0.01), rig.mat(p.shades), { pos: [hr * 0.8, hr * 1.02, 0], outline: 0.006 });
    addPart(j.head, new THREE.SphereGeometry(0.018, 8, 6), rig.mat(0x222222), { pos: [0, hr * 0.9, hr * 0.92], outline: 0 });
  },
};

export const CHARACTER_VISUALS: Record<string, CharacterVisual> = { volt: VOLT, brick: BRICK, guard: GUARD };

export function buildCharacter(id: string, paletteIndex: number): Rig {
  const v = CHARACTER_VISUALS[id];
  const pal = v.palettes[paletteIndex % v.palettes.length];
  const rig = new Rig(v.spec, pal);
  v.decorate(rig, pal);
  rig.bake();
  rig.root.traverse((o) => {
    o.frustumCulled = false;
  });
  return rig;
}
