// RAPBRAWL deterministic combat simulation.
//
// step(state, inputs) advances the match by exactly one 60 Hz frame, mutating
// `state` in place and returning presentation events. The same state + inputs
// always produce the same result on every platform (integer math only), which
// is what makes rollback netcode and replays possible.

import type { Box, CardDef, HitDef, MoveDef } from './defs';
import type { SimEvent } from './events';
import { B_GRAB, B_HEAVY, B_LIGHT, B_S1, BUFFERED, IN } from './input';
import { clamp, iabs, idiv, m } from './math';
import { getCard, getFighter, getMove } from './registry';
import {
  createFighter,
  type FighterState,
  type FighterStateName,
  type GameState,
  type MatchConfig,
  type ProjectileState,
  START_DISTANCE,
} from './state';

/** Tunable global rules. */
export const RULES = {
  BUFFER: 8,
  DASH_TAP_WINDOW: 12,
  DASH_REQ_WINDOW: 6,
  JUGGLE_LIMIT: 4,
  JUGGLE_GRAVITY: 60,
  KNOCKDOWN: 34,
  WAKEUP: 14,
  LAND: 3,
  AIR_RESET_LAND: 8,
  INTRO: 140,
  KO_PHASE: 150,
  SLOWMO: 66,
  ROUND_OVER: 120,
  TIME_OVER_PAUSE: 60,
  STAGE_HALF: m(7.5),
  SCREEN_HALF: m(2.9),
  PROX_GUARD: m(2.4),
  TECH_WINDOW: 10,
  TECH_RECOVER: 18,
  METER_MAX: 300,
  ARMOR_DAMAGE_PCT: 50,
  COUNTER_HIT_DAMAGE_PCT: 120,
  COUNTER_HIT_STUN_BONUS: 4,
  COUNTER_STAGGER: 40,
  COUNTER_HITSTOP: 16,
  /** Perfect block: press block (or tap back) at most this many frames before the hit lands. */
  PB_WINDOW: 6,
  /** A new perfect-block window needs this many frames since the last press (mashing does not work). */
  PB_LOCK: 22,
  /** Blockstun after a perfect block (the attacker is still recovering: free punish). */
  PB_STUN: 2,
  PB_HITSTOP_BONUS: 5,
  PB_METER: 25,
  /** Frames after a perfect block in which the defender's hits count as counter hits. */
  PB_PUNISH: 26,
  TRAINING_REFILL_DELAY: 50,
} as const;

export const ROUND_SECONDS = 99;

export function defaultConfig(partial: Partial<MatchConfig> = {}): MatchConfig {
  const fighters = partial.fighters ?? ['volt', 'brick'];
  return {
    fighters,
    loadouts: partial.loadouts ?? [
      getFighter(fighters[0]).defaultLoadout.slice(),
      getFighter(fighters[1]).defaultLoadout.slice(),
    ],
    roundsToWin: partial.roundsToWin ?? 2,
    roundFrames: partial.roundFrames ?? ROUND_SECONDS * 60,
    training: partial.training ?? false,
    seed: partial.seed ?? 0x9e3779b9,
  };
}

export function createMatch(config: MatchConfig): GameState {
  const s: GameState = {
    frame: 0,
    phase: 'intro',
    phaseFrame: 0,
    round: 1,
    timer: config.roundFrames,
    fighters: [
      createFighter(0, config.fighters[0], config.loadouts[0]),
      createFighter(1, config.fighters[1], config.loadouts[1]),
    ],
    projectiles: [],
    nextProjId: 1,
    freeze: 0,
    freezeOwner: -1,
    cine: null,
    slowmo: 0,
    camX: 0,
    rng: config.seed >>> 0 || 1,
    roundWinner: -1,
    matchWinner: -1,
    config,
  };
  resetRound(s);
  if (config.training) {
    for (const f of s.fighters) f.meter = RULES.METER_MAX;
  }
  return s;
}

function resetRound(s: GameState): void {
  s.phase = 'intro';
  s.phaseFrame = 0;
  s.timer = s.config.roundFrames;
  s.projectiles = [];
  s.freeze = 0;
  s.freezeOwner = -1;
  s.cine = null;
  s.slowmo = 0;
  s.camX = 0;
  s.roundWinner = -1;
  for (const f of s.fighters) {
    const def = getFighter(f.def);
    const keep = { meter: f.meter, roundsWon: f.roundsWon, input: f.input, prevInput: f.prevInput };
    const fresh = createFighter(f.idx, f.def, f.loadout);
    Object.assign(f, fresh, keep);
    f.health = def.health;
    f.x = f.idx === 0 ? -START_DISTANCE / 2 : START_DISTANCE / 2;
  }
}

// ---------------------------------------------------------------------------
// Main step
// ---------------------------------------------------------------------------

export function step(s: GameState, inputs: readonly number[]): SimEvent[] {
  const ev: SimEvent[] = [];
  s.frame++;
  readInput(s.fighters[0], inputs[0] | 0);
  readInput(s.fighters[1], inputs[1] | 0);
  switch (s.phase) {
    case 'intro':
      stepIntro(s, ev);
      break;
    case 'fight':
      stepFight(s, ev);
      break;
    case 'ko':
      stepKO(s, ev);
      break;
    case 'roundOver':
      stepRoundOver(s, ev);
      break;
    case 'matchOver':
      s.phaseFrame++;
      for (const f of s.fighters) {
        f.sf++;
        physics(s, f, ev);
      }
      break;
  }
  return ev;
}

function stepIntro(s: GameState, ev: SimEvent[]): void {
  s.phaseFrame++;
  if (s.phaseFrame === 1) ev.push({ t: 'roundStart', round: s.round });
  for (const f of s.fighters) f.sf++;
  if (s.phaseFrame >= RULES.INTRO) {
    s.phase = 'fight';
    s.phaseFrame = 0;
    for (const f of s.fighters) {
      setState(f, 'idle');
      f.buf.fill(0);
      f.dashReq = 0;
    }
    ev.push({ t: 'fight' });
  }
}

function stepFight(s: GameState, ev: SimEvent[]): void {
  s.phaseFrame++;
  if (s.freeze > 0) {
    s.freeze--;
    return;
  }
  if (s.cine) {
    stepCinematic(s, ev);
    if (!s.cine) checkKO(s, ev);
    return;
  }
  const fs = s.fighters;
  const frozen = [fs[0].hitstop > 0, fs[1].hitstop > 0];
  for (let i = 0; i < 2; i++) if (!frozen[i]) timers(s, fs[i], fs[1 - i], ev);
  for (let i = 0; i < 2; i++) if (!frozen[i]) think(s, fs[i], fs[1 - i], ev);
  for (let i = 0; i < 2; i++) if (!frozen[i]) physics(s, fs[i], ev);
  resolvePush(s);
  updateProjectiles(s, ev);
  collide(s, ev, frozen);
  for (let i = 0; i < 2; i++) {
    if (frozen[i]) fs[i].hitstop--;
    else tickBuffers(fs[i]);
  }
  updateFacing(s);
  updateCamera(s);
  if (s.config.training) trainingRefill(s);
  checkKO(s, ev);
  if (s.phase === 'fight' && !s.config.training && !s.cine && s.freeze === 0) {
    s.timer--;
    if (s.timer <= 0) timeOver(s, ev);
  }
}

