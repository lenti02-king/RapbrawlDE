// Move clips for the D43 abilities (session 11, S12): Manuellsen (5000 Kurden, König im Schatten, Sofa-Backpfeifen),
// Lacazette (Drei Buchstaben, Chart-Einstieg, 70 Schüsse), Jazeek's Ninetynine and Bonez's Ohne mein Team. Frame numbers are move frames
// (sim content), keyed so the contact poses land on the hitboxes' first active frame.
import { compose, type Clip, type PoseDef, smoothClip } from '../pose';
import { BONEZ_ANIMS } from './bonez';
import { JAZEEK_ANIMS } from './jazeek';

const BS = BONEZ_ANIMS.stance;
const JS = JAZEEK_ANIMS.stance;

// ------------------------------------------------------------------ Manuellsen
// 5000 Kurden: phone to the ear ("Sag was gegen mich..."), then a sweeping arm wave forward (projectile at f20)
const phone: PoseDef = { aim: { shR: [0.35, 0.2, 0.55], elR: [-0.35, 1, 0.1] }, j: { head: [0, 14, 8], chest: [0, 8, 4], shL: [24, 0, 26], elL: [0, 0, 60] } };
const wave: PoseDef = {
  x: 0.06,
  aim: { shL: [1, 0.55, -0.2], elL: [1, 0.7, -0.15], shR: [-0.3, -1, 0.3], elR: [0.3, -0.6, 0.3], face: 0.9 },
  j: { chest: [0, -18, -8], spine: [0, -6, -8], head: [0, -8, -6] },
};
const MANU_KURDEN = smoothClip(
  [
    { f: 1, p: {} },
    { f: 8, p: phone, e: 'out' },
    { f: 14, p: compose(phone, { y: 0.02, j: { head: [0, 18, 14] } }) },
    { f: 20, p: wave, e: 'snap' },
    { f: 34, p: compose(wave, { aim: { shL: [1, 0.75, -0.2], elL: [0.9, 0.9, -0.1] } }) },
    { f: 50, p: {}, e: 'inOut' },
  ],
  BS,
);

// König im Schatten (S12): he sinks into his shadow (hidden 7-16 by the render, a dark silhouette glides through),
// reappears behind the opponent at f16 and spins a backhand into them (contact 22)
const sink: PoseDef = {
  y: -0.28,
  aim: { shL: [-0.5, -0.8, -0.3], elL: [-0.3, -0.9, -0.2], shR: [-0.5, -0.8, 0.3], elR: [-0.3, -0.9, 0.2] },
  j: { spine: [0, 0, 24], chest: [0, -6, 16], head: [0, 0, 14], thL: [16, 20, 60], knL: [0, 0, -90], thR: [-16, 18, 30], knR: [0, 0, -80] },
};
const rise: PoseDef = {
  yaw: 70,
  y: -0.12,
  aim: { shR: [0.2, 0.2, -0.9], elR: [-0.6, 0.3, -0.7], shL: [-0.2, -0.9, -0.3], elL: [0.3, -0.6, -0.3] },
  j: { chest: [0, -30, 6], spine: [0, -12, 6], head: [0, 40, 0], thL: [14, 14, 40], knL: [0, 0, -50], thR: [-14, 12, -10], knR: [0, 0, -40] },
};
const backhand: PoseDef = {
  yaw: 160,
  aim: { shR: [1, 0.22, 0.15], elR: [1, 0.18, 0.1], shL: [-0.3, -0.9, -0.3], elL: [0.2, -0.6, -0.3], face: 0.6 },
  j: { chest: [0, 26, -6], spine: [0, 12, -6], hips: [0, 12, 0], thL: [12, 14, 34], knL: [0, 0, -40], thR: [-12, 12, -24], knR: [0, 0, -16] },
};
const MANU_SCHATTEN = smoothClip(
  [
    { f: 1, p: {} },
    { f: 5, p: sink, e: 'in' },
    { f: 16, p: compose(sink, { yaw: 30 }) },
    { f: 19, p: rise, e: 'out' },
    { f: 22, p: backhand, e: 'snap' },
    { f: 27, p: compose(backhand, { yaw: 168 }) },
    // unwinds with his back to them (the swagger), the turn to the new side happens when the move ends
    { f: 40, p: { yaw: 10, j: { head: [0, -40, -6], chest: [0, -10, -4] } }, e: 'inOut' },
    { f: 48, p: {} },
  ],
  BS,
);

