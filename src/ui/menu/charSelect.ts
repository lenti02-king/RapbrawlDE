// Character select from the PO master (D38): outpainted background plate (banners, tile grid, ribbon with the gold VS,
// pedestals, logo), the chosen fighters rendered onto the pedestals, bust portraits in the two roster tiles, native
// German names/labels, extracted ZURÜCK/BEREIT buttons. Everything lives in the master's 2000x1125 space (contain),
// so the overlays sit exactly on the baked tiles and ribbon; 19.5:9 phones see the outpainted plate at the sides.
import { CS_ART, CS_BOXES } from './charSelectArt';
import { esc, keepLaidOut, layoutStage, pos, text, type Box } from './kit';

export interface CsSide {
  id: string;
  name: string;
  city: string;
  label: string; // SPIELER 1 / DU / CPU ...
  hero: string; // full-body render (data URL)
  hidden?: boolean; // online opponent not known yet
}
export interface CsTile {
  id: string;
  bust: string;
  name: string;
  tags: number[]; // which players have it selected (0/1)
}

const B = CS_BOXES;
const box = (b: readonly number[]) => b as unknown as Box;
const bevel = (p: number) => `polygon(${p}% 0, ${100 - p}% 0, 100% ${p}%, 100% ${100 - p}%, ${100 - p}% 100%, ${p}% 100%, 0 ${100 - p}%, 0 ${p}%)`;

function sprite(id: 'back' | 'ready'): string {
  const s = CS_ART[id];
  return `<img class="mm-art" alt="" draggable="false" src="${s.src}" style="${pos(0, 0, s.w, s.h)}">`;
}

export function charSelectHtml(sides: [CsSide, CsSide], tiles: CsTile[], picking: number): string {
  const bg = CS_ART.bg;
  const fighter = (i: number) => {
    const s = sides[i];
    const [x0, y0, x1, y1] = i ? B.ped_p2 : B.ped_p1;
    return `<button class="cs-ped p${i + 1} ${picking === i ? 'picking' : ''} ${s.hidden ? 'hidden' : ''}" data-side="${i}" aria-label="${esc(s.label)}" style="${pos(x0, y0, x1 - x0, y1 - y0)}">
      ${s.hero ? `<img alt="" draggable="false" src="${s.hero}">` : ''}</button>`;
  };
  const plate = (i: number) => {
    const s = sides[i];
    const k = i ? 'p2' : 'p1';
    const lb = B[`${k}_label`];
    const nm = B[`${k}_name`];
    const ct = B[`${k}_city`];
    return `${text(s.label, [lb[0] - 40, lb[1], lb[2] + 40, lb[3]], 0, 0, { cls: `cs-label ${picking === i ? 'on' : ''}`, fs: 30, align: 'center' })}
      ${text(s.hidden ? '???' : s.name, [nm[0] - (i ? 0 : 20), nm[1], nm[2] + (i ? 20 : 0), nm[3]], 0, 0, { cls: `cs-name p${i + 1}`, fs: 70, align: 'center' })}
      ${text(s.hidden ? 'WARTET …' : s.city, [ct[0] - 40, ct[1], ct[2] + 40, ct[3]], 0, 0, { cls: 'cs-city', fs: 34, align: 'center' })}`;
  };
  const tileHtml = tiles
    .map((t, k) => {
      const [x0, y0, x1, y1] = k === 0 ? B.tile_p1 : B.tile_p2;
      const tags = t.tags.map((p) => `<span class="cs-tag p${p + 1}">P${p + 1}</span>`).join('');
      return `<button class="cs-tile ${t.tags.map((p) => `sel${p + 1}`).join(' ')}" data-f="${t.id}" aria-label="${esc(t.name)}" style="${pos(x0, y0, x1 - x0, y1 - y0)}">
        <span class="cs-win" style="clip-path:${bevel(11)}">${t.bust ? `<img alt="" draggable="false" src="${t.bust}">` : ''}</span>${tags}</button>`;
    })
    .join('');
  const btn = (id: 'back' | 'ready', label: string, attrs: string) => {
    const s = CS_ART[id];
    const tb = B[`${id}_text`];
    return `<button class="mm-btn cs-btn ${id}" ${attrs} aria-label="${esc(label)}" style="${pos(s.x, s.y, s.w, s.h)}">${sprite(id)}${text(
      label,
      id === 'back' ? [tb[0], tb[1], tb[2] + 40, tb[3]] : box(tb),
      s.x,
      s.y,
      { cls: `cs-${id}`, fs: id === 'back' ? 44 : 60, align: id === 'back' ? 'left' : 'center' },
    )}</button>`;
  };
  return `<div class="cs-blur" style="background-image:url(${bg.src})"></div>
    <div class="cs-stage">
      <img class="cs-bg" alt="" draggable="false" src="${bg.src}" style="${pos(bg.x, bg.y, bg.w, bg.h)}">
      ${fighter(0)}${fighter(1)}
      ${tileHtml}
      ${plate(0)}${plate(1)}
      ${btn('back', 'ZURÜCK', 'data-back')}
      ${btn('ready', 'BEREIT!', 'data-ready data-default')}
    </div>`;
}

export function mountCharSelect(root: HTMLElement): () => void {
  root.classList.add('mm', 'cs');
  const stage = root.querySelector<HTMLElement>('.cs-stage')!;
  return keepLaidOut(root, () => layoutStage(root, stage));
}
