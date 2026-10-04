// BONEZ MC animation set — relaxed, low centre of gravity, big readable wind-ups.
// Frames match src/content/bonez.ts.
import { Clip, compose, type PoseDef } from '../pose';
import { reactions } from './stances';
import type { AnimSet } from './types';

export const BONEZ_STANCE: PoseDef = {
  y: -0.07,
  j: {
    hips: [0, -18, 0],
    spine: [0, -4, -6],
    chest: [0, -16, -4],
    neck: [0, -2, 8],
    head: [0, -4, 6],
    shL: [22, 0, 30],
    elL: [0, 0, 72],
    haL: [0, 0, 6],
    shR: [-24, 0, 12],
    elR: [0, 0, 82],
    haR: [0, 0, 0],
    thL: [12, 14, 26],
    knL: [0, 0, -36],
    ftL: [0, 0, 10],
    thR: [-12, 12, -22],
    knR: [0, 0, -24],
    ftR: [0, 0, 28],
  },
};

const S = BONEZ_STANCE;
const pivot = 0.88;
const r = reactions(S, pivot);

const longJab: PoseDef = {
  x: 0.1,
  j: { spine: [0, -12, -10], chest: [0, -38, -8], shL: [4, -4, 92], elL: [0, 0, 4], haL: [0, 0, -6], shR: [-24, 0, 26], elR: [0, 0, 100] },
};
const straight: PoseDef = {
  x: 0.22,
  j: {
    hips: [0, 14, 0],
    spine: [0, 20, -14],
    chest: [0, 34, -10],
    head: [0, -10, 8],
    shR: [-6, 8, 92],
    elR: [0, 0, 4],
    shL: [30, 0, 30],
    elL: [0, 0, 96],
    thL: [12, 14, 34],
    knL: [0, 0, -36],
    thR: [-12, 12, -32],
    knR: [0, 0, -8],
    ftR: [0, 0, 30],
  },
};
const jawsOpen: PoseDef = {
  x: 0.08,
  y: -0.1,
  j: { spine: [0, -4, -18], chest: [0, 0, -10], head: [0, 0, 10], shL: [10, 0, 128], elL: [0, 0, 6], haL: [0, 0, -20], shR: [-10, 0, 52], elR: [0, 0, 6], haR: [0, 0, 20] },
};
const jawsShut: PoseDef = {
  x: 0.16,
  y: -0.1,
  j: { spine: [0, -4, -22], chest: [0, 0, -12], head: [0, 0, 10], shL: [10, 0, 96], elL: [0, 0, 4], haL: [0, 0, -10], shR: [-10, 0, 84], elR: [0, 0, 4], haR: [0, 0, 10] },
};
const grin: PoseDef = {
  j: { chest: [0, -10, 8], head: [0, -14, 12], neck: [0, -6, 6], shL: [40, 0, 24], elL: [0, 0, 50], shR: [-40, 0, 24], elR: [0, 0, 50] },
};

