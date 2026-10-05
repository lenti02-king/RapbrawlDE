// Events emitted by the simulation for presentation (VFX, SFX, UI).
// Events are NOT part of the game state; with rollback, only events from newly
// simulated (not re-simulated) frames should be presented.

import type { Strength } from './defs';

export type SimEvent =
  | { t: 'roundStart'; round: number }
  | { t: 'fight' }
  | {
      t: 'hit';
      a: number;
      d: number;
      x: number;
      y: number;
      strength: Strength;
      damage: number;
      combo: number;
      move: string;
      counter: boolean;
      launch: boolean;
      projectile: boolean;
      /** Beat-Drop: landed on the music's beat (bonus damage + double hype). */
      beat: boolean;
    }
  | { t: 'block'; a: number; d: number; x: number; y: number; strength: Strength; projectile: boolean }
  | { t: 'perfectBlock'; a: number; d: number; x: number; y: number }
  | { t: 'armor'; a: number; d: number; x: number; y: number }
  | { t: 'moveStart'; p: number; move: string; card: string | null }
  | { t: 'active'; p: number; move: string; strength: Strength }
  | { t: 'card'; p: number; card: string }
  | { t: 'cardDenied'; p: number; card: string; reason: 'meter' | 'state' }
  | { t: 'superFlash'; p: number; card: string | null }
  | { t: 'jump'; p: number }
  | { t: 'land'; p: number }
  | { t: 'dash'; p: number; forward: boolean }
  | { t: 'fatalQte'; owner: number; seq: number[] }
  | { t: 'fatalStep'; owner: number; i: number; ok: boolean }
  | { t: 'charge'; p: number; on: boolean }
  | { t: 'throwStart'; a: number; d: number; move: string }
  | { t: 'throwHit'; a: number; d: number; damage: number; x: number; y: number }
  | { t: 'tech'; x: number; y: number }
  | { t: 'counter'; p: number; x: number; y: number }
  | { t: 'knockdown'; p: number; x: number }
  | { t: 'wakeup'; p: number }
  | { t: 'projectile'; p: number; id: number; kind: string }
  | { t: 'projectileEnd'; id: number; x: number; y: number }
  | { t: 'clash'; x: number; y: number }
  | { t: 'meterGain'; p: number; amount: number }
  | { t: 'cineStart'; id: string; owner: number }
  | { t: 'cineHit'; id: string; index: number; damage: number; strength: Strength }
  | { t: 'cineEnd'; id: string }
  | { t: 'ko'; loser: number }
  | { t: 'timeover' }
  | { t: 'roundOver'; winner: number }
  | { t: 'matchOver'; winner: number }
  | { t: 'wallSplat'; p: number; x: number; y: number; side: number; ko: boolean }
  | { t: 'duelStart'; x: number }
  | { t: 'duelTap'; p: number; taps: number }
  | { t: 'duelEnd'; winner: number; x: number; damage: number }
  | { t: 'finishHim'; winner: number }
  | { t: 'fatality'; owner: number; fighter: string }
  | { t: 'fatalityEnd'; owner: number };
