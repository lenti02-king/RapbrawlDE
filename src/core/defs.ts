// Content definitions consumed by the deterministic simulation.
// All lengths are integer sim units (see math.ts `m()`), all times are frames @60Hz.
// Presentation-only data (poses, colors, camera paths) lives in src/render, keyed
// by the same move/cinematic ids.

/** Axis-aligned box relative to a fighter: x0..x1 measured FORWARD from the fighter's
 *  origin (feet center) in its facing direction, y0..y1 measured up from the floor. */
export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export type HitLevel = 'mid' | 'low' | 'overhead' | 'unblockable';
/** Visual/audio intensity tier: 0 light, 1 medium, 2 heavy, 3 special/super. */
export type Strength = 0 | 1 | 2 | 3;
export type Reaction = 'high' | 'gut' | 'low';

export interface ThrowDef {
  kind: 'normal' | 'command';
  /** Total length of the throw animation (both fighters locked). */
  frames: number;
  /** Frame (within the throw) at which damage is applied. */
  damageFrame: number;
  damage: number;
  /** Where the victim ends up, relative to the thrower (forward = +). Negative = behind. */
  endDx: number;
  /** Presentation key for the throw animation pair. */
  anim: string;
}

export interface HitDef {
  /** Active frames (inclusive), counted in move frames starting at 1. */
  start: number;
  end: number;
  boxes: Box[];
  damage: number;
  /** Damage dealt through block (specials only). */
  chip: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  level: HitLevel;
  /** Pushback velocity (units/frame) applied to the defender on hit / on block. */
  pushHit: number;
  pushBlock: number;
  /** Launch into the air (juggle state) with this velocity (vx relative to attacker facing). */
  launch?: { vx: number; vy: number };
  /** The hitbox is behind the attacker (a backhand after passing through): knockback and push go backwards. */
  reverse?: boolean;
  /** Grounded hard knockdown on hit. */
  knockdown?: boolean;
  meterOnHit: number;
  meterOnBlock: number;
  strength: Strength;
  reaction?: Reaction;
  /** Confirmed hit starts this cinematic sequence. */
  cinematic?: string;
  /** Throw / command grab. */
  throw?: ThrowDef;
  /** On confirmed hit (not block), immediately continue into this move after hitstop. */
  followup?: string;
  /** Strike that only connects on throwable (grounded, non-stunned) opponents. */
  grabLike?: boolean;
}

export interface VelocityKey {
  frame: number;
  /** Horizontal velocity relative to facing (units/frame). */
  vx?: number;
  /** Vertical velocity (units/frame); setting this makes the fighter airborne. */
  vy?: number;
  /** Reappear on the far side of the opponent, this far from their centre (units): a shadow step through them. */
  warp?: number;
}

export interface ProjectileDef {
  kind: string;
  /** Spawn offset relative to the owner (forward, up). */
  x: number;
  y: number;
  /** Speed (units/frame) forward. */
  speed: number;
  /** Hitbox relative to projectile center. */
  half: { w: number; h: number };
  life: number;
  hit: HitDef;
  /** Returns toward the owner after `returnAfter` frames (boomerang). */
  returnAfter?: number;
  /** Barrier: never hits fighters; destroys enemy projectiles it touches and survives. */
  barrier?: boolean;
  /** Spawns over the opponent (x = their position, at most `max` from the owner) instead of in front of the owner. */
  target?: { max: number };
  /** Harmless warning phase: no hits and no clashes before this age (a telegraph the opponent can walk out of). */
  armAt?: number;
  /** Multi-hit: number of hits (default 1) and frames between them; the projectile stays until all are used. */
  hits?: number;
  every?: number;
  /** Ignores enemy projectiles (falls from above). */
  noClash?: boolean;
}

export interface CounterDef {
  start: number;
  end: number;
  followup: string;
  catchLow: boolean;
  catchProjectile: boolean;
}

export type MoveKind = 'normal' | 'throw' | 'special' | 'signature';

export interface TargetDef {
  move: string;
  minDepth?: number;
}

