// BONEZ MC animation set — relaxed, low centre of gravity, big readable wind-ups.
// Frames match src/content/bonez.ts.
import { Clip, compose, type PoseDef } from '../pose';
import { strike } from './motion';
import { reactions } from './stances';
import type { AnimSet } from './types';

export const BONEZ_STANCE: PoseDef = {
  y: -0.07,
  // boxer's guard: lead fist in front of the chest, rear fist at the chin (elbows in, not flared)
  aim: { shL: [0.55, -0.8, -0.1], elL: [0.85, 0.5, 0.08], shR: [0.45, -0.85, 0.18], elR: [0.8, 0.58, -0.1] },
  j: {
    hips: [0, -18, 0],
    spine: [0, -4, -6],
    chest: [0, -16, -4],
    neck: [0, -2, 8],
    head: [0, -4, 6],
    haL: [0, 0, 6],
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
  x: 0.08,
  s: { aL: 0.1 },
  aim: { shL: [1, 0.33, 0.27], elL: [1, 0.3, 0.27], face: 0.6 },
  j: { hips: [0, -24, 0], spine: [0, -8, -10], chest: [0, -22, -8], haL: [0, 0, -6], shR: [-24, 0, 26], elR: [0, 0, 100] },
};
const straight: PoseDef = {
  x: 0.18,
  s: { aR: 0.1 },
  aim: { shR: [1, 0.24, -0.08], elR: [1, 0.22, -0.08], face: 0.8 },
  j: {
    hips: [0, 0, 0],
    spine: [0, 6, -14],
    chest: [0, 12, -10],
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

// clinch for the slams: big arms wrapped round the opponent's waist
const CLINCH: PoseDef = {
  x: 0.1,
  aim: { shL: [0.8, -0.5, -0.3], elL: [0.35, 0.05, 0.95], shR: [0.8, -0.5, 0.3], elR: [0.35, 0.05, -0.95], face: 0.5 },
  j: { spine: [0, -4, -20], chest: [0, -6, -10] },
};

// ---- normals: heavy, readable wind-ups, the whole body behind every hit (anims/motion.ts strike())
const normals: Record<string, Clip> = {
  // long jab, startup 7 / active 3 / total 19
  bon_5L: strike(
    {
      startup: 7,
      active: 3,
      total: 19,
      windAt: 4,
      wind: { x: -0.03, s: { sq: 0.05 }, j: { chest: [0, -6, -2], shL: [24, 0, 40], elL: [0, 0, 104], haL: [0, 0, 10] } },
      hit: {
        x: 0.06,
        s: { aL: 0.1 },
        aim: { shL: [1, 0.33, 0.27], elL: [1, 0.3, 0.27], face: 0.6 },
        j: { hips: [0, -24, 0], spine: [0, -8, -10], chest: [0, -22, -8], haL: [0, 0, -6], shR: [-24, 0, 26], elR: [0, 0, 104], thL: [12, 14, 34], knL: [0, 0, -42] },
      },
      hold: {
        x: 0.07,
        s: { aL: 0.1 },
        aim: { shL: [1, 0.3, 0.22], elL: [1, 0.28, 0.22], face: 0.6 },
        j: { hips: [0, -25, 0], spine: [0, -8, -10], chest: [0, -24, -8], haL: [0, 0, -6], shR: [-24, 0, 26], elR: [0, 0, 104], thL: [12, 14, 34], knL: [0, 0, -42] },
      },
      follow: { x: 0.03, s: { aL: 0.03 }, aim: { shL: [0.8, -0.1, 0.35], elL: [0.3, 0.9, 0.3], face: 0.4 }, j: { chest: [0, -20, -6] } },
      settle: { y: -0.05, s: { sq: 0.04 } },
    },
    S,
  ),
  // straight right, startup 13 / active 4 / total 35: loads the rear hand far back, steps through
  bon_5H: strike(
    {
      startup: 13,
      active: 4,
      total: 35,
      windAt: 9,
      wind: { x: -0.08, y: -0.04, s: { sq: 0.1 }, j: { hips: [0, -30, 0], chest: [0, -50, 2], spine: [0, -20, 0], head: [0, 20, 6], shR: [-40, 0, -10], elR: [0, 0, 110], shL: [30, 0, 60], elL: [0, 0, 80] } },
      hit: {
        x: 0.3,
        s: { aR: 0.1, sq: -0.05 },
        aim: { shR: [1, 0.24, -0.08], elR: [1, 0.22, -0.08], face: 0.8 },
        j: { hips: [0, 0, 0], spine: [0, 6, -14], chest: [0, 12, -10], shL: [30, 0, 30], elL: [0, 0, 96], thL: [12, 14, 34], knL: [0, 0, -36], thR: [-12, 12, -32], knR: [0, 0, -8], ftR: [0, 0, 30] },
      },
      hold: {
        x: 0.31,
        s: { aR: 0.1 },
        aim: { shR: [1, 0.22, -0.1], elR: [1, 0.2, -0.1], face: 0.8 },
        j: { hips: [0, 2, 0], spine: [0, 8, -14], chest: [0, 14, -10], shL: [30, 0, 30], elL: [0, 0, 96], thL: [12, 14, 34], knL: [0, 0, -36], thR: [-12, 12, -32], knR: [0, 0, -8], ftR: [0, 0, 30] },
      },
      follow: { x: 0.1, s: { aR: 0.06 }, aim: { shR: [0.8, 0, -0.5], elR: [0.3, 0.6, -0.6], face: 0.5 }, j: { hips: [0, 4, 0], spine: [0, 8, -12], chest: [0, 18, -8] } },
      settle: { y: -0.06, s: { sq: 0.05 } },
    },
    S,
  ),
  // L·L·L finisher: stepping elbow, startup 10 / active 3 / total 32
  bon_LLL: strike(
    {
      startup: 10,
      active: 3,
      total: 32,
      windAt: 6,
      wind: { x: -0.04, s: { sq: 0.08 }, j: { chest: [0, -34, 0], spine: [0, -14, 0], shR: [-30, 0, 60], elR: [0, 0, 140] } },
      hit: {
        x: 0.42,
        s: { aR: 0.1, sq: -0.04 },
        aim: { shR: [1, 0.2, -0.1], elR: [-0.6, 0.2, -0.5], face: 0.7 },
        j: { hips: [0, 2, 0], spine: [0, 6, -12], chest: [0, 14, -10], shL: [30, 0, 30], elL: [0, 0, 96], thL: [12, 14, 34], knL: [0, 0, -36] },
      },
      follow: { x: 0.14, s: { aR: 0.05 }, aim: { shR: [0.7, 0.1, -0.5], elR: [-0.5, 0.2, -0.6], face: 0.5 }, j: { hips: [0, 4, 0], spine: [0, 8, -10], chest: [0, 18, -8] } },
      settle: { y: -0.06, s: { sq: 0.06 } },
    },
    S,
  ),
  // H·H finisher: haymaker, startup 12 / active 4 / total 39
  bon_HH: strike(
    {
      startup: 12,
      active: 4,
      total: 39,
      windAt: 8,
      wind: { x: -0.1, y: -0.04, s: { sq: 0.12 }, j: { hips: [0, -34, 0], chest: [0, -64, 4], spine: [0, -28, 0], head: [0, 26, 6], shR: [-60, 0, 24], elR: [0, 0, 64], shL: [20, 0, 50], elL: [0, 0, 110] } },
      hit: {
        x: 0.36,
        s: { aR: 0.1, sq: -0.06 },
        aim: { shR: [1, 0.22, 0.0], elR: [1, 0.2, 0.0], face: 0.8 },
        j: { hips: [0, 4, 0], spine: [0, 8, -12], chest: [0, 14, -8], shL: [30, 0, 30], elL: [0, 0, 100], thL: [12, 14, 34], knL: [0, 0, -36], thR: [-12, 12, -32], knR: [0, 0, -8] },
      },
      hold: {
        x: 0.37,
        s: { aR: 0.1 },
        aim: { shR: [1, 0.2, -0.05], elR: [1, 0.18, -0.08], face: 0.8 },
        j: { hips: [0, 6, 0], spine: [0, 10, -12], chest: [0, 18, -8], shL: [30, 0, 30], elL: [0, 0, 100], thL: [12, 14, 34], knL: [0, 0, -36], thR: [-12, 12, -32], knR: [0, 0, -8] },
      },
      follow: { x: 0.16, s: { aR: 0.08 }, aim: { shR: [0.5, 0, -0.85], elR: [0, 0.3, -1], face: 0.4 }, j: { hips: [0, 8, 0], spine: [0, 12, -10], chest: [0, 22, -6] } },
      settle: { y: -0.08, s: { sq: 0.07 } },
    },
    S,
  ),
  // low kick, startup 8 / active 3 / total 21
  bon_2L: strike(
    {
      startup: 8,
      active: 3,
      total: 21,
      base: r.crouch,
      windAt: 5,
      wind: { y: -0.18, s: { sq: 0.04 }, j: { thL: [10, 16, 96], knL: [0, 0, -100] } },
      hit: { y: -0.3, x: 0.18, s: { lL: 0.15 }, aim: { thL: [1, -0.4, 0.05], knL: [1, -0.36, 0.05] }, j: { ftL: [0, 0, -4] } },
      hold: { y: -0.3, x: 0.19, s: { lL: 0.15 }, aim: { thL: [1, -0.4, 0.05], knL: [1, -0.36, 0.05] }, j: { ftL: [0, 0, -4] } },
      follow: { y: -0.32, s: { lL: 0.04 }, j: { thL: [10, 14, 80], knL: [0, 0, -70] } },
      settle: { y: -0.38, s: { sq: 0.03 } },
    },
    S,
  ),
  // rising uppercut (launcher), startup 11 / active 5 / total 38
  bon_2H: strike(
    {
      startup: 11,
      active: 5,
      total: 38,
      base: r.crouch,
      windAt: 7,
      wind: { y: -0.4, s: { sq: 0.12 }, j: { chest: [0, -30, -10], shR: [-14, 0, -24], elR: [0, 0, 70] } },
      hit: {
        y: 0.06,
        x: 0.1,
        s: { aR: 0.1, sq: -0.16 },
        aim: { shR: [1, 0.42, 0.0], elR: [1, 0.95, 0.0], face: 0.4 },
        j: { spine: [0, 6, 12], chest: [0, 8, 10], head: [0, -10, 12], shL: [24, 0, 30], elL: [0, 0, 100], thR: [-10, 14, -20], knR: [0, 0, -2], thL: [12, 14, 26], knL: [0, 0, -36] },
      },
      hold: {
        y: 0.08,
        x: 0.1,
        s: { aR: 0.1, sq: -0.18 },
        aim: { shR: [1, 0.5, 0.0], elR: [0.9, 1, 0.0], face: 0.4 },
        j: { spine: [0, 6, 14], chest: [0, 10, 12], head: [0, -12, 14], shL: [24, 0, 30], elL: [0, 0, 100], thR: [-10, 14, -20], knR: [0, 0, -2], thL: [12, 14, 26], knL: [0, 0, -36] },
      },
      follow: { y: 0.04, x: 0.08, s: { aR: 0.05, sq: -0.05 }, aim: { shR: [0.3, 1, 0.1], elR: [-0.2, 1, 0.1] }, j: { spine: [0, 6, 16], chest: [0, 10, 14] } },
      settle: { y: -0.08, s: { sq: 0.06 } },
    },
    S,
  ),
  // L·L·H "Kopfnuss", startup 10 / active 3 / total 31: grabs the collar with both hands, rears back, then smashes the
  // forehead through (the head is free here, see headFree)
  bon_LLH: strike(
    {
      startup: 10,
      active: 3,
      total: 31,
      pre: { f: 3, p: { x: 0.06, aim: { shL: [1, 0.35, -0.25], elL: [1, 0.3, -0.1], shR: [1, 0.3, 0.3], elR: [1, 0.3, 0.1] }, j: { spine: [0, -4, -8], chest: [0, -6, -4] } } },
      windAt: 7,
      wind: {
        x: 0.04,
        y: 0.04,
        s: { sq: -0.06 },
        aim: { shL: [1, 0.25, -0.25], elL: [0.6, 0.6, 0.2], shR: [1, 0.2, 0.3], elR: [0.6, 0.6, -0.2] },
        j: { spine: [0, 0, 14], chest: [0, 0, 12], neck: [0, 0, 14], head: [0, 0, 18] },
      },
      windEase: 'inOut',
      hit: {
        x: 0.2,
        y: -0.04,
        s: { sq: 0.1 },
        aim: { shL: [1, 0.05, -0.25], elL: [0.3, 0.8, 0.3], shR: [1, 0.0, 0.3], elR: [0.3, 0.8, -0.3] },
        j: { hips: [0, -6, 0], spine: [0, 0, -26], chest: [0, 0, -22], neck: [0, 0, -18], head: [0, 0, -22], thL: [12, 14, 40], knL: [0, 0, -44], thR: [-12, 12, -30], knR: [0, 0, -10] },
      },
      follow: { x: 0.14, y: -0.02, s: { sq: 0.04 }, aim: { shL: [0.9, -0.2, -0.2], elL: [0.8, 0.2, 0.1], shR: [0.9, -0.3, 0.3], elR: [0.8, 0.2, -0.1] }, j: { spine: [0, 0, -12], chest: [0, 0, -10], head: [0, 0, -6] } },
      settle: { y: -0.04, s: { sq: 0.05 } },
    },
    S,
  ),
  // 2L then H "Knie-Stoß", startup 9 / active 3 / total 32: double collar tie, yanks the head down and drives the near
  // knee up into the gut
  bon_2LH: strike(
    {
      startup: 9,
      active: 3,
      total: 32,
      pre: { f: 3, p: { y: 0.02, x: 0.04, aim: { shL: [1, 0.22, -0.25], elL: [0.7, 0.3, 0.3], shR: [1, 0.18, 0.3], elR: [0.7, 0.3, -0.3] }, j: { spine: [0, -4, -4], chest: [0, -8, -2] } } },
      windAt: 6,
      wind: {
        x: 0.06,
        y: 0.04,
        s: { sq: -0.04 },
        aim: { shL: [1, 0.2, -0.25], elL: [0.7, 0.28, 0.3], shR: [1, 0.15, 0.3], elR: [0.7, 0.28, -0.3], thR: [-0.35, -1, 0.1], knR: [-0.8, -0.7, 0.1] },
        j: { spine: [0, 0, 4], chest: [0, 0, 2], thL: [12, 14, 30], knL: [0, 0, -40] },
      },
      hit: {
        x: 0.16,
        y: 0.08,
        s: { lR: 0.06, sq: -0.08 },
        aim: { shL: [1, -0.15, -0.25], elL: [0.8, -0.4, 0.2], shR: [1, -0.2, 0.3], elR: [0.8, -0.4, -0.2], thR: [1, 0.5, 0.15], knR: [-0.15, -1, 0.1], face: 0.4 },
        j: { spine: [0, 6, -18], chest: [0, 6, -14], thL: [12, 14, -4], knL: [0, 0, -10], ftL: [0, 0, 30] },
      },
      follow: { x: 0.14, y: 0.04, aim: { shL: [1, -0.4, -0.2], elL: [0.7, -0.7, 0.1], shR: [1, -0.45, 0.3], elR: [0.7, -0.7, -0.1], thR: [0.6, 0.1, 0.1], knR: [-0.3, -1, 0.1] }, j: { spine: [0, 4, -10], chest: [0, 4, -8] } },
      settle: { y: -0.04, s: { sq: 0.06 } },
    },
    S,
  ),
  // H·L launcher "Kran-Hebel", startup 10 / active 4 / total 37: scoops low, the rear forearm lifts them off the floor
  bon_HL: strike(
    {
      startup: 10,
      active: 4,
      total: 37,
      windAt: 6,
      wind: { y: -0.16, x: -0.02, s: { sq: 0.14 }, j: { spine: [0, -4, -26], chest: [0, -20, -14], thL: [12, 14, 56], knL: [0, 0, -80], thR: [-12, 12, 0], knR: [0, 0, -70] }, aim: { shR: [0.3, -1, 0.2], elR: [0.8, -0.3, 0] } },
      hit: {
        y: 0.06,
        x: 0.16,
        s: { aR: 0.1, sq: -0.14 },
        aim: { shR: [1, 0.2, 0.0], elR: [1, 0.75, 0.0], face: 0.5 },
        j: { spine: [0, 4, 12], chest: [0, 8, 10], head: [0, -10, 12], shL: [30, 0, 40], elL: [0, 0, 100], thL: [12, 14, 26], knL: [0, 0, -30], thR: [-12, 12, -20], knR: [0, 0, -6] },
      },
      follow: { y: 0.04, x: 0.12, s: { sq: -0.05 }, aim: { shR: [0.5, 1, 0.05], elR: [-0.2, 1, 0.05] }, j: { spine: [0, 4, 14], chest: [0, 8, 12] } },
      settle: { y: -0.08, s: { sq: 0.07 } },
    },
    S,
  ),
  bon_jL: strike(
    {
      startup: 6,
      active: 6,
      total: 19,
      base: r.airRise,
      windAt: 4,
      wind: { s: { sq: 0.06 }, j: { chest: [0, -20, 6], shL: [20, 0, 150], elL: [0, 0, 60] } },
      hit: { s: { aL: 0.1, sq: -0.04 }, aim: { shL: [0.6, -1, 0.1], elL: [0.6, -1, 0.1], face: 0.5 }, j: { spine: [0, -6, -16], chest: [0, -30, -10] } },
      follow: { aim: { shL: [0.4, -1, 0.1], elL: [0.2, -1, 0.1] }, j: { spine: [0, -6, -12], chest: [0, -24, -8] } },
    },
    S,
  ),
  // jumping double axe handle, startup 10 / active 6 / total 25
  bon_jH: strike(
    {
      startup: 10,
      active: 6,
      total: 25,
      base: r.airRise,
      windAt: 7,
      wind: { s: { sq: -0.08 }, j: { spine: [0, 0, 14], chest: [0, 0, 8], shL: [20, 0, 168], elL: [0, 0, 30], shR: [-20, 0, 160], elR: [0, 0, 40] } },
      hit: {
        rot: -14,
        s: { aL: 0.1, aR: 0.1, sq: 0.06 },
        aim: { shL: [0.5, -1, -0.05], elL: [0.5, -1, -0.05], shR: [0.5, -1, 0.1], elR: [0.5, -1, 0.1], face: 0.5 },
        j: { spine: [0, 0, -34], chest: [0, 0, -14], thL: [6, 10, 70], knL: [0, 0, -100] },
      },
      follow: { rot: -10, s: { aL: 0.05, aR: 0.05 }, aim: { shL: [0.3, -1, -0.05], elL: [0.2, -1, -0.05], shR: [0.3, -1, 0.1], elR: [0.2, -1, 0.1] }, j: { spine: [0, 0, -30], chest: [0, 0, -12] } },
    },
    S,
  ),
  // grab (whiff animation), startup 6 / active 2 / total 29
  bon_throw: strike(
    {
      startup: 6,
      active: 2,
      total: 29,
      windAt: 4,
      wind: { x: -0.03, s: { sq: 0.06 }, j: { chest: [0, -6, -6], shL: [40, 0, 50], elL: [0, 0, 80], shR: [-40, 0, 50], elR: [0, 0, 80] } },
      hit: { x: 0.04, aim: { shL: [1, -0.45, -0.3], elL: [1, -0.25, -0.2], shR: [1, -0.45, 0.3], elR: [1, -0.25, 0.2], face: 0.5 }, j: { spine: [0, 0, -16], chest: [0, 0, -8] } },
      follow: { x: 0.04, aim: { shL: [1, -0.5, -0.1], elL: [0.4, 0.3, 0.2], shR: [1, -0.5, 0.1], elR: [0.4, 0.3, -0.2] }, j: { spine: [0, 0, -18] } },
      settle: { y: -0.05, s: { sq: 0.04 } },
    },
    S,
  ),
};

const moves: Record<string, Clip> = {
  ...normals,
  // Tiefergelegt (total 50, car spawns behind him on 20 and passes him around 33): two-finger whistle, points the way,
  // then hops over his own car and lands with a squash
  bon_car: new Clip(
    [
      { f: 1, p: {} },
      { f: 8, p: { aim: { shR: [0.5, 0.2, 0.4], elR: [-0.2, 1, 0.1] }, j: { head: [0, 6, 6], chest: [0, 8, 4] } }, e: 'out' },
      { f: 16, p: { aim: { shR: [0.5, 0.25, 0.4], elR: [-0.25, 1, 0.1] }, j: { head: [0, 6, 4], chest: [0, 10, 4] } } },
      { f: 21, p: { x: 0.02, aim: { shL: [1, 0.15, -0.2], elL: [1, 0.15, -0.2], shR: [-0.4, -1, 0.2], elR: [0.2, -1, 0.2] }, j: { chest: [0, -16, -2], head: [0, -6, 4] } }, e: 'snap' },
      { f: 26, p: { y: -0.16, s: { sq: 0.16 }, aim: { shL: [-0.4, -1, -0.2], elL: [0, -1, -0.2], shR: [-0.4, -1, 0.2], elR: [0, -1, 0.2] }, j: { spine: [0, 0, -14], thL: [12, 14, 60], knL: [0, 0, -90], thR: [-12, 12, 30], knR: [0, 0, -80] } }, e: 'inOut' },
      { f: 32, p: { y: 0.95, s: { sq: -0.12 }, aim: { shL: [0.4, 0.9, -0.3], elL: [0.6, 1, -0.2], shR: [0.4, 0.9, 0.3], elR: [0.6, 1, 0.2] }, j: { spine: [0, 0, 6], thL: [12, 14, 90], knL: [0, 0, -120], thR: [-12, 12, 80], knR: [0, 0, -120], head: [0, 0, -14] } }, e: 'out' },
      { f: 38, p: { y: 1.05, aim: { shL: [0.6, 0.6, -0.4], elL: [0.8, 0.8, -0.2], shR: [0.6, 0.6, 0.4], elR: [0.8, 0.8, 0.2] }, j: { thL: [12, 14, 80], knL: [0, 0, -110], thR: [-12, 12, 70], knR: [0, 0, -110], head: [0, 0, -18] } }, e: 'inOut' },
      { f: 44, p: { y: -0.14, s: { sq: 0.2 }, j: { spine: [0, 0, -10], thL: [12, 14, 50], knL: [0, 0, -80], thR: [-12, 12, 20], knR: [0, 0, -70] } }, e: 'in' },
      { f: 50, p: {}, e: 'out' },
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
      { f: 18, p: compose(straight, { x: 0.1, j: { spine: [0, 10, -20] } }), e: 'snap' },
      { f: 23, p: compose(straight, { x: 0.1, j: { spine: [0, 10, -20] } }) },
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
  headFree: { bon_LLH: 0.15 },
  stance: S,
  r,
  walkF: [walkA, walkB],
  walkB: [walkB, walkA],
  // heavy, rolling steps
  walk: { step: 0.44, bob: 0.022, lift: 18, twist: 6, lean: -2 },
  idleBounce: 0.006,
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
  // Grabs are wrestling slams (sim: 50 frames, tech window 10, damage on frame 34, victim ends 1.8 m away).
  // Forward: "Kiez-Powerbomb" (onto the shoulders, then straight down in front).
  // Back (back + grab): "Hafenkran" (fireman's carry, a full turn, thrown down behind).
  throwAtk: {
    bon_throw: new Clip(
      [
        { f: 0, p: CLINCH },
        { f: 10, p: compose(CLINCH, { y: -0.14, s: { sq: 0.12 }, j: { spine: [0, -4, -30], chest: [0, -6, -16], thL: [12, 14, 56], knL: [0, 0, -80], thR: [-12, 12, 0], knR: [0, 0, -70] } }), e: 'out' },
        // up onto the shoulders
        { f: 20, p: { y: 0.04, s: { sq: -0.1 }, aim: { shL: [0.2, 1, -0.35], elL: [0.4, 0.3, 0.8], shR: [0.2, 1, 0.35], elR: [0.4, 0.3, -0.8], face: 0.5 }, j: { spine: [0, -4, 8], chest: [0, -6, 6], head: [0, 0, 6] } }, e: 'out' },
        { f: 28, p: { y: 0.07, s: { sq: -0.12 }, aim: { shL: [0.25, 1, -0.35], elL: [0.5, 0.3, 0.8], shR: [0.25, 1, 0.35], elR: [0.5, 0.3, -0.8], face: 0.5 }, j: { spine: [0, -4, 12], chest: [0, -6, 8], head: [0, 0, 10] } }, e: 'inOut' },
        // and down: full body behind it
        { f: 32, p: { x: 0.14, y: -0.12, aim: { shL: [1, -0.2, -0.3], elL: [1, -0.6, 0.1], shR: [1, -0.2, 0.3], elR: [1, -0.6, -0.1], face: 0.5 }, j: { spine: [0, -4, -30], chest: [0, -6, -18], thL: [12, 14, 50], knL: [0, 0, -70] } }, e: 'in' },
        { f: 34, p: { x: 0.22, y: -0.4, s: { sq: 0.18 }, aim: { shL: [1, -0.9, -0.25], elL: [1, -0.9, 0], shR: [1, -0.9, 0.25], elR: [1, -0.9, 0], face: 0.4 }, j: { spine: [0, -4, -48], chest: [0, -6, -26], thL: [12, 14, 80], knL: [0, 0, -120], thR: [-12, 12, -8], knR: [0, 0, -110] } }, e: 'snap' },
        { f: 42, p: { x: 0.2, y: -0.36, s: { sq: 0.06 }, aim: { shL: [1, -0.9, -0.25], shR: [1, -0.9, 0.25] }, j: { spine: [0, -4, -40], chest: [0, -6, -22], thL: [12, 14, 80], knL: [0, 0, -120], thR: [-12, 12, -8], knR: [0, 0, -110] } }, e: 'out' },
        { f: 50, p: compose(grin, {}), e: 'inOut' },
      ],
      S,
    ),
    bon_throw_back: new Clip(
      [
        { f: 0, p: CLINCH },
        { f: 10, p: compose(CLINCH, { y: -0.16, s: { sq: 0.14 }, j: { spine: [0, -4, -34], chest: [0, -6, -18], thL: [12, 14, 60], knL: [0, 0, -86], thR: [-12, 12, 0], knR: [0, 0, -76] } }), e: 'out' },
        // fireman's carry, then a full turn
        { f: 16, p: { y: 0.02, aim: { shL: [0.1, 1, -0.4], elL: [0.6, 0.5, 0.6], shR: [0.3, 0.8, 0.4], elR: [0.7, 0.3, -0.6], face: 0.3 }, j: { spine: [0, -4, 6], chest: [0, -6, 4] } }, e: 'out' },
        { f: 22, p: { yaw: -180, y: 0.04, aim: { shL: [0.1, 1, -0.4], elL: [0.6, 0.5, 0.6], shR: [0.3, 0.8, 0.4], elR: [0.7, 0.3, -0.6] }, j: { spine: [0, -4, 6], chest: [0, -6, 4] } }, e: 'linear' },
        { f: 28, p: { yaw: -360, y: 0.04, aim: { shL: [0.1, 1, -0.4], elL: [0.6, 0.5, 0.6], shR: [0.3, 0.8, 0.4], elR: [0.7, 0.3, -0.6] }, j: { spine: [0, -4, 6], chest: [0, -6, 4] } }, e: 'linear' },
        // hurl backwards over the shoulder
        { f: 32, p: { yaw: -360, y: -0.06, rot: 22, aim: { shL: [-0.6, 0.8, -0.3], elL: [-0.9, 0.2, -0.1], shR: [-0.6, 0.8, 0.3], elR: [-0.9, 0.2, 0.1] }, j: { spine: [0, -4, 16], chest: [0, -6, 12], head: [0, 0, 14] } }, e: 'out' },
        { f: 34, p: { yaw: -360, y: -0.2, rot: 14, s: { sq: 0.12 }, aim: { shL: [-0.7, -0.6, -0.3], shR: [-0.7, -0.6, 0.3] }, j: { spine: [0, -4, 8], chest: [0, -6, 6], thL: [12, 14, 50], knL: [0, 0, -80] } }, e: 'snap' },
        { f: 42, p: { yaw: -360, y: -0.12 }, e: 'out' },
        { f: 50, p: compose(grin, { yaw: -360 }), e: 'inOut' },
      ],
      S,
    ),
  },
  throwDef: {
    bon_throw: new Clip(
      [
        { f: 0, p: compose(r.hitGut, { x: 0.08, rot: -14 }) },
        { f: 10, p: compose(r.hitGut, { x: 0.12, y: -0.02, rot: -40 }), e: 'out' },
        // sitting on Bonez's shoulders, facing him
        { f: 20, p: compose(r.juggle, { x: 0.22, y: 1.18, rot: 6, j: { thL: [10, 0, 86], knL: [0, 0, -100], thR: [-10, 0, 86], knR: [0, 0, -100] } }), e: 'out' },
        { f: 28, p: compose(r.juggle, { x: 0.22, y: 1.3, rot: 12, j: { thL: [10, 0, 86], knL: [0, 0, -96], thR: [-10, 0, 86], knR: [0, 0, -96] } }), e: 'inOut' },
        { f: 32, p: compose(r.juggle, { x: -0.06, y: 0.72, rot: 58 }), e: 'in' },
        // flat on the back, bounce, slide out
        { f: 34, p: compose(r.lying, { x: -0.36, s: { sq: 0.24 } }), e: 'snap' },
        { f: 38, p: compose(r.lying, { x: -0.64, y: (r.lying.y ?? 0) + 0.18, rot: 78 }), e: 'out' },
        { f: 42, p: compose(r.lying, { x: -0.96, s: { sq: 0.08 } }), e: 'in' },
        { f: 50, p: compose(r.lying, { x: -(1.8 - 0.53) + 0.05 }), e: 'out' },
      ],
      S,
    ),
    bon_throw_back: new Clip(
      [
        { f: 0, p: compose(r.hitGut, { x: 0.08, rot: -14 }) },
        { f: 10, p: compose(r.hitGut, { x: 0.14, y: 0.0, rot: -50 }), e: 'out' },
        // across the shoulders, turning with Bonez
        { f: 16, p: compose(r.juggle, { x: 0.52, y: 1.12, rot: -90 }), e: 'out' },
        { f: 22, p: compose(r.juggle, { x: 0.52, y: 1.14, rot: -90, yaw: -180 }), e: 'linear' },
        { f: 28, p: compose(r.juggle, { x: 0.52, y: 1.14, rot: -90, yaw: -360 }), e: 'linear' },
        { f: 32, p: compose(r.juggle, { x: 1.0, y: 1.0, rot: -170, yaw: -360 }), e: 'out' },
        { f: 34, p: compose(r.lying, { x: 1.5, y: (r.lying.y ?? 0) + 0.16, rot: -235, yaw: -360, s: { sq: 0.22 } }), e: 'snap' },
        { f: 40, p: compose(r.lying, { x: 1.86, rot: -265, yaw: -360 }), e: 'out' },
        { f: 50, p: compose(r.lying, { x: 1.8 + 0.53 - 0.05, rot: -270, yaw: -360 }), e: 'out' },
      ],
      S,
    ),
  },
};

/** Key poses reused by the Palmen-Bassdrop cinematic. */
export const BONEZ_POSES = { longJab, straight, jawsOpen, jawsShut, grin };
