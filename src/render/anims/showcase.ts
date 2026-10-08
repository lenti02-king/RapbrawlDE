// Menu showcase poses (D42): the fighters stand tall in the menus (PO: the crouched fight stance looked "crippled"
// there, it is made for the side view). Upright, feet apart, chest out; the waiting loop in ui/menu/figures.ts
// breathes on top. Authored for the menus' 3/4 front view (scripts/posegrid.mjs). Presentation only.
// Leg axes: thigh x = sideways (abduction), y = twist, z = forward; knee z < 0 bends. Arms via aim (character space:
// x forward, y up, z toward the camera in the side view; the left arm is the far one).
import { baseOf } from '../../core/registry';
import { compose, type PoseDef } from '../pose';

const LEGS: PoseDef = {
  j: { thL: [12, 10, 4], knL: [0, 0, -6], ftL: [0, 0, 2], thR: [-12, 8, -4], knR: [0, 0, -6], ftR: [0, 0, 4] },
};

/** Stare-down: arms hang loose beside the body, fists closed, chest out, chin up. */
const STARE: PoseDef = compose(LEGS, {
  y: 0,
  aim: { shL: [0.05, -1, -0.28], elL: [0.25, -0.95, -0.05], shR: [0.05, -1, 0.28], elR: [0.25, -0.95, 0.05] },
  j: { hips: [0, -10, 0], spine: [0, -2, 2], chest: [0, -6, 6], neck: [0, 0, -2], head: [0, 4, -8] },
});

/** Ready: fists low in front of the hips, forearms forward, head a touch down (heavyweight look). */
const READY: PoseDef = compose(LEGS, {
  y: 0,
  aim: { shL: [0.15, -0.98, -0.3], elL: [0.6, -0.6, -0.1], shR: [0.12, -0.98, 0.3], elR: [0.6, -0.6, 0.12] },
  j: { hips: [0, -10, 0], spine: [0, -2, -2], chest: [0, -6, -2], neck: [0, 0, 4], head: [0, 4, 4] },
});

// Waiting poses per fighter (S12, PO: "die Charaktere stehen wie eine Kerze, sie müssen lockere Posen einnehmen, die
// zum jeweiligen Charakter passen, als wären die auf mich am warten"). Each one is the fighter's own attitude.

/** Jazeek: weight on the near leg, the far knee loose, head tilted, one hand on his chain. */
const JAZEEK: PoseDef = compose(STARE, {
  j: { thL: [18, 12, 10], knL: [0, 0, -20], ftL: [0, 0, 8], thR: [-6, 6, -2], knR: [0, 0, -3], hips: [-5, -10, 0], chest: [5, -8, 4], head: [7, 12, -2] },
  aim: { shR: [0.25, -0.8, 0.45], elR: [0.35, 0.75, -0.55], shL: [0, -1, -0.22], elL: [0.2, -0.95, 0] },
});

/** Bonez: arms crossed, chin up - Hamburg attitude. */
const BONEZ: PoseDef = compose(READY, {
  j: { head: [0, 6, -10], chest: [0, -4, -4] },
  aim: { shL: [0.35, -0.9, 0], elL: [0.1, 0.05, 1], shR: [0.35, -0.9, 0], elR: [0.1, 0.1, -1] },
});

/** Manuellsen: wide heavyweight stance, wrapped fists pressed together in front, looking down on you. */
const MANUELLSEN: PoseDef = compose(STARE, {
  j: { thL: [18, 10, 4], knL: [0, 0, -10], thR: [-18, 8, -4], knR: [0, 0, -10], chest: [0, -4, 4], head: [0, 4, 12] },
  aim: { shL: [0.3, -0.9, -0.25], elL: [0.55, -0.1, 0.8], shR: [0.3, -0.9, 0.25], elR: [0.55, -0.1, -0.8] },
});

/** Lacazette: cool contrapposto, one hand slicking his hair back, the other loose. */
const LACAZETTE: PoseDef = compose(STARE, {
  j: { thR: [-10, 22, 12], knR: [0, 0, -12], ftR: [0, 0, 6], thL: [10, 6, -2], knL: [0, 0, -2], hips: [4, -12, 0], chest: [-4, -6, 0], head: [-4, 10, 4] },
  aim: { shR: [0.45, 0.05, 0.5], elR: [-0.05, 0.95, -0.35], shL: [-0.15, -0.95, -0.35], elL: [0.3, -0.9, 0.15] },
});

export const SHOWCASE: Record<string, PoseDef> = {
  jazeek: JAZEEK,
  bonez: BONEZ,
  manuellsen: MANUELLSEN,
  lacazette: LACAZETTE,
};

export function showcasePose(id: string, _stance: PoseDef): PoseDef {
  return SHOWCASE[id] ?? SHOWCASE[baseOf(id)] ?? STARE;
}
