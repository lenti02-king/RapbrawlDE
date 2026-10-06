// Stances for the 2D cutout fighters (D42): the art is drawn from the front, so the side-view guard of the 3D sets
// (both forearms toward the opponent) reads as crossed arms there. This guard keeps each fist on its own side in
// front of the chest: elbows out and down, forearms up (aim: x toward the opponent, y up, z toward the camera).
import { compose, type PoseDef } from '../pose';

/** Boxer's guard, front view: lead fist (shL, toward the opponent) a bit higher, rear fist at the chin. */
export const CUTOUT_GUARD: PoseDef = {
  aim: { shL: [0.32, -1, 0.1], elL: [-0.1, 1, 0.25], shR: [-0.42, -1, 0.1], elR: [0.22, 1, 0.25] },
};

/** Street stance, front view: hands lower and looser. */
export const CUTOUT_LOOSE: PoseDef = {
  aim: { shL: [0.3, -1, 0.1], elL: [0.25, 0.7, 0.3], shR: [-0.35, -1, 0.1], elR: [0.05, 0.8, 0.3] },
};

export const cutoutStance = (base: PoseDef, guard: PoseDef): PoseDef => compose(base, guard);
