// Design v4 arena select (no master of its own, D47): the PO's mode-select master carries it - its four tiles
// (labels removed) show four arenas per page with the arena picture in the tile's art window and the name on the
// label strip; the blue neon frame marks the current one; the ONLINE / OFFLINE capsule becomes ZUFALL / MEHR
// (random arena / next page); WEITER confirms. Same API as the other designs (data-item, data-back, data-ok).
import { esc } from '../menu/kit';
import type { ShowcaseItem, ShowcaseOpts } from '../menu/arenaSelect';
import type { TopBar } from '../v2/arena';
import { MODES_ART, MODES_DIR, MODES_LIGHTS, MODES_PLATE, MODES_TEXT } from './art/modes';
import { hazeHtml, lightsHtml, mountV2, plateHtml, screenHtml, sprite, t, type ScreenArt } from '../v2/stage';
import { KIT, goldButton, kitSrc, placed, topHtml, xywh } from './kit4';

const A: ScreenArt = { dir: MODES_DIR, plate: MODES_PLATE, art: MODES_ART, lights: MODES_LIGHTS };
const SLOTS = ['t_1v1', 't_2v2', 't_friends', 't_training'] as const;
const PER = SLOTS.length;

function slotBox(k: number): [number, number, number, number] {
  return xywh(MODES_ART[SLOTS[k]]);
}

/** The tile's art window (above its label strip) and label strip, from the tile box. */
function windows(k: number): { pic: number[]; name: number[]; sub: number[] } {
  const [x0, y0, x1, y1] = slotBox(k);
  const w = x1 - x0;
  const h = y1 - y0;
  return {
    pic: [x0 + w * 0.045, y0 + h * 0.085, x1 - w * 0.045, y0 + h * 0.47],
    name: [x0 + w * 0.12, y0 + h * 0.5, x1 - w * 0.14, y0 + h * 0.7],
    sub: [x0 + w * 0.12, y0 + h * 0.7, x1 - w * 0.14, y0 + h * 0.84],
  };
}

function tileHtml(it: ShowcaseItem, k: number, cur: boolean): string {
  const [x0, y0, x1, y1] = slotBox(k);
  const W = windows(k);
  const [px0, py0, px1, py1] = W.pic;
  const pic = it.locked
    ? ''
    : `<span class="v4-win v4-pic" style="--x:${px0 - x0};--y:${py0 - y0};--w:${px1 - px0};--h:${py1 - py0};clip-path:polygon(3% 0,97% 0,100% 12%,100% 100%,0 100%,0 12%)"><img alt="" draggable="false" src="${it.big ?? it.img}" style="object-position:50% 42%"></span>`;
  return `<button class="v2-btn v4-tile ${it.locked ? 'v4-soon' : ''} ${cur ? 'on' : ''}" data-item="${esc(it.id)}" aria-label="${esc(it.name)}" style="--x:${x0};--y:${y0};--w:${x1 - x0};--h:${y1 - y0};--mask:url(${A.dir}${SLOTS[k]}_blank.webp);--d:${k * 0.6}s">
      <img class="v2-face" alt="" draggable="false" src="${A.dir}${SLOTS[k]}_blank.webp">${pic}
      ${t(it.name, [W.name[0] - x0, W.name[1] - y0, W.name[2] - x0, W.name[3] - y0], 0, 0, { cls: 'v4-title', fs: 34, align: 'center' })}
      ${t(it.locked ? 'KOMMT BALD' : it.tag ? `${it.district} · ${it.tag}` : it.district, [W.sub[0] - x0, W.sub[1] - y0, W.sub[2] - x0, W.sub[3] - y0], 0, 0, { cls: 'v2-small', fs: 21, align: 'center' })}
    </button>`;
}

/** Selection frames: blue neon on the current tile, gold over the first tile when it is not the current one (its
 *  sprite is painted selected in the master). */
function framesHtml(page: number, items: ShowcaseItem[], curId: string): string {
  const out: string[] = [];
  const sel = items.slice(page * PER, page * PER + PER).findIndex((x) => x.id === curId);
  const ring = (id: 'ring_sel' | 'ring_gold', k: number, ref: 't_1v1' | 't_2v2', cls = '') => {
    const b = slotBox(k);
    const r = xywh(MODES_ART[id]);
    const t0 = xywh(MODES_ART[ref]);
    const sx = (b[2] - b[0]) / (t0[2] - t0[0]);
    const sy = (b[3] - b[1]) / (t0[3] - t0[1]);
    return placed(A, id, [b[0] + (r[0] - t0[0]) * sx, b[1] + (r[1] - t0[1]) * sy, b[0] + (r[2] - t0[0]) * sx, b[1] + (r[3] - t0[1]) * sy], cls);
  };
  if (sel !== 0) out.push(ring('ring_gold', 0, 't_2v2'));
  if (sel >= 0) out.push(ring('ring_sel', sel, 't_1v1', 'v4-sel'));
  return `<div class="v2-group v4-frames" style="--x:0;--y:0;--w:1672;--h:941">${out.join('')}</div>`;
}

