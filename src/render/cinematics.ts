// Cinematic special-move presentation. The SIM decides whether a cinematic
// happens (only on a confirmed hit) and counts its frames; this module only
// presents it: camera cuts, poses for both fighters, extra actors and VFX/audio
// cues keyed to the sim's cinematic frame. Rollback/replay safe by construction.
import * as THREE from 'three';
import type { AudioEngine } from '../audio/audio';
import { UNITS_PER_METER } from '../core/math';
import { showcaseOf } from '../core/sim';
import type { GameState } from '../core/state';
import { BRICK_ANIMS } from './anims/brick';
import { reactions, BRICK_STANCE } from './anims/stances';
import { VOLT_ANIMS } from './anims/volt';
import { buildCharacter } from './characters';
import { compose, EASE, sampleDef, smoothClip, type Clip, type EaseName, type PoseDef } from './pose';
import { ANIM_SETS } from './animator';
import type { CharacterRig } from './glbRig';
import { POSE_LEN, R_X, R_Y } from './rig';
import type { AnimSet } from './anims/types';
import type { GameView } from './view';
import { CAR_RIDE, CROC_ATTACK, HERZBRECHER, PALMEN_BASSDROP } from './cines';
import { emoteCamera, emoteFor, emoteFx, emoteTeeth } from './emotes';
import { FATALITIES } from './fatalities';

export type V3 = [number, number, number];
export interface CamKey {
  f: number;
  pos: V3;
  target: V3;
  fov: number;
  /** Hard cut: no interpolation from the previous key. */
  cut?: boolean;
  e?: EaseName;
}
export interface FxCtx {
  view: GameView;
  audio: AudioEngine;
  s: GameState;
  /** world position helpers */
  atk: THREE.Vector3;
  def: THREE.Vector3;
  facing: number;
}
export interface ExtraActor {
  visual: string;
  /** keyed root position relative to attacker (x forward, y, z) */
  path: { f: number; p: V3; e?: EaseName }[];
  /** facing relative to attacker facing (1 same, -1 opposite) */
  facing: number;
  clip: Clip;
  visible: [number, number];
}
/** Per-frame context for cinematic props. Local coordinates: x forward from the attacker. */
export interface PropCtx {
  view: GameView;
  audio: AudioEngine;
  facing: number;
  /** Attacker world x (m). */
  ax: number;
  /** Sampled local root positions of attacker and victim (m). */
  atkLocal: [number, number];
  defLocal: [number, number];
  /** World position from local (x forward, y, z). */
  world(x: number, y: number, z: number): THREE.Vector3;
  dt: number;
  time: number;
}
export interface CineProps {
  /** Placed at the attacker, mirrored by facing (author in local space). */
  group: THREE.Group;
  /** Real lights: added to the scene once at install (intensity 0 when idle) so shaders never recompile mid-match. */
  lights?: THREE.Light[];
  update(f: number, c: PropCtx): void;
}
export interface CineDef {
  frames: number;
  /** Victim start distance (m), must match the sim's CinematicDef.startDx. */
  startDx?: number;
  camera: CamKey[];
  atk: Clip;
  /** Victim clip; a builder gets the victim's own anim set (stance + pivot). */
  def: Clip | ((set: AnimSet) => Clip);
  fx: { f: number; run: (c: FxCtx) => void }[];
  extras?: ExtraActor[];
  props?: () => CineProps;
  /** Attacker's gold teeth prop visible during these frame ranges. */
  teeth?: [number, number][];
  /** Arena darkening per frame (default 0.35). */
  dim?: (f: number) => number;
}

const U = UNITS_PER_METER;
const C = (h: number) => new THREE.Color(h);

// ----------------------------------------------------------------- VOLT
const vr = VOLT_ANIMS.r;
const vs = VOLT_ANIMS.stance;
const defR = reactions(BRICK_STANCE, 0.98);

