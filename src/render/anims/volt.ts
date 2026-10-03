// VOLT animation set. Clip frames are move frames (1-based) matching src/content/volt.ts.
import { Clip, compose, type PoseDef } from '../pose';
import { VOLT_STANCE, reactions } from './stances';
import type { AnimSet } from './types';

const S = VOLT_STANCE;
const pivot = 0.92;
const r = reactions(S, pivot);
const P = (p: PoseDef): PoseDef => p;

const jabExt = P({
  x: 0.07,
  j: { spine: [0, -14, -9], chest: [0, -42, -6], neck: [0, 26, 4], head: [0, 30, 4], shL: [2, -4, 90], elL: [0, 0, 4], haL: [0, 0, -4], shR: [-14, 0, 34], elR: [0, 0, 135] },
});
const crossExt = P({
  x: 0.18,
  j: {
    hips: [0, 8, 0],
    spine: [0, 14, -14],
    chest: [0, 30, -10],
    neck: [0, -10, 4],
    head: [0, -16, 6],
    shR: [-2, 10, 92],
    elR: [0, 0, 3],
    shL: [24, 0, 36],
    elL: [0, 0, 128],
    thL: [6, 20, 34],
    knL: [0, 0, -36],
    thR: [-8, 18, -30],
    knR: [0, 0, -6],
    ftR: [0, 0, 30],
  },
});
const hookR = P({
  x: 0.12,
  j: { spine: [0, 18, -12], chest: [0, 34, -6], shR: [-70, 0, 70], elR: [0, 0, 80], shL: [20, 0, 40], elL: [0, 0, 130] },
});
const hookL = P({
  x: 0.12,
  j: { spine: [0, -24, -12], chest: [0, -40, -6], shL: [70, 0, 75], elL: [0, 0, 80], shR: [-14, 0, 34], elR: [0, 0, 135] },
});
const uppercut = P({
  y: 0.08,
  x: 0.12,
  j: { spine: [0, 16, 10], chest: [0, 26, 8], head: [0, -10, 10], shR: [-12, 0, 168], elR: [0, 0, 16], shL: [20, 0, 40], elL: [0, 0, 120], thL: [6, 20, 10], knL: [0, 0, -10], thR: [-8, 18, -20], knR: [0, 0, -4], ftR: [0, 0, 40] },
});

