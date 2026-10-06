// Showcase select from the PO's arena-select master (D38): outpainted street plate (logo, title banner, info panel),
// the master's preview frame over the big picture, tile frames (normal / selected with crown) over the thumbnails,
// extracted buttons. Used for the arena select (favourite arena, per-player pick + random draw) and the game-mode
// window (same design, mode artwork in the tiles). All text native German; selecting a tile updates the screen in
// place (no re-render), so the tile roulette can animate.
import { AS_ART, AS_BOXES } from './arenaSelectArt';
import { esc, fitTexts, keepLaidOut, layoutStage, pos, text, type Box } from './kit';
import { design } from '../design';
import { mountShowcaseV2, showcaseHtmlV2, showcaseSelectV2, type TopBar } from '../v2/arena';

export interface ShowcaseItem {
  id: string;
  name: string;
  district: string;
  desc: string;
  /** Three info rows (the plate has a sun, a flame and a crowd icon in front of them). */
  rows: [string, string][];
  img: string;
  /** Full-screen picture for design v2 (a big render of the arena); falls back to `img`. */
  big?: string;
  /** Tile crop of a wide picture: the point to keep (CSS position, e.g. '50% 90%' when the subject sits low) and a
   *  zoom toward it (the nearly square tiles otherwise show the picture's full height, mostly sky for some modes). */
  focus?: string;
  zoom?: number;
  locked?: boolean;
  /** Small gold tag above the tile name (e.g. FAVORIT). */
  tag?: string;
}

export interface ShowcaseOpts {
  title: string;
  okLabel: string;
  /** Extra action shown as a gold chip under the info panel (e.g. "ALS FAVORIT"). */
  chip?: string;
}

const B = AS_BOXES;
/** Everything interactive or readable (reference px): kept on screen, as large as possible. */
const SAFE: Box = [40, 20, 1962, 1088];
/** Short, wide screens: from the title banner down (the logo above it may be cropped). */
const SAFE_SHORT: Box = [40, 290, 1962, 1088];
const box = (b: readonly number[]) => b as unknown as Box;
const ROW_H = 40;

export function showcaseHtml(items: ShowcaseItem[], cur: ShowcaseItem, o: ShowcaseOpts & { bar?: TopBar | null }): string {
  if (design() === 'v2') return showcaseHtmlV2(items, cur, o);
  const bg = AS_ART.bg;
  const pv = AS_ART.preview;
  const [pw0, pw1, pw2, pw3] = B.previewWindow;
  const tw = B.tileWindow;
  const frame = (on: boolean) => {
    // frame sprites are positioned relative to the tile they were cut from (tile 0 = selected, tile 1 = normal)
    const fr = on ? AS_ART.tile_on : AS_ART.tile;
    const ref = on ? B.tiles[0] : B.tiles[1];
    return `<img class="mm-art ${on ? 'fr-on' : 'fr-off'}" alt="" draggable="false" src="${fr.src}" style="${pos(fr.x - ref[0], fr.y - ref[1], fr.w, fr.h)}">`;
  };
  const tiles = items
    .slice(0, 6)
    .map((a, k) => {
      const [x0, y0, x1, y1] = B.tiles[k];
      const on = a.id === cur.id;
      return `<button class="as-tile ${on ? 'on' : ''} ${a.locked ? 'locked' : ''}" data-item="${a.id}" aria-label="${esc(a.name)}" style="${pos(x0, y0, x1 - x0, y1 - y0)}">
        <span class="as-picbox" style="${pos(tw[0], tw[1], tw[2] - tw[0], tw[3] - tw[1])}"><img class="as-pic" alt="" draggable="false" src="${a.img || AS_ART.locked.src}" style="${
          a.focus ? `object-position:${a.focus};transform-origin:${a.focus};transform:scale(${a.zoom ?? 1})` : ''
        }"></span>
        <span class="as-shade" style="${pos(tw[0], tw[1], tw[2] - tw[0], tw[3] - tw[1])}"></span>
        ${a.locked ? `<span class="as-soon" style="${pos(tw[0], tw[1], tw[2] - tw[0], tw[3] - tw[1])}"><b>KOMMT BALD</b></span>` : ''}
        ${frame(false)}${frame(true)}
        ${a.tag ? text(a.tag, [tw[0] + 6, tw[1] + 6, tw[2] - 6, tw[1] + 34], 0, 0, { cls: 'as-tag', fs: 20, align: 'center' }) : ''}
        ${text(a.name, [tw[0] + 6, tw[3] - 58, tw[2] - 6, tw[3] - 6], 0, 0, { cls: 'as-tname wrap', fs: 24, align: 'center' })}
      </button>`;
    })
    .join('');
  const btn = (id: 'back' | 'go', label: string, attrs: string) => {
    const s = AS_ART[id];
    const tb = B[`${id}_text`];
    const tbox: Box = id === 'back' ? [tb[0] - 30, tb[1], tb[2] + 90, tb[3]] : [tb[0] - 30, tb[1], tb[2] + 24, tb[3]];
    return `<button class="mm-btn as-btn ${id}" ${attrs} aria-label="${esc(label)}" style="${pos(s.x, s.y, s.w, s.h)}"><img class="mm-art" alt="" draggable="false" src="${s.src}" style="${pos(0, 0, s.w, s.h)}">${text(
      label,
      tbox,
      s.x,
      s.y,
      { cls: `as-${id}`, fs: 52, align: 'center' },
    )}</button>`;
  };
  const row = (i: number) => {
    const y0 = B.labels[1] + i * ROW_H;
    const [l, v] = cur.rows[i] ?? ['', ''];
    return `${text(l, [B.labels[0], y0, B.labels[2] + 40, y0 + 38], 0, 0, { cls: `as-lab as-row${i}l`, fs: 26 })}${text(v, [B.values[0], y0, B.values[2] + 60, y0 + 38], 0, 0, {
      cls: `as-val as-row${i}v`,
      fs: 26,
    })}`;
  };
  return `<div class="cs-blur" style="background-image:url(${bg.src})"></div>
    <div class="cs-stage">
      <img class="cs-bg" alt="" draggable="false" src="${bg.src}" style="${pos(bg.x, bg.y, bg.w, bg.h)}">
      ${text(o.title, box(B.title), 0, 0, { cls: 'as-title', fs: 92, align: 'center' })}
      <img class="as-preview" alt="" draggable="false" src="${cur.img || AS_ART.locked.src}" style="${pos(pw0, pw1, pw2 - pw0, pw3 - pw1)}">
      <span class="as-soon big ${cur.locked ? '' : 'off'}" style="${pos(pw0, pw1, pw2 - pw0, pw3 - pw1)}"><b>KOMMT BALD</b></span>
      <img class="mm-art as-frame" alt="" draggable="false" src="${pv.src}" style="${pos(pv.x, pv.y, pv.w, pv.h)}">
      ${text(cur.name, [B.name[0], B.name[1], B.name[2] + 6, B.name[3]], 0, 0, { cls: 'as-name', fs: 46 })}
      ${text(cur.district, [B.district[0] + 4, B.district[1], B.district[2] + 100, B.district[3]], 0, 0, { cls: 'as-lab as-dist', fs: 27 })}
      <p class="as-desc" style="${pos(B.desc[0] + 4, B.desc[1], B.desc[2] - B.desc[0] - 8, B.desc[3] - B.desc[1] + 4)}">${esc(cur.desc)}</p>
      ${row(0)}${row(1)}${row(2)}
      ${o.chip ? `<button class="mm-btn as-chip" data-chip style="${pos(B.name[0] + 30, B.values[3] + 22, B.name[2] - B.name[0] - 60, 54)}"><span>${esc(o.chip)}</span></button>` : ''}
      ${tiles}
      ${btn('back', 'ZURÜCK', 'data-back')}
      ${btn('go', o.okLabel, 'data-ok data-default')}
    </div>`;
}

