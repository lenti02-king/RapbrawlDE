// Captured motion on the authored poses (S17, tools/mocap): keys made by tools/mocap/strike.py hold, per game frame,
// every joint's change since the capture's start (d), the striking arm as directions (aim) and the hips' travel.
import { Clip, type Aim, type JointRot, type PoseDef } from '../../pose';
import { JOINTS, type JointName } from '../../rig';

export interface StrikeKey {
  f: number;
  x: number;
  y: number;
  aim: Aim;
  d: Partial<Record<JointName, JointRot>>;
}

/** The authored base pose (the fighter's stance) with a key's changes on top. */
export function layered(base: PoseDef, k: StrikeKey, scale = 1): PoseDef {
  const j: Partial<Record<JointName, JointRot>> = {};
  for (const jn of JOINTS) {
    const b = base.j?.[jn] ?? [0, 0, 0];
    const d = k.d[jn];
    j[jn] = d ? [b[0] + d[0] * scale, b[1] + d[1] * scale, b[2] + d[2] * scale] : [b[0], b[1], b[2]];
  }
  return { j, x: (base.x ?? 0) + k.x, y: (base.y ?? 0) + k.y, s: base.s, aim: k.aim };
}

/** A move clip from captured keys over the stance (smooth: Hermite through every frame key). */
export function strikeClip(base: PoseDef, keys: StrikeKey[], scale = 1): Clip {
  return new Clip(
    keys.map((k) => ({ f: k.f, p: layered(base, k, scale) })),
    undefined,
    true,
  );
}
