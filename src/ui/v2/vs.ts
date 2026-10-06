// Design v2 VS screen (PO master ref/v2/vs.webp): both fighters big in 3D facing each other behind the gold VS,
// both decks (card art rendered from the fighters' own moves), the arena picture in the master's frame (arrows flip
// the arena), BEREIT starts loading. Shown between the arena pick and the loading screen.
import { esc, fitTexts } from '../menu/kit';
import { MenuFigures } from '../menu/figures';
import { VS_ART, VS_DIR, VS_FEET, VS_FIG_H, VS_LIGHTS, VS_OPP, VS_PLATE, VS_TEXT, VS_YOU } from './art/vs';
import { button, hazeHtml, lightsHtml, mountV2, plateHtml, screenHtml, src, t, zone, type ScreenArt } from './stage';

const A: ScreenArt = { dir: VS_DIR, plate: VS_PLATE, art: VS_ART, lights: VS_LIGHTS };
const T = VS_TEXT;

export interface VsCard {
  name: string;
  art: string;
  sub: string; // SPEZIAL / SIGNATURE
}
export interface VsSide {
  id: string;
  name: string;
  level: string;
  bust: string;
  label: string; // DU / GEGNER / SPIELER 2
  deck: VsCard[];
}
export interface VsModel {
  sides: [VsSide, VsSide];
  arena: { name: string; img: string };
  arenaIdx: number;
  arenaCount: number;
}

/** Graffiti font size: the master's size for short words, smaller for long ones. */
const gs = (s: string, max: number) => Math.min(max, Math.round(420 / Math.max(1, s.length)));

function win(b: readonly number[], inner: string, cls = ''): string {
  return `<span class="v2-win2 ${cls}" style="--x:${b[0]};--y:${b[1]};--w:${b[2] - b[0]};--h:${b[3] - b[1]}">${inner}</span>`;
}

