// Application flow: home (3D showcase), fighter select, deck, controls, matches, pause,
// results, online lobby. Owns the render loop. All player-facing text is German.
import '../content';
import { BOT_LEVELS, Bot } from '../ai/bot';
import type { SimEvent } from '../core/events';
import { IN } from '../core/input';
import { getCard, getFighter, getMove, SIGNATURE_SLOT, validateLoadout } from '../core/registry';
import { createMatch, defaultConfig } from '../core/sim';
import type { GameState } from '../core/state';
import { ROSTER } from '../content';
import { GamepadSource, KeyboardSource, MergedSource, NullSource, P1_KEYS, P2_KEYS, keyboardState, type InputSource, type KeyMap } from '../input/sources';
import { TouchControls } from '../input/touch';
import { GameView } from '../render/view';
import { installCinematics } from '../render/cinematics';
import { cardHtml, Hud } from '../ui/hud';
import { CAT_COLOR, CAT_DE, UI_ICONS } from '../ui/icons';
import { portrait, renderPortraits } from '../ui/portraits';
import { AudioEngine } from '../audio/audio';
import { MatchRunner } from './match';
import { NetMatchRunner, RtcTransport, runLobby, sameDeviceTransport, type LobbyResult } from '../net/online';
import type { Transport } from '../net/rollback';
import { TrainingMonitor } from './training';
import * as THREE from 'three';

type PlayMode = 'cpu' | 'local' | 'training';
type Mode = 'menu' | PlayMode | 'online';
type Level = keyof typeof BOT_LEVELS;

const LEVEL_DE: Record<Level, string> = { easy: 'LEICHT', normal: 'MITTEL', hard: 'SCHWER' };
const MODE_DE: Record<PlayMode, string> = { cpu: 'GEGEN CPU', local: '2 SPIELER', training: 'TRAINING' };
const LEVELS: Level[] = ['easy', 'normal', 'hard'];

/** Arrow keys also steer player 1 when the keyboard is not shared with a second player. */
const P1_ARROWS: KeyMap = { ArrowLeft: IN.LEFT, ArrowRight: IN.RIGHT, ArrowUp: IN.UP, ArrowDown: IN.DOWN };

interface Selection {
  fighters: [string, string];
  loadouts: [string[], string[]];
  level: Level;
  mode: PlayMode;
}

interface Stats {
  maxCombo: [number, number];
  damage: [number, number];
  specials: [number, number];
}

const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem('rapbrawl.' + k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown): void {
    try {
      localStorage.setItem('rapbrawl.' + k, JSON.stringify(v));
    } catch {
      /* storage unavailable */
    }
  },
};

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function fighterStats(id: string) {
  const d = getFighter(id);
  const keys = ['5L', '5H', '2H'] as const;
  const reach = Math.max(...keys.flatMap((k) => getMove(id, d.normals[k]).hits.flatMap((h) => h.boxes.map((b) => b.x1))));
  const dmg = keys.reduce((a, k) => a + getMove(id, d.normals[k]).hits.reduce((x, h) => x + h.damage, 0), 0);
  return { health: d.health, speed: d.walkF, reach, dmg };
}

export class App {
  readonly view: GameView;
  readonly hud: Hud;
  readonly touch: TouchControls;
  readonly audio = new AudioEngine();
  private ui: HTMLElement;
  private screen: HTMLElement | null = null;
  runner: MatchRunner | null = null;
  mode: Mode = 'menu';
  private last = performance.now();
  sel: Selection;
  private stats: Stats = { maxCombo: [0, 0], damage: [0, 0], specials: [0, 0] };
  private bots: Bot[] = [];
  private training: TrainingMonitor | null = null;
  private touchEnabled: boolean;
  private resultsShown = false;
  private playerName: string;
  private showAcc = 0;
  /** Which fighter this device controls (1 for an online guest). */
  localIdx = 0;
  private netTransport: Transport | null = null;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.ui = ui;
    this.view = new GameView(canvas);
    installCinematics(this.view, this.audio);
    this.hud = new Hud(ui);
    this.touch = new TouchControls(ui);
    this.touch.bindCards(this.hud.handCards);
    this.hud.onSigReady = () => this.audio.chime();
    const params = new URLSearchParams(location.search);
    this.touchEnabled =
      params.get('touch') === '1' || (params.get('touch') !== '0' && typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
    try {
      renderPortraits(ROSTER);
    } catch {
      /* portraits are optional */
    }
    this.playerName = store.get('name', 'Spieler');
    this.audio.setMuted(store.get('muted', false));
    const saved = store.get<Partial<Selection>>('selection', {});
    this.sel = {
      fighters: (saved.fighters as [string, string]) ?? [ROSTER[0], ROSTER[1] ?? ROSTER[0]],
      loadouts: (saved.loadouts as [string[], string[]]) ?? [[], []],
      level: saved.level && saved.level in BOT_LEVELS ? saved.level : 'normal',
      mode: saved.mode && saved.mode in MODE_DE ? saved.mode : 'cpu',
    };
    for (let i = 0; i < 2; i++) {
      if (!ROSTER.includes(this.sel.fighters[i])) this.sel.fighters[i] = ROSTER[i] ?? ROSTER[0];
      if (!this.sel.loadouts[i] || validateLoadout(this.sel.fighters[i], this.sel.loadouts[i]))
        this.sel.loadouts[i] = getFighter(this.sel.fighters[i]).defaultLoadout.slice();
    }
    this.hud.pauseBtn.addEventListener('click', () => this.togglePause());
    window.addEventListener('resize', () => this.view.resize());
    window.addEventListener('keydown', this.keyHandler);
    const rot = document.createElement('div');
    rot.className = 'rotate-hint';
    rot.innerHTML = `<div style="font-size:3rem">⟳</div>BITTE GERÄT QUER HALTEN`;
    ui.appendChild(rot);

    const quick = params.get('quick');
    const known = (id: string) => {
      try {
        getFighter(id);
        return true;
      } catch {
        return false;
      }
    };
    if (quick) {
      const [a, b] = quick.split(',');
      if (a && known(a)) this.sel.fighters[0] = a;
      if (b && known(b)) this.sel.fighters[1] = b;
      this.sel.loadouts = [getFighter(this.sel.fighters[0]).defaultLoadout.slice(), getFighter(this.sel.fighters[1]).defaultLoadout.slice()];
      const mode = (params.get('mode') as Mode | 'demo') ?? 'cpu';
      if (mode === 'demo') this.startDemo();
      else this.startMatch(mode === 'menu' ? 'cpu' : mode, false);
    } else {
      this.startShowcase();
      this.showTitle();
    }
    (window as unknown as { __rb: App }).__rb = this;
    requestAnimationFrame((t) => this.loop(t));
  }

