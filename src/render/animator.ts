// Turns simulation state into poses. Pure presentation: reads GameState, never writes it.
import type { Reaction } from '../core/defs';
import { UNITS_PER_METER } from '../core/math';
import { getMove } from '../core/registry';
import { RULES } from '../core/sim';
import type { FighterState, GameState } from '../core/state';
import { BRICK_ANIMS } from './anims/brick';
import type { AnimSet } from './anims/types';
import { VOLT_ANIMS } from './anims/volt';
import { JAZEEK_ANIMS } from './anims/jazeek';
import { BONEZ_ANIMS } from './anims/bonez';
import { lerpPose, toArr } from './pose';
import { POSE_LEN, R_ROT, R_X, R_Y, R_YAW, JOINT_INDEX } from './rig';

export const ANIM_SETS: Record<string, AnimSet> = { volt: VOLT_ANIMS, brick: BRICK_ANIMS, jazeek: JAZEEK_ANIMS, bonez: BONEZ_ANIMS };

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
    c.walkF0 = toArr(set.walkF[0]);
    c.walkF1 = toArr(set.walkF[1]);
    c.walkB0 = toArr(set.walkB[0]);
    c.walkB1 = toArr(set.walkB[1]);
    cache.set(set, c);
  }
  return c;
}

/** Optional external override (used by cinematics). Return true if it wrote `out`. */
export type PoseOverride = (s: GameState, idx: number, out: Float32Array) => boolean;

export class FighterAnimator {
  readonly current = new Float32Array(POSE_LEN);
  private target = new Float32Array(POSE_LEN);
  private tmp = new Float32Array(POSE_LEN);
  private walkPhase = 0;
  private lastX = 0;
  private init = false;
  private lastReaction: Reaction = 'high';
  private lastState = '';
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
    const out = this.target;
    let rate = 0.32;
    const x = f.x / UNITS_PER_METER;
    const y = f.y / UNITS_PER_METER;

