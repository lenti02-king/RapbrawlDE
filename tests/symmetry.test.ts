import { describe, expect, it } from 'vitest';
import { IN } from '../src/core/input';
import { createMatch, defaultConfig, step } from '../src/core/sim';
import { lcg } from './helpers';

/** Swap left/right so P2 performs the mirror image of P1's inputs. */
function mirror(bits: number): number {
  let out = bits & ~(IN.LEFT | IN.RIGHT);
  if (bits & IN.LEFT) out |= IN.RIGHT;
  if (bits & IN.RIGHT) out |= IN.LEFT;
  return out;
}

describe('P1/P2 symmetry', () => {
  for (const fighter of ['volt', 'brick', 'jazeek', 'bonez']) {
    it(`${fighter} mirror match with mirrored inputs stays mirror-symmetric`, () => {
      for (let seed = 1; seed <= 6; seed++) {
        const s = createMatch(defaultConfig({ fighters: [fighter, fighter], seed }));
        const r = lcg(seed * 31);
        let a = 0;
        let firstBreak = -1;
        for (let i = 0; i < 4000 && s.phase !== 'matchOver'; i++) {
          if (r() < 0.15) a = Math.floor(r() * 2048);
          step(s, [a, mirror(a)]);
          const [p, q] = s.fighters;
          const sym = p.x === -q.x && p.y === q.y && p.health === q.health && p.state === q.state && p.meter === q.meter;
          if (!sym) {
            firstBreak = s.frame;
            expect(
              { frame: s.frame, p: [p.x, p.y, p.health, p.state, p.move, p.mf], q: [q.x, q.y, q.health, q.state, q.move, q.mf] },
              `seed ${seed}: symmetry broke`,
            ).toBeNull();
            break;
          }
        }
        expect(firstBreak).toBe(-1);
      }
    });
  }
});
