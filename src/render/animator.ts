// Turns simulation state into poses. Pure presentation: reads GameState, never writes it.
import type { Reaction } from '../core/defs';
import { UNITS_PER_METER } from '../core/math';
import { getFighter, getMove } from '../core/registry';
import { RULES } from '../core/sim';
import type { FighterState, GameState } from '../core/state';
import { BRICK_ANIMS } from './anims/brick';
import type { AnimSet } from './anims/types';
import { VOLT_ANIMS } from './anims/volt';
import { JAZEEK_ANIMS } from './anims/jazeek';
import { BONEZ_ANIMS } from './anims/bonez';
import { withReach } from './anims/reach';
import { BON_MOVES, JAZ_MOVES, LACA_MOVES, MANU_MOVES } from './anims/roster11';
import * as THREE from 'three';
import { compose, lerpPose, poseJointQ, type PoseDef, stabilizeHead, toArr, writeJointQ } from './pose';
import { type MotionClips, motionClips } from './anims/motion';
import { JOINTS, POSE_LEN, R_ROT, R_X, R_Y, R_YAW, JOINT_INDEX, S_SQ } from './rig';

/** Manuellsen's high boxing guard (D43): fists at the chin, forearms up, chin tucked. */
const MANU_GUARD: PoseDef = {
  aim: { shL: [0.45, -0.85, -0.1], elL: [0.55, 0.83, 0.06], shR: [0.35, -0.9, 0.2], elR: [0.45, 0.88, -0.12] },
  j: { neck: [0, -2, -4], head: [0, -4, -12] },
};

export const ANIM_SETS: Record<string, AnimSet> = {
  volt: VOLT_ANIMS,
  brick: BRICK_ANIMS,
  // D43: the PO's modelle-3 fighters; strikes fitted to each model's reach (anims/reach.ts). The boxer moves like
  // Bonez, the street kid like Jazeek (same move keys)
  jazeek: withReach({ ...JAZEEK_ANIMS, moves: { ...JAZEEK_ANIMS.moves, ...JAZ_MOVES } }, 'jazeek'),
  bonez: withReach({ ...BONEZ_ANIMS, moves: { ...BONEZ_ANIMS.moves, ...BON_MOVES } }, 'bonez'),
  manuellsen: withReach({ ...BONEZ_ANIMS, id: 'manuellsen', stance: compose(BONEZ_ANIMS.stance, MANU_GUARD), moves: { ...BONEZ_ANIMS.moves, ...MANU_MOVES } }, 'manuellsen'),
  lacazette: withReach({ ...JAZEEK_ANIMS, id: 'lacazette', moves: { ...JAZEEK_ANIMS.moves, ...LACA_MOVES } }, 'lacazette'),
};

const DEG = Math.PI / 180;
/** Poses borrowed from another fighter's set (throws, cinematics) assume that fighter's hip
 *  height; correct lying/flying poses for this rig's own pivot. */
export function fixPivot(out: Float32Array, authoredPivot: number | undefined, ownPivot: number | undefined): void {
  if (authoredPivot === undefined || ownPivot === undefined) return;
  out[R_Y] += (authoredPivot - ownPivot) * Math.abs(Math.sin(out[R_ROT] * DEG));
}

type Cached = Record<string, Float32Array>;
const cache = new Map<AnimSet, Cached>();
function poses(set: AnimSet): Cached {
  let c = cache.get(set);
  if (!c) {
    c = { stance: toArr(set.stance) };
    for (const [k, v] of Object.entries(set.r)) c[k] = toArr(v);
    cache.set(set, c);
  }
  return c;
}

