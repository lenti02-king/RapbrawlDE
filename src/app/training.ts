// Training-mode readouts: move startup, frame advantage on hit/block, combo damage, inputs.
import type { SimEvent } from '../core/events';
import { IN } from '../core/input';
import { getMove } from '../core/registry';
import { isActionable } from '../core/sim';
import type { GameState } from '../core/state';

export class TrainingMonitor {
  private moveName = '-';
  private startFrame = -1;
  private startup = '-';
  private adv = '-';
  private pending: { atk: number; def: number; kind: 'HIT' | 'BLOCK'; a: number; d: number } | null = null;
  private lastCombo = 0;
  private lastDamage = 0;
  private dirty = true;

  constructor(private el: HTMLElement) {}

  onEvents(s: GameState, ev: readonly SimEvent[]): void {
    for (const e of ev) {
      if (e.t === 'moveStart' && e.p === 0) {
        this.moveName = getMove(s.fighters[0].def, e.move).name;
        this.startFrame = s.frame;
        this.startup = '-';
        this.dirty = true;
      }
      if (e.t === 'active' && e.p === 0 && this.startup === '-' && this.startFrame >= 0) {
        this.startup = `${s.frame - this.startFrame + 1}f`;
        this.dirty = true;
      }
      if ((e.t === 'hit' || e.t === 'block') && e.a === 0 && !(e.t === 'hit' && e.projectile) && !(e.t === 'block' && e.projectile)) {
        this.pending = { atk: 0, def: 1, kind: e.t === 'hit' ? 'HIT' : 'BLOCK', a: -1, d: -1 };
      }
    }
  }

  update(s: GameState, inputs: [number, number]): void {
    const p = this.pending;
    if (p) {
      const atk = s.fighters[p.atk];
      const def = s.fighters[p.def];
      if (p.a < 0 && isActionable(atk)) p.a = s.frame;
      if (p.d < 0 && isActionable(def)) p.d = s.frame;
      if (def.state === 'knockdown' || def.state === 'juggle' || def.state === 'thrown' || def.state === 'cineDef') {
        this.adv = `${p.kind}: KD`;
        this.pending = null;
        this.dirty = true;
      } else if (p.a >= 0 && p.d >= 0) {
        const v = p.d - p.a;
        this.adv = `${p.kind}: ${v > 0 ? '+' : ''}${v}`;
        this.pending = null;
        this.dirty = true;
      } else if (atk.state === 'move' && atk.connected === 'none' && p.a < 0) {
        // chained into something else; give up measuring
      }
    }
    const d = s.fighters[1];
    if (d.combo > 0 && (d.combo !== this.lastCombo || d.comboDamage !== this.lastDamage)) {
      this.lastCombo = d.combo;
      this.lastDamage = d.comboDamage;
      this.dirty = true;
    }
    if (this.dirty || s.frame % 6 === 0) {
      const rows: [string, string][] = [
        ['MOVE', this.moveName],
        ['STARTUP', String(this.startup)],
        ['VORTEIL', String(this.adv)],
        ['KOMBO', `${this.lastCombo} Treffer · ${this.lastDamage} Schaden`],
        ['EINGABE', fmt(inputs[0])],
      ];
      const esc = (t: string) => t.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`);
      this.el.innerHTML = rows.map(([k, v]) => `<div class="ti-row"><span>${k}</span><b>${esc(v)}</b></div>`).join('');
      this.dirty = false;
    }
  }
}

function fmt(bits: number): string {
  const d =
    (bits & IN.UP ? (bits & IN.LEFT ? '↖' : bits & IN.RIGHT ? '↗' : '↑') : bits & IN.DOWN ? (bits & IN.LEFT ? '↙' : bits & IN.RIGHT ? '↘' : '↓') : bits & IN.LEFT ? '←' : bits & IN.RIGHT ? '→' : '·');
  const b = [
    [IN.LIGHT, 'L'],
    [IN.HEAVY, 'H'],
    [IN.GRAB, 'G'],
    [IN.BLOCK, 'B'],
    [IN.S1, '1'],
    [IN.S2, '2'],
    [IN.S3, '3'],
  ]
    .filter(([bit]) => bits & (bit as number))
    .map(([, n]) => n)
    .join(' ');
  return `${d} ${b}`;
}