/** Every page is rendered (the app binds the tile clicks once when the screen opens); paging shows another one. */
function pagesHtml(items: ShowcaseItem[], page: number, curId: string): string {
  const n = Math.ceil(items.length / PER);
  return Array.from({ length: n }, (_, p) => {
    const tiles = items
      .slice(p * PER, p * PER + PER)
      .map((it, k) => tileHtml(it, k, it.id === curId))
      .join('');
    return `<div class="v2-group v4-page" data-page="${p}" style="--x:0;--y:0;--w:1672;--h:941" ${p === page ? '' : 'hidden'}>${tiles}${framesHtml(p, items, curId)}</div>`;
  }).join('');
}

let state: { items: ShowcaseItem[]; page: number; cur: string } = { items: [], page: 0, cur: '' };

function setMore(root: HTMLElement): void {
  const more = root.querySelector('.v4-more > i');
  const pages = Math.ceil(state.items.length / PER);
  if (more && pages > 1) {
    more.textContent = `MEHR ${state.page + 1}/${pages}`;
    more.setAttribute('data-t', more.textContent);
  }
}

function showPage(root: HTMLElement, page: number): void {
  state.page = page;
  root.querySelectorAll<HTMLElement>('.v4-page').forEach((el) => (el.hidden = Number(el.dataset.page) !== page));
  setMore(root);
}

export function showcaseHtmlV4(items: ShowcaseItem[], cur: ShowcaseItem, o: ShowcaseOpts & { bar?: TopBar | null }): string {
  const page = Math.floor(Math.max(0, items.indexOf(cur)) / PER);
  state = { items, page, cur: cur.id };
  const pages = Math.ceil(items.length / PER);
  const [tx, ty, tw, th] = KIT.title;
  const on = xywh(MODES_ART.online);
  const off = xywh(MODES_ART.offline);
  const w = o.bar ? { coins: o.bar.coins, gems: o.bar.gems, trophies: o.bar.trophies ?? 0 } : { coins: 0, gems: 0, trophies: 0 };
  const front = `${hazeHtml([200, 680, 1470, 900], '255 180 110', 0.3)}
    ${topHtml(A, MODES_TEXT, w).replace('data-act="back"', 'data-act="back" data-back')}
    <img class="v2-art" alt="" draggable="false" src="${kitSrc('title')}" style="--x:${tx + 110};--y:${ty - 4};--w:${tw};--h:${th}">
    ${t(o.title, [tx + 110 + 74, ty + 8, tx + 110 + tw - 64, ty + th - 16], 0, 0, { cls: 'v4-title', fs: 32, align: 'center' })}
    <div class="v2-group v4-pages" style="--x:0;--y:0;--w:1672;--h:941">${pagesHtml(items, page, cur.id)}</div>
    ${sprite(A, 'online')}${sprite(A, 'offline')}
    <button class="v2-hit" data-random aria-label="Zufällige Arena" style="--x:${on[0]};--y:${on[1]};--w:${on[2] - on[0]};--h:${on[3] - on[1]}">${t('ZUFALL', [40, 0, on[2] - on[0] - 20, on[3] - on[1]], 0, 0, { cls: 'v4-title', fs: 28, align: 'center' })}</button>
    <button class="v2-hit" data-more aria-label="Weitere Arenen" style="--x:${off[0]};--y:${off[1]};--w:${off[2] - off[0]};--h:${off[3] - off[1]}">${t(pages > 1 ? `MEHR ${page + 1}/${pages}` : 'MEHR', [20, 0, off[2] - off[0] - 40, off[3] - off[1]], 0, 0, { cls: 'v4-title v4-more', fs: 28, align: 'center' })}</button>
    ${goldButton(A, 'weiter', 'ok', o.okLabel, 'data-ok')}`;
  return screenHtml(`${plateHtml(A)}${lightsHtml(A, 28)}`, front);
}

export function showcaseSelectV4(root: HTMLElement, it: ShowcaseItem): void {
  state.cur = it.id;
  const idx = state.items.findIndex((x) => x.id === it.id);
  const page = Math.floor(Math.max(0, idx) / PER);
  const el = root.querySelector<HTMLElement>(`.v4-page[data-page="${page}"]`);
  if (!el) return;
  el.querySelectorAll<HTMLElement>('[data-item]').forEach((b) => b.classList.toggle('on', b.dataset.item === it.id));
  el.querySelector('.v4-frames')!.outerHTML = framesHtml(page, state.items, it.id);
  if (page !== state.page) showPage(root, page);
}

export function mountShowcaseV4(root: HTMLElement): () => void {
  root.classList.add('v4-arena');
  const stop = mountV2(root, { hues: [36, 330, 205], living: A, haze: [0.6, 0.42, 0.35], crowdY: 0.25, rigid: [[640, 40, 390, 260]] });
  const pages = Math.ceil(state.items.length / PER);
  const pick = (id: string | undefined) => id && root.querySelector<HTMLElement>(`[data-item="${CSS.escape(id)}"]`)?.click();
  root.querySelector('[data-more]')?.addEventListener('click', () => {
    const next = (state.page + 1) % pages;
    showPage(root, next);
    pick(state.items.slice(next * PER, next * PER + PER).find((x) => !x.locked)?.id);
  });
  root.querySelector('[data-random]')?.addEventListener('click', () => {
    const open = state.items.filter((x) => !x.locked && x.id !== state.cur);
    pick(open[Math.floor(Math.random() * open.length)]?.id);
  });
  setMore(root);
  return stop;
}
