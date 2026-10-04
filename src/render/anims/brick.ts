// BRICK animation set. Clip frames are move frames (1-based) matching src/content/brick.ts.
import { Clip, compose, type PoseDef } from '../pose';
import { BRICK_STANCE, reactions } from './stances';
import type { AnimSet } from './types';

const S = BRICK_STANCE;
const pivot = 0.98;
const r = reactions(S, pivot);

const palm: PoseDef = {
  x: 0.08,
  j: { spine: [0, -12, -10], chest: [0, -36, -8], shL: [6, -4, 88], elL: [0, 0, 6], haL: [0, 0, -40], shR: [-26, 0, 26], elR: [0, 0, 108] },
};
const haymaker: PoseDef = {
  x: 0.2,
  j: {
    hips: [0, 14, 0],
    spine: [0, 20, -14],
    chest: [0, 34, -10],
    head: [0, -14, 8],
    shR: [-48, 10, 88],
    elR: [0, 0, 24],
    shL: [30, 0, 30],
    elL: [0, 0, 100],
    thL: [10, 16, 32],
    knL: [0, 0, -34],
    thR: [-10, 14, -30],
    knR: [0, 0, -8],
    ftR: [0, 0, 30],
  },
};
const hug: PoseDef = {
  x: 0.12,
  j: { spine: [0, 0, -16], chest: [0, 0, -8], shL: [50, 0, 82], elL: [0, 0, 50], shR: [-50, 0, 82], elR: [0, 0, 50] },
};
const charge: PoseDef = {
  x: 0.1,
  y: -0.08,
  j: {
    hips: [0, -30, 0],
    spine: [0, -20, -34],
    chest: [0, -40, -10],
    head: [0, 40, 14],
    shL: [10, 0, 30],
    elL: [0, 0, 120],
    shR: [-20, 0, 50],
    elR: [0, 0, 130],
    thL: [10, 16, 50],
    knL: [0, 0, -50],
    thR: [-10, 14, -36],
    knR: [0, 0, -20],
  },
};

