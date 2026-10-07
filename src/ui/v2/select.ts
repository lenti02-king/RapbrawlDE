// Design v2 character select (PO master ref/v2/select.jpg): the chosen fighters stand in 3D on the two pedestals in
// front of the team banners, the roster sits in the master's hex grid (free slots keep the master's dark silhouettes
// as "coming soon"), the neon P1/P2 frames move with the selection. Same data attributes as the v1 screen
// (data-f, data-side, data-back, data-ready), so the app logic is shared.
import { esc } from '../menu/kit';
import { menuFigures } from '../menu/figures';
import { SELECT_ART, SELECT_CROWN, SELECT_DIR, SELECT_FEET, SELECT_LIGHTS, SELECT_PLATE, SELECT_TEXT, SELECT_TILES } from './art/select';
import { beamsHtml, hazeHtml, lightsHtml, mountV2, plateHtml, screenHtml, src, t, zone, type ScreenArt } from './stage';
import type { CsSide, CsTile } from '../menu/charSelect';

const A: ScreenArt = { dir: SELECT_DIR, plate: SELECT_PLATE, art: SELECT_ART, lights: SELECT_LIGHTS };
const T = SELECT_TEXT;
/** Roster order in the hex grid: around the gold crown first (left, right, below-left, below-right, ...). */
const SLOT_ORDER = [5, 7, 9, 11, 4, 8, 1, 3, 10, 2, 0, 12];
const FIG_H = 560;

function octagon(cut = 20): string {
  return `polygon(${cut}% 0, ${100 - cut}% 0, 100% ${cut}%, 100% ${100 - cut}%, ${100 - cut}% 100%, ${cut}% 100%, 0 ${100 - cut}%, 0 ${cut}%)`;
}

function ringFor(p: 0 | 1, tile: readonly number[]): string {
  const [x0, y0, x1, y1] = tile;
  const pad = 14;
  return `<img class="v2-art v2-sel p${p + 1}" alt="" src="${src(A, p ? 'sel_p2' : 'sel_p1')}" style="--x:${x0 - pad};--y:${y0 - pad};--w:${x1 - x0 + 2 * pad};--h:${y1 - y0 + 2 * pad}">`;
}

export interface SelectOpts {
  title?: string;
  hint: string; // middle of the bottom bar
  status: string; // plate under the VS disc
}

