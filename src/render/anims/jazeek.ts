// JAZEEK animation set — loose, confident, rhythmic. Frames match src/content/jazeek.ts.
import { Clip, compose, type PoseDef } from '../pose';
import { reactions } from './stances';
import type { AnimSet } from './types';

export const JAZEEK_STANCE: PoseDef = {
  y: -0.03,
  j: {
    hips: [0, -22, 0],
    spine: [0, -6, -4],
    chest: [0, -14, -2],
    neck: [0, 2, 2],
    head: [0, 0, 4],
    shL: [14, 0, 46],
    elL: [0, 0, 98],
    haL: [0, 0, 8],
    shR: [-16, 0, 24],
    elR: [0, 0, 120],
    haR: [0, 0, 0],
    thL: [6, 20, 24],
    knL: [0, 0, -30],
    ftL: [0, 0, 6],
    thR: [-8, 18, -16],
    knR: [0, 0, -18],
    ftR: [0, 0, 22],
  },
};

const S = JAZEEK_STANCE;
const pivot = 0.76;
const r = reactions(S, pivot);

const jab: PoseDef = {
  x: 0.07,
  j: { spine: [0, -14, -9], chest: [0, -40, -6], shL: [2, -4, 90], elL: [0, 0, 4], haL: [0, 0, -4], shR: [-14, 0, 34], elR: [0, 0, 130] },
};
const cross: PoseDef = {
  x: 0.16,
  j: {
    hips: [0, 8, 0],
    spine: [0, 14, -14],
    chest: [0, 28, -10],
    shR: [-2, 10, 92],
    elR: [0, 0, 3],
    shL: [24, 0, 36],
    elL: [0, 0, 124],
    thL: [6, 20, 34],
    knL: [0, 0, -36],
    thR: [-8, 18, -30],
    knR: [0, 0, -6],
    ftR: [0, 0, 30],
  },
};
const backhand: PoseDef = {
  x: 0.15,
  j: { hips: [0, -40, 0], spine: [0, -20, -10], chest: [0, -52, -8], shL: [24, -10, 92], elL: [0, 0, 8], haL: [0, 0, -20], shR: [-20, 0, 40], elR: [0, 0, 120] },
};
const hookR: PoseDef = {
  x: 0.12,
  j: { spine: [0, 18, -12], chest: [0, 34, -6], shR: [-70, 0, 70], elR: [0, 0, 80], shL: [20, 0, 40], elL: [0, 0, 130] },
};
const hookL: PoseDef = {
  x: 0.12,
  j: { spine: [0, -24, -12], chest: [0, -40, -6], shL: [70, 0, 75], elL: [0, 0, 80], shR: [-14, 0, 34], elR: [0, 0, 135] },
};
const kickHigh: PoseDef = {
  x: 0.06,
  j: { hips: [0, 30, 10], spine: [0, 10, 14], chest: [0, 10, 8], thR: [-6, 10, 100], knR: [0, 0, -6], ftR: [0, 0, -10], thL: [6, 20, -6], knL: [0, 0, -14], shL: [40, 0, 40], elL: [0, 0, 90], shR: [-40, 0, 20], elR: [0, 0, 90] },
};
const sing: PoseDef = {
  y: 0.02,
  j: {
    spine: [0, -6, 8],
    chest: [0, -24, 10],
    neck: [0, -6, 10],
    head: [0, -6, 14],
    shR: [-26, 0, 40],
    elR: [0, 0, 138],
    shL: [24, 0, 96],
    elL: [0, 0, 12],
    haL: [0, 0, -50],
  },
};