/** Poses for the session 8 mechanics (Mic-Duell strain, Wand-Splat, dizzy at match point), derived per set. */
const extraCache = new Map<AnimSet, Cached>();
function extras(set: AnimSet): Cached {
  let c = extraCache.get(set);
  if (!c) {
    const st = set.stance;
    // both lean in over the mic between them: lead arm forward-up gripping, rear fist cocked, legs braced
    const clash = compose(st, {
      x: 0.12,
      y: -0.06,
      aim: { shL: [1, 0.35, 0.1], elL: [1, 0.45, 0.05], face: 0.6 },
      j: { hips: [0, -10, 0], spine: [0, -4, -18], chest: [0, -12, -12], shR: [-20, 0, 40], elR: [0, 0, 130], thL: [6, 20, 40], knL: [0, 0, -50], thR: [-8, 18, -34], knR: [0, 0, -10] },
    });
    // splattered on the wall (back to the wall): arms and legs spread, head lolling, squashed flat
    const splat = compose(set.r.juggle, {
      rot: 0,
      s: { sq: 0.12 },
      aim: { shL: [-0.2, 0.9, -0.5], elL: [-0.3, 1, -0.4], shR: [-0.2, 0.9, 0.5], elR: [-0.3, 1, 0.4], thL: [-0.1, -1, -0.45], knL: [0, -1, -0.5], thR: [-0.1, -1, 0.45], knR: [0, -1, 0.5] },
      j: { spine: [0, 0, 8], chest: [0, 0, 6], neck: [0, 18, 10], head: [0, 20, 18] },
    });
    const dizzyA = compose(set.r.hitHigh, {
      x: -0.03,
      rot: 6,
      j: { head: [0, 18, 18], neck: [0, 10, 8], shL: [40, 0, -12], elL: [0, 0, 24], shR: [-40, 0, -14], elR: [0, 0, 26], knL: [0, 0, -40], knR: [0, 0, -36] },
    });
    const dizzyB = compose(dizzyA, { rot: -6, j: { head: [0, -18, 20], neck: [0, -10, 8] } });
    c = { clash: toArr(clash), splat: toArr(splat), dizzyA: toArr(dizzyA), dizzyB: toArr(dizzyB) };
    extraCache.set(set, c);
  }
  return c;
}

const motionCache = new Map<AnimSet, MotionClips>();
/** Movement and reaction clips for a set: generated from its poses (anims/motion.ts), overridable per fighter. */
export function motionOf(set: AnimSet): MotionClips {
  let m = motionCache.get(set);
  if (!m) {
    const def = getFighter(set.id);
    // default step: one step every ~0.2 s at walk speed, clamped to what the legs can show
    const step = Math.min(0.55, Math.max(0.3, (def.walkF / UNITS_PER_METER) * 60 * 0.2));
    const walk = set.walk ?? { step, bob: 0.025, lift: 22, twist: 6, lean: -3 };
    m = { ...motionClips(set.stance, set.r, walk, { dashF: def.dashF.frames, dashB: def.dashB.frames, jumpSquat: def.jumpSquat }), ...set.motion };
    motionCache.set(set, m);
  }
  return m;
}

/** Optional external override (used by cinematics). Return true if it wrote `out`. */
export type PoseOverride = (s: GameState, idx: number, out: Float32Array) => boolean;

const wrap180 = (d: number) => d - 360 * Math.round(d / 360);
const RAD = Math.PI / 180;
const NJ = JOINTS.length;
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _ax = new THREE.Vector3();

