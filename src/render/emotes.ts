// Fighter showcase at the start of a match (PO: an emote that fits the character, face close-up, name overlay).
// The sim runs the showcase in the intro phase of round 1 (sim.ts showcaseOf: P1 then P2, RULES.SHOWCASE_EACH frames
// each, skippable); this file is the presentation: the emote clips, the camera path and the per-fighter effects.
import * as THREE from 'three';
import { BONEZ_ANIMS, BONEZ_POSES } from './anims/bonez';
import { JAZEEK_ANIMS, JAZEEK_POSES } from './anims/jazeek';
import type { AnimSet } from './anims/types';
import type { CamKey } from './cinematics';
import { compose, smoothClip, type Clip, type PoseDef } from './pose';

const J = JAZEEK_POSES;
const B = BONEZ_POSES;

// ---- Jazeek: sings a line into the mic, blows a kiss at the camera, points: "you're next"
const jStance = JAZEEK_ANIMS.stance;
const belt = compose(J.sing, { j: { shL: [20, 0, 150], elL: [0, 0, 10], haL: [0, 0, -30], head: [0, -10, 24], chest: [0, -24, 14] } });
const kissHand: PoseDef = { j: { shR: [-30, 0, 128], elR: [0, 0, 150], haR: [0, 0, -20], head: [0, 0, 6], shL: [20, 0, 30], elL: [0, 0, 40] } };
const kissBlow: PoseDef = { x: 0.04, j: { shR: [-8, 0, 92], elR: [0, 0, 6], haR: [0, 0, -40], head: [0, 0, -4], shL: [20, 0, 30], elL: [0, 0, 40] } };
// (negative twist turns toward the camera, which films from the fighter's front-left)
const point: PoseDef = {
  aim: { shR: [0.55, 0.12, 0.83], elR: [0.55, 0.14, 0.82] },
  j: { chest: [0, -14, 2], neck: [0, -10, 0], head: [0, -26, 4], shL: [30, 0, 20], elL: [0, 0, 60], hips: [0, -6, 0] },
};
const JAZEEK_EMOTE = smoothClip(
  [
    { f: 0, p: {} },
    { f: 10, p: J.sing, e: 'out' },
    { f: 22, p: belt, e: 'inOut' },
    { f: 34, p: compose(belt, { y: 0.02, j: { head: [0, -14, 28], hips: [0, -8, 2] } }) },
    { f: 44, p: kissHand, e: 'inOut' },
    { f: 52, p: kissBlow, e: 'snap' },
    { f: 62, p: compose(kissBlow, { j: { elR: [0, 0, 12] } }) },
    { f: 72, p: point, e: 'snap' },
    { f: 96, p: compose(point, { j: { head: [0, -22, -2] } }) },
  ],
  jStance,
);

// ---- Bonez: cracks his knuckles, flashes the gold teeth, crosses his arms with the chin up
const bStance = BONEZ_ANIMS.stance;
const knuckles = (k: number): PoseDef => ({
  y: k ? -0.01 : 0,
  j: {
    chest: [0, k ? -8 : 6, 4],
    head: [0, k ? 6 : -4, k ? 8 : 4],
    shL: [34, 0, 58 + k * 4],
    elL: [0, 0, 104 + k * 8],
    haL: [0, 0, k ? 30 : 10],
    shR: [-34, 0, 58 + k * 4],
    elR: [0, 0, 104 + k * 8],
    haR: [0, 0, k ? -30 : -10],
  },
});
// arms crossed low (at the belly), so the face close-up stays clear
const crossed: PoseDef = { j: { chest: [0, -6, 6], shL: [16, 0, 40], elL: [0, 0, 122], shR: [-16, 0, 40], elR: [0, 0, 122] } };
const BONEZ_EMOTE = smoothClip(
  [
    { f: 0, p: {} },
    { f: 10, p: knuckles(0), e: 'out' },
    { f: 15, p: knuckles(1), e: 'snap' },
    { f: 21, p: knuckles(0) },
    { f: 26, p: knuckles(1), e: 'snap' },
    { f: 36, p: compose(B.grin, { j: { head: [0, -30, -6], neck: [0, -8, 0] } }), e: 'inOut' },
    { f: 50, p: compose(B.grin, { y: 0.02, j: { head: [0, -28, -10], neck: [0, -8, 0], chest: [0, -16, 4] } }) },
    { f: 62, p: compose(crossed, { j: { head: [0, -26, -12], neck: [0, -8, -6], chest: [0, -12, 6] } }), e: 'inOut' },
    { f: 80, p: compose(crossed, { y: 0.01, j: { head: [0, -30, -4], neck: [0, -8, -2], chest: [0, -12, 6] } }) },
    { f: 96, p: compose(crossed, { j: { head: [0, -26, -12], neck: [0, -8, -6], chest: [0, -12, 6] } }) },
  ],
  bStance,
);

const EMOTES: Record<string, Clip> = { jazeek: JAZEEK_EMOTE, bonez: BONEZ_EMOTE };

/** The fighter's showcase emote (other fighters fall back to their round intro clip). */
export function emoteFor(set: AnimSet): Clip {
  return EMOTES[set.id] ?? set.intro;
}

/** Gold teeth during Bonez' grin. */
export function emoteTeeth(id: string, f: number): boolean {
  return id === 'bonez' && f >= 32;
}

/** Camera path in fighter-local space (x toward the opponent, z toward the camera), face height `fy`: a low full-body
 *  shot that pushes in to a face close-up while the name comes in. */
export function emoteCamera(fy: number): CamKey[] {
  return [
    { f: 0, pos: [2.3, 0.85, 3.3], target: [0.15, 1.05, 0], fov: 38 },
    { f: 30, pos: [1.15, fy - 0.02, 1.65], target: [0.05, fy - 0.12, 0], fov: 30, e: 'inOut' },
    { f: 96, pos: [0.98, fy, 1.45], target: [0.04, fy - 0.1, 0], fov: 29, e: 'linear' },
  ];
}

export interface EmoteFxCtx {
  /** World position of the face and the facing of the showcased fighter. */
  face: THREE.Vector3;
  facing: number;
  hearts(x: number, y: number, n: number): void;
  notes(x: number, y: number, n: number, dir: number): void;
  sparks(x: number, y: number, n: number, color: number): void;
}

/** One-shot effects per emote frame. */
export function emoteFx(id: string, f: number, c: EmoteFxCtx): void {
  const { face: p, facing } = c;
  if (id === 'jazeek') {
    if (f >= 12 && f <= 40 && f % 5 === 0) c.notes(p.x + facing * 0.15, p.y - 0.1, 1, facing);
    if (f === 53) c.hearts(p.x + facing * 0.35, p.y - 0.05, 6);
  } else if (id === 'bonez') {
    if (f === 15 || f === 26) c.sparks(p.x + facing * 0.25, p.y - 0.45, 6, 0xffffff);
    if (f === 38) c.sparks(p.x + facing * 0.1, p.y - 0.06, 14, 0xffd65a);
  }
}
