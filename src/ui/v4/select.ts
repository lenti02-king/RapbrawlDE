// Design v4 character select (PO master: Berlin, Pallasseum): red and blue banners, the two pedestals, the 5x3 roster
// grid, the P1 / P2 name plates, WEITER. The chosen fighters stand in 3D on the pedestals; the roster sits in the
// grid's windows (the PO's character artwork replaces the busts once it exists: assets/ui4/art/select/<id>.webp);
// the master's red P1 and blue P2 neon frames move with the selection. Same data attributes as the other designs
// (data-f, data-side, data-random, data-locked, data-back, data-ready): the app logic is shared.
import { esc } from '../menu/kit';
import { menuFigures } from '../menu/figures';
import { SELECT_ART, SELECT_DIR, SELECT_GRID, SELECT_LIGHTS, SELECT_P1, SELECT_P2, SELECT_PLATE, SELECT_TEXT } from './art/select';
import { hazeHtml, lightsHtml, mountV2, plateHtml, screenHtml, t, zone, type ScreenArt } from '../v2/stage';
import { artUrl, goldButton, placed, topHtml, xywh, type Wallet } from './kit4';
import type { CsSide, CsTile } from '../menu/charSelect';

const A: ScreenArt = { dir: SELECT_DIR, plate: SELECT_PLATE, art: SELECT_ART, lights: SELECT_LIGHTS };
/** Roster slots [row, col]: the middle row around the RB emblem first, then the outer rows. */
const SLOTS: [number, number][] = [
  [1, 1],
  [1, 3],
  [1, 0],
  [1, 4],
  [0, 1],
  [0, 3],
  [2, 1],
  [2, 3],
  [0, 2],
  [2, 2],
  [0, 0],
  [0, 4],
  [2, 0],
  [2, 4],
];
const CENTER: [number, number] = [1, 2];
const OCT = 'polygon(13% 0,87% 0,100% 15%,100% 85%,87% 100%,13% 100%,0 85%,0 15%)';

let wallet: Wallet = { coins: 0, gems: 0, trophies: 0 };
/** Amounts for the top bar (set by the app before the screen opens). */
export function setSelectWallet(w: Wallet): void {
  wallet = w;
}

function cursor(p: 0 | 1, b: readonly number[]): string {
  // the cursor sprites are cut 12 px around their tile (P1: row 1 col 1, P2: row 2 col 5): scale onto this tile
  const ref = p ? SELECT_GRID[1][4] : SELECT_GRID[0][0];
  const c = xywh(p ? SELECT_ART.cur_p2 : SELECT_ART.cur_p1);
  const sx = (b[2] - b[0]) / (ref[2] - ref[0]);
  const sy = (b[3] - b[1]) / (ref[3] - ref[1]);
  return placed(A, p ? 'cur_p2' : 'cur_p1', [b[0] + (c[0] - ref[0]) * sx, b[1] + (c[1] - ref[1]) * sy, b[0] + (c[2] - ref[0]) * sx, b[1] + (c[3] - ref[1]) * sy], `v4-sel ${p ? '' : 'red'}`);
}

export function selectHtmlV4(sides: [CsSide, CsSide], tiles: CsTile[], picking: number): string {
  const anchors = [SELECT_P1, SELECT_P2]
    .map(({ feet: [fx, fy], h }, i) => {
      const ped = i ? [1100, 230, 1640, 800] : [30, 230, 570, 800];
      return `<span class="fig-anchor" data-fig="${i}" style="--x:${fx - h / 4};--y:${fy - h};--w:${h / 2};--h:${h}"></span>
      <button class="v2-hit v2-ped ${picking === i ? 'picking' : ''} ${sides[i].hidden ? 'hidden' : ''}" data-side="${i}" aria-label="${esc(sides[i].label)}" style="--x:${ped[0]};--y:${ped[1]};--w:${ped[2] - ped[0]};--h:${ped[3] - ped[1]}"></button>`;
    })
    .join('');
  // the PO's banner artwork (once it exists) over the painted banners, behind the fighters
  const banners = ([['banner_p1.webp', [72, 186, 398, 664]], ['banner_p2.webp', [1286, 186, 1604, 656]]] as const)
    .map(([f, b]) => {
      const u = artUrl(f);
      return u ? `<img class="v2-art" alt="" draggable="false" src="${u}" style="--x:${b[0]};--y:${b[1]};--w:${b[2] - b[0]};--h:${b[3] - b[1]}">` : '';
    })
    .join('');
  const back = `${plateHtml(A)}${banners}${lightsHtml(A, 26)}${anchors}`;

  const at = new Map<string, CsTile>();
  tiles.forEach((tl, i) => SLOTS[i] && at.set(SLOTS[i].join(','), tl));
  const cursors: string[] = [];
  const grid = SELECT_GRID.flatMap((row, r) =>
    row.map((b, c) => {
      const [x0, y0, x1, y1] = b;
      const box = `--x:${x0};--y:${y0};--w:${x1 - x0};--h:${y1 - y0}`;
      if (r === CENTER[0] && c === CENTER[1]) return `<button class="v2-hit v4-cell" data-random aria-label="Zufällig" style="${box}"></button>`;
      const tl = at.get(`${r},${c}`);
      if (!tl) return `<button class="v2-hit v4-cell" data-locked aria-label="Kommt bald" style="${box}"></button>`;
      for (const p of tl.tags) cursors.push(cursor(p as 0 | 1, b));
      const inset = 7;
      return `<span class="v4-win" style="--x:${x0 + inset};--y:${y0 + inset};--w:${x1 - x0 - 2 * inset};--h:${y1 - y0 - 2 * inset};clip-path:${OCT}"><img alt="" draggable="false" src="${artUrl(`select/${tl.id}.webp`) ?? tl.bust}"></span>
        <button class="v2-hit v4-cell" data-f="${tl.id}" aria-label="${esc(tl.name)}" style="${box}"></button>`;
    }),
  ).join('');

  const T = SELECT_TEXT;
  const name = (i: number) => t(sides[i].hidden ? '???' : sides[i].name, zone((i ? T.p2name : T.p1name).name), 0, 0, { cls: 'v4-pname', fs: 40, align: 'center' });
  const front = `${hazeHtml([0, 640, 1672, 880], '170 150 255', 0.35)}
    ${topHtml(A, T, wallet)}${grid}${cursors.join('')}
    ${name(0)}${name(1)}
    ${goldButton(A, 'weiter', 'ready', 'Weiter', 'data-ready data-default')}`;
  return screenHtml(back, front.replace('data-act="back"', 'data-act="back" data-back'));
}

export function mountSelectV4(root: HTMLElement, sides: [CsSide, CsSide]): () => void {
  root.classList.add('v2-select', 'v4-select');
  const stop = mountV2(root, { hues: [210, 350, 42], living: A, haze: [0.42, 0.42, 0.75], crowdY: 0.3, rigid: [[680, 140, 330, 300]] });
  const figs = menuFigures(root);
  figs.set(
    [0, 1]
      .filter((i) => !sides[i].hidden)
      .map((i) => ({
        id: sides[i].id,
        anchor: root.querySelector<HTMLElement>(`[data-fig="${i}"]`)!,
        facing: (i ? -1 : 1) as 1 | -1,
        rim: i ? 0x3d8dff : 0xff3355,
        rim2: i ? 0x8a5cff : 0xff9a3d,
        turn: 0.6,
        showcase: true,
      })),
  );
  return () => {
    stop();
    figs.dispose();
  };
}