/** Quintic offset decay (Bollo 2016) for one scalar: offset x0, offset velocity v0 (per frame), blend length T. */
function quintic(co: Float32Array, k: number, x0: number, v0: number, T: number): number {
  const sg = x0 < 0 ? -1 : 1;
  x0 *= sg;
  v0 *= sg;
  if (v0 > 0) v0 = 0; // moving away from the target: do not extrapolate further away
  if (v0 < 0) T = Math.min(T, (-5 * x0) / v0); // arrive without overshoot
  T = Math.max(1, T);
  const a0 = Math.max(0, (-8 * v0 * T - 20 * x0) / (T * T));
  const T2 = T * T;
  co[k] = (-(a0 * T2 + 6 * v0 * T + 12 * x0) / (2 * T2 * T2 * T)) * sg;
  co[k + 1] = ((3 * a0 * T2 + 16 * v0 * T + 30 * x0) / (2 * T2 * T2)) * sg;
  co[k + 2] = (-(3 * a0 * T2 + 12 * v0 * T + 20 * x0) / (2 * T2 * T)) * sg;
  co[k + 3] = a0 * 0.5 * sg;
  co[k + 4] = v0 * sg;
  co[k + 5] = x0 * sg;
  return T;
}
const poly = (co: Float32Array, k: number, t: number) => {
  const t2 = t * t;
  return co[k] * t2 * t2 * t + co[k + 1] * t2 * t2 + co[k + 2] * t2 * t + co[k + 3] * t2 + co[k + 4] * t + co[k + 5];
};

/**
 * Inertialized transitions (S13, PO: "sehr flüssig, keine Glitches"). Instead of cross-fading from a frozen snapshot
 * (the pose stops dead, then slides linearly: a visible snap on both ends), the new animation plays at once and the
 * difference to the pose on screen - offset AND its velocity - decays to zero along a quintic (Bollo 2016): motion
 * keeps its momentum through the switch, no velocity jump, no overshoot. Joints decay as a rotation about one fixed
 * axis (quaternion offset), so a turn never unwinds the long way round; root and deformation channels as scalars.
 */
class Inertializer {
  private co = new Float32Array(POSE_LEN * 6);
  private T = new Float32Array(POSE_LEN);
  private axis = new Float32Array(NJ * 3);
  private t = 0;
  active = false;

  /** source = pose on screen, vel = per-frame velocity of its scalar channels, angVel = per-joint angular velocity
   *  (deg/frame, axis * rate), target = the new animation's pose now. */
  start(source: Float32Array, vel: Float32Array, angVel: Float32Array, target: Float32Array, blend: number): void {
    for (let j = 0; j < NJ; j++) {
      poseJointQ(source, j, _q1);
      poseJointQ(target, j, _q2);
      _q3.copy(_q1).multiply(_q2.invert()); // offset: source = offset * target
      if (_q3.w < 0) _q3.set(-_q3.x, -_q3.y, -_q3.z, -_q3.w);
      const ang = (2 * Math.acos(Math.min(1, _q3.w))) / RAD;
      if (ang < 0.05) {
        this.T[j] = 0;
        continue;
      }
      const sn = Math.sqrt(Math.max(1e-12, 1 - _q3.w * _q3.w));
      const ax = _q3.x / sn;
      const ay = _q3.y / sn;
      const az = _q3.z / sn;
      this.axis[j * 3] = ax;
      this.axis[j * 3 + 1] = ay;
      this.axis[j * 3 + 2] = az;
      const v0 = angVel[j * 3] * ax + angVel[j * 3 + 1] * ay + angVel[j * 3 + 2] * az;
      this.T[j] = quintic(this.co, j * 6, ang, v0, blend);
    }
    for (let i = NJ * 3; i < POSE_LEN; i++) {
      let x0 = source[i] - target[i];
      if (i === R_ROT || i === R_YAW) x0 = wrap180(x0);
      if (Math.abs(x0) < 1e-5) {
        this.T[i] = 0;
        continue;
      }
      this.T[i] = quintic(this.co, i * 6, x0, vel[i], blend);
    }
    this.t = 0;
    this.active = true;
  }

