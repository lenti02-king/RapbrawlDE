// Runs a match: fixed 60 Hz simulation steps, input polling, presentation.
import type { SimEvent } from '../core/events';
import { step } from '../core/sim';
import type { GameState } from '../core/state';
import type { InputSource } from '../input/sources';
import type { GameView } from '../render/view';

export const STEP_MS = 1000 / 60;

export interface MatchListener {
  onEvents?(s: GameState, events: readonly SimEvent[]): void;
  onFrame?(s: GameState, dt: number): void;
}

export class MatchRunner {
  paused = false;
  /** Training: 1 = normal, 0.25 etc = slow motion. */
  speed = 1;
  private acc = 0;
  private stepRequests = 0;
  listeners: MatchListener[] = [];
  /** Last input bits per player (for input display / replays). */
  lastInputs: [number, number] = [0, 0];
  /** Recorded inputs (for replays / debugging). */
  readonly inputLog: [number, number][] = [];

  constructor(
    public state: GameState,
    readonly view: GameView,
    readonly sources: [InputSource, InputSource],
  ) {
    view.setMatch(state);
  }

  /** Advance one simulation frame. */
  frame(): void {
    const s = this.state;
    const inputs: [number, number] = [this.sources[0].poll(s, 0), this.sources[1].poll(s, 1)];
    this.lastInputs = inputs;
    this.inputLog.push(inputs);
    const events = step(s, inputs);
    if (events.length) {
      this.view.handleEvents(s, events);
      for (const l of this.listeners) l.onEvents?.(s, events);
    }
  }

  requestStep(): void {
    this.stepRequests++;
  }

  /** Called every animation frame with elapsed ms. */
  tick(elapsedMs: number, beat: number): void {
    const dt = Math.min(0.1, elapsedMs / 1000);
    if (!this.paused) {
      this.acc += Math.min(100, elapsedMs) * this.speed;
      let n = 0;
      while (this.acc >= STEP_MS && n < 6) {
        this.frame();
        this.acc -= STEP_MS;
        n++;
      }
      if (n === 6) this.acc = 0;
    } else if (this.stepRequests > 0) {
      this.stepRequests--;
      this.frame();
    }
    const alpha = this.paused ? 0 : Math.min(1, this.acc / STEP_MS);
    this.view.render(this.state, dt, alpha, beat);
    for (const l of this.listeners) l.onFrame?.(this.state, dt);
  }
}
