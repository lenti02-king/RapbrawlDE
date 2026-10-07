// Design v2 fighter roster (PO master ref/v2/fighters.webp): roster cards on the left (our fighters' portraits over
// the master's coloured cards, free slots stay locked silhouettes), the chosen fighter in 3D in the middle, info panel
// on the right (class, level, ANGRIFF / TEMPO / LEBEN, the three ability cards), AUSWÄHLEN = favourite fighter.
import { de, esc } from '../menu/kit';
import { menuFigures } from '../menu/figures';
import { FIGHTERS_ART, FIGHTERS_CARDS, FIGHTERS_DIR, FIGHTERS_FEET, FIGHTERS_FIG_H, FIGHTERS_LIGHTS, FIGHTERS_PLATE, FIGHTERS_TEXT } from './art/fighters';
import { topBarHtml, type TopBar } from './arena';
import { button, hazeHtml, lightsHtml, mountV2, plateHtml, screenHtml, src, t, zone, type ScreenArt } from './stage';

const A: ScreenArt = { dir: FIGHTERS_DIR, plate: FIGHTERS_PLATE, art: FIGHTERS_ART, lights: FIGHTERS_LIGHTS };
const T = FIGHTERS_TEXT;

export interface RosterEntry {
  id: string;
  name: string;
  img: string; // 3/4 portrait
  cls: number; // tab index 1..4 (SCHLÄGER, RAPPER, TEMPO, VERTEIDIGER)
  fav?: boolean;
}
export interface FighterInfo {
  id: string;
  name: string;
  cls: string;
  level: number;
  levelMax: number;
  stats: [number, number, number]; // 0..1: ANGRIFF, TEMPO, LEBEN
  values: [number, number, number];
  cards: { name: string; art: string }[];
  fav: boolean;
}

/** The master's own currency pills (baked in the plate): native amounts + tap areas. */
function pills(bar: TopBar): string {
  const C = T.cur;
  const tap = (b: readonly number[], act: string, label: string, inner = '') =>
    `<button class="v2-hit" data-act="${act}" aria-label="${label}" style="--x:${b[0]};--y:${b[1]};--w:${b[2] - b[0]};--h:${b[3] - b[1]}">${inner}</button>`;
  const amt = (v: string, z: readonly number[], b: readonly number[]) => t(v, [z[0] - 6, z[1], z[2] + 10, z[3]], b[0], b[1], { cls: 'v2-num', fs: 27 });
  return `${tap(C.t_coins, 'shop', 'Münzen', amt(de(bar.coins), C.coins, C.t_coins))}
    ${tap(C.t_gems, 'shop', 'Diamanten', amt(de(bar.gems), C.gems, C.t_gems))}
    ${tap(C.t_energy, 'shop', 'Energie', amt(bar.energy, C.energy, C.t_energy))}
    ${tap(C.t_mail, 'news', 'Postfach')}${tap(C.t_gear, 'settings', 'Einstellungen')}`;
}

const TABS = ['ALLE', 'SCHLÄGER', 'RAPPER', 'TEMPO', 'ABWEHR'];

/** The master's card colours in slot order (gold, purple, blue, red, green, purple, gold, blue, ...). */
const CARD_TINT = ['255 196 60', '170 90 255', '70 140 255', '255 70 70', '80 220 120', '170 90 255', '255 196 60', '70 140 255', '255 70 70', '80 220 120', '170 90 255', '255 196 60'];

