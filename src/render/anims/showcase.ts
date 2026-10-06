// Menu showcase poses (D42): the fighters stand tall in the menus (PO: the crouched fight stance looked "crippled"
// there, it is made for the side view). Upright, feet apart, chest out; the waiting loop in ui/menu/figures.ts
// breathes on top. Authored for the menus' 3/4 front view (scripts/posegrid.mjs). Presentation only.
// Leg axes: thigh x = sideways (abduction), y = twist, z = forward; knee z < 0 bends. Arms via aim (character space:
// x forward, y up, z toward the camera in the side view; the left arm is the far one).
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

export const SHOWCASE: Record<string, PoseDef> = {
  jazeek: STARE,
  bonez: READY,
};

export function showcasePose(id: string, _stance: PoseDef): PoseDef {
  return SHOWCASE[id] ?? STARE;
}
