import { describe, expect, it } from 'vitest';
import { RULES, step } from '../src/core/sim';
import { validateLoadout } from '../src/core/registry';
import { IN, newMatch, ofType, place, run, script } from './helpers';

const JB = { fighters: ['jazeek', 'bonez'] as [string, string] };
const idle = (n: number) => Array.from({ length: n }, () => [0, 0] as [number, number]);

describe('loadout rule: 2 specials + 1 signature', () => {
  it('accepts the defaults and rejects wrong layouts', () => {
    expect(validateLoadout('jazeek', ['jaz_wave', 'jaz_mvp', 'jaz_99'])).toBeNull();
    expect(validateLoadout('bonez', ['bon_croc', 'bon_smoke', 'bon_team'])).toBeNull();
    expect(validateLoadout('jazeek', ['jaz_wave', 'jaz_mvp', 'jaz_spot'])).not.toBeNull(); // no signature
    expect(validateLoadout('jazeek', ['jaz_99', 'jaz_mvp', 'jaz_wave'])).not.toBeNull(); // signature in wrong slot
    expect(validateLoadout('jazeek', ['bon_croc', 'jaz_mvp', 'jaz_99'])).not.toBeNull(); // other fighter's card
  });
});

describe('Jazeek', () => {
  it('Stimmwelle hits at mid range and pushes the opponent far away', () => {
    const s = newMatch({ ...JB, loadouts: [['jaz_wave', 'jaz_mvp', 'jaz_99'], ['bon_croc', 'bon_smoke', 'bon_team']] });
    place(s, 2.0);
    s.fighters[0].meter = 100;
    const x0 = s.fighters[1].x;
    const evs = run(s, 1, IN.S1);
    evs.push(...run(s, 40));
    expect(ofType(evs, 'hit')[0]?.projectile).toBe(true);
    expect(s.fighters[1].x - x0).toBeGreaterThan(5000); // pushed > 0.5 m
  });

  it('Diamanten-Regen: falls over the opponent (any range up to 4.6 m), three hits from above, crouch-block fails, stand-block works', () => {
    const go = (dist: number, p2: number, frames = 110) => {
      const s = newMatch({ ...JB, loadouts: [['jaz_rain', 'jaz_mvp', 'jaz_99'], ['bon_croc', 'bon_smoke', 'bon_team']] });
      place(s, dist);
      s.fighters[0].meter = 200;
      const hp = s.fighters[1].health;
      const evs = run(s, 1, IN.S1, p2).concat(run(s, frames, 0, p2));
      return { evs, dmg: hp - s.fighters[1].health };
    };
    for (const d of [1.0, 2.5, 4.0]) {
      const r = go(d, 0);
      expect(ofType(r.evs, 'hit').map((h) => h.move)).toEqual(['jaz_rain', 'jaz_rain', 'jaz_rain']);
      expect(r.dmg).toBeGreaterThanOrEqual(60);
    }
    expect(ofType(go(2.0, IN.BLOCK | IN.DOWN).evs, 'hit').length).toBeGreaterThan(0);
    expect(ofType(go(2.0, IN.BLOCK).evs, 'block')).toHaveLength(3);
    expect(ofType(go(2.0, IN.BLOCK).evs, 'hit')).toHaveLength(0);
  });

  it('Diamanten-Regen warns first: nothing hits during the sparkle ring, walking out of it dodges the shower', () => {
    const s = newMatch({ ...JB, loadouts: [['jaz_rain', 'jaz_mvp', 'jaz_99'], ['bon_croc', 'bon_smoke', 'bon_team']] });
    place(s, 2.0);
    s.fighters[0].meter = 200;
    const early = run(s, 1, IN.S1).concat(run(s, 46));
    expect(ofType(early, 'projectile').map((p) => p.kind)).toEqual(['diamonds']);
    expect(ofType(early, 'hit')).toHaveLength(0);
    // Bonez (P2, facing left) walks back out of the zone when the ring appears
    const s2 = newMatch({ ...JB, loadouts: [['jaz_rain', 'jaz_mvp', 'jaz_99'], ['bon_croc', 'bon_smoke', 'bon_team']] });
    place(s2, 2.0);
    s2.fighters[0].meter = 200;
    const evs = run(s2, 1, IN.S1).concat(run(s2, 22), run(s2, 90, 0, IN.RIGHT));
    expect(ofType(evs, 'hit')).toHaveLength(0);
  });

  it('Spotlight-Dash passes through the opponent and switches sides', () => {
    const s = newMatch({ ...JB, loadouts: [['jaz_spot', 'jaz_mvp', 'jaz_99'], ['bon_croc', 'bon_smoke', 'bon_team']] });
    place(s, 1.2);
    s.fighters[0].meter = 100;
    run(s, 1, IN.S1);
    run(s, 40);
    expect(s.fighters[0].x).toBeGreaterThan(s.fighters[1].x);
    expect(s.fighters[0].facing).toBe(-1);
  });

  it('Spotlight-Dash is strike-invulnerable at the start', () => {
    const s = newMatch({ ...JB, loadouts: [['jaz_spot', 'jaz_mvp', 'jaz_99'], ['bon_croc', 'bon_smoke', 'bon_team']] });
    place(s, 1.1);
    s.fighters[0].meter = 100;
    const evs = script(s, [[IN.S1, IN.LIGHT], ...idle(30)]);
    expect(ofType(evs, 'hit').filter((h) => h.d === 0)).toHaveLength(0);
  });

  it('Rhythmus-Konter catches a low attack and punishes', () => {
    const s = newMatch({ ...JB, loadouts: [['jaz_counter', 'jaz_mvp', 'jaz_99'], ['bon_croc', 'bon_smoke', 'bon_team']] });
    place(s, 1.0);
    s.fighters[0].meter = 100;
    const evs = script(s, [[IN.S1, 0], [0, IN.DOWN | IN.LIGHT], ...idle(60)]);
    expect(ofType(evs, 'counter')).toHaveLength(1);
    expect(ofType(evs, 'hit').filter((h) => h.a === 0).length).toBe(3);
  });

  it('Ninetynine: cinematic on hit, knockdown after', () => {
    const s = newMatch(JB);
    place(s, 1.4);
    s.fighters[0].meter = 300;
    const hp = s.fighters[1].health;
    const evs = run(s, 1, IN.S3);
    evs.push(...run(s, 260 * RULES.CINE_RATE));
    expect(ofType(evs, 'cineStart')).toHaveLength(1);
    expect(ofType(evs, 'cineEnd')).toHaveLength(1);
    expect(hp - s.fighters[1].health).toBe(40 + 30 + 30 + 35 + 40 + 150);
  });
});

