// LACAZETTE — Berlin-Steglitz (D42/D43). The PO's modelle-3 3D model; the normals are Jazeek's quick street set.
// Abilities from his image and songs (PO session 11):
//  - S12 (PO: the old normals had nothing to do with him): Drei Buchstaben (all his song titles are three characters:
//    FTW, CUP, PKS, H2K ...) and Chart-Einstieg (newcomer straight into the charts: a rising chart curve, anti-air).
//  - 70 Schüsse (signature, from his line "...das waren 70 Schüsse aus dem G-Wagon"): a black off-roader comes in from
//    far away, drifts so the driver's side faces the opponent, and fires from the window; then the line appears.
import type { FighterDef, MoveDef } from '../core/defs';
import { jumpPhysics, m, mps } from '../core/math';
import { JAZEEK } from './jazeek';
import { box, hit } from './build';

const [chartG, chartVy] = jumpPhysics(30, 1.5);
const normals = Object.fromEntries(Object.entries(JAZEEK.moves).filter(([, mv]) => mv.kind === 'normal' || mv.kind === 'throw'));

const specials: MoveDef[] = [
  {
    // Drei Buchstaben: every one of his song titles is three characters (FTW, CUP, PKS, H2K ...) - he throws three big
    // chrome letters one after another, F-T-W: three hits at chest height
    key: 'laca_abc',
    name: 'Drei Buchstaben',
    kind: 'special',
    total: 40,
    hits: [],
    projectile: {
      frame: 12,
      def: {
        kind: 'letters',
        x: m(0.5),
        y: m(1.15),
        speed: mps(7),
        half: { w: m(0.6), h: m(0.32) },
        life: 60,
        hits: 3,
        every: 6,
        hit: hit(1, 1, {
          damage: 17,
          chip: 4,
          strength: 1,
          hitstun: 18,
          blockstun: 10,
          pushHit: 120,
          pushBlock: 160,
          boxes: [],
          meterOnHit: 0,
          meterOnBlock: 0,
        }),
      },
    },
  },
  {
    // Chart-Einstieg: straight in at number one - he rides a rising green chart curve up out of the floor; startup is
    // strike-proof, it launches, he lands open (anti-air)
    key: 'laca_chart',
    name: 'Chart-Einstieg',
    kind: 'special',
    total: 56,
    strikeInvuln: [1, 8],
    endOnLand: true,
    landingLag: 16,
    gravity: chartG,
    velocity: [{ frame: 5, vx: mps(2.2), vy: chartVy }],
    hits: [
      hit(5, 14, {
        damage: 80,
        chip: 8,
        strength: 2,
        blockstun: 14,
        launch: { vx: 200, vy: 1250 },
        boxes: [box(0.0, 0.7, 0.6, 2.2)],
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
      id: 'laca_abc',
      name: 'Drei Buchstaben',
      category: 'zoning',
      cost: 100,
      move: 'laca_abc',
      role: 'Drei Treffer auf Brusthöhe',
      description: 'Jeder seiner Songtitel hat drei Zeichen – er wirft sie: F, T, W. Drei Chrom-Buchstaben fliegen nacheinander über die Bühne und treffen dreimal. Blockbar.',
      ai: 'zone',
    },
    {
      id: 'laca_chart',
      name: 'Chart-Einstieg',
      category: 'counter',
      cost: 200,
      move: 'laca_chart',
      role: 'Aufsteiger gegen Sprünge',
      description: 'Neu eingestiegen – direkt auf Platz 1: Er schießt auf einer grünen Chart-Kurve nach oben und reißt den Gegner mit. Beim Absprung unverwundbar, landet aber offen.',
      ai: 'counter',
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
      // stage 1: the drive-by (bursts 64-116); stage 2 (S12): he walks up, slides the sunglasses down - cold stare -
      // and slams them into the car's bonnet (226); the car pulls away
      frames: 250,
      startDx: m(3.0),
      hits: [
        { frame: 64, damage: 35, strength: 1 },
        { frame: 74, damage: 35, strength: 1 },
        { frame: 84, damage: 35, strength: 1 },
        { frame: 94, damage: 35, strength: 1 },
        { frame: 104, damage: 40, strength: 2 },
        { frame: 116, damage: 60, strength: 3 },
        { frame: 226, damage: 50, strength: 3 },
      ],
      endDx: m(2.0), // the shots push the victim back toward Lacazette (render: cines11 SEVENTY_SHOTS endX)
    },
  },
  defaultLoadout: ['laca_abc', 'laca_chart', 'laca_gwagon'],
};
