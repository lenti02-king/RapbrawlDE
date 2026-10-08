// Design v2 screens without their own PO master (D43): Profil, Einstellungen, Karten (deck), Ergebnis and Pause.
// They stand in the ring of the loading master (logo removed by tools/ui-extract/v2_ring.py; living plate with the
// crowd, lights and haze), wear the masters' panel look (navy glass with a blue neon edge, gold for the important
// one, the chained gold button, marker headings) and keep a live 3D fighter in the middle of the ring.
// Results and pause lie over the running arena instead (the winner celebrates in the match itself).
import './ring.css';
import { isV4 } from '../design';
import { esc } from '../menu/kit';
import { menuFigures } from '../menu/figures';
import { LINE } from '../lines';
import { RING_DIR, RING_LIGHTS, RING_PLATE } from './art/ring';
import { HOME_CLEAN_DIR, HOME_CLEAN_LIGHTS, HOME_CLEAN_PLATE } from '../v4/art/home_clean';
import { FIGHTERS_DIR } from './art/fighters';
import { topBarHtml, type TopBar } from './arena';
import { hazeHtml, lightsHtml, mountV2, plateHtml, screenHtml, t, type ScreenArt } from './stage';

const A2: ScreenArt = { dir: RING_DIR, plate: RING_PLATE, art: {}, lights: RING_LIGHTS };
/** Design v4 (D47): the Frankfurt scene of the PO's home master without its UI; the fighter on its pedestal. */
const A4: ScreenArt = { dir: HOME_CLEAN_DIR, plate: HOME_CLEAN_PLATE, art: {}, lights: HOME_CLEAN_LIGHTS };
const art = (): ScreenArt => (isV4() ? A4 : A2);
const GOLD2 = `${FIGHTERS_DIR}select.webp`; // the master's chained gold button (443 x 113)
const GOLD4 = 'assets/ui4/lobby/btn_gold.webp'; // the v4 lobby's gold button, its lettering removed
const CROWN = `<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M6 46l4-30 12 12 10-20 10 20 12-12 4 30z" fill="currentColor" stroke="#1a0f02" stroke-width="4" stroke-linejoin="round"/></svg>`;

type Rect = [number, number, number, number]; // x, y, w, h in reference px
const at = (r: Rect) => `--x:${r[0]};--y:${r[1]};--w:${r[2]};--h:${r[3]}`;

/** The chained gold button with brush lettering (the main action of a screen). */
export function goldBtn(act: string, label: string, r: Rect, fs = 54, main = true): string {
  const [, , w, h] = r;
  const v4 = isV4();
  const gold = v4 ? GOLD4 : GOLD2;
  // label zone of the sprite (v2 fighters master: 1318..1570 x 778..866 inside 1200..1643 x 772..885; v4: centred)
  const lz: [number, number, number, number] = v4 ? [w * 0.1, h * 0.1, w * 0.9, h * 0.86] : [w * 0.2, h * 0.05, w * 0.85, h * 0.83];
  return `<button class="v2-btn rg-goldbtn ${main ? 'v2-main' : ''}" data-act="${act}" aria-label="${esc(label)}" style="${at(r)};--mask:url(${gold})"><img class="v2-face" alt="" draggable="false" src="${gold}">${t(label, lz, 0, 0, { cls: 'v2-brush', fs: v4 ? Math.round(fs * 0.9) : fs, align: 'center' })}</button>`;
}

/** Navy pill button with a gold rim (secondary actions). */
function pillBtn(act: string, label: string, r: Rect, cls = ''): string {
  return `<button class="rg-pill ${cls}" data-act="${act}" style="${at(r)}"><span>${esc(label)}</span></button>`;
}

function card(r: Rect, inner: string, cls = ''): string {
  return `<div class="rg-card ${cls}" style="${at(r)}">${cls.includes('gold') ? `<span class="rg-crown">${CROWN}</span>` : ''}${inner}</div>`;
}

const head = (s: string, icon = '') => `<div class="rg-head">${icon ? `<span class="rg-hicon">${icon}</span>` : ''}<span>${esc(s)}</span></div>`;
const bar = (p: number, kind = 'gold') => `<span class="rg-bar ${kind}"><b style="width:${Math.round(Math.max(0, Math.min(1, p)) * 100)}%"></b></span>`;

