// MANUELLSEN — heavyweight from Mülheim an der Ruhr, also a boxer (D42/D43). The PO's modelle-3 3D model; the
// normals are Bonez's boxing set on a heavier, slower body. Abilities from his memes (PO session 11):
//  - 5000 Kurden ("Sag was gegen mich – 5000 Kurden stehen auf"): he calls, a crowd of men storms from behind him across
//    the stage: three hits, blockable (mid), ignores projectiles (a crowd does not stop for a sound wave).
//  - Beton ("Du musst immer Beton sein"): turns to concrete: absorbs up to three strikes, then a concrete right hand.
//  - Sofa-Backpfeifen (signature, the slap scandal): grabs, a black sofa appears behind the opponent, they drop onto
//    it, and he slaps them three times with straight arms: batsch, batsch, batsch — the last one tips the sofa over.
import type { FighterDef, MoveDef } from '../core/defs';
import { m, mps } from '../core/math';
import { BONEZ } from './bonez';
import { box, hit } from './build';

const normals = Object.fromEntries(Object.entries(BONEZ.moves).filter(([, mv]) => mv.kind === 'normal' || mv.kind === 'throw'));

const specials: MoveDef[] = [
  {
    key: 'manu_kurden',
    name: '5000 Kurden',
    kind: 'special',
    total: 50,
    hits: [],
    projectile: {
      frame: 20,
      def: {
        kind: 'mob',
        x: m(-1.4),
        y: m(0.85),
        speed: mps(5.2),
        half: { w: m(1.05), h: m(0.85) },
        life: 96,
        hits: 3,
        every: 9,
        noClash: true,
        hit: hit(1, 1, {
          damage: 30,
          chip: 8,
          strength: 1,
          hitstun: 20,
          blockstun: 14,
          pushHit: 420,
          pushBlock: 520,
          boxes: [],
          meterOnHit: 0,
          meterOnBlock: 0,
        }),
      },
    },
  },
  {
    key: 'manu_beton',
    name: 'Beton',
    kind: 'special',
    total: 62,
    armor: { start: 4, end: 40, hits: 3 },
    velocity: [
      { frame: 38, vx: mps(2.6) },
      { frame: 45, vx: 0 },
    ],
    hits: [
      hit(42, 45, {
        damage: 95,
        chip: 10,
        strength: 2,
        hitstun: 26,
        blockstun: 18,
        pushHit: 1400,
        knockdown: true,
        boxes: [box(0.25, 1.2, 1.05, 1.75)],
        meterOnHit: 0,
        meterOnBlock: 0,
      }),
    ],
  },
  {
    key: 'manu_sofa',
    name: 'Sofa-Backpfeifen',
    kind: 'signature',
    total: 52,
    superFlash: 36,
    strikeInvuln: [1, 8],
    velocity: [
      { frame: 3, vx: mps(5.5) },
      { frame: 13, vx: 0 },
    ],
    hits: [
      hit(11, 15, {
        damage: 30,
        strength: 3,
        level: 'unblockable',
        boxes: [box(0.15, 1.05, 0.4, 1.8)],
        cinematic: 'manu_sofa',
        grabLike: true,
        meterOnHit: 0,
        meterOnBlock: 0,
      }),
    ],
  },
];

export const MANUELLSEN: FighterDef = {
  ...BONEZ,
  id: 'manuellsen',
  name: 'MANUELLSEN',
  tagline: 'Schwergewicht aus Mülheim. Immer Beton.',
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
  moves: { ...normals, ...Object.fromEntries(specials.map((mv) => [mv.key, mv])) },
  cards: [
    {
      id: 'manu_kurden',
      name: '5000 Kurden',
      category: 'zoning',
      cost: 200,
      move: 'manu_kurden',
      role: 'Meute stürmt über die Bühne',
      description: '„Sag was gegen mich – 5000 Kurden stehen auf!“ Eine Meute stürmt von hinten über die Bühne und trifft dreimal. Blockbar, Projektile halten sie nicht auf.',
      ai: 'zone',
    },
    {
      id: 'manu_beton',
      name: 'Beton',
      category: 'counter',
      cost: 100,
      move: 'manu_beton',
      role: 'Panzerung + harte Rechte',
      description: '„Du musst immer Beton sein.“ Er wird zu Beton, schluckt bis zu drei Schläge und antwortet mit einer betonharten Rechten.',
      ai: 'counter',
    },
    {
      id: 'manu_sofa',
      name: 'Sofa-Backpfeifen',
      category: 'signature',
      cost: 300,
      move: 'manu_sofa',
      role: 'Cinematic Signature, Griff',
      description: 'Er packt den Gegner, ein schwarzes Sofa erscheint – hinsetzen! Dann drei Backpfeifen mit ausgestreckten Armen: batsch, batsch, batsch. Nicht blockbar, aber ausweichbar.',
      ai: 'range',
      aiRange: [0.3, 1.2],
    },
  ],
  cinematics: {
    manu_sofa: {
      id: 'manu_sofa',
      frames: 160,
      startDx: m(0.95),
      hits: [
        { frame: 70, damage: 70, strength: 2 },
        { frame: 92, damage: 70, strength: 2 },
        { frame: 116, damage: 140, strength: 3 },
      ],
      endDx: m(2.6),
    },
  },
  defaultLoadout: ['manu_kurden', 'manu_beton', 'manu_sofa'],
};
