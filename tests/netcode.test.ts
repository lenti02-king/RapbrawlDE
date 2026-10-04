import { describe, expect, it } from 'vitest';
import { RollbackSession, SimulatedLink } from '../src/net/rollback';
import { createMatch, defaultConfig, step } from '../src/core/sim';
import { hashState } from '../src/core/state';
import { lcg } from './helpers';

function runNetplay(latency: number, jitter: number, loss: number, ticks: number, seed: number, delay = 2) {
  const link = new SimulatedLink(latency, jitter, loss, seed);
  const cfg = defaultConfig({ seed: 77 });
  const A = new RollbackSession(createMatch(cfg), 0, link.ends[0], { inputDelay: delay });
  const B = new RollbackSession(createMatch(cfg), 1, link.ends[1], { inputDelay: delay });
  const ra = lcg(seed * 7 + 1);
  const rb = lcg(seed * 13 + 3);
  let ia = 0;
  let ib = 0;
  for (let t = 0; t < ticks; t++) {
    link.pump();
    if (ra() < 0.12) ia = Math.floor(ra() * 2048);
    if (rb() < 0.12) ib = Math.floor(rb() * 2048);
    A.tick(ia);
    B.tick(ib);
  }
  // let the network settle with neutral inputs
  for (let t = 0; t < 60; t++) {
    link.pump();
    A.tick(0);
    B.tick(0);
  }
  const F = Math.min(A.confirmedFrame, B.confirmedFrame);
  // reference: plain local simulation of the inputs both peers agreed on
  const ref = createMatch(cfg);
  let compared = 0;
  for (let f = 0; f < F; f++) {
    expect(A.inputsUsed(f)).toEqual(B.inputsUsed(f));
    const ha = A.confirmedHashes.get(f);
    const hb = B.confirmedHashes.get(f);
    if (ha !== undefined || hb !== undefined) {
      const hr = hashState(ref);
      if (ha !== undefined) expect(ha, `A frame ${f}`).toBe(hr);
      if (hb !== undefined) expect(hb, `B frame ${f}`).toBe(hr);
      compared++;
    }
    step(ref, A.inputsUsed(f));
  }
  return { A, B, F, compared };
}

describe('rollback netcode', () => {
  it('zero latency: both peers stay in lockstep with the reference sim', () => {
    const { A, B, F, compared } = runNetplay(0, 0, 0, 600, 1);
    expect(F).toBeGreaterThan(500);
    expect(compared).toBeGreaterThan(10);
    expect(A.desyncFrame).toBe(-1);
    expect(B.desyncFrame).toBe(-1);
  });

  it('typical internet (66ms + jitter, 5% loss): rollbacks happen, states converge', () => {
    const { A, B, F, compared } = runNetplay(4, 2, 0.05, 1800, 2);
    expect(F).toBeGreaterThan(1500);
    expect(compared).toBeGreaterThan(40);
    expect(A.stats.rollbacks + B.stats.rollbacks).toBeGreaterThan(0);
    expect(A.desyncFrame).toBe(-1);
    expect(B.desyncFrame).toBe(-1);
    expect(A.stats.maxRollback).toBeLessThanOrEqual(A.opts.maxRollback);
  });

  it('bad connection (150ms, heavy jitter, 15% loss): stalls instead of diverging', () => {
    const { A, B, F, compared } = runNetplay(9, 5, 0.15, 1500, 3);
    expect(F).toBeGreaterThan(600);
    expect(compared).toBeGreaterThan(15);
    expect(A.stats.stalls + B.stats.stalls).toBeGreaterThan(0);
    expect(A.desyncFrame).toBe(-1);
    expect(B.desyncFrame).toBe(-1);
  });

  it('peers end up at nearly the same frame (time sync)', () => {
    const { A, B } = runNetplay(5, 1, 0.02, 1200, 4);
    expect(Math.abs(A.frame - B.frame)).toBeLessThanOrEqual(6);
  });
});

describe('rollback startup', () => {
  it('recovers when one peer starts 30 frames late and early packets are lost', () => {
    const link = new SimulatedLink(3, 1, 0.02, 11);
    const cfg = defaultConfig({ seed: 5 });
    const A = new RollbackSession(createMatch(cfg), 0, link.ends[0]);
    let B: RollbackSession | null = null;
    const r = lcg(99);
    let ia = 0;
    let ib = 0;
    for (let t = 0; t < 900; t++) {
      if (t === 30) B = new RollbackSession(createMatch(cfg), 1, link.ends[1]);
      link.pump();
      if (r() < 0.12) ia = Math.floor(r() * 2048);
      if (r() < 0.12) ib = Math.floor(r() * 2048);
      A.tick(ia);
      B?.tick(ib);
    }
    expect(B).not.toBeNull();
    expect(A.confirmedFrame).toBeGreaterThan(600);
    expect(B!.confirmedFrame).toBeGreaterThan(600);
    expect(A.desyncFrame).toBe(-1);
    expect(B!.desyncFrame).toBe(-1);
    const F = Math.min(A.confirmedFrame, B!.confirmedFrame);
    for (let f = 0; f < F; f += 7) expect(A.inputsUsed(f)).toEqual(B!.inputsUsed(f));
  });
});