export interface MoveDef {
  key: string;
  name: string;
  kind: MoveKind;
  /** Total length in frames (startup + active + recovery). */
  total: number;
  hits: HitDef[];
  /** Performed in the air. Air moves end on landing. */
  air?: boolean;
  /** Fighter is airborne during these frames (gravity applies). Set implicitly by vy keys. */
  gravity?: number;
  /** Landing recovery when an air move touches down. */
  landingLag?: number;
  crouching?: boolean;
  /** Normals this move may chain into once it has connected. */
  chains?: string[];
  /** Target combos: a specific follow-up for Light/Heavy (standing) once this move connected, taking precedence
   *  over `chains`. `minDepth` = how many chained moves must precede (e.g. 1 = only from the 2nd jab of L·L·L). */
  targets?: { light?: TargetDef; heavy?: TargetDef };
  /** May cancel into a special card once it has connected. */
  specialCancel?: boolean;
  /** On hit, holding Up cancels the recovery into a jump (launcher -> air combo). */
  jumpCancel?: boolean;
  velocity?: VelocityKey[];
  /** Invulnerable to strikes and projectiles (not throws) during [start,end]. */
  strikeInvuln?: [number, number];
  /** Invulnerable to everything during [start,end]. */
  fullInvuln?: [number, number];
  /** No collision with the opponent's pushbox during [start,end] (pass-through dashes). */
  passThrough?: [number, number];
  /** Absorbs `hits` strikes during [start,end] taking reduced damage, no stun. */
  armor?: { start: number; end: number; hits: number };
  counter?: CounterDef;
  projectile?: { frame: number; def: ProjectileDef };
  /** Gain meter at a frame (taunts / hype moves). */
  meterGain?: { frame: number; amount: number };
  /** Extra hurtboxes (extended limbs) during [start,end]. */
  hurt?: { start: number; end: number; boxes: Box[] }[];
  /** Global freeze ("super flash") when the move starts. */
  superFlash?: number;
  /** Ground move that leaves the ground and ends on landing (e.g. dives). */
  endOnLand?: boolean;
}

export type CardCategory = 'offense' | 'zoning' | 'mobility' | 'counter' | 'utility' | 'grapple' | 'signature';

export interface CardDef {
  id: string;
  name: string;
  category: CardCategory;
  /** Hype meter cost (100 = one bar). */
  cost: number;
  move: string;
  /** Can be used in the air (otherwise ground only). */
  air?: boolean;
  description: string;
  /** Short tactical role shown in the loadout screen. */
  role: string;
  /** Hint for the CPU on when to use the card. */
  ai?: 'combo' | 'range' | 'zone' | 'escape' | 'counter' | 'buff' | 'antiProjectile';
  /** Optimal distance window (meters) for 'range' cards. */
  aiRange?: [number, number];
}

export interface CinematicDef {
  id: string;
  frames: number;
  /** Victim is placed this far in front of the attacker when the sequence starts. */
  startDx: number;
  hits: { frame: number; damage: number; strength: 0 | 1 | 2 | 3 }[];
  /** Victim lands this far in front of the attacker afterwards, in knockdown. */
  endDx: number;
}

export interface FighterDef {
  id: string;
  /** Hidden from the roster UI (legacy/dev test fighters). */
  hidden?: boolean;
  name: string;
  tagline: string;
  archetype: string;
  health: number;
  /** Hype meter gain multiplier in percent (character trait). Default 100. */
  meterGainPct?: number;
  walkF: number;
  walkB: number;
  jumpSquat: number;
  jumpVy: number;
  jumpVx: number;
  gravity: number;
  dashF: { frames: number; speed: number };
  dashB: { frames: number; speed: number; invuln: number };
  /** Half width of the push (collision) box. */
  pushHalf: number;
  height: number;
  hurtStand: Box[];
  hurtCrouch: Box[];
  hurtAir: Box[];
  normals: {
    '5L': string;
    '2L': string;
    '5H': string;
    '2H': string;
    /** Optional overhead normal; NOT mapped to forward+Heavy (precision on touch). Reserved for future input. */
    '6H'?: string;
    jL: string;
    jH: string;
    throw: string;
  };
  moves: Record<string, MoveDef>;
  cards: CardDef[];
  cinematics: Record<string, CinematicDef>;
  defaultLoadout: string[];
}
