// MANUELLSEN — heavyweight from Mülheim an der Ruhr, also a boxer (D42). A test fighter for the PO's cartoon style:
// drawn as a 2D cutout from the PO's reference (render/cutout.ts). Movement and normals only, no cards yet (PO: first
// see how the style works in the game). The normals are Bonez's boxing set on a heavier, slower body.
import type { FighterDef } from '../core/defs';
import { m, mps } from '../core/math';
import { BONEZ } from './bonez';
import { box } from './build';

const normals = Object.fromEntries(Object.entries(BONEZ.moves).filter(([, mv]) => mv.kind === 'normal' || mv.kind === 'throw'));

export const MANUELLSEN: FighterDef = {
  ...BONEZ,
  id: 'manuellsen',
  name: 'MANUELLSEN',
  tagline: 'Schwergewicht aus Mülheim. Boxt, wie er rappt.',
  archetype: 'Schwergewichts-Boxer',
  health: 1100,
  walkF: mps(2.4),
  walkB: mps(2.0),
  dashF: { frames: 20, speed: mps(5.0) },
  dashB: { frames: 22, speed: mps(3.8), invuln: 6 },
  pushHalf: m(0.33),
  height: m(1.92),
  hurtStand: [box(-0.33, 0.35, 0, 1.6), box(-0.15, 0.2, 1.6, 1.92)],
  hurtCrouch: [box(-0.36, 0.38, 0, 1.14)],
  hurtAir: [box(-0.33, 0.33, 0.1, 1.7)],
  moves: normals,
  cards: [],
  cinematics: {},
  defaultLoadout: [],
};
