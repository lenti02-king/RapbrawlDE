// MANUELLSEN — heavyweight from Mülheim an der Ruhr, also a boxer (D42/D43). The PO's modelle-3 3D model; the
// normals are Bonez's boxing set on a heavier, slower body. Abilities from his memes (PO session 11):
//  - 5000 Kurden ("Sag was gegen mich – 5000 Kurden stehen auf"): he calls, a crowd of men storms from behind him across
//    the stage: three hits, blockable (mid), ignores projectiles (a crowd does not stop for a sound wave).
//  - König im Schatten (S12, his autobiography; replaces Beton, PO: "nur ein Schlag"): through the opponent as a
//    shadow, a backhand from behind.
//  - Sofa-Backpfeifen (signature, the slap scandal): grabs, a black sofa appears behind the opponent, they drop onto
//    it, three slaps with straight arms: batsch, batsch, batsch - they sleep it off on the sofa (S12: KO, Zzz), then
//    stage 2: lights down, a crown, KÖNIG IM SCHATTEN, and the sofa goes over backwards.
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
    // König im Schatten (his autobiography's title): he sinks into his own shadow, glides through the opponent as a
    // dark silhouette (strike- and projectile-proof, no collision) and comes out behind them with a backhand
    key: 'manu_schatten',
    name: 'König im Schatten',
    kind: 'special',
    total: 48,
    strikeInvuln: [4, 20],
    passThrough: [4, 24],
    velocity: [
      { frame: 6, vx: mps(2.5) },
      { frame: 16, vx: 0, warp: m(0.8) },
    ],
    hits: [
      hit(22, 25, {
        damage: 85,
        chip: 8,
        strength: 2,
        hitstun: 26,
        blockstun: 16,
        pushHit: 1200,
        knockdown: true,
        reverse: true,
        boxes: [box(-1.05, -0.1, 0.9, 1.75)],
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
      id: 'manu_schatten',
      name: 'König im Schatten',
      category: 'mobility',
      cost: 100,
      move: 'manu_schatten',
      role: 'Durch den Gegner, Schlag von hinten',
      description: '„König im Schatten“: Er versinkt in seinem Schatten, gleitet als dunkle Silhouette durch den Gegner hindurch – Schläge und Projektile gehen ins Leere – und taucht hinter ihm mit einem Rückhandschlag auf.',
      ai: 'range',
      aiRange: [0.6, 2.2],
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
    // stage 1: three slaps, the last one knocks them out cold on the sofa (they sleep: Zzz); stage 2: lights out,
    // the crown comes down - KÖNIG IM SCHATTEN - and he kicks the sofa over backwards with the sleeper on it
    manu_sofa: {
      id: 'manu_sofa',
      frames: 260,
      startDx: m(0.95),
      hits: [
        { frame: 70, damage: 70, strength: 2 },
        { frame: 92, damage: 70, strength: 2 },
        { frame: 116, damage: 110, strength: 3 },
        { frame: 226, damage: 40, strength: 3 },
      ],
      endDx: m(2.6),
    },
  },
  defaultLoadout: ['manu_kurden', 'manu_schatten', 'manu_sofa'],
};