describe('Jazeek: Blunt für dich', () => {
  const BL = { ...JB, loadouts: [['jaz_blunt', 'jaz_mvp', 'jaz_99'], ['bon_croc', 'bon_lean', 'bon_team']] as [string[], string[]] };

  it('grabs a standing opponent close by and rolls them into the joint: three drags + the pop (124 damage)', () => {
    const s = newMatch(BL);
    place(s, 1.2);
    s.fighters[0].meter = 200;
    const hp = s.fighters[1].health;
    const evs = run(s, 1, IN.S1).concat(run(s, 20));
    expect(ofType(evs, 'cineStart').map((c) => c.id)).toEqual(['jaz_blunt']);
    evs.push(...run(s, 170 * RULES.CINE_RATE));
    expect(ofType(evs, 'cineHit')).toHaveLength(4);
    expect(ofType(evs, 'cineEnd')).toHaveLength(1);
    const dmg = hp - s.fighters[1].health;
    expect(dmg).toBeGreaterThanOrEqual(10 + 28 * 3 + 30 - 2);
    expect(dmg).toBeLessThanOrEqual(10 + 28 * 3 + 30 + 2);
  });

  it('cannot be blocked, but a jump or distance escapes it (and the whiff is punishable)', () => {
    const go = (dist: number, p2: number, pre = 0) => {
      const s = newMatch(BL);
      place(s, dist);
      s.fighters[0].meter = 200;
      if (pre) run(s, pre, 0, p2);
      return run(s, 1, IN.S1, p2).concat(run(s, 30, 0, p2));
    };
    expect(ofType(go(1.2, IN.BLOCK), 'cineStart')).toHaveLength(1);
    expect(ofType(go(2.6, 0), 'cineStart')).toHaveLength(0);
    expect(ofType(go(1.2, IN.UP, 2), 'cineStart')).toHaveLength(0);
  });

  it('costs two Hype bars', () => {
    const s = newMatch(BL);
    place(s, 2.6);
    s.fighters[0].meter = 200;
    run(s, 1, IN.S1);
    expect(s.fighters[0].meter).toBeLessThan(100);
  });
});

