// GGPO-style rollback session for 1v1.
//
// Each peer simulates every frame immediately using its own input (with a small
// input delay) and a PREDICTION of the remote input (= last known remote input).
// When real remote inputs arrive and differ from the prediction, the session
// restores the snapshot taken before the first mispredicted frame and silently
// re-simulates up to the present. This works because the simulation is fully
// deterministic (integer math, plain-data state).
import type { SimEvent } from '../core/events';
import { step } from '../core/sim';
import { cloneState, type GameState, hashState } from '../core/state';

export type NetMessage =
  /** Inputs for frames [f, f + bits.length). ack = highest remote frame we have confirmed. cur = sender's current frame. */
  | { t: 'in'; f: number; bits: number[]; ack: number; cur: number; adv: number }
  /** Checksum of the state at the START of confirmed frame f. */
  | { t: 'cs'; f: number; h: number };

export interface Transport {
  send(msg: NetMessage): void;
  onMessage: ((msg: NetMessage) => void) | null;
  close?(): void;
}

export interface RollbackOptions {
  inputDelay: number;
  maxRollback: number;
  /** Send a checksum every N confirmed frames (0 = off). */
  checksumEvery: number;
}

export interface TickResult {
  advanced: boolean;
  events: SimEvent[];
  /** Number of frames re-simulated this tick. */
  rolledBack: number;
}

export class RollbackSession {
  readonly opts: RollbackOptions;
  /** Next frame to simulate. Equals state.frame. */
  frame: number;
  private localIn: number[] = [];
  private remoteIn: (number | undefined)[] = [];
  private usedRemote: number[] = [];
  private remoteConfirmed = -1;
  private lastRemote = 0;
  private snaps = new Map<number, GameState>();
  private pendingRollback = Infinity;
  private remoteAck = -1;
  private remoteCur = 0;
  private remoteAdv = 0;
  private advAvgLocal = 0;
  private advAvgRemote = 0;
  private inbox: NetMessage[] = [];
  private ticks = 0;
  /** Hash of the state at the start of each confirmed frame (sampled every checksumEvery). */
  readonly confirmedHashes = new Map<number, number>();
  private hashedUpTo: number;
  private remoteHashes = new Map<number, number>();
  desyncFrame = -1;
  stats = { rollbacks: 0, maxRollback: 0, stalls: 0, resimulated: 0 };

  constructor(
    public state: GameState,
    readonly local: number,
    private transport: Transport,
    opts: Partial<RollbackOptions> = {},
  ) {
    this.opts = { inputDelay: 2, maxRollback: 8, checksumEvery: 30, ...opts };
    this.frame = state.frame;
    this.hashedUpTo = this.frame - 1;
    for (let i = 0; i < this.frame + this.opts.inputDelay; i++) this.localIn[i] = 0;
    for (let i = 0; i < this.frame; i++) {
      this.remoteIn[i] = 0;
      this.usedRemote[i] = 0;
    }
    this.remoteConfirmed = this.frame - 1;
    transport.onMessage = (m) => this.inbox.push(m);
  }

  get remote(): number {
    return 1 - this.local;
  }

  /** Highest frame whose inputs from both players are known. */
  get confirmedFrame(): number {
    return Math.min(this.remoteConfirmed, this.localIn.length - 1);
  }

  /** Our frame minus the remote's last reported frame. */
  get frameAdvantage(): number {
    return this.frame - this.remoteCur;
  }

  /** Call once per 60 Hz tick with the local player's raw input bits. */
  tick(localBits: number): TickResult {
    this.ticks++;
    for (const m of this.inbox.splice(0)) this.receive(m);

    // schedule local input (with delay); never run ahead of the sim by more than the delay
    if (this.localIn.length <= this.frame + this.opts.inputDelay) this.localIn.push(localBits | 0);

    this.sendInputs();

    let rolled = 0;
    if (this.pendingRollback < this.frame) rolled = this.rollback(this.pendingRollback);
    this.pendingRollback = Infinity;

    // can we advance?
    const unconfirmedAhead = this.frame - this.remoteConfirmed - 1;
    let stall = unconfirmedAhead >= this.opts.maxRollback;
    // time sync: the peer that runs ahead waits half the difference in frame advantage
    this.advAvgLocal += (this.frame - this.remoteCur - this.advAvgLocal) * 0.1;
    this.advAvgRemote += (this.remoteAdv - this.advAvgRemote) * 0.1;
    if (!stall && (this.advAvgLocal - this.advAvgRemote) / 2 >= 1 && this.ticks % 4 === 0) stall = true;
    if (stall) {
      this.stats.stalls++;
      this.updateHashes();
      return { advanced: false, events: [], rolledBack: rolled };
    }
    const events = this.simFrame(true);
    this.updateHashes();
    this.prune();
    return { advanced: true, events, rolledBack: rolled };
  }

  private inputsFor(f: number): number[] {
    const known = this.remoteIn[f];
    const r = known ?? this.lastRemoteBefore(f);
    this.usedRemote[f] = r;
    const local = this.localIn[f] ?? 0;
    return this.local === 0 ? [local, r] : [r, local];
  }

  private lastRemoteBefore(f: number): number {
    // prediction: repeat the most recent confirmed remote input at or before f
    if (this.remoteConfirmed >= 0) return this.remoteIn[Math.min(f, this.remoteConfirmed)] ?? this.lastRemote;
    return 0;
  }

  private simFrame(present: boolean): SimEvent[] {
    const f = this.frame;
    this.snaps.set(f, cloneState(this.state));
    const ev = step(this.state, this.inputsFor(f));
    this.frame++;
    return present ? ev : [];
  }