  /** Adds the decaying offset onto `out` (the new animation's pose), advancing by `frames`. */
  apply(out: Float32Array, frames: number): void {
    if (!this.active) return;
    this.t += frames;
    const t = this.t;
    let live = false;
    for (let j = 0; j < NJ; j++) {
      if (t >= this.T[j]) continue;
      live = true;
      const ang = poly(this.co, j * 6, t);
      _ax.set(this.axis[j * 3], this.axis[j * 3 + 1], this.axis[j * 3 + 2]);
      _q1.setFromAxisAngle(_ax, ang * RAD);
      poseJointQ(out, j, _q2);
      _q1.multiply(_q2);
      writeJointQ(_q1, out, j, out[j * 3], out[j * 3 + 1], out[j * 3 + 2]);
    }
    for (let i = NJ * 3; i < POSE_LEN; i++) {
      if (t >= this.T[i]) continue;
      live = true;
      out[i] += poly(this.co, i * 6, t);
    }
    this.active = live;
  }
}

/**
 * Output smoothing (S13): a critically damped spring follows the animated pose (exact solution, any frame time).
 * Joints follow as rotations (offset to the target as axis-angle, decayed with its angular velocity), root and
 * deformation channels as scalars. omega = 2/frame: a one-frame jump arrives 59 % / 91 % / 98 % over three frames, so
 * left-over single-frame pops (authored keys, clip ends) become motion while the lag stays under a frame.
 */
class PoseSpring {
  private q = Array.from({ length: NJ }, () => new THREE.Quaternion());
  private w = new Float32Array(NJ * 3); // angular velocity, rad per frame (axis * rate) in the offset space
  private x = new Float32Array(POSE_LEN);
  private v = new Float32Array(POSE_LEN);
  private ready = false;

  reset(p: Float32Array): void {
    for (let j = 0; j < NJ; j++) poseJointQ(p, j, this.q[j]);
    this.w.fill(0);
    this.x.set(p);
    this.v.fill(0);
    this.ready = true;
  }

  /** Filters `target` into `out` (may alias), advancing `frames`. */
  step(target: Float32Array, frames: number, omega: number, out: Float32Array): void {
    if (!this.ready) this.reset(target);
    const t = Math.max(0, frames);
    const ex = Math.exp(-omega * t);
    for (let j = 0; j < NJ; j++) {
      const q = this.q[j];
      poseJointQ(target, j, _q2);
      // offset of the filtered rotation from the target, as an axis-angle vector (rad)
      _q1.copy(q).multiply(_q3.copy(_q2).invert());
      if (_q1.w < 0) _q1.set(-_q1.x, -_q1.y, -_q1.z, -_q1.w);
      const ang = 2 * Math.acos(Math.min(1, _q1.w));
      const sn = Math.sqrt(Math.max(1e-12, 1 - _q1.w * _q1.w));
      const k = ang > 1e-6 ? ang / sn : 0;
      const k3 = j * 3;
      let mag = 0;
      for (let c = 0; c < 3; c++) {
        const e = (c === 0 ? _q1.x : c === 1 ? _q1.y : _q1.z) * k;
        const v = this.w[k3 + c];
        const e1 = (e + (v + omega * e) * t) * ex;
        this.w[k3 + c] = (v - omega * (v + omega * e) * t) * ex;
        _ax.setComponent(c, e1);
        mag += e1 * e1;
      }
      mag = Math.sqrt(mag);
      if (mag > 1e-7) q.setFromAxisAngle(_ax.multiplyScalar(1 / mag), mag).multiply(_q2);
      else q.copy(_q2);
      writeJointQ(q, out, j, target[k3], target[k3 + 1], target[k3 + 2]);
    }
    for (let i = NJ * 3; i < POSE_LEN; i++) {
      let e = this.x[i] - target[i];
      if (i === R_ROT || i === R_YAW) e = wrap180(e);
      const v = this.v[i];
      const e1 = (e + (v + omega * e) * t) * ex;
      this.v[i] = (v - omega * (v + omega * e) * t) * ex;
      this.x[i] = target[i] + e1;
      out[i] = this.x[i];
    }
  }
}

/** States in which a body lies or flies: no visual facing flip until it is upright again. */
const DOWN = new Set(['knockdown', 'juggle', 'airReset', 'ko', 'wallSplat']);