const HEADLINER: CineDef = {
  frames: 156,
  camera: [
    { f: 0, pos: [-0.2, 1.3, 4.4], target: [0.45, 1.25, 0], fov: 30 },
    { f: 12, pos: [1.7, 0.95, 2.7], target: [0.45, 1.3, 0], fov: 34, cut: true },
    { f: 36, pos: [1.35, 1.0, 2.3], target: [0.4, 1.35, 0], fov: 34 },
    { f: 38, pos: [-0.85, 1.6, 1.6], target: [0.05, 1.55, 0], fov: 30, cut: true },
    { f: 60, pos: [-0.65, 1.5, 1.85], target: [0.05, 1.5, 0], fov: 30 },
    { f: 62, pos: [0.4, 0.45, 3.4], target: [0.6, 1.3, 0], fov: 40, cut: true },
    { f: 76, pos: [0.5, 0.7, 4.6], target: [0.8, 2.0, 0], fov: 44 },
    { f: 104, pos: [0.9, 1.6, 6.2], target: [1.0, 2.2, 0], fov: 44 },
    { f: 114, pos: [1.0, 1.1, 5.4], target: [1.2, 1.0, 0], fov: 42, cut: true },
    { f: 132, pos: [0.9, 1.3, 6.0], target: [0.9, 1.0, 0], fov: 36 },
    { f: 156, pos: [0.9, 1.4, 6.6], target: [0.9, 1.0, 0], fov: 32 },
  ],
  atk: smoothClip(
    [
      { f: 0, p: { j: { shR: [-20, 0, 96], elR: [0, 0, 8], chest: [0, 10, 0], head: [0, -10, 4] } } },
      { f: 12, p: {} },
      { f: 18, p: VOLT_ANIMS.moves.volt_5L ? sampleDef(VOLT_ANIMS.moves.volt_5L, 6) : {}, e: 'snap' },
      { f: 22, p: {} },
      { f: 26, p: sampleDef(VOLT_ANIMS.moves.volt_5H, 10), e: 'snap' },
      { f: 30, p: {} },
      { f: 34, p: sampleDef(VOLT_ANIMS.moves.volt_rush_fu, 14), e: 'snap' },
      { f: 40, p: { x: -0.25, j: { spine: [0, 0, 8], chest: [0, -10, 8], head: [0, 0, 16], shL: [40, 0, 160], elL: [0, 0, 20], shR: [-20, 0, 100], elR: [0, 0, 130] } } },
      { f: 58, p: { x: -0.25, y: 0.03, j: { spine: [0, 0, 12], chest: [0, -8, 12], head: [0, 0, 22], shL: [40, 0, 176], elL: [0, 0, 6], shR: [-20, 0, 98], elR: [0, 0, 132] } } },
      { f: 66, p: compose(vr.crouch, { x: 0.35, j: { shR: [-12, 0, -20], elR: [0, 0, 90] } }) },
      { f: 72, p: sampleDef(VOLT_ANIMS.moves.volt_rush_fu, 34), e: 'snap' },
      { f: 80, p: compose(vr.airRise, { x: 0.6, y: 0.6 }) },
      { f: 100, p: { x: 0.95, y: 1.9, rot: -15, j: { spine: [0, 0, 16], shL: [14, 0, 175], elL: [0, 0, 20], shR: [-14, 0, 172], elR: [0, 0, 24], thL: [6, 10, 60], knL: [0, 0, -90], thR: [-6, 10, 20], knR: [0, 0, -100] } } },
      { f: 110, p: { x: 1.05, y: 1.4, rot: 10, j: { spine: [0, 0, -30], shL: [14, 0, 70], elL: [0, 0, 10], shR: [-14, 0, 60], elR: [0, 0, 10], thL: [6, 10, 70], knL: [0, 0, -100] } }, e: 'in' },
      { f: 116, p: compose(vr.crouch, { x: 1.1, y: -0.42, j: { spine: [0, 0, -40], chest: [0, 0, -16], shL: [14, 0, 40], elL: [0, 0, 10], shR: [-14, 0, 30], elR: [0, 0, 10] } }), e: 'snap' },
      { f: 130, p: compose(vr.crouch, { x: 1.1, y: -0.42, j: { spine: [0, 0, -36], chest: [0, 0, -14], shL: [14, 0, 44], elL: [0, 0, 10], shR: [-14, 0, 34], elR: [0, 0, 10] } }) },
      { f: 140, p: compose(vr.airRise, { x: 0.55, y: 1.0, rot: 180 }) },
      { f: 148, p: compose(vr.land, { x: 0.0, y: -0.15, rot: 360 }) },
      { f: 156, p: { rot: 360, j: { shR: [-20, 0, 20], elR: [0, 0, 20], shL: [40, 0, 150], elL: [0, 0, 10], head: [0, 20, 10] } } },
    ],
    vs,
  ),
  def: smoothClip(
    [
      { f: 0, p: defR.hitHigh },
      { f: 18, p: compose(defR.hitHigh, { x: -0.06 }), e: 'snap' },
      { f: 22, p: defR.hitGut },
      { f: 26, p: compose(defR.hitHigh, { x: -0.1, j: { head: [0, 40, 30] } }), e: 'snap' },
      { f: 34, p: compose(defR.hitGut, { x: -0.14 }), e: 'snap' },
      { f: 50, p: compose(defR.hitGut, { x: -0.18, y: -0.12 }) },
      { f: 66, p: compose(defR.hitGut, { x: -0.14, y: -0.06 }) },
      { f: 72, p: compose(defR.juggle, { x: -0.2, y: 0.4, rot: 30 }), e: 'snap' },
      { f: 92, p: compose(defR.juggle, { x: -0.6, y: 1.7, rot: 150 }), e: 'out' },
      { f: 106, p: compose(defR.juggle, { x: -0.85, y: 1.95, rot: 220 }) },
      { f: 114, p: compose(defR.juggle, { x: -1.1, y: 0.8, rot: 300 }), e: 'in' },
      { f: 116, p: compose(defR.lying, { x: -1.15 + 0.05, rot: 450 }), e: 'snap' },
      { f: 156, p: compose(defR.lying, { x: -1.15 + 0.05, rot: 450 }) },
    ],
    BRICK_STANCE,
  ),
  fx: [
    {
      f: 1,
      run: (c) => {
        c.view.arena.pulse(1);
        c.audio.crowdSwell(0.4);
      },
    },
    ...[18, 26, 34].map((f, i) => ({
      f,
      run: (c: FxCtx) => {
        const p = c.def.clone().add(new THREE.Vector3(0, 0.45, 0.2));
        c.view.vfx.sparks(p.x, p.y, 16 + i * 4, C(0xffd36b), 8, -c.facing);
        c.view.vfx.flash(p.x, p.y, 0.6, C(0xfff4c2), 0.08);
        c.view.director.shake(0.2 + i * 0.05);
      },
    })),
    {
      f: 40,
      run: (c) => {
        c.audio.crowdSwell(0.5);
        c.view.arena.pulse(0.7);
      },
    },
    {
      f: 72,
      run: (c) => {
        const p = c.def.clone().add(new THREE.Vector3(0, 0.5, 0.2));
        c.view.vfx.sparks(p.x, p.y, 30, C(0xff9a3c), 11, -c.facing, 2);
        c.view.vfx.ring(p.x, p.y, 1.3, C(0xffd21f), 0.3);
        c.view.director.shake(0.45);
        c.view.screenFlash = 0.4;
      },
    },
    {
      f: 116,
      run: (c) => {
        const x = c.def.x;
        c.view.vfx.ring(x, 0.02, 3.2, C(0xffd21f), 0.5, true);
        c.view.vfx.ring(x, 0.8, 2.4, C(0xff2bd6), 0.4);
        c.view.vfx.sparks(x, 0.3, 60, C(0xffd36b), 13, 1, 2);
        c.view.vfx.dust(x, 0, 40, 2);
        c.view.vfx.confetti(x, 3.5, 160);
        c.view.director.shake(0.9);
        c.view.director.punch(4);
        c.view.arena.pulse(1);
        c.view.screenFlash = 0.9;
        c.audio.crowdSwell(0.6);
      },
    },
    { f: 140, run: (c) => c.view.vfx.confetti(c.atk.x, 4, 80) },
  ],
};

