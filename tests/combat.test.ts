import { describe, expect, it } from 'vitest';
import { getFighter } from '../src/core/registry';
import { RULES, step } from '../src/core/sim';
import { hashState, cloneState } from '../src/core/state';
import { IN, lcg, m, newMatch, ofType, place, run, script } from './helpers';

const L = IN.LIGHT;
const H = IN.HEAVY;

describe('round flow', () => {
  it('starts in intro and unlocks after the intro', () => {
    const s = newMatch({}, false);
    expect(s.phase).toBe('intro');
    const evs = run(s, RULES.INTRO);
    expect(ofType(evs, 'roundStart')).toHaveLength(1);
    expect(ofType(evs, 'fight')).toHaveLength(1);
    expect(s.phase).toBe('fight');
    expect(s.fighters[0].state).toBe('idle');
  });

  it('KO ends the round, next round resets health, two round wins end the match', () => {
    const s = newMatch();
    const [a, b] = s.fighters;
    place(s, 0.8);
    b.health = 10;
    const evs = run(s, 1, L);
    evs.push(...run(s, 20));
    expect(ofType(evs, 'ko')).toHaveLength(1);
    expect(s.phase).toBe('ko');
    run(s, RULES.KO_PHASE + RULES.ROUND_OVER + 5);
    expect(s.round).toBe(2);
    expect(a.roundsWon).toBe(1);
    expect(b.health).toBe(getFighter('brick').health);
    while (s.phase === 'intro') step(s, [0, 0]);
    place(s, 0.8);
    b.health = 10;
    run(s, 1, L);
    run(s, RULES.KO_PHASE + RULES.ROUND_OVER + 5);
    expect(s.phase).toBe('matchOver');
    expect(s.matchWinner).toBe(0);
  });

  it('time over awards the round to the healthier fighter (by percentage)', () => {
    const s = newMatch({ roundFrames: 60 });
    s.fighters[0].health = 900; // 90% of 1000
    s.fighters[1].health = 980; // 89% of 1100: more HP in absolute terms, less in percent
    const evs = run(s, 70);
    expect(ofType(evs, 'timeover')).toHaveLength(1);
    expect(s.roundWinner).toBe(0);
  });
});

describe('movement', () => {
  it('walks forward faster than backward and cannot pass through the opponent', () => {
    const s = newMatch();
    const a = s.fighters[0];
    const x0 = a.x;
    run(s, 30, IN.RIGHT);
    const fwd = a.x - x0;
    const x1 = a.x;
    run(s, 30, IN.LEFT);
    const back = x1 - a.x;
    expect(fwd).toBeGreaterThan(back);
    run(s, 240, IN.RIGHT);
    const minDist = getFighter('volt').pushHalf + getFighter('brick').pushHalf;
    expect(s.fighters[1].x - a.x).toBeGreaterThanOrEqual(minDist - 1);
  });

  it('jumps after jump squat and lands', () => {
    const s = newMatch();
    const evs = run(s, 1, IN.UP);
    evs.push(...run(s, 80));
    expect(ofType(evs, 'jump')).toHaveLength(1);
    expect(ofType(evs, 'land')).toHaveLength(1);
    expect(s.fighters[0].y).toBe(0);
  });

  it('double tap forward dashes', () => {
    const s = newMatch();
    const evs = script(s, [
      [IN.RIGHT, 0],
      [0, 0],
      [IN.RIGHT, 0],
      [0, 0],
    ]);
    expect(ofType(evs, 'dash')[0]?.forward).toBe(true);
  });
});