/**
 * State -> pose. Each animation (state, move, reaction) is sampled exactly on the sim's frame clock; changes between
 * animations are short cross-fades from the pose on screen (1-8 frames by kind) instead of a permanent lag filter,
 * so strikes keep their snap and holds stay still.
 */
export class FighterAnimator {
  readonly current = new Float32Array(POSE_LEN);
  /** Final pose handed to the rig: `current` plus the head stabiliser (kept separate so fades start unmodified). */
  readonly final = new Float32Array(POSE_LEN);
  private target = new Float32Array(POSE_LEN);
  /** Pose on screen one frame ago and its per-frame velocity (inertialization needs the motion at the switch). */
  private prev = new Float32Array(POSE_LEN);
  private vel = new Float32Array(POSE_LEN);
  private angVel = new Float32Array(NJ * 3);
  private inert = new Inertializer();
  private spring = new PoseSpring();
  private lastFacing = 0;
  /** Facing the rig is drawn with (see update). */
  visFacing = 0;
  private turnT = 99;
  private key = '';
  private lastSf = 0;
  private walkPhase = 0;
  private lastX = 0;
  private init = false;
  private lastReaction: Reaction = 'high';
  /** Visual (smoothed) world position in meters. */
  vx = 0;
  vy = 0;
  override: PoseOverride | null = null;
  /** Music beat pulse 0..1, set by the view each frame. */
  beat = 0;

  constructor(
    readonly set: AnimSet,
    private readonly idx: number,
  ) {}

  noteReaction(r: Reaction | undefined): void {
    this.lastReaction = r ?? 'high';
  }

