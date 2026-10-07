// Abilities of the modelle-3 roster (D43, S12): Manuellsen (5000 Kurden, König im Schatten, Sofa-Backpfeifen), Lacazette
// (Drei Buchstaben, Chart-Einstieg, 70 Schüsse), Bonez' Lila Becher, the signatures Ninetynine and Ohne mein Team.
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

  it('König im Schatten: glides through the opponent (a jab passes through him) and hits from behind', () => {
    const s = newMatch(ML);
    place(s, 1.2);
    s.fighters[0].meter = 100;
    const side0 = Math.sign(s.fighters[1].x - s.fighters[0].x);
    const hp0 = s.fighters[0].health;
    const evs = run(s, 1, IN.S2);
    evs.push(...run(s, 6, 0, IN.LIGHT));
    evs.push(...run(s, 50));
    expect(s.fighters[0].health).toBe(hp0); // the jab went through the shadow
    expect(Math.sign(s.fighters[1].x - s.fighters[0].x)).toBe(-side0); // he came out on the other side
    const h = ofType(evs, 'hit').filter((e) => e.a === 0);
    expect(h).toHaveLength(1);
    expect(h[0].damage).toBe(85);
  });

  it('Sofa-Backpfeifen: grab -> sofa -> three slaps, KO on the sofa, crown, sofa over (cinematic), unblockable, a jump escapes', () => {
    const go = (p2: number, pre = 0) => {
      const s = newMatch(ML);
      place(s, 1.2);
      s.fighters[0].meter = 300;
      if (pre) run(s, pre, 0, p2);
      const hp = s.fighters[1].health;
      const evs = run(s, 1, IN.S3, p2).concat(run(s, 60, 0, p2));
      evs.push(...run(s, 280 * RULES.CINE_RATE));
      return { evs, dmg: hp - s.fighters[1].health };
    };
    const blocked = go(IN.BLOCK);
    expect(ofType(blocked.evs, 'cineStart').map((c) => c.id)).toEqual(['manu_sofa']);
    expect(ofType(blocked.evs, 'cineHit')).toHaveLength(4);
    expect(blocked.dmg).toBe(30 + 70 + 70 + 110 + 40);
    expect(ofType(go(IN.UP, 2).evs, 'cineStart')).toHaveLength(0);
  });
});

describe('Lacazette', () => {
  it('Drei Buchstaben: three letters, three hits', () => {
    const s = newMatch(LM);
    place(s, 3.0);
    s.fighters[0].meter = 100;
    const hp = s.fighters[1].health;
    const evs = run(s, 1, IN.S1).concat(run(s, 70));
    expect(ofType(evs, 'hit').filter((e) => e.a === 0 && e.projectile)).toHaveLength(3);
    expect(hp - s.fighters[1].health).toBeGreaterThanOrEqual(45);
    expect(hp - s.fighters[1].health).toBeLessThanOrEqual(55);
  });

  it('Chart-Einstieg: launches from the ground and catches a jump-in', () => {
    const g = newMatch(LM);
    place(g, 0.9);
    g.fighters[0].meter = 200;
    const evs = run(g, 1, IN.S2).concat(run(g, 60));
    expect(ofType(evs, 'hit').filter((e) => e.a === 0).map((e) => e.damage)).toEqual([80]);
    // anti-air: some timing against a forward jump from 1.5 m connects
    const caught = [2, 4, 6, 8, 10, 12, 14].some((d) => {
      const s = newMatch(LM);
      place(s, 1.5);
      s.fighters[0].meter = 200;
      run(s, 4, 0, IN.UP | IN.LEFT);
      run(s, d, 0, IN.LEFT);
      const e = run(s, 1, IN.S2, IN.LEFT).concat(run(s, 40));
      return ofType(e, 'hit').some((h) => h.a === 0 && h.damage === 80);
    });
    expect(caught).toBe(true);
  });

  it('70 Schüsse: the car crosses the stage; on hit the drive-by (six bursts) and the bonnet slam', () => {
    const s = newMatch(LM);
    place(s, 4.0);
    s.fighters[0].meter = 300;
    const hp = s.fighters[1].health;
    const evs = run(s, 1, IN.S3).concat(run(s, 120));
    expect(ofType(evs, 'cineStart').map((c) => c.id)).toEqual(['laca_gwagon']);
    evs.push(...run(s, 270 * RULES.CINE_RATE));
    expect(ofType(evs, 'cineHit')).toHaveLength(7);
    expect(hp - s.fighters[1].health).toBe(30 + 35 * 4 + 40 + 60 + 50);
  });
});

describe('Bonez', () => {
  it('Lila Becher: a sip, a jab passes through the sway, then the hook', () => {
    const s = newMatch({ fighters: ['bonez', 'jazeek'] });
    place(s, 1.1);
    s.fighters[0].meter = 100;
    const hp0 = s.fighters[0].health;
    const evs = run(s, 1, IN.S2);
    evs.push(...run(s, 14));
    evs.push(...run(s, 6, 0, IN.LIGHT));
    evs.push(...run(s, 50));
    expect(s.fighters[0].health).toBe(hp0);
    const h = ofType(evs, 'hit').filter((e) => e.a === 0);
    expect(h).toHaveLength(1);
    expect(h[0].damage).toBe(90);
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
