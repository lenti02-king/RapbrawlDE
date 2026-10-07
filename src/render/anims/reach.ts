// Reach fit for the PO's modelle-3 fighters (D43). The move clips were authored on the reference rigs; on the new
// models (realistic limb proportions) some fists/feet stop short of the sim's hitbox. Instead of stretching the
// models, these strikes get a short forward lunge of the whole body that peaks on the first active frame, holds
// through the active frames and settles back during recovery. Values = measured shortfall (node scripts/reach.mjs
// <id>) minus ~5 cm, so contact lands at the box's far edge; uppercuts and knees get partial values (their boxes
// are tall, contact happens inside them). Negative = pull back (a sweep that overshoots).
import { getFighter } from '../../core/registry';
import { Clip } from '../pose';
import { R_X } from '../rig';
import type { AnimSet } from './types';

export const REACH_FIX: Record<string, Record<string, number>> = {
  jazeek: { jaz_5H: 0.15, jaz_HH: 0.25, jaz_HL: 0.13, jaz_LLH: 0.18, jaz_2LH: 0.42, jaz_blunt: 0.12, jaz_counter_fu: 0.2, jaz_mvp_fu: 0.28 },
  bonez: { bon_5H: 0.17, bon_LLL: 0.14, bon_HH: 0.2, bon_2LH: 0.45, bon_HL: 0.45, bon_2H: 0.45, bon_jH: 0.42, bon_lean: 0.25 },
  manuellsen: { bon_2L: -0.1, bon_5H: 0.11, bon_HH: 0.14, bon_2LH: 0.3, bon_HL: 0.3, bon_2H: 0.3, bon_jH: 0.3 },
  lacazette: { jaz_5H: 0.3, jaz_HH: 0.45, jaz_LLH: 0.2, jaz_2LH: 0.45 },
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A move clip with the lunge layered on top (same keys, same timing). The move's hit timing is read lazily: the
 *  animation sets are built at import time, before the content registry is guaranteed to be filled. */
class LungeClip extends Clip {
  private t: { start: number; end: number; total: number } | null = null;

  constructor(
    private inner: Clip,
    private fix: number,
    private fighterId: string,
    private key: string,
  ) {
    super([{ f: 0, p: {} }]);
  }

  override get length(): number {
    return this.inner.length;
  }

  override sample(frame: number, out: Float32Array): Float32Array {
    this.inner.sample(frame, out);
    if (!this.t) {
      try {
        const mv = getFighter(this.fighterId).moves[this.key];
        const h = mv?.hits?.[0];
        this.t = h ? { start: h.start, end: h.end, total: mv.total } : { start: 0, end: 0, total: 0 };
      } catch {
        return out;
      }
    }
    const { start, end, total } = this.t;
    if (!total) return out;
    const rise0 = Math.max(0, start - Math.max(3, (start - 1) * 0.6));
    const settle = end + Math.max(4, (total - end) * 0.7);
    const w = smooth(rise0, start, frame) * (1 - smooth(end, settle, frame));
    out[R_X] += this.fix * w;
    return out;
  }
}

/** The fighter's animation set with the reach fit applied to its strikes. */
export function withReach(set: AnimSet, fighterId: string): AnimSet {
  const fix = REACH_FIX[fighterId];
  if (!fix) return set;
  const out = { ...set, moves: { ...set.moves } };
  for (const [key, v] of Object.entries(fix)) if (set.moves[key]) out.moves[key] = new LungeClip(set.moves[key], v, fighterId, key);
  return out;
}