// ----------------------------------------------------------------- BRICK

const bs = BRICK_ANIMS.stance;
const vdef = reactions(VOLT_ANIMS.stance, 0.92);
const held: PoseDef = compose(vdef.hitHigh, {
  x: -0.2,
  j: { shL: [80, 0, -10], elL: [0, 0, 20], shR: [-80, 0, -10], elR: [0, 0, 20], spine: [0, 0, 6], head: [0, 0, 18] },
});
const guardHold: PoseDef = {
  x: 0.0,
  j: { spine: [0, 0, -6], shL: [10, 0, 70], elL: [0, 0, 60], shR: [-10, 0, 70], elR: [0, 0, 60], thL: [8, 10, 20], knL: [0, 0, -20], thR: [-8, 10, -16], knR: [0, 0, -14] },
};
const guardRunA: PoseDef = {
  j: { spine: [0, 0, -18], shL: [10, 0, -50], elL: [0, 0, 80], shR: [-10, 0, 60], elR: [0, 0, 90], thL: [6, 0, 60], knL: [0, 0, -70], thR: [-6, 0, -30], knR: [0, 0, -60] },
};
const guardRunB: PoseDef = {
  j: { spine: [0, 0, -18], shL: [10, 0, 60], elL: [0, 0, 90], shR: [-10, 0, -50], elR: [0, 0, 80], thL: [6, 0, -30], knL: [0, 0, -60], thR: [-6, 0, 60], knR: [0, 0, -70] },
};
function guardClip(): Clip {
  return smoothClip(
    [
      { f: 18, p: guardRunA },
      { f: 24, p: guardRunB },
      { f: 30, p: guardRunA },
      { f: 36, p: guardRunB },
      { f: 42, p: guardHold },
      { f: 120, p: guardHold },
      { f: 124, p: { j: { shL: [30, 0, 120], elL: [0, 0, 20], shR: [-30, 0, 120], elR: [0, 0, 20] } }, e: 'snap' },
      { f: 140, p: { j: { shL: [10, 0, 20], elL: [0, 0, 100], shR: [-10, 0, 20], elR: [0, 0, 100] } } },
      { f: 146, p: guardRunA },
      { f: 152, p: guardRunB },
      { f: 158, p: guardRunA },
      { f: 164, p: guardRunB },
    ],
    BRICK_STANCE,
  );
}