export function selectHtmlV2(sides: [CsSide, CsSide], tiles: CsTile[], picking: number, o: SelectOpts): string {
  const figs = SELECT_FEET.map(([fx, fy], i) => {
    const s = sides[i];
    const ped = i ? [1150, 300, 1640, 860] : [40, 300, 560, 860];
    return `<span class="fig-anchor" data-fig="${i}" style="--x:${fx - FIG_H / 4};--y:${fy - FIG_H};--w:${FIG_H / 2};--h:${FIG_H}"></span>
      <button class="v2-hit v2-ped ${picking === i ? 'picking' : ''} ${s.hidden ? 'hidden' : ''}" data-side="${i}" aria-label="${esc(s.label)}" style="--x:${ped[0]};--y:${ped[1]};--w:${ped[2] - ped[0]};--h:${ped[3] - ped[1]}"></button>`;
  }).join('');
  const back = `${plateHtml(A)}${lightsHtml(A, 22)}
    ${beamsHtml([
      { x: 300, y: 0, len: 760, w: 300, rot: 8, swing: 6, color: '70 130 255', period: 8, alpha: 0.22 },
      { x: 1390, y: 0, len: 760, w: 300, rot: -8, swing: 6, color: '255 60 90', period: 9, delay: 2, alpha: 0.22 },
    ])}`;

  // roster in the hex grid
  const used = new Map<number, CsTile>();
  tiles.forEach((tl, i) => used.set(SLOT_ORDER[i], tl));
  const grid = SELECT_TILES.map((b, i) => {
    const [x0, y0, x1, y1] = b;
    const box = `--x:${x0};--y:${y0};--w:${x1 - x0};--h:${y1 - y0}`;
    if (i === SELECT_CROWN) return `<button class="v2-hit v2-tile crown" data-random aria-label="Zufällig" style="${box}"></button>`;
    const tl = used.get(i);
    if (!tl) return `<button class="v2-hit v2-tile locked" data-locked aria-label="Kommt bald" style="${box}"></button>`;
    const rings = tl.tags.map((p) => ringFor(p as 0 | 1, b)).join('');
    return `<button class="v2-hit v2-tile" data-f="${tl.id}" aria-label="${esc(tl.name)}" style="${box}">
        <span class="v2-win" style="clip-path:${octagon(19)}">${tl.bust ? `<img alt="" draggable="false" src="${tl.bust}">` : ''}</span></button>${rings}`;
  }).join('');

  const N = T.names;
  const plate = (i: number) => {
    const s = sides[i];
    const lb = i ? N.p2_label : N.p1_label;
    const nm = i ? N.p2_name : N.p1_name;
    return `${t(s.label, [lb[0] - 30, lb[1], lb[2] + 30, lb[3]], 0, 0, { cls: `v2-plabel p${i + 1} ${picking === i ? 'on' : ''}`, fs: 24, align: 'center' })}
      ${t(s.hidden ? '???' : s.name, [nm[0] - 26, nm[1], nm[2] + 26, nm[3]], 0, 0, { cls: 'v2-pname', fs: 50, align: 'center' })}`;
  };
  const B = T.bar;
  const front = `${hazeHtml([0, 640, 1672, 900], '200 170 255', 0.45)}${grid}
    ${t(o.title ?? 'KÄMPFERWAHL', [672, 28, 960, 90], 0, 0, { cls: 'v2-marker v2-gold', fs: 50, align: 'center' })}
    ${plate(0)}${plate(1)}
    ${t('VS', zone(N.timer), 0, 0, { cls: 'v2-label v2-gold', fs: 34, align: 'center' })}
    ${t(o.status, [N.status[0] - 10, N.status[1], N.status[2] + 10, N.status[3]], 0, 0, { cls: 'v2-label', fs: 26, align: 'center' })}
    <button class="v2-hit" data-back aria-label="Zurück" style="--x:${B.t_back[0]};--y:${B.t_back[1]};--w:${B.t_back[2] - B.t_back[0]};--h:${B.t_back[3] - B.t_back[1]}">${t('ZURÜCK', [B.back[0] - 20, B.back[1], B.back[2] + 40, B.back[3]], B.t_back[0], B.t_back[1], { cls: 'v2-nav', fs: 26, align: 'center' })}</button>
    ${t(o.hint, [B.mid[0] - 40, B.mid[1], B.mid[2] + 40, B.mid[3]], 0, 0, { cls: 'v2-nav', fs: 24, align: 'center' })}
    <button class="v2-hit v2-lock" data-ready data-default aria-label="Bereit" style="--x:${B.t_lock[0]};--y:${B.t_lock[1]};--w:${B.t_lock[2] - B.t_lock[0]};--h:${B.t_lock[3] - B.t_lock[1]}">${t('BEREIT', [B.lock[0] - 26, B.lock[1], B.lock[2] + 26, B.lock[3]], B.t_lock[0], B.t_lock[1], { cls: 'v2-nav v2-gold', fs: 26, align: 'center' })}</button>`;
  return screenHtml(`${back}${figs}`, front);
}

export function mountSelectV2(root: HTMLElement, sides: [CsSide, CsSide]): () => void {
  root.classList.add('v2-select');
  const stop = mountV2(root, { hues: [210, 350, 42], living: A, haze: [0.45, 0.5, 0.85], crowdY: 0.42 });
  const figs = menuFigures(root);
  figs.set(
    [0, 1]
      .filter((i) => !sides[i].hidden)
      .map((i) => ({
        id: sides[i].id,
        anchor: root.querySelector<HTMLElement>(`[data-fig="${i}"]`)!,
        facing: (i ? -1 : 1) as 1 | -1,
        rim: i ? 0xff3355 : 0x3d8dff,
        rim2: i ? 0xff9a3d : 0x8a5cff,
        turn: 0.6,
        showcase: true,
      })),
  );
  return () => {
    stop();
    figs.dispose();
  };
}
