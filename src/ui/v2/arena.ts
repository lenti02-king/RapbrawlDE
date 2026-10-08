// Design v2 showcase (PO master ref/v2/arena.webp): the selected item fills the screen (a full render of the arena,
// slow push-in, cross-fade on change); the master's UI pieces (top bar, info panel tiles, yellow button, neon card
// frames, arrows) are cut out with their glow and lie over it. Used for the arena pick, the ARENEN tab and the game
// modes - same data attributes as the v1 showcase (data-item, data-ok, data-back, data-chip), the app logic is shared.
import { de, esc, fitTexts } from '../menu/kit';
import type { ShowcaseItem, ShowcaseOpts } from '../menu/arenaSelect';
import { ARENA_ART, ARENA_CARDS, ARENA_DIR, ARENA_TEXT } from './art/arena';
import { mountV2, screenHtml, src, t, type ScreenArt } from './stage';
import { isV4 } from '../design';
import { topBarV4 } from '../v4/kit4';

const A: ScreenArt = { dir: ARENA_DIR, plate: { l: [], c: [], r: [] }, art: ARENA_ART, lights: [] };
const T = ARENA_TEXT;
const LOGO = 'assets/ui2/shared/logo.webp';
const PER_PAGE = 5;
/** Second-line colours of the card names (cycle, like the master). */
const ACCENT = ['#ff3048', '#2f8bff', '#ffd23c', '#29e06a', '#d34dff', '#ff8a1f'];

export interface TopBar {
  coins: number;
  gems: number;
  energy: string;
  mail?: boolean;
  /** Rank points (design v4: the trophy capsule). */
  trophies?: number;
}

const ICON: Record<string, string> = {
  time: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="#1b2340" stroke="#fff" stroke-width="2"/><path d="M12 7v5.5l3.5 2" stroke="#ffd23c" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>',
  mood: '<svg viewBox="0 0 24 24"><path d="M12 2.5c1 3.5 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-3 1.6-4.4 2.6-6 .5 1.8 1.5 2.8 2.4 3.2-.6-3.4.5-6 .5-8.2z" fill="#ff5a36" stroke="#ffd0a0" stroke-width="1"/><path d="M12 13c1.2 1.4 2.3 2.4 2.3 4.2a2.3 2.3 0 0 1-4.6 0c0-1.5.9-2.4 2.3-4.2z" fill="#ffd23c"/></svg>',
  crowd: '<svg viewBox="0 0 24 24" fill="#ffd23c" stroke="#3a2600" stroke-width=".8"><circle cx="7" cy="8" r="2.6"/><circle cx="17" cy="8" r="2.6"/><circle cx="12" cy="6.5" r="3"/><path d="M2.5 19c.4-3.6 2.2-5.5 4.5-5.5 1.3 0 2.4.6 3.2 1.6M21.5 19c-.4-3.6-2.2-5.5-4.5-5.5-1.3 0-2.4.6-3.2 1.6"/><path d="M6.5 20c.5-4 2.8-6.5 5.5-6.5s5 2.5 5.5 6.5z"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="#2a2f45" stroke="#ffd23c" stroke-width="1.6"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="#ffd23c" stroke-width="2" fill="none"/></svg>',
};
const ROW_ICONS = ['time', 'mood', 'crowd'];

function split(name: string): [string, string] {
  const w = name.split(/[\s-]+/).filter(Boolean);
  if (w.length < 2) return ['', name];
  return [w.slice(0, -1).join(' '), w[w.length - 1]];
}

function cardHtml(it: ShowcaseItem, i: number, on: boolean, slot: number, page: number): string {
  const [x0, y0, x1, y1] = ARENA_CARDS[slot];
  const [a, b] = split(it.name);
  const icons = ROW_ICONS.map((k) => `<span class="v2-slot">${it.locked ? ICON.lock : ICON[k]}</span>`).join('');
  return `<button class="v2-hit v2-card ${on ? 'on' : ''} ${it.locked ? 'locked' : ''}" data-item="${it.id}" data-pg="${page}" aria-label="${esc(it.name)}" style="--x:${x0};--y:${y0};--w:${x1 - x0};--h:${y1 - y0};--acc:${ACCENT[i % ACCENT.length]}">
      <span class="v2-cardpic"><img alt="" draggable="false" decoding="async" src="${it.img}" style="${it.focus ? `object-position:${it.focus};transform-origin:${it.focus};transform:scale(${it.zoom ?? 1})` : ''}"></span>
      <span class="v2-cardname">${a ? `<b>${esc(a)}</b>` : ''}<em>${esc(b)}</em></span>
      ${it.tag ? `<span class="v2-cardtag">${esc(it.tag)}</span>` : ''}
      <span class="v2-slots">${icons}</span>
      <img class="v2-ring on" alt="" src="${src(A, 'card_sel')}" style="--x:${ARENA_ART.card_sel[0] - ARENA_CARDS[0][0]};--y:${ARENA_ART.card_sel[1] - ARENA_CARDS[0][1]};--w:${ARENA_ART.card_sel[2]};--h:${ARENA_ART.card_sel[3]}">
      <img class="v2-ring off" alt="" src="${src(A, 'card')}" style="--x:${ARENA_ART.card[0] - ARENA_CARDS[1][0]};--y:${ARENA_ART.card[1] - ARENA_CARDS[1][1]};--w:${ARENA_ART.card[2]};--h:${ARENA_ART.card[3]}">
    </button>`;
}

