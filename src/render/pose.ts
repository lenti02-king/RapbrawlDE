// Pose authoring + keyframe clips. Angles are degrees.
// Conventions (character faces +X, camera looks from +Z, "L" = far side, "R" = near side):
//  - limbs hang along -Y; +Z rotation swings a limb FORWARD (toward the opponent)
//  - elbows bend with +Z, knees bend with -Z
//  - spine/chest/neck/head point up; -Z leans FORWARD
//  - +Y twists the near (R) shoulder forward, -Y twists the far (L) shoulder forward
//  - shoulder X: + moves the limb toward -Z (far side). For the L arm that is "outward".
import * as THREE from 'three';
import { JOINTS, JOINT_INDEX, type JointName, POSE_LEN, R_ROT, R_X, R_Y, R_YAW, S_AL, S_AR, S_LL, S_LR, S_SQ } from './rig';

export type JointRot = [number, number, number];
/** Cartoon deformation: limb stretch (fraction of the limb length) and body squash (+ squash, - stretch tall). */
export interface Deform {
  aL?: number;
  aR?: number;
  lL?: number;
  lR?: number;
  sq?: number;
}
/** Direction in character space: x = toward the opponent, y = up, z = toward the camera (normalised on use). */
export type Dir = [number, number, number];
/**
 * Limb aims, solved after composition (toArr): the joint's angles are set so its segment points along the given
 * direction whatever the torso twist is. Without this, a "forward" shoulder angle on a chest that is twisted toward
 * the camera points the arm AT the camera, and strikes vanish in the side view.
 * `face`: 0..1 counter-rotates neck + head so the face keeps looking at the opponent.
 */
export type Aim = Partial<Record<'shL' | 'elL' | 'shR' | 'elR' | 'thL' | 'knL' | 'thR' | 'knR', Dir>> & { face?: number };
export interface PoseDef {
  j?: Partial<Record<JointName, JointRot>>;
  x?: number;
  y?: number;
  rot?: number;
  yaw?: number;
  s?: Deform;
  aim?: Aim;
}
const DEFORM_CH: [keyof Deform, number][] = [
  ['aL', S_AL],
  ['aR', S_AR],
  ['lL', S_LL],
  ['lR', S_LR],
  ['sq', S_SQ],
];