  private rollback(from: number): number {
    const snap = this.snaps.get(from);
    if (!snap) throw new Error(`rollback: no snapshot for frame ${from} (frame ${this.frame})`);
    const target = this.frame;
    this.state = cloneState(snap);
    this.frame = from;
    let n = 0;
    while (this.frame < target) {
      this.simFrame(false);
      n++;
    }
    this.stats.rollbacks++;
    this.stats.resimulated += n;
    this.stats.maxRollback = Math.max(this.stats.maxRollback, n);
    return n;
  }

  private receive(m: NetMessage): void {
    if (m.t === 'in') {
      this.remoteAck = Math.max(this.remoteAck, m.ack);
      if (m.cur >= this.remoteCur) {
        this.remoteCur = m.cur;
        this.remoteAdv = m.adv;
      }
      for (let i = 0; i < m.bits.length; i++) {
        const f = m.f + i;
        if (this.remoteIn[f] !== undefined) continue;
        this.remoteIn[f] = m.bits[i];
        if (f < this.frame && this.usedRemote[f] !== m.bits[i]) this.pendingRollback = Math.min(this.pendingRollback, f);
      }
      while (this.remoteIn[this.remoteConfirmed + 1] !== undefined) this.remoteConfirmed++;
      this.lastRemote = this.remoteIn[this.remoteConfirmed] ?? 0;
      // frames predicted with an outdated "last input" are also mispredictions
      for (let f = this.remoteConfirmed + 1; f < this.frame; f++) {
        if (this.usedRemote[f] !== this.lastRemote) {
          this.pendingRollback = Math.min(this.pendingRollback, f);
          break;
        }
      }
    } else if (m.t === 'cs') {
      this.remoteHashes.set(m.f, m.h);
      const mine = this.confirmedHashes.get(m.f);
      if (mine !== undefined && mine !== m.h && this.desyncFrame < 0) this.desyncFrame = m.f;
    }
  }

  private sendInputs(): void {
    const from = Math.min(this.localIn.length, Math.max(this.remoteAck + 1, this.localIn.length - 16));
    this.transport.send({
      t: 'in',
      f: from,
      bits: this.localIn.slice(from),
      ack: this.remoteConfirmed,
      cur: this.frame,
      adv: this.frame - this.remoteCur,
    });
  }

  private updateHashes(): void {
    const every = this.opts.checksumEvery;
    if (!every) return;
    // A frame F's start state is final once all inputs before F are confirmed and no rollback is pending.
    const limit = Math.min(this.remoteConfirmed + 1, this.frame);
    while (this.hashedUpTo + 1 <= limit) {
      const F = this.hashedUpTo + 1;
      if (F % every === 0) {
        const st = F === this.frame ? this.state : this.snaps.get(F);
        if (!st) break;
        const h = hashState(st);
        this.confirmedHashes.set(F, h);
        this.transport.send({ t: 'cs', f: F, h });
        const theirs = this.remoteHashes.get(F);
        if (theirs !== undefined && theirs !== h && this.desyncFrame < 0) this.desyncFrame = F;
      }
      this.hashedUpTo = F;
    }
  }

  private prune(): void {
    const keepFrom = Math.min(this.remoteConfirmed + 1, this.hashedUpTo + 1, this.frame - this.opts.maxRollback - 1);
    for (const f of this.snaps.keys()) if (f < keepFrom) this.snaps.delete(f);
  }

  /** Inputs actually used for frame f (for replays/tests): [p1, p2]. */
  inputsUsed(f: number): [number, number] {
    const l = this.localIn[f] ?? 0;
    const r = this.remoteIn[f] ?? this.usedRemote[f] ?? 0;
    return this.local === 0 ? [l, r] : [r, l];
  }
}

// ---------------------------------------------------------------------------
// Test/dev transports
// ---------------------------------------------------------------------------

/** In-memory link with configurable latency (in ticks), jitter and packet loss. */
export class SimulatedLink {
  private queue: { at: number; to: 0 | 1; msg: NetMessage }[] = [];
  private tick = 0;
  readonly ends: [Transport, Transport];
  private seed: number;

  constructor(
    public latency = 4,
    public jitter = 2,
    public loss = 0.05,
    seed = 1,
  ) {
    this.seed = seed >>> 0 || 1;
    const mk = (from: 0 | 1): Transport => ({
      onMessage: null,
      send: (msg) => {
        if (this.rnd() < this.loss) return;
        const delay = this.latency + Math.floor(this.rnd() * (this.jitter + 1));
        this.queue.push({ at: this.tick + delay, to: (1 - from) as 0 | 1, msg: structuredClone(msg) });
      },
    });
    this.ends = [mk(0), mk(1)];
  }

  private rnd(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Deliver everything due at the current tick, then advance time. */
  pump(): void {
    const due = this.queue.filter((q) => q.at <= this.tick);
    this.queue = this.queue.filter((q) => q.at > this.tick);
    for (const d of due) this.ends[d.to].onMessage?.(d.msg);
    this.tick++;
  }
}

/** Same-browser transport between two tabs (dev testing of netplay without a server). */
export class BroadcastTransport implements Transport {
  onMessage: ((msg: NetMessage) => void) | null = null;
  private ch: BroadcastChannel;
  constructor(
    room: string,
    private self: number,
  ) {
    this.ch = new BroadcastChannel(`rapbrawl-${room}`);
    this.ch.onmessage = (e: MessageEvent<{ from: number; msg: NetMessage }>) => {
      if (e.data.from !== this.self) this.onMessage?.(e.data.msg);
    };
  }
  send(msg: NetMessage): void {
    this.ch.postMessage({ from: this.self, msg });
  }
  close(): void {
    this.ch.close();
  }
}