const SECURITY: CineDef = {
  frames: 168,
  camera: [
    { f: 0, pos: [0.3, 1.45, 3.4], target: [0.5, 1.4, 0], fov: 32 },
    { f: 18, pos: [0.6, 1.7, 7.2], target: [0.6, 1.2, 0], fov: 38, cut: true },
    { f: 48, pos: [0.6, 1.55, 6.0], target: [0.7, 1.25, 0], fov: 38 },
    { f: 50, pos: [-0.2, 1.4, 2.6], target: [0.75, 1.25, 0], fov: 36, cut: true },
    { f: 74, pos: [-0.05, 1.35, 2.4], target: [0.75, 1.3, 0], fov: 34 },
    { f: 76, pos: [-1.5, 0.8, 1.15], target: [0.9, 1.45, 0], fov: 38, cut: true },
    { f: 116, pos: [-1.2, 0.9, 1.35], target: [0.9, 1.4, 0], fov: 35 },
    { f: 119, pos: [1.0, 1.3, 6.0], target: [1.4, 1.1, 0], fov: 40, cut: true },
    { f: 150, pos: [1.0, 1.4, 6.4], target: [1.2, 1.0, 0], fov: 36 },
    { f: 168, pos: [0.9, 1.4, 6.8], target: [0.9, 1.0, 0], fov: 32 },
  ],
  atk: smoothClip(
    [
      { f: 0, p: compose(BRICK_ANIMS.moves.brick_security ? sampleDef(BRICK_ANIMS.moves.brick_security, 12) : {}, { j: { head: [0, 0, 24] } }) },
      { f: 18, p: compose(sampleDef(BRICK_ANIMS.moves.brick_security, 12), { j: { head: [0, 0, 30] } }) },
      { f: 40, p: { x: -0.3, j: { head: [0, 10, 6], shR: [-30, 0, 100], elR: [0, 0, 60] } } },
      { f: 50, p: { x: -0.25 } },
      { f: 56, p: compose(sampleDef(BRICK_ANIMS.moves.brick_5H, 13), { x: 0.0, y: -0.08, j: { spine: [0, 20, -24] } }), e: 'snap' },
      { f: 62, p: { x: -0.25 } },
      { f: 70, p: compose(sampleDef(BRICK_ANIMS.moves.brick_5L, 7), { x: 0.0, y: -0.08, j: { spine: [0, -20, -24] } }), e: 'snap' },
      { f: 80, p: { x: -0.5, j: { chest: [0, -50, 4], spine: [0, -20, 4], shR: [-60, 0, -30], elR: [0, 0, 110], head: [0, 30, 10] } } },
      { f: 112, p: { x: -0.6, y: -0.05, j: { chest: [0, -60, 6], spine: [0, -24, 6], shR: [-70, 0, -40], elR: [0, 0, 120], head: [0, 34, 10] } } },
      { f: 122, p: compose(sampleDef(BRICK_ANIMS.moves.brick_5H, 13), { x: 0.25 }), e: 'snap' },
      { f: 140, p: compose(sampleDef(BRICK_ANIMS.moves.brick_5H, 13), { x: 0.2 }) },
      { f: 156, p: BRICK_ANIMS.win ? { j: { chest: [0, 0, 6], shL: [10, 0, 66], elL: [0, 0, 108], shR: [-10, 0, 66], elR: [0, 0, 108], head: [0, 10, 8] } } : {} },
      { f: 168, p: { j: { chest: [0, 0, 6], shL: [10, 0, 66], elL: [0, 0, 108], shR: [-10, 0, 66], elR: [0, 0, 108], head: [0, 10, 8] } } },
    ],
    bs,
  ),
  def: smoothClip(
    [
      { f: 0, p: vdef.hitGut },
      { f: 40, p: compose(vdef.hitGut, { x: -0.2 }) },
      { f: 46, p: held },
      { f: 56, p: compose(held, { j: { spine: [0, 0, -30], chest: [0, 0, -16], head: [0, 0, -10] } }), e: 'snap' },
      { f: 62, p: held },
      { f: 70, p: compose(held, { j: { spine: [0, 0, -30], chest: [0, 0, -16], head: [0, 0, -10] } }), e: 'snap' },
      { f: 76, p: held },
      { f: 118, p: compose(held, { j: { head: [0, 20, 20] } }) },
      { f: 122, p: compose(vdef.juggle, { x: -0.35, y: 0.3, rot: 30 }), e: 'snap' },
      { f: 132, p: compose(vdef.juggle, { x: -0.95, y: 1.1, rot: 120 }), e: 'out' },
      { f: 140, p: compose(vdef.lying, { x: -1.4 + 0.05, rot: 90 }), e: 'in' },
      { f: 168, p: compose(vdef.lying, { x: -1.4 + 0.05, rot: 90 }) },
    ],
    VOLT_ANIMS.stance,
  ),
  extras: [
    {
      visual: 'guard',
      facing: -1,
      clip: guardClip(),
      visible: [16, 168],
      path: [
        { f: 16, p: [-5.0, 0, -0.5] },
        { f: 42, p: [1.3, 0, -0.45], e: 'out' },
        { f: 140, p: [1.3, 0, -0.45] },
        { f: 168, p: [5.5, 0, -0.6], e: 'in' },
      ],
    },
    {
      visual: 'guard',
      facing: -1,
      clip: guardClip(),
      visible: [16, 168],
      path: [
        { f: 16, p: [6.5, 0, 0.35] },
        { f: 42, p: [1.4, 0, 0.3], e: 'out' },
        { f: 140, p: [1.4, 0, 0.3] },
        { f: 168, p: [6.5, 0, 0.6], e: 'in' },
      ],
    },
  ],
  fx: [
    {
      f: 1,
      run: (c) => {
        c.view.arena.pulse(0.8);
        c.audio.crowdSwell(0.3);
      },
    },
    {
      f: 18,
      run: (c) => {
        c.audio.crowdSwell(0.5);
      },
    },
    ...[56, 70].map((f) => ({
      f,
      run: (c: FxCtx) => {
        const p = c.def.clone().add(new THREE.Vector3(0, 0.25, 0.25));
        c.view.vfx.sparks(p.x, p.y, 22, C(0xffd36b), 9, -c.facing);
        c.view.vfx.flash(p.x, p.y, 0.7, C(0xfff4c2), 0.08);
        c.view.director.shake(0.3);
      },
    })),
    {
      f: 96,
      run: (c) => {
        c.audio.riser();
        c.view.arena.pulse(0.6);
      },
    },
    {
      f: 122,
      run: (c) => {
        const p = c.def.clone().add(new THREE.Vector3(0, 0.45, 0.2));
        c.view.vfx.ring(p.x, p.y, 2.6, C(0xffffff), 0.45);
        c.view.vfx.ring(p.x, p.y, 1.6, C(0xff2d55), 0.35);
        c.view.vfx.sparks(p.x, p.y, 70, C(0xff9a3c), 14, -c.facing, 2);
        c.view.toon.impactFrame(0.07);
        c.view.after(0.07, () => {
          c.view.toon.impact(p.x, p.y, 2.2, C(0xff9a3c), { spikes: 14, life: 0.45 });
          c.view.toon.speedLines(p.x, p.y, C(0xffffff), 0.6, 0.4);
        });
        c.view.director.shake(1);
        c.view.director.punch(5);
        c.view.director.kick(-c.facing * 0.2, 0, -0.2);
        c.view.arena.pulse(1);
        c.view.screenFlash = 1;
        c.audio.crowdSwell(0.6);
      },
    },
    {
      f: 140,
      run: (c) => {
        c.view.vfx.dust(c.def.x, 0, 12, 1.6);
        c.view.toon.puff(c.def.x, 0, 12, 1.6, C(0xe9dfd0), 0.3, 0.8);
        c.view.toon.crack(c.def.x, 1.8);
        c.view.vfx.ring(c.def.x, 0.02, 2.4, C(0xffffff), 0.4, true);
        c.view.director.shake(0.4);
      },
    },
  ],
};

