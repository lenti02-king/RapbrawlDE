// Base stances and reaction poses shared by fighters (with per-fighter variants).
import type { PoseDef } from '../pose';
import { compose } from '../pose';

export const VOLT_STANCE: PoseDef = {
  y: -0.04,
  j: {
    hips: [0, -22, 0],
    spine: [0, -6, -6],
    chest: [0, -18, -4],
    neck: [0, 14, 2],
    head: [0, 22, 4],
    shL: [12, 0, 48],
    elL: [0, 0, 112],
    haL: [0, 0, 10],
    shR: [-14, 0, 28],
    elR: [0, 0, 132],
    haR: [0, 0, 0],
    thL: [6, 20, 24],
    knL: [0, 0, -30],
    ftL: [0, 0, 6],
    thR: [-8, 18, -16],
    knR: [0, 0, -18],
    ftR: [0, 0, 22],
  },
};

export const BRICK_STANCE: PoseDef = {
  y: -0.05,
  j: {
    hips: [0, -14, 0],
    spine: [0, -4, -8],
    chest: [0, -12, -6],
    neck: [0, 8, 6],
    head: [0, 12, 6],
    shL: [24, 0, 34],
    elL: [0, 0, 96],
    haL: [0, 0, 6],
    shR: [-26, 0, 22],
    elR: [0, 0, 108],
    haR: [0, 0, 0],
    thL: [10, 16, 20],
    knL: [0, 0, -26],
    ftL: [0, 0, 6],
    thR: [-10, 14, -18],
    knR: [0, 0, -16],
    ftR: [0, 0, 24],
  },
};

