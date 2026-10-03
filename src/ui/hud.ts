// In-fight HUD (DOM overlay): health, hype meter, timer, rounds, combo counter,
// announcer, card activation banners, cinematic letterbox, screen flash.
import type { CardCategory } from '../core/defs';
import type { SimEvent } from '../core/events';
import { getCard, getFighter } from '../core/registry';
import { RULES } from '../core/sim';
import type { GameState } from '../core/state';

const CAT_LABEL: Record<CardCategory, string> = {
  offense: 'OFFENSE',
  zoning: 'ZONING',
  mobility: 'MOBILITY',
  counter: 'COUNTER',
  utility: 'UTILITY',
  grapple: 'GRAPPLE',
  signature: 'SIGNATURE',
};

interface Side {
  root: HTMLElement;
  fill: HTMLElement;
  drain: HTMLElement;
  name: HTMLElement;
  pips: HTMLElement[];
  hypeFill: HTMLElement[];
  hypeN: HTMLElement;
  combo: HTMLElement;
  comboN: HTMLElement;
  comboD: HTMLElement;
  banner: HTMLElement;
  drainV: number;
  lastHp: number;
  comboShownUntil: number;
  lastCombo: number;
  lastMeter: number;
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
  private time = 0;
  private lastTimer = -1;
  readonly pauseBtn: HTMLButtonElement;
  readonly trainingInfo: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    const side = (cls: string) => `
      <div class="side ${cls}">
        <div class="nameplate"><span class="name"></span><span class="pips"><i></i><i></i></span></div>
        <div class="bar"><div class="drain"></div><div class="fill"></div><div class="shine"></div></div>
        <div class="hype"><span class="hype-n">0</span><div class="hype-bars"><div class="hb"><b></b></div><div class="hb"><b></b></div><div class="hb"><b></b></div></div><span class="hype-l">HYPE</span></div>
      </div>`;
    this.root.innerHTML = `
      <div class="hud-top">${side('p1')}<div class="timer">99</div>${side('p2')}</div>
      <div class="combo p1"><div class="combo-n"></div><div class="combo-l">HITS</div><div class="combo-d"></div></div>
      <div class="combo p2"><div class="combo-n"></div><div class="combo-l">HITS</div><div class="combo-d"></div></div>
      <div class="card-banner p1"></div><div class="card-banner p2"></div>
      <div class="super-card"></div>
      <div class="announce"></div>
      <div class="letterbox"><div class="lb lb-top"></div><div class="lb lb-bot"></div><div class="cine-title"></div></div>
      <div class="screen-flash"></div>
      <div class="training-info"></div>
      <button class="pause-btn" aria-label="Pause">II</button>`;
    parent.appendChild(this.root);
    for (const cls of ['p1', 'p2']) {
      const r = this.root.querySelector<HTMLElement>(`.side.${cls}`)!;
      const combo = this.root.querySelector<HTMLElement>(`.combo.${cls}`)!;
      this.sides.push({
        root: r,
        fill: r.querySelector('.fill')!,
        drain: r.querySelector('.drain')!,
        name: r.querySelector('.name')!,
        pips: [...r.querySelectorAll<HTMLElement>('.pips i')],
        hypeFill: [...r.querySelectorAll<HTMLElement>('.hb b')],
        hypeN: r.querySelector('.hype-n')!,
        combo,
        comboN: combo.querySelector('.combo-n')!,
        comboD: combo.querySelector('.combo-d')!,
        banner: this.root.querySelector<HTMLElement>(`.card-banner.${cls}`)!,
        drainV: 1,
        lastHp: -1,
        comboShownUntil: 0,
        lastCombo: 0,
        lastMeter: -1,
      });
    }
    this.timer = this.root.querySelector('.timer')!;
    this.announce = this.root.querySelector('.announce')!;
    this.letterbox = this.root.querySelector('.letterbox')!;
    this.cineTitle = this.root.querySelector('.cine-title')!;
    this.flash = this.root.querySelector('.screen-flash')!;
    this.superCard = this.root.querySelector('.super-card')!;
    this.pauseBtn = this.root.querySelector('.pause-btn')!;
    this.trainingInfo = this.root.querySelector('.training-info')!;
  }

  setup(s: GameState, accents: [string, string]): void {
    s.fighters.forEach((f, i) => {
      const side = this.sides[i];
      side.name.textContent = getFighter(f.def).name;
      side.root.style.setProperty('--accent', accents[i]);
      side.combo.style.setProperty('--accent', accents[i]);
      side.banner.style.setProperty('--accent', accents[i]);
      side.drainV = 1;
      side.lastHp = -1;
      side.pips.forEach((p, k) => (p.style.display = k < s.config.roundsToWin ? '' : 'none'));
    });
    this.root.classList.toggle('training', s.config.training);
    this.announce.className = 'announce';
    this.letterbox.classList.remove('on');
  }

  show(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }

  private say(text: string, cls = '', ms = 1100): void {
    this.announce.textContent = text;
    this.announce.className = 'announce';
    void this.announce.offsetWidth;
    this.announce.className = `announce show ${cls}`;
    window.clearTimeout((this.announce as unknown as { _t: number })._t);
    (this.announce as unknown as { _t: number })._t = window.setTimeout(() => (this.announce.className = 'announce'), ms);
  }

  onEvents(s: GameState, events: readonly SimEvent[]): void {
    for (const e of events) {
      switch (e.t) {
        case 'roundStart': {
          const need = s.config.roundsToWin;
          const final = s.fighters.every((f) => f.roundsWon === need - 1) && need > 1;
          if (!s.config.training) this.say(final ? 'FINAL ROUND' : `ROUND ${e.round}`, 'round', 1600);
          break;
        }
        case 'fight':
          this.say(s.config.training ? 'TRAINING' : 'FIGHT!', 'fight', 900);
          break;
        case 'ko': {
          this.say(e.loser < 0 ? 'DOUBLE K.O.' : 'K.O.', 'ko', 2200);
          break;
        }
        case 'timeover':
          this.say('TIME', 'ko', 1500);
          break;
        case 'roundOver': {
          if (e.winner === 2) this.say('DRAW', 'win', 1600);
          else {
            const w = s.fighters[e.winner];
            const perfect = w.health === getFighter(w.def).health;
            this.say(perfect ? 'PERFECT' : `${getFighter(w.def).name} WINS`, 'win', 1700);
          }
          break;
        }
        case 'card': {
          const f = s.fighters[e.p];
          const card = getCard(f.def, e.card);
          if (card.category === 'signature') break;
          const b = this.sides[e.p].banner;
          b.innerHTML = `<span class="cb-cat cat-${card.category}">${CAT_LABEL[card.category]}</span><span class="cb-name">${card.name}</span>`;
          b.className = `card-banner p${e.p + 1}`;
          void b.offsetWidth;
          b.className = `card-banner p${e.p + 1} show`;
          break;
        }
        case 'superFlash': {
          const f = s.fighters[e.p];
          const card = e.card ? getCard(f.def, e.card) : null;
          this.superCard.innerHTML = `<div class="sc-inner"><div class="sc-cat">SIGNATURE</div><div class="sc-name">${card?.name ?? ''}</div><div class="sc-who">${getFighter(f.def).name}</div></div>`;
          this.superCard.className = `super-card p${e.p + 1}`;
          this.superCard.style.setProperty('--accent', this.sides[e.p].root.style.getPropertyValue('--accent'));
          void this.superCard.offsetWidth;
          this.superCard.className = `super-card p${e.p + 1} show`;
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
          const el = this.sides[e.p].root.querySelector('.hype')!;
          el.classList.remove('deny');
          void (el as HTMLElement).offsetWidth;
          el.classList.add('deny');
          break;
        }
        default:
          break;
      }
    }
  }

  update(s: GameState, dt: number, screenFlash: number): void {
    this.time += dt;
    s.fighters.forEach((f, i) => {
      const side = this.sides[i];
      const max = getFighter(f.def).health;
      const hp = f.health / max;
      if (f.health !== side.lastHp) {
        side.fill.style.transform = `scaleX(${hp})`;
        side.root.classList.toggle('danger', hp < 0.25);
        side.lastHp = f.health;
      }
      const opp = s.fighters[1 - i];
      const inCombo = f.state === 'hitstun' || f.state === 'juggle' || f.state === 'thrown' || f.state === 'cineDef';
      if (!inCombo) side.drainV = Math.max(hp, side.drainV - dt * 0.6);
      if (side.drainV < hp) side.drainV = hp;
      side.drain.style.transform = `scaleX(${side.drainV})`;
      side.pips.forEach((p, k) => p.classList.toggle('won', k < f.roundsWon));
      if (f.meter !== side.lastMeter) {
        side.lastMeter = f.meter;
        for (let k = 0; k < 3; k++) {
          const v = Math.max(0, Math.min(1, (f.meter - k * 100) / 100));
          side.hypeFill[k].style.transform = `scaleX(${v})`;
          side.hypeFill[k].parentElement!.classList.toggle('full', v >= 1);
        }
        side.hypeN.textContent = String(Math.floor(f.meter / 100));
        side.root.classList.toggle('maxhype', f.meter >= RULES.METER_MAX && !s.config.training);
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
        atkSide.comboD.textContent = `${f.comboDamage} DMG`;
        atkSide.comboShownUntil = this.time + 1.1;
      } else if (this.time > atkSide.comboShownUntil) {
        atkSide.combo.classList.remove('show');
        atkSide.lastCombo = 0;
      }
      void opp;
    });
    const secs = s.config.training ? -1 : Math.ceil(s.timer / 60);
    if (secs !== this.lastTimer) {
      this.timer.textContent = secs < 0 ? '∞' : String(Math.max(0, secs));
      this.timer.classList.toggle('low', secs >= 0 && secs <= 10);
      this.lastTimer = secs;
    }
    this.flash.style.opacity = String(Math.min(0.85, screenFlash));
  }
}