const moves: Record<string, Clip> = {
  brick_5L: new Clip(
    [
      { f: 1, p: {} },
      { f: 4, p: { j: { chest: [0, -6, -4], shL: [20, 0, 50], elL: [0, 0, 100] } } },
      { f: 6, p: palm, e: 'snap' },
      { f: 9, p: palm },
      { f: 18, p: {} },
    ],
    S,
  ),
  brick_2L: new Clip(
    [
      { f: 1, p: r.crouch },
      { f: 5, p: compose(r.crouch, { y: -0.2, j: { thL: [10, 16, 96], knL: [0, 0, -100] } }) },
      { f: 7, p: compose(r.crouch, { y: -0.32, j: { thL: [8, 10, 64], knL: [0, 0, -10], ftL: [0, 0, -4] } }), e: 'snap' },
      { f: 10, p: compose(r.crouch, { y: -0.32, j: { thL: [8, 10, 64], knL: [0, 0, -10], ftL: [0, 0, -4] } }) },
      { f: 20, p: r.crouch },
    ],
    S,
  ),
  brick_5H: new Clip(
    [
      { f: 1, p: {} },
      { f: 8, p: { x: -0.06, j: { chest: [0, -52, 2], spine: [0, -20, 0], shR: [-60, 0, -10], elR: [0, 0, 100] } } },
      { f: 12, p: haymaker, e: 'snap' },
      { f: 16, p: haymaker },
      { f: 35, p: {} },
    ],
    S,
  ),
  brick_2H: new Clip(
    [
      { f: 1, p: r.crouch },
      { f: 7, p: compose(r.crouch, { y: -0.45, j: { chest: [0, -30, -10], shR: [-14, 0, -24], elR: [0, 0, 70] } }) },
      { f: 11, p: { y: 0.08, x: 0.1, j: { spine: [0, 16, 12], chest: [0, 24, 10], head: [0, -10, 12], shR: [-14, 0, 170], elR: [0, 0, 24], shL: [24, 0, 30], elL: [0, 0, 100], thR: [-10, 14, -20], knR: [0, 0, -2] } }, e: 'snap' },
      { f: 17, p: { y: 0.08, x: 0.1, j: { spine: [0, 16, 12], chest: [0, 24, 10], head: [0, -10, 12], shR: [-14, 0, 170], elR: [0, 0, 24], shL: [24, 0, 30], elL: [0, 0, 100], thR: [-10, 14, -20], knR: [0, 0, -2] } } },
      { f: 39, p: {} },
    ],
    S,
  ),
  brick_6H: new Clip(
    [
      { f: 1, p: {} },
      { f: 10, p: { x: -0.04, j: { spine: [0, 0, 14], chest: [0, 10, 10], shR: [-14, 0, 178], elR: [0, 0, 120], shL: [30, 0, 60], elL: [0, 0, 90] } } },
      { f: 18, p: { y: 0.04, j: { spine: [0, 0, 18], chest: [0, 10, 14], shR: [-14, 0, 182], elR: [0, 0, 128], shL: [30, 0, 60], elL: [0, 0, 90] } } },
      { f: 21, p: { y: -0.16, x: 0.18, j: { spine: [0, 10, -40], chest: [0, 20, -18], shR: [-14, 0, 64], elR: [0, 0, 140], shL: [30, 0, 20], elL: [0, 0, 60], thL: [10, 16, 50], knL: [0, 0, -70] } }, e: 'snap' },
      { f: 26, p: { y: -0.16, x: 0.18, j: { spine: [0, 10, -40], chest: [0, 20, -18], shR: [-14, 0, 64], elR: [0, 0, 140], shL: [30, 0, 20], elL: [0, 0, 60], thL: [10, 16, 50], knL: [0, 0, -70] } } },
      { f: 40, p: {} },
    ],
    S,
  ),
  brick_jL: new Clip(
    [
      { f: 1, p: r.airRise },
      { f: 6, p: compose(r.airRise, { j: { chest: [0, -40, -10], shL: [20, 0, 92], elL: [0, 0, 150] } }), e: 'snap' },
      { f: 12, p: compose(r.airRise, { j: { chest: [0, -40, -10], shL: [20, 0, 92], elL: [0, 0, 150] } }) },
      { f: 19, p: r.airFall },
    ],
    S,
  ),
  brick_jH: new Clip(
    [
      { f: 1, p: r.airRise },
      { f: 7, p: compose(r.airRise, { rot: 10, j: { shL: [40, 0, 150], shR: [-40, 0, 150] } }) },
      { f: 10, p: { rot: -55, j: { spine: [0, 0, -10], shL: [70, 0, 90], elL: [0, 0, 20], shR: [-70, 0, 90], elR: [0, 0, 20], thL: [10, 0, -10], knL: [0, 0, -20], thR: [-10, 0, -10], knR: [0, 0, -20] } }, e: 'snap' },
      { f: 16, p: { rot: -55, j: { spine: [0, 0, -10], shL: [70, 0, 90], elL: [0, 0, 20], shR: [-70, 0, 90], elR: [0, 0, 20], thL: [10, 0, -10], knL: [0, 0, -20], thR: [-10, 0, -10], knR: [0, 0, -20] } } },
      { f: 25, p: r.airFall },
    ],
    S,
  ),
  brick_throw: new Clip(
    [
      { f: 1, p: {} },
      { f: 6, p: hug, e: 'snap' },
      { f: 10, p: hug },
      { f: 29, p: {} },
    ],
    S,
  ),
  brick_sub: new Clip(
    [
      { f: 1, p: {} },
      { f: 10, p: { y: 0.04, j: { spine: [0, 0, 12], chest: [0, 10, 10], shR: [-20, 0, 176], elR: [0, 0, 20], shL: [30, 0, 140], elL: [0, 0, 30] } } },
      { f: 18, p: { y: -0.38, x: 0.1, j: { spine: [0, 0, -48], chest: [0, 0, -16], shR: [-20, 0, 80], elR: [0, 0, 20], shL: [30, 0, 70], elL: [0, 0, 20], thL: [10, 16, 70], knL: [0, 0, -100], thR: [-10, 14, 10], knR: [0, 0, -90] } }, e: 'snap' },
      { f: 26, p: { y: -0.38, x: 0.1, j: { spine: [0, 0, -48], chest: [0, 0, -16], shR: [-20, 0, 80], elR: [0, 0, 20], shL: [30, 0, 70], elL: [0, 0, 20], thL: [10, 16, 70], knL: [0, 0, -100], thR: [-10, 14, 10], knR: [0, 0, -90] } } },
      { f: 46, p: {} },
    ],
    S,
  ),
  brick_dozer: new Clip(
    [
      { f: 1, p: {} },
      { f: 5, p: charge, e: 'snap' },
      { f: 12, p: compose(charge, { j: { thL: [10, 16, 20], knL: [0, 0, -60], thR: [-10, 14, 0], knR: [0, 0, -60] } }) },
      { f: 18, p: charge },
      { f: 24, p: charge },
      { f: 46, p: {} },
    ],
    S,
  ),
  brick_cmd: new Clip(
    [
      { f: 1, p: {} },
      { f: 8, p: hug, e: 'snap' },
      { f: 12, p: hug },
      { f: 40, p: {} },
    ],
    S,
  ),
  brick_drop: new Clip(
    [
      { f: 1, p: {} },
      { f: 6, p: { y: 0.1, j: { spine: [0, 0, 10], thL: [0, 0, 100], knL: [0, 0, -90], shL: [40, 0, 150], elL: [0, 0, 30], shR: [-40, 0, 150], elR: [0, 0, 30] } } },
      { f: 10, p: { y: -0.22, j: { spine: [0, 0, -20], thL: [0, 0, 24], knL: [0, 0, -30], shL: [40, 0, 40], elL: [0, 0, 20], shR: [-40, 0, 40], elR: [0, 0, 20] } }, e: 'snap' },
      { f: 16, p: { y: -0.22, j: { spine: [0, 0, -20], thL: [0, 0, 24], knL: [0, 0, -30], shL: [40, 0, 40], elL: [0, 0, 20], shR: [-40, 0, 40], elR: [0, 0, 20] } } },
      { f: 44, p: {} },
    ],
    S,
  ),
  brick_lariat: new Clip(
    [
      { f: 1, p: {} },
      { f: 6, p: { yaw: 0, j: { shL: [85, 0, 10], elL: [0, 0, 10], shR: [-85, 0, 10], elR: [0, 0, 10], spine: [0, 0, -6] } } },
      { f: 17, p: { yaw: -360, j: { shL: [85, 0, 10], elL: [0, 0, 10], shR: [-85, 0, 10], elR: [0, 0, 10], spine: [0, 0, -6] } }, e: 'linear' },
      { f: 28, p: { yaw: -720, j: { shL: [85, 0, 10], elL: [0, 0, 10], shR: [-85, 0, 10], elR: [0, 0, 10], spine: [0, 0, -6] } }, e: 'linear' },
      { f: 29, p: { yaw: 0, j: { shL: [80, 0, 30], elL: [0, 0, 30], shR: [-80, 0, 30], elR: [0, 0, 30] } }, e: 'snap' },
      { f: 50, p: {} },
    ],
    S,
  ),
  brick_security: new Clip(
    [
      { f: 1, p: { y: -0.15, j: { chest: [0, -20, -10], shL: [40, 0, 40], shR: [-40, 0, 40], elL: [0, 0, 80], elR: [0, 0, 80] } } },
      { f: 9, p: compose(hug, { x: 0.2 }), e: 'snap' },
      { f: 14, p: compose(hug, { x: 0.2 }) },
      { f: 62, p: {} },
    ],
    S,
  ),
};