export function vsHtml(m: VsModel): string {
  const figs = VS_FEET.map(
    ([fx, fy], i) => `<span class="fig-anchor" data-fig="${i}" style="--x:${fx - VS_FIG_H / 4};--y:${fy - VS_FIG_H};--w:${VS_FIG_H / 2};--h:${VS_FIG_H}"></span>`,
  ).join('');
  const back = `${plateHtml(A)}${lightsHtml(A, 20)}${figs}`;

  const prof = (i: 0 | 1) => {
    const s = m.sides[i];
    const P = i ? T.p2 : T.p1;
    return `${win(P.avatar, s.bust ? `<img alt="" src="${s.bust}">` : '', 'v2-av')}
      ${t(s.name, [P.name[0], P.name[1], P.name[0] + (i ? 170 : 200), P.name[3]], 0, 0, { cls: 'v2-label', fs: 27 })}
      ${t(s.level, [P.level[0], P.level[1], P.level[0] + 140, P.level[3]], 0, 0, { cls: 'v2-label', fs: 24 })}`;
  };
  const deck = (i: 0 | 1) => {
    const s = m.sides[i];
    const D = i ? T.deck2 : T.deck1;
    const card = (k: number) => {
      const c = s.deck[k];
      if (!c) return '';
      const w = k === 0 ? D.c1 : k === 1 ? D.c2 : D.c3;
      const n = k === 0 ? D.n1 : k === 1 ? D.n2 : D.n3;
      const l = k === 0 ? D.l1 : k === 1 ? D.l2 : D.l3;
      const wide = k === 2;
      const cx = wide ? (w[0] + w[2]) / 2 : (w[0] + w[2]) / 2;
      const half = wide ? 130 : 64;
      return `${win(w, c.art ? `<img alt="" src="${c.art}">` : '', wide ? 'v2-sig' : '')}
        ${t(c.name, [cx - half, n[1], cx + half, n[3]], 0, 0, { cls: 'v2-label', fs: wide ? 24 : 19, align: 'center' })}
        ${t(c.sub, [cx - half, l[1], cx + half, l[3]], 0, 0, { cls: `v2-small ${wide ? 'v2-gold' : ''}`, fs: 17, align: 'center' })}`;
    };
    const title = i ? 'GEGNER-DECK' : 'DEIN DECK';
    return `${t(title, [D.title[0] - 6, D.title[1], D.title[2] + 20, D.title[3]], 0, 0, { cls: 'v2-marker', fs: 34, align: 'left' })}${card(0)}${card(1)}${card(2)}`;
  };
  const S = T.stage;
  const dots = Array.from({ length: Math.min(8, m.arenaCount) }, (_, k) => `<i class="${k === m.arenaIdx ? 'on' : ''}"></i>`).join('');
  const front = `${hazeHtml([300, 600, 1380, 860], '200 170 255', 0.4)}
    <span class="v2-graffiti you" style="--x:${VS_YOU[0]};--y:${VS_YOU[1]};--w:${VS_YOU[2] - VS_YOU[0]};--h:${VS_YOU[3] - VS_YOU[1]};--gs:${gs(m.sides[0].label, 84)}">${esc(m.sides[0].label)}</span>
    <span class="v2-graffiti opp" style="--x:${VS_OPP[0]};--y:${VS_OPP[1]};--w:${VS_OPP[2] - VS_OPP[0]};--h:${VS_OPP[3] - VS_OPP[1]};--gs:${gs(m.sides[1].label, 70)}">${esc(m.sides[1].label)}</span>
    ${prof(0)}${prof(1)}${deck(0)}${deck(1)}
    <button class="v2-hit v2-stagewin" data-arena aria-label="Arena ändern" style="--x:${S.win[0]};--y:${S.win[1]};--w:${S.win[2] - S.win[0]};--h:${S.win[3] - S.win[1]}"><img alt="" src="${m.arena.img}"></button>
    ${t(m.arena.name, [S.label[0] - 40, S.label[1], S.label[2] + 40, S.label[3]], 0, 0, { cls: 'v2-label v2-arenaname', fs: 28, align: 'center' })}
    <span class="v2-dots" style="--x:760;--y:752;--w:150;--h:18">${dots}</span>
    ${button(A, 'arrow_l', 'arena-prev', 'Vorherige Arena')}${button(A, 'arrow_r', 'arena-next', 'Nächste Arena')}
    ${button(A, 'ready', 'ready', 'Bereit', (ox, oy) => t('BEREIT!', zone([T.ready.label[0] - 20, T.ready.label[1], T.ready.label[2] + 30, T.ready.label[3]]), ox, oy, { cls: 'v2-brush', fs: 92, align: 'center' }), 'v2-main', `--mask:url(${src(A, 'ready')})`).replace('data-act="ready"', 'data-act="ready" data-default')}`;
  return screenHtml(back, front);
}

/** Show another arena in the VS frame (arrows) without re-rendering the fighters. */
export function setVsArena(root: HTMLElement, a: { name: string; img: string }, idx: number): void {
  const img = root.querySelector<HTMLImageElement>('.v2-stagewin img');
  if (img) img.src = a.img;
  const i = root.querySelector<HTMLElement>('.v2-arenaname > i');
  if (i) {
    i.textContent = a.name;
    i.dataset.t = a.name;
  }
  root.querySelectorAll('.v2-dots i').forEach((d, k) => d.classList.toggle('on', k === idx));
  fitTexts(root);
}

export function mountVs(root: HTMLElement, m: VsModel, onAction: (a: 'ready' | 'arena-prev' | 'arena-next' | 'arena' | 'back') => void): () => void {
  root.classList.add('v2-vs');
  const stop = mountV2(root, { hues: [210, 350, 42] });
  const figs = new MenuFigures(root, root.querySelector('.v2-embers') ?? root.querySelector('.v2-stage.front'));
  figs.set(
    [0, 1].map((i) => ({
      id: m.sides[i].id,
      anchor: root.querySelector<HTMLElement>(`[data-fig="${i}"]`)!,
      facing: (i ? -1 : 1) as 1 | -1,
      rim: i ? 0xff2d4a : 0x2f8bff,
      rim2: i ? 0xff9a3d : 0x9a6bff,
      turn: 0.32,
    })),
  );
  root.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const b = el.closest<HTMLElement>('[data-act]');
    if (b) return onAction(b.dataset.act as 'ready');
    if (el.closest('[data-arena]')) onAction('arena');
  });
  return () => {
    stop();
    figs.dispose();
  };
}