export function fightersHtml(roster: RosterEntry[], cur: FighterInfo, tab: number, bar: TopBar): string {
  const [fx, fy] = FIGHTERS_FEET;
  const back = `${plateHtml(A)}${lightsHtml(A, 20)}
    <span class="fig-anchor" data-fig="0" style="--x:${fx - FIGHTERS_FIG_H / 4};--y:${fy - FIGHTERS_FIG_H};--w:${FIGHTERS_FIG_H / 2};--h:${FIGHTERS_FIG_H}"></span>`;
  const shown = roster.filter((r) => tab === 0 || r.cls === tab);
  const cards = FIGHTERS_CARDS.map((c, i) => {
    const r = shown[i];
    const box = `--x:${c[0]};--y:${c[1]};--w:${c[2] - c[0]};--h:${c[3] - c[1]}`;
    const lvz = T.roster[`lv${i}` as 'lv0'];
    if (!r) return `<button class="v2-hit v2-rcard locked" data-locked aria-label="Kommt bald" style="${box}"></button>${t('BALD', [c[0] + 6, lvz[1], c[2] - 6, lvz[3]], 0, 0, { cls: 'v2-small v2-dim', fs: 22, align: 'right' })}`;
    // the card's own colour behind the portrait (the master's placeholder silhouettes must not show through); the name
    // sits right of the class icon, centred, shrunk to fit (D43: names were right-aligned over the icon and cut off)
    return `<button class="v2-hit v2-rcard ${r.id === cur.id ? 'on' : ''}" data-f="${r.id}" aria-label="${esc(r.name)}" style="${box};--tint:${CARD_TINT[i % CARD_TINT.length]}">
        <span class="v2-rpic"><img alt="" src="${r.img}"></span>${r.fav ? '<span class="v2-fav">★</span>' : ''}</button>
      ${t(r.name, [c[0] + 50, lvz[1] - 2, c[2] - 6, lvz[3] + 2], 0, 0, { cls: 'v2-label', fs: 22, align: 'center' })}`;
  }).join('');
  const tabs = TABS.map((label, i) => {
    const k = ['all', 'brawler', 'rapper', 'speed', 'defender'][i] as 'all';
    const tb = T.tabs[`t${i}` as 't0'];
    return `<button class="v2-hit v2-tab2 ${i === tab ? 'on' : ''}" data-tab="${i}" aria-label="${label}" style="--x:${tb[0]};--y:${tb[1]};--w:${tb[2] - tb[0]};--h:${tb[3] - tb[1]}">${t(label, [T.tabs[k][0] - 18, T.tabs[k][1], T.tabs[k][2] + 18, T.tabs[k][3]], tb[0], tb[1], { cls: `v2-nav ${i === tab ? 'on' : ''}`, fs: 22, align: 'center' })}</button>`;
  }).join('');
  const I = T.info;
  const fill = (id: 'fill_p' | 'fill_s' | 'fill_d' | 'fill_lv', b: readonly number[], v: number) => {
    const [, , , h] = FIGHTERS_ART[id];
    return `<img class="v2-art v2-fill" alt="" src="${src(A, id)}" style="--x:${b[0]};--y:${b[1]};--w:${Math.max(6, Math.round((b[2] - b[0]) * Math.min(1, v)))};--h:${h}">`;
  };
  const stat = (k: 0 | 1 | 2, label: string, l: readonly number[], v: readonly number[], b: readonly number[], id: 'fill_p' | 'fill_s' | 'fill_d') =>
    `${t(label, [l[0], l[1], l[0] + 110, l[3]], 0, 0, { cls: 'v2-label', fs: 24 })}${fill(id, b, cur.stats[k])}${t(de(cur.values[k]), [v[0] - 20, v[1], v[2], v[3]], 0, 0, { cls: 'v2-label', fs: 24, align: 'right' })}`;
  const C = T.cards;
  const card = (k: 0 | 1 | 2) => {
    const c = cur.cards[k];
    const w = k === 0 ? C.c1 : k === 1 ? C.c2 : C.c3;
    const n = k === 0 ? C.n1 : k === 1 ? C.n2 : C.n3;
    return c
      ? `<span class="v2-win2 ${k === 2 ? 'v2-sig' : ''}" style="--x:${w[0]};--y:${w[1]};--w:${w[2] - w[0]};--h:${w[3] - w[1]}">${c.art ? `<img alt="" src="${c.art}">` : ''}</span>
         ${t(c.name, [w[0] - 2, n[1], w[2] + 2, n[3]], 0, 0, { cls: `v2-label ${k === 2 ? 'v2-gold' : ''}`, fs: 18, align: 'center' })}`
      : '';
  };
  const S = T.select.label;
  const front = `${hazeHtml([600, 720, 1200, 900], '255 190 90', 0.45)}
    ${topBarHtml(null, null)}
    ${pills(bar)}
    ${tabs}${cards}
    ${t(cur.name, [I.name[0] - 10, I.name[1], 1650, I.name[3]], 0, 0, { cls: 'v2-label v2-big', fs: 60 })}
    ${t(cur.cls, [I.cls[0] - 6, I.cls[1], I.cls[2] + 6, I.cls[3]], 0, 0, { cls: 'v2-ink', fs: 24, align: 'center' })}
    ${t(`Lv. ${cur.level} / ${cur.levelMax}`, [I.lv[0], I.lv[1], I.lv[2] + 6, I.lv[3]], 0, 0, { cls: 'v2-label', fs: 28 })}
    ${fill('fill_lv', I.lvbar, cur.level / cur.levelMax)}
    ${stat(0, 'ANGRIFF', I.p_l, I.p_v, I.pbar, 'fill_p')}${stat(1, 'TEMPO', I.s_l, I.s_v, I.sbar, 'fill_s')}${stat(2, 'LEBEN', I.d_l, I.d_v, I.dbar, 'fill_d')}
    ${t('FÄHIGKEITEN', [I.abil[0], I.abil[1], I.abil[2] + 70, I.abil[3]], 0, 0, { cls: 'v2-marker', fs: 36 })}
    ${card(0)}${card(1)}${card(2)}
    <button class="v2-hit v2-chip" data-custom aria-label="Anpassen" style="--x:830;--y:872;--w:180;--h:44"><span>ANPASSEN</span></button>
    ${button(A, 'select', 'select', cur.fav ? 'Favorit' : 'Auswählen', (ox, oy) => t(cur.fav ? '★ FAVORIT' : 'AUSWÄHLEN', zone([S[0] - 30, S[1], S[2] + 40, S[3]]), ox, oy, { cls: 'v2-brush', fs: cur.fav ? 70 : 64, align: 'center' }), cur.fav ? '' : 'v2-main', `--mask:url(${src(A, 'select')})`)}`;
  return screenHtml(back, front);
}

export function mountFighters(root: HTMLElement, id: string): () => void {
  root.classList.add('v2-fighters');
  const stop = mountV2(root, { hues: [40, 30, 50], living: A, haze: [0.6, 0.45, 0.32], crowdY: 0.45 });
  const figs = menuFigures(root);
  const anchor = root.querySelector<HTMLElement>('[data-fig="0"]');
  if (anchor) figs.set([{ id, anchor, facing: 1, rim: 0xffb02e, rim2: 0xff6a2e, turn: 0.75, showcase: true }]);
  return () => {
    stop();
    figs.dispose();
  };
}
