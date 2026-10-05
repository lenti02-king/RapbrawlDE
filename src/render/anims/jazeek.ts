// JAZEEK animation set — loose, confident, rhythmic. Frames match src/content/jazeek.ts.
import { Clip, compose, type PoseDef } from '../pose';
import { strike } from './motion';
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
  s: { aL: 0.06 },
  aim: { shL: [1, 0.3, 0.3], elL: [1, 0.3, 0.3], face: 0.6 },
  j: { hips: [0, -24, 0], spine: [0, -8, -10], chest: [0, -22, -8], haL: [0, 0, -4], shR: [-14, 0, 34], elR: [0, 0, 130] },
};
const cross: PoseDef = {
  x: 0.16,
  s: { aR: 0.1 },
  aim: { shR: [1, 0.25, 0.0], elR: [1, 0.24, 0.0], face: 0.8 },
  j: {
    hips: [0, 0, 0],
    spine: [0, 6, -14],
    chest: [0, 12, -10],
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
  x: 0.12,
  s: { aL: 0.1 },
  aim: { shL: [1, 0.34, 0.3], elL: [1, 0.3, 0.36], face: 0.7 },
  j: { hips: [0, -40, 0], spine: [0, -18, -10], chest: [0, -44, -8], haL: [0, 0, -20], shR: [-20, 0, 40], elR: [0, 0, 120] },
};
const hookR: PoseDef = {
  x: 0.12,
  s: { aR: 0.1 },
  aim: { shR: [0.75, 0.25, 0.55], elR: [0.55, 0.1, -0.8], face: 0.7 },
  j: { spine: [0, 6, -12], chest: [0, 14, -6], shL: [20, 0, 40], elL: [0, 0, 130] },
};
const hookL: PoseDef = {
  x: 0.12,
  s: { aL: 0.1 },
  aim: { shL: [0.75, 0.25, -0.35], elL: [0.55, 0.1, 0.85], face: 0.7 },
  j: { spine: [0, -24, -12], chest: [0, -36, -6], shR: [-14, 0, 34], elR: [0, 0, 135] },
};
const kickHigh: PoseDef = {
  x: 0.1,
  s: { lR: 0.15 },
  aim: { thR: [1, 0.55, 0.1], knR: [1, 0.53, 0.1], face: 0.5 },
  j: { hips: [0, 30, 10], spine: [0, 10, 14], chest: [0, 10, 8], ftR: [0, 0, -10], thL: [6, 20, -6], knL: [0, 0, -14], shL: [40, 0, 40], elL: [0, 0, 90], shR: [-40, 0, 20], elR: [0, 0, 90] },
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

// clinch for the slams: both arms wrapped round the opponent's waist
const CLINCH: PoseDef = {
  x: 0.08,
  aim: { shL: [0.8, -0.45, -0.3], elL: [0.35, 0.05, 0.95], shR: [0.8, -0.45, 0.3], elR: [0.35, 0.05, -0.95], face: 0.5 },
  j: { spine: [0, -6, -18], chest: [0, -10, -10] },
};

// ---- normals: anticipation -> contact (with cartoon reach) -> follow-through -> settle (anims/motion.ts strike())
const normals: Record<string, Clip> = {
  // jab, startup 5 / active 2 / total 14: small pull-back, the lead fist whips out with the hips behind it
  jaz_5L: strike(
    {
      startup: 5,
      active: 2,
      total: 14,
      wind: { x: -0.02, s: { sq: 0.04 }, j: { chest: [0, -6, -2], shL: [16, 0, 38], elL: [0, 0, 114], haL: [0, 0, 12] } },
      hit: {
        x: 0.04,
        s: { aL: 0.06 },
        aim: { shL: [1, 0.3, 0.3], elL: [1, 0.3, 0.3], face: 0.6 },
        j: { hips: [0, -24, 0], spine: [0, -8, -10], chest: [0, -22, -8], haL: [0, 0, -6], shR: [-14, 0, 34], elR: [0, 0, 134], thL: [6, 20, 30], knL: [0, 0, -38] },
      },
      hold: {
        x: 0.05,
        s: { aL: 0.08 },
        aim: { shL: [1, 0.28, 0.26], elL: [1, 0.28, 0.26], face: 0.6 },
        j: { hips: [0, -25, 0], spine: [0, -8, -10], chest: [0, -24, -8], haL: [0, 0, -6], shR: [-14, 0, 34], elR: [0, 0, 134], thL: [6, 20, 30], knL: [0, 0, -38] },
      },
      follow: { x: 0.05, s: { aL: 0.06 }, aim: { shL: [0.8, -0.2, 0.3], elL: [0.3, 0.9, 0.3], face: 0.4 }, j: { chest: [0, -28, -6], shR: [-14, 0, 30], elR: [0, 0, 128] } },
      settle: { y: -0.045, s: { sq: 0.04 }, j: { chest: [0, -12, -4] } },
    },
    S,
  ),
  // backhand, startup 9 / active 3 / total 27: coils away (near shoulder forward), then unwinds through the target
  jaz_5H: strike(
    {
      startup: 9,
      active: 3,
      total: 27,
      windAt: 6,
      wind: {
        x: -0.04,
        y: -0.03,
        s: { sq: 0.08 },
        j: { hips: [0, -2, 0], spine: [0, 8, -2], chest: [0, 30, -4], neck: [0, -14, 2], head: [0, -10, 4], shL: [34, 0, 24], elL: [0, 0, 132], haL: [0, 0, 20], shR: [-20, 0, 30], elR: [0, 0, 124] },
      },
      hit: {
        x: 0.08,
        s: { aL: 0.1, sq: -0.04 },
        aim: { shL: [1, 0.34, 0.3], elL: [1, 0.3, 0.36], face: 0.7 },
        j: { hips: [0, -40, 0], spine: [0, -18, -10], chest: [0, -44, -8], haL: [0, 0, -24], shR: [-22, 0, 42], elR: [0, 0, 124], thL: [6, 20, 34], knL: [0, 0, -40], thR: [-8, 18, -28], knR: [0, 0, -8], ftR: [0, 0, 30] },
      },
      hold: {
        x: 0.09,
        s: { aL: 0.1 },
        aim: { shL: [1, 0.3, 0.18], elL: [1, 0.28, 0.18], face: 0.7 },
        j: { hips: [0, -44, 0], spine: [0, -20, -10], chest: [0, -50, -8], haL: [0, 0, -26], shR: [-22, 0, 42], elR: [0, 0, 124], thL: [6, 20, 34], knL: [0, 0, -40], thR: [-8, 18, -28], knR: [0, 0, -8], ftR: [0, 0, 30] },
      },
      follow: { x: 0.07, s: { aL: 0.06 }, aim: { shL: [0.6, 0.15, -0.6], elL: [0.4, 0.15, -0.9], face: 0.5 }, j: { hips: [0, -50, 0], spine: [0, -22, -8], chest: [0, -62, -6], haL: [0, 0, -30], shR: [-22, 0, 40], elR: [0, 0, 124] } },
      settle: { y: -0.05, s: { sq: 0.05 }, j: { chest: [0, -20, -4] } },
    },
    S,
  ),
  // L·L·L finisher "Drehkick", startup 8 / active 3 / total 29: full turn toward the camera, the near leg whips through
  jaz_LLL: new Clip(
    [
      { f: 1, p: {} },
      { f: 3, p: { y: -0.02, s: { sq: 0.05 }, j: { hips: [0, -50, 0], spine: [0, -20, 0], chest: [0, -26, 2], shL: [30, 0, 56], elL: [0, 0, 96] } }, e: 'out' },
      {
        f: 6,
        p: { yaw: -190, y: -0.02, s: { sq: 0.04 }, j: { hips: [0, -20, 0], spine: [0, -10, 4], chest: [0, -10, 6], thR: [-6, 10, 60], knR: [0, 0, -112], thL: [6, 20, 10], knL: [0, 0, -24], shL: [40, 0, 40], elL: [0, 0, 90], shR: [-40, 0, 30], elR: [0, 0, 90] } },
        e: 'inOut',
      },
      {
        f: 8,
        p: compose(kickHigh, { yaw: -350, x: 0.34, s: { lR: 0.15, sq: -0.04 }, j: { hips: [0, 50, 14], chest: [0, 20, 10] }, aim: { thR: [1, 0.5, 0.15], knR: [1, 0.48, 0.15], face: 0.5 } }),
        e: 'snap',
      },
      { f: 10, p: compose(kickHigh, { yaw: -362, x: 0.35, s: { lR: 0.15 }, j: { hips: [0, 54, 14], chest: [0, 22, 10] }, aim: { thR: [1, 0.54, 0.1], knR: [1, 0.52, 0.1], face: 0.5 } }), e: 'out' },
      { f: 14, p: compose(kickHigh, { yaw: -380, x: 0.14, s: { lR: 0.08 }, j: { hips: [0, 60, 10], chest: [0, 26, 8], knR: [0, 0, -60] }, aim: { thR: [0.8, 0.3, -0.5] } }), e: 'out' },
      { f: 21, p: { yaw: -366, y: -0.06, s: { sq: 0.08 }, j: { thR: [-8, 18, -4], knR: [0, 0, -40], thL: [6, 20, 30], knL: [0, 0, -44] } }, e: 'inOut' },
      { f: 29, p: { yaw: -360 }, e: 'inOut' },
    ],
    S,
  ),
  // H·H finisher "Encore-Haken", startup 7 / active 3 / total 31: drops low, explodes upward with the rear fist
  jaz_HH: strike(
    {
      startup: 7,
      active: 3,
      total: 31,
      windAt: 4,
      wind: {
        x: 0.02,
        y: -0.12,
        s: { sq: 0.14 },
        j: { hips: [0, -10, 0], spine: [0, -8, -22], chest: [0, -26, -16], neck: [0, 10, 8], head: [0, 6, 10], shR: [-22, 0, -14], elR: [0, 0, 128], shL: [24, 0, 44], elL: [0, 0, 118], thL: [6, 20, 44], knL: [0, 0, -66], thR: [-8, 18, -10], knR: [0, 0, -46] },
      },
      hit: {
        y: 0.06,
        x: 0.08,
        s: { aR: 0.1, sq: -0.16 },
        aim: { shR: [1, 0.4, 0.0], elR: [0.95, 1, 0.0] },
        j: { hips: [0, 6, 0], spine: [0, 6, 8], chest: [0, 12, 6], neck: [0, -6, 4], head: [0, -12, 10], haR: [0, 0, -10], shL: [24, 0, 30], elL: [0, 0, 112], thR: [-10, 14, -22], knR: [0, 0, -2], ftR: [0, 0, 30], thL: [6, 20, 30], knL: [0, 0, -20] },
      },
      hold: {
        y: 0.08,
        x: 0.08,
        s: { aR: 0.1, sq: -0.18 },
        aim: { shR: [1, 0.48, 0.0], elR: [0.85, 1, 0.0] },
        j: { hips: [0, 8, 0], spine: [0, 6, 10], chest: [0, 14, 8], neck: [0, -6, 6], head: [0, -14, 12], haR: [0, 0, -10], shL: [24, 0, 30], elL: [0, 0, 112], thR: [-10, 14, -22], knR: [0, 0, -2], ftR: [0, 0, 30], thL: [6, 20, 30], knL: [0, 0, -20] },
      },
      follow: { y: 0.05, x: 0.07, s: { aR: 0.05, sq: -0.06 }, aim: { shR: [0.5, 1, 0.1], elR: [0, 1, 0.1] }, j: { spine: [0, 6, 14], chest: [0, 14, 12], head: [0, -14, 16], shL: [24, 0, 30], elL: [0, 0, 110] } },
      settle: { y: -0.06, s: { sq: 0.06 } },
    },
    S,
  ),
  // low kick, startup 6 / active 2 / total 16: chambers from the crouch, snaps the lead leg out along the floor
  jaz_2L: strike(
    {
      startup: 6,
      active: 2,
      total: 16,
      base: r.crouch,
      windAt: 4,
      wind: { s: { sq: 0.04 }, j: { thL: [8, 20, 70], knL: [0, 0, -124], ftL: [0, 0, 30], chest: [0, -6, -8] } },
      hit: { y: -0.28, x: 0.04, s: { lL: 0.15 }, j: { spine: [0, -6, 6], chest: [0, -20, 0], thL: [4, 14, 82], knL: [0, 0, -4], ftL: [0, 0, -20], shL: [20, 0, 40], elL: [0, 0, 110] } },
      hold: { y: -0.28, x: 0.05, s: { lL: 0.15 }, j: { spine: [0, -6, 6], chest: [0, -20, 0], thL: [4, 14, 84], knL: [0, 0, -2], ftL: [0, 0, -22], shL: [20, 0, 40], elL: [0, 0, 110] } },
      follow: { y: -0.32, s: { lL: 0.05 }, j: { thL: [6, 18, 74], knL: [0, 0, -60], ftL: [0, 0, 10] } },
      settle: { y: -0.38, s: { sq: 0.03 } },
    },
    S,
  ),
  // breakdance sweep, startup 10 / active 4 / total 33: hands to the floor, the near leg scythes round
  jaz_2H: strike(
    {
      startup: 10,
      active: 4,
      total: 33,
      base: r.crouch,
      pre: { f: 3, p: { y: -0.42, j: { hips: [0, -40, 0], chest: [0, -30, -20], shL: [30, 0, 70], elL: [0, 0, 20], shR: [-30, 0, 70], elR: [0, 0, 20] } } },
      windAt: 7,
      wind: {
        y: -0.46,
        yaw: -40,
        s: { sq: 0.08 },
        j: { hips: [0, -60, 0], spine: [0, -10, -34], chest: [0, -20, -18], shL: [30, 0, 96], elL: [0, 0, 10], shR: [-30, 0, 92], elR: [0, 0, 10], thR: [-14, 10, 40], knR: [0, 0, -110], thL: [8, 20, 80], knL: [0, 0, -130] },
      },
      hit: {
        y: -0.44,
        x: 0.15,
        yaw: 20,
        s: { lR: 0.15 },
        aim: { thR: [1, -0.2, 0.15], knR: [1, -0.14, 0.15] },
        j: { hips: [0, 60, 0], spine: [0, 10, -30], chest: [0, 10, -14], ftR: [0, 0, -10], thL: [8, 20, 70], knL: [0, 0, -130], shL: [30, 0, 100], elL: [0, 0, 10], shR: [-30, 0, 96], elR: [0, 0, 10] },
      },
      hold: {
        y: -0.44,
        x: 0.15,
        yaw: 40,
        s: { lR: 0.15 },
        aim: { thR: [1, -0.2, 0.0], knR: [1, -0.14, 0.0] },
        j: { hips: [0, 70, 0], spine: [0, 10, -30], chest: [0, 10, -14], ftR: [0, 0, -10], thL: [8, 20, 70], knL: [0, 0, -130], shL: [30, 0, 100], elL: [0, 0, 10], shR: [-30, 0, 96], elR: [0, 0, 10] },
      },
      follow: { y: -0.42, yaw: 50, s: { lR: 0.1 }, j: { hips: [0, 70, 0], spine: [0, 10, -28], thR: [-14, 10, 70], knR: [0, 0, -40], thL: [8, 20, 70], knL: [0, 0, -128], shL: [30, 0, 96], shR: [-30, 0, 90] } },
      settle: { y: -0.4, s: { sq: 0.04 } },
    },
    S,
  ),
  // H·L launcher "Encore-Kick", startup 8 / active 3 / total 32: dips, then a rising kick that sends them up
  jaz_HL: strike(
    {
      startup: 8,
      active: 3,
      total: 32,
      windAt: 5,
      wind: { y: -0.1, x: 0.02, s: { sq: 0.12 }, j: { spine: [0, -6, -16], chest: [0, -16, -8], thR: [-8, 18, 20], knR: [0, 0, -100], thL: [6, 20, 40], knL: [0, 0, -60], shL: [30, 0, 30], elL: [0, 0, 110], shR: [-30, 0, 20], elR: [0, 0, 110] } },
      hit: {
        y: 0.08,
        x: 0.12,
        rot: 12,
        s: { lR: 0.12, sq: -0.12 },
        aim: { thR: [1, 0.72, 0.12], knR: [1, 0.68, 0.12], face: 0.6 },
        j: { spine: [0, 0, 12], chest: [0, 6, 10], head: [0, -10, 12], thL: [6, 20, -6], knL: [0, 0, -10], shL: [40, 0, 50], elL: [0, 0, 70], shR: [-40, 0, -20], elR: [0, 0, 60] },
      },
      follow: { y: 0.06, x: 0.1, rot: 8, aim: { thR: [0.2, 1, 0.1], knR: [-0.2, 0.6, 0.1] }, j: { spine: [0, 0, 10], thL: [6, 20, -6], knL: [0, 0, -12] } },
      settle: { y: -0.06, s: { sq: 0.08 } },
    },
    S,
  ),
  jaz_jL: strike(
    {
      startup: 5,
      active: 7,
      total: 17,
      base: r.airRise,
      windAt: 3,
      wind: { s: { sq: 0.06 }, j: { thR: [-6, 10, 50], knR: [0, 0, -120], shL: [30, 0, 40], elL: [0, 0, 110], shR: [-30, 0, 20], elR: [0, 0, 90] } },
      hit: { x: 0.04, s: { sq: -0.06 }, aim: { thR: [1, 0.1, 0.1], knR: [0.25, -1, 0.05] }, j: { spine: [0, -6, -12], chest: [0, -10, -8], thL: [6, 10, 6], knL: [0, 0, -66], shL: [20, 0, 60], elL: [0, 0, 120], shR: [-30, 0, -20], elR: [0, 0, 60] } },
      follow: { j: { thR: [-6, 10, 60], knR: [0, 0, -100] } },
    },
    S,
  ),
  // jumping spin kick, startup 7 / active 5 / total 21: winds the hips, then stamps down and forward
  jaz_jH: strike(
    {
      startup: 7,
      active: 5,
      total: 21,
      base: r.airRise,
      windAt: 4,
      wind: { yaw: 40, s: { sq: 0.08 }, j: { thR: [-6, 10, 70], knR: [0, 0, -130], thL: [6, 10, 40], knL: [0, 0, -90], shL: [40, 0, 40], shR: [-40, 0, 40] } },
      hit: {
        yaw: -20,
        rot: 10,
        x: 0.05,
        s: { lR: 0.15, sq: -0.05 },
        aim: { thR: [1, -0.8, 0.12], knR: [1, -0.85, 0.12] },
        j: { hips: [0, 20, 0], spine: [0, 0, 10], chest: [0, 10, 8], ftR: [0, 0, -14], thL: [6, 10, 30], knL: [0, 0, -96], shL: [50, 0, 70], elL: [0, 0, 40], shR: [-50, 0, 50], elR: [0, 0, 60] },
      },
      follow: { yaw: -30, rot: 6, s: { lR: 0.08 }, j: { thR: [-6, 10, 50], knR: [0, 0, -40], thL: [6, 10, 30], knL: [0, 0, -90], shL: [40, 0, 50], shR: [-40, 0, 40] } },
    },
    S,
  ),
  // grab (whiff animation; the throw itself is throwAtk), startup 5 / active 2 / total 26
  jaz_throw: strike(
    {
      startup: 5,
      active: 2,
      total: 26,
      windAt: 3,
      wind: { x: -0.02, s: { sq: 0.05 }, j: { chest: [0, -6, -6], shL: [30, 0, 50], elL: [0, 0, 70], shR: [-30, 0, 46], elR: [0, 0, 80] } },
      hit: { x: 0, aim: { shL: [1, -0.55, -0.3], elL: [1, -0.3, -0.2], shR: [1, -0.55, 0.3], elR: [1, -0.3, 0.2], face: 0.5 }, j: { spine: [0, 0, -16], chest: [0, -4, -8], haL: [0, 0, -10], haR: [0, 0, -10] } },
      follow: { x: 0.04, aim: { shL: [1, -0.4, -0.1], elL: [0.4, 0.3, 0.2], shR: [1, -0.4, 0.1], elR: [0.4, 0.3, -0.2] }, j: { spine: [0, 0, -20] } },
      settle: { y: -0.04, s: { sq: 0.03 } },
    },
    S,
  ),
};

const moves: Record<string, Clip> = {
  ...normals,
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
      { f: 8, p: { x: 0.15, s: { aL: 0.1 }, aim: { shL: [1, 0.15, 0.3], elL: [1, 0.15, 0.3], face: 0.6 }, j: { spine: [0, -10, -12], chest: [0, -24, -8], haL: [0, 0, -60], shR: [-20, 0, 60], elR: [0, 0, 130] } }, e: 'snap' },
      { f: 13, p: { x: 0.15, s: { aL: 0.1 }, aim: { shL: [1, 0.15, 0.3], elL: [1, 0.15, 0.3], face: 0.6 }, j: { spine: [0, -10, -12], chest: [0, -24, -8], haL: [0, 0, -60], shR: [-20, 0, 60], elR: [0, 0, 130] } } },
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
  // light, bouncy steps
  walk: { step: 0.46, bob: 0.032, lift: 24, twist: 8, lean: -4 },
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
  // Grabs are wrestling slams (sim: 44 frames, tech window 10, damage on frame 30, victim ends 1.7 m away).
  // Forward: "Showtime-Spinebuster" (lift chest to chest, drive the opponent down in front).
  // Back (back + grab): "Encore-Suplex" (German suplex: the opponent flips over Jazeek's head and lands behind).
  throwAtk: {
    jaz_throw: new Clip(
      [
        { f: 0, p: CLINCH },
        { f: 8, p: compose(CLINCH, { y: -0.12, s: { sq: 0.12 }, j: { thL: [6, 20, 50], knL: [0, 0, -70], thR: [-8, 18, -4], knR: [0, 0, -60] } }), e: 'out' },
        { f: 16, p: { y: 0.04, s: { sq: -0.1 }, aim: { shL: [0.3, 0.9, -0.3], elL: [0.4, 0.4, 0.8], shR: [0.3, 0.9, 0.3], elR: [0.4, 0.4, -0.8], face: 0.6 }, j: { spine: [0, -4, 14], chest: [0, -6, 10], head: [0, 0, 10] } }, e: 'out' },
        { f: 22, p: { y: 0.06, s: { sq: -0.12 }, aim: { shL: [0.4, 0.95, -0.3], elL: [0.5, 0.4, 0.8], shR: [0.4, 0.95, 0.3], elR: [0.5, 0.4, -0.8], face: 0.6 }, j: { spine: [0, -4, 18], chest: [0, -6, 12], head: [0, 0, 14] } }, e: 'inOut' },
        // drive down: one step in, the whole body follows the opponent into the floor
        { f: 27, p: { x: 0.18, y: -0.18, aim: { shL: [1, -0.5, -0.2], elL: [1, -0.6, 0.1], shR: [1, -0.5, 0.2], elR: [1, -0.6, -0.1], face: 0.5 }, j: { spine: [0, -6, -34], chest: [0, -8, -20], thL: [6, 20, 60], knL: [0, 0, -80], thR: [-8, 18, -30], knR: [0, 0, -20] } }, e: 'in' },
        { f: 30, p: { x: 0.26, y: -0.38, s: { sq: 0.16 }, aim: { shL: [1, -0.9, -0.2], elL: [1, -0.9, 0], shR: [1, -0.9, 0.2], elR: [1, -0.9, 0], face: 0.4 }, j: { spine: [0, -6, -46], chest: [0, -8, -26], thL: [6, 20, 76], knL: [0, 0, -120], thR: [-8, 18, -10], knR: [0, 0, -110] } }, e: 'snap' },
        { f: 36, p: { x: 0.24, y: -0.34, s: { sq: 0.06 }, aim: { shL: [1, -0.9, -0.2], elL: [1, -0.9, 0], shR: [1, -0.9, 0.2], elR: [1, -0.9, 0] }, j: { spine: [0, -6, -40], chest: [0, -8, -22], thL: [6, 20, 76], knL: [0, 0, -120], thR: [-8, 18, -10], knR: [0, 0, -110] } }, e: 'out' },
        // pop up and point at the crowd
        { f: 44, p: compose(sing, { x: 0.1 }), e: 'inOut' },
      ],
      S,
    ),
    jaz_throw_back: new Clip(
      [
        { f: 0, p: CLINCH },
        { f: 9, p: compose(CLINCH, { y: -0.14, s: { sq: 0.14 }, j: { thL: [6, 20, 56], knL: [0, 0, -80], thR: [-8, 18, 0], knR: [0, 0, -70] } }), e: 'out' },
        { f: 17, p: { y: 0.02, rot: 24, s: { sq: -0.1 }, aim: { shL: [-0.2, 1, -0.3], elL: [0.3, 0.5, 0.8], shR: [-0.2, 1, 0.3], elR: [0.3, 0.5, -0.8] }, j: { spine: [0, 0, 18], chest: [0, 0, 16], head: [0, 0, 20], thL: [6, 20, -10], knL: [0, 0, -20], thR: [-8, 18, -30], knR: [0, 0, -10] } }, e: 'out' },
        // bridge: arch back, the opponent goes over the head
        { f: 24, p: { y: -0.14, rot: 58, aim: { shL: [-0.9, 0.2, -0.3], elL: [-0.9, -0.2, 0.4], shR: [-0.9, 0.2, 0.3], elR: [-0.9, -0.2, -0.4] }, j: { spine: [0, 0, 22], chest: [0, 0, 20], neck: [0, 0, 16], head: [0, 0, 20], thL: [6, 20, -40], knL: [0, 0, -50], thR: [-8, 18, -60], knR: [0, 0, -40] } }, e: 'inOut' },
        { f: 30, p: { y: -0.34, rot: 78, s: { sq: 0.1 }, aim: { shL: [-0.9, -0.3, -0.3], elL: [-0.8, -0.6, 0.2], shR: [-0.9, -0.3, 0.3], elR: [-0.8, -0.6, -0.2] }, j: { spine: [0, 0, 24], chest: [0, 0, 22], neck: [0, 0, 20], head: [0, 0, 24], thL: [6, 20, -62], knL: [0, 0, -70], thR: [-8, 18, -76], knR: [0, 0, -60] } }, e: 'snap' },
        { f: 36, p: { y: -0.3, rot: 70, aim: { shL: [-0.9, -0.3, -0.3], shR: [-0.9, -0.3, 0.3] }, j: { spine: [0, 0, 20], chest: [0, 0, 18], thL: [6, 20, -56], knL: [0, 0, -70], thR: [-8, 18, -70], knR: [0, 0, -60] } }, e: 'out' },
        { f: 44, p: compose(sing, {}), e: 'inOut' },
      ],
      S,
    ),
  },
  throwDef: {
    jaz_throw: new Clip(
      [
        { f: 0, p: compose(r.hitGut, { x: 0.06 }) },
        { f: 8, p: compose(r.hitGut, { x: 0.1, y: 0.04 }), e: 'out' },
        // lifted chest to chest, legs dangling
        { f: 16, p: compose(r.juggle, { x: 0.12, y: 0.62, rot: 8, j: { thL: [10, 0, 10], knL: [0, 0, -40], thR: [-10, 0, -6], knR: [0, 0, -30] } }), e: 'out' },
        { f: 22, p: compose(r.juggle, { x: 0.12, y: 0.72, rot: 14, j: { thL: [10, 0, 14], knL: [0, 0, -50], thR: [-10, 0, -2], knR: [0, 0, -36] } }), e: 'inOut' },
        { f: 27, p: compose(r.juggle, { x: -0.1, y: 0.42, rot: 62 }), e: 'in' },
        // slammed flat on the back
        { f: 30, p: compose(r.lying, { x: -0.32, s: { sq: 0.22 } }), e: 'snap' },
        { f: 34, p: compose(r.lying, { x: -0.62, y: (r.lying.y ?? 0) + 0.14, rot: 80 }), e: 'out' },
        { f: 38, p: compose(r.lying, { x: -0.92, s: { sq: 0.08 } }), e: 'in' },
        { f: 44, p: compose(r.lying, { x: -(1.7 - 0.53) + 0.05 }), e: 'out' },
      ],
      S,
    ),
    jaz_throw_back: new Clip(
      [
        { f: 0, p: compose(r.hitGut, { x: 0.06 }) },
        { f: 9, p: compose(r.hitGut, { x: 0.1, y: 0.02, rot: -8 }), e: 'out' },
        { f: 17, p: compose(r.juggle, { x: 0.3, y: 0.82, rot: -70 }), e: 'out' },
        // over the top, head first
        { f: 24, p: compose(r.juggle, { x: 0.86, y: 0.86, rot: -170 }), e: 'inOut' },
        { f: 30, p: compose(r.lying, { x: 1.26, y: (r.lying.y ?? 0) + 0.18, rot: -232, s: { sq: 0.2 } }), e: 'snap' },
        { f: 35, p: compose(r.lying, { x: 1.6, rot: -262 }), e: 'out' },
        { f: 44, p: compose(r.lying, { x: 1.7 + 0.53 - 0.05, rot: -270 }), e: 'out' },
      ],
      S,
    ),
  },
};

/** Key poses reused by the Herzbrecher cinematic. */
export const JAZEEK_POSES = { jab, cross, backhand, hookR, hookL, kickHigh, sing };
