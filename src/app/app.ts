// Application flow: home (3D showcase), fighter select, deck, controls, matches, pause,
// results, online lobby. Owns the render loop. All player-facing text is German.
import '../content';
import { BOT_LEVELS, Bot } from '../ai/bot';
import type { SimEvent } from '../core/events';
import { IN } from '../core/input';
import { getCard, getFighter, getMove, SIGNATURE_SLOT, validateLoadout } from '../core/registry';
import { createMatch, defaultConfig, RULES } from '../core/sim';
import type { GameState } from '../core/state';
import { ROSTER } from '../content';
import { GamepadSource, KeyboardSource, MergedSource, NullSource, P1_KEYS, P2_KEYS, keyboardState, type InputSource, type KeyMap } from '../input/sources';
import { TouchControls } from '../input/touch';
import { GameView } from '../render/view';
import { installCinematics } from '../render/cinematics';
import { cardHtml, Hud } from '../ui/hud';
import { CAT_COLOR, CAT_DE, UI_ICONS } from '../ui/icons';
import { LINE } from '../ui/lines';
import { ARENAS, arenaInfo } from '../ui/arenas';
import { clearPortraits, portrait, renderPortraits } from '../ui/portraits';
import { mainMenuHtml, mainMenuToast, mountMainMenu, type MainMenuModel } from '../ui/menu/mainMenu';
import { MenuFigures } from '../ui/menu/figures';
import { loadingHtml, mountLoading, setLoading, setLoadingLabel } from '../ui/menu/loading';
import { charSelectHtml, mountCharSelect, type CsSide, type CsTile } from '../ui/menu/charSelect';
import { mountShowcase, setShowcaseChip, showcaseHtml, showcaseRoulette, showcaseSelect, type ShowcaseItem } from '../ui/menu/arenaSelect';
import { MODE_IMG } from '../ui/menu/modeArt';
import { mountShop, shopHtml } from '../ui/menu/shop';
import { boardHtml, mountBoard, type BoardRow } from '../ui/menu/board';
import { toast } from '../ui/menu/kit';
import '../ui/menu/skin';
import { AudioEngine } from '../audio/audio';
import { MatchRunner } from './match';
import { NetMatchRunner, RtcTransport, runLobby, sameDeviceTransport, type LobbyResult } from '../net/online';
import type { Transport } from '../net/rollback';
import { TrainingMonitor } from './training';

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
  arena: string;
}

/** Ranked ladder (offline, vs CPU): rank points decide the tier and the CPU strength. */
const TIERS: [number, string, Level][] = [
  [0, 'BRONZE', 'easy'],
  [100, 'SILBER', 'easy'],
  [250, 'GOLD', 'normal'],
  [450, 'PLATIN', 'normal'],
  [700, 'DIAMANT', 'hard'],
  [1000, 'LEGENDE', 'hard'],
];
function tierOf(rp: number): { name: string; level: Level; next: string; pct: number } {
  let i = 0;
  while (i + 1 < TIERS.length && rp >= TIERS[i + 1][0]) i++;
  const nxt = TIERS[i + 1];
  const pct = nxt ? ((rp - TIERS[i][0]) / (nxt[0] - TIERS[i][0])) * 100 : 100;
  return { name: TIERS[i][1], level: TIERS[i][2], next: nxt ? `${nxt[0] - rp} RP bis ${nxt[1]}` : 'Höchste Liga', pct };
}
const RP_WIN = 25;
const RP_LOSS = 15;

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

interface MatchRecord {
  f: string;
  o: string;
  r: 'W' | 'L' | 'D';
  mode: string;
  t: number;
}
interface Profile {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  bestCombo: number;
  byFighter: Record<string, { m: number; w: number }>;
  history: MatchRecord[];
}
const NEW_PROFILE: Profile = { matches: 0, wins: 0, losses: 0, draws: 0, bestCombo: 0, byFighter: {}, history: [] };

/** Local progression (no server): XP from finished matches, street rank from wins. */
function levelOf(p: Profile): { level: number; pct: number; xp: number } {
  const xp = p.wins * 100 + p.losses * 40 + p.draws * 60 + p.matches * 10;
  return { level: 1 + Math.floor(xp / 400), pct: (xp % 400) / 4, xp };
}
const RANKS: [number, string][] = [
  [0, 'BRONZE'],
  [3, 'SILBER'],
  [10, 'GOLD'],
  [25, 'PLATIN'],
  [50, 'DIAMANT'],
  [100, 'LEGENDE'],
];
function rankOf(p: Profile): { name: string; next: string } {
  let i = 0;
  while (i + 1 < RANKS.length && p.wins >= RANKS[i + 1][0]) i++;
  const nxt = RANKS[i + 1];
  return { name: RANKS[i][1], next: nxt ? `Noch ${nxt[0] - p.wins} Siege bis ${nxt[1]}` : 'Höchster Rang erreicht' };
}

/** Hometowns on the character-select ribbon (from the PO's master design). */
const HOMETOWN: Record<string, string> = { jazeek: 'Aachen', bonez: 'Hamburg' };

type MenuMode = 'quick' | 'ranked' | 'friend' | 'local' | 'training' | 'koop';
/** Stored menu mode (older saves used 'online' for the friend room code). */
function menuModeOf(v: string): MenuMode {
  if (v === 'online') return 'friend';
  return (['quick', 'ranked', 'friend', 'local', 'training'] as string[]).includes(v) ? (v as MenuMode) : 'quick';
}
const NEWS_VERSION = 1;

/** Local placeholder economy (PO decision: visible, no real money, nothing to buy yet): coins and diamonds grow
 *  with played matches, the battle pass levels up every 500 pass XP. */
function economyOf(p: Profile): { coins: number; gems: number; pass: { level: number; xp: number; xpMax: number } } {
  const coins = 500 + p.wins * 50 + p.losses * 20 + p.draws * 30;
  const gems = 50 + Math.floor(p.wins / 5) * 10;
  const passXp = p.matches * 100 + p.wins * 50;
  return { coins, gems, pass: { level: 1 + Math.floor(passXp / 500), xp: passXp % 500, xpMax: 500 } };
}