export const CINEMATICS: Record<string, CineDef> = {
  volt_headliner: HEADLINER,
  brick_security: SECURITY,
  jaz_heart: HERZBRECHER,
  bon_palm: PALMEN_BASSDROP,
  bon_croc: CROC_ATTACK,
  bon_car: CAR_RIDE,
  ...FATALITIES,
};

// ------------------------------------------------------------- runtime

/** Camera key as 7 numbers (pos, target, fov). */
const camVec = (k: CamKey) => [...k.pos, ...k.target, k.fov];

/** Velocity at key i of a shot (a run of keys between cuts): central difference inside the shot, one-sided at its
 *  ends, so a camera move keeps a continuous speed through its keys (no stop at every key). */
function camTangent(keys: CamKey[], i: number): number[] {
  const k = keys[i];
  const prev = i > 0 && !k.cut && !k.e ? keys[i - 1] : null;
  const next = i < keys.length - 1 && !keys[i + 1].cut && !keys[i + 1].e ? keys[i + 1] : null;
  const a = prev ?? k;
  const b = next ?? k;
  const dt = b.f - a.f;
  if (dt <= 0) return [0, 0, 0, 0, 0, 0, 0];
  const va = camVec(a);
  const vb = camVec(b);
  return va.map((x, c) => (vb[c] - x) / dt);
}

