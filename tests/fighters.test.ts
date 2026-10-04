import { describe, expect, it } from 'vitest';
import { validateLoadout } from '../src/core/registry';
import { IN, newMatch, ofType, place, run, script } from './helpers';

const JB = { fighters: ['jazeek', 'bonez'] as [string, string] };
const idle = (n: number) => Array.from({ length: n }, () => [0, 0] as [number, number]);

describe('loadout rule: 2 specials + 1 signature', () => {
  it('accepts the defaults and rejects wrong layouts', () => {
    expect(validateLoadout('jazeek', ['jaz_wave', 'jaz_mvp', 'jaz_heart'])).toBeNull();
    expect(validateLoadout('bonez', ['bon_croc', 'bon_smoke', 'bon_palm'])).toBeNull();
    expect(validateLoadout('jazeek', ['jaz_wave', 'jaz_mvp', 'jaz_spot'])).not.toBeNull(); // no signature
    expect(validateLoadout('jazeek', ['jaz_heart', 'jaz_mvp', 'jaz_wave'])).not.toBeNull(); // signature in wrong slot
    expect(validateLoadout('jazeek', ['bon_croc', 'jaz_mvp', 'jaz_heart'])).not.toBeNull(); // other fighter's card
  });
});

describe('Jazeek', () => {
  it('Stimmwelle hits at mid range and pushes the opponent far away', () => {
    const s = newMatch({ ...JB, loadouts: [['jaz_wave', 'jaz_mvp', 'jaz_heart'], ['bon_croc', 'bon_smoke', 'bon_palm']] });
    place(s, 2.0);
    s.fighters[0].meter = 100;
    const x0 = s.fighters[1].x;
    const evs = run(s, 1, IN.S1);
    evs.push(...run(s, 40));
    expect(ofType(evs, 'hit')[0]?.projectile).toBe(true);
    expect(s.fighters[1].x - x0).toBeGreaterThan(5000); // pushed > 0.5 m
  });

  it('Spotlight-Dash passes through the opponent and switches sides', () => {
    const s = newMatch({ ...JB, loadouts: [['jaz_spot', 'jaz_mvp', 'jaz_heart'], ['bon_croc', 'bon_smoke', 'bon_palm']] });
    place(s, 1.2);
    s.fighters[0].meter = 100;
    run(s, 1, IN.S1);
    run(s, 40);
    expect(s.fighters[0].x).toBeGreaterThan(s.fighters[1].x);
    expect(s.fighters[0].facing).toBe(-1);
  });

  it('Spotlight-Dash is strike-invulnerable at the start', () => {
    const s = newMatch({ ...JB, loadouts: [['jaz_spot', 'jaz_mvp', 'jaz_heart'], ['bon_croc', 'bon_smoke', 'bon_palm']] });
    place(s, 1.1);
    s.fighters[0].meter = 100;
    const evs = script(s, [[IN.S1, IN.LIGHT], ...idle(30)]);
    expect(ofType(evs, 'hit').filter((h) => h.d === 0)).toHaveLength(0);
  });

  it('Rhythmus-Konter catches a low attack and punishes', () => {
    const s = newMatch({ ...JB, loadouts: [['jaz_counter', 'jaz_mvp', 'jaz_heart'], ['bon_croc', 'bon_smoke', 'bon_palm']] });
    place(s, 1.0);
    s.fighters[0].meter = 100;
    const evs = script(s, [[IN.S1, 0], [0, IN.DOWN | IN.LIGHT], ...idle(60)]);
    expect(ofType(evs, 'counter')).toHaveLength(1);
    expect(ofType(evs, 'hit').filter((h) => h.a === 0).length).toBe(3);
  });

  it('Herzbrecher: cinematic on hit, knockdown after', () => {
    const s = newMatch(JB);
    place(s, 1.4);
    s.fighters[0].meter = 300;
    const hp = s.fighters[1].health;
    const evs = run(s, 1, IN.S3);
    evs.push(...run(s, 260));
    expect(ofType(evs, 'cineStart')).toHaveLength(1);
    expect(ofType(evs, 'cineEnd')).toHaveLength(1);
    expect(hp - s.fighters[1].health).toBe(40 + 30 + 30 + 35 + 40 + 150);
  });
});

describe('Bonez MC', () => {
  it('Krokodil-Schnapper reaches 2.2 m', () => {
    const s = newMatch(JB);
    place(s, 2.2);
    s.fighters[1].meter = 100;
    const evs = run(s, 1, 0, IN.S1);
    evs.push(...run(s, 40));
    const hits = ofType(evs, 'hit').filter((h) => h.a === 1);
    expect(hits).toHaveLength(1);
    expect(s.fighters[0].state === 'knockdown' || s.fighters[0].state === 'juggle').toBe(true);
  });

  it('Krokodil-Schnapper has a readable wind-up (no hit before frame 20)', () => {
    const s = newMatch(JB);
    place(s, 2.0);
    s.fighters[1].meter = 100;
    const evs = run(s, 1, 0, IN.S1);
    evs.push(...run(s, 17));
    expect(ofType(evs, 'hit')).toHaveLength(0);
  });

  it('Rauchwand absorbs Stimmwelle and survives', () => {
    const s = newMatch({ ...JB, loadouts: [['jaz_wave', 'jaz_mvp', 'jaz_heart'], ['bon_smoke', 'bon_croc', 'bon_palm']] });
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
      evs.push(...run(s, 240, p1, 0));
      return { s, evs };
    };
    const crouch = go(IN.BLOCK | IN.DOWN);
    expect(ofType(crouch.evs, 'block')).toHaveLength(1);
    expect(ofType(crouch.evs, 'cineStart')).toHaveLength(0);
    const stand = go(IN.BLOCK);
    expect(ofType(stand.evs, 'cineStart')).toHaveLength(1);
    expect(1000 - stand.s.fighters[0].health).toBe(40 + 40 + 40 + 180);
  });

  it('Goldzahn-Grinsen builds meter', () => {
    const s = newMatch({ ...JB, loadouts: [['jaz_wave', 'jaz_mvp', 'jaz_heart'], ['bon_grin', 'bon_croc', 'bon_palm']] });
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
});
