// Touch stick precision: 8-way sectors with wide horizontals and hysteresis.
import { describe, expect, it } from 'vitest';
import { sectorFor } from '../src/input/touch';

describe('touch stick sectors', () => {
  it('maps cardinal and diagonal angles', () => {
    expect(sectorFor(0, -1)).toBe(0); // right
    expect(sectorFor(90, -1)).toBe(2); // up
    expect(sectorFor(180, -1)).toBe(4); // left
    expect(sectorFor(270, -1)).toBe(6); // down
    expect(sectorFor(225, -1)).toBe(5); // down-left (crouch block when facing right)
    expect(sectorFor(315, -1)).toBe(7); // down-right
  });

  it('keeps walking horizontal up to 26 degrees (no accidental jump/crouch)', () => {
    expect(sectorFor(24, -1)).toBe(0);
    expect(sectorFor(-25 + 360, -1)).toBe(0);
    expect(sectorFor(180 - 25, -1)).toBe(4);
  });

  it('has hysteresis at sector borders', () => {
    // entering diagonal needs > 26 deg, but leaving it back to horizontal needs < 45-19-7 = 19 deg
    expect(sectorFor(28, -1)).toBe(1);
    expect(sectorFor(22, 1)).toBe(1);
    expect(sectorFor(18, 1)).toBe(0);
    // horizontal is held until 26+7 = 33 deg
    expect(sectorFor(31, 0)).toBe(0);
    expect(sectorFor(35, 0)).toBe(1);
  });
});
