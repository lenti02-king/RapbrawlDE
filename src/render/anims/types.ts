import type { Clip, PoseDef } from '../pose';
import type { MotionClips, WalkSpec } from './motion';
import type { Reactions } from './stances';

export interface AnimSet {
  id: string;
  /** Hip pivot height (m) of the rig these poses were authored for. */
  pivot?: number;
  /** Idle bounce amplitude synced to the music beat (m). */
  idleBounce?: number;
  /** Captured idle (S17: motion capture instead of the static stance + sine breathing), looped by time; frames are
   *  60 Hz game frames. */
  idleLoop?: Clip;
  /** 0..1: the captured idle's arms are moved onto the stance's guard by this share (the recording's own arm motion
   *  stays on top) - fighting-game guard height with a real boxer's movement. */
  idleGuard?: number;
  /** 0..1: every channel of the captured idle moved onto the stance (an additive layer: the authored stance with the
   *  recording's weight shifts, bounce and breathing on top). */
  idleAdditive?: number;
  /** 0..1: share of the captured idle's leg/hip motion (and sway) kept around the stance (1 = all). */
  idleLegs?: number;
  /** 0..1: the captured idle's upper-body motion layered on the walk cycles. */
  walkLayer?: number;
  stance: PoseDef;
  r: Reactions;
  walkF: [PoseDef, PoseDef];
  walkB: [PoseDef, PoseDef];
  intro: Clip;
  win: Clip;
  /** Played during a super-flash freeze caused by this fighter (frame = frames since freeze start). */
  superFlash: Clip;
  wakeup: Clip;
  /** Move clips sampled by move frame (mf). */
  moves: Record<string, Clip>;
  /** Throw clips (by throw anim key) for the thrower and the victim, sampled by throw frame. */
  throwAtk: Record<string, Clip>;
  throwDef: Record<string, Clip>;
  /** Walk cycle shape (default: derived from the fighter's walk speed). */
  walk?: WalkSpec;
  /** Moves whose head motion is part of the strike (headbutt, flips): head stabiliser weight instead of 0.85. */
  headFree?: Record<string, number>;
  /** Overrides for the generated movement/reaction clips (anims/motion.ts). */
  motion?: Partial<MotionClips>;
}
