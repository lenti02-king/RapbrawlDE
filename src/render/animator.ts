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
import { lerpPose, stabilizeHead, toArr } from './pose';
import { type MotionClips, motionClips } from './anims/motion';
import { POSE_LEN, R_ROT, R_X, R_Y, R_YAW, JOINT_INDEX, S_SQ } from './rig';

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
    cache.set(set, c);
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

const ease = (t: number) => 1 - (1 - t) * (1 - t);

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
  private from = new Float32Array(POSE_LEN);
  private key = '';
  private fadeT = 0;
  private fadeDur = 0;
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
        default:
          out.set(P.stance);
      }
    }

    if (!this.init) {
      this.current.set(out);
      this.vx = x;
      this.vy = y;
      this.key = key;
      this.fadeT = this.fadeDur = 0;
      this.init = true;
    } else {
      if (key !== this.key || restart) {
        this.from.set(this.current);
        this.key = key;
        this.fadeT = 0;
        this.fadeDur = fade;
      }
      // keep big rotations (flips/spins) from unwinding the long way round
      for (const ri of [R_ROT, R_YAW]) {
        while (this.from[ri] - out[ri] > 180) this.from[ri] -= 360;
        while (out[ri] - this.from[ri] > 180) this.from[ri] += 360;
      }
      this.fadeT += dt * 60;
      const w = this.fadeDur > 0 ? ease(Math.min(1, this.fadeT / this.fadeDur)) : 1;
      lerpPose(this.from, out, w, this.current);
    }
    this.lastSf = f.state === 'move' ? f.mf : f.sf;
    // position smoothing only for big jumps (throw/cinematic relocations)
    const jump = Math.abs(x - this.vx) > 0.45;
    const pk = jump ? 1 - Math.pow(1 - 0.25, dt * 60) : 1;
    this.vx += (x - this.vx) * pk;
    this.vy = y;
    this.lastX = x;
    this.final.set(this.current);
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