/** Ring backdrop + the figure anchor (feet at the bottom centre of the box). */
function ringBack(fig: boolean, figH = 600, fy = 912): string {
  const fx = 836;
  if (isV4()) [figH, fy] = [352, 694]; // on the pedestal of the Frankfurt scene
  const A = art();
  return `${plateHtml(A)}${lightsHtml(A, 22)}${fig ? `<span class="fig-anchor" data-fig="0" style="--x:${fx - figH / 4};--y:${fy - figH};--w:${figH / 2};--h:${figH}"></span>` : ''}`;
}

/** The ring backdrop with the fighter anchor, for ring screens built elsewhere (FREUNDE). */
export const ringFigure = (figH = 600, fy = 912): string => ringBack(true, figH, fy);

export interface RingMount {
  stop: () => void;
}

/** Mount a ring screen: living plate + the fighter (when `fig` is set; menus only - in a match the game owns the GL). */
export function mountRing(root: HTMLElement, fig: string | null, living = true): () => void {
  root.classList.add('v2-rs');
  if (isV4()) root.classList.add('v4r'); // design v4: the masters' gold-framed panels (v4.css)
  const A = art();
  const stop = mountV2(root, living ? { hues: [40, 210, 320], living: A, haze: [0.42, 0.36, 0.7], crowdY: 0.38, rigid: isV4() ? [[648, 120, 382, 240]] : undefined } : { hues: [40, 210, 320] });
  const figs = fig && living ? menuFigures(root) : null;
  const anchor = root.querySelector<HTMLElement>('[data-fig="0"]');
  if (figs && anchor && fig) figs.set([{ id: fig, anchor, facing: 1, rim: 0xffb02e, rim2: 0x6a7dff, turn: 0.7, showcase: true }]);
  return () => {
    stop();
    figs?.dispose();
  };
}

// ============================================================================================== PROFIL
export interface ProfileModel {
  name: string;
  bust: string;
  level: number;
  xp: number;
  xpPct: number;
  rank: string;
  rankNext: string;
  rankPct: number;
  rp: number;
  matches: number;
  wins: number;
  rate: number;
  bestCombo: number;
  fav: { id: string; name: string };
  history: { r: 'W' | 'L' | 'D'; me: string; opp: string; meImg: string; oppImg: string; mode: string }[];
  fighters: { id: string; name: string; img: string; m: number; w: number }[];
}

export function profileHtml(m: ProfileModel, top: TopBar): string {
  const player = card(
    [40, 112, 556, 226],
    `<div class="rg-player">
       <span class="rg-avatar">${m.bust ? `<img alt="" src="${m.bust}">` : ''}<b class="rg-lv">${m.level}</b></span>
       <div class="rg-col">
         <div class="rg-name">${esc(m.name)}</div>
         <div class="rg-row"><span class="rg-k">LEVEL ${m.level}</span>${bar(m.xpPct, 'blue')}<span class="rg-k">${m.xp} XP</span></div>
         <button class="rg-chip" data-name>NAMEN ÄNDERN</button>
       </div>
     </div>`,
    'gold',
  );
  const rank = card(
    [40, 354, 556, 206],
    `${head('STRASSEN-RANG · LOKAL', LINE.trophy)}
     <div class="rg-rank"><span class="rg-rankcrown">${CROWN}</span><div class="rg-col">
       <div class="rg-rname">${esc(m.rank)}</div>${bar(m.rankPct)}<div class="rg-txt">${esc(m.rankNext)}${m.rp ? ` · RANGLISTE ${m.rp} RP` : ''}</div></div></div>`,
  );
  const kpi = (r: Rect, v: string, l: string) => card(r, `<div class="rg-kpi"><b>${v}</b><span>${l}</span></div>`);
  const kpis = [
    kpi([40, 576, 130, 140], String(m.matches), 'MATCHES'),
    kpi([182, 576, 130, 140], String(m.wins), 'SIEGE'),
    kpi([324, 576, 130, 140], `${m.rate}%`, 'QUOTE'),
    kpi([466, 576, 130, 140], String(m.bestCombo), 'BESTE KOMBO'),
  ].join('');
  const stamp = (r: 'W' | 'L' | 'D') => `<span class="rg-stamp ${r}">${r === 'W' ? 'SIEG' : r === 'L' ? 'NIEDERLAGE' : 'REMIS'}</span>`;
  const rows = m.history.length
    ? m.history
        .map(
          (h) => `<div class="rg-hrow">${stamp(h.r)}<span class="rg-mini">${h.meImg ? `<img alt="" src="${h.meImg}">` : ''}</span><span class="rg-vs">VS</span><span class="rg-mini opp">${h.oppImg ? `<img alt="" src="${h.oppImg}">` : ''}</span>
            <span class="rg-col rg-grow"><b>${esc(h.me)} – ${esc(h.opp)}</b><span class="rg-txt">${esc(h.mode)}</span></span></div>`,
        )
        .join('')
    : `<div class="rg-empty">Noch keine Kämpfe.<br>Ab in den Ring!</div>`;
  const history = card([1076, 112, 556, 470], `${head('LETZTE KÄMPFE', LINE.swords)}<div class="rg-hist">${rows}</div>`);
  const mastery = card(
    [1076, 598, 556, 296],
    `${head('DEINE KÄMPFER', LINE.fighter)}<div class="rg-mast">${m.fighters
      .map(
        (f) => `<div class="rg-mrow ${f.id === m.fav.id ? 'fav' : ''}"><span class="rg-mini">${f.img ? `<img alt="" src="${f.img}">` : ''}</span><b>${esc(f.name)}</b>${bar(f.m ? f.w / f.m : 0, 'red')}<span class="rg-k">${f.w} S / ${f.m} K</span></div>`,
      )
      .join('')}</div>`,
  );
  const front = `${hazeHtml([520, 760, 1150, 930], '170 150 255', 0.5)}
    ${topBarHtml('PROFIL', top)}
    ${player}${rank}${kpis}${history}${mastery}
    <span class="rg-plaque" style="${at([666, 878, 340, 52])}"></span>
    ${t(`★ ${m.fav.name}`, [666, 878, 1006, 930], 0, 0, { cls: 'v2-marker v2-gold', fs: 36, align: 'center' })}
    ${card([40, 732, 556, 162], `${head('NÄCHSTES ZIEL', LINE.crown)}<div class="rg-txt rg-goal">${m.matches ? `Gewinne mit ${esc(m.fav.name)} – jeder Sieg bringt dich ${esc(m.rankNext.replace(/^Noch /, ''))}.` : 'Dein erster Kampf wartet. Wähle einen Kämpfer und ab in den Ring!'}</div>`)}`;
  return screenHtml(ringBack(true, 580, 876), front);
}

