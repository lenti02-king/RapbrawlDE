// Application flow: screens, match setup, pause/results. Owns the render loop.
import '../content';
import { BOT_LEVELS, Bot } from '../ai/bot';
import type { CardCategory } from '../core/defs';
import type { SimEvent } from '../core/events';
import { IN } from '../core/input';
import { getCard, getFighter, LOADOUT_SLOTS, validateLoadout } from '../core/registry';
import { createMatch, defaultConfig } from '../core/sim';
import type { GameState } from '../core/state';
import { ROSTER } from '../content';
import { GamepadSource, KeyboardSource, MergedSource, NullSource, P1_KEYS, P2_KEYS, keyboardState, type InputSource } from '../input/sources';
import { TouchControls } from '../input/touch';
import { CHARACTER_VISUALS } from '../render/characters';
import { GameView } from '../render/view';
import { installCinematics } from '../render/cinematics';
import { Hud } from '../ui/hud';
import { AudioEngine } from '../audio/audio';
import { MatchRunner } from './match';
import { NetMatchRunner, RtcTransport, runLobby, sameDeviceTransport, type LobbyResult } from '../net/online';
import type { Transport } from '../net/rollback';
import { TrainingMonitor } from './training';

type Mode = 'cpu' | 'local' | 'training' | 'demo' | 'online';

const CAT_NAMES: Record<CardCategory, string> = {
  offense: 'Offense',
  zoning: 'Zoning',
  mobility: 'Mobility',
  counter: 'Counter',
  utility: 'Utility',
  grapple: 'Grapple',
  signature: 'Signature',
};