// Sofa-Backpfeifen (move part): a lunging two-handed grab, contact f11
const grab: PoseDef = {
  x: 0.16,
  aim: { shL: [0.9, -0.05, -0.3], elL: [0.95, 0.15, -0.15], shR: [0.9, -0.05, 0.3], elR: [0.95, 0.15, 0.15], face: 0.7 },
  j: { spine: [0, 0, -12], chest: [0, -4, -10], thL: [12, 14, 40], knL: [0, 0, -40], thR: [-12, 12, -30], knR: [0, 0, -10] },
};
const MANU_SOFA = smoothClip(
  [
    { f: 1, p: { y: -0.04, j: { chest: [0, -10, 6], shL: [30, 0, 60], elL: [0, 0, 100], shR: [-30, 0, 60], elR: [0, 0, 100] } } },
    { f: 8, p: compose(grab, { x: 0.08 }), e: 'out' },
    { f: 11, p: grab, e: 'snap' },
    { f: 16, p: grab },
    { f: 52, p: {}, e: 'inOut' },
  ],
  BS,
);

// ------------------------------------------------------------------ Lacazette
// Drei Buchstaben (S12): a wind-up, then a flat throw across (the three letters leave at f12, one after another)
const abcWind: PoseDef = {
  x: -0.04,
  aim: { shR: [-0.4, 0.3, 0.85], elR: [-0.6, 0.5, 0.6], shL: [0.7, -0.2, -0.5], elL: [0.8, 0.3, -0.4] },
  j: { chest: [0, -36, 4], spine: [0, -14, 2], head: [0, 26, -2] },
};
const abcThrow: PoseDef = {
  x: 0.1,
  aim: { shR: [1, 0.12, 0.05], elR: [1, 0.08, -0.05], shL: [-0.3, -0.9, -0.4], elL: [0.2, -0.7, -0.3], face: 0.9 },
  j: { chest: [0, 30, -6], spine: [0, 12, -8], hips: [0, 10, 0], thL: [12, 14, 34], knL: [0, 0, -36], thR: [-12, 12, -24], knR: [0, 0, -10] },
};
const LACA_ABC = smoothClip(
  [
    { f: 1, p: {} },
    { f: 8, p: abcWind, e: 'out' },
    { f: 12, p: abcThrow, e: 'snap' },
    { f: 18, p: compose(abcThrow, { aim: { shR: [0.9, -0.2, 0.3], elR: [0.8, -0.3, 0.3] } }) },
    { f: 24, p: compose(abcThrow, { x: 0.06, j: { head: [0, -4, -6] } }), e: 'out' },
    { f: 40, p: {}, e: 'inOut' },
  ],
  JS,
);

