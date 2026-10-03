// Per-frame player input, encoded as a bitmask so it can be sent over the
// network in 2 bytes and stored cheaply in rollback input history.
// Directions are ABSOLUTE (screen left/right); the sim converts them to
// forward/back relative to the fighter.

export const IN = {
  LEFT: 1 << 0,
  RIGHT: 1 << 1,
  UP: 1 << 2,
  DOWN: 1 << 3,
  LIGHT: 1 << 4,
  HEAVY: 1 << 5,
  GRAB: 1 << 6,
  BLOCK: 1 << 7,
  S1: 1 << 8,
  S2: 1 << 9,
  S3: 1 << 10,
} as const;

/** Buttons whose presses are buffered (index = slot in FighterState.buf). */
export const BUFFERED = [IN.LIGHT, IN.HEAVY, IN.GRAB, IN.S1, IN.S2, IN.S3] as const;
export const B_LIGHT = 0;
export const B_HEAVY = 1;
export const B_GRAB = 2;
export const B_S1 = 3;

export const INPUT_MASK = (1 << 11) - 1;

export function describeInput(bits: number): string {
  const names: string[] = [];
  for (const [k, v] of Object.entries(IN)) if (bits & v) names.push(k);
  return names.join('+') || 'neutral';
}
