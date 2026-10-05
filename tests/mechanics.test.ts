// Session 8 mechanics: Beat-Drop, Mic-Duell, Wand-Splat, Fatality (all deterministic sim rules).
import { describe, expect, it } from 'vitest';
import { idiv } from '../src/core/math';
import { getFighter, getMove } from '../src/core/registry';
import { beatDistance, RULES, step } from '../src/core/sim';
import { IN, m, newMatch, ofType, place, run } from './helpers';

const JJ = { fighters: ['jazeek', 'jazeek'] as [string, string] };

describe('Beat-Drop', () => {
  it('hits on the beat deal +15 % damage and double hype, off-beat hits are normal', () => {
    const base = getMove('jazeek', 'jaz_5L').hits[0];
    let on = 0;
    let off = 0;
    for (let offset = 0; offset < RULES.BEAT_FRAMES; offset++) {
      const s = newMatch(JJ);
      place(s, 0.8);
      run(s, offset);
      const m0 = s.fighters[0].meter;
      const evs = run(s, 1, IN.LIGHT).concat(run(s, 12));
      const hit = ofType(evs, 'hit')[0];
      expect(hit).toBeDefined();
      const beat = beatDistance(hit.frame) <= RULES.BEAT_WINDOW;
      expect(hit.beat).toBe(beat);
      expect(hit.damage).toBe(beat ? idiv(base.damage * RULES.BEAT_DAMAGE_PCT, 100) : base.damage);
      const gained = s.fighters[0].meter - m0;
      const pct = getFighter('jazeek').meterGainPct ?? 100;
      expect(gained).toBe(idiv((beat ? base.meterOnHit * 2 : base.meterOnHit) * pct, 100));
      if (beat) on++;
      else off++;
    }
    expect(on).toBe(RULES.BEAT_WINDOW * 2 + 1);
    expect(off).toBe(RULES.BEAT_FRAMES - on);
  });
});

describe('Mic-Duell', () => {
  it('a heavy trade starts a tap duel; the faster tapper sends the other flying; cooldown afterwards', () => {
    const s = newMatch(JJ);
    place(s, 1.0);
    const evs = run(s, 1, IN.HEAVY, IN.HEAVY).concat(run(s, 14));
    expect(ofType(evs, 'duelStart')).toHaveLength(1);
    expect(ofType(evs, 'hit')).toHaveLength(0);
    expect(s.fighters.map((f) => f.state)).toEqual(['clash', 'clash']);
    const hp = s.fighters[1].health;
    const timer = s.timer;
    // P1 mashes (press / release), P2 taps only a few times
    for (let i = 0; s.duel; i++) step(s, [i % 4 === 0 ? IN.LIGHT : 0, i % 30 === 0 ? IN.LIGHT : 0]);
    expect(s.timer).toBe(timer); // the round clock stops during the duel
    expect(s.fighters[1].health).toBe(hp - RULES.DUEL_DAMAGE);
    expect(s.fighters[1].state).toBe('juggle');
    expect(s.fighters[1].vx * s.fighters[0].facing).toBeGreaterThan(0);
    // trade again right away: no duel during the cooldown
    run(s, 80);
    place(s, 1.0);
    const evs2 = run(s, 1, IN.HEAVY, IN.HEAVY).concat(run(s, 14));
    expect(ofType(evs2, 'duelStart')).toHaveLength(0);
    expect(ofType(evs2, 'hit')).toHaveLength(2);
  });

  it('jab trades stay normal trades', () => {
    const s = newMatch(JJ);
    place(s, 0.75);
    const evs = run(s, 1, IN.LIGHT, IN.LIGHT).concat(run(s, 10));
    expect(ofType(evs, 'duelStart')).toHaveLength(0);
    expect(ofType(evs, 'hit')).toHaveLength(2);
  });
});

