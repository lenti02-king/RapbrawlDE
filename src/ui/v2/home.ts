// Design v2 home (PO master ref/v2/home.webp): profile, currencies, the six tiles, the nav bar and the big KÄMPFEN
// button stay glued to the painted ring; the player's favourite fighter stands in 3D where the master's illustrated
// hero crouched (in front of the logo, like in the master). German text natively at the master's text boxes.
import { de, toast } from '../menu/kit';
import { menuFigures } from '../menu/figures';
import { HOME_ART, HOME_DIR, HOME_HERO, HOME_LIGHTS, HOME_PLATE, HOME_TEXT } from './art/home';
import { isV3 } from '../design';
import { homeFront3 } from '../v3/home3';
import { beamsHtml, button, hazeHtml, hit, lightsHtml, mountV2, plateHtml, screenHtml, sprite, src, t, zone, type ScreenArt } from './stage';

const A2: ScreenArt = { dir: HOME_DIR, plate: HOME_PLATE, art: HOME_ART, lights: HOME_LIGHTS };
/** Design v3: the 3D arena render behind the same layout (its own lights and beams are in the render). */
const A3: ScreenArt = { ...A2, plateDir: 'assets/ui3/home/', lights: [] };
let A = A2;
const T = HOME_TEXT;

export interface HomeModel {
  name: string;
  level: number;
  xp: number;
  xpMax: number;
  coins: number;
  gems: number;
  energy: string;
  pass: { level: number; xp: number; xpMax: number };
  mode: string; // label under KÄMPFEN (the mode it starts)
  fighter: string; // favourite (stands in the ring)
  badges: { fighters?: boolean; mail?: boolean; events?: boolean; pass?: boolean; modes?: boolean };
}

export type HomeAction = 'profile' | 'shop' | 'news' | 'settings' | 'fighters' | 'decks' | 'events' | 'pass' | 'missions' | 'fight' | 'modes' | 'social' | 'home';

/** Feet and height of the 3D fighter (reference px): feet just behind the top edge of the KÄMPFEN button. */
const FEET: [number, number] = [HOME_HERO.feet[0], 748];
const FIG_H = 540;

function badge(id: string, on: boolean | undefined): string {
  return on ? sprite(A, id, 'v2-badge') : '';
}

