// Arena select from the PO master (D38): outpainted street plate (logo, title banner, info panel), the master's preview
// frame over the arena picture, tile frames (normal / selected with crown) over the thumbnails, extracted buttons.
// All text native German. Master coordinates (2000x1125, contain) like the character select.
import { AS_ART, AS_BOXES } from './arenaSelectArt';
import { esc, keepLaidOut, layoutStage, pos, text, type Box } from './kit';

export interface AsArena {
  id: string;
  name: string;
  district: string;
  desc: string;
  time: string;
  mood: string;
  crowd: string;
  img: string;
  locked?: boolean;
}

const B = AS_BOXES;
const box = (b: readonly number[]) => b as unknown as Box;

export function arenaSelectHtml(arenas: AsArena[], cur: AsArena, okLabel: string): string {
  const bg = AS_ART.bg;
  const pv = AS_ART.preview;
  const [pw0, pw1, pw2, pw3] = B.previewWindow;
  const tw = B.tileWindow;
  const tiles = arenas
    .slice(0, 6)
    .map((a, k) => {
      const [x0, y0, x1, y1] = B.tiles[k];
      const on = a.id === cur.id;
      const fr = on ? AS_ART.tile_on : AS_ART.tile;
      // frame sprites are positioned relative to the tile they were cut from (tile 0 = selected, tile 1 = normal)
      const ref = on ? B.tiles[0] : B.tiles[1];
      return `<button class="as-tile ${on ? 'on' : ''} ${a.locked ? 'locked' : ''}" data-arena="${a.id}" ${a.locked ? 'aria-disabled="true"' : ''} aria-label="${esc(a.name)}" style="${pos(x0, y0, x1 - x0, y1 - y0)}">
        <img class="as-pic" alt="" draggable="false" src="${a.locked ? AS_ART.locked.src : a.img}" style="${pos(tw[0], tw[1], tw[2] - tw[0], tw[3] - tw[1])}">
        <span class="as-shade" style="${pos(tw[0], tw[1], tw[2] - tw[0], tw[3] - tw[1])}"></span>
        <img class="mm-art" alt="" draggable="false" src="${fr.src}" style="${pos(fr.x - ref[0], fr.y - ref[1], fr.w, fr.h)}">
        ${text(a.locked ? 'BALD' : a.name, [tw[0] + 6, tw[3] - 58, tw[2] - 6, tw[3] - 6], 0, 0, { cls: `as-tname ${on ? 'on' : ''} wrap`, fs: 24, align: 'center' })}
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
  const row = (i: number, label: string, value: string) => {
    const y0 = B.labels[1] + i * 40;
    return `${text(label, [B.labels[0], y0, B.labels[2] + 40, y0 + 38], 0, 0, { cls: 'as-lab', fs: 26 })}${text(value, [B.values[0], y0, B.values[2] + 60, y0 + 38], 0, 0, {
      cls: 'as-val',
      fs: 26,
    })}`;
  };
  return `<div class="cs-blur" style="background-image:url(${bg.src})"></div>
    <div class="cs-stage">
      <img class="cs-bg" alt="" draggable="false" src="${bg.src}" style="${pos(bg.x, bg.y, bg.w, bg.h)}">
      ${text('ARENA-WAHL', box(B.title), 0, 0, { cls: 'as-title', fs: 92, align: 'center' })}
      <img class="as-preview" alt="" draggable="false" src="${cur.img}" style="${pos(pw0, pw1, pw2 - pw0, pw3 - pw1)}">
      <img class="mm-art as-frame" alt="" draggable="false" src="${pv.src}" style="${pos(pv.x, pv.y, pv.w, pv.h)}">
      ${text(cur.name, [B.name[0], B.name[1], B.name[2] + 6, B.name[3]], 0, 0, { cls: 'as-name', fs: 46 })}
      ${text(cur.district, [B.district[0] + 4, B.district[1], B.district[2] + 100, B.district[3]], 0, 0, { cls: 'as-lab', fs: 27 })}
      <p class="as-desc" style="${pos(B.desc[0] + 4, B.desc[1], B.desc[2] - B.desc[0] - 8, B.desc[3] - B.desc[1] + 4)}">${esc(cur.desc)}</p>
      ${row(0, 'ZEIT', cur.time)}${row(1, 'STIMMUNG', cur.mood)}${row(2, 'PUBLIKUM', cur.crowd)}
      ${tiles}
      ${btn('back', 'ZURÜCK', 'data-back')}
      ${btn('go', okLabel, 'data-arena-ok data-default')}
    </div>`;
}

export function mountArenaSelect(root: HTMLElement): () => void {
  root.classList.add('mm', 'as');
  const stage = root.querySelector<HTMLElement>('.cs-stage')!;
  return keepLaidOut(root, () => layoutStage(root, stage));
}
