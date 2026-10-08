// Design v4 home (PO master: Frankfurt, Taunusstraße / Moselstraße): profile, capsules, the six tiles, the nav bar and
// the FIGHT button are the master's own pixels on the master's plate; the player's favourite fighter stands in 3D on
// the empty pedestal in the middle. Live: name, level, XP, amounts, the avatar window (the favourite's bust until the
// PO's avatar art exists).
import { de, toast } from '../menu/kit';
import { menuFigures } from '../menu/figures';
import { HOME_ART, HOME_DIR, HOME_HERO, HOME_LABELS, HOME_LIGHTS, HOME_LOGO, HOME_PLATE, HOME_TEXT } from './art/home';
import { button, hazeHtml, lightsHtml, mountV2, plateHtml, screenHtml, src, t, zone, type ScreenArt } from '../v2/stage';
import { artUrl, goldButton, tileButton, topHtml, type Wallet } from './kit4';

const A: ScreenArt = { dir: HOME_DIR, plate: HOME_PLATE, art: HOME_ART, lights: HOME_LIGHTS };
const T = HOME_TEXT;

export interface HomeV4Model extends Wallet {
  name: string;
  level: number;
  xp: number;
  xpMax: number;
  fighter: string; // favourite: stands on the pedestal
  avatar: string; // image for the avatar window
}

export type HomeV4Action = 'profile' | 'shop' | 'news' | 'settings' | 'fighters' | 'custom' | 'decks' | 'events' | 'pass' | 'fight' | 'ranked' | 'social' | 'home';

export function homeHtmlV4(m: HomeV4Model): string {
  const xp = Math.max(0, Math.min(1, m.xp / Math.max(1, m.xpMax)));
  const [fx, fy] = HOME_HERO.feet;
  const H = HOME_HERO.h;
  const back = `${plateHtml(A)}${lightsHtml(A, 28)}
    <span class="fig-anchor" data-fig="0" style="--x:${fx - H / 4};--y:${fy - H};--w:${H / 2};--h:${H}"></span>`;

  const P = T.profile;
  const [xx, xy, xw, xh] = HOME_ART.xp_fill;
  const [bx0, , bx1] = P.xpbar;
  const profile = button(
    A,
    'profile',
    'profile',
    'Profil',
    (ox, oy) => {
      const [ax0, ay0, ax1, ay1] = P.avatar;
      return `<span class="v4-win" style="--x:${ax0 - ox};--y:${ay0 - oy};--w:${ax1 - ax0};--h:${ay1 - ay0};clip-path:polygon(9% 0,91% 0,100% 9%,100% 91%,91% 100%,9% 100%,0 91%,0 9%)"><img alt="" draggable="false" src="${m.avatar}"></span>
       <img class="v2-art" alt="" src="${src(A, 'xp_fill')}" style="--x:${xx - ox};--y:${xy - oy};--w:${xp > 0 ? Math.max(xw * 0.25, (bx1 - bx0) * xp) : 0};--h:${xh};object-fit:fill">
       ${t(m.name, zone(P.name), ox, oy, { cls: 'v2-label v4-title', fs: 27 })}
       ${t(String(m.level), [P.level[0] - 6, P.level[1] - 2, P.level[2] + 6, P.level[3] + 2], ox, oy, { cls: 'v2-label v4-title', fs: 26, align: 'center' })}
       ${t(`${de(m.xp)} / ${de(m.xpMax)}`, zone(P.xp), ox, oy, { cls: 'v2-small', fs: 19 })}`;
    },
    'v4-btn',
  );

  // the PO's tile artwork (a whole tile with its lettering, same size as the tile: design/v4/README.md) replaces the
  // master's tile once it exists: assets/ui4/art/home/<file>.webp
  const tile = (id: string, file: string, act: string, label: string, d: number, inner?: (ox: number, oy: number) => string) => {
    const u = artUrl(`home/${file}.webp`);
    const html = tileButton(A, id, act, label, d, '', u ? undefined : inner);
    return u ? html.split(`${A.dir}${id}.webp`).join(u) : html;
  };
  const tiles = [
    tile('fighters', 'kaempfer', 'fighters', 'Kämpfer', 0),
    tile('deck', 'deck', 'decks', 'Deck', 0.5),
    tile('shop', 'shop', 'shop', 'Shop', 1),
    tile('events', 'events', 'events', 'Events', 0.25),
    tile('pass', 'battlepass', 'pass', 'Battle Pass', 0.75),
    // S15 (PO): the customise screen has its own menu item - the MISSIONEN tile without its painted label, ANPASSEN
    tile('missions_blank', 'anpassen', 'custom', 'Anpassen', 1.25, (ox, oy) => {
      const [x0, y0, x1, y1] = HOME_LABELS.missions;
      return t('ANPASSEN', [x0 - ox, y0 - oy, x1 - ox, y1 - oy], 0, 0, { cls: 'v4-title v4-tlabel', fs: 42, align: 'center' });
    }),
  ].join('');
  const nav = `<div class="v2-lift v2-group" style="--x:0;--y:0;--w:1672;--h:941">
      ${button(A, 'n_home', 'home', 'Home')}${button(A, 'n_ranked', 'ranked', 'Ranked')}
      ${button(A, 'n_social', 'social', 'Freunde')}${button(A, 'n_gear', 'settings', 'Einstellungen')}
    </div>${goldButton(A, 'fight', 'fight', 'Fight').replace('class="v2-btn', 'class="v2-btn v2-lift')}`;

  const front = `${hazeHtml([300, 600, 1380, 800], '255 190 130', 0.35)}
    ${profile}${topHtml(A, T, m)}${tiles}${nav}`;
  return screenHtml(back, front);
}

export function mountHomeV4(root: HTMLElement, m: HomeV4Model, onAction: (a: HomeV4Action) => void): () => void {
  const stop = mountV2(root, { hues: [36, 330, 205], living: A, haze: [0.62, 0.45, 0.32], crowdY: 0.3, rigid: [[HOME_LOGO[0], HOME_LOGO[1], HOME_LOGO[2] - HOME_LOGO[0], HOME_LOGO[3] - HOME_LOGO[1]]] });
  const figs = menuFigures(root);
  const anchor = root.querySelector<HTMLElement>('[data-fig="0"]');
  if (anchor) figs.set([{ id: m.fighter, anchor, facing: 1, rim: 0xffb347, rim2: 0x4f8dff, turn: 0.75, showcase: true }]);
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (b && root.contains(b)) onAction(b.dataset.act as HomeV4Action);
  });
  return () => {
    stop();
    figs.dispose();
  };
}

export const homeToastV4 = (root: HTMLElement, msg: string): void => toast(root, msg);
