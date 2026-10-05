import { describe, expect, it } from 'vitest';
import '../src/content';
import { IN } from '../src/core/input';
import { createMatch, defaultConfig, RULES, step } from '../src/core/sim';

function fresh() {
  const s = createMatch({ ...defaultConfig(), fighters: ['jazeek', 'bonez'] });
  for (let i = 0; i < 400 && s.phase !== 'fight'; i++) step(s, [0, 0]);
  return s;
}

describe('Aufladen + comeback Hype (PO: never lose without having had the Signature once)', () => {
  it('holding CHARGE fills Hype, standing still; releasing ends it', () => {
    const s = fresh();
    const x0 = s.fighters[0].x;
    for (let i = 0; i < 80; i++) step(s, [IN.CHARGE, 0]);
    const f = s.fighters[0];
    expect(f.state).toBe('charge');
    expect(f.x).toBe(x0);
    // 75 frames ~ one bar (meterGainPct applies on top)
    expect(f.meter).toBeGreaterThanOrEqual(100);
    step(s, [0, 0]);
    step(s, [0, 0]);
    expect(s.fighters[0].state).not.toBe('charge');
  });

  it('charging cannot block: a hit lands', () => {
    const s = fresh();
    s.fighters[1].x = s.fighters[0].x + 9000;
    let hp = s.fighters[0].health;
    for (let i = 0; i < 40; i++) {
      step(s, [IN.CHARGE, i === 5 ? IN.LIGHT : 0]);
      if (s.fighters[0].health < hp) break;
    }
    expect(s.fighters[0].health).toBeLessThan(hp);
    hp = s.fighters[0].health;
  });

  it('taking a full health bar of damage yields a full Signature bar', () => {
    expect((1000 * RULES.HURT_METER_TENTHS) / 10).toBeGreaterThanOrEqual(RULES.METER_MAX);
  });
});
