// Mobile touch controls: floating 8-way stick on the left half, action buttons
// and special-move cards on the right. Multi-touch via Pointer Events.
import { IN } from '../core/input';
import { getCard } from '../core/registry';
import type { GameState } from '../core/state';
import { type InputSource, socd } from './sources';

interface Btn {
  el: HTMLElement;
  bit: number;
  pointers: Set<number>;
  latched: boolean;
}

export class TouchControls implements InputSource {
  readonly root: HTMLElement;
  private stickZone: HTMLElement;
  private base: HTMLElement;
  private knob: HTMLElement;
  private stickPointer = -1;
  private origin = { x: 0, y: 0 };
  private dirBits = 0;
  private dirLatched = 0;
  private buttons: Btn[] = [];
  private cardEls: HTMLElement[] = [];
  private visible = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'touch';
    this.root.innerHTML = `
      <div class="stick-zone"><div class="stick-base"><div class="stick-knob"></div></div></div>
      <div class="pad">
        <div class="cards">
          <button class="card-btn" data-bit="S1"><span class="c-name"></span><span class="c-cost"></span></button>
          <button class="card-btn" data-bit="S2"><span class="c-name"></span><span class="c-cost"></span></button>
          <button class="card-btn" data-bit="S3"><span class="c-name"></span><span class="c-cost"></span></button>
        </div>
        <div class="actions">
          <button class="act act-block" data-bit="BLOCK">BLOCK</button>
          <button class="act act-grab" data-bit="GRAB">GRAB</button>
          <button class="act act-heavy" data-bit="HEAVY">H</button>
          <button class="act act-light" data-bit="LIGHT">L</button>
        </div>
      </div>`;
    parent.appendChild(this.root);
    this.stickZone = this.root.querySelector('.stick-zone')!;
    this.base = this.root.querySelector('.stick-base')!;
    this.knob = this.root.querySelector('.stick-knob')!;
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-bit]')) {
      const key = el.dataset.bit as keyof typeof IN;
      const btn: Btn = { el, bit: IN[key], pointers: new Set(), latched: false };
      this.buttons.push(btn);
      if (el.classList.contains('card-btn')) this.cardEls.push(el);
      const down = (e: PointerEvent) => {
        e.preventDefault();
        btn.pointers.add(e.pointerId);
        btn.latched = true;
        el.classList.add('down');
        navigator.vibrate?.(8);
      };
      const up = (e: PointerEvent) => {
        btn.pointers.delete(e.pointerId);
        if (!btn.pointers.size) el.classList.remove('down');
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    this.stickZone.addEventListener('pointerdown', (e) => this.stickDown(e));
    this.stickZone.addEventListener('pointermove', (e) => this.stickMove(e));
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointer) return;
      this.stickPointer = -1;
      this.dirBits = 0;
      this.base.classList.remove('active');
      this.knob.style.transform = 'translate(-50%, -50%)';
    };
    this.stickZone.addEventListener('pointerup', end);
    this.stickZone.addEventListener('pointercancel', end);
    this.setVisible(false);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.root.style.display = v ? '' : 'none';
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
    // drag the base along when the thumb goes far (floating stick)
    if (len > R * 1.25) {
      const k = (len - R * 1.25) / len;
      this.origin.x += dx * k;
      this.origin.y += dy * k;
      const r = this.stickZone.getBoundingClientRect();
      this.base.style.left = `${this.origin.x - r.left}px`;
      this.base.style.top = `${this.origin.y - r.top}px`;
      dx = e.clientX - this.origin.x;
      dy = e.clientY - this.origin.y;
    }
    const cl = Math.min(1, R / Math.max(1, Math.hypot(dx, dy)));
    this.knob.style.transform = `translate(calc(-50% + ${dx * cl}px), calc(-50% + ${dy * cl}px))`;
    let bits = 0;
    const dead = R * 0.3;
    if (dx < -dead) bits |= IN.LEFT;
    if (dx > dead) bits |= IN.RIGHT;
    if (dy < -R * 0.5) bits |= IN.UP;
    if (dy > R * 0.42) bits |= IN.DOWN;
    // favor pure horizontal near the axis so walking does not jump by accident
    if (bits & IN.UP && Math.abs(dx) > Math.abs(dy) * 1.9) bits &= ~IN.UP;
    const newly = bits & ~this.dirBits;
    this.dirLatched |= newly;
    this.dirBits = bits;
  }

  poll(): number {
    if (!this.visible) return 0;
    let bits = this.dirBits | (this.dirLatched & (IN.LEFT | IN.RIGHT | IN.UP));
    this.dirLatched = 0;
    for (const b of this.buttons) {
      if (b.pointers.size || b.latched) bits |= b.bit;
      b.latched = false;
    }
    return socd(bits);
  }

  /** Update card labels / affordability for the local player. */
  updateCards(s: GameState, idx: number): void {
    if (!this.visible) return;
    const f = s.fighters[idx];
    this.cardEls.forEach((el, i) => {
      const id = f.loadout[i];
      if (!id) return;
      const card = getCard(f.def, id);
      const name = el.querySelector('.c-name')!;
      if (name.textContent !== card.name) {
        name.textContent = card.name;
        el.querySelector('.c-cost')!.textContent = card.cost ? `${card.cost / 100}` : 'FREE';
        el.dataset.cat = card.category;
      }
      el.classList.toggle('ready', s.config.training || f.meter >= card.cost);
    });
  }
}
