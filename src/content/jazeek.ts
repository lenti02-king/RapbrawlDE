// JAZEEK — athletic R&B showman. Tempo, rhythm, show.
// Role (product profile): mobile fighter with fast combos, rhythmic evasion and precise counters.
// Voice is the central motif of his specials. Values are prototype tuning.

import type { FighterDef, MoveDef } from '../core/defs';
import { jumpPhysics, m, mps } from '../core/math';
import { box, hit, simpleMove } from './build';

const [gravity, jumpVy] = jumpPhysics(40, 1.5);

const N = {
  L5: 'jaz_5L',
  L2: 'jaz_2L',
  H5: 'jaz_5H',
  H2: 'jaz_2H',
  jL: 'jaz_jL',
  jH: 'jaz_jH',
  throw: 'jaz_throw',
  LLL: 'jaz_LLL',
  HH: 'jaz_HH',
  HL: 'jaz_HL',
  LLH: 'jaz_LLH',
  L2H: 'jaz_2LH',
};
const LIGHT_CHAINS = [N.L5, N.L2, N.H5, N.H2];

const moves: MoveDef[] = [
  simpleMove(N.L5, 'normal', {
    name: 'Schneller Jab',
    startup: 5,
    active: 2,
    recovery: 8,
    hit: { pushHit: 300, pushBlock: 520, damage: 38, strength: 0, hitstun: 14, blockstun: 11, boxes: [box(0.2, 0.8, 1.12, 1.5)], reaction: 'high' },
    extra: {
      chains: LIGHT_CHAINS,
      targets: { light: { move: N.LLL, minDepth: 1 }, heavy: { move: N.LLH, minDepth: 1 } },
      specialCancel: true,
      hurt: [{ start: 4, end: 10, boxes: [box(0.2, 0.62, 1.2, 1.48)] }],
    },
  }),
  simpleMove(N.L2, 'normal', {
    name: 'Tiefer Kick',
    startup: 6,
    active: 2,
    recovery: 9,
    hit: { damage: 33, strength: 0, hitstun: 14, blockstun: 11, level: 'low', boxes: [box(0.15, 0.86, 0.0, 0.35)], reaction: 'low' },
    extra: { crouching: true, chains: LIGHT_CHAINS, targets: { heavy: { move: N.L2H } }, specialCancel: true, hurt: [{ start: 5, end: 12, boxes: [box(0.2, 0.72, 0.0, 0.3)] }] },
  }),
  simpleMove(N.H5, 'normal', {
    name: 'Rückhand',
    startup: 9,
    active: 3,
    recovery: 16,
    hit: { damage: 82, strength: 2, hitstun: 20, blockstun: 15, boxes: [box(0.25, 1.0, 1.1, 1.55)], reaction: 'high' },
    extra: {
      specialCancel: true,
      targets: { heavy: { move: N.HH }, light: { move: N.HL } },
      velocity: [
        { frame: 5, vx: mps(1.4) },
        { frame: 12, vx: 0 },
      ],
      hurt: [{ start: 8, end: 20, boxes: [box(0.2, 0.82, 1.15, 1.5)] }],
    },
  }),
  // target combo finishers (button strings, no cards)
  simpleMove(N.LLL, 'normal', {
    name: 'Drehkick',
    startup: 8,
    active: 3,
    recovery: 19,
    hit: { damage: 64, strength: 2, blockstun: 14, knockdown: true, boxes: [box(0.3, 1.25, 0.95, 1.6)], reaction: 'high' },
    extra: {
      specialCancel: true,
      velocity: [
        { frame: 3, vx: mps(1.6) },
        { frame: 10, vx: 0 },
      ],
      hurt: [{ start: 7, end: 18, boxes: [box(0.25, 1.0, 0.9, 1.5)] }],
    },
  }),
  simpleMove(N.HH, 'normal', {
    name: 'Encore-Haken',
    startup: 7,
    active: 3,
    recovery: 22,
    hit: { damage: 78, strength: 3, blockstun: 16, knockdown: true, boxes: [box(0.2, 0.95, 1.0, 1.95)], reaction: 'gut' },
    extra: { hurt: [{ start: 6, end: 22, boxes: [box(0.2, 0.8, 1.1, 1.9)] }] },
  }),
  // H·L: launcher, Up on hit jumps after the opponent (air combo: jL -> jH)
  simpleMove(N.HL, 'normal', {
    name: 'Encore-Kick',
    startup: 8,
    active: 3,
    recovery: 22,
    hit: { damage: 58, strength: 2, blockstun: 14, boxes: [box(0.2, 0.95, 0.7, 1.75)], launch: { vx: 60, vy: 1380 }, reaction: 'gut' },
    extra: {
      jumpCancel: true,
      specialCancel: true,
      // steps in: the heavy before it pushes the opponent away
      velocity: [
        { frame: 2, vx: mps(2.6) },
        { frame: 10, vx: 0 },
      ], hurt: [{ start: 7, end: 20, boxes: [box(0.2, 0.8, 0.6, 1.5)] }] },
  }),
  // L·L·H: hop forward into a flying knee to the head (athletic finisher, sends the opponent flying)
  simpleMove(N.LLH, 'normal', {
    name: 'Fliegendes Knie',
    startup: 11,
    active: 4,
    recovery: 17,
    hit: { damage: 66, strength: 3, blockstun: 15, knockdown: true, boxes: [box(0.15, 0.85, 0.95, 1.65)], reaction: 'high' },
    extra: {
      specialCancel: true,
      velocity: [
        { frame: 3, vx: mps(3.4) },
        { frame: 13, vx: 0 },
      ],
      hurt: [{ start: 8, end: 20, boxes: [box(0.15, 0.8, 0.7, 1.6)] }],
    },
  }),
  // 2L then H (stick released): back-flip kick, launches (Up on hit = air combo)
  simpleMove(N.L2H, 'normal', {
    name: 'Salto-Kick',
    startup: 7,
    active: 4,
    recovery: 24,
    hit: { damage: 58, strength: 2, blockstun: 14, boxes: [box(0.1, 0.85, 0.5, 2.0)], launch: { vx: 40, vy: 1300 }, reaction: 'gut' },
    extra: {
      jumpCancel: true,
      specialCancel: true,
      velocity: [
        { frame: 2, vx: mps(1.6) },
        { frame: 8, vx: mps(-1.2) },
        { frame: 16, vx: 0 },
      ],
      hurt: [{ start: 5, end: 22, boxes: [box(0.1, 0.75, 0.6, 1.8)] }],
    },
  }),
  simpleMove(N.H2, 'normal', {
    name: 'Breakdance-Sweep',
    startup: 10,
    active: 4,
    recovery: 20,
    hit: { damage: 76, strength: 2, blockstun: 14, level: 'low', knockdown: true, boxes: [box(0.1, 1.1, 0.0, 0.3)], reaction: 'low' },
    extra: { crouching: true, specialCancel: true, hurt: [{ start: 9, end: 26, boxes: [box(0.2, 0.95, 0.0, 0.3)] }] },
  }),
  simpleMove(N.jL, 'normal', {
    name: 'Sprungknie',
    startup: 5,
    active: 7,
    recovery: 6,
    hit: { damage: 45, strength: 0, hitstun: 13, blockstun: 10, level: 'overhead', boxes: [box(0.05, 0.55, 0.25, 0.95)] },
    extra: { chains: [N.jH], air: true, landingLag: 3 },
  }),
  simpleMove(N.jH, 'normal', {
    name: 'Sprung-Drehkick',
    startup: 7,
    active: 5,
    recovery: 10,
    hit: { damage: 78, strength: 2, hitstun: 18, blockstun: 14, level: 'overhead', boxes: [box(-0.15, 0.78, -0.1, 0.7)] },
    extra: { air: true, landingLag: 4 },
  }),
  simpleMove(N.throw, 'throw', {
    name: 'Spin-Wurf',
    startup: 5,
    active: 2,
    recovery: 20,
    hit: {
      damage: 0,
      strength: 2,
      level: 'unblockable',
      boxes: [box(0.2, 0.68, 0.4, 1.5)],
      throw: { kind: 'normal', frames: 44, damageFrame: 30, damage: 115, endDx: m(1.7), anim: 'jaz_throw' },
    },
  }),

  // ---- Specials ----
  {
    key: 'jaz_wave',
    name: 'Stimmwelle',
    kind: 'special',
    total: 38,
    hits: [],
    projectile: {
      frame: 12,
      def: {
        kind: 'voicewave',
        x: m(0.55),
        y: m(1.3),
        speed: mps(10),
        half: { w: m(0.22), h: m(0.42) },
        life: 22,
        hit: hit(1, 1, {
          damage: 45,
          chip: 6,
          strength: 1,
          hitstun: 18,
          blockstun: 14,
          hitstop: 7,
          pushHit: 1700,
          pushBlock: 1900,
          boxes: [],
          meterOnHit: 0,
          meterOnBlock: 0,
        }),
      },
    },
  },
  // Blunt für dich (PO, D42): a short lunge and a grab (frames 12-15, unblockable, only on a grounded, non-stunned
  // opponent: jump or keep away). A catch starts the cinematic 'jaz_blunt': he rolls the opponent into a giant joint,
  // lights it and takes three drags (each one burns: damage), then they pop out of the joint, coughing. A whiff
  // leaves him open for a long time.
  {
    key: 'jaz_blunt',
    name: 'Blunt für dich',
    kind: 'special',
    total: 46,
    velocity: [
      { frame: 4, vx: mps(4.2) },
      { frame: 12, vx: 0 },
    ],
    hits: [
      hit(12, 15, {
        damage: 10,
        strength: 2,
        level: 'unblockable',
        boxes: [box(0.15, 1.0, 0.4, 1.7)],
        cinematic: 'jaz_blunt',
        grabLike: true,
        meterOnHit: 0,
        meterOnBlock: 0,
      }),
    ],
  },
  // Diamanten-Regen (D42, PO): his diamond chain flashes (frames 1-21), then a shower of diamonds falls over the
  // OPPONENT's spot. A sparkling ring on the floor warns first (30 frames, harmless: walk or dash out of it), then three
  // hits from above (overhead: only a standing block holds), 12 frames apart, small pushback so a caught opponent
  // stays in the shower. Ignores other projectiles (it falls from above).
  {
    key: 'jaz_rain',
    name: 'Diamanten-Regen',
    kind: 'special',
    total: 50,
    hits: [],
    projectile: {
      frame: 22,
      def: {
        kind: 'diamonds',
        x: 0,
        y: m(0.9),
        speed: 0,
        half: { w: m(0.55), h: m(0.9) },
        life: 74,
        target: { max: m(4.6) },
        armAt: 30,
        hits: 3,
        every: 12,
        noClash: true,
        hit: hit(1, 1, {
          damage: 24,
          chip: 4,
          strength: 1,
          level: 'overhead',
          hitstun: 16,
          blockstun: 14,
          hitstop: 6,
          pushHit: 120,
          pushBlock: 300,
          boxes: [],
          meterOnHit: 0,
          meterOnBlock: 0,
        }),
      },
    },
  },
  {
    key: 'jaz_spot',
    name: 'Spotlight-Dash',
    kind: 'special',
    total: 30,
    strikeInvuln: [1, 16],
    passThrough: [1, 18],
    velocity: [
      { frame: 2, vx: mps(11) },
      { frame: 16, vx: 0 },
    ],
    hits: [],
  },
  {
    key: 'jaz_counter',
    name: 'Rhythmus-Konter',
    kind: 'special',
    total: 40,
    hits: [],
    counter: { start: 3, end: 18, followup: 'jaz_counter_fu', catchLow: true, catchProjectile: false },
  },
  {
    key: 'jaz_counter_fu',
    name: 'Rhythmus-Konter (Treffer)',
    kind: 'special',
    total: 40,
    fullInvuln: [1, 12],
    hits: [
      hit(4, 4, { damage: 30, strength: 1, hitstun: 30, hitstop: 6, pushHit: 150, boxes: [box(-0.2, 1.05, 0.6, 1.7)], meterOnHit: 0 }),
      hit(10, 10, { damage: 30, strength: 1, hitstun: 30, hitstop: 6, pushHit: 150, boxes: [box(-0.2, 1.05, 0.6, 1.7)], meterOnHit: 0 }),
      hit(18, 19, {
        damage: 60,
        strength: 2,
        hitstop: 14,
        knockdown: true,
        launch: { vx: 300, vy: 900 },
        boxes: [box(-0.2, 1.1, 0.4, 1.8)],
        meterOnHit: 0,
      }),
    ],
  },
  {
    key: 'jaz_mvp',
    name: 'MVP-Kombo',
    kind: 'special',
    total: 34,
    velocity: [
      { frame: 3, vx: mps(7) },
      { frame: 12, vx: 0 },
    ],
    hits: [
      hit(8, 11, {
        damage: 40,
        chip: 10,
        strength: 1,
        hitstun: 30,
        blockstun: 18,
        hitstop: 8,
        boxes: [box(0.1, 0.85, 0.9, 1.6)],
        followup: 'jaz_mvp_fu',
        meterOnHit: 0,
        meterOnBlock: 0,
      }),
    ],
  },
  {
    key: 'jaz_mvp_fu',
    name: 'MVP-Kombo (Serie)',
    kind: 'special',
    total: 56,
    velocity: [
      { frame: 1, vx: mps(0.9) },
      { frame: 40, vx: 0 },
    ],
    hits: [
      hit(6, 6, { damage: 34, strength: 1, hitstun: 30, hitstop: 6, boxes: [box(0, 0.95, 0.8, 1.65)], pushHit: 200, meterOnHit: 0 }),
      hit(14, 14, { damage: 34, strength: 1, hitstun: 30, hitstop: 6, boxes: [box(0, 0.95, 0.8, 1.65)], pushHit: 200, meterOnHit: 0 }),
      hit(22, 22, { damage: 40, strength: 1, hitstun: 30, hitstop: 7, boxes: [box(0, 0.95, 0.8, 1.65)], pushHit: 200, meterOnHit: 0 }),
      hit(32, 33, { damage: 65, strength: 2, hitstop: 14, boxes: [box(0, 1.0, 0.6, 1.9)], launch: { vx: 260, vy: 1100 }, meterOnHit: 0 }),
    ],
  },
  {
    key: 'jaz_heart',
    name: 'Herzbrecher',
    kind: 'signature',
    total: 58,
    superFlash: 36,
    strikeInvuln: [1, 12],
    velocity: [
      { frame: 2, vx: mps(7) },
      { frame: 13, vx: 0 },
    ],
    hits: [
      hit(8, 13, {
        damage: 40,
        chip: 30,
        strength: 3,
        blockstun: 22,
        boxes: [box(0, 1.0, 0.5, 1.8)],
        cinematic: 'jaz_heart',
        meterOnHit: 0,
        meterOnBlock: 0,
      }),
    ],
  },
];