export class App {
  private canvas: HTMLCanvasElement;
  private _view: GameView | null = null;
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
  /** Which fighter this device controls (1 for an online guest). */
  localIdx = 0;
  private netTransport: Transport | null = null;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);
  private tapMode = false;
  /** Seconds without peer data before "VERBINDUNG WEG" (?netsilence= raises it for software-GL test runs). */
  private netSilence = Number(new URLSearchParams(location.search).get('netsilence') ?? 6);

  /** The 3D scene (arena + fighters) is only created when the first match starts; menus are plain 2D. */
  get view(): GameView {
    if (!this._view) {
      this._view = new GameView(this.canvas, this.sel.arena);
      this.viewArena = this.sel.arena;
      installCinematics(this._view, this.audio);
    }
    return this._view;
  }
  private viewArena = '';
  /** Arenas are built with the view: a different arena disposes the old view and starts on a fresh canvas. */
  private ensureArena(): void {
    if (!this._view || this.viewArena === this.sel.arena) return;
    this._view.dispose();
    const fresh = this.canvas.cloneNode(false) as HTMLCanvasElement;
    this.canvas.replaceWith(fresh);
    this.canvas = fresh;
    this._view = null;
  }
  /** Mode chosen on the home screen (ranked = CPU ladder with rank points). */
  private flow: { mode: PlayMode | 'online'; ranked: boolean } = { mode: 'cpu', ranked: false };

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.ui = ui;
    this.canvas = canvas;
    canvas.classList.add('off');
    this.hud = new Hud(ui);
    this.hud.screenOf = (i) => this._view?.screenOf(i) ?? null;
    this.touch = new TouchControls(ui);
    this.touch.bindCards(this.hud.handCards);
    this.hud.onSigReady = () => this.audio.chime();
    const params = new URLSearchParams(location.search);
    const touchPref = store.get<'auto' | 'on' | 'off'>('touch', 'auto');
    this.touchEnabled =
      params.get('touch') === '1' ||
      (params.get('touch') !== '0' &&
        (touchPref === 'on' || (touchPref === 'auto' && typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches)));
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
      arena: params.get('arena') ?? (ARENAS.some((a) => a.id === saved.arena && !a.locked) ? saved.arena! : 'podcast'),
    };
    for (let i = 0; i < 2; i++) {
      if (!ROSTER.includes(this.sel.fighters[i])) this.sel.fighters[i] = ROSTER[i] ?? ROSTER[0];
      if (!this.sel.loadouts[i] || validateLoadout(this.sel.fighters[i], this.sel.loadouts[i]))
        this.sel.loadouts[i] = getFighter(this.sel.fighters[i]).defaultLoadout.slice();
    }
    this.hud.pauseBtn.addEventListener('click', () => this.togglePause());
    window.addEventListener('resize', () => this._view?.resize());
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
      this.enterMenu();
      this.showTitle();
    }
    (window as unknown as { __rb: App }).__rb = this;
    requestAnimationFrame((t) => this.loop(t));
  }

  // ---------------------------------------------------------------- loop
  private loop(now: number): void {
    const elapsed = now - this.last;
    this.last = now;
    if (this.runner && !this.debugHold) {
      this.runner.tick(elapsed, this.audio.beat());
      const s = this.runner.state;
      if (this.mode !== 'menu' && !this.isDemo) {
        this.hud.update(s, elapsed / 1000, this.view.screenFlash);
        // Mic-Duell: on phones the whole screen becomes the tap button
        const tapMode = !!s.duel && this.touchEnabled;
        if (tapMode !== this.tapMode) this.touch.setTapMode((this.tapMode = tapMode));
        // Beat-Drop: keep the music's beat on the sim's beat clock (rollback-safe: the sim decides what is on beat)
        if (s.phase === 'fight') this.audio.syncBeat(((RULES.BEAT_FRAMES - (s.frame % RULES.BEAT_FRAMES)) % RULES.BEAT_FRAMES) / 60);
        if (this.runner instanceof NetMatchRunner && this.runner.silence > this.netSilence && !this.resultsShown) this.connectionLost();
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
    this.canvas.classList.remove('off');
    const r = new MatchRunner(state, this.view, sources);
    r.listeners.push({ onEvents: (s, ev) => this.onEvents(s, ev) });
    return r;
  }

  /** Menus: no 3D scene running behind them (it is created/shown when a match starts). */
  private enterMenu(): void {
    this.leaveNet();
    this.mode = 'menu';
    this.bots = [];
    this.training = null;
    this.runner = null;
    this.canvas.classList.add('off');
    this.hud.show(false);
    this.touch.setVisible(false);
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
    // licensed Signature music, if the product owner dropped files into assets/music (else original stingers)
    for (const f of this.sel.fighters) void this.audio.loadSignatureTrack(f);
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
      if ((e.t === 'hit' || e.t === 'throwHit') && this.touchEnabled && store.get('vibrate', true)) navigator.vibrate?.(e.t === 'hit' && e.strength >= 2 ? 28 : 14);
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
    // screens without their own master layout wear the app-wide master skin (backdrop, panel frames, buttons)
    const master = /\b(mm|splash|st-select|st-arena|st-modes|st-loading|shop|board)\b/.test(cls);
    el.className = `screen ${cls}${master ? '' : ' kp'}`;
    el.innerHTML = html;
    this.ui.appendChild(el);
    this.screen = el;
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) this.audio.ui('click');
    });
    return el;
  }

  private header(title: string, extra = ''): string {
    return `<div class="header"><button class="btn icon gray" data-back aria-label="Zurück">${LINE.back}</button><div class="title">${title}</div><div class="grow"></div>${extra}</div>`;
  }

  /** Start screen: the PO's loading screen with a full bar and "TIPPEN ZUM STARTEN" (same art as the boot screen). */
  showTitle(): void {
    document.querySelector('.boot-screen')?.remove();
    const el = this.open(
      `${loadingHtml(this.touchEnabled ? 'TIPPEN ZUM STARTEN' : 'KLICK ODER ENTER')}
       <button data-default style="position:absolute;inset:0;opacity:0;z-index:3" aria-label="Start"></button>`,
      'splash',
    );
    const stop = mountLoading(el);
    setLoading(el, 1);
    setLoadingLabel(el, this.touchEnabled ? 'TIPPEN ZUM STARTEN' : 'KLICK ODER ENTER', true);
    el.querySelector('button')!.addEventListener('click', () => {
      stop();
      this.audio.unlock();
      this.audio.startMusic();
      this.showHome();
    });
  }

  private sideLabel(i: number): string {
    const m = this.flow.mode;
    if (m === 'local') return `SPIELER ${i + 1}`;
    if (m === 'online') return i === 0 ? 'DU' : 'ONLINE';
    return i === 0 ? 'DU' : m === 'training' ? 'DUMMY' : 'CPU';
  }

  private get profileData(): Profile {
    return { ...NEW_PROFILE, ...store.get<Partial<Profile>>('profile', {}) };
  }

  /** Main menu: the PO's master design (D38) - extracted artwork, native German text, game modes (no fighters here:
   *  they are picked when a fight starts). */
  showHome(): void {
    if (this.mode !== 'menu') this.enterMenu();
    const p = this.profileData;
    const lvl = levelOf(p);
    const rp = store.get('rp', 0);
    const tier = tierOf(rp);
    const eco = economyOf(p);
    const last = menuModeOf(store.get<string>('menuMode', 'quick'));
    const modeInfo: Record<MenuMode, MainMenuModel['mode']> = {
      quick: { title: 'SCHNELLKAMPF', status: 'CPU-GEGNER BEREIT …', detail: `SCHWIERIGKEIT: ${LEVEL_DE[this.sel.level]}` },
      friend: { title: 'FREUNDE', status: 'ONLINE PER RAUM-CODE …', detail: 'ERSTELLEN ODER BEITRETEN' },
      local: { title: '2 SPIELER', status: 'EIN GERÄT …', detail: 'TOUCH, TASTATUR ODER GAMEPAD' },
      ranked: { title: 'RANKED', status: `LIGA: ${tier.name} …`, detail: `${rp} RP · ${tier.next.toUpperCase()}` },
      training: { title: 'TRAINING', status: 'FREIES TRAINING …', detail: 'KOMBOS & FRAME-DATEN' },
      koop: { title: 'KOOP', status: 'KOMMT BALD', detail: '' },
    };
    const model: MainMenuModel = {
      name: this.playerName,
      level: lvl.level,
      xp: lvl.xp % 400,
      xpMax: 400,
      coins: eco.coins,
      gems: eco.gems,
      news: store.get('newsSeen', 0) < NEWS_VERSION ? 1 : 0,
      mode: modeInfo[last],
      pass: eco.pass,
    };
    const el = this.open(mainMenuHtml(model), 'mm main-menu');
    const start = (m: MenuMode) => {
      if (m === 'koop') return soon('KOOP');
      store.set('menuMode', m);
      this.startMode(m);
    };
    const soon = (what: string) => mainMenuToast(el, `${what} – KOMMT BALD`);
    const stop = mountMainMenu(el, (a) => {
      switch (a) {
        case 'quick':
        case 'friend':
        case 'ranked':
          start(a);
          break;
        case 'online':
          mainMenuToast(el, 'ZUFALLSGEGNER KOMMEN BALD – SPIEL SO LANGE GEGEN FREUNDE');
          break;
        case 'play':
          start(last);
          break;
        case 'mode':
        case 'modes':
          this.showModes();
          break;
        case 'profile':
          this.showProfile();
          break;
        case 'settings':
          this.showSettings();
          break;
        case 'fighters':
          this.showFighters(0);
          break;
        case 'arenas':
          this.showArenas();
          break;
        case 'event':
          soon('SONDER-EVENT');
          break;
        case 'news':
          store.set('newsSeen', NEWS_VERSION);
          this.showNews(el);
          break;
        case 'shop':
          this.showShop();
          break;
        case 'pass':
          soon('BATTLE PASS');
          break;
        case 'leader':
          this.showBoard();
          break;
      }
    }, this.favorite);
    const obs = new MutationObserver(() => {
      if (!el.isConnected) {
        stop();
        obs.disconnect();
      }
    });
    obs.observe(this.ui, { childList: true });
  }

  /** Shop (PO master design): placeholder economy, nothing to buy yet, no real money. */
  showShop(): void {
    const eco = economyOf(this.profileData);
    const el = this.open(shopHtml(eco), 'shop');
    const stop = mountShop(el);
    el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-back]')) {
        stop();
        this.showHome();
      } else if (t.closest('[data-settings]')) {
        stop();
        this.showSettings();
      } else if (t.closest('[data-tab]')) {
        const k = t.closest<HTMLElement>('[data-tab]')!.dataset.tab;
        if (k !== 'skins') toast(el, 'KATEGORIE KOMMT BALD');
      } else if (t.closest('[data-buy]')) toast(el, 'SHOP KOMMT BALD – KEIN ECHTGELD');
    });
  }

  /** BESTENLISTE (PO master): your rank points against a fixed CPU league (offline until there is a server). */
  showBoard(): void {
    const p = this.profileData;
    const rp = store.get('rp', 0);
    const rivals: [string, string, number, number][] = [
      ['KÖNIGSVERS', 'DER CHAMP DES VOLKES', 247, 1320],
      ['LYRIKWUT', 'BARS LÜGEN NICHT', 198, 1090],
      ['FLOWTITAN', 'KEINE GESCHENKE', 176, 920],
      ['MIKRO-MAURER', 'DRUCK MACHT DIAMANTEN', 162, 760],
      ['BEATKILLER', 'RHYTHMUS GEWINNT', 148, 610],
      ['KLARTEXT', 'KOPF VOR MUND', 131, 380],
      ['VERSVIPER', 'STILLE IST NIEDERLAGE', 121, 180],
      ['FRISCHLING', 'GERADE ANGEKOMMEN', 12, 40],
    ];
    const me: BoardRow = { name: this.playerName.toUpperCase(), motto: 'DAS BIST DU', wins: p.wins, rating: rp, you: true, avatar: portrait(this.favorite, 'bust') };
    const all: BoardRow[] = [...rivals.map(([name, motto, wins, rating]): BoardRow => ({ name, motto, wins, rating })), me].sort((a, b) => b.rating - a.rating || (a.you ? -1 : 1));
    const rank = all.indexOf(me) + 1;
    const rows = all.slice(0, 8);
    if (!rows.includes(me)) rows[7] = me;
    let streak = 0;
    for (let i = p.history.length - 1; i >= 0 && p.history[i].r === 'W'; i--) streak++;
    const el = this.open(
      boardHtml({
        rows,
        you: { name: this.playerName, motto: `LIGA ${tierOf(rp).name} · OFFLINE`, streak, wins: p.wins, rank, avatar: portrait(this.favorite, 'bust'), tier: tierOf(rp).name },
        tiers: ['LEGENDE', 'DIAMANT', 'GOLD', 'SILBER', 'BRONZE'],
      }),
      'board',
    );
    const stop = mountBoard(el);
    el.querySelector('[data-back]')!.addEventListener('click', () => {
      stop();
      this.showHome();
    });
    el.querySelector('[data-season]')!.addEventListener('click', () => toast(el, 'SAISON-BELOHNUNGEN KOMMEN BALD'));
  }

  /** Favourite fighter (stands in the main menu, preselected for P1) and favourite arena (preselected at match start). */
  private get favorite(): string {
    const f = store.get('favFighter', this.sel.fighters[0]);
    return ROSTER.includes(f) ? f : ROSTER[0];
  }
  private get favArena(): string {
    return arenaInfo(store.get('favArena', this.sel.arena)).id;
  }

  private startMode(m: MenuMode): void {
    if (m === 'quick') this.beginFlow('cpu', false);
    else if (m === 'ranked') this.beginFlow('cpu', true);
    else if (m === 'friend') this.beginFlow('online', false);
    else if (m === 'local') this.beginFlow('local', false);
    else if (m === 'training') this.beginFlow('training', false);
  }

  /** Game modes in the arena-select design: picture tiles, info panel, CPU strength on the chip. */
  showModes(): void {
    const rp = store.get('rp', 0);
    const tier = tierOf(rp);
    const items: ShowcaseItem[] = [
      { id: 'quick', name: 'SCHNELLKAMPF', district: 'GEGEN DIE CPU', desc: 'Kämpfer und Arena wählen, rein in den Ring. Perfekt zum Aufwärmen und für eine schnelle Runde.', rows: [['TEMPO', 'SOFORT'], ['HYPE', 'HOCH'], ['SPIELER', '1 GEGEN CPU']], img: MODE_IMG.quick },
      { id: 'ranked', name: 'RANKED', district: `LIGA ${tier.name}`, desc: `Gewertete Kämpfe gegen immer stärkere CPU-Gegner. Siege bringen RP, Niederlagen kosten welche. ${tier.next}.`, rows: [['LIGA', tier.name], ['PUNKTE', `${rp} RP`], ['SPIELER', '1 GEGEN CPU']], img: MODE_IMG.ranked },
      { id: 'friend', name: 'FREUNDE', district: 'ONLINE PER RAUM-CODE', desc: 'Raum erstellen oder beitreten, Code teilen – dann seid ihr verbunden und kämpft online gegeneinander.', rows: [['TEMPO', 'LIVE'], ['HYPE', 'MAXIMAL'], ['SPIELER', '1 GEGEN 1 ONLINE']], img: MODE_IMG.friend },
      { id: 'local', name: '2 SPIELER', district: 'EIN GERÄT', desc: 'Zu zweit an einem Gerät: Touch geteilt, Tastatur oder zwei Gamepads.', rows: [['TEMPO', 'SOFORT'], ['HYPE', 'HOCH'], ['SPIELER', '1 GEGEN 1 LOKAL']], img: MODE_IMG.local },
      { id: 'training', name: 'TRAINING', district: 'FREIES TRAINING', desc: 'Kombos üben, Frame-Daten ansehen, Hitboxen einblenden. Der Dummy steht still oder blockt.', rows: [['TEMPO', 'DEIN TEMPO'], ['HYPE', 'UNENDLICH'], ['SPIELER', 'DU + DUMMY']], img: MODE_IMG.training },
      { id: 'koop', name: 'STRASSEN-KOOP', district: 'KOMMT BALD', desc: 'Zu zweit durch die Straßen, Welle für Welle gegen ganze Gangs – Seite an Seite mit deinem Partner.', rows: [['TEMPO', 'BALD'], ['HYPE', 'BALD'], ['SPIELER', '2 IM TEAM']], img: MODE_IMG.koop, locked: true },
    ];
    let cur = items.find((x) => x.id === menuModeOf(store.get<string>('menuMode', 'quick'))) ?? items[0];
    const lvl = () => `CPU-STÄRKE: ${LEVEL_DE[this.sel.level]}`;
    const el = this.open(showcaseHtml(items, cur, { title: 'SPIELMODUS', okLabel: 'AUSWÄHLEN', chip: lvl() }), 'st-modes');
    const stop = mountShowcase(el);
    const done = (fn: () => void) => {
      stop();
      fn();
    };
    el.querySelectorAll<HTMLElement>('[data-item]').forEach((b) =>
      b.addEventListener('click', () => {
        cur = items.find((x) => x.id === b.dataset.item) ?? cur;
        this.audio.ui('click');
        showcaseSelect(el, cur);
      }),
    );
    el.querySelector('[data-chip]')!.addEventListener('click', () => {
      this.sel.level = LEVELS[(LEVELS.indexOf(this.sel.level) + 1) % LEVELS.length];
      store.set('selection', this.sel);
      setShowcaseChip(el, lvl(), false);
    });
    el.querySelector('[data-back]')!.addEventListener('click', () => done(() => this.showHome()));
    el.querySelector('[data-ok]')!.addEventListener('click', () => {
      if (cur.locked) return toast(el, 'STRASSEN-KOOP KOMMT BALD');
      store.set('menuMode', cur.id);
      done(() => this.showHome());
    });
  }

  private arenaItems(): ShowcaseItem[] {
    const fav = this.favArena;
    return ARENAS.map((a) => ({
      id: a.id,
      name: a.name,
      district: a.district,
      desc: a.desc,
      rows: [
        ['ZEIT', a.time],
        ['STIMMUNG', a.mood],
        ['PUBLIKUM', a.crowd],
      ],
      img: a.locked ? '' : a.img,
      locked: a.locked,
      tag: a.id === fav ? 'FAVORIT' : undefined,
    }));
  }

  /** ARENEN tab: browse the arenas and set the favourite (preselected whenever a fight starts). */
  showArenas(): void {
    const items = this.arenaItems();
    let cur = items.find((x) => x.id === this.favArena) ?? items[0];
    const el = this.open(showcaseHtml(items, cur, { title: 'ARENEN', okLabel: 'ALS FAVORIT' }), 'st-arena');
    const stop = mountShowcase(el);
    el.querySelectorAll<HTMLElement>('[data-item]').forEach((b) =>
      b.addEventListener('click', () => {
        cur = items.find((x) => x.id === b.dataset.item) ?? cur;
        this.audio.ui('click');
        showcaseSelect(el, cur);
      }),
    );
    el.querySelector('[data-back]')!.addEventListener('click', () => {
      stop();
      this.showHome();
    });
    el.querySelector('[data-ok]')!.addEventListener('click', () => {
      if (cur.locked) return toast(el, 'DIESE ARENA KOMMT BALD');
      store.set('favArena', cur.id);
      this.sel.arena = cur.id;
      store.set('selection', this.sel);
      stop();
      this.showArenas();
      toast(this.screen!, `${cur.name} IST JETZT DEINE FAVORITEN-ARENA`);
    });
  }

  private showNews(root: HTMLElement): void {
    const ov = document.createElement('div');
    ov.className = 'mm-overlay';
    ov.innerHTML = `<div class="mm-sheet"><div class="mm-sheet-h">NEU IN SAISON 1</div>
      <ul class="mm-news"><li><b>Fatality:</b> nach dem letzten K.O. SIGNATURE drücken – brutaler Finisher mit Spott.</li>
      <li><b>Mic-Duell:</b> zwei Schläge gleichzeitig? Wer schneller tippt, gewinnt.</li>
      <li><b>Wand-Splat & Beat-Drop:</b> an die Bande klatschen, im Takt härter treffen.</li>
      <li><b>Neue Karten:</b> Diamanten-Regen (Jazeek) und Tiefergelegt (Bonez MC).</li></ul>
      <button class="mm-close" aria-label="Schließen">OK</button></div>`;
    root.appendChild(ov);
    ov.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.mm-close') || t === ov) this.showHome();
    });
  }

  /** Mode chosen: pick fighters (Tekken-style), then the arena, then load and fight. */
  private beginFlow(mode: PlayMode | 'online', ranked: boolean): void {
    this.flow = { mode, ranked };
    if (mode !== 'online') this.sel.mode = mode;
    // favourites: P1 starts on the favourite fighter, the arena pick on the favourite arena
    const fav = this.favorite;
    if (this.sel.fighters[0] !== fav) {
      this.sel.fighters[0] = fav;
      this.sel.loadouts[0] = this.presetDeck(fav);
      if (mode !== 'local' && this.sel.fighters[1] === fav) {
        const other = ROSTER.find((x) => x !== fav);
        if (other) {
          this.sel.fighters[1] = other;
          this.sel.loadouts[1] = getFighter(other).defaultLoadout.slice();
        }
      }
    }
    this.sel.arena = this.favArena;
    store.set('selection', this.sel);
    this.showCharSelect(0);
  }

  /** Character select: P1 big on the left, roster in the middle, P2 big on the right (tap a side to pick for it). */
  showCharSelect(picking: number): void {
    const m = this.flow.mode;
    if (m === 'online') picking = 0;
    const sides = [0, 1].map((i): CsSide => {
      const id = this.sel.fighters[i];
      return {
        id,
        name: getFighter(id).name.toUpperCase(),
        city: HOMETOWN[id] ?? '',
        label: this.sideLabel(i),
        hidden: m === 'online' && i === 1,
      };
    }) as [CsSide, CsSide];
    const tiles: CsTile[] = ROSTER.slice(0, 2).map((fid) => ({
      id: fid,
      bust: portrait(fid, 'bust'),
      name: getFighter(fid).name,
      tags: [0, 1].filter((i) => this.sel.fighters[i] === fid && !(m === 'online' && i === 1)),
    }));
    const el = this.open(charSelectHtml(sides, tiles, picking), 'st-select');
    const stop = mountCharSelect(el, sides);
    const go = (fn: () => void) => () => {
      stop();
      fn();
    };
    el.querySelectorAll<HTMLButtonElement>('[data-f]').forEach((b) =>
      b.addEventListener('click', () => {
        const fid = b.dataset.f!;
        this.sel.fighters[picking] = fid;
        if (validateLoadout(fid, this.sel.loadouts[picking])) this.sel.loadouts[picking] = picking === 0 ? this.presetDeck(fid) : getFighter(fid).defaultLoadout.slice();
        // vs CPU: the opponent follows to the other fighter (a mirror match stays possible by picking on P2)
        if (picking === 0 && m !== 'local' && this.sel.fighters[1] === fid) {
          const other = ROSTER.find((x) => x !== fid);
          if (other) {
            this.sel.fighters[1] = other;
            this.sel.loadouts[1] = getFighter(other).defaultLoadout.slice();
          }
        }
        store.set('selection', this.sel);
        this.audio.ui('click');
        stop();
        // two players: P1 picked -> P2's turn
        this.showCharSelect(m === 'local' && picking === 0 ? 1 : picking);
      }),
    );
    el.querySelectorAll<HTMLElement>('[data-side]').forEach((b) =>
      b.addEventListener('click', () => {
        if (m === 'online') return;
        stop();
        this.showCharSelect(Number(b.dataset.side));
      }),
    );
    el.querySelector('[data-back]')!.addEventListener('click', go(() => this.showHome()));
    el.querySelector('[data-ready]')!.addEventListener(
      'click',
      go(() => {
        store.set('selection', this.sel);
        if (m === 'online') this.showOnlineLobby();
        else this.showArenaSelect(() => this.showCharSelect(picking));
      }),
    );
  }

  /** Arena select at match start: every player picks one (favourite preselected; the CPU picks at random), then a
   *  short draw decides between the picks. `picks` holds the earlier players' choices. */
  showArenaSelect(back: () => void, picks: string[] = []): void {
    const m = this.flow.mode;
    const items = this.arenaItems();
    const player = picks.length;
    const curId = player === 0 ? this.favArena : this.sel.arena;
    let cur = items.find((x) => x.id === curId && !x.locked) ?? items[0];
    const title = m === 'local' ? `ARENA · SPIELER ${player + 1}` : 'ARENA-WAHL';
    const el = this.open(showcaseHtml(items, cur, { title, okLabel: 'ARENA WÄHLEN' }), 'st-arena');
    const stop = mountShowcase(el);
    el.querySelectorAll<HTMLElement>('[data-item]').forEach((b) =>
      b.addEventListener('click', () => {
        const it = items.find((x) => x.id === b.dataset.item);
        if (!it) return;
        cur = it;
        this.audio.ui('click');
        showcaseSelect(el, cur);
      }),
    );
    el.querySelector('[data-back]')!.addEventListener('click', () => {
      stop();
      if (player > 0) this.showArenaSelect(back, picks.slice(0, -1));
      else back();
    });
    el.querySelector<HTMLButtonElement>('[data-ok]')!.addEventListener('click', (e) => {
      if (cur.locked) return toast(el, 'DIESE ARENA KOMMT BALD');
      const all = [...picks, cur.id];
      if (m === 'local' && all.length < 2) {
        stop();
        return this.showArenaSelect(back, all);
      }
      if (m === 'cpu') {
        const open = items.filter((x) => !x.locked).map((x) => x.id);
        all.push(open[Math.floor(Math.random() * open.length)]);
      }
      const cands = [...new Set(all)];
      const winner = cands[Math.floor(Math.random() * cands.length)];
      this.sel.arena = winner;
      store.set('selection', this.sel);
      (e.currentTarget as HTMLButtonElement).disabled = true;
      const go = () => {
        stop();
        this.launch();
      };
      if (cands.length < 2) return go();
      showcaseRoulette(el, cands.map((id) => items.find((x) => x.id === id)!), winner, go);
      toast(el, m === 'cpu' ? 'DU GEGEN CPU-WAHL – DER ZUFALL ENTSCHEIDET' : 'DER ZUFALL ENTSCHEIDET');
    });
  }

  /** Loading screen (concert stage): builds the 3D scene for the chosen arena, then starts the match. */
  private launch(): void {
    const mode = this.flow.mode as PlayMode;
    if (this.flow.ranked) this.sel.level = tierOf(store.get('rp', 0)).level;
    const el = this.open(loadingHtml('LÄDT …'), 'st-loading');
    const stop = mountLoading(el);
    let pct = 0;
    const t0 = performance.now();
    setLoading(el, 0);
    const tick = window.setInterval(() => {
      pct += (92 - pct) * 0.08;
      setLoading(el, pct / 100);
    }, 50);
    // let the screen paint before the (synchronous) scene build
    window.setTimeout(() => {
      this.ensureArena();
      const view = this.view;
      const ready = (view.arena as unknown as { ready?: Promise<void> }).ready ?? Promise.resolve();
      const timeout = new Promise((r) => window.setTimeout(r, 15000));
      void Promise.race([ready, timeout]).then(() => {
        const wait = Math.max(0, 1300 - (performance.now() - t0));
        window.setTimeout(() => {
          window.clearInterval(tick);
          setLoading(el, 1);
          window.setTimeout(() => {
            stop();
            this.startMatch(mode);
          }, 180);
        }, wait);
      });
    }, 60);
  }

  showProfile(): void {
    const p = this.profileData;
    const lvl = levelOf(p);
    const rank = rankOf(p);
    const rate = p.matches ? Math.round(((p.wins + p.draws * 0.5) / p.matches) * 100) : 0;
    const fav = Object.entries(p.byFighter).sort((x, y) => y[1].m - x[1].m)[0]?.[0] ?? this.sel.fighters[0];
    const bust = portrait(fav, 'bust');
    const rows = p.history
      .slice(-8)
      .reverse()
      .map(
        (h) =>
          `<div class="hrow"><span class="res ${h.r === 'L' ? 'l' : ''}">${h.r === 'W' ? 'SIEG' : h.r === 'L' ? 'NIEDERLAGE' : 'REMIS'}</span><span>${getFighter(h.f).name} <span style="color:var(--mute)">vs</span> ${getFighter(h.o).name}</span><span class="hint">${h.mode}</span></div>`,
      )
      .join('');
    const el = this.open(
      `${this.header('PROFIL')}
       <div class="profile">
         <div style="display:flex;flex-direction:column;gap:0.8rem;min-width:0">
           <div class="panel pcard"><span class="avatar">${bust ? `<img alt="" src="${bust}">` : ''}</span>
             <div style="display:flex;flex-direction:column;gap:0.4rem"><div class="pname">${esc(this.playerName)}</div>
               <div class="ptag" style="display:flex;gap:0.5rem;align-items:center"><span class="lvl">${lvl.level}</span><span class="xp"><b style="width:${lvl.pct.toFixed(0)}%"></b></span><span class="lbl">${lvl.xp} XP</span></div>
               <button class="btn small gray" data-name style="align-self:flex-start">NAMEN ÄNDERN</button></div></div>
           <div class="panel rank">${LINE.trophy}<div><div class="lbl">STRASSEN-RANG · LOKAL</div><div class="rname">${rank.name}</div><div class="hint">${rank.next}</div></div></div>
           <div class="kpis">
             <div class="panel kpi"><b>${p.matches}</b><span>MATCHES</span></div>
             <div class="panel kpi"><b>${p.wins}</b><span>SIEGE</span></div>
             <div class="panel kpi"><b>${rate}%</b><span>SIEGQUOTE</span></div>
           </div>
         </div>
         <div class="panel history"><div class="lbl" style="margin-bottom:0.3rem">LETZTE KÄMPFE · BESTE KOMBO ${p.bestCombo}</div>${rows || '<div class="hint">Noch keine Kämpfe. Ab in den Hinterhof!</div>'}</div>
       </div>`,
    );
    el.querySelector('[data-name]')!.addEventListener('click', () => this.showNameDialog());
    el.querySelector('[data-back]')!.addEventListener('click', () => this.showHome());
  }

  showSettings(): void {
    const q = store.get<string>('quality', 'auto');
    const touch = store.get<string>('touch', 'auto');
    const seg = (key: string, cur: string, opts: [string, string][]) =>
      `<div class="presets">${opts.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-set="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
    const sw = (key: string, on: boolean) => `<button class="switch ${on ? 'on' : ''}" data-toggle="${key}" aria-pressed="${on}"></button>`;
    const el = this.open(
      `${this.header('EINSTELLUNGEN')}
       <div class="settings">
         <div class="panel setrow"><div><div class="sname">GRAFIKQUALITÄT</div><div class="sdesc">Hoch: Spiegelungen, große Schatten. Niedrig: für schwache Handys. Lädt neu.</div></div>
           ${seg('quality', q, [['auto', 'AUTO'], ['low', 'NIEDRIG'], ['medium', 'MITTEL'], ['high', 'HOCH']])}</div>
         <div class="panel setrow"><div><div class="sname">TOUCH-STEUERUNG</div><div class="sdesc">Virtueller Stick und Tasten auf dem Bildschirm.</div></div>
           ${seg('touch', touch, [['auto', 'AUTO'], ['on', 'AN'], ['off', 'AUS']])}</div>
         <div class="panel setrow"><div><div class="sname">TON</div><div class="sdesc">Effekte und Musik.</div></div>${sw('sound', !this.audio.muted)}</div>
         <div class="panel setrow"><div><div class="sname">VIBRATION</div><div class="sdesc">Kurzes Rütteln bei Treffern (Handy).</div></div>${sw('vibrate', store.get('vibrate', true))}</div>
         <div class="panel setrow"><div><div class="sname">BLITZEFFEKTE</div><div class="sdesc">Kurze Farbumkehr bei Kontern, Signature und K.O. Aus = augenschonender.</div></div>${sw('flashes', store.get('flashes', true))}</div>
         <div class="panel setrow"><div><div class="sname">STEUERUNG & TASTEN</div><div class="sdesc">Alle Eingaben für Tastatur, Controller und Touch.</div></div><button class="btn small" data-help>ANSEHEN</button></div>
       </div>`,
    );
    el.querySelectorAll<HTMLButtonElement>('[data-set]').forEach((b) =>
      b.addEventListener('click', () => {
        const key = b.dataset.set!;
        const v = b.dataset.v!;
        store.set(key, v);
        if (key === 'quality') location.reload();
        else {
          if (key === 'touch') this.touchEnabled = v === 'on' || (v === 'auto' && matchMedia('(pointer: coarse)').matches);
          this.showSettings();
        }
      }),
    );
    el.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((b) =>
      b.addEventListener('click', () => {
        const key = b.dataset.toggle!;
        if (key === 'sound') {
          this.audio.setMuted(!this.audio.muted);
          store.set('muted', this.audio.muted);
        } else store.set(key, !store.get(key, true));
        if (key === 'flashes' && this._view) this._view.toon.impactFrames = store.get('flashes', true);
        this.showSettings();
      }),
    );
    el.querySelector('[data-help]')!.addEventListener('click', () => this.showHelp(() => this.showSettings()));
    el.querySelector('[data-back]')!.addEventListener('click', () => this.showHome());
  }

  /** In-game name dialog (window.prompt is unavailable in some hosts, e.g. sandboxed frames). */
  private showNameDialog(): void {
    const el = this.open(
      `<div class="modal panel">
         <div class="mtitle">DEIN NAME</div>
         <input id="player-name" class="code-in" style="width:100%;letter-spacing:0.04em" maxlength="14" autocomplete="off" value="${esc(this.playerName)}" />
         <button class="btn gold" data-save data-default>SPEICHERN</button>
         <button class="btn gray" data-back>ABBRECHEN</button>
       </div>`,
      'dim',
    );
    const input = el.querySelector<HTMLInputElement>('#player-name')!;
    input.focus();
    input.select();
    const save = () => {
      const n = input.value.trim().slice(0, 14);
      if (n) {
        this.playerName = n;
        store.set('name', n);
      }
      this.showHome();
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') this.showHome();
    });
    el.querySelector('[data-save]')!.addEventListener('click', save);
    el.querySelector('[data-back]')!.addEventListener('click', () => this.showHome());
  }

  /** KÄMPFER: improve and customise your fighters (abilities, outfits, accessories) and choose the favourite that
   *  stands in the main menu. The fighter for a match is picked at match start (char select), not here. */
  showFighters(_player = 0, tab: 'skills' | 'outfit' | 'acc' | 'stats' = 'skills', view?: string): void {
    const id = view && ROSTER.includes(view) ? view : this.favorite;
    const d = getFighter(id);
    const all = ROSTER.map((x) => fighterStats(x));
    const max = (k: keyof ReturnType<typeof fighterStats>) => Math.max(...all.map((st) => st[k]));
    const st = all[ROSTER.indexOf(id)] ?? fighterStats(id);
    const fav = this.favorite === id;
    const deck = this.presetDeck(id);
    const bar = (label: string, v: number) => `<span>${label}</span><i><b style="width:${(Math.max(0.08, v) * 100).toFixed(0)}%"></b></i>`;
    const tiles =
      ROSTER.map((fid) => {
        const img = portrait(fid, 'bust');
        return `<button class="kf-tile ${fid === id ? 'on' : ''}" data-f="${fid}">${img ? `<img alt="" src="${img}">` : ''}${this.favorite === fid ? '<span class="kf-fav">★</span>' : ''}<span>${getFighter(fid).name}</span></button>`;
      }).join('') + Array.from({ length: 4 }, () => `<div class="kf-tile locked"><span>BALD</span></div>`).join('');
    const soonSlots = (names: string[]) =>
      `<div class="kf-slots">${names.map((n) => `<div class="kf-slot"><b>${n}</b><small>KOMMT BALD</small></div>`).join('')}</div>
       <div class="kf-designer">Unser Designer entwirft gerade die erste Kollektion – Outfits und Accessoires kommen mit dem nächsten Update.</div>`;
    const body =
      tab === 'skills'
        ? `<div class="kf-deck">${deck.map((c, i) => `<div class="kf-card">${cardHtml(id, c, 'big')}<small>${i === SIGNATURE_SLOT ? '★ SIGNATURE' : `SPECIAL ${i + 1}`}</small></div>`).join('')}</div>
           <div class="row kf-actions"><button class="btn gold" data-deck>FÄHIGKEITEN ANPASSEN</button></div>`
        : tab === 'outfit'
          ? soonSlots(['STANDARD ✓', 'TRAINING', 'BÜHNE', 'STRASSE'])
          : tab === 'acc'
            ? soonSlots(['KAPPE', 'BRILLE', 'KETTE', 'RINGE'])
            : `<div class="statbox kf-stats">${bar('ANGRIFF', st.dmg / max('dmg'))}${bar('LEBEN', st.health / max('health'))}${bar('REICHWEITE', st.reach / max('reach'))}${bar('TEMPO', st.speed / max('speed'))}</div>
               <div class="hint" style="margin-top:0.5rem">${d.tagline}</div>`;
    const tabBtn = (k: typeof tab, label: string) => `<button class="tab ${tab === k ? 'on' : ''}" data-tab="${k}">${label}</button>`;
    const el = this.open(
      `${this.header('KÄMPFER')}
       <div class="kf">
         <div class="kf-hero"><span class="fig-anchor kf-fig"></span>
           <div class="kf-who"><small>${d.archetype.toUpperCase()}</small><b>${d.name}</b></div>
           <button class="btn ${fav ? '' : 'gold'} kf-favbtn" data-fav ${fav ? 'disabled' : ''}>${fav ? '★ DEIN FAVORIT' : 'ALS FAVORIT'}</button>
         </div>
         <div class="kf-right">
           <div class="kf-roster">${tiles}</div>
           <div class="panel kf-panel">
             <div class="tabs">${tabBtn('skills', 'FÄHIGKEITEN')}${tabBtn('outfit', 'OUTFITS')}${tabBtn('acc', 'ACCESSOIRES')}${tabBtn('stats', 'WERTE')}</div>
             <div class="kf-body">${body}</div>
           </div>
         </div>
       </div>`,
      'kfighters',
    );
    const figs = new MenuFigures(el, el.querySelector('.kf'));
    figs.set([{ id, anchor: el.querySelector<HTMLElement>('.kf-fig')!, facing: 1, rim: 0xffc040, turn: 0.8 }]);
    const go = (fn: () => void) => {
      figs.dispose();
      fn();
    };
    el.querySelectorAll<HTMLButtonElement>('[data-f]').forEach((b) => b.addEventListener('click', () => go(() => this.showFighters(0, tab, b.dataset.f))));
    el.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => go(() => this.showFighters(0, b.dataset.tab as typeof tab, id))));
    el.querySelector('[data-fav]')?.addEventListener('click', () => {
      store.set('favFighter', id);
      go(() => this.showFighters(0, tab, id));
    });
    el.querySelector('[data-deck]')?.addEventListener('click', () =>
      go(() => {
        const keep = this.sel.fighters[0];
        this.sel.fighters[0] = id;
        this.sel.loadouts[0] = deck;
        this.showDeck(0, () => {
          this.sel.fighters[0] = keep;
          this.sel.loadouts[0] = this.presetDeck(keep);
          store.set('selection', this.sel);
          this.showFighters(0, 'skills', id);
        });
      }),
    );
    el.querySelector('[data-back]')!.addEventListener('click', () => go(() => this.showHome()));
  }

  /** Deck presets: three saved decks per fighter; returns the active one (or the default deck). */
  private presetDeck(fid: string): string[] {
    const all = store.get<Record<string, { i: number; decks: string[][] }>>('presets', {});
    const p = all[fid];
    const deck = p?.decks[p.i];
    return deck && !validateLoadout(fid, deck) ? deck.slice() : getFighter(fid).defaultLoadout.slice();
  }

  private savePreset(fid: string, i: number, deck: string[]): void {
    const all = store.get<Record<string, { i: number; decks: string[][] }>>('presets', {});
    const p = all[fid] ?? { i: 0, decks: [] };
    p.i = i;
    p.decks[i] = deck.slice();
    all[fid] = p;
    store.set('presets', all);
  }

  showDeck(player: number, done: () => void, doneLabel = 'FERTIG'): void {
    const fid = this.sel.fighters[player];
    const def = getFighter(fid);
    const deck = this.sel.loadouts[player].slice();
    let focus: string | null = deck[0] ?? null;
    let placing = false;
    const presets = store.get<Record<string, { i: number; decks: string[][] }>>('presets', {})[fid] ?? { i: 0, decks: [] };
    let preset = presets.i;
    const tabs = `<div class="tabs">${[0, 1].map((i) => `<button class="tab ${player === i ? `on ${i ? 'red' : ''}` : ''}" data-p="${i}">${this.sideLabel(i)}</button>`).join('')}</div>`;
    const el = this.open(
      `${this.header(`KARTEN · ${def.name}`, `<div class="presets">${[0, 1, 2].map((i) => `<button data-preset="${i}" class="${i === preset ? 'on' : ''}">PRESET ${i + 1}</button>`).join('')}</div>${tabs}`)}
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
        this.savePreset(fid, preset, deck);
      }
    };
    el.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) =>
      b.addEventListener('click', () => {
        save();
        preset = Number(b.dataset.preset);
        const all = store.get<Record<string, { i: number; decks: string[][] }>>('presets', {});
        const stored = all[fid]?.decks[preset];
        const next = stored && !validateLoadout(fid, stored) ? stored : def.defaultLoadout;
        deck.splice(0, deck.length, ...next);
        focus = deck[0] ?? null;
        placing = false;
        el.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((x) => x.classList.toggle('on', x === b));
        render();
        save();
      }),
    );
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

  /** STEUERUNG: touch first (this is a phone game); keyboard/gamepad as a second tab. */
  showHelp(back: () => void, tab: 'touch' | 'keys' | 'combos' = this.touchEnabled ? 'touch' : 'keys'): void {
    const tabBtn = (k: typeof tab, label: string) => `<button class="tab ${tab === k ? 'on' : ''}" data-tab="${k}">${label}</button>`;
    const touch = `<div class="hp-touch">
        <div class="hp-pad">
          <div class="hp-stick"><i></i></div>
          <div class="hp-cards"><span></span><span></span><span class="sig"></span></div>
          <div class="hp-btns"><b class="blk">BLOCK</b><b class="h">H</b><b class="g">GRIFF</b><b class="l">L</b></div>
        </div>
        <div class="hp-list">
          <p><b>Stick (links):</b> erscheint, wo du den Daumen ablegst. Seitlich laufen, 2× schnell = Dash, hoch = springen, runter = ducken.</p>
          <p><b>L / H:</b> leichter / schwerer Angriff. Mit Stick runter = tiefe Angriffe. Ketten: L · L · H und mehr (Tab KOMBOS).</p>
          <p><b>BLOCK:</b> halten zum Blocken. Kurz vor dem Treffer tippen = <b>Perfekt-Block</b> (kein Schaden, Konter zählt doppelt).</p>
          <p><b>GRIFF:</b> Wurf – schlägt Block. Stick zurück + GRIFF schleudert den Gegner hinter dich.</p>
          <p><b>Karten (Mitte unten):</b> deine Specials. Die <b style="color:#ffd23a">goldene Karte</b> ist die Signature – braucht 3 Hype.</p>
          <p><b>Hype:</b> lädt durch Treffen, Blocken und Einstecken. Im Takt treffen (Beat-Drop) lädt doppelt.</p>
        </div>
      </div>`;
    const keys = `<div class="keys hp-keys">
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
      <div class="hint" style="margin-top:0.6rem">Gamepads werden erkannt. 2 Spieler an einem Gerät: Spieler 2 nutzt Pfeile, <kbd>,</kbd><kbd>.</kbd><kbd>/</kbd> Angriffe, <kbd>⇧</kbd> rechts Block, <kbd>M</kbd><kbd>N</kbd><kbd>B</kbd> Karten.</div>`;
    const combos = `<div class="hint">Schläge und Tritte brauchen keine Karten – nur Knöpfe. Karten sind nur für Fähigkeiten und die Signature.</div><div class="combos">${this.comboList()}</div>`;
    const el = this.open(
      `${this.header('STEUERUNG', `<div class="tabs">${tabBtn('touch', 'TOUCH')}${tabBtn('keys', 'TASTATUR & PAD')}${tabBtn('combos', 'KOMBOS')}</div>`)}
       <div class="panel hp-body">${tab === 'touch' ? touch : tab === 'keys' ? keys : combos}</div>
       <div class="row" style="justify-content:center;margin-top:0.5rem"><button class="btn gold" data-ok data-default>VERSTANDEN</button></div>`,
      'help',
    );
    el.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => this.showHelp(back, b.dataset.tab as typeof tab)));
    el.querySelector('[data-back]')!.addEventListener('click', back);
    el.querySelector('[data-ok]')!.addEventListener('click', back);
  }

  /** Button-only target combos per fighter, read from the sim content (MoveDef.targets), plus the launcher air combo. */
  private comboList(): string {
    const kb = (k: string) => `<kbd>${k}</kbd>`;
    const seqHtml = (keys: string[]) => keys.map(kb).join('<i>·</i>');
    return ROSTER.map((id) => {
      const def = getFighter(id);
      const startBtn: Record<string, string> = { [def.normals['5L']]: 'L', [def.normals['5H']]: 'H', [def.normals['2L']]: '↓L', [def.normals['2H']]: '↓H' };
      const rows: string[] = [];
      for (const mv of Object.values(def.moves)) {
        const first = startBtn[mv.key];
        if (!first) continue;
        for (const k of ['light', 'heavy'] as const) {
          const t = mv.targets?.[k];
          if (!t) continue;
          const keys = [...Array<string>((t.minDepth ?? 0) + 1).fill(first), k === 'light' ? 'L' : 'H'];
          const target = getMove(id, t.move);
          rows.push(`<span class="seq">${seqHtml(keys)}</span><span>${target.name}</span>`);
          // launcher: jump after the opponent and finish in the air
          if (target.jumpCancel) rows.push(`<span class="seq">${seqHtml([...keys, '↑', 'L', 'H'])}</span><span>Luft-Kombo</span>`);
        }
      }
      rows.push(`<span class="seq">${seqHtml(['L', 'H', 'KARTE'])}</span><span>Kette, dann Special</span>`);
      rows.push(`<span class="seq">${seqHtml(['←', 'G'])}</span><span>Rückwärts-Slam</span>`);
      return `<div class="combo-f"><b>${def.name}</b><div class="keys">${rows.join('')}</div></div>`;
    }).join('');
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
      'dim overlay',
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
    this.enterMenu();
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
    if (this.mode === 'cpu' || this.mode === 'online') this.recordResult(w === 2 ? 'D' : w === me ? 'W' : 'L', s);
    let rpLine = '';
    if (this.mode === 'cpu' && this.flow.ranked && w !== 2) {
      const before = store.get('rp', 0);
      const after = Math.max(0, before + (w === me ? RP_WIN : -RP_LOSS));
      store.set('rp', after);
      const t0 = tierOf(before).name;
      const t1 = tierOf(after).name;
      rpLine = `<span class="pill">RANGLISTE <b>${w === me ? '+' + RP_WIN : '-' + Math.min(before, RP_LOSS)} RP · ${after} RP${t0 !== t1 ? ` · ${t1}!` : ''}</b></span>`;
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
           ${rpLine}
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
        if (a === 'rematch') {
          if (this.flow.ranked) this.sel.level = tierOf(store.get('rp', 0)).level;
          this.startMatch(mode);
        }
        else if (a === 'deck') this.showDeck(0, () => this.startMatch(mode), 'KAMPF!');
        else this.quitToMenu();
      }),
    );
  }

  private recordResult(r: 'W' | 'L' | 'D', s: GameState): void {
    const p = this.profileData;
    const me = this.localIdx;
    const f = s.fighters[me].def;
    p.matches++;
    if (r === 'W') p.wins++;
    else if (r === 'L') p.losses++;
    else p.draws++;
    p.bestCombo = Math.max(p.bestCombo, this.stats.maxCombo[me]);
    const bf = (p.byFighter[f] ??= { m: 0, w: 0 });
    bf.m++;
    if (r === 'W') bf.w++;
    p.history = [...p.history, { f, o: s.fighters[1 - me].def, r, mode: this.mode === 'online' ? 'ONLINE' : this.flow.ranked ? 'RANGLISTE' : `CPU ${LEVEL_DE[this.sel.level]}`, t: Date.now() }].slice(-30);
    store.set('profile', p);
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
    this.canvas.classList.remove('off');
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

  /** Imported character models finished loading after the menus were drawn: re-render with them. */
  modelsArrived(): void {
    clearPortraits();
    this._view?.resetRigs();
    if (this.mode === 'menu' && !this.runner) this.showHome();
  }

  // ----------------------------------------------------- test / debug API
  /** Debug: stop the real-time loop; captures then advance deterministically with debugAdvance(). */
  debugHold = false;

  /** Debug: run n sim frames (or only n renders with step=false), rendering each at a fixed 1/60 s. */
  debugAdvance(frames: number, step = true): void {
    const r = this.runner;
    if (!r) return;
    for (let i = 0; i < frames; i++) {
      if (step) r.frame();
      this.view.render(r.state, 1 / 60, 0, this.audio.beat());
      if (this.mode !== 'menu' && !this.isDemo) this.hud.update(r.state, 1 / 60, this.view.screenFlash);
    }
  }

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

  /** Debug: total frames of a move. */
  moveTotal(idx: number, key: string): number {
    return getFighter(this.runner!.state.fighters[idx].def).moves[key].total;
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