function stepKO(s: GameState, ev: SimEvent[]): void {
  s.phaseFrame++;
  let update = true;
  if (s.slowmo > 0) {
    s.slowmo--;
    update = s.slowmo % 3 === 0;
  }
  if (update) {
    for (const f of s.fighters) {
      if (f.hitstop > 0) {
        f.hitstop--;
        continue;
      }
      if (f.state !== 'ko') timers(s, f, s.fighters[1 - f.idx], ev);
      else f.sf++;
      if (f.state === 'move' || f.state === 'throwing') {
        /* finish animations, no new actions */
      } else if (f.state !== 'ko' && isNeutral(f.state)) {
        setState(f, 'idle');
      }
      physics(s, f, ev);
    }
    resolvePush(s);
    updateCamera(s);
  }
  if (s.phaseFrame >= RULES.KO_PHASE) {
    s.phase = 'roundOver';
    s.phaseFrame = 0;
    for (const f of s.fighters) if (f.state !== 'ko') setState(f, 'win');
    ev.push({ t: 'roundOver', winner: s.roundWinner });
  }
}

function stepRoundOver(s: GameState, ev: SimEvent[]): void {
  s.phaseFrame++;
  for (const f of s.fighters) {
    f.sf++;
    physics(s, f, ev);
  }
  if (s.phaseFrame >= RULES.ROUND_OVER) {
    const [a, b] = s.fighters;
    const need = s.config.roundsToWin;
    if (a.roundsWon >= need || b.roundsWon >= need) {
      s.phase = 'matchOver';
      s.phaseFrame = 0;
      s.matchWinner = a.roundsWon >= need && b.roundsWon >= need ? 2 : a.roundsWon >= need ? 0 : 1;
      ev.push({ t: 'matchOver', winner: s.matchWinner });
    } else {
      s.round++;
      resetRound(s);
    }
  }
}

