// Input sources produce the per-frame input bitmask for one player.
// Presses are latched until the next poll so taps shorter than a sim frame are never lost.
import { IN } from '../core/input';
import type { GameState } from '../core/state';

export interface InputSource {
  poll(s: GameState, idx: number): number;
  dispose?(): void;
}

/** Clean simultaneous opposite directions (SOCD): left+right = neutral, up+down = up. */
export function socd(bits: number): number {
  if ((bits & IN.LEFT) && (bits & IN.RIGHT)) bits &= ~(IN.LEFT | IN.RIGHT);
  if ((bits & IN.UP) && (bits & IN.DOWN)) bits &= ~IN.DOWN;
  return bits;
}

export type KeyMap = Record<string, number>;

export const P1_KEYS: KeyMap = {
  KeyA: IN.LEFT,
  KeyD: IN.RIGHT,
  KeyW: IN.UP,
  KeyS: IN.DOWN,
  KeyJ: IN.LIGHT,
  KeyK: IN.HEAVY,
  KeyL: IN.GRAB,
  Space: IN.BLOCK,
  Semicolon: IN.BLOCK,
  KeyU: IN.S1,
  KeyI: IN.S2,
  KeyO: IN.S3,
};

export const P2_KEYS: KeyMap = {
  ArrowLeft: IN.LEFT,
  ArrowRight: IN.RIGHT,
  ArrowUp: IN.UP,
  ArrowDown: IN.DOWN,
  Numpad1: IN.LIGHT,
  Numpad2: IN.HEAVY,
  Numpad3: IN.GRAB,
  Numpad0: IN.BLOCK,
  Numpad4: IN.S1,
  Numpad5: IN.S2,
  Numpad6: IN.S3,
  Comma: IN.LIGHT,
  Period: IN.HEAVY,
  Slash: IN.GRAB,
  ShiftRight: IN.BLOCK,
  KeyM: IN.S1,
  KeyN: IN.S2,
  KeyB: IN.S3,
};

class KeyboardState {
  held = new Set<string>();
  latched = new Set<string>();
  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.held.add(e.code);
      this.latched.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
  }
}

let kb: KeyboardState | null = null;
export function keyboardState(): KeyboardState {
  return (kb ??= new KeyboardState());
}

export class KeyboardSource implements InputSource {
  private st = keyboardState();
  constructor(private map: KeyMap) {}
  poll(): number {
    let bits = 0;
    for (const [code, bit] of Object.entries(this.map)) {
      if (this.st.held.has(code) || this.st.latched.has(code)) bits |= bit;
    }
    for (const code of Object.keys(this.map)) this.st.latched.delete(code);
    return socd(bits);
  }
}

export class GamepadSource implements InputSource {
  constructor(private index: number) {}
  poll(): number {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = pads[this.index];
    if (!gp) return 0;
    const b = (i: number) => !!gp.buttons[i]?.pressed;
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;
    let bits = 0;
    if (b(14) || ax < -0.45) bits |= IN.LEFT;
    if (b(15) || ax > 0.45) bits |= IN.RIGHT;
    if (b(12) || ay < -0.55) bits |= IN.UP;
    if (b(13) || ay > 0.5) bits |= IN.DOWN;
    if (b(2)) bits |= IN.LIGHT;
    if (b(3)) bits |= IN.HEAVY;
    if (b(0)) bits |= IN.GRAB;
    if (b(1) || b(6)) bits |= IN.BLOCK;
    if (b(4)) bits |= IN.S1;
    if (b(5)) bits |= IN.S2;
    if (b(7)) bits |= IN.S3;
    return socd(bits);
  }
}

/** OR-combines several sources (e.g. keyboard + touch + gamepad for the local player). */
export class MergedSource implements InputSource {
  constructor(private sources: InputSource[]) {}
  poll(s: GameState, idx: number): number {
    let bits = 0;
    for (const src of this.sources) bits |= src.poll(s, idx);
    return socd(bits);
  }
  dispose(): void {
    for (const s of this.sources) s.dispose?.();
  }
}

export class NullSource implements InputSource {
  poll(): number {
    return 0;
  }
}