export function compose(...defs: PoseDef[]): PoseDef {
  const out: PoseDef = { j: {} };
  for (const d of defs) {
    Object.assign(out.j!, d.j ?? {});
    if (d.x !== undefined) out.x = d.x;
    if (d.y !== undefined) out.y = d.y;
    if (d.rot !== undefined) out.rot = d.rot;
    if (d.yaw !== undefined) out.yaw = d.yaw;
    if (d.s) out.s = { ...(out.s ?? {}), ...d.s };
    // joints set explicitly in a later layer win over an inherited aim
    if (out.aim) for (const k of Object.keys(d.j ?? {})) delete (out.aim as Record<string, unknown>)[k];
    if (d.aim) out.aim = { ...(out.aim ?? {}), ...d.aim };
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
  for (const [k, ch] of DEFORM_CH) out[ch] = def.s?.[k] ?? 0;
  if (def.aim) solveAim(out, def.aim);
  return out;
}

// ---- aim solver (procedural rig conventions: rest limbs hang along -Y, joint Euler order ZYX, root = yaw then roll)
const _e = new THREE.Euler();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qc = new THREE.Quaternion();
const RAD = Math.PI / 180;
const PARENT: Record<string, JointName[]> = {
  shL: ['hips', 'spine', 'chest'],
  shR: ['hips', 'spine', 'chest'],
  elL: ['hips', 'spine', 'chest', 'shL'],
  elR: ['hips', 'spine', 'chest', 'shR'],
  thL: ['hips'],
  thR: ['hips'],
  knL: ['hips', 'thL'],
  knR: ['hips', 'thR'],
};
function jointQ(p: Float32Array, j: JointName, out: THREE.Quaternion): THREE.Quaternion {
  const i = JOINT_INDEX[j] * 3;
  return out.setFromEuler(_e.set(p[i] * RAD, p[i + 1] * RAD, p[i + 2] * RAD, 'ZYX'));
}
function chainQ(p: Float32Array, chain: JointName[], out: THREE.Quaternion): THREE.Quaternion {
  out.setFromEuler(_e.set(0, p[R_YAW] * RAD, p[R_ROT] * RAD, 'XYZ'));
  for (const j of chain) out.multiply(jointQ(p, j, _qb));
  return out;
}
const _m4 = new THREE.Matrix4();
const _u = new THREE.Vector3();
const _f = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
// where the lower segment goes when the joint bends: forearms fold up/forward, shins fold back/down
const PREF_ARM = new THREE.Vector3(0.3, 1, 0).normalize();
const PREF_LEG = new THREE.Vector3(-1, -1, 0).normalize();
const LIMBS: [JointName, JointName, boolean][] = [
  ['shL', 'elL', true],
  ['shR', 'elR', true],
  ['thL', 'knL', false],
  ['thR', 'knR', false],
];

/**
 * Two-segment limb solve with a real hinge: the upper joint gets the rotation (incl. roll) that points its segment
 * along the aim AND puts the lower segment's aim in the hinge plane; the elbow/knee only bends (Z), as anatomy does.
 */
function solveAim(p: Float32Array, aim: Aim): void {
  for (const [up, lo, arm] of LIMBS) {
    const ua = aim[up as keyof Aim] as Dir | undefined;
    const la = aim[lo as keyof Aim] as Dir | undefined;
    if (!ua && !la) continue;
    chainQ(p, PARENT[up], _qa);
    const inv = _qc.copy(_qa).invert();
    if (ua) _u.set(ua[0], ua[1], ua[2]).normalize().applyQuaternion(inv);
    else _u.set(0, -1, 0).applyQuaternion(jointQ(p, up, _qb)); // keep the authored upper direction
    const li = JOINT_INDEX[lo] * 3;
    let theta: number;
    _x.set(0, 0, 0);
    if (la) {
      _f.set(la[0], la[1], la[2]).normalize().applyQuaternion(inv);
      theta = Math.acos(Math.max(-1, Math.min(1, _u.dot(_f))));
      _x.copy(_f).addScaledVector(_u, -_f.dot(_u));
    } else theta = Math.abs(p[li + 2]) * RAD;
    if (_x.lengthSq() < 1e-6) {
      _x.copy(arm ? PREF_ARM : PREF_LEG).applyQuaternion(inv);
      _x.addScaledVector(_u, -_x.dot(_u));
      if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0).addScaledVector(_u, -_u.x);
    }
    _x.normalize();
    // local frame: Y = -segment, X = bend direction (arms) / opposite (legs, knees bend with -Z)
    if (!arm) _x.negate();
    _y.copy(_u).negate();
    _z.crossVectors(_x, _y).normalize();
    _x.crossVectors(_y, _z).normalize();
    _m4.makeBasis(_x, _y, _z);
    _e.setFromRotationMatrix(_m4, 'ZYX');
    const ui = JOINT_INDEX[up] * 3;
    p[ui] = _e.x / RAD;
    p[ui + 1] = _e.y / RAD;
    p[ui + 2] = _e.z / RAD;
    p[li] = 0;
    p[li + 1] = 0;
    p[li + 2] = ((arm ? 1 : -1) * theta) / RAD;
  }
  if (aim.face) {
    const twist = p[R_YAW] + p[JOINT_INDEX.hips * 3 + 1] + p[JOINT_INDEX.spine * 3 + 1] + p[JOINT_INDEX.chest * 3 + 1];
    p[JOINT_INDEX.neck * 3 + 1] = -twist * aim.face * 0.45;
    p[JOINT_INDEX.head * 3 + 1] = -twist * aim.face * 0.55;
  }
}

// ---- head stabiliser: fighters keep their eyes on the opponent through strikes, spins and leans
const _qn = new THREE.Quaternion();
const _qt = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _hf = new THREE.Vector3();
const HEAD_MAX = 75 * RAD;
/**
 * Pulls the head toward an upright look at the opponent (+X in character space) with weight `w` (0..1).
 * The authored nod survives within `pitch` limits (degrees: forward, back), the neck takes 40 % of the turn and
 * the total turn relative to the chest is capped (no owl heads in spins). Applied after all blending.
 */
