// In-fight HUD (DOM overlay): avatars, health, crowns, timer, combo counter, announcer,
// the local player's card hand + Hype bar (with a prominent Signature card), card banners,
// cinematic letterbox and screen flash.
import type { SimEvent } from '../core/events';
import { IN } from '../core/input';
import { getCard, getFighter } from '../core/registry';
import type { GameState } from '../core/state';
import { beatDistance, RULES, showcaseOf } from '../core/sim';
import { TAUNT_AT, TAUNTS, TITLE_AT } from '../render/fatalities';
import { CAT_COLOR, cardIcon, costBadge, UI_ICONS } from './icons';
import { portrait } from './portraits';
import { HUD_ART, HUD_BOXES } from './menu/hudArt';
import { fitTexts, pos, safeInsets, text } from './menu/kit';
import './hudm.css';
import './v2/hud2.css';
import { isV2 } from './design';

interface Side {
  root: HTMLElement;
  fill: HTMLElement;
  drain: HTMLElement;
  pills: HTMLElement[];
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

/** Native text box content (.mm-t: the inner <i> carries the outline copy in data-t). */
function setT(el: HTMLElement, t: string): void {
  const i = (el.firstElementChild as HTMLElement | null) ?? el;
  if (i.textContent === t) return;
  i.textContent = t;
  i.dataset.t = t;
}

// ------------------------------------------------------------------------------------------- master HUD (D38)
type HudArt = keyof typeof HUD_ART;
const HB = HUD_BOXES;
const art = (id: HudArt, ox: number, oy: number, cls = '') => {
  const a = HUD_ART[id];
  return `<img class="hm-art ${cls}" alt="" draggable="false" src="${a.src}" style="${pos(a.x - ox, a.y - oy, a.w, a.h)}">`;
};
/** Value clip over a fill strip: the strip keeps its pixels, the clip shows `--p` of it from the anchored end. */
const clip = (id: HudArt, ox: number, oy: number, right: boolean, cls = '') => {
  const a = HUD_ART[id];
  return `<span class="hm-clip ${right ? 'r' : ''} ${cls}" style="${pos(a.x - ox, a.y - oy, a.w, a.h)};--p:1"><img alt="" draggable="false" src="${a.src}"></span>`;
};
/** Group boxes (reference px) of the master HUD. */
const HG = {
  p1: [HUD_ART.p1.x, HUD_ART.p1.y, HUD_ART.p1.x + HUD_ART.p1.w, HUD_ART.p1.y + HUD_ART.p1.h],
  p2: [HUD_ART.p2.x, HUD_ART.p2.y, HUD_ART.p2.x + HUD_ART.p2.w, HUD_ART.p2.y + HUD_ART.p2.h],
  mid: [HUD_ART.timer.x, HUD_ART.timer.y, HUD_ART.timer.x + HUD_ART.timer.w, HUD_ART.pause.y + HUD_ART.pause.h],
  hand: [HUD_ART.card0.x, HUD_ART.card2.y, HUD_ART.hype.x + HUD_ART.hype.w, HUD_ART.hype.y + HUD_ART.hype.h],
  info: [HUD_ART.info.x, HUD_ART.info.y, HUD_ART.info.x + HUD_ART.info.w, HUD_ART.info.y + HUD_ART.info.h],
} as const;
type HGroup = keyof typeof HG;
const gStyle = (g: HGroup) => `--w:${HG[g][2] - HG[g][0]};--h:${HG[g][3] - HG[g][1]}`;

function sideHtml(cls: 'p1' | 'p2'): string {
  const [ox, oy] = HG[cls];
  const r = cls === 'p2';
  const pb = HB[`${cls}_portrait`];
  const nb = HB[`${cls}_name`];
  const hb = HB[`${cls}_num`];
  const crownX = r ? nb[0] - 150 : nb[2] + 18;
  return `<div class="hm-g hm-side ${cls}" data-hg="${cls}" style="${gStyle(cls)}">
      <span class="hm-avatar" style="${pos(pb[0] - ox, pb[1] - oy, pb[2] - pb[0], pb[3] - pb[1])}"></span>
      ${clip(`${cls}_hp`, ox, oy, r, 'hm-drain')}${clip(`${cls}_hp`, ox, oy, r, 'hm-fill')}
      ${[0, 1, 2].map((k) => clip(`${cls}_pill${k}` as HudArt, ox, oy, false, 'pill')).join('')}
      ${art(cls, ox, oy, 'frame')}
      ${text('', [nb[0] + (r ? 0 : 6), nb[1] + 4, nb[2] - (r ? 6 : 0), nb[3] - 4], ox, oy, { cls: 'hm-name', fs: 40, align: r ? 'right' : 'left' })}
      ${text('', [hb[0], hb[1] + 2, hb[2], hb[3] - 2], ox, oy, { cls: 'hm-hp', fs: 40, align: 'center' })}
      <span class="hm-crowns" style="${pos(crownX - ox, nb[1] + 8 - oy, 132, 40)}"></span>
    </div>`;
}

function handHtml(): string {
  const [ox, oy] = HG.hand;
  const cards = [0, 1, 2]
    .map((i) => {
      const b = HB[`card${i}` as 'card0'];
      const a = HUD_ART[`card${i}` as HudArt];
      const [ax0, ay0, ax1, ay1] = b.art;
      return `<div class="hcard ${i === 2 ? 'sig' : ''}" data-slot="${i}" style="${pos(a.x - ox, a.y - oy, a.w, a.h)}">
        <span class="slotart" style="${pos(ax0 - a.x, ay0 - a.y, ax1 - ax0, ay1 - ay0)}"></span>
        <span class="fillmask" style="${pos(ax0 - a.x, ay0 - a.y, ax1 - ax0, ay1 - ay0)}"></span>
        ${art(`card${i}` as HudArt, a.x, a.y, 'frame')}
        ${text('', [b.cost[0] + 16, b.cost[1] + 16, b.cost[2] + 8, b.cost[3] + 14], a.x, a.y, { cls: 'hm-cost', fs: 50, align: 'center' })}
        ${text('', [b.name[0], b.name[1], b.name[2], b.name[3]], a.x, a.y, { cls: 'hm-cname', fs: 26 })}
        ${text(SLOT_KEYS[i], [b.key[0], b.key[1], b.key[2], b.key[3]], a.x, a.y, { cls: 'hm-key', fs: 44, align: 'center' })}
      </div>`;
    })
    .join('');
  const hl = HB.hypeLabel;
  const h = HUD_ART.hype;
  return `<div class="hm-g hand hm-hand" data-hg="hand" style="${gStyle('hand')}">
      ${cards}
      <div class="hm-hypebar" style="${pos(h.x - ox, h.y - oy, h.w, h.h)}">
        ${clip('hype_fill', h.x, h.y, false, 'hfill')}
        ${art('hype', h.x, h.y, 'frame')}
        ${text('HYPE', [hl[0], hl[1], hl[2], hl[3]], h.x, h.y, { cls: 'hm-hype', fs: 46, align: 'center' })}
        ${text('0', [h.x + 64, h.y + 58, h.x + 112, h.y + 100], h.x, h.y, { cls: 'hm-hypen', fs: 32, align: 'center' })}
        ${text('HALTEN = AUFLADEN', [h.x + 140, h.y + 30, h.x + 560, h.y + 80], h.x, h.y, { cls: 'hm-chargehint', fs: 26, align: 'center' })}
      </div>
    </div>`;
}

function midHtml(): string {
  const [ox, oy] = HG.mid;
  const tb = HB.timerText;
  const p = HUD_ART.pause;
  return `<div class="hm-g clock-g" data-hg="mid" style="${gStyle('mid')}">
      <div class="hm-clock" style="${pos(HUD_ART.timer.x - ox, HUD_ART.timer.y - oy, HUD_ART.timer.w, HUD_ART.timer.h)}">
        <div class="hm-ring"></div>${art('timer', HUD_ART.timer.x, HUD_ART.timer.y, 'frame')}
        ${text('99', [tb[0] - 20, tb[1] - 10, tb[2] + 20, tb[3] + 6], HUD_ART.timer.x, HUD_ART.timer.y, { cls: 'hm-timer', fs: 74, align: 'center' })}
        <div class="hm-beatpop">BEAT!</div>
      </div>
      <button class="pause-btn hm-pause" aria-label="Pause" style="${pos(p.x - ox, p.y - oy, p.w, p.h)}">${art('pause', p.x, p.y)}</button>
    </div>`;
}

function infoHtml(): string {
  const [ox, oy] = HG.info;
  const [l, v] = HB.infoText;
  return `<div class="hm-g info-g" data-hg="info" style="${gStyle('info')}">${art('info', ox, oy)}
      <div class="training-info" style="${pos(l[0] - ox, l[1] - oy, v[2] - l[0], v[3] - l[1])}"></div></div>`;
}

/** Card markup shared by HUD and menus. */
export function cardHtml(fighter: string, id: string, cls = ''): string {
  const c = getCard(fighter, id);
  const sig = c.category === 'signature';
  // painted card art (assets/cards/<id>.webp) wins when the file exists, else the in-engine render of the move
  const art = portrait(fighter, `art:${c.id}`);
  const bg = `url('assets/cards/${c.id}.webp')${art ? `, url('${art}')` : ''}`;
  return `<div class="card ${sig ? 'sig' : ''} ${art ? 'has-art' : ''} ${cls}" style="--c:${CAT_COLOR[c.category]}">${c.cost ? costBadge(c.cost) : ''}<div class="art">${cardIcon(
    c.id,
    c.category,
  )}<div class="cardimg" style="background-image:${bg}"></div></div><div class="nm">${c.name}</div></div>`;
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
  /** The Hype bar: hold to charge ("Aufladen"). */
  readonly chargeEl: HTMLElement;
  readonly trainingInfo: HTMLElement;
  /** The three hand cards (S1, S2, S3) — TouchControls binds them as buttons. */
  readonly handCards: HTMLElement[] = [];
  onSigReady: (() => void) | null = null;
  private tweens: Tween[] = [];
  private clock!: HTMLElement;
  private ring!: HTMLElement;
  private beatPop!: HTMLElement;
  private duelUi!: HTMLElement;
  private duelBars: HTMLElement[] = [];
  private finishSub!: HTMLElement;
  private finishMine = false;
  private qteKeys!: HTMLElement;
  private qteBar!: HTMLElement;
  private fatalTitle!: HTMLElement;
  private showUi!: HTMLElement;
  /** Tap target that skips the fighter showcase (bound to a Light press by the touch source). */
  get skipEl(): HTMLElement {
    return this.showUi;
  }
  private showWho = -1;
  private tauntEl!: HTMLElement;
  private touch = false;
  /** Screen position of a fighter's chest (set by the app from the view). */
  screenOf: ((i: number) => { x: number; y: number } | null) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud hm';
    this.root.innerHTML = `
      ${sideHtml('p1')}${midHtml()}${sideHtml('p2')}
      <div class="duel-ui"><div class="duel-title">MIC-DUELL!</div><div class="duel-sub">TIPPEN! TIPPEN! TIPPEN!</div>
        <div class="duel-bars"><div class="dbar p1"><b></b><span>0</span></div><div class="duel-mic"><svg viewBox="0 0 40 64" aria-hidden="true"><rect x="13" y="30" width="14" height="30" rx="6" fill="#2b2140" stroke="#1a0f2e" stroke-width="4"/><circle cx="20" cy="18" r="15" fill="#d9d4ea" stroke="#1a0f2e" stroke-width="4"/><path d="M9 15q11-8 22 0M8 22q12-7 24 0" stroke="#1a0f2e" stroke-width="2.5" fill="none" opacity="0.5"/><rect x="11" y="30" width="18" height="6" rx="2" fill="#ffc531" stroke="#1a0f2e" stroke-width="3"/></svg></div><div class="dbar p2"><b></b><span>0</span></div></div></div>
      <div class="finish-ui"><div class="finish-title">FERTIGMACHEN!</div><div class="finish-sub"></div>
        <div class="qte"><div class="qte-keys"></div><div class="qte-bar"><i></i></div></div></div>
      <div class="fatal-title">FATALITY</div>
      <div class="show-ui"><div class="show-tag"></div><div class="show-name"></div><div class="show-sub"></div><div class="show-skip"></div></div>
      <div class="taunt"></div>
      <div class="combo p1"><div class="combo-n"></div><div class="combo-l">TREFFER</div><div class="combo-d"></div></div>
      <div class="combo p2"><div class="combo-n"></div><div class="combo-l">TREFFER</div><div class="combo-d"></div></div>
      <div class="card-banner p1"></div><div class="card-banner p2"></div>
      <div class="super-card"></div>
      ${handHtml()}
      <div class="sig-ready"></div>
      <div class="tip"></div>
      <div class="announce"></div>
      <div class="letterbox"><div class="lb lb-top"></div><div class="lb lb-bot"></div><div class="cine-title"></div></div>
      <div class="screen-flash"></div>
      ${infoHtml()}`;
    parent.appendChild(this.root);
    for (const cls of ['p1', 'p2']) {
      const r = this.root.querySelector<HTMLElement>(`[data-hg="${cls}"]`)!;
      const combo = this.root.querySelector<HTMLElement>(`.combo.${cls}`)!;
      this.sides.push({
        root: r,
        fill: r.querySelector('.hm-fill')!,
        drain: r.querySelector('.hm-drain')!,
        hp: r.querySelector('.hm-hp')!,
        name: r.querySelector('.hm-name')!,
        avatar: r.querySelector('.hm-avatar')!,
        crowns: r.querySelector('.hm-crowns')!,
        hypeFill: [],
        pills: [...r.querySelectorAll<HTMLElement>('.hm-clip.pill')],
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
    this.timer = this.root.querySelector('.hm-timer')!;
    this.announce = this.root.querySelector('.announce')!;
    this.letterbox = this.root.querySelector('.letterbox')!;
    this.cineTitle = this.root.querySelector('.cine-title')!;
    this.flash = this.root.querySelector('.screen-flash')!;
    this.superCard = this.root.querySelector('.super-card')!;
    this.hand = this.root.querySelector('.hand')!;
    this.hypebar = this.root.querySelector('.hm-hypebar')!;
    this.chargeEl = this.hypebar;
    this.hypeFill = [this.hypebar.querySelector<HTMLElement>('.hfill')!];
    this.hypeN = this.hypebar.querySelector<HTMLElement>('.hm-hypen > i')!;
    this.sigReady = this.root.querySelector('.sig-ready')!;
    this.tip = this.root.querySelector('.tip')!;
    this.handCards.push(...this.root.querySelectorAll<HTMLElement>('.hcard'));
    this.pauseBtn = this.root.querySelector('.pause-btn')!;
    this.clock = this.root.querySelector('.hm-clock')!;
    this.ring = this.root.querySelector('.hm-ring')!;
    this.beatPop = this.root.querySelector('.hm-beatpop')!;
    this.duelUi = this.root.querySelector('.duel-ui')!;
    this.duelBars = [...this.root.querySelectorAll<HTMLElement>('.dbar')];
    this.finishSub = this.root.querySelector('.finish-sub')!;
    this.qteKeys = this.root.querySelector('.qte-keys')!;
    this.qteBar = this.root.querySelector('.qte-bar i')!;
    this.fatalTitle = this.root.querySelector('.fatal-title')!;
    this.tauntEl = this.root.querySelector('.taunt')!;
    this.showUi = this.root.querySelector('.show-ui')!;
    this.trainingInfo = this.root.querySelector('.training-info')!;
    new ResizeObserver(() => this.layout()).observe(this.root);
  }

  /** Master HUD layout: groups at their master positions, top bar anchored to the top corners and centre, the hand at
   *  the bottom centre (smaller on phones so the fighters stay visible), all inside the safe area. */
  layout(): void {
    const W = this.root.clientWidth;
    const H = this.root.clientHeight;
    if (!W || !H) return;
    const ins = safeInsets(this.root);
    const base = Math.min((W - ins.l - ins.r) / 2000, (H - ins.t - ins.b) / 1125);
    const phone = H < 560;
    const top = base * (phone ? 0.92 : 0.8);
    const hand = base * (phone ? 0.72 : 0.7);
    const set = (g: HGroup, u: number, x: number, y: number) => {
      const el = this.root.querySelector<HTMLElement>(`[data-hg="${g}"]`);
      if (!el) return;
      el.style.setProperty('--u', `${u}px`);
      el.style.transform = `translate(${x}px, ${y}px)`;
    };
    const gw = (g: HGroup) => HG[g][2] - HG[g][0];
    const gh = (g: HGroup) => HG[g][3] - HG[g][1];
    const ty = ins.t + 8 * top;
    // the two sides may not overlap the clock: shrink the top bar on narrow screens
    const need = gw('p1') + gw('mid') + gw('p2') + 40;
    const u = Math.min(top, (W - ins.l - ins.r - 12) / need);
    set('p1', u, ins.l + 6 * u, ty);
    set('p2', u, W - ins.r - 6 * u - gw('p2') * u, ty);
    set('mid', u, W / 2 - (gw('mid') * u) / 2, ty);
    set('hand', hand, W / 2 - (gw('hand') * hand) / 2, H - ins.b - gh('hand') * hand - 6 * hand);
    set('info', u, ins.l + 6 * u, ty + (gh('p1') + 20) * u);
    this.root.style.setProperty('--u', `${u}px`);
    fitTexts(this.root);
  }

  /** @param local index of the fighter whose hand is shown; @param touch hand cards are tappable buttons */
  setup(s: GameState, local: number, touch: boolean): void {
    this.local = local;
    this.touch = touch;
    this.lastLocalMeter = -1;
    this.root.classList.remove('duel', 'finish', 'fatal');
    this.root.classList.toggle('v2h', isV2()); // D43: the v2 HUD skin (hud2.css)
    this.root.classList.remove('v2-off');
    this.tauntEl.classList.remove('show');
    this.fatalTitle.classList.remove('show');
    s.fighters.forEach((f, i) => {
      const side = this.sides[i];
      setT(side.name, getFighter(f.def).name.toUpperCase());
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
      el.style.display = id ? '' : 'none';
      if (!id) return;
      const c = getCard(me.def, id);
      const a = portrait(me.def, `art:${c.id}`);
      el.querySelector<HTMLElement>('.slotart')!.style.backgroundImage = `url('assets/cards/${c.id}.webp')${a ? `, url('${a}')` : ''}`;
      setT(el.querySelector<HTMLElement>('.hm-cost')!, String(Math.round(c.cost / 100)));
      setT(el.querySelector<HTMLElement>('.hm-cname')!, c.name.toUpperCase());
      setT(el.querySelector<HTMLElement>('.hm-key')!, touch ? '' : SLOT_KEYS[i]);
    });
    this.layout();
    this.hand.classList.toggle('tap', touch);
    setT(this.hypebar.querySelector<HTMLElement>('.hm-chargehint')!, touch ? 'HALTEN = AUFLADEN' : 'C HALTEN = AUFLADEN');
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
          this.say(s.config.training ? 'TRAINING' : 'KÄMPFT!', 'fight', 900);
          break;
        case 'perfectBlock':
          this.say('PERFEKT-BLOCK!', 'pblock', 900);
          break;
        case 'hit':
          if (e.beat) {
            this.beatPop.classList.remove('go');
            void this.beatPop.offsetWidth;
            this.beatPop.classList.add('go');
            if (e.strength >= 2) this.say('BEAT-DROP!', 'beat', 700);
          }
          break;
        case 'wallSplat':
          this.say(e.ko ? 'WAND-FINISHER!' : 'WAND-SPLAT!', 'splat', 1000);
          break;
        case 'duelStart':
          this.duelBars.forEach((b) => ((b.querySelector('span') as HTMLElement).textContent = '0'));
          break;
        case 'duelEnd':
          if (e.winner < 0) this.say('PATT!', 'duel', 900);
          else this.say(`${getFighter(s.fighters[e.winner].def).name} GEWINNT DAS DUELL`, 'duelwin', 1300);
          break;
        case 'finishHim': {
          const mine = e.winner === this.local;
          this.finishMine = mine;
          this.finishSub.innerHTML = mine
            ? `Geh ran und spiel die <b>★ FATALITY-KARTE</b> ${this.touch ? '(goldene Karte)' : '(O)'}`
            : `${getFighter(s.fighters[e.winner].def).name} darf dich fertigmachen …`;
          break;
        }
        case 'fatalQte': {
          const label = (b: number) => (b === IN.LIGHT ? 'L' : b === IN.HEAVY ? 'H' : this.touch ? 'GRIFF' : 'G');
          const keyOf = (b: number) => (this.touch ? label(b) : b === IN.LIGHT ? 'J' : b === IN.HEAVY ? 'K' : 'L');
          this.qteKeys.innerHTML = e.seq.map((b) => `<span class="k ${b === IN.LIGHT ? 'l' : b === IN.HEAVY ? 'h' : 'g'}">${keyOf(b)}</span>`).join('');
          this.finishSub.innerHTML = this.finishMine ? 'Drück die Tasten der Reihe nach!' : 'Fatality-Minispiel …';
          break;
        }
        case 'fatalStep': {
          const k = this.qteKeys.children[e.i] as HTMLElement | undefined;
          k?.classList.add(e.ok ? 'ok' : 'bad');
          if (!e.ok) this.finishSub.innerHTML = 'Daneben – kein Finisher!';
          break;
        }
        case 'fatality':
          this.letterbox.classList.add('on');
          this.cineTitle.textContent = '';
          break;
        case 'fatalityEnd':
          this.letterbox.classList.remove('on');
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
          // the card whose move starts this cinematic (Krokodil-Attacke is a special), else the Signature
          const cards = owner.loadout.map((id) => getCard(owner.def, id));
          const card = cards.find((c) => c.move === e.id) ?? cards.find((c) => c.category === 'signature');
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
        side.fill.style.setProperty('--p', hp.toFixed(4));
        setT(side.hp, String(f.health));
        side.root.classList.toggle('danger', hp < 0.25);
        side.lastHp = f.health;
      }
      const inCombo = f.state === 'hitstun' || f.state === 'juggle' || f.state === 'thrown' || f.state === 'cineDef';
      if (!inCombo) side.drainV = Math.max(hp, side.drainV - dt * 0.6);
      if (side.drainV < hp) side.drainV = hp;
      side.drain.style.setProperty('--p', side.drainV.toFixed(4));
      if (f.roundsWon !== side.lastRounds) {
        side.lastRounds = f.roundsWon;
        side.crowns.querySelectorAll('i').forEach((c, k) => c.classList.toggle('won', k < f.roundsWon));
      }
      if (f.meter !== side.lastMeter) {
        side.lastMeter = f.meter;
        for (let k = 0; k < 3; k++) {
          const v = Math.max(0, Math.min(1, (f.meter - k * 100) / 100));
          side.pills[k].style.setProperty('--p', v.toFixed(3));
          side.pills[k].classList.toggle('full', v >= 1);
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
      setT(this.timer, secs < 0 ? '∞' : String(Math.max(0, secs)));
      this.clock.classList.toggle('low', secs >= 0 && secs <= 10);
      this.lastTimer = secs;
    }
    this.flash.style.opacity = String(Math.min(0.85, screenFlash));
    this.updateShowcase(s);
    this.updateMechanics(s);
  }

  /** Round 1 fighter showcase: letterbox, the fighter's name slammed in on their side, skip hint. */
  private updateShowcase(s: GameState): void {
    const sc = showcaseOf(s);
    const who = sc ? sc.who : -1;
    if (who !== this.showWho) {
      this.showWho = who;
      this.root.classList.toggle('showcase', who >= 0);
      this.letterbox.classList.toggle('on', who >= 0);
      this.showUi.classList.remove('in', 'p1', 'p2', 'out');
      if (who >= 0) {
        const f = s.fighters[who];
        const def = getFighter(f.def);
        this.cineTitle.textContent = '';
        this.showUi.classList.add(who === 0 ? 'p1' : 'p2');
        (this.showUi.querySelector('.show-tag') as HTMLElement).textContent = who === 0 ? 'SPIELER 1' : 'SPIELER 2';
        const name = this.showUi.querySelector('.show-name') as HTMLElement;
        name.innerHTML = `<i data-t="${def.name}">${def.name}</i>`;
        (this.showUi.querySelector('.show-sub') as HTMLElement).textContent = def.tagline;
        (this.showUi.querySelector('.show-skip') as HTMLElement).textContent = this.touch ? 'TIPPEN ZUM ÜBERSPRINGEN' : 'TASTE ZUM ÜBERSPRINGEN';
      }
    }
    if (sc) {
      this.showUi.classList.toggle('in', sc.f >= 16);
      this.showUi.classList.toggle('out', sc.f >= RULES.SHOWCASE_EACH - 8);
    }
  }

  /** Beat ring on the clock, Mic-Duell tap bars, finish prompt, fatality title and the winner's taunt. */
  private updateMechanics(s: GameState): void {
    // beat ring: flashes on every beat of the sim's beat clock (the music follows it)
    const ph = s.frame % RULES.BEAT_FRAMES;
    const pulse = Math.pow(1 - ph / RULES.BEAT_FRAMES, 3);
    this.ring.style.transform = `scale(${(1 + pulse * 0.22).toFixed(3)})`;
    this.ring.style.opacity = (0.35 + pulse * 0.65).toFixed(2);
    this.clock.classList.toggle('onbeat', beatDistance(s.frame) <= RULES.BEAT_WINDOW && s.phase === 'fight');
    // Mic-Duell
    const d = s.duel;
    this.root.classList.toggle('duel', !!d);
    if (d) {
      const total = Math.max(1, d.taps[0] + d.taps[1]);
      this.duelBars.forEach((b, i) => {
        (b.querySelector('b') as HTMLElement).style.transform = `scaleX(${(d.taps[i] / total).toFixed(3)})`;
        const n = b.querySelector('span') as HTMLElement;
        if (n.textContent !== String(d.taps[i])) {
          n.textContent = String(d.taps[i]);
          b.classList.remove('tap');
          void b.offsetWidth;
          b.classList.add('tap');
        }
      });
      const left = Math.max(0, Math.ceil((RULES.DUEL_FRAMES - d.frame) / 60));
      (this.duelUi.querySelector('.duel-title') as HTMLElement).textContent = `MIC-DUELL! ${left}`;
    }
    // finish phase / fatality: range hint, then the minigame
    this.root.classList.toggle('finish', s.phase === 'finish' && !s.fatal);
    const q = s.fatalQte;
    this.root.classList.toggle('qte', !!q);
    if (q) {
      const total = q.i === 0 ? RULES.FATAL_QTE_FRAMES + 20 : RULES.FATAL_QTE_FRAMES;
      this.qteBar.style.transform = `scaleX(${Math.max(0, q.t / total).toFixed(3)})`;
      [...this.qteKeys.children].forEach((k, i) => k.classList.toggle('cur', i === q.i));
    } else if (s.phase === 'finish' && !s.fatal) {
      this.qteKeys.innerHTML = '';
      const w = s.fighters[s.roundWinner];
      const l = s.fighters[1 - s.roundWinner];
      this.root.classList.toggle('inrange', Math.abs(w.x - l.x) <= RULES.FATAL_RANGE);
    }
    const fatal = s.fatal;
    this.root.classList.toggle('fatal', !!fatal);
    this.fatalTitle.classList.toggle('show', !!fatal && fatal.frame >= TITLE_AT && fatal.frame < TAUNT_AT + 70);
    if (fatal && fatal.frame >= TAUNT_AT) {
      if (!this.tauntEl.classList.contains('show')) {
        const w = s.fighters[fatal.owner];
        const lines = TAUNTS[w.def] ?? ['Nächster!'];
        this.tauntEl.textContent = lines[(s.rng + s.round) % lines.length];
        this.tauntEl.classList.add('show');
      }
    } else this.tauntEl.classList.remove('show');
  }

  private updateHand(s: GameState): void {
    const me = s.fighters[this.local];
    this.hypebar.classList.toggle('charging', me.state === 'charge');
    if (me.meter === this.lastLocalMeter) return;
    const prev = this.lastLocalMeter;
    this.lastLocalMeter = me.meter;
    this.hypeFill[0].style.setProperty('--p', Math.max(0, Math.min(1, me.meter / 300)).toFixed(4));
    this.hypebar.classList.toggle('full', me.meter >= 300);
    this.hypeN.textContent = String(Math.floor(me.meter / 100));
    this.hypeN.dataset.t = this.hypeN.textContent;
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
        this.sigReady.dataset.shown = String(s.frame); // test hook: the banner fired (the tween is real-time, e2e may miss it)
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