function setText(root: HTMLElement, sel: string, t: string): void {
  const i = root.querySelector<HTMLElement>(`${sel} > i`);
  if (!i) return;
  i.textContent = t;
  i.dataset.t = t;
}

/** Show `it` as the current item (preview, info panel, selected tile frame) without re-rendering. */
export function showcaseSelect(root: HTMLElement, it: ShowcaseItem): void {
  if (root.classList.contains('v2')) return showcaseSelectV2(root, it);
  root.querySelectorAll<HTMLElement>('.as-tile').forEach((t) => t.classList.toggle('on', t.dataset.item === it.id));
  const pv = root.querySelector<HTMLImageElement>('.as-preview');
  if (pv) pv.src = it.img || AS_ART.locked.src;
  root.querySelector('.as-soon.big')?.classList.toggle('off', !it.locked);
  setText(root, '.as-name', it.name);
  setText(root, '.as-dist', it.district);
  const d = root.querySelector('.as-desc');
  if (d) d.textContent = it.desc;
  for (let i = 0; i < 3; i++) {
    setText(root, `.as-row${i}l`, it.rows[i]?.[0] ?? '');
    setText(root, `.as-row${i}v`, it.rows[i]?.[1] ?? '');
  }
  fitTexts(root);
}

export function setShowcaseChip(root: HTMLElement, label: string, on: boolean): void {
  const c = root.querySelector<HTMLElement>('.as-chip, .v2-chip');
  if (!c) return;
  c.querySelector('span')!.textContent = label;
  c.classList.toggle('on', on);
}

export function mountShowcase(root: HTMLElement): () => void {
  if (root.querySelector('.v2-stage')) return mountShowcaseV2(root);
  root.classList.add('mm', 'as');
  const stage = root.querySelector<HTMLElement>('.cs-stage')!;
  return keepLaidOut(root, () => layoutStage(root, stage, SAFE, AS_ART.bg, SAFE_SHORT));
}

/** Arena draw: the highlight (and the preview) jumps between the candidates, slowing down, and lands on `winner`. */
export function showcaseRoulette(root: HTMLElement, items: ShowcaseItem[], winner: string, onDone: () => void): void {
  const total = items.length * 4 + Math.max(0, items.findIndex((x) => x.id === winner)) + 1;
  let k = 0;
  const tick = () => {
    showcaseSelect(root, items[k % items.length]);
    k++;
    if (k < total) window.setTimeout(tick, 60 + k * k * 3);
    else window.setTimeout(onDone, 750);
  };
  tick();
}