describe('Wand-Splat', () => {
  it('a strong knockdown into the stage wall sticks the opponent to it; they can be hit again, then drop', () => {
    const s = newMatch({ fighters: ['jazeek', 'bonez'] });
    const [a, b] = s.fighters;
    const half = getFighter('bonez').pushHalf;
    b.x = RULES.STAGE_HALF - half - m(0.3);
    a.x = b.x - m(1.0);
    a.facing = 1;
    b.facing = -1;
    s.camX = Math.min(RULES.STAGE_HALF - RULES.SCREEN_HALF, b.x);
    const evs: ReturnType<typeof run> = [];
    // H, then H once it connects (Encore-Haken: strength 3 knockdown)
    let pressed = false;
    for (let i = 0; i < 70 && !ofType(evs, 'wallSplat').length; i++) {
      let bits = i === 0 ? IN.HEAVY : 0;
      if (!pressed && a.state === 'move' && a.move === 'jaz_5H' && a.connected === 'hit') {
        bits = IN.HEAVY;
        pressed = true;
      }
      for (const e of step(s, [bits, 0])) evs.push({ ...e, frame: s.frame });
    }
    const splat = ofType(evs, 'wallSplat');
    expect(splat).toHaveLength(1);
    expect(splat[0].ko).toBe(false);
    expect(b.state).toBe('wallSplat');
    expect(b.y).toBeGreaterThan(0);
    // follow-up while stuck: still part of the combo
    const comboBefore = b.combo;
    while (a.state !== 'idle') step(s, [0, 0]);
    while (b.x - a.x > m(0.85)) step(s, [IN.RIGHT, 0]);
    const more = run(s, 1, IN.LIGHT).concat(run(s, 10));
    const hits = ofType(more, 'hit');
    expect(hits).toHaveLength(1);
    expect(hits[0].combo).toBe(comboBefore + 1);
    // no second splat in the same combo; ends in a knockdown
    const rest = run(s, 90);
    expect(ofType(rest, 'wallSplat')).toHaveLength(0);
    expect(ofType(rest, 'knockdown').length).toBeGreaterThan(0);
  });
});

describe('Fatality', () => {
  const matchPoint = () => {
    const s = newMatch(JJ);
    place(s, 0.8);
    s.fighters[0].roundsWon = s.config.roundsToWin - 1;
    s.fighters[1].health = 5;
    run(s, 1, IN.LIGHT);
    const evs = run(s, RULES.KO_PHASE + 20);
    return { s, evs };
  };

  it('match point KO opens the finish phase; SIGNATURE starts the fatality, then the match ends', () => {
    const { s, evs } = matchPoint();
    expect(ofType(evs, 'finishHim')).toHaveLength(1);
    expect(s.phase).toBe('finish');
    expect(s.fighters[1].state).toBe('dizzy');
    run(s, 10);
    const q = run(s, 1, IN.S3).concat(run(s, 3));
    expect(ofType(q, 'fatalQte')).toHaveLength(1);
    const seq = s.fatalQte!.seq;
    expect(seq).toHaveLength(3);
    let f: ReturnType<typeof run> = [];
    for (const bit of seq) f = f.concat(run(s, 1, bit), run(s, 3));
    expect(ofType(f, 'fatalStep').every((e) => e.ok)).toBe(true);
    expect(ofType(f, 'fatality')).toHaveLength(1);
    expect(s.fatal?.owner).toBe(0);
    const end = run(s, RULES.FATALITY_FRAMES + RULES.ROUND_OVER + 5);
    expect(ofType(end, 'fatalityEnd')).toHaveLength(1);
    expect(s.phase).toBe('matchOver');
    expect(s.matchWinner).toBe(0);
    expect(s.fatality).toBe(true);
  });

  it('the loser cannot start it, and without a press the window simply closes', () => {
    const { s } = matchPoint();
    run(s, 10, 0, IN.S3);
    expect(s.fatal).toBeNull();
    run(s, RULES.FINISH_WINDOW + RULES.ROUND_OVER + 5);
    expect(s.phase).toBe('matchOver');
    expect(s.fatality).toBe(false);
  });

  it('a wrong button in the minigame lets the beaten fighter collapse (no fatality)', () => {
    const { s } = matchPoint();
    run(s, 10);
    run(s, 1, IN.S3);
    run(s, 3);
    const want = s.fatalQte!.seq[0];
    const wrong = [IN.LIGHT, IN.HEAVY, IN.GRAB].find((b) => b !== want)!;
    run(s, 1, wrong);
    run(s, RULES.ROUND_OVER + 10);
    expect(s.fatal).toBeNull();
    expect(s.phase).toBe('matchOver');
    expect(s.fatality).toBe(false);
  });

  it('the card only works in range: the winner has to walk up first', () => {
    const { s } = matchPoint();
    s.fighters[0].x = s.fighters[1].x - RULES.FATAL_RANGE - 20000;
    run(s, 10);
    run(s, 1, IN.S3);
    run(s, 3);
    expect(s.fatalQte).toBeNull();
    const fwd = s.fighters[0].facing > 0 ? IN.RIGHT : IN.LEFT;
    run(s, 40, fwd);
    run(s, 1, IN.S3);
    run(s, 3);
    expect(s.fatalQte).not.toBeNull();
  });

  it('no finish phase before match point', () => {
    const s = newMatch(JJ);
    place(s, 0.8);
    s.fighters[1].health = 5;
    run(s, 1, IN.LIGHT);
    const evs = run(s, RULES.KO_PHASE + 10);
    expect(ofType(evs, 'finishHim')).toHaveLength(0);
    expect(s.phase).toBe('roundOver');
  });
});