export function stabilizeHead(p: Float32Array, w: number, pitch: [number, number] = [-22, 14]): void {
  if (w <= 0) return;
  chainQ(p, ['hips', 'spine', 'chest'], _qa);
  const ni = JOINT_INDEX.neck * 3;
  const hi = JOINT_INDEX.head * 3;
  // authored head orientation (world) and its pitch around the facing axis
  _qn.copy(jointQ(p, 'neck', _qb)).multiply(jointQ(p, 'head', _qc));
  _qt.copy(_qa).multiply(_qn);
  _hf.set(1, 0, 0).applyQuaternion(_qt);
  const nod = Math.atan2(_hf.y, Math.hypot(_hf.x, _hf.z)) / RAD;
  const keep = Math.max(pitch[0], Math.min(pitch[1], nod)) * RAD;
  // target: upright, facing the opponent, with the clamped nod; expressed relative to the chest
  _qt.setFromEuler(_e.set(0, 0, keep, 'ZYX'));
  _qi.copy(_qa).invert().multiply(_qt);
  const ang = 2 * Math.acos(Math.min(1, Math.abs(_qi.w)));
  if (ang > HEAD_MAX) _qi.slerp(_qb.identity(), 1 - HEAD_MAX / ang);
  // blend from the authored neck*head
  _qn.slerp(_qi, Math.min(1, w));
  // split between neck and head
  _qb.identity().slerp(_qn, 0.4);
  _qc.copy(_qb).invert().multiply(_qn);
  _e.setFromQuaternion(_qb, 'ZYX');
  p[ni] = _e.x / RAD;
  p[ni + 1] = _e.y / RAD;
  p[ni + 2] = _e.z / RAD;
  _e.setFromQuaternion(_qc, 'ZYX');
  p[hi] = _e.x / RAD;
  p[hi + 1] = _e.y / RAD;
  p[hi + 2] = _e.z / RAD;
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
  /** Smooth mode: segments without an explicit ease follow a Hermite spline through their neighbours (continuous
   *  velocity, no stop at every key); keys next to explicitly eased segments (snap, hold, ...) keep a zero tangent. */
  private smoothSeg: boolean[] | null = null;
  private tan: Float32Array[] = [];

  constructor(keys: Key[], base?: PoseDef, smooth = false) {
    const sorted = [...keys].sort((a, b) => a.f - b.f);
    this.frames = sorted.map((k) => k.f);
    this.poses = sorted.map((k) => toArr(base ? compose(base, k.p) : k.p));
    this.eases = sorted.map((k) => EASE[k.e ?? 'inOut']);
    if (smooth) {
      const seg = sorted.map((k, i) => i > 0 && !k.e);
      this.smoothSeg = seg;
      const fr = this.frames;
      const P = this.poses;
      this.tan = P.map((p, i) => {
        const t = new Float32Array(p.length);
        // a tangent only where both sides are smooth segments (else ease into / out of the key)
        if (i > 0 && i < P.length - 1 && seg[i] && seg[i + 1]) {
          const dt = Math.max(1e-6, fr[i + 1] - fr[i - 1]);
          for (let c = 0; c < p.length; c++) t[c] = (P[i + 1][c] - P[i - 1][c]) / dt;
        }
        return t;
      });
    }
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
    const span = Math.max(1e-6, fr[i] - fr[i - 1]);
    const t = Math.min(1, Math.max(0, (frame - fr[i - 1]) / span));
    if (this.smoothSeg?.[i]) {
      // cubic Hermite between key i-1 and key i
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = (t3 - 2 * t2 + t) * span;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = (t3 - t2) * span;
      const a = this.poses[i - 1];
      const b = this.poses[i];
      const ma = this.tan[i - 1];
      const mb = this.tan[i];
      for (let c = 0; c < out.length; c++) out[c] = h00 * a[c] + h10 * ma[c] + h01 * b[c] + h11 * mb[c];
      return out;
    }
    return lerpPose(this.poses[i - 1], this.poses[i], this.eases[i](t), out);
  }
}

/** A clip with smooth (spline) motion between its un-eased keys: cinematics, fatalities, emotes. */
export function smoothClip(keys: Key[], base?: PoseDef): Clip {
  return new Clip(keys, base, true);
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
  const s: Deform = {};
  for (const [k, ch] of DEFORM_CH) if (a[ch]) s[k] = a[ch];
  return { j, x: a[R_X], y: a[R_Y], rot: a[R_ROT], yaw: a[R_YAW], s };
}