function spr(id: keyof typeof ARENA_ART, cls = '', attrs = ''): string {
  const [x, y, w, h] = ARENA_ART[id];
  return `<img class="v2-art ${cls}" ${attrs} alt="" draggable="false" src="${src(A, id)}" style="--x:${x};--y:${y};--w:${w};--h:${h}">`;
}

function btnSpr(id: keyof typeof ARENA_ART, attrs: string, label: string, inner = '', cls = ''): string {
  const [x, y, w, h] = ARENA_ART[id];
  return `<button class="v2-btn ${cls}" ${attrs} aria-label="${esc(label)}" style="--x:${x};--y:${y};--w:${w};--h:${h}"><img class="v2-face" alt="" draggable="false" src="${src(A, id)}">${inner}</button>`;
}

/** The shared top bar of the v2 sub-screens: back, title strip (+ logo), currencies, mail, settings. `title` null =
 *  back button only (screens whose master has its own logo top left). */
export function topBarHtml(title: string | null, bar: TopBar | null): string {
  if (isV4()) return topBarV4(title, bar ? { coins: bar.coins, gems: bar.gems, trophies: bar.trophies ?? 0 } : null);
  const cur = bar
    ? `${spr('coin')}${t(de(bar.coins), [1008, 20, 1080, 58], 0, 0, { cls: 'v2-num', fs: 27 })}${btnSpr('plus1', 'data-act="shop"', 'Münzen')}
       ${spr('gem')}${t(de(bar.gems), [1204, 20, 1266, 58], 0, 0, { cls: 'v2-num', fs: 27 })}${btnSpr('plus2', 'data-act="shop"', 'Diamanten')}
       ${spr('bolt')}${t(bar.energy, [1378, 20, 1446, 58], 0, 0, { cls: 'v2-num', fs: 27 })}${btnSpr('plus3', 'data-act="shop"', 'Energie')}
       ${btnSpr('mail', 'data-act="news"', 'Postfach')}${bar.mail ? spr('badge', 'v2-badge') : ''}
       ${btnSpr('gear', 'data-act="settings"', 'Einstellungen')}`
    : '';
  if (title === null) return `${btnSpr('back', 'data-back', 'Zurück')}${cur}`;
  const w = title.split(' ');
  const [w1, w2] = w.length > 1 ? [w.slice(0, -1).join(' '), w[w.length - 1]] : [title, ''];
  const tt = T.title.label;
  return `${btnSpr('back', 'data-back', 'Zurück')}
    ${spr('title')}
    <span class="mm-t v2-marker v2-title2" style="--x:${tt[0]};--y:${tt[1]};--w:${tt[2] - tt[0] + 6};--h:${tt[3] - tt[1]};--fs:52;justify-content:flex-start"><i data-t="${esc(title)}">${esc(w1)}${w2 ? ` <b>${esc(w2)}</b>` : ''}</i></span>
    <img class="v2-art v2-logo" alt="" draggable="false" src="${LOGO}" style="--x:668;--y:6;--w:290;--h:196">
    ${cur}`;
}