describe('Bonez MC', () => {
  it('Krokodil-Attacke: the croc runs at the opponent, grabs them and starts the croc cinematic (100 damage)', () => {
    const s = newMatch(JB);
    place(s, 4.0);
    s.fighters[1].meter = 100;
    const evs = run(s, 1, 0, IN.S1);
    evs.push(...run(s, 60));
    expect(ofType(evs, 'projectile').some((p) => p.kind === 'crocrun')).toBe(true);
    expect(ofType(evs, 'cineStart').map((c) => c.id)).toContain('bon_croc');
    evs.push(...run(s, 130 * RULES.CINE_RATE));
    expect(ofType(evs, 'cineEnd')).toHaveLength(1);
    expect(1000 - s.fighters[0].health).toBe(20 + 25 + 30 + 45);
    expect(s.fighters[0].state === 'knockdown' || s.fighters[0].state === 'wakeup' || s.fighters[0].state === 'idle').toBe(true);
  });

  it('two crocs that land on the same frame trade (no cinematic, both take the hit)', () => {
    // point blank: both crocs spawn inside the opponent (from range they would meet and cancel out)
    const s = newMatch({ fighters: ['bonez', 'bonez'] });
    place(s, 1.4);
    s.fighters[0].meter = 100;
    s.fighters[1].meter = 100;
    const evs = run(s, 1, IN.S1, IN.S1).concat(run(s, 60));
    expect(ofType(evs, 'cineStart')).toHaveLength(0);
    const hits = ofType(evs, 'hit').filter((h) => h.projectile);
    expect(hits).toHaveLength(2);
    expect(s.fighters[0].health).toBe(s.fighters[1].health);
  });

    it('Krokodil-Attacke is low: a crouch block stops it, a standing block does not', () => {
    const go = (p1: number) => {
      const s = newMatch(JB);
      place(s, 3.0);
      s.fighters[1].meter = 100;
      const evs = run(s, 1, p1, IN.S1).concat(run(s, 60, p1, 0));
      return evs;
    };
    expect(ofType(go(IN.BLOCK | IN.DOWN), 'block')).toHaveLength(1);
    expect(ofType(go(IN.BLOCK), 'cineStart')).toHaveLength(1);
  });

  it('Krokodil-Attacke has a readable wind-up (no hit before frame 17)', () => {
    const s = newMatch(JB);
    place(s, 2.0);
    s.fighters[1].meter = 100;
    const evs = run(s, 1, 0, IN.S1);
    evs.push(...run(s, 17));
    expect(ofType(evs, 'hit')).toHaveLength(0);
  });

  it('Rauchwand absorbs Stimmwelle and survives', () => {
    const s = newMatch({ ...JB, loadouts: [['jaz_wave', 'jaz_mvp', 'jaz_99'], ['bon_smoke', 'bon_croc', 'bon_team']] });
    place(s, 3.2);
    s.fighters[0].meter = 100;
    s.fighters[1].meter = 100;
    const evs = script(s, [[0, IN.S1], ...idle(8), [IN.S1, 0], ...idle(40)]);
    expect(ofType(evs, 'clash')).toHaveLength(1);
    expect(ofType(evs, 'hit')).toHaveLength(0);
    expect(s.projectiles.some((p) => p.kind === 'smoke')).toBe(true);
  });

  it('Palmen-Bassdrop is a low: crouch-block stops it, stand-block does not', () => {
    const go = (p1: number) => {
      const s = newMatch(JB);
      place(s, 1.4);
      s.fighters[1].meter = 300;
      const evs = run(s, 1, p1, IN.S3);
      evs.push(...run(s, 240 * RULES.CINE_RATE, p1, 0));
      return { s, evs };
    };
    const crouch = go(IN.BLOCK | IN.DOWN);
    expect(ofType(crouch.evs, 'block')).toHaveLength(1);
    expect(ofType(crouch.evs, 'cineStart')).toHaveLength(0);
    const stand = go(IN.BLOCK);
    expect(ofType(stand.evs, 'cineStart')).toHaveLength(1);
    expect(1000 - stand.s.fighters[0].health).toBe(40 + 40 + 40 + 180);
  });

  it('Tiefergelegt: the car comes from behind, reaches across the screen and knocks down (blockable)', () => {
    const go = (p1: number) => {
      const s = newMatch({ ...JB, loadouts: [['jaz_wave', 'jaz_mvp', 'jaz_99'], ['bon_car', 'bon_croc', 'bon_team']] });
      place(s, 4.5);
      s.fighters[1].meter = 200;
      const evs = run(s, 1, p1, IN.S1).concat(run(s, 220 * RULES.CINE_RATE, p1, 0));
      return { s, evs };
    };
    const open = go(0);
    const hit = ofType(open.evs, 'hit')[0];
    expect(hit?.projectile).toBe(true);
    expect(hit?.move).toBe('bon_car');
    // a grounded hit becomes the three-stage car cinematic (roof ride, donuts, hard brake): 100 damage in total
    expect(ofType(open.evs, 'cineStart').map((c) => c.id)).toEqual(['bon_car']);
    expect(ofType(open.evs, 'cineEnd')).toHaveLength(1);
    expect(1000 - open.s.fighters[0].health).toBe(20 + 25 + 25 + 30);
    const blocked = go(IN.BLOCK);
    expect(ofType(blocked.evs, 'block')).toHaveLength(1);
    expect(ofType(blocked.evs, 'hit')).toHaveLength(0);
  });

  it('Tiefergelegt also works with Bonez backed into the corner (the car starts behind the wall)', () => {
    const s = newMatch({ ...JB, loadouts: [['jaz_wave', 'jaz_mvp', 'jaz_99'], ['bon_car', 'bon_croc', 'bon_team']] });
    place(s, 3);
    // Bonez (P2) at the right wall, facing left: the car spawns 3.2 m behind him, off stage
    const shift = 74000 - s.fighters[1].x;
    s.fighters[0].x += shift;
    s.fighters[1].x += shift;
    s.camX += shift;
    s.fighters[1].meter = 200;
    const evs = run(s, 1, 0, IN.S1).concat(run(s, 220 * RULES.CINE_RATE));
    expect(ofType(evs, 'hit').some((h) => h.move === 'bon_car')).toBe(true);
    expect(ofType(evs, 'cineEnd')).toHaveLength(1);
  });

  it('Goldzahn-Grinsen builds meter', () => {
    const s = newMatch({ ...JB, loadouts: [['jaz_wave', 'jaz_mvp', 'jaz_99'], ['bon_grin', 'bon_croc', 'bon_team']] });
    place(s, 4);
    s.fighters[1].meter = 0;
    run(s, 1, 0, IN.S1);
    run(s, 70);
    expect(s.fighters[1].meter).toBeGreaterThanOrEqual(70);
  });
});

