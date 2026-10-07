// D43 abilities of the modelle-3 roster: Manuellsen (5000 Kurden, Beton, Sofa-Backpfeifen), Lacazette (Kalter Blick,
// Daunenweste, 70 Schüsse), the new signatures of Jazeek (Ninetynine) and Bonez (Ohne mein Team).
import { describe, expect, it } from 'vitest';
import { RULES } from '../src/core/sim';
import { getFighter, validateLoadout } from '../src/core/registry';
import { IN, newMatch, ofType, place, run } from './helpers';

const ML = { fighters: ['manuellsen', 'lacazette'] as [string, string] };
const LM = { fighters: ['lacazette', 'manuellsen'] as [string, string] };

describe('roster decks', () => {
  it('every roster fighter has a legal default deck of 2 specials + 1 signature', () => {
    for (const id of ['jazeek', 'bonez', 'manuellsen', 'lacazette']) {
      const f = getFighter(id);
      expect(validateLoadout(id, f.defaultLoadout)).toBeNull();
      expect(f.cards.filter((c) => c.category === 'signature')).toHaveLength(1);
      for (const c of f.cards) expect(f.moves[c.move], `${id}:${c.move}`).toBeDefined();
      for (const c of f.cards) {
        const cin = f.moves[c.move].hits.find((h) => h.cinematic)?.cinematic ?? f.moves[c.move].projectile?.def.hit.cinematic;
        if (cin) expect(f.cinematics[cin], `${id}:${cin}`).toBeDefined();
      }
    }
  });
});

describe('Manuellsen', () => {
  it('5000 Kurden: the crowd storms across the stage and hits three times', () => {
    const s = newMatch(ML);
    place(s, 3.0);
    s.fighters[0].meter = 200;
    const hp = s.fighters[1].health;
    const evs = run(s, 1, IN.S1).concat(run(s, 120));
    const hits = ofType(evs, 'hit').filter((h) => h.a === 0 && h.projectile);
    expect(hits).toHaveLength(3);
    expect(hp - s.fighters[1].health).toBe(90);
  });

  it('5000 Kurden: blockable', () => {
    const s = newMatch(ML);
    place(s, 3.0);
    s.fighters[0].meter = 200;
    const hp = s.fighters[1].health;
    run(s, 1, IN.S1, IN.BLOCK);
    run(s, 120, 0, IN.BLOCK);
    expect(hp - s.fighters[1].health).toBeLessThanOrEqual(24);
  });

  it('Beton: absorbs a strike and answers with a knockdown right hand', () => {
    const s = newMatch(ML);
    place(s, 1.0);
    s.fighters[0].meter = 100;
    const evs = run(s, 1, IN.S2);
    evs.push(...run(s, 12, 0, IN.LIGHT));
    evs.push(...run(s, 60));
    expect(ofType(evs, 'armor').length).toBeGreaterThanOrEqual(1);
    expect(ofType(evs, 'hit').some((h) => h.a === 0)).toBe(true);
  });

  it('Sofa-Backpfeifen: grab -> sofa -> three slaps (cinematic), unblockable, a jump escapes', () => {
    const go = (p2: number, pre = 0) => {
      const s = newMatch(ML);
      place(s, 1.2);
      s.fighters[0].meter = 300;
      if (pre) run(s, pre, 0, p2);
      const hp = s.fighters[1].health;
      const evs = run(s, 1, IN.S3, p2).concat(run(s, 60, 0, p2));
      evs.push(...run(s, 180 * RULES.CINE_RATE));
      return { evs, dmg: hp - s.fighters[1].health };
    };
    const blocked = go(IN.BLOCK);
    expect(ofType(blocked.evs, 'cineStart').map((c) => c.id)).toEqual(['manu_sofa']);
    expect(ofType(blocked.evs, 'cineHit')).toHaveLength(3);
    expect(blocked.dmg).toBe(30 + 70 + 70 + 140);
    expect(ofType(go(IN.UP, 2).evs, 'cineStart')).toHaveLength(0);
  });
});

describe('Lacazette', () => {
  it('Kalter Blick: fast glint at eye height, long stun on hit', () => {
    const s = newMatch(LM);
    place(s, 4.0);
    s.fighters[0].meter = 100;
    const evs = run(s, 1, IN.S1).concat(run(s, 40));
    const h = ofType(evs, 'hit').filter((e) => e.a === 0 && e.projectile);
    expect(h).toHaveLength(1);
  });

  it('Kalter Blick: flies over a crouching opponent', () => {
    const s = newMatch(LM);
    place(s, 3.0);
    s.fighters[0].meter = 100;
    run(s, 4, 0, IN.DOWN);
    const evs = run(s, 1, IN.S1, IN.DOWN).concat(run(s, 40, 0, IN.DOWN));
    expect(ofType(evs, 'hit').filter((e) => e.a === 0)).toHaveLength(0);
  });

  it('Daunenweste: armoured shoulder charge through a jab, knockdown', () => {
    const s = newMatch(LM);
    place(s, 1.4);
    s.fighters[0].meter = 200;
    const evs = run(s, 1, IN.S2);
    evs.push(...run(s, 6, 0, IN.LIGHT));
    evs.push(...run(s, 50));
    expect(ofType(evs, 'hit').some((h) => h.a === 0)).toBe(true);
  });

  it('70 Schüsse: the car crosses the stage; on hit the drive-by cinematic (six bursts)', () => {
    const s = newMatch(LM);
    place(s, 4.0);
    s.fighters[0].meter = 300;
    const hp = s.fighters[1].health;
    const evs = run(s, 1, IN.S3).concat(run(s, 120));
    expect(ofType(evs, 'cineStart').map((c) => c.id)).toEqual(['laca_gwagon']);
    evs.push(...run(s, 190 * RULES.CINE_RATE));
    expect(ofType(evs, 'cineHit')).toHaveLength(6);
    expect(hp - s.fighters[1].health).toBe(30 + 35 * 4 + 40 + 90);
  });
});

describe('new signatures', () => {
  it('Bonez: Ohne mein Team — low ground slam, cinematic with five hits', () => {
    const s = newMatch({ fighters: ['bonez', 'jazeek'] });
    place(s, 1.4);
    s.fighters[0].meter = 300;
    const hp = s.fighters[1].health;
    const evs = run(s, 1, IN.S3).concat(run(s, 60));
    expect(ofType(evs, 'cineStart').map((c) => c.id)).toEqual(['bon_team']);
    evs.push(...run(s, 200 * RULES.CINE_RATE));
    expect(ofType(evs, 'cineHit')).toHaveLength(5);
    expect(hp - s.fighters[1].health).toBe(40 + 35 + 25 + 30 + 30 + 140);
  });
});