const moves: Record<string, Clip> = {
  jaz_5L: new Clip(
    [
      { f: 1, p: {} },
      { f: 3, p: { j: { chest: [0, -12, -4], shL: [14, 0, 56], elL: [0, 0, 118] } } },
      { f: 5, p: jab, e: 'snap' },
      { f: 7, p: jab },
      { f: 14, p: {} },
    ],
    S,
  ),
  jaz_2L: new Clip(
    [
      { f: 1, p: r.crouch },
      { f: 4, p: compose(r.crouch, { j: { thL: [8, 20, 66], knL: [0, 0, -118] } }) },
      { f: 6, p: compose(r.crouch, { y: -0.26, j: { spine: [0, -6, 4], thL: [4, 14, 78], knL: [0, 0, -6], ftL: [0, 0, -18] } }), e: 'snap' },
      { f: 9, p: compose(r.crouch, { y: -0.26, j: { spine: [0, -6, 4], thL: [4, 14, 78], knL: [0, 0, -6], ftL: [0, 0, -18] } }) },
      { f: 16, p: r.crouch },
    ],
    S,
  ),
  jaz_5H: new Clip(
    [
      { f: 1, p: {} },
      { f: 5, p: { x: -0.03, j: { chest: [0, 24, -4], spine: [0, 10, -2], shL: [30, 0, 26], elL: [0, 0, 126] } } },
      { f: 9, p: backhand, e: 'snap' },
      { f: 13, p: backhand },
      { f: 27, p: {} },
    ],
    S,
  ),
  jaz_2H: new Clip(
    [
      { f: 1, p: r.crouch },
      { f: 6, p: compose(r.crouch, { y: -0.4, j: { hips: [0, -50, 0], chest: [0, -30, -20], shL: [30, 0, 70], elL: [0, 0, 20], shR: [-30, 0, 70], elR: [0, 0, 20] } }) },
      {
        f: 10,
        p: compose(r.crouch, {
          y: -0.42,
          x: 0.05,
          j: { hips: [0, 60, 0], spine: [0, 10, -30], chest: [0, 10, -14], thR: [-14, 10, 90], knR: [0, 0, -2], ftR: [0, 0, -10], thL: [8, 20, 70], knL: [0, 0, -130], shL: [30, 0, 100], elL: [0, 0, 10], shR: [-30, 0, 96], elR: [0, 0, 10] },
        }),
        e: 'snap',
      },
      { f: 15, p: compose(r.crouch, { y: -0.42, x: 0.05, j: { hips: [0, 60, 0], spine: [0, 10, -30], thR: [-14, 10, 90], knR: [0, 0, -2], thL: [8, 20, 70], knL: [0, 0, -130], shL: [30, 0, 100], shR: [-30, 0, 96] } }) },
      { f: 33, p: r.crouch },
    ],
    S,
  ),
  jaz_jL: new Clip(
    [
      { f: 1, p: r.airRise },
      { f: 4, p: compose(r.airRise, { j: { thR: [-6, 10, 104], knR: [0, 0, -150], thL: [6, 10, 10], knL: [0, 0, -70], shL: [20, 0, 60], elL: [0, 0, 120] } }), e: 'snap' },
      { f: 11, p: compose(r.airRise, { j: { thR: [-6, 10, 104], knR: [0, 0, -150], thL: [6, 10, 10], knL: [0, 0, -70], shL: [20, 0, 60], elL: [0, 0, 120] } }) },
      { f: 17, p: r.airFall },
    ],
    S,
  ),
  jaz_jH: new Clip(
    [
      { f: 1, p: r.airRise },
      { f: 4, p: compose(r.airRise, { yaw: 30, j: { thR: [-6, 10, 80], knR: [0, 0, -120] } }) },
      { f: 7, p: compose(r.airFall, { yaw: -30, rot: 10, j: { thR: [-6, 10, 92], knR: [0, 0, -4], ftR: [0, 0, -10], thL: [6, 10, 30], knL: [0, 0, -90], shL: [50, 0, 60], shR: [-50, 0, 40] } }), e: 'snap' },
      { f: 12, p: compose(r.airFall, { yaw: -30, rot: 10, j: { thR: [-6, 10, 92], knR: [0, 0, -4], thL: [6, 10, 30], knL: [0, 0, -90], shL: [50, 0, 60], shR: [-50, 0, 40] } }) },
      { f: 21, p: r.airFall },
    ],
    S,
  ),
  jaz_throw: new Clip(
    [
      { f: 1, p: {} },
      { f: 5, p: { x: 0.08, j: { spine: [0, 0, -14], shL: [24, 0, 84], elL: [0, 0, 24], shR: [-24, 0, 80], elR: [0, 0, 24] } }, e: 'snap' },
      { f: 9, p: { x: 0.08, j: { spine: [0, 0, -14], shL: [24, 0, 84], elL: [0, 0, 24], shR: [-24, 0, 80], elR: [0, 0, 24] } } },
      { f: 26, p: {} },
    ],
    S,
  ),
  jaz_wave: new Clip(
    [
      { f: 1, p: {} },
      { f: 7, p: { y: -0.03, j: { chest: [0, -10, 12], head: [0, 0, 16], shR: [-20, 0, 62], elR: [0, 0, 130], shL: [20, 0, 60], elL: [0, 0, 100] } } },
      { f: 12, p: sing, e: 'snap' },
      { f: 22, p: sing },
      { f: 38, p: {} },
    ],
    S,
  ),
  jaz_spot: new Clip(
    [
      { f: 1, p: r.jumpSquat },
      { f: 3, p: { x: 0.05, y: -0.12, j: { spine: [0, -6, -34], chest: [0, -10, -12], head: [0, 0, 20], shL: [30, 0, -60], elL: [0, 0, 20], shR: [-30, 0, -70], elR: [0, 0, 20], thL: [6, 20, 60], knL: [0, 0, -60], thR: [-8, 18, -40], knR: [0, 0, -30] } }, e: 'snap' },
      { f: 16, p: { x: 0.05, y: -0.12, j: { spine: [0, -6, -34], chest: [0, -10, -12], head: [0, 0, 20], shL: [30, 0, -60], elL: [0, 0, 20], shR: [-30, 0, -70], elR: [0, 0, 20], thL: [6, 20, 60], knL: [0, 0, -60], thR: [-8, 18, -40], knR: [0, 0, -30] } } },
      { f: 22, p: r.land },
      { f: 30, p: {} },
    ],
    S,
  ),
  jaz_counter: new Clip(
    [
      { f: 1, p: {} },
      { f: 3, p: { x: -0.08, j: { spine: [0, -10, 16], chest: [0, -30, 10], head: [0, 10, 12], shL: [30, 0, 10], elL: [0, 0, 60], shR: [-30, 0, 4], elR: [0, 0, 70] } }, e: 'snap' },
      { f: 10, p: { x: -0.02, y: -0.06, j: { spine: [0, -4, 6], chest: [0, -10, 4], head: [0, 0, 6], shL: [30, 0, 14], elL: [0, 0, 70], shR: [-30, 0, 8], elR: [0, 0, 80] } } },
      { f: 18, p: { x: -0.08, j: { spine: [0, -10, 16], chest: [0, -30, 10], head: [0, 10, 12], shL: [30, 0, 10], elL: [0, 0, 60], shR: [-30, 0, 4], elR: [0, 0, 70] } } },
      { f: 40, p: {} },
    ],
    S,
  ),
  jaz_counter_fu: new Clip(
    [
      { f: 1, p: { x: -0.12, j: { spine: [0, -20, 20], chest: [0, -40, 12] } } },
      { f: 4, p: jab, e: 'snap' },
      { f: 7, p: {} },
      { f: 10, p: cross, e: 'snap' },
      { f: 14, p: {} },
      { f: 18, p: kickHigh, e: 'snap' },
      { f: 24, p: kickHigh },
      { f: 40, p: {} },
    ],
    S,
  ),
  jaz_mvp: new Clip(
    [
      { f: 1, p: {} },
      { f: 4, p: r.dashF },
      { f: 8, p: compose(r.dashF, jab), e: 'snap' },
      { f: 12, p: compose(r.dashF, jab) },
      { f: 34, p: {} },
    ],
    S,
  ),
  jaz_mvp_fu: new Clip(
    [
      { f: 1, p: jab },
      { f: 6, p: hookR, e: 'snap' },
      { f: 10, p: {} },
      { f: 14, p: hookL, e: 'snap' },
      { f: 18, p: {} },
      { f: 22, p: compose(cross, { y: -0.16, j: { shR: [-2, 10, 70] } }), e: 'snap' },
      { f: 28, p: r.crouch },
      { f: 32, p: kickHigh, e: 'snap' },
      { f: 40, p: kickHigh },
      { f: 56, p: {} },
    ],
    S,
  ),
  jaz_heart: new Clip(
    [
      { f: 1, p: sing },
      { f: 8, p: { x: 0.15, j: { spine: [0, -10, -12], chest: [0, -36, -8], shL: [10, 0, 92], elL: [0, 0, 4], haL: [0, 0, -60], shR: [-20, 0, 60], elR: [0, 0, 130] } }, e: 'snap' },
      { f: 13, p: { x: 0.15, j: { spine: [0, -10, -12], chest: [0, -36, -8], shL: [10, 0, 92], elL: [0, 0, 4], haL: [0, 0, -60], shR: [-20, 0, 60], elR: [0, 0, 130] } } },
      { f: 30, p: {} },
      { f: 58, p: {} },
    ],
    S,
  ),
};

