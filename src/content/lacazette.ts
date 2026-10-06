// LACAZETTE — street kid from Berlin (D42). A test fighter for the PO's cartoon style: drawn as a 2D cutout from the
// PO's reference (render/cutout.ts). Movement and normals only, no cards yet (PO: first see how the style works in
// the game). The normals are Jazeek's quick street set.
import type { FighterDef } from '../core/defs';
import { m, mps } from '../core/math';
import { JAZEEK } from './jazeek';
import { box } from './build';

const normals = Object.fromEntries(Object.entries(JAZEEK.moves).filter(([, mv]) => mv.kind === 'normal' || mv.kind === 'throw'));

export const LACAZETTE: FighterDef = {
  ...JAZEEK,
  id: 'lacazette',
  name: 'LACAZETTE',
  tagline: 'Straßenjunge aus Berlin. Schnell, frech, kalt.',
  archetype: 'Straße & Tempo',
  health: 980,
  walkF: mps(3.8),
  height: m(1.84),
  hurtStand: [box(-0.24, 0.26, 0, 1.48), box(-0.13, 0.2, 1.48, 1.84)],
  moves: normals,
  cards: [],
  cinematics: {},
  defaultLoadout: [],
};