const moves: Record<string, Clip> = {
  volt_5L: new Clip(
    [
      { f: 1, p: {} },
      { f: 3, p: { j: { chest: [0, -12, -4], shL: [14, 0, 56], elL: [0, 0, 120] } } },
      { f: 5, p: jabExt, e: 'snap' },
      { f: 7, p: jabExt },
      { f: 14, p: {}, e: 'inOut' },
    ],
    S,
  ),
  volt_2L: new Clip(
    [
      { f: 1, p: r.crouch },
      { f: 4, p: compose(r.crouch, { j: { thL: [8, 20, 66], knL: [0, 0, -118] } }) },
      { f: 6, p: compose(r.crouch, { y: -0.3, j: { spine: [0, -6, 4], thL: [4, 14, 76], knL: [0, 0, -6], ftL: [0, 0, -18] } }), e: 'snap' },
      { f: 9, p: compose(r.crouch, { y: -0.3, j: { spine: [0, -6, 4], thL: [4, 14, 76], knL: [0, 0, -6], ftL: [0, 0, -18] } }) },
      { f: 16, p: r.crouch },
    ],
    S,
  ),
  volt_5H: new Clip(
    [
      { f: 1, p: {} },
      { f: 5, p: { x: -0.03, j: { chest: [0, -44, -2], spine: [0, -14, -2], shR: [-24, 0, 16], elR: [0, 0, 145] } } },
      { f: 9, p: crossExt, e: 'snap' },
      { f: 13, p: crossExt },
      { f: 27, p: {}, e: 'inOut' },
    ],
    S,
  ),
  volt_2H: new Clip(
    [
      { f: 1, p: r.crouch },
      { f: 6, p: compose(r.crouch, { y: -0.45, j: { hips: [0, -50, 0], chest: [0, -30, -6], thR: [-10, 0, 20], knR: [0, 0, -60] } }) },
      {
        f: 10,
        p: compose(r.crouch, {
          y: -0.5,
          x: 0.05,
          j: { hips: [0, 50, 0], spine: [0, 10, -24], chest: [0, 10, -10], thR: [-14, 10, 88], knR: [0, 0, -2], ftR: [0, 0, -10], thL: [8, 20, 70], knL: [0, 0, -130], shL: [70, 0, 30], shR: [-60, 0, 20] },
        }),
        e: 'snap',
      },
      { f: 15, p: compose(r.crouch, { y: -0.5, x: 0.05, j: { hips: [0, 50, 0], spine: [0, 10, -24], thR: [-14, 10, 88], knR: [0, 0, -2], thL: [8, 20, 70], knL: [0, 0, -130], shL: [70, 0, 30], shR: [-60, 0, 20] } }) },
      { f: 33, p: r.crouch },
    ],
    S,
  ),
  volt_6H: new Clip(
    [
      { f: 1, p: {} },
      { f: 9, p: { y: 0.16, j: { spine: [0, 0, 14], chest: [0, -6, 10], shL: [14, 0, 172], elL: [0, 0, 40], shR: [-14, 0, 168], elR: [0, 0, 50], thL: [6, 20, 50], knL: [0, 0, -70], thR: [-8, 18, 10], knR: [0, 0, -60] } } },
      { f: 16, p: { y: 0.12, j: { spine: [0, 0, 18], chest: [0, -6, 14], shL: [14, 0, 180], elL: [0, 0, 30], shR: [-14, 0, 178], elR: [0, 0, 36], thL: [6, 20, 50], knL: [0, 0, -70], thR: [-8, 18, 10], knR: [0, 0, -60] } } },
      { f: 19, p: { y: -0.12, x: 0.14, j: { spine: [0, 0, -32], chest: [0, -4, -16], shL: [14, 0, 62], elL: [0, 0, 18], shR: [-14, 0, 56], elR: [0, 0, 18], thL: [6, 20, 50], knL: [0, 0, -60] } }, e: 'snap' },
      { f: 24, p: { y: -0.12, x: 0.14, j: { spine: [0, 0, -32], chest: [0, -4, -16], shL: [14, 0, 62], elL: [0, 0, 18], shR: [-14, 0, 56], elR: [0, 0, 18], thL: [6, 20, 50], knL: [0, 0, -60] } } },
      { f: 35, p: {} },
    ],
    S,
  ),
  volt_jL: new Clip(
    [
      { f: 1, p: r.airRise },
      { f: 4, p: compose(r.airRise, { j: { thR: [-6, 10, 104], knR: [0, 0, -150], thL: [6, 10, 10], knL: [0, 0, -70], shL: [20, 0, 60], elL: [0, 0, 120] } }), e: 'snap' },
      { f: 11, p: compose(r.airRise, { j: { thR: [-6, 10, 104], knR: [0, 0, -150], thL: [6, 10, 10], knL: [0, 0, -70], shL: [20, 0, 60], elL: [0, 0, 120] } }) },
      { f: 17, p: r.airFall },
    ],
    S,
  ),
  volt_jH: new Clip(
    [
      { f: 1, p: r.airRise },
      { f: 5, p: compose(r.airRise, { j: { spine: [0, 0, 16], shL: [20, 0, 168], elL: [0, 0, 30], shR: [-20, 0, 160], elR: [0, 0, 40] } }) },
      { f: 8, p: compose(r.airFall, { j: { spine: [0, 0, -34], chest: [0, 0, -14], shL: [20, 0, 40], elL: [0, 0, 10], shR: [-20, 0, 30], elR: [0, 0, 10], thL: [6, 10, 70], knL: [0, 0, -100] } }), e: 'snap' },
      { f: 12, p: compose(r.airFall, { j: { spine: [0, 0, -34], chest: [0, 0, -14], shL: [20, 0, 40], elL: [0, 0, 10], shR: [-20, 0, 30], elR: [0, 0, 10], thL: [6, 10, 70], knL: [0, 0, -100] } }) },
      { f: 21, p: r.airFall },
    ],
    S,
  ),
  volt_throw: new Clip(
    [
      { f: 1, p: {} },
      { f: 5, p: { x: 0.08, j: { spine: [0, 0, -14], chest: [0, -6, -6], shL: [24, 0, 84], elL: [0, 0, 24], shR: [-24, 0, 80], elR: [0, 0, 24] } }, e: 'snap' },
      { f: 9, p: { x: 0.08, j: { spine: [0, 0, -14], chest: [0, -6, -6], shL: [24, 0, 84], elL: [0, 0, 24], shR: [-24, 0, 80], elR: [0, 0, 24] } } },
      { f: 26, p: {} },
    ],
    S,
  ),
  volt_mic: new Clip(
    [
      { f: 1, p: {} },
      { f: 9, p: { x: -0.04, j: { chest: [0, -46, 4], spine: [0, -16, 4], shR: [-30, 0, -56], elR: [0, 0, 50], shL: [30, 0, 60], elL: [0, 0, 60] } } },
      { f: 14, p: { x: 0.08, j: { chest: [0, 32, -12], spine: [0, 12, -12], shR: [-8, 0, 108], elR: [0, 0, 6], shL: [30, 0, 30], elL: [0, 0, 60] } }, e: 'snap' },
      { f: 22, p: { x: 0.08, j: { chest: [0, 26, -10], spine: [0, 10, -10], shR: [-8, 0, 96], elR: [0, 0, 10], shL: [30, 0, 30], elL: [0, 0, 60] } } },
      { f: 40, p: {} },
    ],
    S,
  ),
  volt_dive: new Clip(
    [
      { f: 1, p: {} },
      { f: 5, p: r.jumpSquat, e: 'snap' },
      { f: 9, p: { rot: -30, j: { spine: [0, 0, -10], shL: [30, 0, 160], elL: [0, 0, 10], shR: [-30, 0, 160], elR: [0, 0, 10], thL: [6, 0, -10], knL: [0, 0, -40], thR: [-6, 0, -20], knR: [0, 0, -30] } } },
      { f: 20, p: { rot: -10, j: { spine: [0, 0, 6], shL: [70, 0, 120], elL: [0, 0, 10], shR: [-70, 0, 120], elR: [0, 0, 10], thL: [6, 0, 10], knL: [0, 0, -60], thR: [-6, 0, -10], knR: [0, 0, -50] } } },
      { f: 30, p: { rot: 20, j: { spine: [0, 0, -30], chest: [0, 0, -10], shL: [20, 0, 50], elL: [0, 0, 130], shR: [-20, 0, 40], elR: [0, 0, 130], thL: [6, 0, 50], knL: [0, 0, -90], thR: [-6, 0, 30], knR: [0, 0, -90] } } },
      { f: 60, p: { rot: 20, j: { spine: [0, 0, -30], chest: [0, 0, -10], shL: [20, 0, 50], elL: [0, 0, 130], shR: [-20, 0, 40], elR: [0, 0, 130], thL: [6, 0, 50], knL: [0, 0, -90], thR: [-6, 0, 30], knR: [0, 0, -90] } } },
    ],
    S,
  ),
  volt_rush: new Clip(
    [
      { f: 1, p: {} },
      { f: 4, p: r.dashF },
      { f: 8, p: compose(r.dashF, jabExt), e: 'snap' },
      { f: 12, p: compose(r.dashF, jabExt) },
      { f: 34, p: {} },
    ],
    S,
  ),
  volt_rush_fu: new Clip(
    [
      { f: 1, p: jabExt },
      { f: 6, p: hookR, e: 'snap' },
      { f: 10, p: {} },
      { f: 14, p: hookL, e: 'snap' },
      { f: 18, p: {} },
      { f: 22, p: compose(crossExt, { y: -0.18, j: { shR: [-2, 10, 70] } }), e: 'snap' },
      { f: 28, p: compose(r.crouch, { j: { shR: [-12, 0, -20], elR: [0, 0, 90] } }) },
      { f: 32, p: uppercut, e: 'snap' },
      { f: 40, p: uppercut },
      { f: 56, p: {} },
    ],
    S,
  ),
  volt_counter: new Clip(
    [
      { f: 1, p: {} },
      { f: 4, p: { x: -0.05, j: { spine: [0, -10, 12], chest: [0, -36, 8], head: [0, 30, 10], shL: [40, 0, -6], elL: [0, 0, 30], shR: [-40, 0, -4], elR: [0, 0, 36] } }, e: 'snap' },
      { f: 26, p: { x: -0.06, j: { spine: [0, -10, 14], chest: [0, -36, 10], head: [0, 30, 12], shL: [40, 0, -2], elL: [0, 0, 40], shR: [-40, 0, 0], elR: [0, 0, 40] } } },
      { f: 44, p: {} },
    ],
    S,
  ),
  volt_counter_fu: new Clip(
    [
      { f: 1, p: { x: -0.2, j: { spine: [0, -20, 22], chest: [0, -40, 12], shR: [-30, 0, -30], elR: [0, 0, 90] } } },
      { f: 5, p: compose(hookR, { x: 0.22, j: { shR: [-60, 0, 86], elR: [0, 0, 40] } }), e: 'snap' },
      { f: 10, p: compose(hookR, { x: 0.22 }) },
      { f: 32, p: {} },
    ],
    S,
  ),
  volt_hype: new Clip(
    [
      { f: 1, p: {} },
      { f: 10, p: { j: { spine: [0, 0, 8], chest: [0, -10, 8], head: [0, 0, 16], shL: [40, 0, 160], elL: [0, 0, 20], shR: [-20, 0, 100], elR: [0, 0, 130] } } },
      { f: 25, p: { j: { spine: [0, 0, 10], chest: [0, -6, 10], head: [0, 0, 20], shL: [50, 0, 170], elL: [0, 0, 10], shR: [-20, 0, 96], elR: [0, 0, 132] } } },
      { f: 40, p: { y: 0.05, j: { spine: [0, 0, 14], chest: [0, -6, 12], head: [0, 0, 24], shL: [30, 0, 176], elL: [0, 0, 6], shR: [-30, 0, 172], elR: [0, 0, 8] } } },
      { f: 52, p: { j: { spine: [0, 0, 10], shL: [30, 0, 150], shR: [-30, 0, 150] } } },
      { f: 70, p: {} },
    ],
    S,
  ),
  volt_headliner: new Clip(
    [
      { f: 1, p: { y: -0.12, j: { chest: [0, -40, 0], shR: [-20, 0, -40], elR: [0, 0, 100], shL: [40, 0, 70], elL: [0, 0, 60] } } },
      { f: 9, p: compose(crossExt, { x: 0.2, j: { spine: [0, 14, -26] } }), e: 'snap' },
      { f: 15, p: compose(crossExt, { x: 0.2, j: { spine: [0, 14, -26] } }) },
      { f: 30, p: crossExt },
      { f: 60, p: {} },
    ],
    S,
  ),
};

