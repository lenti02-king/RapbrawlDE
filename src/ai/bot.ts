// CPU opponent. An InputSource that reads the game state (with a human-like
// reaction delay) and outputs inputs. Not part of the deterministic sim, but it
// uses its own seeded RNG so bot-vs-bot tests are reproducible.
import { IN } from '../core/input';
import { getCard, getFighter, getMove } from '../core/registry';
import type { FighterState, GameState } from '../core/state';
import type { InputSource } from '../input/sources';

export interface BotLevel {
  name: string;
  /** Frames of perception delay. */
  reaction: number;
  /** Chance to correctly guard (and guess high/low) when it sees an attack. */
  guard: number;
  /** Chance to punish whiffed/unsafe moves. */
  punish: number;
  /** How often it starts offense in neutral. */
  aggression: number;
  /** Chance to tech throws. */
  tech: number;
  /** Chance to use meter/specials when appropriate. */
  meterUse: number;
}

export const BOT_LEVELS: Record<string, BotLevel> = {
  easy: { name: 'ROOKIE', reaction: 22, guard: 0.3, punish: 0.2, aggression: 0.25, tech: 0.1, meterUse: 0.3 },
  normal: { name: 'CONTENDER', reaction: 15, guard: 0.55, punish: 0.5, aggression: 0.4, tech: 0.35, meterUse: 0.6 },
  hard: { name: 'HEADLINER', reaction: 10, guard: 0.8, punish: 0.85, aggression: 0.55, tech: 0.6, meterUse: 0.85 },
};

interface Snapshot {
  state: string;
  move: string | null;
  mf: number;
  x: number;
  y: number;
  vy: number;
}

type Step = { bits: number; frames: number };

export class Bot implements InputSource {
  private hist: Snapshot[] = [];
  private plan: Step[] = [];
  private seed: number;
  /** Training dummy override. */
  dummy: 'cpu' | 'stand' | 'crouch' | 'block' | 'blockAll' | 'jump' = 'cpu';

  constructor(
    public level: BotLevel = BOT_LEVELS.normal,
    seed = 12345,
  ) {
    this.seed = seed >>> 0 || 1;
  }

