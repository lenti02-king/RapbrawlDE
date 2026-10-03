// Deterministic integer math for the simulation.
// RULE: everything inside src/core must use integers only (no Math.sin, no
// Math.random, no Date). Content may use these helpers at load time to convert
// human-friendly meters/seconds into integer sim units.

export const FPS = 60;
/** Simulation length units per meter. Positions/velocities are integers in these units. */
export const UNITS_PER_METER = 10000;

/** meters -> sim units */
export const m = (meters: number): number => Math.round(meters * UNITS_PER_METER);
/** meters/second -> sim units per frame */
export const mps = (metersPerSecond: number): number =>
  Math.round((metersPerSecond * UNITS_PER_METER) / FPS);

/** Integer division truncating toward zero. */
export const idiv = (a: number, b: number): number => Math.trunc(a / b);
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const sgn = (v: number): number => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const iabs = (v: number): number => (v < 0 ? -v : v);

/** Jump physics from airtime (frames) and apex height (meters): returns [gravity, initialVy]. */
export function jumpPhysics(airFrames: number, heightMeters: number): [number, number] {
  const g = Math.max(1, Math.round((8 * m(heightMeters)) / (airFrames * airFrames)));
  const vy = Math.round((g * airFrames) / 2);
  return [g, vy];
}

/** xorshift32 step; state must be a non-zero uint32 stored as a JS number. */
export function rngNext(state: number): number {
  let x = state | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}