export function sampleCam(keys: CamKey[], f: number): { pos: THREE.Vector3; target: THREE.Vector3; fov: number } {
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].f <= f) i++;
  const a = keys[i];
  const b = keys[i + 1];
  if (!b || b.cut) {
    return { pos: new THREE.Vector3(...a.pos), target: new THREE.Vector3(...a.target), fov: a.fov };
  }
  const span = Math.max(1, b.f - a.f);
  const t = Math.min(1, Math.max(0, (f - a.f) / span));
  if (b.e) {
    const e = EASE[b.e](t);
    return {
      pos: new THREE.Vector3(...a.pos).lerp(new THREE.Vector3(...b.pos), e),
      target: new THREE.Vector3(...a.target).lerp(new THREE.Vector3(...b.target), e),
      fov: a.fov + (b.fov - a.fov) * e,
    };
  }
  // cubic Hermite through the shot's keys
  const va = camVec(a);
  const vb = camVec(b);
  const ma = camTangent(keys, i);
  const mb = camTangent(keys, i + 1);
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = (t3 - 2 * t2 + t) * span;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = (t3 - t2) * span;
  const v = va.map((x, c) => h00 * x + h10 * ma[c] + h01 * vb[c] + h11 * mb[c]);
  return { pos: new THREE.Vector3(v[0], v[1], v[2]), target: new THREE.Vector3(v[3], v[4], v[5]), fov: v[6] };
}

function samplePath(path: ExtraActor['path'], f: number): V3 {
  let i = 0;
  while (i < path.length - 1 && path[i + 1].f <= f) i++;
  const a = path[i];
  const b = path[i + 1];
  if (!b) return a.p;
  const t = EASE[b.e ?? 'inOut'](Math.min(1, Math.max(0, (f - a.f) / Math.max(1, b.f - a.f))));
  return [a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t, a.p[2] + (b.p[2] - a.p[2]) * t];
}