// ============================================================================================== EINSTELLUNGEN
export interface SettingRow {
  key: string;
  name: string;
  desc: string;
  kind: 'seg' | 'switch' | 'button';
  value?: string | boolean;
  opts?: [string, string][];
  label?: string;
}

export function settingsHtml(rows: SettingRow[], top: TopBar): string {
  const row = (s: SettingRow, r: Rect) => {
    const ctl =
      s.kind === 'seg'
        ? `<div class="rg-seg">${(s.opts ?? []).map(([v, l]) => `<button class="${s.value === v ? 'on' : ''}" data-set="${s.key}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`
        : s.kind === 'switch'
          ? `<button class="rg-switch ${s.value ? 'on' : ''}" data-toggle="${s.key}" aria-pressed="${!!s.value}"><i></i><span>${s.value ? 'AN' : 'AUS'}</span></button>`
          : `<button class="rg-chip" data-help>${esc(s.label ?? 'ANSEHEN')}</button>`;
    return card(r, `<div class="rg-set"><div class="rg-sname">${esc(s.name)}</div><div class="rg-txt rg-sdesc">${esc(s.desc)}</div><div class="rg-ctl">${ctl}</div></div>`);
  };
  const H = 184;
  const G = 10;
  const cards = rows
    .map((s, i) => {
      const col = i < 4 ? 0 : 1;
      const k = i % 4;
      return row(s, [col ? 1066 : 40, 112 + k * (H + G), 566, H]);
    })
    .join('');
  const front = `${hazeHtml([560, 760, 1110, 930], '170 150 255', 0.5)}${topBarHtml('EINSTELLUNGEN', top)}${cards}`;
  return screenHtml(ringBack(true, 560), front);
}

// ============================================================================================== KARTEN (deck)
export interface DeckCard {
  id: string;
  name: string;
  art: string;
  cat: string; // German category
  color: string; // category colour
  cost: number;
  sig: boolean;
  inDeck: boolean;
}
export interface DeckModel {
  fighter: string;
  side: string[]; // DU / CPU / SPIELER 2 ...
  player: number;
  preset: number;
  deck: DeckCard[];
  all: DeckCard[];
  focus: (DeckCard & { role: string; desc: string }) | null;
  placing: boolean;
  err: string | null;
  done: string;
}

