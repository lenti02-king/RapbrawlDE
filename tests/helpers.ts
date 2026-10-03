import '../src/content';
import type { SimEvent } from '../src/core/events';
import { IN } from '../src/core/input';
import { m } from '../src/core/math';
import { createMatch, defaultConfig, step } from '../src/core/sim';
import type { GameState, MatchConfig } from '../src/core/state';

export { IN, m };

export function newMatch(partial: Partial<MatchConfig> = {}, skipIntro = true): GameState {
  const s = createMatch(defaultConfig(partial));
  if (skipIntro) while (s.phase === 'intro') step(s, [0, 0]);
  return s;
}

/** Run `frames` frames with constant inputs; returns all events (tagged with frame). */
export function run(s: GameState, frames: number, p1 = 0, p2 = 0): (SimEvent & { frame: number })[] {
  const out: (SimEvent & { frame: number })[] = [];
  for (let i = 0; i < frames; i++) {
    for (const e of step(s, [p1, p2])) out.push({ ...e, frame: s.frame });
  }
  return out;
}

/** Run a script: list of [p1, p2] inputs, one per frame. */
export function script(s: GameState, inputs: [number, number][]): (SimEvent & { frame: number })[] {
  const out: (SimEvent & { frame: number })[] = [];
  for (const inp of inputs) for (const e of step(s, inp)) out.push({ ...e, frame: s.frame });
  return out;
}

/** Place fighters at a given center distance (meters), P1 on the left facing right. */
export function place(s: GameState, distMeters: number): void {
  const [a, b] = s.fighters;
  a.x = -m(distMeters) / 2;
  b.x = m(distMeters) / 2;
  a.facing = 1;
  b.facing = -1;
  s.camX = 0;
}

export function ofType<T extends SimEvent['t']>(evs: (SimEvent & { frame: number })[], t: T) {
  return evs.filter((e) => e.t === t) as (Extract<SimEvent, { t: T }> & { frame: number })[];
}

/** Seeded PRNG for test input generation (not used by the sim). */
export function lcg(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}