// Chart-Einstieg (S12): crouch, then straight up on the chart curve with the right fist high (hit 5-14, airborne
// until landing); lands into a crouch
const chartLoad: PoseDef = { y: -0.2, aim: { shR: [0.4, -0.7, 0.4], elR: [0.6, 0.6, 0.3] }, j: { spine: [0, 0, 14], chest: [0, -10, 10], thL: [12, 14, 50], knL: [0, 0, -70], thR: [-12, 12, 20], knR: [0, 0, -60] } };
const chartUp: PoseDef = {
  x: 0.06,
  s: { aR: 0.1, sq: -0.06 },
  aim: { shR: [0.3, 1, 0.1], elR: [0.15, 1, 0.05], shL: [-0.2, -0.9, -0.3], elL: [0.4, -0.5, -0.3], face: 0.7 },
  j: { spine: [0, 8, -10], chest: [0, 16, -12], head: [0, 0, -16], thL: [12, 14, 70], knL: [0, 0, -90], thR: [-12, 12, -6], knR: [0, 0, -10], ftR: [0, 0, 30] },
};
const LACA_CHART = smoothClip(
  [
    { f: 1, p: chartLoad },
    { f: 4, p: compose(chartLoad, { y: -0.24 }) },
    { f: 6, p: chartUp, e: 'snap' },
    { f: 14, p: compose(chartUp, { aim: { shR: [0.2, 1, 0.15], elR: [0.1, 1, 0.1] } }) },
    { f: 24, p: compose(chartUp, { s: {}, j: { thL: [12, 14, 40], knL: [0, 0, -60] } }), e: 'out' },
    { f: 40, p: { y: 0, j: { thL: [12, 14, 30], knL: [0, 0, -40], thR: [-12, 12, -10], knR: [0, 0, -30] } } },
    { f: 56, p: {}, e: 'inOut' },
  ],
  JS,
);

// 70 Schüsse (move part): a whistle with two fingers, then points across the stage (the car comes at f22)
const whistle: PoseDef = { aim: { shR: [0.4, 0.25, 0.5], elR: [-0.3, 1, 0.12] }, j: { head: [0, 6, 10], chest: [0, 8, 6] } };
const point: PoseDef = {
  x: 0.04,
  aim: { shR: [1, 0.08, 0.2], elR: [1, 0.06, 0.2], shL: [-0.2, -1, -0.3], elL: [0.3, -0.7, -0.2], face: 0.9 },
  j: { chest: [0, -14, -4], head: [0, -6, -4] },
};
const LACA_GWAGON = smoothClip(
  [
    { f: 1, p: {} },
    { f: 10, p: whistle, e: 'out' },
    { f: 18, p: compose(whistle, { y: 0.02 }) },
    { f: 22, p: point, e: 'snap' },
    { f: 40, p: compose(point, { j: { head: [0, -2, -8] } }) },
    { f: 54, p: {}, e: 'inOut' },
  ],
  JS,
);

// ------------------------------------------------------------------ Jazeek: Ninetynine (move part)
// grabs the chain at the chest, whips it forward in an arc (contact 9-14)
const chainGrab: PoseDef = { aim: { shR: [0.45, -0.3, 0.6], elR: [0.1, 0.9, 0.4] }, j: { head: [0, 0, -10], chest: [0, -10, 4] } };
const whip: PoseDef = {
  x: 0.14,
  s: { aR: 0.1 },
  aim: { shR: [1, 0.35, 0.1], elR: [1, 0.3, 0.05], shL: [-0.3, -1, -0.3], elL: [0.4, -0.6, -0.3], face: 0.8 },
  j: { hips: [0, 16, 0], spine: [0, 10, -12], chest: [0, 22, -10], thL: [12, 14, 34], knL: [0, 0, -40], thR: [-12, 12, -30], knR: [0, 0, -6] },
};
const JAZ_99 = smoothClip(
  [
    { f: 1, p: {} },
    { f: 5, p: chainGrab, e: 'out' },
    { f: 9, p: whip, e: 'snap' },
    { f: 14, p: compose(whip, { aim: { shR: [1, 0.15, 0.1], elR: [1, 0.1, 0.05] } }) },
    { f: 30, p: compose(whip, { x: 0.06, j: { chest: [0, 10, -4] } }), e: 'out' },
    { f: 58, p: {}, e: 'inOut' },
  ],
  JS,
);

export const MANU_MOVES: Record<string, Clip> = { manu_kurden: MANU_KURDEN, manu_schatten: MANU_SCHATTEN, manu_sofa: MANU_SOFA };
export const LACA_MOVES: Record<string, Clip> = { laca_abc: LACA_ABC, laca_chart: LACA_CHART, laca_gwagon: LACA_GWAGON };
export const JAZ_MOVES: Record<string, Clip> = { jaz_99: JAZ_99 };
export const BON_MOVES: Record<string, Clip> = { bon_team: BONEZ_ANIMS.moves.bon_palm };