    if (this.override && this.override(s, this.idx, out)) {
      rate = 0.55;
    } else {
      switch (f.state) {
        case 'intro':
          this.set.intro.sample(f.sf, out);
          rate = 0.25;
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
            out[R_Y] -= this.beat * this.set.idleBounce;
            out[JOINT_INDEX.knL * 3 + 2] -= this.beat * 6;
            out[JOINT_INDEX.knR * 3 + 2] -= this.beat * 6;
            out[JOINT_INDEX.head * 3 + 2] += this.beat * 3;
          }
          break;
        }
        case 'walkF':
        case 'walkB': {
          const fwd = f.state === 'walkF';
          this.walkPhase += Math.abs(x - this.lastX) * (fwd ? 9 : 10);
          const t = 0.5 + 0.5 * Math.sin(this.walkPhase);
          lerpPose(fwd ? P.walkF0 : P.walkB0, fwd ? P.walkF1 : P.walkB1, t, out);
          rate = 0.4;
          break;
        }
        case 'guard':
          out.set(f.crouching ? P.guardCrouch : P.guardStand);
          rate = 0.5;
          break;
        case 'jumpSquat':
          out.set(P.jumpSquat);
          rate = 0.7;
          break;
        case 'air': {
          const t = Math.min(1, Math.max(0, 0.5 - f.vy / 2400));
          lerpPose(P.airRise, P.airFall, t, out);
          rate = 0.35;
          break;
        }
        case 'land':
          out.set(P.land);
          rate = 0.6;
          break;
        case 'dashF':
          out.set(P.dashF);
          rate = 0.5;
          break;
        case 'dashB':
          out.set(P.dashB);
          rate = 0.5;
          break;
        case 'move': {
          const clip = this.set.moves[f.move!];
          const mv = getMove(f.def, f.move!);
          if (mv.superFlash && s.freeze > 0 && s.freezeOwner === this.idx) {
            this.set.superFlash.sample(mv.superFlash - s.freeze + alpha, out);
            rate = 0.5;
          } else if (clip) {
            const frozen = f.hitstop > 0 || s.freeze > 0;
            clip.sample(f.mf + (frozen ? 0 : alpha), out);
            rate = this.lastState !== 'move' ? 0.75 : 0.6;
          } else out.set(P.stance);
          break;
        }
        case 'blockstun':
          out.set(f.crouching ? P.blockCrouch : P.blockStand);
          rate = 0.75;
          break;
        case 'hitstun': {
          const react = f.crouching ? P.hitCrouch : this.lastReaction === 'gut' ? P.hitGut : this.lastReaction === 'low' ? P.hitLow : P.hitHigh;
          const w = Math.min(1, f.timer / 7);
          lerpPose(f.crouching ? P.crouch : P.stance, react, w, out);
          rate = f.sf < 2 ? 0.8 : 0.4;
          break;
        }
        case 'countered':
          out.set(P.countered);
          rate = 0.6;
          break;
        case 'juggle':
        case 'airReset':
        case 'ko': {
          if (f.state === 'ko' && f.y === 0) {
            out.set(P.lying);
            rate = 0.25;
          } else {
            const t = Math.min(1, f.sf / 26);
            lerpPose(P.juggle, P.lying, t * 0.6, out);
            out[R_ROT] = 25 + 65 * t;
            out[R_Y] = -0.3 * t;
            rate = 0.45;
          }
          break;
        }
        case 'knockdown':
          out.set(P.lying);
          rate = 0.3;
          break;
        case 'wakeup':
          this.set.wakeup.sample(RULES.WAKEUP - f.timer + alpha, out);
          rate = 0.5;
          break;
        case 'throwing': {
          const anim = throwAnim(f);
          const clip = anim ? this.set.throwAtk[anim] : undefined;
          if (clip) clip.sample(f.throwFrame + alpha, out);
          else out.set(P.stance);
          rate = 0.6;
          break;
        }
        case 'thrown': {
          const anim = throwAnim(o);
          const atkSet = ANIM_SETS[o.def];
          const clip = anim ? atkSet.throwDef[anim] : undefined;
          if (clip) {
            clip.sample(o.throwFrame + alpha, out);
            fixPivot(out, atkSet.pivot, this.set.pivot);
          } else out.set(P.hitGut);
          rate = 0.6;
          break;
        }
        case 'techRecover':
          out.set(P.blockStand);
          out[R_X] -= 0.08;
          rate = 0.5;
          break;
        case 'win':
          this.set.win.sample(f.sf, out);
          rate = 0.2;
          break;
        default:
          out.set(P.stance);
      }
    }

    // frame-rate independent exponential blend
    const k = 1 - Math.pow(1 - rate, dt * 60);
    if (!this.init) {
      this.current.set(out);
      this.vx = x;
      this.vy = y;
      this.init = true;
    } else {
      // keep big rotations (flips/spins) from unwinding the long way round
      for (const ri of [R_ROT, R_YAW]) {
        while (this.current[ri] - out[ri] > 180) this.current[ri] -= 360;
        while (out[ri] - this.current[ri] > 180) this.current[ri] += 360;
      }
      lerpPose(this.current, out, k, this.current);
    }
    // position smoothing only for big jumps (throw/cinematic relocations)
    const jump = Math.abs(x - this.vx) > 0.45;
    const pk = jump ? 1 - Math.pow(1 - 0.25, dt * 60) : 1;
    this.vx += (x - this.vx) * pk;
    this.vy = y;
    this.lastX = x;
    this.lastState = f.state;
    this.tmp.set(this.current);
    return this.current;
  }
}

function throwAnim(f: FighterState): string | null {
  if (!f.throwMove) return null;
  const mv = getMove(f.def, f.throwMove);
  return mv.hits.find((h) => h.throw)?.throw?.anim ?? null;
}
