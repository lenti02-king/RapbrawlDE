// Mobile touch controls: floating 8-way stick on the left (sector-based with hysteresis and a
// generous deadzone, so walking never turns into an accidental jump/crouch), action buttons on
// the right, and the HUD's card hand bound as special/signature buttons. Multi-touch via Pointer
// Events; every button captures its pointer, so a hold survives the finger drifting off it.
import { IN } from '../core/input';
import type { GameState } from '../core/state';
import { type InputSource, socd } from './sources';

interface Btn {
  el: HTMLElement;
  bit: number;
  pointers: Set<number>;
  latched: boolean;
}

/** Direction index 0..7 counter-clockwise from "right"; -1 = neutral. */
const DIR_BITS = [IN.RIGHT, IN.RIGHT | IN.UP, IN.UP, IN.LEFT | IN.UP, IN.LEFT, IN.LEFT | IN.DOWN, IN.DOWN, IN.RIGHT | IN.DOWN];
/** Half-widths (degrees) of each sector: horizontals wide (walking is safe), verticals medium, diagonals the rest. */
const HALF = [26, 19, 21, 19, 26, 19, 21, 19];
const CENTERS = [0, 45, 90, 135, 180, 225, 270, 315];
const HYST = 7;

function angDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/** Pick the sector for an angle, keeping the current one while within its half-width + hysteresis. */
export function sectorFor(angle: number, current: number): number {
  if (current >= 0 && angDiff(angle, CENTERS[current]) <= HALF[current] + HYST) return current;
  for (let i = 0; i < 8; i++) if (angDiff(angle, CENTERS[i]) <= HALF[i]) return i;
  // gaps between unequal sectors: nearest center
  let best = 0;
  for (let i = 1; i < 8; i++) if (angDiff(angle, CENTERS[i]) < angDiff(angle, CENTERS[best])) best = i;
  return best;
}

