// Design v4 fighter customisation (PO master: Berlin Schöneberg, Pallasseum): the fighter stands in 3D on the
// pedestal (DREHEN turns him, a swipe over the pedestal switches fighters), name plate, SKINS / WALK-IN / EFFEKTE,
// six skin tiles (the PO's skin artwork goes into them later: assets/ui4/art/skins/<fighter>_<n>.webp), the stat
// bars (KRAFT, TEMPO, TECHNIK: the master's cyan cells lit per fighter) and AUSRÜSTEN.
import { toast } from '../menu/kit';
import { menuFigures, type FigureSpec } from '../menu/figures';
import { CUSTOM_ART, CUSTOM_DIR, CUSTOM_HERO, CUSTOM_LIGHTS, CUSTOM_PLATE, CUSTOM_SEGS, CUSTOM_TEXT } from './art/custom';
import { button, hazeHtml, lightsHtml, mountV2, plateHtml, screenHtml, t, zone, type ScreenArt } from '../v2/stage';
import { goldButton, placed, tileButton, topHtml, xywh, type Wallet } from './kit4';

const A: ScreenArt = { dir: CUSTOM_DIR, plate: CUSTOM_PLATE, art: CUSTOM_ART, lights: CUSTOM_LIGHTS };

export interface CustomV4Model extends Wallet {
  fighter: string;
  name: string;
  /** Lit cells per bar (0..6). */
  stats: { power: number; speed: number; tech: number };
}

export type CustomV4Action = 'back' | 'equip' | 'next' | 'prev' | 'tab' | 'skin' | 'shop' | 'news' | 'social';

function segsHtml(m: CustomV4Model): string {
  const [, , sw, sh] = CUSTOM_ART.seg_on;
  const out: string[] = [];
  (['power', 'speed', 'tech'] as const).forEach((k, j) => {
    CUSTOM_SEGS[k].forEach((b, i) => {
      if (i >= m.stats[k]) return;
      // the lit cell is cut 3 px around the first cell of KRAFT: same offset on every cell
      out.push(`<img class="v2-art v4-seg" alt="" draggable="false" src="${A.dir}seg_on.webp" style="--x:${b[0] - 3};--y:${b[1] - 3};--w:${sw};--h:${sh};--d:${(j * 6 + i) * 0.12}s">`);
    });
  });
  return `<div class="v2-group v4-segs" style="--x:0;--y:0;--w:1672;--h:941">${out.join('')}</div>`;
}

export function customHtmlV4(m: CustomV4Model): string {
  const [fx, fy] = CUSTOM_HERO.feet;
  const H = CUSTOM_HERO.h;
  const back = `${plateHtml(A)}${lightsHtml(A, 28)}
    <span class="fig-anchor" data-fig="0" style="--x:${fx - H / 4};--y:${fy - H};--w:${H / 2};--h:${H}"></span>
    <button class="v2-hit v4-swipe" data-act="swipe" aria-label="Kämpfer wechseln" style="--x:150;--y:240;--w:700;--h:460"></button>`;
  const skins = ['s1', 's2', 's3', 's4', 's5', 's6']
    .map((id, i) => tileButton(A, id, i ? 'skin' : 'equip-skin', ['Standard', 'Street', 'Champion', 'Nacht', 'Gold', 'Exklusiv'][i], i * 0.35, i ? 'v4-soon' : ''))
    .join('');
  const front = `${hazeHtml([60, 560, 900, 800], '255 190 120', 0.32)}
    ${topHtml(A, CUSTOM_TEXT, m)}
    ${t(m.name.toUpperCase(), zone(CUSTOM_TEXT.title.name), 0, 0, { cls: 'v4-title', fs: 34, align: 'center' })}
    ${button(A, 'tab_skins', 'tab', 'Skins')}${button(A, 'tab_walk', 'tab-walk', 'Walk-in', () => '', 'v4-soon')}${button(A, 'tab_fx', 'tab-fx', 'Effekte', () => '', 'v4-soon')}
    ${skins}${placed(A, 'ring_sel', xywh(CUSTOM_ART.ring_sel), 'v4-sel')}
    ${button(A, 'rot_l', 'rot-l', 'Nach links drehen', () => '', 'v4-btn')}${button(A, 'rot_r', 'rot-r', 'Nach rechts drehen', () => '', 'v4-btn')}
    ${segsHtml(m)}
    ${goldButton(A, 'equip', 'equip', 'Ausrüsten')}`;
  return screenHtml(back, front);
}

export function mountCustomV4(root: HTMLElement, m: CustomV4Model, onAction: (a: CustomV4Action) => void): () => void {
  const stop = mountV2(root, { hues: [38, 330, 210], living: A, haze: [0.62, 0.48, 0.32], crowdY: 0.25, rigid: [[660, 20, 330, 220]] });
  const figs = menuFigures(root);
  const anchor = root.querySelector<HTMLElement>('[data-fig="0"]');
  const spec: FigureSpec | null = anchor ? { id: m.fighter, anchor, facing: 1, rim: 0xffb347, rim2: 0x4f8dff, turn: 0.55, showcase: true } : null;
  if (spec) figs.set([spec]);
  // DREHEN: ease the figure round by 60 degrees per tap
  let target = spec?.turn ?? 0;
  let raf = 0;
  const spin = () => {
    if (!spec) return;
    const cur = spec.turn ?? 0;
    const d = target - cur;
    spec.turn = Math.abs(d) < 0.002 ? target : cur + d * 0.16;
    if (spec.turn !== target) raf = requestAnimationFrame(spin);
  };
  let sx = 0;
  const sw = root.querySelector<HTMLElement>('.v4-swipe');
  sw?.addEventListener('pointerdown', (e) => (sx = e.clientX));
  sw?.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 40) onAction(dx < 0 ? 'next' : 'prev');
  });
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!b || !root.contains(b)) return;
    const a = b.dataset.act!;
    if (a === 'rot-l' || a === 'rot-r') {
      target += (a === 'rot-l' ? -1 : 1) * (Math.PI / 3);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(spin);
      return;
    }
    if (a === 'swipe') return;
    if (a === 'tab-walk' || a === 'tab-fx') return toast(root, `${a === 'tab-walk' ? 'WALK-INS' : 'EFFEKTE'} KOMMEN BALD`);
    if (a === 'skin') return toast(root, 'WEITERE SKINS KOMMEN BALD');
    if (a === 'equip-skin' || a === 'tab') return;
    onAction(a as CustomV4Action);
  });
  return () => {
    cancelAnimationFrame(raf);
    stop();
    figs.dispose();
  };
}
