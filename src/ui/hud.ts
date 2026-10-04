// In-fight HUD (DOM overlay): avatars, health, crowns, timer, combo counter, announcer,
// the local player's card hand + Hype bar (with a prominent Signature card), card banners,
// cinematic letterbox and screen flash.
import type { SimEvent } from '../core/events';
import { getCard, getFighter } from '../core/registry';
import type { GameState } from '../core/state';
import { CAT_COLOR, cardIcon, costBadge, UI_ICONS } from './icons';
import { portrait } from './portraits';

interface Side {
  root: HTMLElement;
  fill: HTMLElement;
  drain: HTMLElement;
  hp: HTMLElement;
  name: HTMLElement;
  avatar: HTMLElement;
  crowns: HTMLElement;
  hypeFill: HTMLElement[];
  combo: HTMLElement;
  comboN: HTMLElement;
  comboD: HTMLElement;
  banner: HTMLElement;
  drainV: number;
  lastHp: number;
  comboShownUntil: number;
  lastCombo: number;
  lastMeter: number;
  lastRounds: number;
}

export const SLOT_KEYS = ['U', 'I', 'O'];

interface Tween {
  el: HTMLElement;
  t: number;
  dur: number;
  frame: (k: number, el: HTMLElement) => void;
}

const outBack = (x: number) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
/** Pop in (scale from `from`), hold, fade out. Returns [opacity, scale]. */
function popHold(k: number, from: number, inEnd = 0.12, outStart = 0.8): [number, number] {
  if (k < inEnd) {
    const x = k / inEnd;
    return [Math.min(1, x * 1.5), from + (1 - from) * outBack(x)];
  }
  if (k < outStart) return [1, 1];
  const x = (k - outStart) / (1 - outStart);
  return [1 - x, 1 + 0.08 * x];
}

/** Card markup shared by HUD and menus. */
export function cardHtml(fighter: string, id: string, cls = ''): string {
  const c = getCard(fighter, id);
  const sig = c.category === 'signature';
  return `<div class="card ${sig ? 'sig' : ''} ${cls}" style="--c:${CAT_COLOR[c.category]}">${c.cost ? costBadge(c.cost) : ''}<div class="art">${cardIcon(
    c.id,
    c.category,
  )}</div><div class="nm">${c.name}</div></div>`;
}