const moves: Record<string, Clip> = {
  bon_5L: new Clip(
    [
      { f: 1, p: {} },
      { f: 4, p: { j: { chest: [0, -8, -4], shL: [20, 0, 50], elL: [0, 0, 90] } } },
      { f: 7, p: longJab, e: 'snap' },
      { f: 10, p: longJab },
      { f: 19, p: {} },
    ],
    S,
  ),
  bon_2L: new Clip(
    [
      { f: 1, p: r.crouch },
      { f: 5, p: compose(r.crouch, { y: -0.18, j: { thL: [10, 16, 96], knL: [0, 0, -100] } }) },
      { f: 8, p: compose(r.crouch, { y: -0.3, j: { thL: [8, 10, 66], knL: [0, 0, -8], ftL: [0, 0, -4] } }), e: 'snap' },
      { f: 11, p: compose(r.crouch, { y: -0.3, j: { thL: [8, 10, 66], knL: [0, 0, -8], ftL: [0, 0, -4] } }) },
      { f: 21, p: r.crouch },
    ],
    S,
  ),
  // L·L·L finisher: stepping elbow (startup 10)
  bon_LLL: new Clip(
    [
      { f: 1, p: {} },
      { f: 6, p: { x: -0.03, j: { chest: [0, -34, 0], spine: [0, -14, 0], shR: [-30, 0, 60], elR: [0, 0, 140] } } },
      { f: 10, p: { x: 0.16, j: { hips: [0, 22, 0], spine: [0, 18, -12], chest: [0, 38, -10], shR: [-10, 10, 96], elR: [0, 0, 150], shL: [30, 0, 30], elL: [0, 0, 96], thL: [12, 14, 34], knL: [0, 0, -36] } }, e: 'snap' },
      { f: 13, p: { x: 0.16, j: { hips: [0, 22, 0], spine: [0, 18, -12], chest: [0, 38, -10], shR: [-10, 10, 96], elR: [0, 0, 150], shL: [30, 0, 30], elL: [0, 0, 96] } } },
      { f: 32, p: {} },
    ],
    S,
  ),
  // H·H finisher: huge haymaker (startup 12)
  bon_HH: new Clip(
    [
      { f: 1, p: straight },
      { f: 8, p: { x: -0.1, j: { chest: [0, -64, 4], spine: [0, -28, 0], shR: [-60, 0, 24], elR: [0, 0, 64], shL: [20, 0, 50], elL: [0, 0, 110] } } },
      { f: 12, p: { x: 0.26, j: { hips: [0, 32, 0], spine: [0, 30, -12], chest: [0, 52, -8], head: [0, -10, 8], shR: [-72, 0, 86], elR: [0, 0, 28], shL: [30, 0, 30], elL: [0, 0, 100], thL: [12, 14, 34], knL: [0, 0, -36], thR: [-12, 12, -32], knR: [0, 0, -8] } }, e: 'snap' },
      { f: 16, p: { x: 0.26, j: { hips: [0, 32, 0], spine: [0, 30, -12], chest: [0, 52, -8], shR: [-72, 0, 86], elR: [0, 0, 28], shL: [30, 0, 30], elL: [0, 0, 100] } } },
      { f: 39, p: {} },
    ],
    S,
  ),
  bon_5H: new Clip(
    [
      { f: 1, p: {} },
      { f: 9, p: { x: -0.06, j: { chest: [0, -50, 2], spine: [0, -20, 0], shR: [-40, 0, -10], elR: [0, 0, 110] } } },
      { f: 13, p: straight, e: 'snap' },
      { f: 17, p: straight },
      { f: 35, p: {} },
    ],
    S,
  ),
  bon_2H: new Clip(
    [
      { f: 1, p: r.crouch },
      { f: 7, p: compose(r.crouch, { y: -0.4, j: { chest: [0, -30, -10], shR: [-14, 0, -24], elR: [0, 0, 70] } }) },
      { f: 11, p: { y: 0.06, x: 0.1, j: { spine: [0, 16, 12], chest: [0, 24, 10], head: [0, -10, 12], shR: [-14, 0, 170], elR: [0, 0, 24], shL: [24, 0, 30], elL: [0, 0, 100], thR: [-10, 14, -20], knR: [0, 0, -2] } }, e: 'snap' },
      { f: 17, p: { y: 0.06, x: 0.1, j: { spine: [0, 16, 12], chest: [0, 24, 10], head: [0, -10, 12], shR: [-14, 0, 170], elR: [0, 0, 24], shL: [24, 0, 30], elL: [0, 0, 100], thR: [-10, 14, -20], knR: [0, 0, -2] } } },
      { f: 38, p: {} },
    ],
    S,
  ),
  bon_jL: new Clip(
    [
      { f: 1, p: r.airRise },
      { f: 6, p: compose(r.airRise, { j: { chest: [0, -40, -10], shL: [20, 0, 92], elL: [0, 0, 150] } }), e: 'snap' },
      { f: 12, p: compose(r.airRise, { j: { chest: [0, -40, -10], shL: [20, 0, 92], elL: [0, 0, 150] } }) },
      { f: 19, p: r.airFall },
    ],
    S,
  ),
  bon_jH: new Clip(
    [
      { f: 1, p: r.airRise },
      { f: 7, p: compose(r.airRise, { j: { spine: [0, 0, 14], shL: [20, 0, 168], elL: [0, 0, 30], shR: [-20, 0, 160], elR: [0, 0, 40] } }) },
      { f: 10, p: compose(r.airFall, { j: { spine: [0, 0, -34], chest: [0, 0, -14], shL: [20, 0, 40], elL: [0, 0, 10], shR: [-20, 0, 30], elR: [0, 0, 10], thL: [6, 10, 70], knL: [0, 0, -100] } }), e: 'snap' },
      { f: 16, p: compose(r.airFall, { j: { spine: [0, 0, -34], chest: [0, 0, -14], shL: [20, 0, 40], elL: [0, 0, 10], shR: [-20, 0, 30], elR: [0, 0, 10], thL: [6, 10, 70], knL: [0, 0, -100] } }) },
      { f: 25, p: r.airFall },
    ],
    S,
  ),
  bon_throw: new Clip(
    [
      { f: 1, p: {} },
      { f: 6, p: { x: 0.1, j: { spine: [0, 0, -16], chest: [0, 0, -8], shL: [40, 0, 82], elL: [0, 0, 50], shR: [-40, 0, 82], elR: [0, 0, 50] } }, e: 'snap' },
      { f: 10, p: { x: 0.1, j: { spine: [0, 0, -16], chest: [0, 0, -8], shL: [40, 0, 82], elL: [0, 0, 50], shR: [-40, 0, 82], elR: [0, 0, 50] } } },
      { f: 29, p: {} },
    ],
    S,
  ),
  bon_croc: new Clip(
    [
      { f: 1, p: {} },
      { f: 8, p: jawsOpen },
      { f: 19, p: compose(jawsOpen, { j: { shL: [10, 0, 140], shR: [-10, 0, 44] } }) },
      { f: 20, p: jawsShut, e: 'snap' },
      { f: 26, p: jawsShut },
      { f: 40, p: compose(jawsShut, { x: 0.05 }) },
      { f: 52, p: {} },
    ],
    S,
  ),
  bon_smoke: new Clip(
    [
      { f: 1, p: {} },
      { f: 6, p: { j: { spine: [0, 0, 10], chest: [0, -10, 12], head: [0, 0, 18], shR: [-20, 0, 70], elR: [0, 0, 120] } } },
      { f: 10, p: { x: 0.06, j: { spine: [0, 0, -12], chest: [0, -10, -10], head: [0, 0, -6], shR: [-30, 0, 60], elR: [0, 0, 40], shL: [30, 0, 60], elL: [0, 0, 30] } }, e: 'snap' },
      { f: 18, p: { x: 0.06, j: { spine: [0, 0, -12], chest: [0, -10, -10], head: [0, 0, -6], shR: [-30, 0, 60], elR: [0, 0, 40], shL: [30, 0, 60], elL: [0, 0, 30] } } },
      { f: 34, p: {} },
    ],
    S,
  ),
  bon_abriss: new Clip(
    [
      { f: 1, p: {} },
      { f: 14, p: { x: -0.1, y: -0.06, j: { chest: [0, -64, 4], spine: [0, -24, 4], head: [0, 30, 4], shR: [-50, 0, -30], elR: [0, 0, 110], shL: [30, 0, 70], elL: [0, 0, 70] } } },
      { f: 18, p: compose(straight, { x: 0.3, j: { spine: [0, 24, -20] } }), e: 'snap' },
      { f: 23, p: compose(straight, { x: 0.3, j: { spine: [0, 24, -20] } }) },
      { f: 44, p: {} },
    ],
    S,
  ),
  bon_grin: new Clip(
    [
      { f: 1, p: {} },
      { f: 12, p: grin },
      { f: 24, p: compose(grin, { j: { chest: [0, -10, 4], shL: [40, 0, 30], shR: [-40, 0, 30] } }) },
      { f: 36, p: compose(grin, { y: 0.03, j: { shL: [60, 0, 40], elL: [0, 0, 30], shR: [-60, 0, 40], elR: [0, 0, 30] } }) },
      { f: 50, p: grin },
      { f: 64, p: {} },
    ],
    S,
  ),
  bon_palm: new Clip(
    [
      { f: 1, p: { y: 0.03, j: { spine: [0, 0, 10], shR: [-10, 0, 176], elR: [0, 0, 28], shL: [30, 0, 60], elL: [0, 0, 60] } } },
      { f: 14, p: { y: -0.45, x: 0.08, j: { spine: [0, 0, -50], chest: [0, 0, -16], shR: [-10, 0, 62], elR: [0, 0, 4], shL: [30, 0, 40], elL: [0, 0, 40], thL: [12, 14, 80], knL: [0, 0, -110], thR: [-12, 12, 20], knR: [0, 0, -100] } }, e: 'snap' },
      { f: 20, p: { y: -0.45, x: 0.08, j: { spine: [0, 0, -50], chest: [0, 0, -16], shR: [-10, 0, 62], elR: [0, 0, 4], shL: [30, 0, 40], elL: [0, 0, 40], thL: [12, 14, 80], knL: [0, 0, -110], thR: [-12, 12, 20], knR: [0, 0, -100] } } },
      { f: 40, p: r.crouch },
      { f: 64, p: {} },
    ],
    S,
  ),
};