  // ---------------------------------------------------------------- loop
  private loop(now: number): void {
    const elapsed = now - this.last;
    this.last = now;
    if (this.runner) {
      if (this.mode === 'menu') this.animateShowcase(elapsed);
      this.runner.tick(elapsed, this.audio.beat());
      const s = this.runner.state;
      if (this.mode !== 'menu' && !this.isDemo) {
        this.hud.update(s, elapsed / 1000, this.view.screenFlash);
        if (this.runner instanceof NetMatchRunner && this.runner.silence > 6 && !this.resultsShown) this.connectionLost();
        this.training?.update(s, this.runner.lastInputs);
        if (s.phase === 'matchOver' && s.phaseFrame > 90 && !this.resultsShown) this.showResults();
      }
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  private get isDemo(): boolean {
    return this.bots.length === 2 && this.bots.every((b) => b.demo);
  }

  // ------------------------------------------------------------ showcase
  private makeRunner(state: GameState, sources: [InputSource, InputSource]): MatchRunner {
    const r = new MatchRunner(state, this.view, sources);
    r.listeners.push({ onEvents: (s, ev) => this.onEvents(s, ev) });
    return r;
  }

  /** Home-screen hero: the selected fighter on the courtyard stage, cycling intro / idle / win poses. */
  private startShowcase(): void {
    this.leaveNet();
    this.mode = 'menu';
    this.bots = [];
    this.training = null;
    const a = this.sel.fighters[0];
    const b = ROSTER.find((x) => x !== a) ?? a;
    const state = createMatch(defaultConfig({ fighters: [a, b], training: true, seed: 7 }));
    state.phase = 'fight';
    const [f, o] = state.fighters;
    f.x = 0;
    f.facing = 1;
    f.state = 'intro';
    f.sf = 0;
    o.x = 90000;
    o.state = 'idle';
    this.runner = this.makeRunner(state, [new NullSource(), new NullSource()]);
    this.runner.paused = true;
    this.showAcc = 0;
    this.view.menuShot = {
      pos: new THREE.Vector3(1.4, 1.25, 4.9),
      target: new THREE.Vector3(1.0, 1.0, 0),
      fov: 32,
    };
    this.hud.show(false);
    this.touch.setVisible(false);
  }

  private animateShowcase(elapsedMs: number): void {
    const s = this.runner!.state;
    const f = s.fighters[0];
    this.showAcc += (Math.min(100, elapsedMs) * 60) / 1000;
    while (this.showAcc >= 1) {
      this.showAcc -= 1;
      f.sf++;
    }
    if (f.state === 'intro' && f.sf > 125) {
      f.state = 'idle';
      f.sf = 0;
    } else if (f.state === 'idle' && f.sf > 420) {
      f.state = 'win';
      f.sf = 0;
      s.phase = 'roundOver';
      s.roundWinner = 0;
    } else if (f.state === 'win' && f.sf > 260) {
      f.state = 'idle';
      f.sf = 0;
      s.phase = 'fight';
    }
  }

  /** Bot-vs-bot attract mode (dev/testing: ?quick=a,b&mode=demo). */
  private startDemo(): void {
    this.mode = 'cpu';
    const seed = (Math.random() * 1e9) | 0;
    const state = createMatch(defaultConfig({ fighters: [...this.sel.fighters], seed }));
    this.bots = [new Bot(BOT_LEVELS.hard, seed), new Bot(BOT_LEVELS.hard, seed + 1)];
    for (const b of this.bots) b.demo = true;
    this.runner = this.makeRunner(state, [this.bots[0], this.bots[1]]);
    this.view.menuShot = null;
    this.hud.show(false);
    this.touch.setVisible(false);
  }

  // ------------------------------------------------------------- matches
  startMatch(mode: PlayMode | 'online', splash = true): void {
    if (mode === 'online') return this.showOnlineLobby();
    this.leaveNet();
    this.localIdx = 0;
    this.mode = mode;
    this.resultsShown = false;
    store.set('selection', this.sel);
    const state = createMatch(
      defaultConfig({
        fighters: [...this.sel.fighters],
        loadouts: [this.sel.loadouts[0].slice(), this.sel.loadouts[1].slice()],
        training: mode === 'training',
        seed: (Math.random() * 1e9) | 0,
      }),
    );
    const p1: InputSource[] = [new KeyboardSource(P1_KEYS), new GamepadSource(0)];
    if (mode !== 'local') p1.push(new KeyboardSource(P1_ARROWS));
    if (this.touchEnabled) p1.push(this.touch);
    let p2: InputSource;
    this.bots = [];
    if (mode === 'local') p2 = new MergedSource([new KeyboardSource(P2_KEYS), new GamepadSource(1)]);
    else if (mode === 'training') {
      const dummy = new Bot(BOT_LEVELS[this.sel.level], 99);
      dummy.dummy = 'stand';
      this.bots = [dummy];
      p2 = dummy;
    } else {
      const bot = new Bot(BOT_LEVELS[this.sel.level], (Math.random() * 1e9) | 0);
      this.bots = [bot];
      p2 = bot;
    }
    this.view.menuShot = null;
    this.runner = this.makeRunner(state, [new MergedSource(p1), p2 ?? new NullSource()]);
    this.stats = { maxCombo: [0, 0], damage: [0, 0], specials: [0, 0] };
    this.hud.setup(state, 0, this.touchEnabled);
    this.hud.show(true);
    this.touch.setVisible(this.touchEnabled);
    this.training = mode === 'training' ? new TrainingMonitor(this.hud.trainingInfo) : null;
    this.closeScreen();
    this.audio.startMusic();
    if (splash && mode !== 'training') this.vsSplash(state);
  }

  private vsSplash(s: GameState): void {
    const el = document.createElement('div');
    el.className = 'vs';
    const side = (i: number) => {
      const id = s.fighters[i].def;
      const img = portrait(id, 'card');
      return `<div class="vside ${i ? 'r' : 'l'}">${img ? `<img alt="" src="${img}" style="${i ? 'transform:scaleX(-1)' : ''}">` : ''}<div class="vname">${getFighter(id).name}</div></div>`;
    };
    el.innerHTML = `${side(0)}<div class="vvs">VS</div>${side(1)}`;
    this.ui.appendChild(el);
    window.setTimeout(() => el.remove(), 1900);
  }

  private onEvents(s: GameState, ev: readonly SimEvent[]): void {
    const demo = this.mode === 'menu' || this.isDemo;
    this.audio.onEvents(s, ev, demo ? 0.35 : 1);
    if (demo) return;
    this.hud.onEvents(s, ev);
    this.training?.onEvents(s, ev);
    for (const e of ev) {
      if (e.t === 'hit' || e.t === 'cineHit') {
        const a = e.t === 'hit' ? e.a : s.cine ? s.cine.owner : 0;
        this.stats.damage[a] += e.damage;
        const d = s.fighters[1 - a];
        this.stats.maxCombo[a] = Math.max(this.stats.maxCombo[a], d.combo);
      }
      if (e.t === 'throwHit') this.stats.damage[e.a] += e.damage;
      if (e.t === 'card') this.stats.specials[e.p]++;
    }
  }

  togglePause(): void {
    if (!this.runner || this.mode === 'menu' || this.resultsShown) return;
    if (this.mode === 'online') {
      if (this.screen) this.closeScreen();
      else this.showOnlinePause();
      return;
    }
    if (this.runner.paused) {
      this.runner.paused = false;
      this.closeScreen();
      this.touch.setVisible(this.touchEnabled);
    } else {
      this.runner.paused = true;
      this.touch.setVisible(false);
      this.showPause();
    }
  }

  private onKey(e: KeyboardEvent): void {
    const inMatch = this.mode !== 'menu';
    if (this.screen) {
      if (e.code === 'Enter') {
        const def = this.screen.querySelector<HTMLButtonElement>('[data-default]:not(:disabled)');
        if (def && document.activeElement?.tagName !== 'BUTTON' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          def.click();
        }
      }
      if (e.code === 'Escape') {
        const back = this.screen.querySelector<HTMLButtonElement>('[data-back]');
        if (back) {
          back.click();
          return;
        }
      }
    }
    if (inMatch && (e.code === 'Escape' || e.code === 'KeyP')) this.togglePause();
    if (e.code === 'F1' || e.code === 'KeyH') {
      if (e.code === 'F1') e.preventDefault();
      if (e.code === 'F1' || this.mode === 'training') this.view.debug = !this.view.debug;
    }
    if (this.mode === 'training' && e.code === 'KeyR') this.startMatch('training', false);
    if (this.mode === 'training' && e.code === 'Period' && this.runner?.paused) this.runner.requestStep();
  }

  // ------------------------------------------------------------- screens
  private closeScreen(): void {
    this.screen?.remove();
    this.screen = null;
  }

  private open(html: string, cls = ''): HTMLElement {
    this.closeScreen();
    const el = document.createElement('div');
    el.className = `screen ${cls}`;
    el.innerHTML = html;
    this.ui.appendChild(el);
    this.screen = el;
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) this.audio.ui('click');
    });
    return el;
  }

  private header(title: string, extra = ''): string {
    return `<div class="header"><button class="btn icon" data-back aria-label="Zurück">${UI_ICONS.back}</button><div class="title">${title}</div><div class="grow"></div>${extra}</div>`;
  }

  showTitle(): void {
    const el = this.open(
      `<div class="logo">RAPBRAWL</div>
       <div class="logo-sub">HINTERHOF · BLOCK BEATS</div>
       <div class="press">${this.touchEnabled ? 'TIPPEN ZUM STARTEN' : 'KLICK ODER ENTER'}</div>
       <button data-default style="position:absolute;inset:0;opacity:0" aria-label="Start"></button>`,
      'splash',
    );
    el.querySelector('button')!.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.startMusic();
      this.showHome();
    });
  }

  private sideLabel(i: number): string {
    if (this.sel.mode === 'local') return `SPIELER ${i + 1}`;
    return i === 0 ? 'DU' : this.sel.mode === 'training' ? 'DUMMY' : 'CPU';
  }

  showHome(): void {
    if (this.mode !== 'menu') this.startShowcase();
    else if (this.runner && this.runner.state.fighters[0].def !== this.sel.fighters[0]) this.startShowcase();
    const fid = this.sel.fighters[0];
    const d = getFighter(fid);
    const deck = this.sel.loadouts[0].map((c) => cardHtml(fid, c, 'small')).join('');
    const sig = getCard(fid, this.sel.loadouts[0][SIGNATURE_SLOT]);
    const sub = this.sel.mode === 'cpu' ? `GEGEN CPU · ${LEVEL_DE[this.sel.level]}` : this.sel.mode === 'local' ? '2 SPIELER · EIN GERÄT' : 'TRAINING · DUMMY';
    const el = this.open(
      `<div class="topbar">
         <button class="player-chip" data-name><span class="avatar">${portrait(fid, 'bust') ? `<img alt="" src="${portrait(fid, 'bust')}">` : ''}</span>
           <span style="text-align:left"><div class="pname">${esc(this.playerName)}</div><div class="ptag">NAMEN ÄNDERN</div></span></button>
         <div class="spacer"></div>
         <button class="btn icon gray" data-sound aria-label="Ton">${this.audio.muted ? UI_ICONS.mute : UI_ICONS.sound}</button>
         <button class="btn icon" data-help aria-label="Steuerung">${UI_ICONS.help}</button>
       </div>
       <div class="home-main">
         <div class="logo home-logo">RAPBRAWL</div>
         <div class="hero-card panel">
           <div class="hero-name">${d.name}</div>
           <span class="pill hero-arch">${d.archetype.toUpperCase()}</span>
           <div class="hero-tag">${d.tagline}</div>
           <div class="row" style="justify-content:space-between;margin-top:0.2rem"><span class="disp" style="font-size:1.05rem">DEIN DECK</span><span class="pill" style="color:#ffe680">★ ${sig.name}</span></div>
           <div class="row" style="justify-content:space-between"><div class="mini-deck">${deck}</div><button class="btn small" data-deck>DECK</button></div>
         </div>
       </div>
       <div class="home-bottom">
         <div class="modes">
           <div class="tabs">${(Object.keys(MODE_DE) as PlayMode[]).map((m) => `<button class="tab ${this.sel.mode === m ? 'on' : ''}" data-mode="${m}">${MODE_DE[m]}</button>`).join('')}</div>
           ${this.sel.mode === 'cpu' ? `<button class="btn small gray" data-level>CPU: ${LEVEL_DE[this.sel.level]}</button>` : ''}
         </div>
         <button class="btn gold fight-btn" data-fight data-default>KAMPF!<span class="sub">${sub}</span></button>
       </div>
       <nav class="bottomnav">
         <button class="navbtn" data-nav="fighters">${UI_ICONS.fighter}KÄMPFER</button>
         <button class="navbtn" data-nav="deck">${UI_ICONS.cards}DECK</button>
         <button class="navbtn on" data-nav="fight">${UI_ICONS.swords}KAMPF</button>
         <button class="navbtn" data-nav="online">${UI_ICONS.online}ONLINE</button>
         <button class="navbtn" data-nav="help">${UI_ICONS.pad}STEUERUNG</button>
       </nav>`,
      'home',
    );
    el.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        this.sel.mode = b.dataset.mode as PlayMode;
        store.set('selection', this.sel);
        this.showHome();
      }),
    );
    el.querySelector('[data-level]')?.addEventListener('click', () => {
      this.sel.level = LEVELS[(LEVELS.indexOf(this.sel.level) + 1) % LEVELS.length];
      store.set('selection', this.sel);
      this.showHome();
    });
    el.querySelector('[data-fight]')!.addEventListener('click', () => this.startMatch(this.sel.mode));
    el.querySelector('[data-deck]')!.addEventListener('click', () => this.showDeck(0, () => this.showHome()));
    el.querySelector('[data-help]')!.addEventListener('click', () => this.showHelp(() => this.showHome()));
    el.querySelector('[data-sound]')!.addEventListener('click', () => {
      this.audio.setMuted(!this.audio.muted);
      store.set('muted', this.audio.muted);
      this.showHome();
    });
    el.querySelector('[data-name]')!.addEventListener('click', () => {
      const n = window.prompt('Dein Spielername', this.playerName);
      if (n && n.trim()) {
        this.playerName = n.trim().slice(0, 14);
        store.set('name', this.playerName);
        this.showHome();
      }
    });
    el.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((b) =>
      b.addEventListener('click', () => {
        const n = b.dataset.nav;
        if (n === 'fighters') this.showFighters(0);
        else if (n === 'deck') this.showDeck(0, () => this.showHome());
        else if (n === 'online') this.showOnlineLobby();
        else if (n === 'help') this.showHelp(() => this.showHome());
      }),
    );
  }

  showFighters(player: number): void {
    const all = ROSTER.map((id) => fighterStats(id));
    const max = (k: keyof ReturnType<typeof fighterStats>) => Math.max(...all.map((s) => s[k]));
    const cards = ROSTER.map((id, i) => {
      const d = getFighter(id);
      const st = all[i];
      const bar = (label: string, v: number) => `<div class="stat">${label}<i><b style="transform:scaleX(${Math.max(0.08, v).toFixed(3)})"></b></i></div>`;
      const img = portrait(id, 'card');
      const color = id === 'bonez' ? '#3a3f55' : '#3d8bff';
      return `<button class="fcard ${this.sel.fighters[player] === id ? 'sel' : ''}" data-f="${id}" style="--c:${color}">
        <div class="portrait">${img ? `<img alt="" src="${img}">` : ''}</div>
        <div class="fbanner">
          <div class="fname">${d.name}</div>
          <div class="farch">${d.archetype.toUpperCase()}</div>
          ${bar('LEBEN', st.health / max('health'))}
          ${bar('TEMPO', st.speed / max('speed'))}
          ${bar('REICHWEITE', st.reach / max('reach'))}
          ${bar('SCHADEN', st.dmg / max('dmg'))}
        </div>
        <span class="picked pill" style="background:#2fd06b">GEWÄHLT</span>
      </button>`;
    }).join('');
    const tabs = `<div class="tabs">${[0, 1].map((i) => `<button class="tab ${player === i ? `on ${i ? 'red' : ''}` : ''}" data-p="${i}">${this.sideLabel(i)}</button>`).join('')}</div>`;
    const el = this.open(
      `${this.header('KÄMPFER', tabs)}
       <div class="fighters">${cards}</div>
       <div class="row" style="justify-content:center;margin-top:0.8rem">
         <button class="btn" data-todeck>DECK ${player ? `(${this.sideLabel(1)})` : ''}</button>
         <button class="btn gold" data-ok data-default>FERTIG</button>
       </div>`,
    );
    el.querySelectorAll<HTMLButtonElement>('[data-f]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.f!;
        this.sel.fighters[player] = id;
        if (validateLoadout(id, this.sel.loadouts[player])) this.sel.loadouts[player] = getFighter(id).defaultLoadout.slice();
        store.set('selection', this.sel);
        el.querySelectorAll('.fcard').forEach((x) => x.classList.toggle('sel', x === b));
        if (player === 0) this.startShowcase();
      }),
    );
    el.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) => b.addEventListener('click', () => this.showFighters(Number(b.dataset.p))));
    el.querySelector('[data-back]')!.addEventListener('click', () => this.showHome());
    el.querySelector('[data-ok]')!.addEventListener('click', () => this.showHome());
    el.querySelector('[data-todeck]')!.addEventListener('click', () => this.showDeck(player, () => this.showFighters(player)));
  }

  showDeck(player: number, done: () => void, doneLabel = 'FERTIG'): void {
    const fid = this.sel.fighters[player];
    const def = getFighter(fid);
    const deck = this.sel.loadouts[player].slice();
    let focus: string | null = deck[0] ?? null;
    let placing = false;
    const tabs = `<div class="tabs">${[0, 1].map((i) => `<button class="tab ${player === i ? `on ${i ? 'red' : ''}` : ''}" data-p="${i}">${this.sideLabel(i)}</button>`).join('')}</div>`;
    const el = this.open(
      `${this.header(`DECK · ${def.name}`, tabs)}
       <div class="deck-wrap">
         <div class="deck-left">
           <div class="panel deck-slots"></div>
           <div class="panel collection"></div>
         </div>
         <div class="panel info"></div>
       </div>
       <div class="row" style="justify-content:center;margin-top:0.7rem">
         <span class="hint deck-err"></span>
         <button class="btn gold" data-ok data-default>${doneLabel}</button>
       </div>`,
    );
    const slotsEl = el.querySelector<HTMLElement>('.deck-slots')!;
    const collEl = el.querySelector<HTMLElement>('.collection')!;
    const infoEl = el.querySelector<HTMLElement>('.info')!;
    const errEl = el.querySelector<HTMLElement>('.deck-err')!;
    const ok = el.querySelector<HTMLButtonElement>('[data-ok]')!;
    const render = () => {
      slotsEl.innerHTML =
        `<div style="align-self:center;margin-right:0.4rem"><div class="disp" style="font-size:1.3rem">DEIN DECK</div><div class="hint" style="font-size:0.8rem">2 Specials + 1 Signature</div></div>` +
        deck
          .map(
            (id, i) =>
              `<button data-slot="${i}" style="display:flex;flex-direction:column;align-items:center">${cardHtml(fid, id, `big ${focus === id ? 'focus' : ''} ${placing && i !== SIGNATURE_SLOT ? 'wiggle' : ''}`)}<div class="slot-l">${
                i === SIGNATURE_SLOT ? '★ SIGNATURE · O' : `SPECIAL ${i + 1} · ${i ? 'I' : 'U'}`
              }</div></button>`,
          )
          .join('');
      const specials = def.cards.filter((c) => c.category !== 'signature');
      const sigs = def.cards.filter((c) => c.category === 'signature');
      collEl.innerHTML =
        `<div style="width:100%" class="disp">SAMMLUNG</div>` +
        [...specials, ...sigs]
          .map((c) => `<button data-card="${c.id}">${cardHtml(fid, c.id, `${focus === c.id ? 'focus' : ''} ${deck.includes(c.id) ? 'equipped' : ''}`)}</button>`)
          .join('');
      if (focus) {
        const c = getCard(fid, focus);
        const inDeck = deck.includes(c.id);
        const isSig = c.category === 'signature';
        infoEl.innerHTML = `<div class="row" style="flex-wrap:nowrap;align-items:flex-start">${cardHtml(fid, c.id)}<div style="display:flex;flex-direction:column;gap:0.35rem">
            <div class="iname">${c.name}</div><span class="pill icat" style="border-color:${CAT_COLOR[c.category]}">${CAT_DE[c.category].toUpperCase()}</span>
            <span class="pill" style="align-self:flex-start">HYPE-KOSTEN: ${c.cost / 100}</span></div></div>
          <div class="irole">${c.role}</div>
          <div class="idesc">${c.description}</div>
          ${
            isSig
              ? `<div class="hint">Signature-Karten liegen immer im goldenen Slot 3 (Taste O / goldene Karte). Trifft sie, startet die Kino-Sequenz.</div>`
              : inDeck
                ? `<div class="hint">Ist in deinem Deck.</div>`
                : `<button class="btn ${placing ? 'gray' : 'gold'}" data-use>${placing ? 'ABBRECHEN' : 'EINSETZEN'}</button>${placing ? '<div class="hint">Tippe oben auf die Karte, die ersetzt werden soll.</div>' : ''}`
          }`;
        infoEl.querySelector('[data-use]')?.addEventListener('click', () => {
          placing = !placing;
          render();
        });
      } else infoEl.innerHTML = `<div class="hint">Tippe auf eine Karte für Details.</div>`;
      const err = validateLoadout(fid, deck);
      errEl.textContent = err ?? '';
      ok.disabled = !!err;
      slotsEl.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((b) =>
        b.addEventListener('click', () => {
          const i = Number(b.dataset.slot);
          if (placing && focus && i !== SIGNATURE_SLOT) {
            deck[i] = focus;
            placing = false;
          } else focus = deck[i];
          render();
        }),
      );
      collEl.querySelectorAll<HTMLButtonElement>('[data-card]').forEach((b) =>
        b.addEventListener('click', () => {
          const id = b.dataset.card!;
          const c = getCard(fid, id);
          if (c.category === 'signature' && !deck.includes(id)) deck[SIGNATURE_SLOT] = id;
          focus = id;
          placing = false;
          render();
        }),
      );
    };
    render();
    const save = () => {
      if (!validateLoadout(fid, deck)) {
        this.sel.loadouts[player] = deck.slice();
        store.set('selection', this.sel);
      }
    };
    el.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) =>
      b.addEventListener('click', () => {
        save();
        this.showDeck(Number(b.dataset.p), done, doneLabel);
      }),
    );
    el.querySelector('[data-back]')!.addEventListener('click', () => {
      save();
      done();
    });
    ok.addEventListener('click', () => {
      save();
      done();
    });
  }

  showHelp(back: () => void): void {
    const el = this.open(
      `${this.header('STEUERUNG')}
       <div class="help-grid">
         <div class="panel">
           <h3>TASTATUR</h3>
           <div class="keys">
             <span><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd></span><span>Laufen · 2× tippen = Dash</span>
             <span><kbd>W</kbd> / <kbd>↑</kbd></span><span>Springen</span>
             <span><kbd>S</kbd> / <kbd>↓</kbd></span><span>Ducken (tiefe Angriffe)</span>
             <span><kbd>J</kbd> <kbd>K</kbd></span><span>Leicht · Schwer (mit ↓ = tief)</span>
             <span><kbd>L</kbd></span><span>Griff – schlägt Block</span>
             <span><kbd>Leertaste</kbd></span><span>Blocken (oder zurück halten)</span>
             <span><kbd>U</kbd> <kbd>I</kbd></span><span>Special-Karten 1 und 2</span>
             <span><kbd>O</kbd></span><span><b style="color:#ffd23a">★ SIGNATURE</b> – braucht volle Hype-Leiste (3)</span>
             <span><kbd>Esc</kbd></span><span>Pause</span>
           </div>
           <div class="hint" style="margin-top:0.6rem">2 Spieler: Spieler 2 nutzt Pfeile, <kbd>,</kbd><kbd>.</kbd><kbd>/</kbd> Angriffe, <kbd>⇧</kbd> rechts Block, <kbd>M</kbd><kbd>N</kbd><kbd>B</kbd> Karten. Gamepads werden erkannt.</div>
         </div>
         <div class="panel">
           <h3>TOUCH</h3>
           <div class="hint" style="color:#e6edff">Linke Bildschirmhälfte: Stick erscheint dort, wo du hintippst. Die gelben Punkte zeigen die erkannte Richtung. Schräg runter-zurück = tief blocken.</div>
           <div class="hint" style="color:#e6edff;margin-top:0.4rem">Rechts: <b>L</b> leicht · <b>H</b> schwer · <b>GRIFF</b> · <b>BLOCK</b>. Die Karten unten in der Mitte sind deine Specials – die <b style="color:#ffd23a">goldene Karte</b> ist die Signature.</div>
           <h3 style="margin-top:0.8rem">SO KÄMPFST DU</h3>
           <div class="hint" style="color:#e6edff">Hype lädt sich durch Treffen, Blocken und Einstecken auf. Specials kosten 1–2 Hype, die Signature 3. Leicht → Leicht → Schwer verketten; Treffer lassen sich in Specials abbrechen. Trifft die Signature, startet die Kino-Sequenz – geblockt oder verfehlt ist sie gefährlich.</div>
         </div>
       </div>
       <div class="row" style="justify-content:center;margin-top:0.7rem"><button class="btn gold" data-ok data-default>VERSTANDEN</button></div>`,
    );
    el.querySelector('[data-back]')!.addEventListener('click', back);
    el.querySelector('[data-ok]')!.addEventListener('click', back);
  }

  private showPause(): void {
    const training = this.mode === 'training';
    const dummyModes: [string, string][] = [
      ['stand', 'STEHEN'],
      ['crouch', 'DUCKEN'],
      ['blockAll', 'ALLES BLOCKEN'],
      ['block', 'BLOCKEN'],
      ['jump', 'SPRINGEN'],
      ['cpu', 'CPU'],
    ];
    const bot = this.bots[0];
    const el = this.open(
      `<div class="modal panel">
         <div class="mtitle">PAUSE</div>
         ${
           training
             ? `<div class="row" style="justify-content:center"><span class="hint">DUMMY</span>${dummyModes
                 .map(([k, n]) => `<button class="toggle ${bot?.dummy === k ? 'on' : ''}" data-d="${k}">${n}</button>`)
                 .join('')}</div>
                <div class="row" style="justify-content:center"><button class="toggle ${this.view.debug ? 'on' : ''}" data-hb>HITBOXEN</button></div>`
             : ''
         }
         <button class="btn gold" data-a="resume" data-default>WEITER</button>
         <button class="btn" data-a="restart">NEUSTART</button>
         <button class="btn" data-a="deck">DECK ÄNDERN</button>
         <button class="btn" data-a="help">STEUERUNG</button>
         <button class="btn red" data-a="quit" data-back>HAUPTMENÜ</button>
       </div>`,
      'dim',
    );
    el.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) =>
      b.addEventListener('click', () => {
        if (bot) bot.dummy = b.dataset.d as Bot['dummy'];
        el.querySelectorAll('[data-d]').forEach((x) => x.classList.toggle('on', x === b));
      }),
    );
    el.querySelector('[data-hb]')?.addEventListener('click', (e) => {
      this.view.debug = !this.view.debug;
      (e.currentTarget as HTMLElement).classList.toggle('on', this.view.debug);
    });
    el.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) =>
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const a = b.dataset.a;
        const mode = this.mode as PlayMode;
        if (a === 'resume') this.togglePause();
        else if (a === 'restart') this.startMatch(mode);
        else if (a === 'deck') this.showDeck(0, () => this.startMatch(mode), 'KAMPF!');
        else if (a === 'help') this.showHelp(() => this.showPause());
        else if (a === 'quit') this.quitToMenu();
      }),
    );
  }

  private quitToMenu(): void {
    this.leaveNet();
    this.localIdx = 0;
    this.startShowcase();
    this.showHome();
  }

  private showResults(): void {
    this.resultsShown = true;
    this.touch.setVisible(false);
    const s = this.runner!.state;
    const w = s.matchWinner;
    const me = this.localIdx;
    let banner: string;
    let cls = '';
    if (w === 2) {
      banner = 'UNENTSCHIEDEN';
      cls = 'draw';
    } else if (this.mode === 'local') banner = `SPIELER ${w + 1} GEWINNT`;
    else if (w === me) banner = 'SIEG!';
    else {
      banner = 'NIEDERLAGE';
      cls = 'lose';
    }
    const winner = w === 2 ? s.fighters[me] : s.fighters[w];
    const img = portrait(winner.def, 'card');
    const crowns = Array.from({ length: s.config.roundsToWin }, (_, k) => `<i class="${k < winner.roundsWon ? 'on' : ''}">${UI_ICONS.crown}</i>`).join('');
    const el = this.open(
      `<div class="result">
         <div class="result-banner ${cls}">${banner}</div>
         <div class="result-who">${img ? `<img alt="" src="${img}">` : ''}<div><div class="disp" style="font-size:2rem">${getFighter(winner.def).name}</div><div class="crowns">${crowns}</div></div></div>
         <div class="stats">
           <span class="pill">MAX. KOMBO <b>${this.stats.maxCombo[0]} : ${this.stats.maxCombo[1]}</b></span>
           <span class="pill">SCHADEN <b>${this.stats.damage[0]} : ${this.stats.damage[1]}</b></span>
           <span class="pill">KARTEN <b>${this.stats.specials[0]} : ${this.stats.specials[1]}</b></span>
         </div>
         <div class="row" style="justify-content:center;margin-top:0.4rem">
           ${this.mode === 'online' ? '' : '<button class="btn gold" data-a="rematch" data-default>NOCHMAL</button><button class="btn" data-a="deck">DECK</button>'}
           <button class="btn gray" data-a="menu">MENÜ</button>
         </div>
       </div>`,
      'dim',
    );
    el.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) =>
      b.addEventListener('click', () => {
        const a = b.dataset.a;
        const mode = this.mode as PlayMode;
        if (a === 'rematch') this.startMatch(mode);
        else if (a === 'deck') this.showDeck(0, () => this.startMatch(mode), 'KAMPF!');
        else this.quitToMenu();
      }),
    );
  }

  // -------------------------------------------------------------- online
  private leaveNet(): void {
    if (this.netTransport) {
      try {
        this.netTransport.send({ t: 'bye' });
      } catch {
        /* ignore */
      }
      this.netTransport.close?.();
      this.netTransport = null;
    }
  }

  private startOnline(res: LobbyResult, t: Transport): void {
    this.netTransport = t;
    this.mode = 'online';
    this.localIdx = res.local;
    this.resultsShown = false;
    const src: InputSource[] = [new KeyboardSource(P1_KEYS), new KeyboardSource(P1_ARROWS), new GamepadSource(0)];
    if (this.touchEnabled) src.push(this.touch);
    const r = new NetMatchRunner(res.cfg, this.view, res.local, new MergedSource(src), t);
    r.listeners.push({ onEvents: (s, ev) => this.onEvents(s, ev) });
    this.view.menuShot = null;
    this.runner = r;
    this.bots = [];
    this.stats = { maxCombo: [0, 0], damage: [0, 0], specials: [0, 0] };
    this.hud.setup(r.state, res.local, this.touchEnabled);
    this.hud.show(true);
    this.touch.setVisible(this.touchEnabled);
    this.training = null;
    this.closeScreen();
    this.audio.startMusic();
    this.vsSplash(r.state);
  }

  private connectionLost(): void {
    this.resultsShown = true;
    this.leaveNet();
    const el = this.open(
      `<div class="modal panel">
         <div class="mtitle">VERBINDUNG WEG</div>
         <div class="hint">Seit 6 Sekunden keine Daten vom anderen Spieler.</div>
         <button class="btn gold" data-a="menu" data-default>HAUPTMENÜ</button>
       </div>`,
      'dim',
    );
    el.querySelector('[data-a]')!.addEventListener('click', () => this.quitToMenu());
  }

  private showOnlinePause(): void {
    const el = this.open(
      `<div class="modal panel">
         <div class="mtitle">ONLINE-MATCH</div>
         <div class="hint">Das Match läuft weiter, während dieses Menü offen ist.</div>
         <button class="btn gold" data-a="resume" data-default>ZURÜCK ZUM KAMPF</button>
         <button class="btn red" data-a="quit">MATCH VERLASSEN</button>
       </div>`,
      'dim',
    );
    el.querySelector('[data-a="resume"]')!.addEventListener('click', () => this.closeScreen());
    el.querySelector('[data-a="quit"]')!.addEventListener('click', () => this.quitToMenu());
  }

  private onlineConfig(guest: { fighter: string; loadout: string[] }) {
    const gf = ROSTER.includes(guest.fighter) ? guest.fighter : ROSTER[0];
    const gl = validateLoadout(gf, guest.loadout) ? getFighter(gf).defaultLoadout.slice() : guest.loadout.slice();
    return defaultConfig({
      fighters: [this.sel.fighters[0], gf],
      loadouts: [this.sel.loadouts[0].slice(), gl],
      seed: (Math.random() * 1e9) | 0,
    });
  }

  showOnlineLobby(): void {
    store.set('selection', this.sel);
    const mine = { fighter: this.sel.fighters[0], loadout: this.sel.loadouts[0].slice() };
    const el = this.open(
      `${this.header('ONLINE', `<span class="pill">EXPERIMENTELL · ${getFighter(mine.fighter).name}</span>`)}
       <div class="online-grid">
         <section class="panel">
           <h3>FREUNDE-MATCH</h3>
           <p class="hint">Direkte Peer-to-Peer-Verbindung. Ihr tauscht zwei Codes über einen Chat aus. Strenge Mobilfunknetze können das blockieren.</p>
           <div class="row"><button class="btn gold small" data-host>EINLADUNG ERSTELLEN</button><button class="btn small" data-join>EINLADUNG ANNEHMEN</button></div>
           <div class="rtc-flow" style="margin-top:0.6rem"></div>
         </section>
         <section class="panel">
           <h3>TEST AUF EINEM GERÄT</h3>
           <p class="hint">Öffne das Spiel in einem zweiten Browser-Tab, erstelle hier einen Raum und tritt dort bei. Simulierte Verzögerung zeigt Rollback in Aktion.</p>
           <div class="row"><span class="hint">LAG</span>
             <button class="toggle on" data-lag="0">0 ms</button><button class="toggle" data-lag="60">60 ms</button><button class="toggle" data-lag="120">120 ms</button></div>
           <div class="row" style="margin-top:0.6rem"><button class="btn small" data-bhost>RAUM ERSTELLEN</button>
             <input id="room-code" class="code-in" maxlength="4" placeholder="CODE" autocomplete="off" />
             <button class="btn small" data-bjoin>BEITRETEN</button></div>
         </section>
       </div>
       <div class="net-status" role="status"></div>`,
    );
    const status = el.querySelector<HTMLElement>('.net-status')!;
    const flow = el.querySelector<HTMLElement>('.rtc-flow')!;
    let lag = 0;
    const say = (t: string, err = false) => {
      status.textContent = t;
      status.classList.toggle('err', err);
    };
    const go = (t: Transport, host: boolean) => {
      say(host ? 'Warte auf den anderen Spieler…' : 'Trete bei…');
      runLobby(t, host, mine, (g) => this.onlineConfig(g))
        .then((res) => this.startOnline(res, t))
        .catch((e: Error) => say(e.message, true));
    };
    el.querySelectorAll<HTMLButtonElement>('[data-lag]').forEach((b) =>
      b.addEventListener('click', () => {
        lag = Number(b.dataset.lag);
        el.querySelectorAll('[data-lag]').forEach((x) => x.classList.toggle('on', x === b));
      }),
    );
    el.querySelector('[data-bhost]')!.addEventListener('click', () => {
      const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
      (el.querySelector('#room-code') as HTMLInputElement).value = code;
      go(sameDeviceTransport(code, true, lag), true);
      say(`Raum ${code} – im zweiten Tab ONLINE öffnen, ${code} eingeben und BEITRETEN drücken.`);
    });
    el.querySelector('[data-bjoin]')!.addEventListener('click', () => {
      const code = (el.querySelector('#room-code') as HTMLInputElement).value.trim().toUpperCase();
      if (code.length !== 4) return say('Gib den 4-stelligen Raum-Code aus dem anderen Tab ein.', true);
      go(sameDeviceTransport(code, false, lag), false);
    });
    const codeBox = (label: string, value: string, editable: boolean, id: string) =>
      `<label class="hint" for="${id}">${label}</label><textarea id="${id}" class="code-box" ${editable ? '' : 'readonly'} spellcheck="false">${value}</textarea>`;
    const copyBtn = (id: string) => {
      const b = document.createElement('button');
      b.className = 'toggle';
      b.textContent = 'CODE KOPIEREN';
      b.addEventListener('click', () => {
        const ta = el.querySelector<HTMLTextAreaElement>('#' + id)!;
        navigator.clipboard?.writeText(ta.value).then(
          () => (b.textContent = 'KOPIERT'),
          () => {
            ta.select();
            b.textContent = 'MARKIERT – JETZT KOPIEREN';
          },
        );
      });
      return b;
    };
    el.querySelector('[data-host]')!.addEventListener('click', async () => {
      if (typeof RTCPeerConnection === 'undefined') return say('Dieser Browser kann keine Peer-to-Peer-Verbindung. Nutze den Test auf einem Gerät.', true);
      const rtc = new RtcTransport();
      flow.innerHTML = '<div class="hint">Erstelle Einladung…</div>';
      try {
        const invite = await rtc.createInvite();
        flow.innerHTML = `${codeBox('1. Schick diesen Einladungs-Code an deinen Freund', invite, false, 'inv')}<div class="row copy-row"></div>${codeBox('2. Füge den Antwort-Code deines Freundes ein', '', true, 'rep')}<div class="row" style="margin-top:0.4rem"><button class="btn gold small" data-connect>VERBINDEN</button></div>`;
        flow.querySelector('.copy-row')!.appendChild(copyBtn('inv'));
        rtc.onOpen = () => go(rtc, true);
        flow.querySelector('[data-connect]')!.addEventListener('click', async () => {
          try {
            await rtc.acceptReply(flow.querySelector<HTMLTextAreaElement>('#rep')!.value);
            say('Verbinde…');
          } catch {
            say('Dieser Antwort-Code ist ungültig. Bitte nochmal kopieren lassen.', true);
          }
        });
      } catch (e) {
        say(`Einladung konnte nicht erstellt werden: ${(e as Error).message}`, true);
      }
    });
    el.querySelector('[data-join]')!.addEventListener('click', () => {
      if (typeof RTCPeerConnection === 'undefined') return say('Dieser Browser kann keine Peer-to-Peer-Verbindung. Nutze den Test auf einem Gerät.', true);
      flow.innerHTML = `${codeBox('1. Füge den Einladungs-Code deines Freundes ein', '', true, 'inv')}<div class="row" style="margin-top:0.4rem"><button class="btn gold small" data-next>ANTWORT ERSTELLEN</button></div>`;
      flow.querySelector('[data-next]')!.addEventListener('click', async () => {
        const rtc = new RtcTransport();
        try {
          const reply = await rtc.acceptInvite(flow.querySelector<HTMLTextAreaElement>('#inv')!.value);
          flow.innerHTML = `${codeBox('2. Schick diesen Antwort-Code zurück. Das Match startet, sobald ihr verbunden seid.', reply, false, 'rep')}<div class="row copy-row"></div>`;
          flow.querySelector('.copy-row')!.appendChild(copyBtn('rep'));
          rtc.onOpen = () => go(rtc, false);
          say('Warte, bis der Host verbindet…');
        } catch {
          say('Dieser Einladungs-Code ist ungültig. Bitte nochmal kopieren lassen.', true);
        }
      });
    });
    el.querySelector('[data-back]')!.addEventListener('click', () => {
      this.leaveNet();
      this.showHome();
    });
  }

  // ----------------------------------------------------- test / debug API
  /** Inject inputs for P1 for automated tests (OR-ed with real input). */
  debugHoldP1(bits: number, frames: number): void {
    const src = this.runner?.sources[this.localIdx];
    if (!src) return;
    const orig = src.poll.bind(src);
    let left = frames;
    src.poll = (s, i) => {
      if (left-- > 0) return orig(s, i) | bits;
      src.poll = orig;
      return orig(s, i);
    };
  }

  get IN() {
    return IN;
  }

  /** Debug: list move keys of a fighter. */
  moveList(idx: number): string[] {
    const s = this.runner!.state;
    return Object.keys(getFighter(s.fighters[idx].def).moves);
  }

  /** Debug: put a fighter into a move at its first active frame (for hitbox/pose checks). */
  freezeMove(idx: number, key: string, frame?: number): number {
    const s = this.runner!.state;
    const f = s.fighters[idx];
    const o = s.fighters[1 - idx];
    const mv = getFighter(f.def).moves[key];
    f.x = -6000;
    o.x = 6000;
    f.facing = 1;
    o.facing = -1;
    o.state = 'idle';
    s.camX = 0;
    f.state = 'move';
    f.move = key;
    f.mf = frame ?? mv.hits[0]?.start ?? mv.projectile?.frame ?? 1;
    f.hitMask = 0;
    f.hitstop = 0;
    f.crouching = !!mv.crouching;
    f.y = mv.air ? 9000 : 0;
    s.projectiles = [];
    return f.mf;
  }

  keyboard() {
    return keyboardState();
  }
}