export class Hud {
  readonly root: HTMLElement;
  private sides: Side[] = [];
  private timer: HTMLElement;
  private announce: HTMLElement;
  private letterbox: HTMLElement;
  private cineTitle: HTMLElement;
  private flash: HTMLElement;
  private superCard: HTMLElement;
  private hand: HTMLElement;
  private hypebar: HTMLElement;
  private hypeFill: HTMLElement[] = [];
  private hypeN: HTMLElement;
  private sigReady: HTMLElement;
  private tip: HTMLElement;
  private time = 0;
  private lastTimer = -1;
  private local = 0;
  private lastLocalMeter = -1;
  readonly pauseBtn: HTMLButtonElement;
  readonly trainingInfo: HTMLElement;
  /** The three hand cards (S1, S2, S3) — TouchControls binds them as buttons. */
  readonly handCards: HTMLElement[] = [];
  onSigReady: (() => void) | null = null;
  private tweens: Tween[] = [];

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    const side = (cls: string) => `
      <div class="side ${cls}">
        <div class="avatar"></div>
        <div class="nameplate"><span class="name"></span><span class="hcrowns"></span></div>
        <div class="bar"><div class="drain"></div><div class="fill"></div><div class="hp"></div></div>
        <div class="mini-hype"><div class="hb"><b></b></div><div class="hb"><b></b></div><div class="hb"><b></b></div></div>
      </div>`;
    this.root.innerHTML = `
      <div class="hud-top">${side('p1')}<div class="timer">99</div>${side('p2')}</div>
      <div class="combo p1"><div class="combo-n"></div><div class="combo-l">TREFFER</div><div class="combo-d"></div></div>
      <div class="combo p2"><div class="combo-n"></div><div class="combo-l">TREFFER</div><div class="combo-d"></div></div>
      <div class="card-banner p1"></div><div class="card-banner p2"></div>
      <div class="super-card"></div>
      <div class="hand">
        <div class="hcards">
          ${[0, 1, 2].map((i) => `<div class="hcard ${i === 2 ? 'sig' : ''}" data-slot="${i}"><div class="slotcard"></div><div class="fillmask"></div><kbd class="key">${SLOT_KEYS[i]}</kbd></div>`).join('')}
        </div>
        <div class="hypebar"><span class="cost"><b>0</b></span><div class="hb"><b></b></div><div class="hb"><b></b></div><div class="hb"><b></b></div><span class="hlabel">HYPE</span></div>
      </div>
      <div class="sig-ready"></div>
      <div class="tip"></div>
      <div class="announce"></div>
      <div class="letterbox"><div class="lb lb-top"></div><div class="lb lb-bot"></div><div class="cine-title"></div></div>
      <div class="screen-flash"></div>
      <div class="training-info"></div>
      <button class="btn icon pause-btn" aria-label="Pause">${UI_ICONS.pause}</button>`;
    parent.appendChild(this.root);
    for (const cls of ['p1', 'p2']) {
      const r = this.root.querySelector<HTMLElement>(`.side.${cls}`)!;
      const combo = this.root.querySelector<HTMLElement>(`.combo.${cls}`)!;
      this.sides.push({
        root: r,
        fill: r.querySelector('.fill')!,
        drain: r.querySelector('.drain')!,
        hp: r.querySelector('.hp')!,
        name: r.querySelector('.name')!,
        avatar: r.querySelector('.avatar')!,
        crowns: r.querySelector('.hcrowns')!,
        hypeFill: [...r.querySelectorAll<HTMLElement>('.hb b')],
        combo,
        comboN: combo.querySelector('.combo-n')!,
        comboD: combo.querySelector('.combo-d')!,
        banner: this.root.querySelector<HTMLElement>(`.card-banner.${cls}`)!,
        drainV: 1,
        lastHp: -1,
        comboShownUntil: 0,
        lastCombo: 0,
        lastMeter: -1,
        lastRounds: -1,
      });
    }
    this.timer = this.root.querySelector('.timer')!;
    this.announce = this.root.querySelector('.announce')!;
    this.letterbox = this.root.querySelector('.letterbox')!;
    this.cineTitle = this.root.querySelector('.cine-title')!;
    this.flash = this.root.querySelector('.screen-flash')!;
    this.superCard = this.root.querySelector('.super-card')!;
    this.hand = this.root.querySelector('.hand')!;
    this.hypebar = this.root.querySelector('.hypebar')!;
    this.hypeFill = [...this.hypebar.querySelectorAll<HTMLElement>('.hb b')];
    this.hypeN = this.hypebar.querySelector('.cost b')!;
    this.sigReady = this.root.querySelector('.sig-ready')!;
    this.tip = this.root.querySelector('.tip')!;
    this.handCards.push(...this.root.querySelectorAll<HTMLElement>('.hcard'));
    this.pauseBtn = this.root.querySelector('.pause-btn')!;
    this.trainingInfo = this.root.querySelector('.training-info')!;
  }

  /** @param local index of the fighter whose hand is shown; @param touch hand cards are tappable buttons */
  setup(s: GameState, local: number, touch: boolean): void {
    this.local = local;
    this.lastLocalMeter = -1;
    s.fighters.forEach((f, i) => {
      const side = this.sides[i];
      side.name.textContent = getFighter(f.def).name;
      const img = portrait(f.def, 'bust');
      side.avatar.innerHTML = img ? `<img alt="" src="${img}">` : '';
      side.drainV = 1;
      side.lastHp = -1;
      side.lastMeter = -1;
      side.lastRounds = -1;
      side.crowns.innerHTML = Array.from({ length: s.config.roundsToWin }, () => `<i>${UI_ICONS.crown}</i>`).join('');
    });
    const me = s.fighters[local];
    this.handCards.forEach((el, i) => {
      const id = me.loadout[i];
      el.querySelector('.slotcard')!.innerHTML = id ? cardHtml(me.def, id) : '';
      el.style.display = id ? '' : 'none';
    });
    this.hand.classList.toggle('tap', touch);
    this.root.classList.toggle('training', s.config.training);
    this.announce.className = 'announce';
    this.tweens = [];
    for (const el of [this.announce, this.sigReady, this.superCard, ...this.sides.map((x) => x.banner)]) el.style.opacity = '0';
    this.letterbox.classList.remove('on');
    this.sigReady.innerHTML = `★ SIGNATURE BEREIT!<small>${touch ? 'Tippe die goldene Karte' : 'Drück O'}</small>`;
  }

  show(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }

  /** JS-driven tweens (advanced by update): independent of CSS animation timing. */
  private play(el: HTMLElement, dur: number, frame: (k: number, el: HTMLElement) => void): void {
    this.tweens = this.tweens.filter((t) => t.el !== el);
    this.tweens.push({ el, t: 0, dur, frame });
    frame(0, el);
  }

  private say(text: string, cls = '', ms = 1100): void {
    this.announce.textContent = text;
    this.announce.className = `announce ${cls}`;
    this.play(this.announce, ms / 1000, (k, el) => {
      const [o, sc] = popHold(k, 2.2, 0.14, 0.8);
      el.style.opacity = String(o);
      el.style.transform = `scale(${sc.toFixed(3)}) rotate(-3deg)`;
    });
  }

  showTip(text: string, ms = 3200): void {
    this.tip.textContent = text;
    this.tip.classList.add('show');
    window.clearTimeout((this.tip as unknown as { _t: number })._t);
    (this.tip as unknown as { _t: number })._t = window.setTimeout(() => this.tip.classList.remove('show'), ms);
  }

  onEvents(s: GameState, events: readonly SimEvent[]): void {
    for (const e of events) {
      switch (e.t) {
        case 'roundStart': {
          const need = s.config.roundsToWin;
          const final = s.fighters.every((f) => f.roundsWon === need - 1) && need > 1;
          if (!s.config.training) this.say(final ? 'FINALE RUNDE' : `RUNDE ${e.round}`, 'round', 1600);
          break;
        }
        case 'fight':
          this.say(s.config.training ? 'TRAINING' : 'FIGHT!', 'fight', 900);
          break;
        case 'ko':
          this.say(e.loser < 0 ? 'DOPPEL-K.O.' : 'K.O.', 'ko', 2200);
          break;
        case 'timeover':
          this.say('ZEIT!', 'ko', 1500);
          break;
        case 'roundOver': {
          if (e.winner === 2) this.say('UNENTSCHIEDEN', 'win', 1600);
          else {
            const w = s.fighters[e.winner];
            const perfect = w.health === getFighter(w.def).health;
            this.say(perfect ? 'PERFEKT!' : `${getFighter(w.def).name} GEWINNT`, 'win', 1700);
          }
          break;
        }
        case 'card': {
          const f = s.fighters[e.p];
          const card = getCard(f.def, e.card);
          if (card.category === 'signature') break;
          const b = this.sides[e.p].banner;
          b.style.setProperty('--cc', CAT_COLOR[card.category]);
          b.innerHTML = `<span class="bicon">${cardIcon(card.id, card.category)}</span><span class="bname">${card.name}</span>`;
          b.className = `card-banner p${e.p + 1}`;
          this.play(b, 1.3, (k, el) => {
            const [o, sc] = popHold(k, 0.85);
            el.style.opacity = String(o);
            el.style.transform = `scale(${sc.toFixed(3)})`;
          });
          break;
        }
        case 'superFlash': {
          const f = s.fighters[e.p];
          const card = e.card ? getCard(f.def, e.card) : null;
          this.superCard.innerHTML = `<div class="sc-inner">${card ? cardHtml(f.def, card.id, 'big') : ''}<div class="sc-name">${card?.name ?? ''}</div></div>`;
          this.superCard.className = `super-card p${e.p + 1}`;
          this.play(this.superCard, 0.75, (k, el) => {
            const [o, sc] = popHold(k, 0.3, 0.3, 0.85);
            el.style.opacity = String(o);
            el.style.transform = `translateY(-50%) scale(${sc.toFixed(3)}) rotate(-4deg)`;
          });
          break;
        }
        case 'cineStart': {
          const owner = s.fighters[e.owner];
          const card = owner.loadout.map((id) => getCard(owner.def, id)).find((c) => c.category === 'signature');
          this.letterbox.classList.add('on');
          this.cineTitle.textContent = card?.name ?? '';
          break;
        }
        case 'cineEnd':
          this.letterbox.classList.remove('on');
          break;
        case 'cardDenied': {
          if (e.p === this.local) {
            this.hypebar.classList.remove('deny');
            void this.hypebar.offsetWidth;
            this.hypebar.classList.add('deny');
          }
          break;
        }
        default:
          break;
      }
    }
  }

  update(s: GameState, dt: number, screenFlash: number): void {
    this.time += dt;
    for (const tw of this.tweens) {
      tw.t += dt;
      tw.frame(Math.min(1, tw.t / tw.dur), tw.el);
    }
    this.tweens = this.tweens.filter((tw) => tw.t < tw.dur);
    s.fighters.forEach((f, i) => {
      const side = this.sides[i];
      const max = getFighter(f.def).health;
      const hp = f.health / max;
      if (f.health !== side.lastHp) {
        side.fill.style.transform = `scaleX(${hp})`;
        side.hp.textContent = String(f.health);
        side.root.classList.toggle('danger', hp < 0.25);
        side.lastHp = f.health;
      }
      const inCombo = f.state === 'hitstun' || f.state === 'juggle' || f.state === 'thrown' || f.state === 'cineDef';
      if (!inCombo) side.drainV = Math.max(hp, side.drainV - dt * 0.6);
      if (side.drainV < hp) side.drainV = hp;
      side.drain.style.transform = `scaleX(${side.drainV})`;
      if (f.roundsWon !== side.lastRounds) {
        side.lastRounds = f.roundsWon;
        side.crowns.querySelectorAll('i').forEach((c, k) => c.classList.toggle('won', k < f.roundsWon));
      }
      if (f.meter !== side.lastMeter) {
        side.lastMeter = f.meter;
        for (let k = 0; k < 3; k++) {
          const v = Math.max(0, Math.min(1, (f.meter - k * 100) / 100));
          side.hypeFill[k].style.transform = `scaleX(${v})`;
          side.hypeFill[k].parentElement!.classList.toggle('full', v >= 1);
        }
      }
      // combo counter shows on the ATTACKER side
      const atkSide = this.sides[1 - i];
      if (inCombo && f.combo >= 2) {
        if (f.combo !== atkSide.lastCombo) {
          atkSide.comboN.textContent = String(f.combo);
          atkSide.combo.classList.remove('bump');
          void atkSide.combo.offsetWidth;
          atkSide.combo.classList.add('show', 'bump');
          atkSide.lastCombo = f.combo;
        }
        atkSide.comboD.textContent = `${f.comboDamage} SCHADEN`;
        atkSide.comboShownUntil = this.time + 1.1;
      } else if (this.time > atkSide.comboShownUntil) {
        atkSide.combo.classList.remove('show');
        atkSide.lastCombo = 0;
      }
    });
    this.updateHand(s);
    const secs = s.config.training ? -1 : Math.ceil(s.timer / 60);
    if (secs !== this.lastTimer) {
      this.timer.textContent = secs < 0 ? '∞' : String(Math.max(0, secs));
      this.timer.classList.toggle('low', secs >= 0 && secs <= 10);
      this.lastTimer = secs;
    }
    this.flash.style.opacity = String(Math.min(0.85, screenFlash));
  }

  private updateHand(s: GameState): void {
    const me = s.fighters[this.local];
    if (me.meter === this.lastLocalMeter) return;
    const prev = this.lastLocalMeter;
    this.lastLocalMeter = me.meter;
    for (let k = 0; k < 3; k++) {
      const v = Math.max(0, Math.min(1, (me.meter - k * 100) / 100));
      this.hypeFill[k].style.transform = `scaleX(${v})`;
      this.hypeFill[k].parentElement!.classList.toggle('full', v >= 1);
    }
    this.hypeN.textContent = String(Math.floor(me.meter / 100));
    this.handCards.forEach((el, i) => {
      const id = me.loadout[i];
      if (!id) return;
      const cost = getCard(me.def, id).cost;
      const ready = s.config.training || me.meter >= cost;
      el.classList.toggle('ready', ready);
      const frac = cost > 0 ? Math.min(1, me.meter / cost) : 1;
      (el.querySelector('.fillmask') as HTMLElement).style.transform = `scaleY(${s.config.training ? 0 : 1 - frac})`;
    });
    const sigId = me.loadout[2];
    if (sigId && prev >= 0 && !s.config.training) {
      const cost = getCard(me.def, sigId).cost;
      if (prev < cost && me.meter >= cost) {
        this.play(this.sigReady, 2.4, (k, el) => {
          const [o, sc] = popHold(k, 0.4);
          el.style.opacity = String(o);
          el.style.transform = `translateX(-50%) translateY(${(-1 * Math.max(0, (k - 0.8) / 0.2)).toFixed(3)}rem) scale(${sc.toFixed(3)})`;
        });
        this.onSigReady?.();
      }
    }
  }
}