function timeOver(s: GameState, ev: SimEvent[]): void {
  const [a, b] = s.fighters;
  const ma = getFighter(a.def).health;
  const mb = getFighter(b.def).health;
  // compare health percentage without floats: a.health/ma vs b.health/mb
  const lhs = a.health * mb;
  const rhs = b.health * ma;
  s.roundWinner = lhs > rhs ? 0 : rhs > lhs ? 1 : 2;
  if (s.roundWinner === 0) a.roundsWon++;
  else if (s.roundWinner === 1) b.roundsWon++;
  ev.push({ t: 'timeover' });
  s.phase = 'ko';
  s.phaseFrame = RULES.KO_PHASE - RULES.TIME_OVER_PAUSE;
  s.slowmo = 0;
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

/** Resolve impossible direction combos inside the sim (SOCD: L+R = neutral, U+D = up),
 *  so behaviour never depends on processing order and stays P1/P2 symmetric. */
export function sanitizeInput(bits: number): number {
  if (bits & IN.LEFT && bits & IN.RIGHT) bits &= ~(IN.LEFT | IN.RIGHT);
  if (bits & IN.UP && bits & IN.DOWN) bits &= ~IN.DOWN;
  return bits;
}

function readInput(f: FighterState, bits: number): void {
  bits = sanitizeInput(bits);
  f.prevInput = f.input;
  f.input = bits;
  const edge = bits & ~f.prevInput;
  for (let i = 0; i < BUFFERED.length; i++) if (edge & BUFFERED[i]) f.buf[i] = RULES.BUFFER;
  // perfect block: a fresh press of block, or of "away" (stick back on phones), opens a short window
  const away = f.facing > 0 ? IN.LEFT : IN.RIGHT;
  if (edge & (IN.BLOCK | away) && f.pbLock === 0) {
    f.pbWin = RULES.PB_WINDOW;
    f.pbLock = RULES.PB_LOCK;
  }
  if (edge & IN.LEFT) {
    if (f.tapL > 0) {
      f.dashReq = -1;
      f.dashReqT = RULES.DASH_REQ_WINDOW;
      f.tapL = 0;
    } else f.tapL = RULES.DASH_TAP_WINDOW;
    f.tapR = 0;
  }
  if (edge & IN.RIGHT) {
    if (f.tapR > 0) {
      f.dashReq = 1;
      f.dashReqT = RULES.DASH_REQ_WINDOW;
      f.tapR = 0;
    } else f.tapR = RULES.DASH_TAP_WINDOW;
    f.tapL = 0;
  }
}

function tickBuffers(f: FighterState): void {
  for (let i = 0; i < f.buf.length; i++) if (f.buf[i] > 0) f.buf[i]--;
  if (f.pbWin > 0) f.pbWin--;
  if (f.pbLock > 0) f.pbLock--;
  if (f.pbPunish > 0) f.pbPunish--;
  if (f.tapL > 0) f.tapL--;
  if (f.tapR > 0) f.tapR--;
  if (f.dashReqT > 0 && --f.dashReqT === 0) f.dashReq = 0;
}

const fwdBit = (f: FighterState) => (f.facing > 0 ? IN.RIGHT : IN.LEFT);
const backBit = (f: FighterState) => (f.facing > 0 ? IN.LEFT : IN.RIGHT);
const held = (f: FighterState, bit: number) => (f.input & bit) !== 0;

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

function setState(f: FighterState, st: FighterStateName, timer = 0): void {
  f.state = st;
  f.sf = 0;
  f.timer = timer;
  if (st !== 'move') {
    f.move = null;
    f.card = null;
    f.mf = 0;
  }
}

const NEUTRAL_STATES: ReadonlySet<FighterStateName> = new Set([
  'idle',
  'walkF',
  'walkB',
  'crouch',
  'guard',
]);
export const isNeutral = (st: FighterStateName): boolean => NEUTRAL_STATES.has(st);

const AIR_STATES: ReadonlySet<FighterStateName> = new Set(['air', 'juggle', 'airReset']);

function isAirborne(f: FighterState): boolean {
  return f.y > 0 || f.vy > 0 || AIR_STATES.has(f.state);
}

function toNeutral(f: FighterState): void {
  if (isAirborne(f) && f.y > 0) {
    setState(f, 'air');
    f.airAttackUsed = true;
    return;
  }
  const crouch = held(f, IN.DOWN);
  setState(f, crouch ? 'crouch' : 'idle');
  f.crouching = crouch;
  f.vx = 0;
  f.chainDepth = 0;
}

function addMeter(s: GameState, f: FighterState, amount: number): void {
  if (s.config.training) return;
  const pct = getFighter(f.def).meterGainPct ?? 100;
  f.meter = clamp(f.meter + idiv(amount * pct, 100), 0, RULES.METER_MAX);
}

// ---------------------------------------------------------------------------
// Timers (per-state countdowns, move frame advance)
// ---------------------------------------------------------------------------

function timers(s: GameState, f: FighterState, o: FighterState, ev: SimEvent[]): void {
  f.sf++;
  if (f.invuln > 0) f.invuln--;
  if (f.pendingFollowup && f.state !== 'move') f.pendingFollowup = null;
  if (f.pendingFollowup) {
    const key = f.pendingFollowup;
    f.pendingFollowup = null;
    const depth = f.chainDepth;
    startMove(s, f, key, ev, f.card);
    f.chainDepth = depth;
    return;
  }
  switch (f.state) {
    case 'move': {
      f.mf++;
      const mv = getMove(f.def, f.move!);
      if (f.mf > mv.total) {
        if (mv.air && f.y > 0) {
          setState(f, 'air');
          f.airAttackUsed = true;
        } else if (f.y > 0 || f.vy > 0) {
          setState(f, 'air');
          f.airAttackUsed = true;
        } else toNeutral(f);
        return;
      }
      for (const h of mv.hits) if (h.start === f.mf) ev.push({ t: 'active', p: f.idx, move: mv.key, strength: h.strength });
      if (mv.projectile && mv.projectile.frame === f.mf) spawnProjectile(s, f, mv, ev);
      if (mv.meterGain && mv.meterGain.frame === f.mf) {
        addMeter(s, f, mv.meterGain.amount);
        ev.push({ t: 'meterGain', p: f.idx, amount: mv.meterGain.amount });
      }
      return;
    }
    case 'blockstun':
    case 'hitstun':
    case 'land':
    case 'techRecover':
    case 'countered':
      if (--f.timer <= 0) {
        toNeutral(f);
        if (f.state !== 'hitstun') {
          f.combo = 0;
          f.comboDamage = 0;
          f.juggle = 0;
        }
      }
      return;
    case 'knockdown':
      if (--f.timer <= 0) {
        setState(f, 'wakeup', RULES.WAKEUP);
        f.invuln = RULES.WAKEUP + 1;
        f.combo = 0;
        f.comboDamage = 0;
        f.juggle = 0;
        ev.push({ t: 'wakeup', p: f.idx });
      }
      return;
    case 'wakeup':
      if (--f.timer <= 0) toNeutral(f);
      return;
    case 'jumpSquat':
      if (--f.timer <= 0) {
        const def = getFighter(f.def);
        const dir = held(f, fwdBit(f)) ? 1 : held(f, backBit(f)) ? -1 : 0;
        setState(f, 'air');
        f.jumpDir = dir;
        f.airAttackUsed = false;
        f.vy = def.jumpVy;
        f.vx = dir * def.jumpVx * f.facing;
        ev.push({ t: 'jump', p: f.idx });
      }
      return;
    case 'dashF':
    case 'dashB':
      if (--f.timer <= 0) toNeutral(f);
      return;
    case 'throwing':
      stepThrow(s, f, o, ev);
      return;
    default:
      return;
  }
}

// ---------------------------------------------------------------------------
// Decision making (inputs -> actions)
// ---------------------------------------------------------------------------

function normalKeyFor(f: FighterState, heavy: boolean): string {
  const n = getFighter(f.def).normals;
  if (f.state === 'air') return heavy ? n.jH : n.jL;
  if (held(f, IN.DOWN)) return heavy ? n['2H'] : n['2L'];
  // Forward+Heavy deliberately maps to the standard heavy: holding the stick forward
  // while attacking must never produce an unexpected slow move (touch precision).
  return heavy ? n['5H'] : n['5L'];
}

function think(s: GameState, f: FighterState, o: FighterState, ev: SimEvent[]): void {
  if (f.state === 'move') {
    tryCancel(s, f, ev);
    return;
  }
  if (f.state === 'air') {
    if (tryCards(s, f, ev, true)) return;
    if (!f.airAttackUsed) {
      if (f.buf[B_HEAVY] > 0) {
        f.buf[B_HEAVY] = 0;
        f.airAttackUsed = true;
        startMove(s, f, normalKeyFor(f, true), ev);
      } else if (f.buf[B_LIGHT] > 0) {
        f.buf[B_LIGHT] = 0;
        f.airAttackUsed = true;
        startMove(s, f, normalKeyFor(f, false), ev);
      }
    }
    return;
  }
  if (!isNeutral(f.state)) return;

  if (tryCards(s, f, ev, false)) return;
  if (f.buf[B_GRAB] > 0) {
    f.buf[B_GRAB] = 0;
    startMove(s, f, getFighter(f.def).normals.throw, ev);
    return;
  }
  if (f.buf[B_HEAVY] > 0) {
    f.buf[B_HEAVY] = 0;
    startMove(s, f, normalKeyFor(f, true), ev);
    return;
  }
  if (f.buf[B_LIGHT] > 0) {
    f.buf[B_LIGHT] = 0;
    startMove(s, f, normalKeyFor(f, false), ev);
    return;
  }
  const def = getFighter(f.def);
  if (f.dashReq !== 0) {
    const forward = f.dashReq === f.facing;
    f.dashReq = 0;
    f.dashReqT = 0;
    if (forward) {
      setState(f, 'dashF', def.dashF.frames);
      f.vx = def.dashF.speed * f.facing;
    } else {
      setState(f, 'dashB', def.dashB.frames);
      f.vx = -def.dashB.speed * f.facing;
    }
    ev.push({ t: 'dash', p: f.idx, forward });
    return;
  }
  if (held(f, IN.UP)) {
    setState(f, 'jumpSquat', def.jumpSquat);
    f.vx = 0;
    return;
  }
  const down = held(f, IN.DOWN);
  const back = held(f, backBit(f));
  const fwd = held(f, fwdBit(f));
  const wantsGuard = held(f, IN.BLOCK) || (back && threatened(s, f, o));
  let next: FighterStateName;
  if (wantsGuard) next = 'guard';
  else if (down) next = 'crouch';
  else if (fwd) next = 'walkF';
  else if (back) next = 'walkB';
  else next = 'idle';
  if (next !== f.state) setState(f, next);
  f.crouching = down;
}

/** Is the opponent currently threatening f with an attack (for proximity guard)? */
function threatened(s: GameState, f: FighterState, o: FighterState): boolean {
  if (o.state === 'move' && iabs(o.x - f.x) <= RULES.PROX_GUARD) {
    const mv = getMove(o.def, o.move!);
    for (const h of mv.hits) if (o.mf <= h.end) return true;
  }
  for (const p of s.projectiles) {
    if (!p.alive || p.owner === f.idx || projDef(s, p).barrier) continue;
    const dx = f.x - p.x;
    if (iabs(dx) < RULES.PROX_GUARD * 2 && Math.sign(dx) === p.dir) return true;
  }
  return false;
}

function tryCancel(s: GameState, f: FighterState, ev: SimEvent[]): void {
  if (f.connected === 'none') return;
  const mv = getMove(f.def, f.move!);
  if (mv.specialCancel && tryCards(s, f, ev, !!mv.air)) return;
  // launcher: Up after a connected hit jumps after the opponent (air combo)
  if (mv.jumpCancel && f.connected === 'hit' && f.y === 0 && held(f, IN.UP)) {
    setState(f, 'jumpSquat', getFighter(f.def).jumpSquat);
    f.vx = 0;
    return;
  }
  if (mv.targets && f.chainDepth < 3 && f.state !== 'air' && !held(f, IN.DOWN)) {
    const heavy = f.buf[B_HEAVY] > 0;
    const light = f.buf[B_LIGHT] > 0;
    const t = heavy ? mv.targets.heavy : light ? mv.targets.light : undefined;
    if (t && f.chainDepth >= (t.minDepth ?? 0)) {
      f.buf[heavy ? B_HEAVY : B_LIGHT] = 0;
      const depth = f.chainDepth + 1;
      startMove(s, f, t.move, ev);
      f.chainDepth = depth;
      return;
    }
  }
  if (mv.chains && f.chainDepth < 3) {
    const heavy = f.buf[B_HEAVY] > 0;
    const light = f.buf[B_LIGHT] > 0;
    if (!heavy && !light) return;
    // air normals chain into air normals (jL -> jH in an air combo)
    const n = getFighter(f.def).normals;
    const key = mv.air ? (heavy ? n.jH : n.jL) : normalKeyFor(f, heavy);
    if (mv.chains.includes(key)) {
      f.buf[heavy ? B_HEAVY : B_LIGHT] = 0;
      const depth = f.chainDepth + 1;
      startMove(s, f, key, ev);
      f.chainDepth = depth;
    }
  }
}

function tryCards(s: GameState, f: FighterState, ev: SimEvent[], air: boolean): boolean {
  for (let slot = 0; slot < 3; slot++) {
    if (f.buf[B_S1 + slot] <= 0) continue;
    f.buf[B_S1 + slot] = 0;
    const cardId = f.loadout[slot];
    if (!cardId) continue;
    const card = getCard(f.def, cardId);
    if (air && !card.air) {
      ev.push({ t: 'cardDenied', p: f.idx, card: card.id, reason: 'state' });
      continue;
    }
    if (!canAfford(s, f, card)) {
      ev.push({ t: 'cardDenied', p: f.idx, card: card.id, reason: 'meter' });
      continue;
    }
    const mv = getMove(f.def, card.move);
    if (mv.projectile && s.projectiles.some((p) => p.alive && p.owner === f.idx)) {
      ev.push({ t: 'cardDenied', p: f.idx, card: card.id, reason: 'state' });
      continue;
    }
    if (!s.config.training) f.meter -= card.cost;
    const depth = f.chainDepth;
    startMove(s, f, card.move, ev, card.id);
    f.chainDepth = depth;
    ev.push({ t: 'card', p: f.idx, card: card.id });
    return true;
  }
  return false;
}

export function canAfford(s: GameState, f: FighterState, card: CardDef): boolean {
  return s.config.training || f.meter >= card.cost;
}

function startMove(s: GameState, f: FighterState, key: string, ev: SimEvent[], card: string | null = null): void {
  const mv = getMove(f.def, key);
  const wasAir = f.state === 'air' || (f.state === 'move' && f.y > 0);
  setState(f, 'move');
  f.move = key;
  f.mf = 1;
  f.hitMask = 0;
  f.connected = 'none';
  f.armorUsed = 0;
  f.card = card;
  f.crouching = !!mv.crouching;
  f.chainDepth = 0;
  if (!(mv.air && wasAir)) {
    f.vx = 0;
  }
  if (mv.superFlash) {
    s.freeze = mv.superFlash;
    s.freezeOwner = f.idx;
    ev.push({ t: 'superFlash', p: f.idx, card });
  }
  ev.push({ t: 'moveStart', p: f.idx, move: key, card });
}

// ---------------------------------------------------------------------------
// Physics
// ---------------------------------------------------------------------------

function physics(s: GameState, f: FighterState, ev: SimEvent[]): void {
  const def = getFighter(f.def);
  let gravity = def.gravity;
  switch (f.state) {
    case 'idle':
    case 'crouch':
    case 'guard':
    case 'jumpSquat':
    case 'land':
    case 'blockstun':
    case 'hitstun':
    case 'knockdown':
    case 'wakeup':
    case 'techRecover':
    case 'countered':
    case 'intro':
    case 'win':
      f.vx = 0;
      break;
    case 'walkF':
      f.vx = def.walkF * f.facing;
      break;
    case 'walkB':
      f.vx = -def.walkB * f.facing;
      break;
    case 'dashF':
    case 'dashB': {
      const total = f.state === 'dashF' ? def.dashF.frames : def.dashB.frames;
      const speed = f.state === 'dashF' ? def.dashF.speed : -def.dashB.speed;
      f.vx = f.timer * 4 < total ? idiv(speed, 2) * f.facing : speed * f.facing;
      break;
    }
    case 'move': {
      const mv = getMove(f.def, f.move!);
      if (mv.velocity) {
        for (const k of mv.velocity) {
          if (k.frame !== f.mf) continue;
          if (k.vx !== undefined) f.vx = k.vx * f.facing;
          if (k.vy !== undefined) f.vy = k.vy;
        }
      }
      if (mv.gravity) gravity = mv.gravity;
      break;
    }
    case 'juggle':
    case 'airReset':
    case 'ko':
      gravity = RULES.JUGGLE_GRAVITY;
      if (f.y === 0 && f.vy === 0) f.vx = 0;
      break;
    case 'throwing':
    case 'thrown':
    case 'cineAtk':
    case 'cineDef':
      return;
    default:
      break;
  }
  f.x += f.vx + f.push;
  if (f.push !== 0) {
    f.push = idiv(f.push * 80, 100);
    if (iabs(f.push) < 20) f.push = 0;
  }
  if (f.y > 0 || f.vy > 0) {
    f.y += f.vy;
    f.vy -= gravity;
    if (f.y <= 0) {
      f.y = 0;
      f.vy = 0;
      land(s, f, ev);
    }
  }
}

function land(_s: GameState, f: FighterState, ev: SimEvent[]): void {
  switch (f.state) {
    case 'air':
      setState(f, 'land', RULES.LAND);
      f.vx = 0;
      f.airAttackUsed = false;
      ev.push({ t: 'land', p: f.idx });
      break;
    case 'move': {
      const mv = getMove(f.def, f.move!);
      if (mv.air || mv.endOnLand) {
        setState(f, 'land', mv.landingLag ?? RULES.LAND);
        f.vx = 0;
        f.airAttackUsed = false;
        ev.push({ t: 'land', p: f.idx });
      }
      break;
    }
    case 'juggle':
      setState(f, 'knockdown', RULES.KNOCKDOWN);
      f.vx = 0;
      ev.push({ t: 'knockdown', p: f.idx, x: f.x });
      break;
    case 'airReset':
      setState(f, 'land', RULES.AIR_RESET_LAND);
      f.vx = 0;
      ev.push({ t: 'land', p: f.idx });
      break;
    case 'ko':
      f.vx = 0;
      ev.push({ t: 'knockdown', p: f.idx, x: f.x });
      break;
    default:
      f.vx = 0;
  }
}

function solid(f: FighterState): boolean {
  if (f.state === 'thrown' || f.state === 'cineDef' || f.state === 'cineAtk') return false;
  if (f.state === 'move') {
    const pt = getMove(f.def, f.move!).passThrough;
    if (pt && f.mf >= pt[0] && f.mf <= pt[1]) return false;
  }
  return true;
}

function resolvePush(s: GameState): void {
  const [a, b] = s.fighters;
  const da = getFighter(a.def);
  const db = getFighter(b.def);
  const camLo = s.camX - RULES.SCREEN_HALF;
  const camHi = s.camX + RULES.SCREEN_HALF;
  const clampF = (f: FighterState, half: number) => {
    const l = Math.max(-RULES.STAGE_HALF + half, camLo);
    const h = Math.min(RULES.STAGE_HALF - half, camHi);
    f.x = clamp(f.x, l, h);
  };
  clampF(a, da.pushHalf);
  clampF(b, db.pushHalf);
  if (!solid(a) || !solid(b)) return;
  const vOverlap = a.y < b.y + db.height && b.y < a.y + da.height;
  if (!vOverlap) return;
  const minDist = da.pushHalf + db.pushHalf;
  const dist = iabs(a.x - b.x);
  if (dist >= minDist) return;
  const overlap = minDist - dist;
  // side: which side of b is a on?
  let side = a.x < b.x ? -1 : a.x > b.x ? 1 : 0;
  if (side === 0) {
    // stacked exactly (landing on top): airborne one goes to its back side
    side = a.y > b.y ? -a.facing : b.y > a.y ? b.facing : a.facing > 0 ? -1 : 1;
  }
  const half = idiv(overlap, 2);
  a.x += side * half;
  b.x -= side * (overlap - half);
  clampF(a, da.pushHalf);
  clampF(b, db.pushHalf);
  // if a wall prevented separation, push the other one fully
  const dist2 = iabs(a.x - b.x);
  if (dist2 < minDist) {
    const rest = minDist - dist2;
    const aAtWall = side < 0 ? a.x <= Math.max(-RULES.STAGE_HALF + da.pushHalf, camLo) : a.x >= Math.min(RULES.STAGE_HALF - da.pushHalf, camHi);
    if (aAtWall) b.x -= side * rest;
    else a.x += side * rest;
    clampF(a, da.pushHalf);
    clampF(b, db.pushHalf);
  }
}

function updateFacing(s: GameState): void {
  const [a, b] = s.fighters;
  for (const [f, o] of [
    [a, b],
    [b, a],
  ] as const) {
    if (f.y > 0) continue;
    if (!(isNeutral(f.state) || f.state === 'land' || f.state === 'jumpSquat' || f.state === 'wakeup' || f.state === 'knockdown'))
      continue;
    if (o.x > f.x) f.facing = 1;
    else if (o.x < f.x) f.facing = -1;
  }
}

function updateCamera(s: GameState): void {
  const [a, b] = s.fighters;
  const mid = idiv(a.x + b.x, 2);
  s.camX = clamp(mid, -RULES.STAGE_HALF + RULES.SCREEN_HALF, RULES.STAGE_HALF - RULES.SCREEN_HALF);
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

function spawnProjectile(s: GameState, f: FighterState, mv: MoveDef, ev: SimEvent[]): void {
  const pd = mv.projectile!.def;
  const p: ProjectileState = {
    id: s.nextProjId++,
    owner: f.idx,
    move: mv.key,
    kind: pd.kind,
    x: f.x + f.facing * pd.x,
    y: f.y + pd.y,
    dir: f.facing,
    age: 0,
    alive: true,
  };
  s.projectiles.push(p);
  ev.push({ t: 'projectile', p: f.idx, id: p.id, kind: p.kind });
}

function projDef(s: GameState, p: ProjectileState) {
  return getMove(s.fighters[p.owner].def, p.move).projectile!.def;
}

function updateProjectiles(s: GameState, ev: SimEvent[]): void {
  for (const p of s.projectiles) {
    if (!p.alive) continue;
    const pd = projDef(s, p);
    p.age++;
    let dir = p.dir;
    if (pd.returnAfter !== undefined && p.age > pd.returnAfter) {
      dir = -p.dir;
      const owner = s.fighters[p.owner];
      if (iabs(owner.x - p.x) < m(0.4) && p.age > pd.returnAfter + 4) {
        p.alive = false;
        ev.push({ t: 'projectileEnd', id: p.id, x: p.x, y: p.y });
        continue;
      }
    }
    p.x += dir * pd.speed;
    if (p.age > pd.life || iabs(p.x) > RULES.STAGE_HALF + m(1)) {
      p.alive = false;
      ev.push({ t: 'projectileEnd', id: p.id, x: p.x, y: p.y });
    }
  }
}

// ---------------------------------------------------------------------------
// Collision / hit resolution
// ---------------------------------------------------------------------------

interface WBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function toWorld(f: FighterState, b: Box): WBox {
  return f.facing > 0
    ? { x0: f.x + b.x0, x1: f.x + b.x1, y0: f.y + b.y0, y1: f.y + b.y1 }
    : { x0: f.x - b.x1, x1: f.x - b.x0, y0: f.y + b.y0, y1: f.y + b.y1 };
}

const overlaps = (a: WBox, b: WBox) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** World-space hurtboxes for a fighter in its current state (empty = intangible). */
export function hurtboxes(f: FighterState): WBox[] {
  const def = getFighter(f.def);
  let base: Box[];
  switch (f.state) {
    case 'knockdown':
    case 'wakeup':
    case 'thrown':
    case 'cineAtk':
    case 'cineDef':
    case 'ko':
    case 'intro':
    case 'win':
      return [];
    case 'air':
    case 'juggle':
    case 'airReset':
      base = def.hurtAir;
      break;
    case 'move':
      base = f.y > 0 ? def.hurtAir : f.crouching ? def.hurtCrouch : def.hurtStand;
      break;
    default:
      base = f.crouching && (f.state === 'crouch' || f.state === 'guard' || f.state === 'hitstun' || f.state === 'blockstun')
        ? def.hurtCrouch
        : def.hurtStand;
  }
  const out = base.map((b) => toWorld(f, b));
  if (f.state === 'move') {
    const mv = getMove(f.def, f.move!);
    for (const hb of mv.hurt ?? []) if (f.mf >= hb.start && f.mf <= hb.end) for (const b of hb.boxes) out.push(toWorld(f, b));
  }
  return out;
}

/** World-space active hitboxes (for debug rendering). */
export function activeHitboxes(f: FighterState): WBox[] {
  if (f.state !== 'move' || f.hitstop > 0) return [];
  const mv = getMove(f.def, f.move!);
  const out: WBox[] = [];
  mv.hits.forEach((h, k) => {
    if (f.hitMask & (1 << k)) return;
    if (f.mf >= h.start && f.mf <= h.end) for (const b of h.boxes) out.push(toWorld(f, b));
  });
  return out;
}

export function projectileBox(s: GameState, p: ProjectileState): WBox {
  const pd = projDef(s, p);
  return { x0: p.x - pd.half.w, x1: p.x + pd.half.w, y0: p.y - pd.half.h, y1: p.y + pd.half.h };
}

interface HitCandidate {
  atk: FighterState;
  def: FighterState;
  hit: HitDef;
  k: number;
  x: number;
  y: number;
}

function findHit(f: FighterState, o: FighterState): HitCandidate | null {
  if (f.state !== 'move') return null;
  const mv = getMove(f.def, f.move!);
  for (let k = 0; k < mv.hits.length; k++) {
    const h = mv.hits[k];
    if (f.hitMask & (1 << k)) continue;
    if (f.mf < h.start || f.mf > h.end) continue;
    const targets = h.throw ? throwBoxes(o) : hurtboxes(o);
    for (const b of h.boxes) {
      const hb = toWorld(f, b);
      for (const t of targets) {
        if (overlaps(hb, t)) {
          const x = idiv(Math.max(hb.x0, t.x0) + Math.min(hb.x1, t.x1), 2);
          const y = idiv(Math.max(hb.y0, t.y0) + Math.min(hb.y1, t.y1), 2);
          return { atk: f, def: o, hit: h, k, x, y };
        }
      }
    }
  }
  return null;
}

function throwBoxes(o: FighterState): WBox[] {
  const def = getFighter(o.def);
  return [{ x0: o.x - def.pushHalf, x1: o.x + def.pushHalf, y0: o.y, y1: o.y + def.height }];
}

function collide(s: GameState, ev: SimEvent[], frozen: boolean[]): void {
  const [a, b] = s.fighters;
  const ca = frozen[0] ? null : findHit(a, b);
  const cb = frozen[1] ? null : findHit(b, a);
  let hits = [ca, cb].filter((c): c is HitCandidate => c !== null);
  // validate throws now (whiffed throws simply don't count)
  hits = hits.filter((c) => !(c.hit.throw || c.hit.grabLike) || throwable(c.def));
  if (hits.length === 2) {
    const ta = !!hits[0].hit.throw;
    const tb = !!hits[1].hit.throw;
    if (ta && tb) {
      // throw vs throw: both tech
      for (const c of hits) c.atk.hitMask |= 1 << c.k;
      techBoth(a, b, ev);
      return;
    }
    if (ta !== tb) hits = hits.filter((c) => !c.hit.throw); // strike beats throw
  }
  for (const c of hits) {
    c.atk.hitMask |= 1 << c.k;
    applyHit(s, c.atk, c.def, c.hit, c.x, c.y, null, ev);
  }
  // Trade: a fighter that got hit this frame never keeps a follow-up it earned the same
  // frame (order-independent, keeps P1/P2 symmetric).
  for (const c of hits) if (hits.some((o) => o.def === c.atk)) c.atk.pendingFollowup = null;
  // projectiles vs fighters (barriers never hit fighters)
  for (const p of s.projectiles) {
    if (!p.alive || projDef(s, p).barrier) continue;
    const target = s.fighters[1 - p.owner];
    const pb = projectileBox(s, p);
    for (const hb of hurtboxes(target)) {
      if (overlaps(pb, hb)) {
        p.alive = false;
        const pd = projDef(s, p);
        applyHit(s, s.fighters[p.owner], target, pd.hit, p.x, p.y, p, ev);
        ev.push({ t: 'projectileEnd', id: p.id, x: p.x, y: p.y });
        break;
      }
    }
  }
  // projectile clash
  const alive = s.projectiles.filter((p) => p.alive);
  for (let i = 0; i < alive.length; i++)
    for (let j = i + 1; j < alive.length; j++) {
      const p = alive[i];
      const q = alive[j];
      if (p.owner === q.owner || !p.alive || !q.alive) continue;
      const pb = projDef(s, p).barrier;
      const qb = projDef(s, q).barrier;
      if (pb && qb) continue;
      if (overlaps(projectileBox(s, p), projectileBox(s, q))) {
        // a barrier absorbs the projectile and survives; two projectiles cancel out
        if (!pb) p.alive = false;
        if (!qb) q.alive = false;
        ev.push({ t: 'clash', x: idiv(p.x + q.x, 2), y: idiv(p.y + q.y, 2) });
      }
    }
  s.projectiles = s.projectiles.filter((p) => p.alive);
}

function throwable(d: FighterState): boolean {
  if (d.y > 0 || d.invuln > 0) return false;
  switch (d.state) {
    case 'idle':
    case 'walkF':
    case 'walkB':
    case 'crouch':
    case 'guard':
    case 'jumpSquat':
    case 'land':
    case 'dashF':
      return true;
    case 'dashB':
      return d.sf > 3;
    case 'move': {
      const mv = getMove(d.def, d.move!);
      if (mv.fullInvuln && d.mf >= mv.fullInvuln[0] && d.mf <= mv.fullInvuln[1]) return false;
      return !mv.air;
    }
    default:
      return false;
  }
}

function isInvulnerable(d: FighterState, h: HitDef): boolean {
  if (d.invuln > 0) return true;
  switch (d.state) {
    case 'knockdown':
    case 'wakeup':
    case 'thrown':
    case 'cineAtk':
    case 'cineDef':
    case 'ko':
    case 'airReset':
    case 'intro':
    case 'win':
      return true;
    case 'juggle':
      return d.juggle >= RULES.JUGGLE_LIMIT;
    case 'dashB':
      return !h.throw && d.sf <= getFighter(d.def).dashB.invuln;
    case 'move': {
      const mv = getMove(d.def, d.move!);
      if (mv.fullInvuln && d.mf >= mv.fullInvuln[0] && d.mf <= mv.fullInvuln[1]) return true;
      if (!h.throw && mv.strikeInvuln && d.mf >= mv.strikeInvuln[0] && d.mf <= mv.strikeInvuln[1]) return true;
      return false;
    }
    default:
      return false;
  }
}

const BLOCK_STATES: ReadonlySet<FighterStateName> = new Set(['idle', 'walkB', 'crouch', 'guard', 'blockstun']);

function blockStance(d: FighterState, fromX: number): 'stand' | 'crouch' | null {
  if (!BLOCK_STATES.has(d.state) || d.y > 0) return null;
  const away = fromX > d.x ? IN.LEFT : fromX < d.x ? IN.RIGHT : d.facing > 0 ? IN.LEFT : IN.RIGHT;
  const guarding = held(d, IN.BLOCK) || held(d, away);
  if (!guarding && d.state !== 'blockstun') return null;
  if (guarding || held(d, IN.DOWN)) return held(d, IN.DOWN) ? 'crouch' : 'stand';
  return d.crouching ? 'crouch' : 'stand';
}

export function comboScale(hitNumber: number): number {
  if (hitNumber <= 2) return 100;
  return Math.max(30, 100 - (hitNumber - 2) * 12);
}

function distToWall(s: GameState, f: FighterState, dir: number): number {
  const half = getFighter(f.def).pushHalf;
  if (dir > 0) return Math.min(RULES.STAGE_HALF - half, s.camX + RULES.SCREEN_HALF) - f.x;
  return f.x - Math.max(-RULES.STAGE_HALF + half, s.camX - RULES.SCREEN_HALF);
}

function applyHit(
  s: GameState,
  atk: FighterState,
  def: FighterState,
  h: HitDef,
  x: number,
  y: number,
  proj: ProjectileState | null,
  ev: SimEvent[],
): void {
  if (isInvulnerable(def, h)) return;
  if (h.throw) {
    if (!throwable(def)) return;
    atk.connected = 'hit';
    startThrow(atk, def, ev);
    return;
  }
  const pushDir = proj ? proj.dir : atk.facing;

  // Counter stance
  if (def.state === 'move') {
    const dm = getMove(def.def, def.move!);
    const c = dm.counter;
    if (
      c &&
      def.mf >= c.start &&
      def.mf <= c.end &&
      (!proj || c.catchProjectile) &&
      (h.level !== 'low' || c.catchLow)
    ) {
      const depth = def.chainDepth;
      startMove(s, def, c.followup, ev, def.card);
      def.chainDepth = depth;
      def.facing = proj ? -proj.dir : atk.x > def.x ? 1 : -1;
      def.hitstop = RULES.COUNTER_HITSTOP;
      if (!proj) {
        setState(atk, 'countered', RULES.COUNTER_STAGGER);
        atk.vx = 0;
        atk.hitstop = RULES.COUNTER_HITSTOP;
        atk.pendingFollowup = null;
      }
      ev.push({ t: 'counter', p: def.idx, x, y });
      return;
    }
  }

  // Block
  const stance = h.level === 'unblockable' ? null : blockStance(def, proj ? proj.x - proj.dir : atk.x);
  const levelOk =
    stance !== null &&
    (h.level === 'mid' || (h.level === 'low' && stance === 'crouch') || (h.level === 'overhead' && stance === 'stand'));
  if (levelOk && def.pbWin > 0) {
    // perfect block: no chip, almost no blockstun, a dramatic pause and a punish window
    def.pbWin = 0;
    setState(def, 'blockstun', RULES.PB_STUN);
    def.crouching = stance === 'crouch';
    def.vx = 0;
    def.push = pushDir * 120;
    def.pbPunish = RULES.PB_PUNISH;
    def.hitstop = h.hitstop + RULES.PB_HITSTOP_BONUS;
    if (!proj) {
      atk.hitstop = h.hitstop + RULES.PB_HITSTOP_BONUS;
      atk.connected = 'block';
    }
    addMeter(s, def, RULES.PB_METER);
    ev.push({ t: 'perfectBlock', a: atk.idx, d: def.idx, x, y });
    return;
  }
  if (levelOk) {
    setState(def, 'blockstun', h.blockstun);
    def.crouching = stance === 'crouch';
    def.vx = 0;
    def.health = Math.max(s.config.training ? 1 : 0, def.health - h.chip);
    def.push = pushDir * h.pushBlock;
    if (!proj && distToWall(s, def, pushDir) < m(0.25)) atk.push = -pushDir * h.pushBlock;
    def.hitstop = h.hitstop;
    if (!proj) {
      atk.hitstop = h.hitstop;
      atk.connected = 'block';
    }
    addMeter(s, atk, h.meterOnBlock);
    addMeter(s, def, 6);
    ev.push({ t: 'block', a: atk.idx, d: def.idx, x, y, strength: h.strength, projectile: !!proj });
    return;
  }

  // Armor
  if (def.state === 'move' && !proj) {
    const dm = getMove(def.def, def.move!);
    if (dm.armor && def.mf >= dm.armor.start && def.mf <= dm.armor.end && def.armorUsed < dm.armor.hits) {
      def.armorUsed++;
      const dmg = idiv(h.damage * RULES.ARMOR_DAMAGE_PCT, 100);
      def.health = Math.max(s.config.training ? 1 : 0, def.health - dmg);
      def.hitstop = h.hitstop;
      atk.hitstop = h.hitstop;
      atk.connected = 'block';
      ev.push({ t: 'armor', a: atk.idx, d: def.idx, x, y });
      return;
    }
  }

  // Hit
  const inCombo = def.state === 'hitstun' || def.state === 'juggle' || def.state === 'countered';
  if (!inCombo) {
    def.combo = 0;
    def.comboDamage = 0;
    def.juggle = 0;
  }
  // punish after a perfect block counts as a counter hit too
  const punish = !proj && atk.pbPunish > 0;
  if (punish) atk.pbPunish = 0;
  const counterHit = def.state === 'move' || def.state === 'countered' || punish;
  def.combo++;
  let dmg = idiv(h.damage * comboScale(def.combo), 100);
  if (counterHit && (def.state === 'move' || punish)) dmg = idiv(dmg * RULES.COUNTER_HIT_DAMAGE_PCT, 100);
  dmg = Math.max(1, dmg);
  def.health = Math.max(s.config.training ? 1 : 0, def.health - dmg);
  def.comboDamage += dmg;
  addMeter(s, atk, h.meterOnHit);
  addMeter(s, def, idiv(dmg, 5));
  if (!proj) atk.connected = 'hit';
  const airborne = def.y > 0 || AIR_STATES.has(def.state);
  const wasMoveCrouch = def.crouching;
  def.pendingFollowup = null;
  def.throwMove = null;
  ev.push({
    t: 'hit',
    a: atk.idx,
    d: def.idx,
    x,
    y,
    strength: h.strength,
    damage: dmg,
    combo: def.combo,
    move: proj ? proj.move : atk.move ?? '',
    counter: counterHit && (def.state === 'move' || punish),
    launch: !!h.launch,
    projectile: !!proj,
  });

  if (h.cinematic && !proj) {
    startCinematic(s, atk, def, h.cinematic, ev);
    return;
  }

  if (h.launch || airborne) {
    const wasJumping = airborne && !inCombo;
    setState(def, wasJumping && !h.launch && !h.knockdown ? 'airReset' : 'juggle');
    if (airborne && inCombo) def.juggle++;
    if (h.launch) {
      def.vx = pushDir * h.launch.vx;
      def.vy = h.launch.vy;
    } else {
      // inside an air combo the juggled opponent pops up only a little, so a follow-up air hit can still reach them
      const juggled = airborne && inCombo;
      def.vx = pushDir * (juggled ? 100 : 160);
      def.vy = juggled ? 320 : airborne ? 700 : 500;
    }
    def.y = Math.max(def.y, 1);
    def.push = 0;
  } else if (h.knockdown) {
    setState(def, 'juggle');
    def.juggle = RULES.JUGGLE_LIMIT;
    def.vx = pushDir * 140;
    def.vy = 420;
    def.y = 1;
  } else {
    setState(def, 'hitstun', h.hitstun + (counterHit ? RULES.COUNTER_HIT_STUN_BONUS : 0));
    def.crouching = wasMoveCrouch;
    def.vx = 0;
    def.push = pushDir * h.pushHit;
    if (!proj && distToWall(s, def, pushDir) < m(0.25)) atk.push = -pushDir * h.pushHit;
  }
  const stop = h.hitstop + (counterHit ? 2 : 0);
  def.hitstop = stop;
  if (!proj) atk.hitstop = stop;
  if (h.followup && !proj) atk.pendingFollowup = h.followup;
}

// ---------------------------------------------------------------------------
// Throws
// ---------------------------------------------------------------------------

function startThrow(atk: FighterState, def: FighterState, ev: SimEvent[]): void {
  const mv = getMove(atk.def, atk.move!);
  const back = held(atk, backBit(atk));
  const key = atk.move!;
  setState(atk, 'throwing');
  atk.throwMove = key;
  atk.throwFrame = 0;
  atk.jumpDir = back ? -1 : 1; // reused as throw direction
  atk.vx = 0;
  atk.push = 0;
  setState(def, 'thrown');
  def.vx = 0;
  def.vy = 0;
  def.push = 0;
  def.y = 0;
  const t = mv.hits.find((h) => h.throw)!.throw!;
  def.techWindow = t.kind === 'normal' ? RULES.TECH_WINDOW : 0;
  def.x = atk.x + atk.facing * (getFighter(atk.def).pushHalf + getFighter(def.def).pushHalf);
  def.facing = -atk.facing;
  ev.push({ t: 'throwStart', a: atk.idx, d: def.idx, move: key });
}

function techBoth(a: FighterState, b: FighterState, ev: SimEvent[]): void {
  for (const f of [a, b]) {
    setState(f, 'techRecover', RULES.TECH_RECOVER);
    f.vx = 0;
    f.push = -f.facing * 900;
  }
  ev.push({ t: 'tech', x: idiv(a.x + b.x, 2), y: m(1.2) });
}

function stepThrow(s: GameState, atk: FighterState, def: FighterState, ev: SimEvent[]): void {
  const mv = getMove(atk.def, atk.throwMove!);
  const t = mv.hits.find((h) => h.throw)!.throw!;
  atk.throwFrame++;
  if (def.techWindow > 0) {
    if (def.buf[B_GRAB] > 0) {
      def.buf[B_GRAB] = 0;
      def.techWindow = 0;
      techBoth(atk, def, ev);
      return;
    }
    def.techWindow--;
  }
  if (atk.throwFrame === t.damageFrame) {
    def.health = Math.max(s.config.training ? 1 : 0, def.health - t.damage);
    addMeter(s, atk, 20);
    addMeter(s, def, idiv(t.damage, 8));
    ev.push({ t: 'throwHit', a: atk.idx, d: def.idx, damage: t.damage, x: def.x, y: m(1.0) });
  }
  if (atk.throwFrame >= t.frames) {
    const dir = atk.jumpDir < 0 ? -1 : 1;
    def.x = atk.x + atk.facing * dir * t.endDx;
    setState(def, 'knockdown', RULES.KNOCKDOWN);
    ev.push({ t: 'knockdown', p: def.idx, x: def.x });
    setState(atk, 'idle');
    atk.throwMove = null;
    atk.jumpDir = 0;
    resolvePush(s);
  }
}

// ---------------------------------------------------------------------------
// Cinematics
// ---------------------------------------------------------------------------

function startCinematic(s: GameState, atk: FighterState, def: FighterState, id: string, ev: SimEvent[]): void {
  const cd = getFighter(atk.def).cinematics[id];
  // make room so the whole sequence happens inside the stage
  const room = Math.max(cd.startDx, cd.endDx) + m(0.6);
  const limit = RULES.STAGE_HALF - room;
  if (atk.facing > 0) atk.x = Math.min(atk.x, limit);
  else atk.x = Math.max(atk.x, -limit);
  s.cine = { id, owner: atk.idx, frame: 0, scale: comboScale(def.combo) };
  setState(atk, 'cineAtk');
  setState(def, 'cineDef');
  for (const f of [atk, def]) {
    f.vx = 0;
    f.vy = 0;
    f.y = 0;
    f.push = 0;
    f.hitstop = 0;
    f.pendingFollowup = null;
  }
  def.x = atk.x + atk.facing * cd.startDx;
  def.facing = -atk.facing;
  s.projectiles = [];
  ev.push({ t: 'cineStart', id, owner: atk.idx });
}

function stepCinematic(s: GameState, ev: SimEvent[]): void {
  const c = s.cine!;
  const atk = s.fighters[c.owner];
  const def = s.fighters[1 - c.owner];
  const cd = getFighter(atk.def).cinematics[c.id];
  c.frame++;
  atk.sf++;
  def.sf++;
  cd.hits.forEach((h, i) => {
    if (h.frame !== c.frame) return;
    def.combo++;
    const dmg = Math.max(1, idiv(h.damage * c.scale, 100));
    def.health = Math.max(s.config.training ? 1 : 0, def.health - dmg);
    def.comboDamage += dmg;
    ev.push({ t: 'cineHit', id: c.id, index: i, damage: dmg, strength: h.strength });
  });
  if (c.frame >= cd.frames) {
    def.x = clamp(atk.x + atk.facing * cd.endDx, -RULES.STAGE_HALF + m(0.3), RULES.STAGE_HALF - m(0.3));
    setState(def, 'knockdown', RULES.KNOCKDOWN);
    setState(atk, 'idle');
    s.cine = null;
    ev.push({ t: 'cineEnd', id: c.id });
    updateCamera(s);
    resolvePush(s);
  }
}

// ---------------------------------------------------------------------------
// KO / training
// ---------------------------------------------------------------------------

function checkKO(s: GameState, ev: SimEvent[]): void {
  if (s.phase !== 'fight' || s.cine) return;
  const fs = s.fighters;
  const dead = [fs[0].health <= 0, fs[1].health <= 0];
  if (!dead[0] && !dead[1]) return;
  if (fs.some((f) => f.state === 'thrown' || f.state === 'throwing')) return;
  for (let i = 0; i < 2; i++) {
    if (!dead[i]) continue;
    const f = fs[i];
    const onGround = f.state === 'knockdown';
    setState(f, 'ko');
    f.hitstop = 0;
    if (!onGround) {
      f.vy = Math.max(f.vy, 900);
      f.vx = -f.facing * 200;
      f.y = Math.max(f.y, 1);
    }
  }
  s.roundWinner = dead[0] && dead[1] ? 2 : dead[0] ? 1 : 0;
  if (s.roundWinner === 0) fs[0].roundsWon++;
  else if (s.roundWinner === 1) fs[1].roundsWon++;
  s.phase = 'ko';
  s.phaseFrame = 0;
  s.slowmo = RULES.SLOWMO;
  s.projectiles = [];
  ev.push({ t: 'ko', loser: s.roundWinner === 2 ? -1 : 1 - s.roundWinner });
}

function trainingRefill(s: GameState): void {
  for (const f of s.fighters) {
    f.meter = RULES.METER_MAX;
    const max = getFighter(f.def).health;
    if (f.health < max && isNeutral(f.state) && f.sf > RULES.TRAINING_REFILL_DELAY) f.health = max;
  }
}

/** True if the fighter can act right now (used by AI and training readouts). */
export function isActionable(f: FighterState): boolean {
  return isNeutral(f.state);
}