export function showcaseHtmlV2(items: ShowcaseItem[], cur: ShowcaseItem, o: ShowcaseOpts & { bar?: TopBar | null }): string {
  const page = Math.floor(Math.max(0, items.indexOf(cur)) / PER_PAGE);
  // all cards are rendered (the app binds their clicks once); paging only shows another five
  const cards = items.map((it, k) => cardHtml(it, k, it.id === cur.id, k % PER_PAGE, Math.floor(k / PER_PAGE))).join('');
  const trait = (k: number) => {
    const id = `trait${k + 1}` as 'trait1';
    const tx = T[id];
    return `${spr(id)}<span class="v2-ticon" style="--x:${tx.icon[0] + 12};--y:${tx.icon[1]};--w:${tx.icon[2] - tx.icon[0] - 24};--h:${tx.icon[3] - tx.icon[1]}">${ICON[ROW_ICONS[k]]}</span>
      ${t(cur.rows[k]?.[1] ?? '', [tx.label[0] - 2, tx.label[1], tx.label[2] + 2, tx.label[3]], 0, 0, { cls: `v2-label v2-trait v2-row${k}`, fs: 21, align: 'center' })}`;
  };
  const [a, b] = split(cur.name);
  const bt = T.button.label;
  const front = `<div class="v2-panel" style="--x:1190;--y:84;--w:900;--h:560"></div>
    ${topBarHtml(o.title, o.bar ?? null)}
    <span class="v2-bigname" style="--x:1206;--y:92;--w:450;--h:196"><b class="l1">${esc(a)}</b><b class="l2">${esc(b)}</b></span>
    <span class="v2-dist" style="--x:1228;--y:284;--w:420;--h:26">${esc(cur.district)}</span>
    <span class="v2-desc" style="--x:1228;--y:308;--w:420;--h:62">${esc(cur.desc)}</span>
    ${trait(0)}${trait(1)}${trait(2)}
    ${o.chip ? `<button class="v2-hit v2-chip" data-chip style="--x:1290;--y:636;--w:300;--h:44"><span>${esc(o.chip)}</span></button>` : ''}
    ${btnSpr('button', 'data-ok data-default', o.okLabel, t(o.okLabel, [bt[0] - 14, bt[1], bt[2] + 30, bt[3]], ARENA_ART.button[0], ARENA_ART.button[1], { cls: 'v2-brush', fs: 58, align: 'center' }), 'v2-main')}
    <div class="v2-cards" data-page="${page}" data-pages="${Math.ceil(items.length / PER_PAGE)}">${cards}</div>
    ${items.length > PER_PAGE ? `${btnSpr('arrow_l', 'data-flip="-1"', 'Zurück blättern')}${btnSpr('arrow_r', 'data-flip="1"', 'Weiter blättern')}` : ''}`;
  const bg = `<div class="v2-bgimg"><img class="a on" alt="" decoding="async" src="${cur.big ?? cur.img}"><img class="b" alt="" decoding="async"></div>`;
  return bg + screenHtml('', front).replace('class="v2-stage front"', 'class="v2-stage front v2-show"');
}

/** Shrink the big name lines and the card names that are wider than their box (long German names). */
function fitNames(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.v2-bigname b, .v2-cardname b, .v2-cardname em').forEach((el) => {
    el.style.setProperty('--k', '1');
    const box = el.parentElement!;
    const have = box.clientWidth;
    const need = el.scrollWidth;
    if (need > have && have > 0) el.style.setProperty('--k', (have / need).toFixed(3));
  });
}

function setText(root: HTMLElement, sel: string, txt: string): void {
  const i = root.querySelector<HTMLElement>(`${sel} > i`);
  if (!i) return;
  i.textContent = txt;
  i.dataset.t = txt;
}

/** Show `it` (big picture cross-fade, info panel, card frame) without re-rendering. */
export function showcaseSelectV2(root: HTMLElement, it: ShowcaseItem): void {
  root.querySelectorAll<HTMLElement>('.v2-card').forEach((c) => c.classList.toggle('on', c.dataset.item === it.id));
  const [a, b] = split(it.name);
  const l1 = root.querySelector('.v2-bigname .l1');
  const l2 = root.querySelector('.v2-bigname .l2');
  if (l1) l1.textContent = a;
  if (l2) l2.textContent = b;
  const d = root.querySelector('.v2-desc');
  if (d) d.textContent = it.desc;
  const ds = root.querySelector('.v2-dist');
  if (ds) ds.textContent = it.district;
  for (let k = 0; k < 3; k++) setText(root, `.v2-row${k}`, it.rows[k]?.[1] ?? '');
  const box = root.querySelector('.v2-bgimg');
  const want = it.big ?? it.img;
  if (box && want) {
    const on = box.querySelector<HTMLImageElement>('img.on');
    const off = box.querySelector<HTMLImageElement>('img:not(.on)');
    if (on && off && !on.src.endsWith(want)) {
      off.onload = () => {
        off.classList.add('on');
        on.classList.remove('on');
      };
      off.src = want;
    }
  }
  root.querySelector('.v2-bigname')?.classList.remove('pop');
  void (root.querySelector('.v2-bigname') as HTMLElement | null)?.offsetWidth;
  root.querySelector('.v2-bigname')?.classList.add('pop');
  fitTexts(root);
  fitNames(root);
}

export function mountShowcaseV2(root: HTMLElement): () => void {
  root.classList.add('v2-arena');
  const cards = root.querySelector<HTMLElement>('.v2-cards');
  root.querySelectorAll<HTMLElement>('[data-flip]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!cards) return;
      const n = Number(cards.dataset.pages ?? 1);
      cards.dataset.page = String((Number(cards.dataset.page ?? 0) + Number(b.dataset.flip) + n) % n);
      fitTexts(root);
      fitNames(root);
    }),
  );
  const stop = mountV2(root, { embers: 24, hues: [40, 20, 200] });
  const ro = new ResizeObserver(() => fitNames(root));
  ro.observe(root);
  document.fonts?.ready.then(() => fitNames(root)).catch(() => undefined);
  return () => {
    ro.disconnect();
    stop();
  };
}
