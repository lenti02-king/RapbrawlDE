import type { Clip, PoseDef } from '../pose';
import type { Reactions } from './stances';

export interface AnimSet {
  id: string;
  /** Hip pivot height (m) of the rig these poses were authored for. */
  pivot?: number;
  /** Idle bounce amplitude synced to the music beat (m). */
  idleBounce?: number;
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
}