class CinematicRuntime {
  private active: string | null = null;
  private lastFrame = -1;
  private extras: CharacterRig[] = [];
  private tmp = new Float32Array(POSE_LEN);
  private tmpA = new Float32Array(POSE_LEN);
  private tmpD = new Float32Array(POSE_LEN);
  private defClips = new Map<string, Clip>();
  private props = new Map<string, CineProps>();
  private lastT = 0;

  constructor(
    private view: GameView,
    private audio: AudioEngine,
  ) {}

  update(s: GameState, alpha: number): boolean {
    const v = this.view;
    // round 1: fighter showcases (emote + face close-up; the HUD shows the name)
    const sc = showcaseOf(s);
    if (sc) return this.showcase(s, sc.who, sc.f + alpha);
    // super flash close-up (before the cinematic itself)
    if (!s.cine && s.freeze > 0 && s.freezeOwner >= 0) {
      const o = s.fighters[s.freezeOwner];
      const x = o.x / U;
      v.director.setOverride({
        pos: new THREE.Vector3(x + o.facing * 0.5, 1.4, 2.7),
        target: new THREE.Vector3(x + o.facing * 0.05, 1.3, 0),
        fov: 32,
      });
      this.end();
      return true;
    }
    // a fatality runs on the same machinery, keyed to the finish phase's own frame counter
    const cine = s.cine ?? (s.fatal ? { id: `fatal_${s.fighters[s.fatal.owner].def}`, owner: s.fatal.owner, frame: s.fatal.frame } : null);
    if (!cine) {
      this.end();
      return false;
    }
    const def = CINEMATICS[cine.id];
    if (!def) return false;
    if (this.active !== cine.id) this.start(cine.id, def);
    const owner = cine.owner;
    const atkF = s.fighters[owner];
    const facing = atkF.facing;
    const ax = atkF.x / U;
    const f = Math.min(def.frames, cine.frame + alpha);

    // poses
    const atkAnim = v.anims[owner];
    const defAnim = v.anims[1 - owner];
    const defClip = this.defClipFor(cine.id, def, defAnim?.set);
    if (atkAnim) atkAnim.override = (_s, _i, out) => (def.atk.sample(f, out), true);
    if (defAnim) defAnim.override = (_s, _i, out) => (defClip.sample(f, out), true);
    v.fx.teethOverride[owner] = def.teeth?.some(([a, b]) => f >= a && f <= b) ?? false;
    v.dimOverride = def.dim ? def.dim(f) : null;

    // props
    if (def.props) {
      const pr = this.propsFor(cine.id, def);
      pr.group.visible = true;
      pr.group.position.set(ax, 0, 0);
      pr.group.scale.set(facing, 1, 1);
      def.atk.sample(f, this.tmpA);
      defClip.sample(f, this.tmpD);
      const now = v.time;
      const dt = Math.min(0.1, Math.max(0, now - this.lastT));
      this.lastT = now;
      pr.update(f, {
        view: v,
        audio: this.audio,
        facing,
        ax,
        atkLocal: [this.tmpA[R_X], this.tmpA[R_Y]],
        defLocal: [(def.startDx ?? 0.9) - this.tmpD[R_X], this.tmpD[R_Y]],
        world: (x, y, z) => new THREE.Vector3(ax + facing * x, y, z),
        dt,
        time: now,
      });
    }

    // camera (relative to attacker: x forward)
    const shot = sampleCam(def.camera, f);
    shot.pos.x = ax + facing * shot.pos.x;
    shot.target.x = ax + facing * shot.target.x;
    v.director.setOverride(shot);

    // extras
    def.extras?.forEach((ex, i) => {
      const rig = this.extras[i] ?? (this.extras[i] = this.makeExtra(ex.visual));
      const vis = f >= ex.visible[0] && f <= ex.visible[1];
      rig.root.visible = vis;
      if (!vis) return;
      const p = samplePath(ex.path, f);
      rig.root.position.set(ax + facing * p[0], p[1], p[2]);
      ex.clip.sample(f, this.tmp);
      rig.apply(this.tmp, facing * ex.facing);
    });

    // fx cues
    const fi = Math.floor(f);
    if (fi > this.lastFrame) {
      const atkRig = v.rigs[owner];
      const defRig = v.rigs[1 - owner];
      const ctx: FxCtx = {
        view: v,
        audio: this.audio,
        s,
        atk: atkRig.body.getWorldPosition(new THREE.Vector3()),
        def: defRig.body.getWorldPosition(new THREE.Vector3()),
        facing,
      };
      for (const cue of def.fx) if (cue.f > this.lastFrame && cue.f <= fi) cue.run(ctx);
      this.lastFrame = fi;
    }
    return true;
  }