const walkA = compose(S, { j: { thL: [6, 20, 34], knL: [0, 0, -24], thR: [-8, 18, -24], knR: [0, 0, -14] }, y: -0.03 });
const walkB = compose(S, { j: { thL: [6, 20, 8], knL: [0, 0, -40], thR: [-8, 18, -4], knR: [0, 0, -36] }, y: -0.06 });

export const VOLT_ANIMS: AnimSet = {
  id: 'volt',
  stance: S,
  r,
  walkF: [walkA, walkB],
  walkB: [walkB, walkA],
  intro: new Clip(
    [
      { f: 0, p: { j: { shR: [-20, 0, 100], elR: [0, 0, 130], head: [0, 10, 10], shL: [30, 0, 20], elL: [0, 0, 20] } } },
      { f: 50, p: { j: { shR: [-20, 0, 104], elR: [0, 0, 128], head: [0, 0, 14], shL: [50, 0, 120], elL: [0, 0, 20] } } },
      { f: 80, p: { j: { shR: [-20, 0, 104], elR: [0, 0, 128], shL: [20, 0, 92], elL: [0, 0, 0], chest: [0, -30, 0] } } },
      { f: 120, p: {} },
    ],
    S,
  ),
  win: new Clip(
    [
      { f: 0, p: {} },
      { f: 20, p: { y: 0.04, j: { spine: [0, 0, 8], chest: [0, -10, 10], head: [0, 0, 18], shL: [30, 0, 178], elL: [0, 0, 6], shR: [-20, 0, 100], elR: [0, 0, 130] } } },
      { f: 60, p: { y: 0.0, j: { spine: [0, 0, 6], chest: [0, -10, 8], head: [0, 0, 14], shL: [30, 0, 172], elL: [0, 0, 12], shR: [-20, 0, 96], elR: [0, 0, 132] } } },
    ],
    S,
  ),
  superFlash: new Clip(
    [
      { f: 0, p: {} },
      { f: 8, p: { j: { chest: [0, -10, 6], head: [0, 0, 10], shR: [-20, 0, 100], elR: [0, 0, 130], shL: [20, 0, 150], elL: [0, 0, 0] } } },
      { f: 26, p: { j: { chest: [0, -10, 8], head: [0, 0, 12], shR: [-20, 0, 102], elR: [0, 0, 128], shL: [20, 0, 154], elL: [0, 0, 0] } } },
      { f: 36, p: { y: -0.12, j: { chest: [0, -40, 0], shR: [-20, 0, -40], elR: [0, 0, 100], shL: [40, 0, 70], elL: [0, 0, 60] } } },
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
    volt_throw: new Clip(
      [
        { f: 0, p: { x: 0.05, j: { shL: [24, 0, 84], elL: [0, 0, 40], shR: [-24, 0, 80], elR: [0, 0, 40] } } },
        { f: 10, p: { x: 0.0, j: { spine: [0, 0, -10], chest: [0, -30, -6], shL: [60, 0, 60], elL: [0, 0, 100], shR: [-30, 0, 50], elR: [0, 0, 110] } } },
        { f: 22, p: { yaw: -40, j: { spine: [0, 0, -10], chest: [0, -40, -6], shL: [60, 0, 60], elL: [0, 0, 100], shR: [-30, 0, 50], elR: [0, 0, 110] } } },
        { f: 30, p: { yaw: 30, x: 0.1, j: { spine: [0, 20, -14], chest: [0, 30, -10], shL: [30, 0, 100], elL: [0, 0, 10], shR: [-30, 0, 110], elR: [0, 0, 10] } }, e: 'snap' },
        { f: 38, p: { yaw: 20, x: 0.1, j: { spine: [0, 20, -14], chest: [0, 30, -10], shL: [30, 0, 100], elL: [0, 0, 10], shR: [-30, 0, 110], elR: [0, 0, 10] } } },
        { f: 44, p: {} },
      ],
      S,
    ),
  },
  throwDef: {
    volt_throw: new Clip(
      [
        { f: 0, p: r.hitHigh },
        { f: 10, p: compose(r.hitGut, { x: 0.1, y: -0.2, j: { spine: [0, 0, -48], chest: [0, 0, -20] } }) },
        { f: 22, p: compose(r.hitGut, { x: 0.12, y: -0.2, j: { spine: [0, 0, -48], chest: [0, 0, -20] } }) },
        { f: 30, p: compose(r.juggle, { x: -0.4, y: 0.4, rot: 40 }) },
        { f: 38, p: compose(r.juggle, { x: -0.9, y: 0.2, rot: 80 }) },
        { f: 44, p: compose(r.lying, { x: -(1.6 - 0.56) + 0.05 }) },
      ],
      S,
    ),
  },
};