interface Selection {
  fighters: [string, string];
  loadouts: [string[], string[]];
  level: keyof typeof BOT_LEVELS;
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

export class App {
  readonly view: GameView;
  readonly hud: Hud;
  readonly touch: TouchControls;
  readonly audio = new AudioEngine();
  private ui: HTMLElement;
  private screen: HTMLElement | null = null;
  runner: MatchRunner | null = null;
  mode: Mode = 'demo';
  private last = performance.now();
  sel: Selection;
  private stats: Stats = { maxCombo: [0, 0], damage: [0, 0], specials: [0, 0] };
  private bots: Bot[] = [];
  private training: TrainingMonitor | null = null;
  private touchEnabled: boolean;
  private resultsShown = false;
  /** Which fighter this device controls (1 for an online guest). */
  localIdx = 0;
  private netTransport: Transport | null = null;
  private escHandler = (e: KeyboardEvent) => this.onKey(e);

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.ui = ui;
    this.view = new GameView(canvas);
    installCinematics(this.view, this.audio);
    this.hud = new Hud(ui);
    this.touch = new TouchControls(ui);
    const params = new URLSearchParams(location.search);
    this.touchEnabled =
      params.get('touch') === '1' || (params.get('touch') !== '0' && typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
    this.sel = store.get<Selection>('selection', {
      fighters: ['volt', 'brick'],
      loadouts: [getFighter('volt').defaultLoadout.slice(), getFighter('brick').defaultLoadout.slice()],
      level: 'normal',
    });
    // sanitize persisted selection
    for (let i = 0; i < 2; i++) {
      if (!ROSTER.includes(this.sel.fighters[i])) this.sel.fighters[i] = ROSTER[i];
      if (validateLoadout(this.sel.fighters[i], this.sel.loadouts[i]))
        this.sel.loadouts[i] = getFighter(this.sel.fighters[i]).defaultLoadout.slice();
    }
    this.hud.pauseBtn.addEventListener('click', () => this.togglePause());
    window.addEventListener('resize', () => this.view.resize());
    window.addEventListener('keydown', this.escHandler);
    const rot = document.createElement('div');
    rot.className = 'rotate-hint';
    rot.textContent = 'ROTATE YOUR DEVICE TO LANDSCAPE';
    ui.appendChild(rot);

    const quick = params.get('quick');
    if (quick) {
      const [a, b] = quick.split(',');
      if (ROSTER.includes(a)) this.sel.fighters[0] = a;
      if (b && ROSTER.includes(b)) this.sel.fighters[1] = b;
      this.sel.loadouts = [getFighter(this.sel.fighters[0]).defaultLoadout.slice(), getFighter(this.sel.fighters[1]).defaultLoadout.slice()];
      const mode = (params.get('mode') as Mode) ?? 'cpu';
      this.startMatch(mode);
    } else {
      this.startDemo();
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
      this.runner.tick(elapsed, this.audio.beat());
      const s = this.runner.state;
      if (this.mode !== 'demo') {
        this.hud.update(s, elapsed / 1000, this.view.screenFlash);
        this.touch.updateCards(s, this.localIdx);
        if (this.runner instanceof NetMatchRunner && this.runner.silence > 6 && !this.resultsShown) this.connectionLost();
        this.training?.update(s, this.runner.lastInputs);
        if (s.phase === 'matchOver' && s.phaseFrame > 90 && !this.resultsShown) this.showResults();
      } else if (s.phase === 'matchOver' && s.phaseFrame > 120) {
        this.startDemo();
      }
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  // ------------------------------------------------------------- matches
  private makeRunner(state: GameState, sources: [InputSource, InputSource]): MatchRunner {
    const r = new MatchRunner(state, this.view, sources);
    r.listeners.push({
      onEvents: (s, ev) => this.onEvents(s, ev),
    });
    return r;
  }

  private startDemo(): void {
    this.mode = 'demo';
    const a = ROSTER[Math.floor(Math.random() * ROSTER.length)];
    const b = ROSTER[Math.floor(Math.random() * ROSTER.length)];
    const seed = (Math.random() * 1e9) | 0;
    const state = createMatch(defaultConfig({ fighters: [a, b], seed }));
    for (const f of state.fighters) f.meter = 200;
    this.bots = [new Bot(BOT_LEVELS.hard, seed), new Bot(BOT_LEVELS.hard, seed + 1)];
    this.runner = this.makeRunner(state, [this.bots[0], this.bots[1]]);
    this.hud.show(false);
    this.touch.setVisible(false);
    this.training = null;
  }

  startMatch(mode: Mode): void {
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
    this.runner = this.makeRunner(state, [new MergedSource(p1), p2 ?? new NullSource()]);
    this.stats = { maxCombo: [0, 0], damage: [0, 0], specials: [0, 0] };
    this.hud.setup(state, [this.view.accentFor(state, 0), this.view.accentFor(state, 1)]);
    this.hud.show(true);
    this.touch.setVisible(this.touchEnabled);
    this.training = mode === 'training' ? new TrainingMonitor(this.hud.trainingInfo) : null;
    this.closeScreen();
    this.audio.startMusic();
  }

  private onEvents(s: GameState, ev: readonly SimEvent[]): void {
    this.audio.onEvents(s, ev, this.mode === 'demo' ? 0.35 : 1);
    if (this.mode === 'demo') return;
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
    if (!this.runner || this.mode === 'demo' || this.resultsShown) return;
    if (this.mode === 'online') {
      if (this.screen) this.closeScreen();
      else this.showOnlinePause();
      return;
    }
    if (this.runner.paused) {
      this.runner.paused = false;
      this.closeScreen();
    } else {
      this.runner.paused = true;
      this.showPause();
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.mode !== 'demo') this.togglePause();
    }
    if (e.code === 'F1' || e.code === 'KeyH') {
      if (e.code === 'F1') e.preventDefault();
      if (e.code === 'F1' || this.mode === 'training') this.view.debug = !this.view.debug;
    }
    if (this.mode === 'training' && e.code === 'KeyR') this.startMatch('training');
    if (this.mode === 'training' && e.code === 'Period' && this.runner?.paused) this.runner.requestStep();
    if (this.screen) {
      if (e.code === 'Enter' || e.code === 'KeyJ') {
        const sel = this.screen.querySelector<HTMLButtonElement>('button.sel') ?? this.screen.querySelector<HTMLButtonElement>('[data-default]');
        if (sel && document.activeElement !== sel) sel.click();
      }
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyS') this.moveFocus(e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : -1);
    }
  }

  private moveFocus(dir: number): void {
    const btns = [...this.screen!.querySelectorAll<HTMLButtonElement>('.menu button:not(:disabled)')];
    if (!btns.length) return;
    const i = btns.findIndex((b) => b.classList.contains('sel'));
    btns.forEach((b) => b.classList.remove('sel'));
    const n = btns[(i + dir + btns.length) % btns.length];
    n.classList.add('sel');
    n.focus();
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
    const first = el.querySelector<HTMLButtonElement>('.menu button:not(:disabled)');
    first?.classList.add('sel');
    el.querySelectorAll<HTMLButtonElement>('.menu button').forEach((b) =>
      b.addEventListener('pointerenter', () => {
        el.querySelectorAll('.menu button').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
      }),
    );
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => this.audio.ui('click')));
    return el;
  }

