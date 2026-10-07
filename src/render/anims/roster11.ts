// Move clips for the D43 abilities (session 11): Manuellsen (5000 Kurden, Beton, Sofa-Backpfeifen), Lacazette (Kalter
// Blick, Daunenweste, 70 Schüsse), Jazeek's Ninetynine and Bonez's Ohne mein Team. Frame numbers are move frames
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

// Beton: plants wide, flexes (turning to concrete 4-36), then a heavy right hand on f42
const plant: PoseDef = {
  y: -0.1,
  aim: { shL: [0.4, -0.9, -0.35], elL: [0.6, 0.75, -0.1], shR: [0.35, -0.9, 0.35], elR: [0.55, 0.8, 0.1] },
  j: { chest: [0, -6, 6], head: [0, 0, -8], thL: [16, 24, 40], knL: [0, 0, -52], thR: [-16, 18, -34], knR: [0, 0, -40] },
};
const flex: PoseDef = compose(plant, { y: -0.12, s: { sq: 0.04 }, j: { chest: [0, -4, 10], spine: [0, 0, 4], neck: [0, 0, -6] } });
const concreteRight: PoseDef = {
  x: 0.2,
  s: { aR: 0.12 },
  aim: { shR: [1, 0.2, -0.05], elR: [1, 0.18, -0.05], shL: [0.4, -0.8, -0.35], elL: [0.5, 0.8, -0.1], face: 0.85 },
  j: { hips: [0, 14, 0], spine: [0, 10, -16], chest: [0, 18, -12], thL: [12, 14, 40], knL: [0, 0, -44], thR: [-12, 12, -36], knR: [0, 0, -8], ftR: [0, 0, 30] },
};
const MANU_BETON = smoothClip(
  [
    { f: 1, p: {} },
    { f: 6, p: plant, e: 'out' },
    { f: 16, p: flex, e: 'inOut' },
    { f: 26, p: plant, e: 'inOut' },
    { f: 34, p: flex, e: 'inOut' },
    { f: 38, p: compose(plant, { x: -0.06, j: { chest: [0, -30, 4], shR: [-40, 0, -20], elR: [0, 0, 120] } }), e: 'out' },
    { f: 42, p: concreteRight, e: 'snap' },
    { f: 47, p: concreteRight },
    { f: 62, p: {}, e: 'inOut' },
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
// Kalter Blick: right hand slides the sunglasses down the nose, chin lowers, a cold stare (glint at f13)
const glasses: PoseDef = { aim: { shR: [0.3, 0.3, 0.55], elR: [-0.2, 1, 0.25] }, j: { head: [0, 0, -4], chest: [0, -6, 2] } };
const stare: PoseDef = { aim: { shR: [0.3, 0.15, 0.55], elR: [-0.1, 1, 0.3], face: 1 }, j: { head: [0, -4, -14], neck: [0, 0, -6], chest: [0, -10, -2] } };
const LACA_BLICK = smoothClip(
  [
    { f: 1, p: {} },
    { f: 8, p: glasses, e: 'out' },
    { f: 13, p: stare, e: 'snap' },
    { f: 26, p: compose(stare, { j: { head: [0, -2, -16] } }) },
    { f: 38, p: {}, e: 'inOut' },
  ],
  JS,
);

// Daunenweste: arms cross in front, shoulder dropped, a charge (f6-21), hit 10-20
const tuck: PoseDef = {
  y: -0.08,
  aim: { shL: [0.6, -0.4, 0.4], elL: [0.2, 0.8, 0.6], shR: [0.5, -0.5, 0.5], elR: [-0.2, 0.8, 0.5], face: 0.8 },
  j: { spine: [0, 20, -14], chest: [0, 30, -10], head: [0, -14, -4], thL: [12, 14, 40], knL: [0, 0, -50], thR: [-12, 12, -26], knR: [0, 0, -20] },
};
const LACA_WESTE = smoothClip(
  [
    { f: 1, p: {} },
    { f: 6, p: compose(tuck, { x: -0.06, s: { sq: 0.06 } }), e: 'out' },
    { f: 10, p: compose(tuck, { x: 0.12, s: { sq: -0.04 } }), e: 'snap' },
    { f: 20, p: compose(tuck, { x: 0.14 }) },
    { f: 28, p: compose(tuck, { x: 0.04, y: -0.04, j: { chest: [0, 10, -4] } }), e: 'out' },
    { f: 46, p: {}, e: 'inOut' },
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

export const MANU_MOVES: Record<string, Clip> = { manu_kurden: MANU_KURDEN, manu_beton: MANU_BETON, manu_sofa: MANU_SOFA };
export const LACA_MOVES: Record<string, Clip> = { laca_blick: LACA_BLICK, laca_weste: LACA_WESTE, laca_gwagon: LACA_GWAGON };
export const JAZ_MOVES: Record<string, Clip> = { jaz_99: JAZ_99 };
export const BON_MOVES: Record<string, Clip> = { bon_team: BONEZ_ANIMS.moves.bon_palm };