  private faceY = 1.6;

  private showcase(s: GameState, who: number, f: number): boolean {
    const v = this.view;
    const fighter = s.fighters[who];
    const anim = v.anims[who];
    const rig = v.rigs[who];
    if (!anim || !rig) return false;
    const id = `show${who}`;
    if (this.active !== id) {
      this.end();
      this.active = id;
      this.lastFrame = -1;
      this.faceY = rig.joints.head.getWorldPosition(new THREE.Vector3()).y + 0.12;
      this.audio.whoosh(2);
      this.audio.crowdSwell(0.35);
    }
    const x = fighter.x / U;
    const facing = fighter.facing;
    const clip = emoteFor(anim.set);
    anim.override = (_s, _i, out) => (clip.sample(f, out), true);
    v.fx.teethOverride[who] = emoteTeeth(fighter.def, f);
    v.dimOverride = 0.45;
    const shot = sampleCam(emoteCamera(this.faceY), f);
    shot.pos.x = x + facing * shot.pos.x;
    shot.target.x = x + facing * shot.target.x;
    v.director.setOverride(shot);
    const fi = Math.floor(f);
    if (fi > this.lastFrame) {
      const face = rig.joints.head.getWorldPosition(new THREE.Vector3());
      face.y += 0.12;
      for (let k = this.lastFrame + 1; k <= fi; k++) {
        if (k === 20) this.audio.stab();
        emoteFx(fighter.def, k, {
          face,
          facing,
          hearts: (hx, hy, n) => v.fx.heartBurst(hx, hy, n),
          notes: (nx, ny, n, dir) => v.fx.noteBurst(nx, ny, n, dir),
          sparks: (px, py, n, color) => v.vfx.sparks(px, py, n, new THREE.Color(color), 3, facing, 2),
        });
      }
      this.lastFrame = fi;
    }
    return true;
  }

  propsFor(id: string, def: CineDef): CineProps {
    let pr = this.props.get(id);
    if (!pr) {
      pr = def.props!();
      this.props.set(id, pr);
      pr.group.visible = false;
      this.view.scene.add(pr.group);
      for (const l of pr.lights ?? []) {
        l.intensity = 0;
        this.view.scene.add(l);
        if (l instanceof THREE.SpotLight || l instanceof THREE.DirectionalLight) this.view.scene.add(l.target);
      }
    }
    return pr;
  }

  private defClipFor(id: string, def: CineDef, set: AnimSet | undefined): Clip {
    if (!(typeof def.def === 'function')) return def.def;
    const key = `${id}|${set?.id ?? '?'}`;
    let c = this.defClips.get(key);
    if (!c) {
      c = def.def(set ?? ANIM_SETS.jazeek);
      this.defClips.set(key, c);
    }
    return c;
  }

  private makeExtra(visual: string): CharacterRig {
    const rig = buildCharacter(visual, 0);
    this.view.scene.add(rig.root);
    return rig;
  }

  private start(id: string, def: CineDef): void {
    this.active = id;
    this.lastFrame = -1;
    void def;
  }

  private end(): void {
    if (!this.active) return;
    this.active = null;
    for (const a of this.view.anims) a.override = null;
    for (const r of this.extras) r.root.visible = false;
    for (const p of this.props.values()) {
      p.group.visible = false;
      for (const l of p.lights ?? []) l.intensity = 0;
    }
    this.view.fx.teethOverride = [false, false];
    this.view.dimOverride = null;
  }
}

export function installCinematics(view: GameView, audio: AudioEngine): void {
  const rt = new CinematicRuntime(view, audio);
  // build props (and their lights) up front: no hitch or shader recompile on the first signature
  for (const [id, def] of Object.entries(CINEMATICS)) if (def.props) rt.propsFor(id, def);
  view.hooks.cinematic = (_v, s, _dt, alpha) => rt.update(s, alpha);
}
