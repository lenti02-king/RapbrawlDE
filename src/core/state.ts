// Simulation state. MUST stay plain JSON-compatible data (numbers, strings,
// booleans, arrays, plain objects, null) so it can be snapshotted for rollback,
// hashed for desync detection, and serialized for replays.

import { m } from './math';

export type FighterStateName =
  | 'intro'
  | 'idle'
  | 'walkF'
  | 'walkB'
  | 'crouch'
  | 'guard'
  | 'jumpSquat'
  | 'air'
  | 'land'
  | 'dashF'
  | 'dashB'
  | 'move'
  | 'blockstun'
  | 'hitstun'
  | 'juggle'
  | 'airReset'
  | 'knockdown'
  | 'wakeup'
  | 'throwing'
  | 'thrown'
  | 'techRecover'
  | 'countered'
  | 'cineAtk'
  | 'cineDef'
  | 'ko'
  | 'win';

export interface FighterState {
  idx: number;
  def: string;
  loadout: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Knockback slide (decays), separate from self-locomotion vx. */
  push: number;
  facing: number;
  state: FighterStateName;
  /** Frames spent in current state. */
  sf: number;
  /** Generic countdown for timed states (stun, landing, knockdown, ...). */
  timer: number;
  crouching: boolean;
  move: string | null;
  /** Current move frame (1-based). */
  mf: number;
  /** Bitmask of HitDef indices of the current move that already connected. */
  hitMask: number;
  connected: 'none' | 'hit' | 'block';
  chainDepth: number;
  /** Card id that started the current move (for UI). */
  card: string | null;
  pendingFollowup: string | null;
  hitstop: number;
  health: number;
  meter: number;
  /** Hits taken in the current combo (defender side). */
  combo: number;
  comboDamage: number;
  juggle: number;
  invuln: number;
  armorUsed: number;
  airAttackUsed: boolean;
  /** Raw input this frame and previous frame. */
  input: number;
  prevInput: number;
  /** Press buffer countdowns, index matches BUFFERED in input.ts. */
  buf: number[];
  /** Double-tap windows for absolute left/right. */
  tapL: number;
  tapR: number;
  /** Pending dash request: -1 (left), 1 (right), 0 none, with remaining window. */
  dashReq: number;
  dashReqT: number;
  /** Throw sequence data. */
  throwMove: string | null;
  throwFrame: number;
  techWindow: number;
  roundsWon: number;
  /** Jump direction chosen at jump squat end (-1, 0, 1 relative to facing). */
  jumpDir: number;
}

export interface ProjectileState {
  id: number;
  owner: number;
  /** Move key that spawned it (to look up its definition). */
  move: string;
  kind: string;
  x: number;
  y: number;
  dir: number;
  age: number;
  alive: boolean;
}

export type Phase = 'intro' | 'fight' | 'ko' | 'roundOver' | 'matchOver';

export interface MatchConfig {
  fighters: [string, string];
  loadouts: [string[], string[]];
  roundsToWin: number;
  roundFrames: number;
  /** Training mode: infinite meter, health refills, no timer, no rounds. */
  training: boolean;
  seed: number;
}

export interface GameState {
  frame: number;
  phase: Phase;
  phaseFrame: number;
  round: number;
  timer: number;
  fighters: [FighterState, FighterState];
  projectiles: ProjectileState[];
  nextProjId: number;
  /** Global "super flash" freeze frames and who caused it. */
  freeze: number;
  freezeOwner: number;
  cine: { id: string; owner: number; frame: number; scale: number } | null;
  /** Remaining slow-motion frames (KO); fighters update every 3rd frame. */
  slowmo: number;
  /** Sim camera center (screen-edge walls follow it). */
  camX: number;
  rng: number;
  roundWinner: number;
  matchWinner: number;
  config: MatchConfig;
}

export const START_DISTANCE = m(2.6);

export function createFighter(idx: number, def: string, loadout: string[]): FighterState {
  return {
    idx,
    def,
    loadout: loadout.slice(),
    x: idx === 0 ? -START_DISTANCE / 2 : START_DISTANCE / 2,
    y: 0,
    vx: 0,
    vy: 0,
    push: 0,
    facing: idx === 0 ? 1 : -1,
    state: 'intro',
    sf: 0,
    timer: 0,
    crouching: false,
    move: null,
    mf: 0,
    hitMask: 0,
    connected: 'none',
    chainDepth: 0,
    card: null,
    pendingFollowup: null,
    hitstop: 0,
    health: 0,
    meter: 0,
    combo: 0,
    comboDamage: 0,
    juggle: 0,
    invuln: 0,
    armorUsed: 0,
    airAttackUsed: false,
    input: 0,
    prevInput: 0,
    buf: [0, 0, 0, 0, 0, 0],
    tapL: 0,
    tapR: 0,
    dashReq: 0,
    dashReqT: 0,
    throwMove: null,
    throwFrame: 0,
    techWindow: 0,
    roundsWon: 0,
    jumpDir: 0,
  };
}

/** Deep copy of plain data. Fast enough for rollback (a few KB of state). */
export function cloneState(s: GameState): GameState {
  return structuredClone(s);
}

/** FNV-1a 32-bit hash of the canonical JSON form; used for desync detection. */
export function hashState(s: GameState): number {
  const str = JSON.stringify(s);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