  private rnd(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private chance(p: number): boolean {
    return this.rnd() < p;
  }

  poll(s: GameState, idx: number): number {
    const me = s.fighters[idx];
    const op = s.fighters[1 - idx];
    this.hist.push({ state: op.state, move: op.move, mf: op.mf, x: op.x, y: op.y, vy: op.vy });
    if (this.hist.length > 40) this.hist.shift();
    if (s.phase !== 'fight') {
      this.plan = [];
      return 0;
    }
    const fwd = op.x >= me.x ? IN.RIGHT : IN.LEFT;
    const back = fwd === IN.RIGHT ? IN.LEFT : IN.RIGHT;

    if (this.dummy !== 'cpu') return this.dummyInput(s, me, op, back);

    // throw tech (reacts to being grabbed)
    if (me.state === 'thrown' && me.techWindow > 0 && me.sf === 3 && this.chance(this.level.tech)) {
      this.plan = [];
      return IN.GRAB;
    }

    if (!this.plan.length) this.decide(s, me, op);
    return this.next(fwd, back);
  }

  private next(fwd: number, back: number): number {
    const st = this.plan[0];
    if (!st) return 0;
    st.frames--;
    if (st.frames <= 0) this.plan.shift();
    return resolve(st.bits, fwd, back);
  }

  private decide(s: GameState, me: FighterState, op: FighterState): void {

    const seen = this.hist[Math.max(0, this.hist.length - 1 - this.level.reaction)];
    const dist = Math.abs(op.x - me.x) / 10000;
    const myDef = getFighter(me.def);
    if (!seen) return;

    // defense: perceived attack
    if (seen.state === 'move' && seen.move && dist < 3.2 && isActionableish(me)) {
      const mv = getMove(op.def, seen.move);
      const level = mv.hits[0]?.level ?? 'mid';
      const isProj = !!mv.projectile;
      if (!isProj && this.chance(this.level.guard)) {
        const guessLow = level === 'low' ? this.chance(0.85) : this.chance(0.15);
        this.queue([{ bits: IN.BLOCK | (guessLow ? IN.DOWN : 0) | BACK, frames: 14 }]);
        return;
      }
      if (isProj && dist > 2.0 && this.chance(this.level.guard * 0.6)) {
        this.queue([{ bits: IN.UP | FWD, frames: 2 }, { bits: FWD, frames: 30 }, { bits: IN.HEAVY, frames: 1 }, { bits: 0, frames: 20 }]);
        return;
      }
    }

    // punish: opponent recovering from a move close by
    if (op.state === 'move' && op.move && isActionableish(me)) {
      const mv = getMove(op.def, op.move);
      const lastActive = Math.max(0, ...mv.hits.map((h) => h.end));
      const recovering = op.mf > lastActive && mv.total - op.mf > 10;
      if (recovering && dist < 1.25 && this.chance(this.level.punish)) {
        this.queue(this.combo(me, op, true));
        return;
      }
    }

    // anti-air: opponent jumping in
    if ((op.state === 'air' || (op.state === 'move' && op.y > 0)) && dist < 2.0 && op.vy < 600 && isActionableish(me)) {
      if (this.chance(this.level.punish * 0.8)) {
        const launcher = getMove(me.def, myDef.normals['2H']).hits[0]?.launch;
        const aa = launcher ? IN.DOWN | IN.HEAVY : IN.HEAVY;
        this.queue([{ bits: aa, frames: 1 }, { bits: 0, frames: 24 }]);
        return;
      }
      this.queue([{ bits: IN.BLOCK, frames: 18 }]);
      return;
    }

    // knocked down opponent: approach for pressure
    if (op.state === 'knockdown' || op.state === 'wakeup') {
      if (dist > 1.0) this.queue([{ bits: FWD, frames: 6 }]);
      else this.queue([{ bits: IN.BLOCK, frames: 4 }]);
      return;
    }

    if (!isActionableish(me)) return;

    const jabRange = getMove(me.def, myDef.normals['5L']).hits[0].boxes[0].x1 / 10000 + 0.2;
    const ready = (pred: (c: ReturnType<typeof getCard>) => boolean) => this.usableCard(s, me, pred);
    const useCard = (slot: number, after = 24) => this.queue([{ bits: slotBit(slot), frames: 1 }, { bits: 0, frames: after }]);

    // smoke wall vs incoming projectile
    const incoming = s.projectiles.some((p) => p.owner !== me.idx && Math.sign(me.x - p.x) === p.dir && Math.abs(me.x - p.x) < 40000);
    if (incoming) {
      const smoke = ready((c) => c.ai === 'antiProjectile');
      if (smoke >= 0 && this.chance(this.level.meterUse * 0.6)) return useCard(smoke, 20);
    }
    // counter stance when the opponent is starting an attack up close
    if (seen.state === 'move' && seen.mf <= 3 && dist < 1.6) {
      const ctr = ready((c) => c.ai === 'counter');
      if (ctr >= 0 && this.chance(this.level.meterUse * 0.35)) return useCard(ctr, 30);
    }
    // cornered: escape through the opponent
    const wallDist = 75000 - Math.abs(me.x);
    if (wallDist < 9000 && dist < 1.6) {
      const esc = ready((c) => c.ai === 'escape');
      if (esc >= 0 && this.chance(this.level.meterUse * 0.5)) return useCard(esc, 20);
    }
    // long-reach specials in their sweet spot
    const rangeCard = ready((c) => c.ai === 'range' && !!c.aiRange && dist >= c.aiRange[0] && dist <= c.aiRange[1]);
    if (rangeCard >= 0 && this.chance(this.level.meterUse * 0.18)) return useCard(rangeCard, 30);

    // neutral game
    if (dist > 3.6) {
      const proj = ready((c) => c.category === 'zoning' && c.ai !== 'zone');
      const buff = ready((c) => c.ai === 'buff');
      if (proj >= 0 && this.chance(this.level.meterUse * 0.25)) useCard(proj, 30);
      else if (buff >= 0 && me.meter < 200 && this.chance(0.08)) useCard(buff, 20);
      else if (this.chance(0.25)) this.queue([{ bits: FWD, frames: 1 }, { bits: 0, frames: 2 }, { bits: FWD, frames: 1 }, { bits: 0, frames: 14 }]);
      else this.queue([{ bits: FWD, frames: 10 + Math.floor(this.rnd() * 12) }]);
    } else if (dist > jabRange + 0.25) {
      const zone = ready((c) => c.ai === 'zone');
      const r = this.rnd();
      if (zone >= 0 && dist > 1.8 && this.chance(this.level.meterUse * 0.2)) useCard(zone, 26);
      else if (r < 0.55) this.queue([{ bits: FWD, frames: 6 + Math.floor(this.rnd() * 10) }]);
      else if (r < 0.65) this.queue([{ bits: IN.UP | FWD, frames: 3 }, { bits: FWD, frames: 16 }, { bits: IN.HEAVY, frames: 1 }, { bits: 0, frames: 16 }]);
      else if (r < 0.8) this.queue([{ bits: BACK, frames: 8 }]);
      else if (r < 0.9) this.queue([{ bits: FWD, frames: 1 }, { bits: 0, frames: 2 }, { bits: FWD, frames: 1 }, { bits: 0, frames: 10 }]);
      else this.queue([{ bits: 0, frames: 6 }]);
    } else {
      // in range: offense or defense
      if (this.chance(this.level.aggression)) {
        const r = this.rnd();
        if (r < 0.15 && dist < 0.8) this.queue([{ bits: IN.GRAB, frames: 1 }, { bits: 0, frames: 20 }]);
        else if (r < 0.25) this.queue([{ bits: IN.HEAVY, frames: 1 }, { bits: 0, frames: 30 }]);
        else this.queue(this.combo(me, op, false));
      } else if (this.chance(0.5)) {
        this.queue([{ bits: IN.BLOCK | (this.chance(0.4) ? IN.DOWN : 0), frames: 10 + Math.floor(this.rnd() * 12) }]);
      } else this.queue([{ bits: BACK, frames: 6 }]);
    }
  }

  private queue(steps: Step[]): void {
    this.plan.push(...steps.map((x) => ({ ...x })));
  }

  private usableCard(s: GameState, me: FighterState, pred: (c: ReturnType<typeof getCard>) => boolean): number {
    for (let i = 0; i < me.loadout.length; i++) {
      const c = getCard(me.def, me.loadout[i]);
      if (pred(c) && (s.config.training || me.meter >= c.cost)) return i;
    }
    return -1;
  }

  /** A confirmable string: lights -> heavy -> (special) */
  private combo(me: FighterState, op: FighterState, punish: boolean): Step[] {
    void op;
    const low = this.chance(0.35);
    const L = low ? IN.DOWN | IN.LIGHT : IN.LIGHT;
    const out: Step[] = [];
    if (!punish) {
      out.push({ bits: L, frames: 1 }, { bits: low ? IN.DOWN : 0, frames: 9 });
      if (this.chance(0.7)) out.push({ bits: L, frames: 1 }, { bits: low ? IN.DOWN : 0, frames: 9 });
    }
    out.push({ bits: low && this.chance(0.5) ? IN.DOWN | IN.HEAVY : IN.HEAVY, frames: 1 }, { bits: 0, frames: 10 });
    // special cancel with meter
    const s = { config: { training: false } } as GameState;
    const sig = this.usableCard(s, me, (c) => c.category === 'signature');
    const off = this.usableCard(s, me, (c) => c.category !== 'signature' && (c.ai === 'combo' || c.category === 'grapple' || (!c.ai && c.category === 'offense')));
    if (sig >= 0 && this.chance(this.level.meterUse)) out.push({ bits: slotBit(sig), frames: 1 });
    else if (off >= 0 && this.chance(this.level.meterUse * 0.7)) out.push({ bits: slotBit(off), frames: 1 });
    out.push({ bits: 0, frames: 16 });
    return out;
  }

  private dummyInput(s: GameState, me: FighterState, op: FighterState, back: number): number {
    void s;
    void me;
    switch (this.dummy) {
      case 'crouch':
        return IN.DOWN;
      case 'block':
        return op.state === 'move' && op.move ? back | (getMove(op.def, op.move).hits[0]?.level === 'low' ? IN.DOWN : 0) : 0;
      case 'blockAll': {
        const lvl = op.state === 'move' && op.move ? getMove(op.def, op.move).hits.find((h) => h.level !== 'mid')?.level : undefined;
        return IN.BLOCK | (lvl === 'low' ? IN.DOWN : 0);
      }
      case 'jump':
        return IN.UP;
      default:
        return 0;
    }
  }
}

// Relative direction tokens resolved at output time.
const FWD = 1 << 20;
const BACK = 1 << 21;
function resolve(bits: number, fwd: number, back: number): number {
  let out = bits & ~(FWD | BACK);
  if (bits & FWD) out |= fwd;
  if (bits & BACK) out |= back;
  return out;
}

function slotBit(i: number): number {
  return [IN.S1, IN.S2, IN.S3][i];
}

function isActionableish(f: FighterState): boolean {
  return f.state === 'idle' || f.state === 'walkF' || f.state === 'walkB' || f.state === 'crouch' || f.state === 'guard' || f.state === 'blockstun';
}