const walkA = compose(S, { j: { thL: [6, 20, 34], knL: [0, 0, -24], thR: [-8, 18, -24], knR: [0, 0, -14] }, y: -0.02 });
const walkB = compose(S, { j: { thL: [6, 20, 8], knL: [0, 0, -40], thR: [-8, 18, -4], knR: [0, 0, -36] }, y: -0.05 });

export const JAZEEK_ANIMS: AnimSet = {
  id: 'jazeek',
  pivot: 0.76,
  stance: S,
  r,
  walkF: [walkA, walkB],
  walkB: [walkB, walkA],
  idleBounce: 0.022,
  intro: new Clip(
    [
      { f: 0, p: { j: { head: [0, -30, 4], neck: [0, -10, 0], shR: [-30, 0, 66], elR: [0, 0, 142], shL: [20, 0, 10], elL: [0, 0, 20] } } },
      { f: 40, p: { j: { head: [0, -30, 0], neck: [0, -10, 0], shR: [-30, 0, 74], elR: [0, 0, 138], shL: [20, 0, 10], elL: [0, 0, 20] } } },
      { f: 70, p: { j: { head: [0, 10, 6], shR: [-20, 0, 20], elR: [0, 0, 40], shL: [20, 0, 20], elL: [0, 0, 30] } } },
      { f: 120, p: {} },
    ],
    S,
  ),
  win: new Clip(
    [
      { f: 0, p: {} },
      { f: 20, p: sing },
      { f: 60, p: compose(sing, { j: { shL: [30, 0, 120], head: [0, -10, 20] } }) },
    ],
    S,
  ),
  superFlash: new Clip(
    [
      { f: 0, p: {} },
      { f: 8, p: compose(sing, { j: { shL: [20, 0, 160], elL: [0, 0, 6], head: [0, -10, 24] } }) },
      { f: 26, p: compose(sing, { j: { shL: [20, 0, 165], elL: [0, 0, 4], head: [0, -10, 26] } }) },
      { f: 36, p: sing },
    ],
    S,
  ),
  wakeup: new Clip(
    [
      { f: 0, p: r.lying },
      { f: 7, p: compose(r.crouch, { y: -0.36 }) },
      { f: 14, p: {} },
    ],
    S,
  ),
  moves,
  throwAtk: {
    jaz_throw: new Clip(
      [
        { f: 0, p: { x: 0.05, j: { shL: [24, 0, 84], elL: [0, 0, 40], shR: [-24, 0, 80], elR: [0, 0, 40] } } },
        { f: 10, p: { yaw: -90, j: { shL: [60, 0, 80], elL: [0, 0, 30], shR: [-60, 0, 80], elR: [0, 0, 30] } } },
        { f: 22, p: { yaw: -270, j: { shL: [60, 0, 80], elL: [0, 0, 30], shR: [-60, 0, 80], elR: [0, 0, 30] } }, e: 'linear' },
        { f: 30, p: { yaw: -360, x: 0.1, j: { shL: [30, 0, 100], elL: [0, 0, 10], shR: [-30, 0, 110], elR: [0, 0, 10] } }, e: 'snap' },
        { f: 44, p: { yaw: -360 } },
      ],
      S,
    ),
  },
  throwDef: {
    jaz_throw: new Clip(
      [
        { f: 0, p: r.hitHigh },
        { f: 10, p: compose(r.juggle, { y: 0.2, rot: 20 }) },
        { f: 22, p: compose(r.juggle, { y: 0.35, rot: 40 }) },
        { f: 30, p: compose(r.juggle, { x: -0.5, y: 0.5, rot: 60 }) },
        { f: 38, p: compose(r.juggle, { x: -0.9, y: 0.25, rot: 80 }) },
        { f: 44, p: compose(r.lying, { x: -(1.7 - 0.53) + 0.05 }) },
      ],
      S,
    ),
  },
};

/** Key poses reused by the Herzbrecher cinematic. */
export const JAZEEK_POSES = { jab, cross, backhand, hookR, hookL, kickHigh, sing };