/** Generic reaction poses built on top of a stance. */
export function reactions(stance: PoseDef, pivot: number) {
  const crouch = compose(stance, {
    y: -0.36,
    j: {
      hips: [0, -20, 0],
      spine: [0, -6, -18],
      chest: [0, -14, -6],
      thL: [8, 20, 78],
      knL: [0, 0, -112],
      ftL: [0, 0, 34],
      thR: [-10, 18, 40],
      knR: [0, 0, -120],
      ftR: [0, 0, 80],
    },
  });
  return {
    crouch,
    guardStand: compose(stance, {
      j: {
        spine: [0, -4, -2],
        chest: [0, -26, 2],
        neck: [0, 18, 6],
        shL: [16, 0, 58],
        elL: [0, 0, 128],
        shR: [-12, 0, 44],
        elR: [0, 0, 140],
      },
      x: -0.03,
    }),
    guardCrouch: compose(crouch, {
      j: {
        chest: [0, -24, -4],
        shL: [16, 0, 58],
        elL: [0, 0, 128],
        shR: [-12, 0, 44],
        elR: [0, 0, 140],
      },
    }),
    jumpSquat: compose(crouch, { y: -0.2, j: { shL: [20, 0, 10], shR: [-20, 0, -10], elL: [0, 0, 60], elR: [0, 0, 70] } }),
    airRise: compose(stance, {
      y: 0.05,
      j: {
        spine: [0, -6, -8],
        thL: [6, 10, 70],
        knL: [0, 0, -100],
        thR: [-6, 10, 30],
        knR: [0, 0, -110],
        ftR: [0, 0, 40],
        shL: [30, 0, 80],
        elL: [0, 0, 80],
        shR: [-30, 0, 60],
        elR: [0, 0, 100],
      },
    }),
    airFall: compose(stance, {
      j: {
        spine: [0, -6, 2],
        thL: [6, 10, 40],
        knL: [0, 0, -50],
        thR: [-6, 10, -6],
        knR: [0, 0, -40],
        shL: [40, 0, 60],
        elL: [0, 0, 60],
        shR: [-40, 0, 40],
        elR: [0, 0, 70],
      },
    }),
    land: compose(crouch, { y: -0.22 }),
    dashF: compose(stance, {
      x: 0.05,
      j: { spine: [0, -6, -22], chest: [0, -12, -10], thL: [6, 20, 60], knL: [0, 0, -60], thR: [-8, 18, -40], knR: [0, 0, -40] },
    }),
    dashB: compose(stance, {
      x: -0.05,
      j: { spine: [0, -6, 14], chest: [0, -20, 6], thL: [6, 20, 10], knL: [0, 0, -20], thR: [-8, 18, -30], knR: [0, 0, -70] },
    }),
    hitHigh: compose(stance, {
      x: -0.06,
      j: {
        spine: [0, -10, 16],
        chest: [0, -24, 14],
        neck: [0, 20, 22],
        head: [0, 30, 26],
        shL: [40, 0, 20],
        elL: [0, 0, 70],
        shR: [-40, 0, -10],
        elR: [0, 0, 60],
      },
    }),
    hitGut: compose(stance, {
      x: -0.04,
      y: -0.08,
      j: {
        spine: [0, -6, -30],
        chest: [0, -10, -22],
        neck: [0, 10, -10],
        head: [0, 14, -12],
        shL: [30, 0, 60],
        elL: [0, 0, 70],
        shR: [-30, 0, 50],
        elR: [0, 0, 70],
        thL: [6, 20, 40],
        knL: [0, 0, -60],
      },
    }),
    hitLow: compose(stance, {
      y: -0.1,
      j: { spine: [0, -6, -12], thL: [6, 20, 50], knL: [0, 0, -70], ftL: [0, 0, 20], thR: [-8, 18, 0], knR: [0, 0, -40] },
    }),
    hitCrouch: compose(crouch, { x: -0.05, j: { spine: [0, -6, 6], chest: [0, -20, 10], head: [0, 24, 16] } }),
    blockStand: compose(stance, {
      x: -0.04,
      j: {
        spine: [0, -4, 4],
        chest: [0, -30, 4],
        neck: [0, 22, 8],
        shL: [10, 0, 64],
        elL: [0, 0, 135],
        shR: [-8, 0, 52],
        elR: [0, 0, 145],
      },
    }),
    blockCrouch: compose(crouch, {
      x: -0.04,
      j: { chest: [0, -28, 0], shL: [10, 0, 64], elL: [0, 0, 135], shR: [-8, 0, 52], elR: [0, 0, 145] },
    }),
    /** Airborne tumble (combined with root rotation over time). */
    juggle: compose(stance, {
      j: {
        spine: [0, 0, 20],
        chest: [0, 0, 16],
        neck: [0, 0, 20],
        head: [0, 0, 20],
        shL: [50, 0, 140],
        elL: [0, 0, 30],
        shR: [-50, 0, 120],
        elR: [0, 0, 40],
        thL: [10, 0, 40],
        knL: [0, 0, -60],
        thR: [-10, 0, 10],
        knR: [0, 0, -30],
      },
    }),
    /** Lying on the back, head away from the opponent (rotation about the hip pivot). */
    lying: {
      x: 0.05,
      y: -(pivot - 0.15),
      rot: 90,
      j: {
        hips: [0, 0, 0],
        spine: [0, 0, 4],
        chest: [0, 0, 4],
        neck: [0, 0, -14],
        head: [0, 0, -12],
        shL: [70, 0, 10],
        elL: [0, 0, 30],
        shR: [-70, 0, 20],
        elR: [0, 0, 20],
        thL: [8, 0, 10],
        knL: [0, 0, -20],
        thR: [-8, 0, 30],
        knR: [0, 0, -50],
      },
    } as PoseDef,
    countered: compose(stance, {
      x: -0.1,
      j: {
        spine: [0, -20, 22],
        chest: [0, -30, 18],
        head: [0, 30, 20],
        shL: [60, 0, 100],
        elL: [0, 0, 40],
        shR: [-60, 0, 80],
        elR: [0, 0, 40],
        thL: [6, 20, 40],
        knL: [0, 0, -30],
      },
    }),
  };
}

export type Reactions = ReturnType<typeof reactions>;