export function homeHtml(m: HomeModel): string {
  A = isV3() ? A3 : A2;
  const xp = Math.max(0, Math.min(1, m.xp / Math.max(1, m.xpMax)));
  const pass = Math.max(0, Math.min(1, m.pass.xp / Math.max(1, m.pass.xpMax)));
  const [fx, fy] = FEET;
  const back = `${plateHtml(A)}
    ${lightsHtml(A)}
    ${isV3() ? '' : beamsHtml([
      { x: 1338, y: 150, len: 760, w: 300, rot: 24, swing: 9, color: '255 90 210', period: 9, alpha: 0.26 },
      { x: 1370, y: 118, len: 820, w: 260, rot: 34, swing: 7, color: '90 150 255', period: 12, delay: 3, alpha: 0.24 },
      { x: 480, y: 70, len: 860, w: 300, rot: -28, swing: 8, color: '255 200 120', period: 10.5, delay: 5, alpha: 0.22 },
    ])}
    <span class="fig-anchor" data-fig="0" style="--x:${fx - FIG_H / 4};--y:${fy - FIG_H};--w:${FIG_H / 2};--h:${FIG_H}"></span>`;

  const [xx, xy, xw, xh] = HOME_ART.xp_fill;
  const profile = button(
    A,
    'profile',
    'profile',
    'Profil',
    (ox, oy) =>
      `<img class="v2-art" alt="" src="${src(A, 'xp_fill')}" style="--x:${xx - ox};--y:${xy - oy};--w:${xw};--h:${xh};clip-path:inset(0 ${((1 - xp) * 100).toFixed(1)}% 0 0)">
       ${t(m.name, [T.profile.name[0], T.profile.name[1], T.profile.name[0] + 214, T.profile.name[3]], ox, oy, { cls: 'v2-label', fs: 27 })}
       ${t(`Lv. ${m.level}`, zone(T.profile.level), ox, oy, { cls: 'v2-label', fs: 25 })}`,
  );

  const pill = (k: 'coins' | 'gems' | 'energy', v: string, label: string, b: [number, number, number, number]) =>
    hit(b, 'shop', label, t(v, zone(T[k].amount), b[0], b[1], { cls: 'v2-num', fs: 27, align: 'center' }));
  const top = `${pill('coins', de(m.coins), 'Münzen', [980, 12, 1160, 64])}
    ${pill('gems', de(m.gems), 'Diamanten', [1166, 12, 1342, 64])}
    ${pill('energy', m.energy, 'Energie', [1348, 12, 1518, 64])}
    ${button(A, 'mail', 'news', 'Postfach')}${badge('b_mail', m.badges.mail)}
    ${button(A, 'gear', 'settings', 'Einstellungen')}`;

  const tile = (id: 'fighters' | 'decks' | 'shop' | 'events' | 'missions', act: HomeAction, label: string) =>
    button(A, id, act, label, (ox, oy) => t(label, zone(T[id].label), ox, oy, { cls: 'v2-label', fs: 33 }));
  const [bx, by, , bh] = HOME_ART.pass_fill;
  const passTile = button(
    A,
    'pass',
    'pass',
    'Battle Pass',
    (ox, oy) =>
      `<img class="v2-art" alt="" src="${src(A, 'pass_fill')}" style="--x:${bx - ox};--y:${by - oy};--w:${Math.round(
        (T.pass.bar[2] - T.pass.bar[0]) * pass,
      )};--h:${bh};object-fit:fill">
       ${t('BATTLE PASS', zone(T.pass.label), ox, oy, { cls: 'v2-label', fs: 30 })}
       ${t(`${m.pass.xp}/${m.pass.xpMax}`, zone(T.pass.progress), ox, oy, { cls: 'v2-small', fs: 21, align: 'center' })}
       ${t(String(Math.min(99, m.pass.level)), [1590, 581, 1619, 607], ox, oy, { cls: 'v2-label v2-gold', fs: 22, align: 'center' })}`,
  );

  const tiles = `${tile('fighters', 'fighters', 'KÄMPFER')}${badge('b_fighters', m.badges.fighters)}
    ${tile('decks', 'decks', 'DECKS')}
    ${tile('shop', 'shop', 'SHOP')}
    ${tile('events', 'events', 'EVENTS')}${badge('b_events', m.badges.events)}
    ${passTile}${badge('b_pass', m.badges.pass)}
    ${tile('missions', 'missions', 'MISSIONEN')}`;

  const N = T.nav;
  const tab = (k: 'home' | 'fighters' | 'decks' | 'events' | 'shop' | 'social', act: HomeAction, label: string) => {
    const tb = N[`t_${k}`];
    return hit(zone(tb), act, label, t(label, zone(N[k]), tb[0], tb[1], { cls: `v2-nav ${k === 'home' ? 'on' : ''}`, fs: 25, align: 'center' }), 'v2-tab');
  };
  const nav = `${sprite(A, 'nav', 'v2-lift')}
    <div class="v2-lift v2-group" style="--x:0;--y:0;--w:1672;--h:941">
      ${tab('home', 'home', 'START')}${tab('fighters', 'fighters', 'KÄMPFER')}${tab('decks', 'decks', 'DECKS')}
      ${tab('events', 'modes', 'MODI')}${tab('shop', 'shop', 'SHOP')}${tab('social', 'social', 'FREUNDE')}
    </div>${m.badges.modes ? sprite(A, 'b_nav_events', 'v2-badge v2-lift') : ''}`;

  const F = T.fight;
  const fight = button(
    A,
    'fight',
    'fight',
    `Kämpfen: ${m.mode}`,
    (ox, oy) =>
      `${t('KÄMPFEN', [F.label[0] - 8, F.label[1], F.label[2] + 34, 842], ox, oy, { cls: 'v2-brush', fs: 88, align: 'center' })}
       ${t(m.mode, [F.label[0] + 4, 838, F.label[2] + 30, 866], ox, oy, { cls: 'v2-mode', fs: 22, align: 'center' })}`,
    'v2-main v2-lift',
    `--mask:url(${A.dir}fight_mask.webp)`,
  );

  // design v3: the cartoon UI kit in the same layout (ui/v3/home3.ts)
  const front = isV3() ? homeFront3(m) : `${hazeHtml([260, 560, 1420, 830], '220 180 255', 0.5)}
    ${profile}${top}${tiles}${nav}${fight}`;
  return screenHtml(back, front);
}

export function mountHome(root: HTMLElement, m: HomeModel, onAction: (a: HomeAction) => void): () => void {
  const stop = mountV2(root, { hues: [42, 320, 210], living: A, haze: [0.56, 0.44, 0.78], crowdY: 0.42, rigid: isV3() ? [[580, 0, 1090, 300]] : [[470, 0, 740, 280]] });
  const figs = menuFigures(root);
  const anchor = root.querySelector<HTMLElement>('[data-fig="0"]');
  if (anchor) figs.set([{ id: m.fighter, anchor, facing: 1, rim: 0xff4fd0, rim2: 0x4f8dff, turn: 0.85, showcase: true }]);
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (b && root.contains(b)) onAction(b.dataset.act as HomeAction);
  });
  return () => {
    stop();
    figs.dispose();
  };
}

export function homeToast(root: HTMLElement, msg: string): void {
  toast(root, msg);
}