const walkA = compose(S, { j: { thL: [12, 14, 32], knL: [0, 0, -26], thR: [-12, 12, -28], knR: [0, 0, -14] }, y: -0.06 });
const walkB = compose(S, { j: { thL: [12, 14, 8], knL: [0, 0, -40], thR: [-12, 12, -6], knR: [0, 0, -36] }, y: -0.09 });

export const BONEZ_ANIMS: AnimSet = {
  id: 'bonez',
  pivot: 0.88,
  stance: S,
  r,
  walkF: [walkA, walkB],
  walkB: [walkB, walkA],
  idleBounce: 0.008,
  intro: new Clip(
    [
      { f: 0, p: { j: { chest: [0, -10, 4], shL: [30, 0, 10], elL: [0, 0, 20], shR: [-30, 0, 10], elR: [0, 0, 20] } } },
      { f: 20, p: { y: 0.03, j: { chest: [0, -10, 8], shL: [40, 0, 24], elL: [0, 0, 30], shR: [-40, 0, 4], elR: [0, 0, 20] } } },
      { f: 40, p: { j: { chest: [0, -10, 4], shL: [40, 0, 4], elL: [0, 0, 20], shR: [-40, 0, 24], elR: [0, 0, 30] } } },
      { f: 60, p: grin },
      { f: 95, p: grin },
      { f: 120, p: {} },
    ],
    S,
  ),
  win: new Clip(
    [
      { f: 0, p: {} },
      { f: 24, p: { j: { chest: [0, -6, 6], shL: [10, 0, 66], elL: [0, 0, 112], shR: [-10, 0, 66], elR: [0, 0, 112], head: [0, -14, 10] } } },
      { f: 60, p: { j: { chest: [0, -6, 6], shL: [10, 0, 66], elL: [0, 0, 112], shR: [-10, 0, 66], elR: [0, 0, 112], head: [0, -20, 4] } } },
    ],
    S,
  ),
  superFlash: new Clip(
    [
      { f: 0, p: {} },
      { f: 10, p: compose(grin, { y: 0.03, j: { shR: [-10, 0, 176], elR: [0, 0, 28] } }) },
      { f: 26, p: compose(grin, { y: 0.03, j: { shR: [-10, 0, 178], elR: [0, 0, 24] } }) },
      { f: 36, p: { y: 0.03, j: { spine: [0, 0, 10], shR: [-10, 0, 176], elR: [0, 0, 28], shL: [30, 0, 60], elL: [0, 0, 60] } } },
    ],
    S,
  ),
  wakeup: new Clip(
    [
      { f: 0, p: r.lying },
      { f: 7, p: compose(r.crouch, { y: -0.42 }) },
      { f: 14, p: {} },
    ],
    S,
  ),
  moves,
  throwAtk: {
    bon_throw: new Clip(
      [
        { f: 0, p: { x: 0.1, j: { shL: [40, 0, 82], elL: [0, 0, 50], shR: [-40, 0, 82], elR: [0, 0, 50] } } },
        { f: 14, p: { y: -0.08, j: { spine: [0, 0, -20], chest: [0, -20, -10], shL: [40, 0, 150], elL: [0, 0, 60], shR: [-40, 0, 150], elR: [0, 0, 60] } } },
        { f: 26, p: { y: 0.02, j: { spine: [0, 0, 8], chest: [0, -10, 6], shL: [40, 0, 170], elL: [0, 0, 40], shR: [-40, 0, 170], elR: [0, 0, 40] } } },
        { f: 34, p: { y: -0.2, x: 0.15, j: { spine: [0, 0, -40], chest: [0, 0, -16], shL: [40, 0, 70], elL: [0, 0, 10], shR: [-40, 0, 70], elR: [0, 0, 10] } }, e: 'snap' },
        { f: 42, p: { y: -0.2, x: 0.15, j: { spine: [0, 0, -40], chest: [0, 0, -16], shL: [40, 0, 70], elL: [0, 0, 10], shR: [-40, 0, 70], elR: [0, 0, 10] } } },
        { f: 50, p: {} },
      ],
      S,
    ),
  },
  throwDef: {
    bon_throw: new Clip(
      [
        { f: 0, p: r.hitGut },
        { f: 14, p: compose(r.juggle, { x: 0.4, y: 1.0, rot: 70 }) },
        { f: 26, p: compose(r.juggle, { x: 0.53, y: 1.5, rot: 95 }) },
        { f: 34, p: compose(r.lying, { x: -0.3, y: -(0.76 - 0.2) }), e: 'snap' },
        { f: 50, p: compose(r.lying, { x: -(1.8 - 0.53) + 0.05 }) },
      ],
      S,
    ),
  },
};

/** Key poses reused by the Palmen-Bassdrop cinematic. */
export const BONEZ_POSES = { longJab, straight, jawsOpen, jawsShut, grin };