export class TouchControls implements InputSource {
  readonly root: HTMLElement;
  private stickZone: HTMLElement;
  private base: HTMLElement;
  private knob: HTMLElement;
  private dirEls: HTMLElement[];
  private stickPointer = -1;
  private origin = { x: 0, y: 0 };
  private dir = -1;
  private dirBits = 0;
  private dirLatched = 0;
  private buttons: Btn[] = [];
  private visible = false;
  /** Mic-Duell: while on, a tap anywhere counts as a button press. */
  private tapLayer: HTMLElement;
  private tapLatched = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'touch';
    this.root.innerHTML = `
      <div class="stick-zone"><div class="stick-base"><div class="dirs">${CENTERS.map((a) => `<i style="--a:${90 - a}deg"></i>`).join('')}</div><div class="stick-knob"></div></div></div>
      <div class="pad">
        <button class="act act-block" data-bit="BLOCK">BLOCK</button>
        <button class="act act-grab" data-bit="GRAB">GRIFF</button>
        <button class="act act-heavy" data-bit="HEAVY"><span>H<small>SCHWER</small></span></button>
        <button class="act act-light" data-bit="LIGHT"><span>L<small>LEICHT</small></span></button>
      </div>`;
    parent.appendChild(this.root);
    this.stickZone = this.root.querySelector('.stick-zone')!;
    this.base = this.root.querySelector('.stick-base')!;
    this.knob = this.root.querySelector('.stick-knob')!;
    this.dirEls = [...this.root.querySelectorAll<HTMLElement>('.dirs i')];
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-bit]')) this.bindButton(el, IN[el.dataset.bit as keyof typeof IN]);
    this.stickZone.addEventListener('pointerdown', (e) => this.stickDown(e));
    this.stickZone.addEventListener('pointermove', (e) => this.stickMove(e));
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointer) return;
      this.stickPointer = -1;
      this.setDir(-1);
      this.base.classList.remove('active');
      this.base.style.left = '';
      this.base.style.top = '';
      this.knob.style.transform = 'translate(-50%, -50%)';
    };
    this.stickZone.addEventListener('pointerup', end);
    this.stickZone.addEventListener('pointercancel', end);
    this.tapLayer = document.createElement('div');
    this.tapLayer.className = 'tap-layer';
    this.root.appendChild(this.tapLayer);
    this.tapLayer.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.tapLatched = true;
      navigator.vibrate?.(6);
    });
    this.setVisible(false);
  }

  /** Mic-Duell: the whole screen becomes one big tap button. */
  setTapMode(on: boolean): void {
    this.tapLayer.style.display = on ? 'block' : 'none';
  }

  private bindButton(el: HTMLElement, bit: number): void {
    const btn: Btn = { el, bit, pointers: new Set(), latched: false };
    this.buttons.push(btn);
    el.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      btn.pointers.add(e.pointerId);
      btn.latched = true;
      el.classList.add('down');
      navigator.vibrate?.(8);
    });
    const up = (e: PointerEvent) => {
      btn.pointers.delete(e.pointerId);
      if (!btn.pointers.size) el.classList.remove('down');
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Bind the HUD's hand cards (S1, S2, S3) as tappable buttons. */
  bindCards(cards: HTMLElement[]): void {
    const bits = [IN.S1, IN.S2, IN.S3];
    cards.forEach((el, i) => {
      if (!el.dataset.bound) {
        el.dataset.bound = '1';
        this.bindButton(el, bits[i]);
      }
    });
  }

  /** Hold-to-charge Hype ("Aufladen") on the HUD's Hype bar. */
  bindCharge(el: HTMLElement): void {
    if (el.dataset.bound) return;
    el.dataset.bound = '1';
    this.bindButton(el, IN.CHARGE);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.root.style.display = v ? '' : 'none';
    if (!v) {
      for (const b of this.buttons) {
        b.pointers.clear();
        b.el.classList.remove('down');
      }
      this.stickPointer = -1;
      this.setDir(-1);
    }
  }

  private setDir(d: number): void {
    if (d === this.dir) return;
    if (this.dir >= 0) this.dirEls[this.dir].classList.remove('on');
    if (d >= 0) this.dirEls[d].classList.add('on');
    this.dir = d;
    const bits = d >= 0 ? DIR_BITS[d] : 0;
    this.dirLatched |= bits & ~this.dirBits;
    this.dirBits = bits;
    if (d >= 0) navigator.vibrate?.(4);
  }

  private stickDown(e: PointerEvent): void {
    e.preventDefault();
    if (this.stickPointer !== -1) return;
    this.stickPointer = e.pointerId;
    this.stickZone.setPointerCapture?.(e.pointerId);
    const r = this.stickZone.getBoundingClientRect();
    this.origin = { x: e.clientX, y: e.clientY };
    this.base.style.left = `${e.clientX - r.left}px`;
    this.base.style.top = `${e.clientY - r.top}px`;
    this.base.classList.add('active');
    this.stickMove(e);
  }

  private stickMove(e: PointerEvent): void {
    if (e.pointerId !== this.stickPointer) return;
    const R = this.base.clientWidth * 0.5 || 60;
    let dx = e.clientX - this.origin.x;
    let dy = e.clientY - this.origin.y;
    const len = Math.hypot(dx, dy);
    // floating stick: drag the base along when the thumb travels far
    if (len > R * 1.2) {
      const k = (len - R * 1.2) / len;
      this.origin.x += dx * k;
      this.origin.y += dy * k;
      const r = this.stickZone.getBoundingClientRect();
      this.base.style.left = `${this.origin.x - r.left}px`;
      this.base.style.top = `${this.origin.y - r.top}px`;
      dx = e.clientX - this.origin.x;
      dy = e.clientY - this.origin.y;
    }
    const d = Math.hypot(dx, dy);
    const cl = Math.min(1, (R * 0.8) / Math.max(1, d));
    this.knob.style.transform = `translate(calc(-50% + ${dx * cl}px), calc(-50% + ${dy * cl}px))`;
    // deadzone with hysteresis: engage at 32% of the radius, release below 22%
    const engage = this.dir >= 0 ? R * 0.22 : R * 0.32;
    if (d < engage) return this.setDir(-1);
    const angle = ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360;
    this.setDir(sectorFor(angle, this.dir));
  }

  poll(_s?: GameState, _i?: number): number {
    if (!this.visible) return 0;
    let bits = this.dirBits | (this.dirLatched & (IN.LEFT | IN.RIGHT | IN.UP));
    this.dirLatched = 0;
    for (const b of this.buttons) {
      if (b.pointers.size || b.latched) bits |= b.bit;
      b.latched = false;
    }
    if (this.tapLatched) bits |= IN.LIGHT;
    this.tapLatched = false;
    return socd(bits);
  }
}
