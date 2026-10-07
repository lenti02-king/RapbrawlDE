// LACAZETTE — Berlin-Steglitz (D42/D43). The PO's modelle-3 3D model; the normals are Jazeek's quick street set.
// Abilities from his image and songs (PO session 11):
//  - Kalter Blick: he slides the sunglasses down, a glint flashes across the stage at eye height: fast, but it flies
//    over a crouching opponent (above every crouch hurtbox).
//    Blinds on hit (long stun).
//  - Daunenweste: the puffer vest puffs up into armour, he shoulder-charges through one hit.
//  - 70 Schüsse (signature, from his line "...das waren 70 Schüsse aus dem G-Wagon"): a black off-roader comes in from
//    far away, drifts so the driver's side faces the opponent, and fires from the window; then the line appears.
import type { FighterDef, MoveDef } from '../core/defs';
import { m, mps } from '../core/math';
import { JAZEEK } from './jazeek';
import { box, hit } from './build';

const normals = Object.fromEntries(Object.entries(JAZEEK.moves).filter(([, mv]) => mv.kind === 'normal' || mv.kind === 'throw'));

const specials: MoveDef[] = [
  {
    key: 'laca_blick',
    name: 'Kalter Blick',
    kind: 'special',
    total: 38,
    hits: [],
    projectile: {
      frame: 13,
      def: {
        kind: 'glint',
        x: m(0.45),
        y: m(1.6),
        speed: mps(17),
        half: { w: m(0.32), h: m(0.22) },
        life: 26,
        hit: hit(1, 1, {
          damage: 34,
          chip: 6,
          strength: 1,
          hitstun: 36,
          blockstun: 12,
          pushHit: 300,
          boxes: [],
          meterOnHit: 0,
          meterOnBlock: 0,
        }),
      },
    },
  },
  {
    key: 'laca_weste',
    name: 'Daunenweste',
    kind: 'special',
    total: 46,
    armor: { start: 3, end: 22, hits: 1 },
    velocity: [
      { frame: 6, vx: mps(7.2) },
      { frame: 21, vx: 0 },
    ],
    hits: [
      hit(10, 20, {
        damage: 85,
        chip: 8,
        strength: 2,
        hitstun: 24,
        blockstun: 18,
        pushHit: 1500,
        knockdown: true,
        boxes: [box(0.05, 0.75, 0.75, 1.6)],
        meterOnHit: 0,
        meterOnBlock: 0,
      }),
    ],
  },
  {
    key: 'laca_gwagon',
    name: '70 Schüsse',
    kind: 'signature',
    total: 54,
    superFlash: 36,
    fullInvuln: [1, 10],
    hits: [],
    projectile: {
      frame: 22,
      def: {
        kind: 'gwagon',
        x: m(-3.6),
        y: m(0.8),
        speed: mps(16),
        half: { w: m(1.25), h: m(0.8) },
        life: 72,
        noClash: true,
        hit: hit(1, 1, {
          damage: 30,
          chip: 24,
          strength: 3,
          blockstun: 22,
          hitstop: 12,
          knockdown: true,
          launch: { vx: 420, vy: 900 },
          cinematic: 'laca_gwagon',
          pushBlock: 1600,
          boxes: [],
          meterOnHit: 0,
          meterOnBlock: 0,
        }),
      },
    },
  },
];

export const LACAZETTE: FighterDef = {
  ...JAZEEK,
  id: 'lacazette',
  name: 'LACAZETTE',
  tagline: 'Steglitz. Sonnenbrille auf, Puls unten.',
  archetype: 'Straße & Tempo',
  health: 980,
  walkF: mps(3.8),
  height: m(1.84),
  hurtStand: [box(-0.24, 0.26, 0, 1.48), box(-0.13, 0.2, 1.48, 1.84)],
  moves: { ...normals, ...Object.fromEntries(specials.map((mv) => [mv.key, mv])) },
  cards: [
    {
      id: 'laca_blick',
      name: 'Kalter Blick',
      category: 'zoning',
      cost: 100,
      move: 'laca_blick',
      role: 'Blendender Lichtblitz, hoch',
      description: 'Er schiebt die Sonnenbrille runter – ein Lichtblitz zischt über die Bühne und blendet lange. Schnell, aber hoch: drunter wegducken.',
      ai: 'zone',
    },
    {
      id: 'laca_weste',
      name: 'Daunenweste',
      category: 'offense',
      cost: 200,
      move: 'laca_weste',
      role: 'Gepanzerter Schulterangriff',
      description: 'Die Daunenweste plustert sich zur Rüstung auf: er rammt mit der Schulter durch einen Treffer hindurch und wirft den Gegner um.',
      ai: 'range',
      aiRange: [0.6, 2.6],
    },
    {
      id: 'laca_gwagon',
      name: '70 Schüsse',
      category: 'signature',
      cost: 300,
      move: 'laca_gwagon',
      role: 'Cinematic Signature, quer über die Bühne',
      description: '„…das waren 70 Schüsse aus dem G-Wagon.“ Ein schwarzer Geländewagen rauscht heran, driftet quer und feuert aus dem Fenster. Blockbar, aber teuer.',
      ai: 'combo',
    },
  ],
  cinematics: {
    laca_gwagon: {
      id: 'laca_gwagon',
      frames: 170,
      startDx: m(3.0),
      hits: [
        { frame: 64, damage: 35, strength: 1 },
        { frame: 74, damage: 35, strength: 1 },
        { frame: 84, damage: 35, strength: 1 },
        { frame: 94, damage: 35, strength: 1 },
        { frame: 104, damage: 40, strength: 2 },
        { frame: 116, damage: 90, strength: 3 },
      ],
      endDx: m(2.0), // the shots push the victim back toward Lacazette (render: cines11 SEVENTY_SHOTS endX)
    },
  },
  defaultLoadout: ['laca_blick', 'laca_weste', 'laca_gwagon'],
};