function deckCard(c: DeckCard, cls: string, attr: string): string {
  // a painted card (assets/cards/<id>.webp, PO artwork) wins over the in-engine render, as in the HUD hand
  const bg = `url('assets/cards/${c.id}.webp')${c.art ? `, url('${c.art}')` : ''}`;
  return `<button class="rg-dcard ${c.sig ? 'sig' : ''} ${cls}" ${attr} style="--cat:${c.color}"><span class="rg-dart" style="background-image:${bg}"></span>${
    c.cost ? `<span class="rg-cost">${c.cost}</span>` : ''
  }${c.sig ? `<span class="rg-dcrown">${CROWN}</span>` : ''}<span class="rg-dname">${esc(c.name)}</span></button>`;
}

/** The deck screen's dynamic parts (re-rendered on every tap) */
export function deckParts(m: DeckModel): { slots: string; coll: string; info: string } {
  const slots = m.deck
    .map(
      (c, i) =>
        `<div class="rg-slot">${deckCard(c, `big ${m.focus?.id === c.id ? 'focus' : ''} ${m.placing && !c.sig ? 'wiggle' : ''}`, `data-slot="${i}"`)}<span class="rg-slotl ${c.sig ? 'sig' : ''}">${c.sig ? '★ SIGNATURE · O' : `SPECIAL ${i + 1} · ${i ? 'I' : 'U'}`}</span></div>`,
    )
    .join('');
  const coll = m.all.map((c) => deckCard(c, `${m.focus?.id === c.id ? 'focus' : ''} ${c.inDeck ? 'equipped' : ''}`, `data-card="${c.id}"`)).join('');
  const f = m.focus;
  const info = f
    ? `<div class="rg-info">
        <div class="rg-irow">${deckCard(f, 'huge', 'data-none')}
          <div class="rg-col"><div class="rg-iname">${esc(f.name)}</div>
            <span class="rg-tag" style="--cat:${f.color}">${esc(f.cat.toUpperCase())}</span>
            ${f.cost ? `<span class="rg-tag gold">HYPE-KOSTEN: ${f.cost}</span>` : '<span class="rg-tag gold">VOLLER HYPE</span>'}</div></div>
        <div class="rg-role">${esc(f.role)}</div>
        <div class="rg-txt rg-desc">${esc(f.desc)}</div>
        ${
          f.sig
            ? `<div class="rg-txt rg-hint">Signature-Karten liegen immer im goldenen Slot 3 (Taste O / goldene Karte). Trifft sie, startet die Kino-Sequenz.</div>`
            : f.inDeck
              ? `<div class="rg-txt rg-hint ok">✔ Ist in deinem Deck.</div>`
              : `<button class="rg-chip ${m.placing ? '' : 'on'}" data-use>${m.placing ? 'ABBRECHEN' : 'EINSETZEN'}</button>${m.placing ? '<div class="rg-txt rg-hint">Tippe links auf die Karte, die ersetzt werden soll.</div>' : ''}`
        }
      </div>`
    : `<div class="rg-empty">Tippe auf eine Karte für Details.</div>`;
  return { slots, coll, info };
}

export function deckHtml(m: DeckModel, top: TopBar | null, living: boolean): string {
  const p = deckParts(m);
  const presets = [0, 1, 2].map((i) => `<button class="${i === m.preset ? 'on' : ''}" data-preset="${i}">PRESET ${i + 1}</button>`).join('');
  const sides = m.side.map((s, i) => `<button class="${i === m.player ? `on ${i ? 'p2' : ''}` : ''}" data-p="${i}">${esc(s)}</button>`).join('');
  const front = `${hazeHtml([560, 760, 1110, 930], '170 150 255', 0.5)}
    ${topBarHtml('KARTEN', top)}
    <div class="rg-seg rg-presets" style="${at([40, 110, 380, 46])}">${presets}</div>
    <div class="rg-seg rg-sides" style="${at([432, 110, 164, 46])}">${sides}</div>
    ${card([40, 166, 556, 360], `${head(`DECK · ${m.fighter}`, LINE.cards)}<div class="rg-txt rg-sub">2 Specials + 1 Signature</div><div class="rg-slots" data-slots>${p.slots}</div>`, 'gold')}
    ${card([40, 540, 556, 354], `${head('SAMMLUNG', LINE.grid)}<div class="rg-coll" data-coll>${p.coll}</div>`)}
    ${card([1066, 112, 566, 640], `<div data-info class="rg-infowrap">${p.info}</div>`)}
    <div class="rg-err" data-err style="${at([1066, 756, 566, 26])}">${esc(m.err ?? '')}</div>
    ${goldBtn('ok', m.done, [1128, 784, 443, 113], m.done.length > 6 ? 46 : 56)}`;
  return screenHtml(ringBack(living, 560), front);
}