  update(s: GameState, dt: number, time: number, alpha: number): Float32Array {
    const f = s.fighters[this.idx];
    const o = s.fighters[1 - this.idx];
    const P = poses(this.set);
    const M = motionOf(this.set);
    const out = this.target;
    const x = f.x / UNITS_PER_METER;
    const y = f.y / UNITS_PER_METER;
    const frozen = f.hitstop > 0 || s.freeze > 0;
    const a = frozen ? 0 : alpha;
    let key: string = f.state;
    let fade = 4;
    // a new instance of the same animation (next hit of a combo, re-block) restarts from its first frame
    let restart = false;

    if (this.override && this.override(s, this.idx, out)) {
      key = 'cine';
      fade = 3;
    } else {
      switch (f.state) {
        case 'intro':
          this.set.intro.sample(f.sf, out);
          fade = 8;
          break;
        case 'idle':
        case 'crouch': {
          out.set(f.state === 'idle' ? P.stance : P.crouch);
          const br = Math.sin(time * 2.6 + this.idx);
          out[JOINT_INDEX.chest * 3 + 2] += br * 2.2;
          out[JOINT_INDEX.shL * 3 + 2] += br * 2;
          out[JOINT_INDEX.shR * 3 + 2] -= br * 1.5;
          out[R_Y] += br * 0.008;
          if (this.set.idleBounce) {
            // smooth bob on the music: the beat value is a decaying pulse (1 on the beat), so recover its phase and use
            // a cosine; a raw pulse dropped the body in a single frame on every beat (looked like a glitch)
            const phase = 1 - Math.cbrt(Math.max(0, Math.min(1, this.beat)));
            const bob = 0.5 + 0.5 * Math.cos(phase * Math.PI * 2);
            out[R_Y] -= bob * this.set.idleBounce;
            out[JOINT_INDEX.knL * 3 + 2] -= bob * 5;
            out[JOINT_INDEX.knR * 3 + 2] -= bob * 5;
            out[JOINT_INDEX.head * 3 + 2] += bob * 2;
          }
          fade = this.key.startsWith('walk') ? 5 : f.state === 'crouch' || this.key === 'crouch' ? 3 : 6;
          break;
        }
        case 'walkF':
        case 'walkB': {
          const fwd = f.state === 'walkF';
          // half a cycle per step: feet travel with the ground instead of paddling
          this.walkPhase += (Math.abs(x - this.lastX) / M.step) * 2;
          const ph = ((this.walkPhase % 4) + 4) % 4;
          (fwd ? M.walkF : M.walkB).sample(ph, out);
          fade = 4;
          break;
        }
        case 'guard':
          out.set(f.crouching ? P.guardCrouch : P.guardStand);
          key = f.crouching ? 'guardC' : 'guard';
          fade = 2;
          break;
        case 'jumpSquat':
          M.jumpSquat.sample(f.sf + a, out);
          fade = 1;
          break;
        case 'air': {
          const t = Math.min(1, Math.max(0, 0.5 - f.vy / 2400));
          lerpPose(P.airRise, P.airFall, t, out);
          // stretch on the way up, tuck at the apex, reach for the floor on the way down
          const up = Math.max(0, Math.min(1, f.vy / 1500));
          const down = Math.max(0, Math.min(1, -f.vy / 1500));
          out[S_SQ] += -0.16 * up + 0.04 * (1 - up - down) - 0.05 * down;
          fade = 2;
          break;
        }
        case 'land':
          M.land.sample(f.sf + a, out);
          fade = 1;
          break;
        case 'dashF':
          M.dashF.sample(f.sf + a, out);
          fade = 2;
          break;
        case 'dashB':
          M.dashB.sample(f.sf + a, out);
          fade = 2;
          break;
        case 'move': {
          const clip = this.set.moves[f.move!];
          const mv = getMove(f.def, f.move!);
          key = `move:${f.move}`;
          fade = 2;
          if (mv.superFlash && s.freeze > 0 && s.freezeOwner === this.idx) {
            this.set.superFlash.sample(mv.superFlash - s.freeze + alpha, out);
            key = `flash:${f.move}`;
          } else if (clip) {
            clip.sample(f.mf + a, out);
            restart = f.mf < this.lastSf;
          } else out.set(P.stance);
          break;
        }
        case 'blockstun':
          (f.crouching ? M.blockCrouch : M.blockStand).sample(f.sf + a, out);
          key = f.crouching ? 'blockC' : 'block';
          fade = 1;
          restart = f.sf < this.lastSf;
          break;
        case 'hitstun': {
          const react = f.crouching ? 'hitCrouch' : this.lastReaction === 'gut' ? 'hitGut' : this.lastReaction === 'low' ? 'hitLow' : 'hitHigh';
          M[react].sample(f.sf + a, out);
          // last frames of hitstun: ease back toward neutral so the recovery reads
          const rest = Math.max(0, f.timer - a);
          if (rest < 6) lerpPose(out, f.crouching ? P.crouch : P.stance, (1 - rest / 6) * 0.7, out);
          key = `hit:${react}`;
          fade = 1;
          restart = f.sf < this.lastSf;
          break;
        }
        case 'countered':
          M.countered.sample(f.sf + a, out);
          fade = 1;
          break;
        case 'juggle':
        case 'airReset':
        case 'ko': {
          if (f.state === 'ko' && f.y === 0) {
            out.set(P.lying);
            key = 'lying';
            fade = 6;
          } else {
            const t = Math.min(1, f.sf / 26);
            lerpPose(P.juggle, P.lying, t * 0.6, out);
            out[R_ROT] = 25 + 65 * t;
            out[R_Y] = -0.3 * t;
            key = 'tumble';
            fade = 2;
          }
          break;
        }
        case 'knockdown':
          out.set(P.lying);
          // hitting the floor: a quick squash bounce
          out[S_SQ] = Math.max(0, 0.18 - f.sf * 0.03);
          key = 'lying';
          fade = 4;
          break;
        case 'wakeup':
          this.set.wakeup.sample(RULES.WAKEUP - f.timer + a, out);
          fade = 2;
          break;
        case 'throwing': {
          const anim = throwAnim(f);
          const clip = anim ? (this.set.throwAtk[`${anim}_back`] && f.jumpDir < 0 ? this.set.throwAtk[`${anim}_back`] : this.set.throwAtk[anim]) : undefined;
          if (clip) clip.sample(f.throwFrame + a, out);
          else out.set(P.stance);
          fade = 2;
          break;
        }
        case 'thrown': {
          const anim = throwAnim(o);
          const atkSet = ANIM_SETS[o.def];
          // back throws (back + grab) have their own pair when the attacker's set defines one
          const clip = anim ? (atkSet.throwDef[`${anim}_back`] && o.jumpDir < 0 ? atkSet.throwDef[`${anim}_back`] : atkSet.throwDef[anim]) : undefined;
          if (clip) {
            clip.sample(o.throwFrame + a, out);
            fixPivot(out, atkSet.pivot, this.set.pivot);
          } else out.set(P.hitGut);
          fade = 2;
          break;
        }
        case 'techRecover':
          out.set(P.blockStand);
          out[R_X] -= 0.08;
          fade = 2;
          break;
        case 'win':
          this.set.win.sample(f.sf, out);
          fade = 8;
          break;
        case 'clash': {
          // tug of war: whoever taps more pushes the duel toward the other
          const X = extras(this.set);
          out.set(X.clash);
          const d = s.duel;
          const tug = d ? Math.max(-1, Math.min(1, (d.taps[this.idx] - d.taps[1 - this.idx]) / 8)) : 0;
          out[R_X] += tug * 0.12;
          out[JOINT_INDEX.chest * 3 + 2] += Math.sin(time * 38 + this.idx) * 1.6;
          out[R_Y] += Math.sin(time * 31 + this.idx * 2) * 0.006;
          fade = 3;
          break;
        }
        case 'wallSplat': {
          // stuck for a beat, then sagging (the sim drops them when the timer runs out)
          const X = extras(this.set);
          out.set(X.splat);
          out[R_Y] -= Math.min(1, f.sf / 40) * 0.08;
          fade = 1;
          break;
        }
        case 'charge': {
          // Aufladen: a low power stance, fists pulled to the hips, chest up, the whole body trembling with energy
          lerpPose(P.stance, P.crouch, 0.35, out);
          const tr = Math.sin(time * 48) * 0.6 + Math.sin(time * 31) * 0.4;
          out[JOINT_INDEX.chest * 3 + 2] -= 10;
          out[JOINT_INDEX.head * 3 + 2] -= 6;
          out[JOINT_INDEX.shL * 3 + 2] -= 25;
          out[JOINT_INDEX.shR * 3 + 2] -= 25;
          out[JOINT_INDEX.elL * 3 + 2] -= 35;
          out[JOINT_INDEX.elR * 3 + 2] -= 35;
          out[JOINT_INDEX.chest * 3 + 1] += tr * 1.5;
          out[R_X] += tr * 0.004;
          fade = 5;
          break;
        }
        case 'dizzy': {
          const X = extras(this.set);
          const w = 0.5 + 0.5 * Math.sin(time * 3.2);
          lerpPose(X.dizzyA, X.dizzyB, w, out);
          out[R_X] += Math.sin(time * 1.7) * 0.04;
          fade = 10;
          break;
        }
        default:
          out.set(P.stance);
      }
    }

    if (!this.init) {
      this.current.set(out);
      this.prev.set(out);
      this.vel.fill(0);
      this.angVel.fill(0);
      this.vx = x;
      this.vy = y;
      this.key = key;
      this.init = true;
    } else {
      const frames = Math.max(0, dt * 60);
      if (key !== this.key || restart) {
        this.key = key;
        // blend length: the old fade length stretched (the quintic front-loads the change), and long enough for the
        // body to travel - a crouch-to-stand in 2 frames read as a snap
        const dy = Math.abs(this.current[R_Y] - out[R_Y]) + 0.5 * Math.abs(this.current[R_X] - out[R_X]);
        const blend = Math.max(fade <= 1 ? 2.5 : fade * 1.8, Math.min(12, 3 + dy * 24));
        this.inert.start(this.current, this.vel, this.angVel, out, blend);
      }
      this.current.set(out);
      this.inert.apply(this.current, frames);
      if (frames > 0) {
        for (let i = NJ * 3; i < POSE_LEN; i++) {
          const d = this.current[i] - this.prev[i];
          this.vel[i] = (i === R_ROT || i === R_YAW ? wrap180(d) : d) / frames;
        }
        // joints: angular velocity (axis * deg per frame) from the rotation between the last two frames
        for (let j = 0; j < NJ; j++) {
          poseJointQ(this.current, j, _q1);
          poseJointQ(this.prev, j, _q2);
          _q1.multiply(_q2.invert());
          if (_q1.w < 0) _q1.set(-_q1.x, -_q1.y, -_q1.z, -_q1.w);
          const ang = (2 * Math.acos(Math.min(1, _q1.w))) / RAD / frames;
          const sn = Math.sqrt(Math.max(1e-12, 1 - _q1.w * _q1.w));
          const k = ang > 1e-4 ? ang / sn : 0;
          this.angVel[j * 3] = _q1.x * k;
          this.angVel[j * 3 + 1] = _q1.y * k;
          this.angVel[j * 3 + 2] = _q1.z * k;
        }
      }
      this.prev.set(this.current);
    }
    this.lastSf = f.state === 'move' ? f.mf : f.sf;
    // position smoothing only for big jumps (throw/cinematic relocations)
    const jump = Math.abs(x - this.vx) > 0.45;
    const pk = jump ? 1 - Math.pow(1 - 0.25, dt * 60) : 1;
    this.vx += (x - this.vx) * pk;
    this.vy = y;
    this.lastX = x;
    // facing the rig is drawn with: follows the sim, except that a body on the floor or in the air does not flip
    // when the opponent crosses over it (it turned on the floor: S13 probe) - it turns when it is up again
    if (!this.visFacing || s.cine || !DOWN.has(f.state)) this.visFacing = f.facing;
    // facing flips (crossed-up, warped behind): the rig mirrors at once; a yaw that unwinds from 180 makes it a turn
    if (this.lastFacing && this.visFacing !== this.lastFacing && !s.cine) this.turnT = 0;
    this.lastFacing = this.visFacing;
    if (f.state === 'intro' && f.sf === 0) this.spring.reset(this.current);
    this.spring.step(this.current, Math.max(0, dt * 60), 2, this.final);
    if (this.turnT < 10) {
      this.turnT += Math.max(0, dt * 60);
      const k = Math.min(1, this.turnT / 10);
      this.final[R_YAW] += -180 * (1 - k * k * (3 - 2 * k));
    }
    const free = this.key.startsWith('move:') ? this.set.headFree?.[this.key.slice(5)] : undefined;
    stabilizeHead(this.final, free ?? headWeight(this.key));
    return this.final;
  }
}

/** How strongly the head keeps looking at the opponent per animation (reactions keep their whip, throws/cines are authored). */
function headWeight(key: string): number {
  if (key.startsWith('move:')) return 0.85;
  if (key.startsWith('hit:') || key === 'countered') return 0.2;
  if (key.startsWith('block')) return 0.6;
  if (key === 'clash') return 0.8;
  switch (key) {
    case 'idle':
    case 'crouch':
    case 'walkF':
    case 'walkB':
    case 'guard':
    case 'guardC':
    case 'dashF':
    case 'dashB':
    case 'jumpSquat':
    case 'land':
    case 'air':
      return 0.7;
    default:
      return 0;
  }
}

function throwAnim(f: FighterState): string | null {
  if (!f.throwMove) return null;
  const mv = getMove(f.def, f.throwMove);
  return mv.hits.find((h) => h.throw)?.throw?.anim ?? null;
}