describe('attacks and defense', () => {
  it('jab has exactly 5 frames of startup', () => {
    const s = newMatch();
    place(s, 0.8);
    const pressFrame = s.frame + 1;
    const evs = run(s, 1, L);
    evs.push(...run(s, 20));
    const hits = ofType(evs, 'hit');
    expect(hits).toHaveLength(1);
    expect(hits[0].frame - pressFrame + 1).toBe(5);
  });

  it('holding back blocks a mid', () => {
    const s = newMatch();
    place(s, 0.8);
    const hp = s.fighters[1].health;
    // guard already held well before the hit (a press right before it would be a perfect block)
    run(s, RULES.PB_WINDOW + 2, 0, IN.RIGHT | IN.BLOCK);
    place(s, 0.8);
    const evs = run(s, 1, L, IN.RIGHT);
    evs.push(...run(s, 20, 0, IN.RIGHT));
    expect(ofType(evs, 'block')).toHaveLength(1);
    expect(ofType(evs, 'hit')).toHaveLength(0);
    expect(s.fighters[1].health).toBe(hp);
  });

  it('block button blocks regardless of direction', () => {
    const s = newMatch();
    place(s, 0.8);
    run(s, RULES.PB_WINDOW + 2, 0, IN.BLOCK);
    const evs = run(s, 1, L, IN.BLOCK);
    evs.push(...run(s, 20, 0, IN.BLOCK));
    expect(ofType(evs, 'block')).toHaveLength(1);
  });

  it('lows must be crouch-blocked', () => {
    let s = newMatch();
    place(s, 0.8);
    let evs = run(s, 1, IN.DOWN | L, IN.BLOCK);
    evs.push(...run(s, 20, IN.DOWN, IN.BLOCK));
    expect(ofType(evs, 'hit')).toHaveLength(1);

    s = newMatch();
    place(s, 0.8);
    run(s, RULES.PB_WINDOW + 2, 0, IN.BLOCK | IN.DOWN);
    evs = run(s, 1, IN.DOWN | L, IN.BLOCK | IN.DOWN);
    evs.push(...run(s, 20, IN.DOWN, IN.BLOCK | IN.DOWN));
    expect(ofType(evs, 'block')).toHaveLength(1);
  });

  it('perfect block: a press just before the hit takes no chip, gives meter and a counter-hit punish', () => {
    const s = newMatch();
    place(s, 0.8);
    const [a, b] = s.fighters;
    const hp = b.health;
    const meter = b.meter;
    // heavy (chip damage) starts; the defender presses block a few frames before it lands
    const evs = run(s, 1, H);
    evs.push(...run(s, 6));
    evs.push(...run(s, 1, 0, IN.BLOCK));
    // the perfect block freezes both a little longer (drama), then the defender is free almost at once
    evs.push(...run(s, 24, 0, IN.BLOCK));
    expect(ofType(evs, 'perfectBlock')).toHaveLength(1);
    expect(ofType(evs, 'block')).toHaveLength(0);
    expect(b.health).toBe(hp);
    expect(b.meter).toBeGreaterThan(meter);
    // defender is free long before the attacker recovers: the punish is a counter hit
    expect(b.state === 'idle' || b.state === 'guard').toBe(true);
    expect(a.state).toBe('move');
    const punish = run(s, 1, 0, L);
    punish.push(...run(s, 12));
    const hits = ofType(punish, 'hit');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].counter).toBe(true);
  });

  it('perfect block works as a quick tap (released before the hit lands)', () => {
    const s = newMatch();
    place(s, 0.8);
    const hp = s.fighters[1].health;
    const evs = run(s, 1, H);
    evs.push(...run(s, 6));
    evs.push(...run(s, 1, 0, IN.BLOCK)); // one-frame tap
    evs.push(...run(s, 24));
    expect(ofType(evs, 'perfectBlock')).toHaveLength(1);
    expect(ofType(evs, 'hit')).toHaveLength(0);
    expect(s.fighters[1].health).toBe(hp);
  });

  it('a tap long before the hit is not a block (the window is short)', () => {
    const s = newMatch();
    place(s, 0.8);
    const evs = run(s, 1, 0, IN.BLOCK);
    evs.push(...run(s, RULES.PB_WINDOW + 2));
    evs.push(...run(s, 1, L));
    evs.push(...run(s, 20));
    expect(ofType(evs, 'perfectBlock')).toHaveLength(0);
    expect(ofType(evs, 'hit')).toHaveLength(1);
  });

  it('perfect block cannot be mashed: a second press inside the lock opens no new window', () => {
    const s = newMatch();
    place(s, 0.8);
    // press, release, press again just before the hit: still inside the lock -> normal block
    run(s, 1, 0, IN.BLOCK);
    run(s, 1, 0, 0);
    const evs = run(s, 1, H, IN.BLOCK);
    evs.push(...run(s, 4, 0, 0));
    evs.push(...run(s, 1, 0, IN.BLOCK));
    evs.push(...run(s, 14, 0, IN.BLOCK));
    expect(ofType(evs, 'perfectBlock')).toHaveLength(0);
    expect(ofType(evs, 'block')).toHaveLength(1);
  });

  it('forward + heavy is the normal heavy (no accidental slow overhead)', () => {
    const s = newMatch();
    place(s, 1.0);
    run(s, 1, IN.RIGHT | H);
    expect(s.fighters[0].move).toBe('volt_5H');
  });

  it('jump-in attacks are overheads: must be stand-blocked', () => {
    const runJumpIn = (pressAt: number, p2: number) => {
      const s = newMatch();
      place(s, 2.2);
      const evs = run(s, 1, IN.UP | IN.RIGHT, p2);
      evs.push(...run(s, pressAt, IN.RIGHT, p2));
      evs.push(...run(s, 1, H, p2));
      evs.push(...run(s, 50, 0, p2));
      return evs;
    };
    // find a timing deep enough to reach a crouching defender
    let timing = -1;
    for (let t = 10; t < 40 && timing < 0; t++) if (ofType(runJumpIn(t, IN.BLOCK | IN.DOWN), 'hit').length) timing = t;
    expect(timing).toBeGreaterThan(0);
    expect(ofType(runJumpIn(timing, IN.BLOCK | IN.DOWN), 'hit').length).toBe(1);
    expect(ofType(runJumpIn(timing, IN.BLOCK), 'block').length).toBe(1);
  });

  it('throws beat block, and can be teched', () => {
    let s = newMatch();
    place(s, 0.6);
    const hp = s.fighters[1].health;
    let evs = run(s, 1, IN.GRAB, IN.BLOCK);
    evs.push(...run(s, 80, 0, IN.BLOCK));
    expect(ofType(evs, 'throwStart')).toHaveLength(1);
    expect(ofType(evs, 'throwHit')).toHaveLength(1);
    expect(s.fighters[1].health).toBe(hp - 110);

    s = newMatch();
    place(s, 0.6);
    evs = run(s, 1, IN.GRAB, IN.BLOCK);
    evs.push(...run(s, 6, 0, IN.BLOCK));
    evs.push(...run(s, 1, 0, IN.GRAB));
    evs.push(...run(s, 60));
    expect(ofType(evs, 'tech')).toHaveLength(1);
    expect(ofType(evs, 'throwHit')).toHaveLength(0);
  });

  it('strike beats a throw attempt on the same frame', () => {
    const s = newMatch();
    place(s, 0.6);
    // P1 jab (5f) and P2 throw (6f) -> P1 jab hits first anyway; time P2 throw to land same frame
    const evs = script(s, [
      [0, IN.GRAB],
      [L, 0],
      ...Array.from({ length: 30 }, () => [0, 0] as [number, number]),
    ]);
    expect(ofType(evs, 'throwStart')).toHaveLength(0);
    expect(ofType(evs, 'hit').length).toBeGreaterThanOrEqual(1);
  });

  it('L > L > H chain combos with damage scaling', () => {
    const s = newMatch();
    place(s, 0.7);
    const evs = script(s, [
      [L, 0],
      ...Array.from({ length: 9 }, () => [0, 0] as [number, number]),
      [L, 0],
      ...Array.from({ length: 9 }, () => [0, 0] as [number, number]),
      [H, 0],
      ...Array.from({ length: 40 }, () => [0, 0] as [number, number]),
    ]);
    const hits = ofType(evs, 'hit');
    expect(hits.map((h) => h.combo)).toEqual([1, 2, 3]);
    expect(hits[2].damage).toBeLessThan(75);
    expect(ofType(evs, 'block')).toHaveLength(0);
  });

  it('heavy special-cancels into Freestyle Rush (card) which consumes 2 bars', () => {
    const s = newMatch();
    place(s, 0.8);
    s.fighters[0].meter = 300;
    const evs = script(s, [
      [H, 0],
      ...Array.from({ length: 10 }, () => [0, 0] as [number, number]),
      [IN.S2, 0],
      ...Array.from({ length: 120 }, () => [0, 0] as [number, number]),
    ]);
    expect(ofType(evs, 'card').map((c) => c.card)).toEqual(['volt_rush']);
    expect(s.fighters[0].meter).toBeLessThanOrEqual(300 - 200 + 30);
    const hits = ofType(evs, 'hit');
    expect(hits.length).toBe(6); // 5H + rush opener + 4 followup hits
    expect(hits.map((h) => h.combo)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('cards are denied without meter', () => {
    const s = newMatch();
    s.fighters[0].meter = 50;
    const evs = run(s, 1, IN.S1);
    expect(ofType(evs, 'cardDenied')).toHaveLength(1);
    expect(s.fighters[0].state).not.toBe('move');
  });
});

describe('specials', () => {
  it('Mic Check projectile travels and hits', () => {
    const s = newMatch();
    place(s, 3.0);
    s.fighters[0].meter = 100;
    const evs = run(s, 1, IN.S1);
    evs.push(...run(s, 60));
    expect(ofType(evs, 'projectile')).toHaveLength(1);
    const hit = ofType(evs, 'hit')[0];
    expect(hit?.projectile).toBe(true);
    expect(s.fighters[0].meter).toBeLessThan(100);
  });

  it('Punchline counters a jab and punishes', () => {
    const s = newMatch({ fighters: ['volt', 'volt'], loadouts: [['volt_mic', 'volt_rush', 'volt_headliner'], ['volt_counter', 'volt_dive', 'volt_hype']] });
    place(s, 0.7);
    s.fighters[1].meter = 100;
    const evs = script(s, [
      [0, IN.S1],
      [0, 0],
      [L, 0],
      ...Array.from({ length: 60 }, () => [0, 0] as [number, number]),
    ]);
    expect(ofType(evs, 'counter')).toHaveLength(1);
    const hits = ofType(evs, 'hit');
    expect(hits).toHaveLength(1);
    expect(hits[0].a).toBe(1);
  });

  it('Bulldozer armor absorbs a jab', () => {
    const s = newMatch();
    place(s, 1.3);
    s.fighters[1].meter = 100;
    const evs = script(s, [
      [0, IN.S2],
      [0, 0],
      [0, 0],
      [L, 0],
      ...Array.from({ length: 60 }, () => [0, 0] as [number, number]),
    ]);
    expect(ofType(evs, 'armor')).toHaveLength(1);
    expect(ofType(evs, 'hit').some((h) => h.a === 1)).toBe(true);
  });

  it('Headliner: super flash, cinematic on hit, knockdown afterwards', () => {
    const s = newMatch();
    place(s, 1.5);
    s.fighters[0].meter = 300;
    const hp = s.fighters[1].health;
    const evs = run(s, 1, IN.S3);
    evs.push(...run(s, 260));
    expect(ofType(evs, 'superFlash')).toHaveLength(1);
    expect(ofType(evs, 'cineStart')).toHaveLength(1);
    expect(ofType(evs, 'cineHit')).toHaveLength(5);
    expect(ofType(evs, 'cineEnd')).toHaveLength(1);
    expect(hp - s.fighters[1].health).toBe(40 + 35 + 35 + 40 + 60 + 140);
    expect(s.fighters[0].meter).toBe(0);
  });

  it('Headliner blocked: no cinematic, chip damage only', () => {
    const s = newMatch();
    place(s, 1.5);
    s.fighters[0].meter = 300;
    const hp = s.fighters[1].health;
    const evs = run(s, 1, IN.S3, IN.BLOCK);
    evs.push(...run(s, 120, 0, IN.BLOCK));
    expect(ofType(evs, 'cineStart')).toHaveLength(0);
    expect(ofType(evs, 'block')).toHaveLength(1);
    expect(hp - s.fighters[1].health).toBe(30);
  });

  it('Security! cinematic from BRICK', () => {
    const s = newMatch();
    place(s, 1.2);
    s.fighters[1].meter = 300;
    const evs = run(s, 1, 0, IN.S3);
    evs.push(...run(s, 260));
    expect(ofType(evs, 'cineStart')).toHaveLength(1);
    expect(ofType(evs, 'cineEnd')).toHaveLength(1);
    expect(s.fighters[0].health).toBe(1000 - (10 + 30 + 30 + 200));
  });
});

describe('determinism', () => {
  function randomInputs(seed: number, frames: number): [number, number][] {
    const r = lcg(seed);
    const out: [number, number][] = [];
    let a = 0;
    let b = 0;
    for (let i = 0; i < frames; i++) {
      if (r() < 0.15) a = Math.floor(r() * 2048);
      if (r() < 0.15) b = Math.floor(r() * 2048);
      out.push([a, b]);
    }
    return out;
  }

  it('same inputs -> identical state hash', () => {
    const inputs = randomInputs(42, 3000);
    const s1 = newMatch({}, false);
    const s2 = newMatch({}, false);
    for (const inp of inputs) {
      step(s1, inp);
      step(s2, inp);
    }
    expect(hashState(s1)).toBe(hashState(s2));
  });

  it('restoring a snapshot and re-simulating reproduces the same state (rollback)', () => {
    const inputs = randomInputs(7, 2000);
    const s = newMatch({}, false);
    for (let i = 0; i < 1000; i++) step(s, inputs[i]);
    const snap = cloneState(s);
    for (let i = 1000; i < 2000; i++) step(s, inputs[i]);
    const h1 = hashState(s);
    const r = cloneState(snap);
    for (let i = 1000; i < 2000; i++) step(r, inputs[i]);
    expect(hashState(r)).toBe(h1);
  });
});

describe('soak', () => {
  it('random play never breaks invariants', () => {
    const maxHealth = [getFighter('volt').health, getFighter('brick').health];
    const violations: string[] = [];
    let frames = 0;
    let hits = 0;
    const t0 = performance.now();
    for (let seed = 1; seed <= 8; seed++) {
      const r = lcg(seed);
      const s = newMatch({ seed }, false);
      let a = 0;
      let b = 0;
      for (let i = 0; i < 12000 && s.phase !== 'matchOver'; i++) {
        if (r() < 0.2) a = Math.floor(r() * 2048);
        if (r() < 0.2) b = Math.floor(r() * 2048);
        for (const e of step(s, [a, b])) if (e.t === 'hit') hits++;
        frames++;
        for (const f of s.fighters) {
          const bad =
            f.health < 0 ||
            f.health > maxHealth[f.idx] ||
            f.meter < 0 ||
            f.meter > RULES.METER_MAX ||
            Math.abs(f.x) > RULES.STAGE_HALF ||
            f.y < 0 ||
            !Number.isInteger(f.x) ||
            !Number.isInteger(f.y) ||
            !Number.isInteger(f.vx) ||
            !Number.isInteger(f.vy);
          if (bad && violations.length < 5)
            violations.push(`seed ${seed} frame ${s.frame} p${f.idx} ${f.state} x=${f.x} y=${f.y} hp=${f.health} meter=${f.meter}`);
        }
      }
    }
    const ms = performance.now() - t0;
    console.log(`soak: ${frames} frames, ${hits} hits, ${(frames / ms).toFixed(1)} frames/ms`);
    expect(violations).toEqual([]);
    expect(hits).toBeGreaterThan(100);
  }, 60000);
});

void m;