// ============================================================================================== ERGEBNIS
export interface ResultSide {
  name: string;
  img: string;
  label: string; // DU / CPU / SPIELER 2
  rounds: number;
  damage: number;
  combo: number;
  cards: number;
  win: boolean;
}
export interface ResultModel {
  banner: string;
  kind: 'win' | 'lose' | 'draw';
  sub: string;
  roundsToWin: number;
  sides: [ResultSide, ResultSide];
  xp: number;
  xpPct: number;
  level: number;
  rpLine: string;
  online: boolean;
}

export function resultsHtml(m: ResultModel): string {
  const side = (s: ResultSide, o: ResultSide, i: number) => {
    const row = (l: string, a: number, b: number) =>
      `<div class="rg-srow"><span class="rg-k">${l}</span><b>${a}</b>${bar(a + b ? a / (a + b) : 0.5, i ? 'blue' : 'red')}</div>`;
    const crowns = Array.from({ length: m.roundsToWin }, (_, k) => `<i class="${k < s.rounds ? 'on' : ''}">${CROWN}</i>`).join('');
    return card(
      [i ? 1232 : 40, 236, 400, 470],
      `<div class="rg-rside ${i ? 'p2' : 'p1'}">
         <div class="rg-rtop"><span class="rg-rpic">${s.img ? `<img alt="" src="${s.img}">` : ''}</span>
           <div class="rg-col"><span class="rg-k">${esc(s.label)}</span><div class="rg-rname">${esc(s.name)}</div><div class="rg-crowns">${crowns}</div></div></div>
         ${s.win ? '<span class="rg-stamp W big">SIEGER</span>' : ''}
         ${row('SCHADEN', s.damage, o.damage)}${row('MAX. KOMBO', s.combo, o.combo)}${row('KARTEN', s.cards, o.cards)}
       </div>`,
      s.win ? 'gold' : '',
    );
  };
  const front = `<div class="rg-banner ${m.kind}" style="${at([336, 26, 1000, 190])}"><b data-t="${esc(m.banner)}">${esc(m.banner)}</b></div>
    ${t(m.sub, [436, 206, 1236, 254], 0, 0, { cls: 'v2-marker', fs: 34, align: 'center' })}
    ${side(m.sides[0], m.sides[1], 0)}${side(m.sides[1], m.sides[0], 1)}
    ${card(
      [460, 726, 752, 76],
      `<div class="rg-reward"><span class="rg-k">LEVEL ${m.level}</span>${bar(m.xpPct, 'blue')}<b class="rg-plus">+${m.xp} XP</b>${m.rpLine ? `<span class="rg-tag gold">${esc(m.rpLine)}</span>` : ''}</div>`,
    )}
    ${m.online ? '' : goldBtn('rematch', 'NOCHMAL', [614, 812, 443, 113], 56)}
    ${m.online ? '' : pillBtn('deck', 'DECK', [380, 836, 210, 64])}
    ${pillBtn('menu', 'MENÜ', m.online ? [731, 836, 210, 64] : [1082, 836, 210, 64], 'gray')}`;
  return `<div class="v2-stage front">${front}</div><div class="mm-toast" hidden></div>`;
}

// ============================================================================================== PAUSE
export function pauseHtml(training: string): string {
  const front = `${card(
    [536, 120, 600, 700],
    `<div class="rg-pause"><div class="rg-ptitle">PAUSE</div>${training}
       <button class="rg-pbtn gold" data-a="resume" data-default>WEITER</button>
       <button class="rg-pbtn" data-a="restart">NEUSTART</button>
       <button class="rg-pbtn" data-a="deck">DECK ÄNDERN</button>
       <button class="rg-pbtn" data-a="help">STEUERUNG</button>
       <button class="rg-pbtn red" data-a="quit" data-back>HAUPTMENÜ</button></div>`,
    'gold',
  )}`;
  return `<div class="v2-stage front">${front}</div>`;
}

/** Overlay screens (results, pause) over the running arena: only the layout (no plate, no figures). */
export function mountOverlay(root: HTMLElement): () => void {
  root.classList.add('v2-rs', 'v2-over');
  if (isV4()) root.classList.add('v4r');
  return mountV2(root, { embers: 18, hues: [40, 50, 30] });
}