  showTitle(): void {
    const el = this.open(
      `<div class="logo">RAPBRAWL</div>
       <div class="subtitle">VERTICAL SLICE · PROTOTYPE BUILD</div>
       <div class="press">${this.touchEnabled ? 'TAP TO START' : 'PRESS ENTER'}</div>
       <button data-default style="position:absolute;inset:0;opacity:0" aria-label="Start"></button>`,
      'title-screen clear',
    );
    el.querySelector('button')!.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.startMusic();
      this.showMenu();
    });
  }

  showMenu(): void {
    const el = this.open(
      `<div class="logo" style="font-size:clamp(44px,7vw,90px)">RAPBRAWL</div>
       <div class="menu">
         <button class="mbtn" data-m="cpu"><span>VERSUS CPU<small>1 player vs the machine</small></span></button>
         <button class="mbtn" data-m="local"><span>LOCAL VERSUS<small>2 players · one keyboard / gamepads</small></span></button>
         <button class="mbtn" data-m="training"><span>TRAINING<small>Hitboxes · frame data · dummy</small></span></button>
         <button class="mbtn" data-m="online"><span>ONLINE<small>Rollback netplay · experimental</small></span></button>
         <button class="mbtn" data-m="help"><span>HOW TO PLAY</span></button>
       </div>`,
      'clear',
    );
    el.querySelectorAll<HTMLButtonElement>('[data-m]').forEach((b) =>
      b.addEventListener('click', () => {
        const m = b.dataset.m!;
        if (m === 'help') this.showHelp(() => this.showMenu());
        else this.showSelect(m as Mode);
      }),
    );
  }

  showHelp(back: () => void): void {
    const el = this.open(
      `<h2>HOW TO PLAY</h2>
       <dl class="movelist">
         <dt>Move / Jump / Crouch</dt><dd>Keyboard A D W S · Touch: left-side stick · Double-tap forward/back to dash</dd>
         <dt>Light / Heavy</dt><dd>J / K · Touch L / H · combine with ↓ for low attacks, → + Heavy = overhead</dd>
         <dt>Grab</dt><dd>L · Beats blocking. Press Grab right when grabbed to tech.</dd>
         <dt>Block</dt><dd>Hold Space (or hold back). Hold ↓ too to block lows. Overheads and jump-ins must be blocked standing.</dd>
         <dt>Special cards</dt><dd>U / I / O · Touch: card buttons. Cost Hype meter (bars). Build Hype by attacking, blocking, getting hit.</dd>
         <dt>Combos</dt><dd>Light → Light → Heavy chains. Lights and Heavies cancel into special cards when they connect.</dd>
         <dt>Signature</dt><dd>3 bars. If it hits, a cinematic finisher plays. Blocked or whiffed = heavy punishment.</dd>
         <dt>Player 2</dt><dd>Arrows move · , . / = Light Heavy Grab · Right Shift block · M N B cards</dd>
         <dt>Pause</dt><dd>Esc / P · Training: H hitboxes, R reset, pause + . frame step</dd>
       </dl>
       <div class="row" style="margin-top:16px"><div class="menu" style="margin:0"><button class="mbtn" data-back><span>BACK</span></button></div></div>`,
    );
    el.querySelector('[data-back]')!.addEventListener('click', back);
  }

  showSelect(mode: Mode, player = 0): void {
    const who = mode === 'local' ? `PLAYER ${player + 1}` : player === 0 ? 'YOUR FIGHTER' : 'OPPONENT';
    const cards = ROSTER.map((id) => {
      const d = getFighter(id);
      const accent = CHARACTER_VISUALS[id].accents[0];
      const spd = Math.round((d.walkF / 600) * 100);
      const pow = id === 'brick' ? 90 : 60;
      const hp = Math.round((d.health / Math.max(...ROSTER.map((r) => getFighter(r).health))) * 100);
      return `<button class="fcard ${this.sel.fighters[player] === id ? 'sel' : ''}" data-f="${id}" style="--accent:${accent}">
        <div class="arch">${d.archetype.toUpperCase()}</div>
        <div class="fname">${d.name}</div>
        <div class="tag">${d.tagline}</div>
        <div class="stat">HEALTH<i><b style="transform:scaleX(${hp / 100})"></b></i></div>
        <div class="stat">SPEED<i><b style="transform:scaleX(${spd / 100})"></b></i></div>
        <div class="stat">POWER<i><b style="transform:scaleX(${pow / 100})"></b></i></div>
      </button>`;
    }).join('');
    const levels = Object.entries(BOT_LEVELS)
      .map(([k, l]) => `<button class="toggle ${this.sel.level === k ? 'on' : ''}" data-lv="${k}">${l.name}</button>`)
      .join('');
    const el = this.open(
      `<div class="who">${who}</div>
       <h2>CHOOSE YOUR FIGHTER</h2>
       <div class="fighters">${cards}</div>
       ${mode !== 'local' && mode !== 'online' && player === 0 ? `<div class="row" style="margin-top:14px"><span class="hint">CPU LEVEL</span>${levels}</div>` : ''}
       <div class="row" style="margin-top:18px">
         <button class="cta alt" data-back><span>BACK</span></button>
         <button class="cta" data-next data-default><span>NEXT</span></button>
       </div>`,
      'clear',
    );
    el.querySelectorAll<HTMLButtonElement>('[data-f]').forEach((b) =>
      b.addEventListener('click', () => {
        this.sel.fighters[player] = b.dataset.f!;
        if (validateLoadout(b.dataset.f!, this.sel.loadouts[player]))
          this.sel.loadouts[player] = getFighter(b.dataset.f!).defaultLoadout.slice();
        el.querySelectorAll('.fcard').forEach((x) => x.classList.toggle('sel', x === b));
      }),
    );
    el.querySelectorAll<HTMLButtonElement>('[data-lv]').forEach((b) =>
      b.addEventListener('click', () => {
        this.sel.level = b.dataset.lv as keyof typeof BOT_LEVELS;
        el.querySelectorAll('[data-lv]').forEach((x) => x.classList.toggle('on', x === b));
      }),
    );
    el.querySelector('[data-back]')!.addEventListener('click', () => (player === 0 ? this.showMenu() : this.showSelect(mode, 0)));
    el.querySelector('[data-next]')!.addEventListener('click', () => {
      if (mode === 'local' && player === 0) this.showSelect(mode, 1);
      else if (mode !== 'local' && player === 0) {
        // CPU / dummy picks the other fighter by default
        const other = ROSTER.find((id) => id !== this.sel.fighters[0]) ?? ROSTER[0];
        this.sel.fighters[1] = mode === 'training' ? this.sel.fighters[1] : other;
        if (validateLoadout(this.sel.fighters[1], this.sel.loadouts[1]))
          this.sel.loadouts[1] = getFighter(this.sel.fighters[1]).defaultLoadout.slice();
        this.showLoadout(mode, 0);
      } else this.showLoadout(mode, 0);
    });
  }

  showLoadout(mode: Mode, player: number): void {
    const fid = this.sel.fighters[player];
    const def = getFighter(fid);
    const chosen = this.sel.loadouts[player].slice();
    const render = () => {
      const grid = def.cards
        .map((c) => {
          const slot = chosen.indexOf(c.id);
          const bars = c.cost / 100;
          const pips = [0, 1, 2].map((i) => `<i class="${i < bars ? '' : 'off'}"></i>`).join('');
          return `<button class="lcard ${slot >= 0 ? 'on' : ''}" data-c="${c.id}">
            ${slot >= 0 ? `<span class="slot">${slot + 1}</span>` : ''}
            <span class="lc-cat cat-${c.category}">${CAT_NAMES[c.category].toUpperCase()}</span>
            <span class="lc-name">${c.name}</span>
            <span class="lc-role">${c.role}</span>
            <span class="lc-desc">${c.description}</span>
            <span class="lc-cost">${pips} ${c.cost ? `${bars} BAR${bars > 1 ? 'S' : ''}` : 'FREE'}</span>
          </button>`;
        })
        .join('');
      const err = chosen.length === LOADOUT_SLOTS ? validateLoadout(fid, chosen) : null;
      return { grid, err };
    };
    const el = this.open(
      `<div class="who">${mode === 'local' ? `PLAYER ${player + 1} · ` : ''}${def.name} · LOADOUT</div>
       <h2>EQUIP ${LOADOUT_SLOTS} SPECIAL CARDS</h2>
       <div class="hint">Same fighter, different game plan. Max one Signature card. Rarity never changes power.</div>
       <div class="loadout-grid"></div>
       <div class="toast"></div>
       <div class="row">
         <button class="cta alt" data-back><span>BACK</span></button>
         <button class="cta alt" data-reset><span>DEFAULT</span></button>
         <div class="spacer"></div>
         <button class="cta" data-go data-default><span>${mode === 'local' && player === 0 ? 'NEXT' : 'FIGHT'}</span></button>
       </div>`,
    );
    const grid = el.querySelector('.loadout-grid')!;
    const toast = el.querySelector('.toast')!;
    const go = el.querySelector<HTMLButtonElement>('[data-go]')!;
    const refresh = () => {
      const r = render();
      grid.innerHTML = r.grid;
      toast.textContent = chosen.length < LOADOUT_SLOTS ? `Select ${LOADOUT_SLOTS - chosen.length} more` : (r.err ?? '');
      go.disabled = chosen.length !== LOADOUT_SLOTS || !!r.err;
      grid.querySelectorAll<HTMLButtonElement>('[data-c]').forEach((b) =>
        b.addEventListener('click', () => {
          this.audio.ui('click');
          const id = b.dataset.c!;
          const i = chosen.indexOf(id);
          if (i >= 0) chosen.splice(i, 1);
          else {
            const card = getCard(fid, id);
            if (card.category === 'signature') {
              const j = chosen.findIndex((x) => getCard(fid, x).category === 'signature');
              if (j >= 0) chosen.splice(j, 1);
            }
            if (chosen.length >= LOADOUT_SLOTS) chosen.shift();
            chosen.push(id);
          }
          refresh();
        }),
      );
    };
    refresh();
    el.querySelector('[data-back]')!.addEventListener('click', () => (player === 1 ? this.showLoadout(mode, 0) : this.showSelect(mode, mode === 'local' ? 1 : 0)));
    el.querySelector('[data-reset]')!.addEventListener('click', () => {
      chosen.splice(0, chosen.length, ...def.defaultLoadout);
      refresh();
    });
    go.addEventListener('click', () => {
      if (go.disabled) return;
      this.sel.loadouts[player] = chosen.slice();
      if (mode === 'local' && player === 0) this.showLoadout(mode, 1);
      else this.startMatch(mode);
    });
  }

  private showPause(): void {
    const training = this.mode === 'training';
    const dummyModes: [string, string][] = [
      ['stand', 'STAND'],
      ['crouch', 'CROUCH'],
      ['blockAll', 'BLOCK ALL'],
      ['block', 'BLOCK (BACK)'],
      ['jump', 'JUMP'],
      ['cpu', 'CPU'],
    ];
    const bot = this.bots[0];
    const el = this.open(
      `<h2>PAUSED</h2>
       ${
         training
           ? `<div class="row" style="margin-top:10px"><span class="hint">DUMMY</span>${dummyModes
               .map(([k, n]) => `<button class="toggle ${bot?.dummy === k ? 'on' : ''}" data-d="${k}">${n}</button>`)
               .join('')}</div>
              <div class="row" style="margin-top:8px"><button class="toggle ${this.view.debug ? 'on' : ''}" data-hb>HITBOXES</button></div>`
           : ''
       }
       <div class="menu">
         <button class="mbtn" data-a="resume"><span>RESUME</span></button>
         <button class="mbtn" data-a="restart"><span>RESTART</span></button>
         <button class="mbtn" data-a="loadout"><span>CHANGE LOADOUT</span></button>
         <button class="mbtn" data-a="help"><span>CONTROLS</span></button>
         <button class="mbtn" data-a="quit"><span>MAIN MENU</span></button>
       </div>`,
      'center',
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
      b.addEventListener('click', () => {
        const a = b.dataset.a;
        if (a === 'resume') this.togglePause();
        else if (a === 'restart') this.startMatch(this.mode);
        else if (a === 'loadout') this.showLoadout(this.mode, 0);
        else if (a === 'help') this.showHelp(() => this.showPause());
        else if (a === 'quit') this.quitToMenu();
      }),
    );
  }

  private quitToMenu(): void {
    this.leaveNet();
    this.localIdx = 0;
    this.startDemo();
    this.showMenu();
  }

  private showResults(): void {
    this.resultsShown = true;
    const s = this.runner!.state;
    const w = s.matchWinner;
    const name = w === 2 ? 'DRAW' : `${getFighter(s.fighters[w].def).name} WINS`;
    const sub =
      this.mode === 'cpu'
        ? w === 0 ? 'YOU WIN' : w === 1 ? 'CPU WINS' : ''
        : this.mode === 'online'
          ? w === this.localIdx ? 'YOU WIN' : w < 2 ? 'YOU LOSE' : ''
          : w < 2 ? `PLAYER ${w + 1}` : '';
    const el = this.open(
      `<div class="who">${sub}</div>
       <div class="result-win">${name}</div>
       <div class="stats">
         <div>MAX COMBO<b>${this.stats.maxCombo[0]} / ${this.stats.maxCombo[1]}</b></div>
         <div>DAMAGE<b>${this.stats.damage[0]} / ${this.stats.damage[1]}</b></div>
         <div>CARDS USED<b>${this.stats.specials[0]} / ${this.stats.specials[1]}</b></div>
       </div>
       <div class="menu">
         ${this.mode === 'online' ? '' : '<button class="mbtn" data-a="rematch"><span>REMATCH</span></button><button class="mbtn" data-a="loadout"><span>CHANGE LOADOUT</span></button>'}
         <button class="mbtn" data-a="select"><span>CHARACTER SELECT</span></button>
         <button class="mbtn" data-a="menu"><span>MAIN MENU</span></button>
       </div>`,
      'center',
    );
    el.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) =>
      b.addEventListener('click', () => {
        const a = b.dataset.a;
        if (a === 'rematch') this.startMatch(this.mode);
        else if (a === 'loadout') this.showLoadout(this.mode, 0);
        else if (a === 'select') {
          const m = this.mode;
          this.quitToMenu();
          this.showSelect(m, 0);
        } else this.quitToMenu();
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
    const src: InputSource[] = [new KeyboardSource(P1_KEYS), new GamepadSource(0)];
    if (this.touchEnabled) src.push(this.touch);
    const r = new NetMatchRunner(res.cfg, this.view, res.local, new MergedSource(src), t);
    r.listeners.push({ onEvents: (s, ev) => this.onEvents(s, ev) });
    this.runner = r;
    this.bots = [];
    this.stats = { maxCombo: [0, 0], damage: [0, 0], specials: [0, 0] };
    this.hud.setup(r.state, [this.view.accentFor(r.state, 0), this.view.accentFor(r.state, 1)]);
    this.hud.show(true);
    this.touch.setVisible(this.touchEnabled);
    this.training = null;
    this.closeScreen();
    this.audio.startMusic();
  }

  private connectionLost(): void {
    this.resultsShown = true;
    this.leaveNet();
    const el = this.open(
      `<h2>CONNECTION LOST</h2>
       <div class="hint">No data from the other player for 6 seconds.</div>
       <div class="menu"><button class="mbtn" data-a="menu"><span>MAIN MENU</span></button></div>`,
      'center',
    );
    el.querySelector('[data-a]')!.addEventListener('click', () => this.quitToMenu());
  }

  private showOnlinePause(): void {
    const el = this.open(
      `<h2>ONLINE MATCH</h2>
       <div class="hint">The match keeps running while this menu is open.</div>
       <div class="menu">
         <button class="mbtn" data-a="resume"><span>BACK TO FIGHT</span></button>
         <button class="mbtn" data-a="quit"><span>LEAVE MATCH</span></button>
       </div>`,
      'center',
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
      `<div class="who">ONLINE · EXPERIMENTAL · ${getFighter(mine.fighter).name}</div>
       <h2>PLAY ONLINE</h2>
       <div class="online-grid">
         <section class="opanel">
           <h3>FRIEND MATCH</h3>
           <p class="hint">Direct peer-to-peer connection. Exchange two codes with your friend over chat. Strict mobile networks can block it.</p>
           <div class="row"><button class="cta" data-host><span>CREATE INVITE</span></button><button class="cta alt" data-join><span>JOIN INVITE</span></button></div>
           <div class="rtc-flow"></div>
         </section>
         <section class="opanel">
           <h3>SAME-DEVICE TEST</h3>
           <p class="hint">Open the game in a second browser tab on this device, then host here and join there. Simulated lag shows rollback at work.</p>
           <div class="row"><span class="hint">LAG</span>
             <button class="toggle on" data-lag="0">0 ms</button><button class="toggle" data-lag="60">60 ms</button><button class="toggle" data-lag="120">120 ms</button></div>
           <div class="row"><button class="cta alt" data-bhost><span>HOST ROOM</span></button>
             <input id="room-code" class="code-in" maxlength="4" placeholder="CODE" autocomplete="off" />
             <button class="cta alt" data-bjoin><span>JOIN</span></button></div>
         </section>
       </div>
       <div class="net-status" role="status"></div>
       <div class="row"><button class="cta alt" data-back><span>BACK</span></button></div>`,
    );
    const status = el.querySelector<HTMLElement>('.net-status')!;
    const flow = el.querySelector<HTMLElement>('.rtc-flow')!;
    let lag = 0;
    const say = (t: string, err = false) => {
      status.textContent = t;
      status.classList.toggle('err', err);
    };
    const go = (t: Transport, host: boolean) => {
      say(host ? 'Waiting for the other player…' : 'Joining…');
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
      say(`Room ${code} — in the second tab choose ONLINE, enter ${code} and press JOIN.`);
    });
    el.querySelector('[data-bjoin]')!.addEventListener('click', () => {
      const code = (el.querySelector('#room-code') as HTMLInputElement).value.trim().toUpperCase();
      if (code.length !== 4) return say('Enter the 4-letter room code shown in the host tab.', true);
      go(sameDeviceTransport(code, false, lag), false);
    });
    const codeBox = (label: string, value: string, editable: boolean, id: string) =>
      `<label class="hint" for="${id}">${label}</label><textarea id="${id}" class="code-box" ${editable ? '' : 'readonly'} spellcheck="false">${value}</textarea>`;
    const copyBtn = (id: string) => {
      const b = document.createElement('button');
      b.className = 'toggle';
      b.textContent = 'COPY CODE';
      b.addEventListener('click', () => {
        const ta = el.querySelector<HTMLTextAreaElement>('#' + id)!;
        navigator.clipboard?.writeText(ta.value).then(
          () => (b.textContent = 'COPIED'),
          () => {
            ta.select();
            b.textContent = 'SELECTED — COPY IT';
          },
        );
      });
      return b;
    };
    el.querySelector('[data-host]')!.addEventListener('click', async () => {
      if (typeof RTCPeerConnection === 'undefined') return say('This browser cannot make peer-to-peer connections. Use the same-device test.', true);
      const rtc = new RtcTransport();
      flow.innerHTML = '<div class="hint">Creating invite…</div>';
      try {
        const invite = await rtc.createInvite();
        flow.innerHTML = `${codeBox('1. Send this invite code to your friend', invite, false, 'inv')}<div class="row copy-row"></div>${codeBox('2. Paste your friend’s reply code', '', true, 'rep')}<div class="row"><button class="cta" data-connect><span>CONNECT</span></button></div>`;
        flow.querySelector('.copy-row')!.appendChild(copyBtn('inv'));
        rtc.onOpen = () => go(rtc, true);
        flow.querySelector('[data-connect]')!.addEventListener('click', async () => {
          try {
            await rtc.acceptReply(flow.querySelector<HTMLTextAreaElement>('#rep')!.value);
            say('Connecting…');
          } catch {
            say('That reply code is not valid. Ask your friend to copy it again.', true);
          }
        });
      } catch (e) {
        say(`Could not create an invite: ${(e as Error).message}`, true);
      }
    });
    el.querySelector('[data-join]')!.addEventListener('click', () => {
      if (typeof RTCPeerConnection === 'undefined') return say('This browser cannot make peer-to-peer connections. Use the same-device test.', true);
      flow.innerHTML = `${codeBox('1. Paste the invite code from your friend', '', true, 'inv')}<div class="row"><button class="cta" data-next><span>CREATE REPLY</span></button></div>`;
      flow.querySelector('[data-next]')!.addEventListener('click', async () => {
        const rtc = new RtcTransport();
        try {
          const reply = await rtc.acceptInvite(flow.querySelector<HTMLTextAreaElement>('#inv')!.value);
          flow.innerHTML = `${codeBox('2. Send this reply code back. The match starts when you are connected.', reply, false, 'rep')}<div class="row copy-row"></div>`;
          flow.querySelector('.copy-row')!.appendChild(copyBtn('rep'));
          rtc.onOpen = () => go(rtc, false);
          say('Waiting for the host to connect…');
        } catch {
          say('That invite code is not valid. Ask your friend to copy it again.', true);
        }
      });
    });
    el.querySelector('[data-back]')!.addEventListener('click', () => this.showLoadout('online', 0));
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
  freezeMove(idx: number, key: string): number {
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
    f.mf = mv.hits[0]?.start ?? mv.projectile?.frame ?? 1;
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
