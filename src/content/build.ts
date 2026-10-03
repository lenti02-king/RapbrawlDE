// Helpers for authoring fighter content in human units (meters, frames).
import type { Box, HitDef, MoveDef, Strength } from '../core/defs';
import { m } from '../core/math';

/** Box in meters: forward range [x0,x1], height range [y0,y1]. */
export const box = (x0: number, x1: number, y0: number, y1: number): Box => ({
  x0: m(x0),
  x1: m(x1),
  y0: m(y0),
  y1: m(y1),
});

const STRENGTH_DEFAULTS: Record<Strength, Pick<HitDef, 'hitstop' | 'pushHit' | 'pushBlock' | 'meterOnHit' | 'meterOnBlock'>> = {
  0: { hitstop: 7, pushHit: 650, pushBlock: 750, meterOnHit: 8, meterOnBlock: 4 },
  1: { hitstop: 9, pushHit: 850, pushBlock: 950, meterOnHit: 12, meterOnBlock: 6 },
  2: { hitstop: 12, pushHit: 1100, pushBlock: 1150, meterOnHit: 16, meterOnBlock: 8 },
  3: { hitstop: 14, pushHit: 1200, pushBlock: 1300, meterOnHit: 0, meterOnBlock: 0 },
};

export type HitOpts = Partial<HitDef> & { damage: number; strength: Strength; boxes: Box[] };

export function hit(start: number, end: number, o: HitOpts): HitDef {
  const d = STRENGTH_DEFAULTS[o.strength];
  return {
    start,
    end,
    chip: 0,
    hitstun: 16,
    blockstun: 12,
    level: 'mid',
    ...d,
    ...o,
  };
}

export interface NormalOpts {
  name: string;
  startup: number;
  active: number;
  recovery: number;
  hit: Omit<HitOpts, 'boxes'> & { boxes: Box[] };
  extra?: Partial<MoveDef>;
}

/** Single-hit move from classic startup/active/recovery frame data. */
export function simpleMove(key: string, kind: MoveDef['kind'], o: NormalOpts): MoveDef {
  const total = o.startup + o.active - 1 + o.recovery;
  return {
    key,
    name: o.name,
    kind,
    total,
    hits: [hit(o.startup, o.startup + o.active - 1, o.hit)],
    ...o.extra,
  };
}