describe('target combos (buttons only)', () => {
  const at = (n: number, bits: number) => [...idle(n), [bits, 0] as [number, number]];
  it('Jazeek: L·L·L ends in the Drehkick, H·H in the Encore-Haken', () => {
    const s = newMatch(JB);
    place(s, 0.9);
    const moves: string[] = [];
    const evs = script(s, [[IN.LIGHT, 0], ...at(8, IN.LIGHT), ...at(8, IN.LIGHT), ...idle(40)], () => {
      const f = s.fighters[0];
      if (f.state === 'move' && f.mf === 1) moves.push(f.move!);
    });
    expect(moves.slice(0, 3)).toEqual(['jaz_5L', 'jaz_5L', 'jaz_LLL']);
    expect(ofType(evs, 'hit').filter((h) => h.a === 0)).toHaveLength(3);
    const s2 = newMatch(JB);
    place(s2, 0.9);
    const m2: string[] = [];
    script(s2, [[IN.HEAVY, 0], ...at(13, IN.HEAVY), ...idle(40)], () => {
      const f = s2.fighters[0];
      if (f.state === 'move' && f.mf === 1) m2.push(f.move!);
    });
    expect(m2.slice(0, 2)).toEqual(['jaz_5H', 'jaz_HH']);
  });

  it('Bonez: L·L·L ends in the Ellbogen-Crash, H·H in the Abrissbirne; a whiffed jab does not combo', () => {
    const s = newMatch({ fighters: ['bonez', 'jazeek'] });
    place(s, 1.0);
    const moves: string[] = [];
    script(s, [[IN.LIGHT, 0], ...at(9, IN.LIGHT), ...at(9, IN.LIGHT), ...idle(40)], () => {
      const f = s.fighters[0];
      if (f.state === 'move' && f.mf === 1) moves.push(f.move!);
    });
    expect(moves.slice(0, 3)).toEqual(['bon_5L', 'bon_5L', 'bon_LLL']);
    const s2 = newMatch({ fighters: ['bonez', 'jazeek'] });
    place(s2, 1.0);
    const m2: string[] = [];
    script(s2, [[IN.HEAVY, 0], ...at(17, IN.HEAVY), ...idle(50)], () => {
      const f = s2.fighters[0];
      if (f.state === 'move' && f.mf === 1) m2.push(f.move!);
    });
    expect(m2.slice(0, 2)).toEqual(['bon_5H', 'bon_HH']);
    const far = newMatch({ fighters: ['bonez', 'jazeek'] });
    place(far, 3.0);
    const m3: string[] = [];
    script(far, [[IN.LIGHT, 0], ...at(9, IN.LIGHT), ...at(9, IN.LIGHT), ...idle(40)], () => {
      const f = far.fighters[0];
      if (f.state === 'move' && f.mf === 1) m3.push(f.move!);
    });
    expect(m3).not.toContain('bon_LLL');
  });

  // session 8 strike variations: L·L·H (flying knee / headbutt) and 2L then H (back-flip kick / clinch knee)
  for (const [a, b, llh, l2h] of [
    ['jazeek', 'bonez', 'jaz_LLH', 'jaz_2LH'],
    ['bonez', 'jazeek', 'bon_LLH', 'bon_2LH'],
  ] as const) {
    it(`${a}: L·L·H and 2L·H are button strings that combo`, () => {
      const run = (seq: number[]) => {
        const s = newMatch({ fighters: [a, b] });
        place(s, 0.95);
        const f = s.fighters[0];
        const moves: string[] = [];
        const hits: number[] = [];
        let k = 0;
        let lastMf = 0;
        for (let i = 0; i < 120; i++) {
          let bits = 0;
          // next button once the current move connected (a player reacting to the hit), held while it stays valid
          if (k === 0) bits = seq[k++];
          else if (k < seq.length && f.state === 'move' && f.connected === 'hit' && moves.length === k) bits = seq[k];
          else if (k < seq.length && moves.length > k) k++;
          for (const e of step(s, [bits, 0])) if (e.t === 'hit' && e.a === 0) hits.push(e.combo);
          if (f.state === 'move' && f.mf === 1 && lastMf !== 1) moves.push(f.move!);
          lastMf = f.state === 'move' ? f.mf : 0;
        }
        return { moves, hits };
      };
      const a1 = run([IN.LIGHT, IN.LIGHT, IN.HEAVY]);
      expect(a1.moves.slice(0, 3)).toEqual([`${a.slice(0, 3)}_5L`, `${a.slice(0, 3)}_5L`, llh]);
      expect(a1.hits).toEqual([1, 2, 3]);
      const a2 = run([IN.LIGHT | IN.DOWN, IN.HEAVY]);
      expect(a2.moves.slice(0, 2)).toEqual([`${a.slice(0, 3)}_2L`, l2h]);
      expect(a2.hits).toEqual([1, 2]);
      // L·H (first jab) still chains into the standing heavy
      const a3 = run([IN.LIGHT, IN.HEAVY]);
      expect(a3.moves.slice(0, 2)).toEqual([`${a.slice(0, 3)}_5L`, `${a.slice(0, 3)}_5H`]);
    });
  }

  // H·L launcher -> Up (jump after them) -> jL -> jH: driven by the state, like a player reacting
  for (const [a, b, launcher] of [
    ['jazeek', 'bonez', 'jaz_HL'],
    ['bonez', 'jazeek', 'bon_HL'],
  ] as const) {
    it(`${a}: H·L launches, Up on hit jumps after them, jL -> jH chain in the air (air combo)`, () => {
      const s = newMatch({ fighters: [a, b] });
      place(s, 1.0);
      const [f, o] = s.fighters;
      const moves: string[] = [];
      const hits: number[] = [];
      let phase = 0;
      for (let i = 0; i < 160; i++) {
        let bits = 0;
        if (phase === 0) bits = IN.HEAVY;
        else if (phase === 1 && f.state === 'move' && f.move?.endsWith('_5H') && f.connected === 'hit') bits = IN.LIGHT;
        else if ((phase === 2 && f.move === launcher && f.connected === 'hit') || (phase === 3 && f.state === 'jumpSquat')) bits = IN.UP | IN.RIGHT;
        else if (phase === 3 && f.state === 'air' && f.vy < 600) bits = IN.LIGHT;
        else if (phase === 4 && f.state === 'move' && f.move?.endsWith('_jL') && f.connected === 'hit') bits = IN.HEAVY;
        for (const e of step(s, [bits, 0])) if (e.t === 'hit' && e.a === 0) hits.push(e.combo);
        if (f.state === 'move' && f.mf === 1 && moves[moves.length - 1] !== f.move) moves.push(f.move!);
        if (phase === 0 && f.move?.endsWith('_5H')) phase = 1;
        else if (phase === 1 && f.move === launcher) phase = 2;
        else if (phase === 2 && (f.state === 'jumpSquat' || f.state === 'air')) phase = 3;
        else if (phase === 3 && f.move?.endsWith('_jL')) phase = 4;
      }
      expect(moves).toEqual([`${a.slice(0, 3)}_5H`, launcher, `${a.slice(0, 3)}_jL`, `${a.slice(0, 3)}_jH`]);
      expect(hits).toEqual([1, 2, 3, 4]);
      expect(o.state === 'juggle' || o.state === 'knockdown' || o.state === 'wakeup' || o.state === 'idle').toBe(true);
    });
  }
});
