// Design v3 home front (S13): the v2 home layout (same places for profile, currencies, tiles, KÄMPFEN, nav) built from
// the cartoon UI kit instead of the master's painted sprites - our own fighters on the KÄMPFER tile, card art on DECKS,
// toon vector illustrations elsewhere. The 3D arena plate and the live favourite fighter stay behind it (home.ts).
import './kit3.css';
import { de, esc, pos } from '../menu/kit';
import { portrait } from '../portraits';
import { ART3, ICON3 } from './icons3';
import type { HomeAction, HomeModel } from '../v2/home';

type Box = [number, number, number, number];
const t = (s: string, cls = '', style = '') => `<span class="k3-t ${cls}" style="${style}">${esc(s)}</span>`;

function tile(c: string, act: HomeAction, label: string, b: Box, art: string, icon: string, extra = ''): string {
  return `<button class="k3 k3-btn k3-panel k3-tile" data-c="${c}" data-act="${act}" aria-label="${esc(label)}" style="${pos(...b)}">
    <span class="k3-shine"></span><span class="k3-art">${art}</span>
    <span class="k3-strip"><span class="k3-ico">${icon}</span>${t(label)}</span>${extra}</button>`;
}

const img = (src: string) => (src ? `<img alt="" draggable="false" src="${src}">` : '');

export function homeFront3(m: HomeModel): string {
  const xp = Math.max(0, Math.min(1, m.xp / Math.max(1, m.xpMax)));
  const pass = Math.max(0, Math.min(1, m.pass.xp / Math.max(1, m.pass.xpMax)));
  const badge = (on: boolean | undefined, x: number, y: number) => (on ? `<span class="k3-badge" style="left:calc(${x} * var(--u));top:calc(${y} * var(--u))">!</span>` : '');

  const profile = `<button class="k3 k3-btn k3-panel k3-profile" data-act="profile" aria-label="Profil" style="${pos(30, 12, 400, 98)}">
      <span class="k3-av">${img(portrait(m.fighter, 'bust'))}</span>
      ${t(m.name, '', `left:calc(102 * var(--u));top:calc(12 * var(--u));font-size:calc(30 * var(--u))`)}
      <span class="k3-lv" style="left:calc(100 * var(--u));top:calc(46 * var(--u))">${m.level}</span>
      <span class="k3-bar" style="left:calc(156 * var(--u));top:calc(58 * var(--u));width:calc(220 * var(--u))"><i style="width:${(xp * 100).toFixed(1)}%"></i></span>
    </button>`;
  const pill = (b: Box, icon: string, v: string, label: string) =>
    `<button class="k3 k3-btn k3-panel k3-pill" data-act="shop" aria-label="${esc(label)}" style="${pos(...b)}"><span class="k3-pi">${icon}</span>${t(v)}<span class="k3-plus">${ICON3.plus()}</span></button>`;
  const round = (b: Box, act: HomeAction, icon: string, label: string) =>
    `<button class="k3 k3-btn k3-panel k3-round" data-act="${act}" aria-label="${esc(label)}" style="${pos(...b)}"><span class="k3-ri">${icon}</span></button>`;
  const top = `${pill([986, 16, 170, 50], ICON3.coin(), de(m.coins), 'Münzen')}
    ${pill([1176, 16, 160, 50], ICON3.gem(), de(m.gems), 'Diamanten')}
    ${pill([1356, 16, 172, 50], ICON3.bolt(), m.energy, 'Energie')}
    ${round([1540, 12, 60, 58], 'news', ICON3.mail(), 'Postfach')}${badge(m.badges.mail, 1580, 2)}
    ${round([1606, 12, 60, 58], 'settings', ICON3.gear(), 'Einstellungen')}`;

  // the KÄMPFER tile shows our own fighters, DECKS three of their cards
  const duo = `${img(portrait('jazeek', 'bust'))}${img(portrait('bonez', 'bust'))}`;
  const deck = ['art:jaz_99', 'art:bon_team', 'art:manu_sofa']
    .map((k, i) => {
      const fid = ['jazeek', 'bonez', 'manuellsen'][i];
      const src = portrait(fid, k as `art:${string}`) || portrait(fid, 'card');
      return src ? `<img alt="" draggable="false" src="${src}" style="height:86%;border-radius:calc(8 * var(--u));border:calc(3 * var(--u)) solid #120b18;transform:rotate(${(i - 1) * 12}deg) translateY(${Math.abs(i - 1) * 6}%)">` : '';
    })
    .join('');
  const L = 30;
  const R = 1380;
  const TW = 262;
  const TH = 172;
  const tiles = `${tile('fighters', 'fighters', 'KÄMPFER', [L, 212, TW, TH], duo, ICON3.fighter())}${badge(m.badges.fighters, L + TW - 26, 198)}
    ${tile('decks', 'decks', 'DECKS', [L, 398, TW, TH], deck, ICON3.cards())}
    ${tile('shop', 'shop', 'SHOP', [L, 584, TW, TH], ART3.shop(), ICON3.shop())}
    ${tile('events', 'events', 'EVENTS', [R, 238, TW, TH], ART3.events(), ICON3.calendar())}${badge(m.badges.events, R + TW - 26, 224)}
    ${tile(
      'pass',
      'pass',
      'BATTLE PASS',
      [R, 424, TW, TH],
      ART3.pass(),
      ICON3.ticket(),
      `<span class="k3-bar" style="left:calc(70 * var(--u));top:calc(104 * var(--u));width:calc(150 * var(--u))"><i style="width:${(pass * 100).toFixed(1)}%"></i></span>
       <span class="k3-lv" style="left:calc(14 * var(--u));top:calc(90 * var(--u))">${Math.min(99, m.pass.level)}</span>`,
    )}${badge(m.badges.pass, R + TW - 26, 410)}
    ${tile('missions', 'missions', 'MISSIONEN', [R, 610, TW, TH], ART3.missions(), ICON3.clipboard())}`;

  const fight = `<button class="k3 k3-btn k3-panel k3-fight" data-act="fight" aria-label="Kämpfen: ${esc(m.mode)}" style="${pos(560, 712, 552, 152)}">
      <span class="k3-fist">${ICON3.fist()}</span>${t('KÄMPFEN', 'big')}${t(m.mode, 'sub')}</button>`;

  const tab = (_k: string, act: HomeAction, label: string, icon: string, x: number, on = false) =>
    `<button class="k3 k3-btn k3-panel k3-tab ${on ? 'on' : ''}" data-act="${act}" aria-label="${esc(label)}" style="${pos(x, 838, 150, 96)}"><span class="k3-ti">${icon}</span>${t(label)}</button>`;
  const nav = `<div class="k3 k3-panel k3-nav" style="${pos(-6, 826, 1684, 140)}"></div>
    ${tab('home', 'home', 'START', ICON3.home(), 40, true)}${tab('fighters', 'fighters', 'KÄMPFER', ICON3.fighter(), 200)}${tab('decks', 'decks', 'DECKS', ICON3.cards(), 360)}
    ${tab('events', 'modes', 'MODI', ICON3.trophy(), 1162)}${tab('shop', 'shop', 'SHOP', ICON3.shop(), 1322)}${tab('social', 'social', 'FREUNDE', ICON3.friends(), 1482)}
    ${m.badges.modes ? badge(true, 1290, 826) : ''}`;

  return `${profile}${top}${tiles}${nav}${fight}`;
}
