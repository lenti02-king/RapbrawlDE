// Pose authoring + keyframe clips. Angles are degrees.
// Conventions (character faces +X, camera looks from +Z, "L" = far side, "R" = near side):
//  - limbs hang along -Y; +Z rotation swings a limb FORWARD (toward the opponent)
//  - elbows bend with +Z, knees bend with -Z
//  - spine/chest/neck/head point up; -Z leans FORWARD
//  - +Y twists the near (R) shoulder forward, -Y twists the far (L) shoulder forward
//  - shoulder X: + moves the limb toward -Z (far side). For the L arm that is "outward".
import { JOINTS, JOINT_INDEX, type JointName, POSE_LEN, R_ROT, R_X, R_Y, R_YAW } from './rig';

export type JointRot = [number, number, number];
export interface PoseDef {
  j?: Partial<Record<JointName, JointRot>>;
  x?: number;
  y?: number;
  rot?: number;
  yaw?: number;
}

export function compose(...defs: PoseDef[]): PoseDef {
  const out: PoseDef = { j: {} };
  for (const d of defs) {
    Object.assign(out.j!, d.j ?? {});
    if (d.x !== undefined) out.x = d.x;
    if (d.y !== undefined) out.y = d.y;
    if (d.rot !== undefined) out.rot = d.rot;
    if (d.yaw !== undefined) out.yaw = d.yaw;
  }
  return out;
}

export function toArr(def: PoseDef, out = new Float32Array(POSE_LEN)): Float32Array {
  out.fill(0);
  for (const [k, v] of Object.entries(def.j ?? {})) {
    const i = JOINT_INDEX[k as JointName] * 3;
    out[i] = v[0];
    out[i + 1] = v[1];
    out[i + 2] = v[2];
  }
  out[R_X] = def.x ?? 0;
  out[R_Y] = def.y ?? 0;
  out[R_ROT] = def.rot ?? 0;
  out[R_YAW] = def.yaw ?? 0;
  return out;
}

export function lerpPose(a: Float32Array, b: Float32Array, t: number, out: Float32Array): Float32Array {
  for (let i = 0; i < POSE_LEN; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

/** Additive layer: out = base + (add * w). */
export function addPose(base: Float32Array, add: Float32Array, w: number, out: Float32Array): Float32Array {
  for (let i = 0; i < POSE_LEN; i++) out[i] = base[i] + add[i] * w;
  return out;
}

export type EaseName = 'linear' | 'in' | 'out' | 'inOut' | 'snap' | 'hold';
export const EASE: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  snap: (t) => 1 - Math.pow(1 - t, 4),
  hold: () => 0,
};

export interface Key {
  f: number;
  p: PoseDef;
  /** Easing used when interpolating FROM the previous key TO this key. */
  e?: EaseName;
}

export class Clip {
  private frames: number[];
  private poses: Float32Array[];
  private eases: ((t: number) => number)[];

  constructor(keys: Key[], base?: PoseDef) {
    const sorted = [...keys].sort((a, b) => a.f - b.f);
    this.frames = sorted.map((k) => k.f);
    this.poses = sorted.map((k) => toArr(base ? compose(base, k.p) : k.p));
    this.eases = sorted.map((k) => EASE[k.e ?? 'inOut']);
  }

  get length(): number {
    return this.frames[this.frames.length - 1];
  }

  sample(frame: number, out: Float32Array): Float32Array {
    const fr = this.frames;
    if (frame <= fr[0]) return out.set(this.poses[0]), out;
    const last = fr.length - 1;
    if (frame >= fr[last]) return out.set(this.poses[last]), out;
    let i = 1;
    while (i < last && fr[i] < frame) i++;
    const t = (frame - fr[i - 1]) / Math.max(1e-6, fr[i] - fr[i - 1]);
    return lerpPose(this.poses[i - 1], this.poses[i], this.eases[i](Math.min(1, Math.max(0, t))), out);
  }
}

export function jointRot(p: Float32Array, j: JointName): JointRot {
  const i = JOINT_INDEX[j] * 3;
  return [p[i], p[i + 1], p[i + 2]];
}

export { JOINTS };

/** Sample a clip frame back into an absolute PoseDef (usable as a key in another clip). */
export function sampleDef(clip: Clip, frame: number): PoseDef {
  const a = clip.sample(frame, new Float32Array(POSE_LEN));
  const j: PoseDef['j'] = {};
  JOINTS.forEach((name, i) => {
    j![name] = [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
  });
  return { j, x: a[R_X], y: a[R_Y], rot: a[R_ROT], yaw: a[R_YAW] };
}