const walkA = compose(S, { j: { thL: [10, 16, 30], knL: [0, 0, -22], thR: [-10, 14, -26], knR: [0, 0, -12] }, y: -0.04 });
const walkB = compose(S, { j: { thL: [10, 16, 6], knL: [0, 0, -36], thR: [-10, 14, -6], knR: [0, 0, -32] }, y: -0.07 });

export const BRICK_ANIMS: AnimSet = {
  id: 'brick',
  pivot: 0.98,
  stance: S,
  r,
  walkF: [walkA, walkB],
  walkB: [walkB, walkA],
  intro: new Clip(
    [
      { f: 0, p: { j: { chest: [0, 0, 4], shL: [10, 0, 60], elL: [0, 0, 100], shR: [-10, 0, 60], elR: [0, 0, 100], head: [0, 0, 10] } } },
      { f: 60, p: { j: { chest: [0, 0, 6], shL: [10, 0, 64], elL: [0, 0, 104], shR: [-10, 0, 64], elR: [0, 0, 104], head: [0, 20, -6] } } },
      { f: 90, p: { j: { chest: [0, 0, 6], shL: [10, 0, 64], elL: [0, 0, 104], shR: [-10, 0, 64], elR: [0, 0, 104], head: [0, 20, 4] } } },
      { f: 120, p: {} },
    ],
    S,
  ),
  win: new Clip(
    [
      { f: 0, p: {} },
      { f: 24, p: { j: { chest: [0, 0, 6], shL: [10, 0, 66], elL: [0, 0, 108], shR: [-10, 0, 66], elR: [0, 0, 108], head: [0, 10, 8] } } },
      { f: 60, p: { j: { chest: [0, 0, 6], shL: [10, 0, 66], elL: [0, 0, 108], shR: [-10, 0, 66], elR: [0, 0, 108], head: [0, 10, -4] } } },
    ],
    S,
  ),
  superFlash: new Clip(
    [
      { f: 0, p: {} },
      { f: 10, p: { y: 0.03, j: { chest: [0, 0, 10], head: [0, 0, 16], shL: [40, 0, 150], elL: [0, 0, 60], shR: [-40, 0, 150], elR: [0, 0, 60] } } },
      { f: 26, p: { y: 0.03, j: { chest: [0, 0, 12], head: [0, 0, 18], shL: [40, 0, 154], elL: [0, 0, 56], shR: [-40, 0, 154], elR: [0, 0, 56] } } },
      { f: 36, p: { y: -0.15, j: { chest: [0, -20, -10], shL: [40, 0, 40], shR: [-40, 0, 40], elL: [0, 0, 80], elR: [0, 0, 80] } } },
    ],
    S,
  ),
  wakeup: new Clip(
    [
      { f: 0, p: r.lying },
      { f: 7, p: compose(r.crouch, { y: -0.45 }) },
      { f: 14, p: {} },
    ],
    S,
  ),
  moves,
  throwAtk: {
    brick_throw: new Clip(
      [
        { f: 0, p: hug },
        { f: 14, p: { y: 0.05, j: { spine: [0, 0, 16], chest: [0, 0, 10], shL: [40, 0, 176], elL: [0, 0, 20], shR: [-40, 0, 176], elR: [0, 0, 20] } } },
        { f: 34, p: { y: -0.2, x: 0.15, j: { spine: [0, 0, -40], chest: [0, 0, -16], shL: [40, 0, 70], elL: [0, 0, 10], shR: [-40, 0, 70], elR: [0, 0, 10] } }, e: 'snap' },
        { f: 42, p: { y: -0.2, x: 0.15, j: { spine: [0, 0, -40], chest: [0, 0, -16], shL: [40, 0, 70], elL: [0, 0, 10], shR: [-40, 0, 70], elR: [0, 0, 10] } } },
        { f: 50, p: {} },
      ],
      S,
    ),
    brick_cmd: new Clip(
      [
        { f: 0, p: hug },
        { f: 8, p: compose(hug, { j: { shL: [30, 0, 60], shR: [-30, 0, 70] } }) },
        { f: 14, p: compose(hug, { j: { shL: [30, 0, 40], shR: [-30, 0, 50] } }) },
        { f: 22, p: compose(hug, { j: { shL: [30, 0, 60], shR: [-30, 0, 40] } }) },
        { f: 30, p: { y: 0.05, j: { spine: [0, 0, 16], chest: [0, 0, 10], shL: [40, 0, 176], elL: [0, 0, 20], shR: [-40, 0, 176], elR: [0, 0, 20] } } },
        { f: 40, p: { y: -0.3, x: 0.15, j: { spine: [0, 0, -44], chest: [0, 0, -16], shL: [40, 0, 66], elL: [0, 0, 10], shR: [-40, 0, 66], elR: [0, 0, 10], thL: [10, 16, 60], knL: [0, 0, -80] } }, e: 'snap' },
        { f: 48, p: { y: -0.3, x: 0.15, j: { spine: [0, 0, -44], chest: [0, 0, -16], shL: [40, 0, 66], elL: [0, 0, 10], shR: [-40, 0, 66], elR: [0, 0, 10] } } },
        { f: 56, p: {} },
      ],
      S,
    ),
  },
  throwDef: {
    brick_throw: new Clip(
      [
        { f: 0, p: r.hitGut },
        { f: 14, p: compose(r.juggle, { x: 0.56, y: 1.5, rot: 90 }) },
        { f: 30, p: compose(r.juggle, { x: 0.3, y: 1.6, rot: 100 }) },
        { f: 34, p: compose(r.lying, { x: -0.3, y: -(pivot - 0.2) }) , e: 'snap' },
        { f: 50, p: compose(r.lying, { x: -(1.8 - 0.62) + 0.05 }) },
      ],
      S,
    ),
    brick_cmd: new Clip(
      [
        { f: 0, p: r.hitGut },
        { f: 8, p: compose(r.hitHigh, { j: { shL: [80, 0, 10], shR: [-80, 0, 10] } }) },
        { f: 22, p: compose(r.hitHigh, { j: { shL: [80, 0, 30], shR: [-80, 0, 30] } }) },
        { f: 30, p: compose(r.juggle, { x: 0.56, y: 1.6, rot: 90 }) },
        { f: 40, p: compose(r.lying, { x: -0.2, y: -(pivot - 0.2) }), e: 'snap' },
        { f: 56, p: compose(r.lying, { x: -(1.6 - 0.62) + 0.05 }) },
      ],
      S,
    ),
  },
};