export const JAZEEK: FighterDef = {
  id: 'jazeek',
  name: 'JAZEEK',
  tagline: 'Most Valuable Playa. Tempo, Rhythmus, Show.',
  archetype: 'Tempo & Konter',
  health: 1000,
  meterGainPct: 110,
  walkF: mps(3.7),
  walkB: mps(3.1),
  jumpSquat: 4,
  jumpVy,
  jumpVx: mps(3.3),
  gravity,
  dashF: { frames: 15, speed: mps(6.6) },
  dashB: { frames: 19, speed: mps(5.0), invuln: 7 },
  pushHalf: m(0.24),
  height: m(1.8),
  hurtStand: [box(-0.24, 0.26, 0, 1.45), box(-0.13, 0.22, 1.45, 1.82)],
  hurtCrouch: [box(-0.28, 0.3, 0, 1.05)],
  hurtAir: [box(-0.25, 0.25, 0.1, 1.6)],
  normals: { '5L': N.L5, '2L': N.L2, '5H': N.H5, '2H': N.H2, jL: N.jL, jH: N.jH, throw: N.throw },
  moves: Object.fromEntries(moves.map((mv) => [mv.key, mv])),
  cards: [
    {
      id: 'jaz_wave',
      name: 'Stimmwelle',
      category: 'zoning',
      cost: 100,
      move: 'jaz_wave',
      role: 'Schallwelle, hält auf Abstand',
      description: 'Ein kurzer Gesangsimpuls als sichtbare Schallwelle. Kurze Reichweite, schiebt den Gegner weit weg.',
      ai: 'zone',
    },
    {
      id: 'jaz_rain',
      name: 'Diamanten-Regen',
      category: 'zoning',
      cost: 200,
      move: 'jaz_rain',
      role: 'Diamantenschauer über dem Gegner',
      description:
        'Make it rain: Seine Diamantkette blitzt auf, dann prasselt ein Diamantenschauer genau dort herab, wo der Gegner steht. Ein Funkelkreis warnt vorher – rausgehen oder stehend blocken.',
      ai: 'range',
      aiRange: [1.4, 4.4],
    },
    {
      id: 'jaz_blunt',
      name: 'Blunt für dich',
      category: 'offense',
      cost: 200,
      move: 'jaz_blunt',
      role: 'Griff – Gegner wird zum Joint',
      description:
        'Er packt den Gegner, rollt ihn in einen riesigen Joint, zündet ihn an und zieht dreimal kräftig – jeder Zug brennt. Dann ploppt der Gegner hustend wieder raus. Nicht blockbar, aber ausweichbar (springen, Abstand). Daneben gegriffen: lange offen.',
      ai: 'range',
      aiRange: [0.3, 1.1],
    },
    {
      id: 'jaz_spot',
      name: 'Spotlight-Dash',
      category: 'mobility',
      cost: 100,
      move: 'jaz_spot',
      role: 'Seitenwechsel durch den Gegner',
      description: 'Blitzschneller Schritt durch einen wandernden Lichtkegel. Läuft durch den Gegner hindurch, am Anfang unverwundbar gegen Schläge.',
      ai: 'escape',
    },
    {
      id: 'jaz_counter',
      name: 'Rhythmus-Konter',
      category: 'counter',
      cost: 100,
      move: 'jaz_counter',
      role: 'Konter gegen Schläge und Tiefe',
      description: 'Er weicht im Takt aus und antwortet mit drei Treffern. Fängt hohe und tiefe Angriffe, aber keine Würfe oder Projektile.',
      ai: 'counter',
    },
    {
      id: 'jaz_mvp',
      name: 'MVP-Kombo',
      category: 'offense',
      cost: 200,
      move: 'jaz_mvp',
      role: 'Combo-Abschluss, Schlagserie',
      description: 'Sprint mit Jab. Trifft er, folgt eine schnelle Fünfer-Serie mit Launcher. Geblockt riskant.',
      ai: 'combo',
    },
    {
      id: 'jaz_heart',
      name: 'Herzbrecher',
      category: 'signature',
      cost: 300,
      move: 'jaz_heart',
      role: 'Cinematic Signature',
      description: 'Ein gesungener Ton als Angriff. Bei Treffer: Spotlight, Herzen, musikalischer Moment – und dann eine blitzschnelle Kombo.',
      ai: 'combo',
    },
  ],
  cinematics: {
    jaz_blunt: {
      id: 'jaz_blunt',
      frames: 160,
      startDx: m(0.75),
      // three drags (each burns) and the pop out of the joint
      hits: [
        { frame: 78, damage: 28, strength: 1 },
        { frame: 96, damage: 28, strength: 1 },
        { frame: 114, damage: 28, strength: 2 },
        { frame: 134, damage: 30, strength: 3 },
      ],
      endDx: m(2.6),
    },
    jaz_heart: {
      id: 'jaz_heart',
      frames: 150,
      startDx: m(0.9),
      hits: [
        { frame: 70, damage: 30, strength: 1 },
        { frame: 78, damage: 30, strength: 1 },
        { frame: 86, damage: 35, strength: 1 },
        { frame: 96, damage: 40, strength: 2 },
        { frame: 120, damage: 150, strength: 3 },
      ],
      endDx: m(2.1),
    },
  },
  defaultLoadout: ['jaz_blunt', 'jaz_mvp', 'jaz_heart'],
};
