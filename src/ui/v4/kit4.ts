// Design v4 (D47): shared pieces of the PO's street masters (home, modes, select, customize, lobby). Every screen is
// the v2 runtime (stage.ts: plate + sprites on their own pixels, living plate, 3D fighters between the layers) with the
// art cut from the v4 masters (tools/ui-extract/v4_screens.py). Here: the top bar (live amounts over the master's
// capsules, its buttons) and the light that makes the cut pieces sit in the scene instead of on top of it.
import './v4.css';
import { de } from '../menu/kit';
import { button, t, zone, type ScreenArt } from '../v2/stage';

export interface Wallet {
  coins: number;
  gems: number;
  /** Rank points (the master's trophy capsule). */
  trophies: number;
}

type Texts = Readonly<Record<string, Readonly<Record<string, readonly number[]>>>>;

/** Live amounts in the master's capsules + the top-bar buttons this screen has (plus = shop, mail = news,
 *  friends = social, back, gear = settings). */
export function topHtml(A: ScreenArt, T: Texts, w: Wallet): string {
  const amount = (k: 'coins' | 'gems' | 'trophies', v: number) =>
    T[k] ? t(de(v), zone(T[k].amount), 0, 0, { cls: 'v2-num v4-amt', fs: 26, align: 'left' }) : '';
  const b = (id: string, act: string, label: string, cls = '') => (A.art[id] ? button(A, id, act, label, () => '', `v4-btn ${cls}`) : '');
  return `${amount('coins', w.coins)}${amount('gems', w.gems)}${amount('trophies', w.trophies)}
    ${b('plus1', 'shop', 'Münzen kaufen')}${b('plus2', 'shop', 'Diamanten kaufen')}
    ${b('mail', 'news', 'Postfach')}${b('friends', 'social', 'Freunde')}
    ${b('back', 'back', 'Zurück', 'v4-back')}${b('gear', 'settings', 'Einstellungen')}`;
}

/** The big gold chain button of a screen (FIGHT, WEITER, AUSRÜSTEN, LOBBY ERSTELLEN): breathing glow and a light
 *  sweep across its own shape (the sprite is the mask). */
export function goldButton(A: ScreenArt, id: string, act: string, label: string, extra = ''): string {
  return button(A, id, act, label, () => '', 'v2-main v4-gold', `--mask:url(${A.dir}${id}.webp)`).replace('<button ', `<button ${extra} `);
}

/** A tile or panel button with a slow sheen running over it (staggered per tile via --d seconds). */
export function tileButton(A: ScreenArt, id: string, act: string, label: string, delay: number, cls = '', inner: (ox: number, oy: number) => string = () => ''): string {
  return button(A, id, act, label, inner, `v4-tile ${cls}`, `--mask:url(${A.dir}${id}.webp);--d:${delay}s`);
}

/** A sprite placed over a reference box (scaled to it): ring frames moved onto another tile, mirrored states. */
export function placed(A: ScreenArt, id: string, b: readonly number[], cls = '', mirror = false): string {
  const [x0, y0, x1, y1] = b;
  return `<img class="v2-art ${cls}" alt="" draggable="false" decoding="sync" src="${A.dir}${id}.webp" style="--x:${x0};--y:${y0};--w:${x1 - x0};--h:${y1 - y0}${mirror ? ';transform:scaleX(-1)' : ''}">`;
}

// The PO's artwork drop-ins (cards, characters, select boxes, banners, skins: design/v4/README.md). Listed in
// assets/ui4/art/manifest.json (scripts/art-manifest.mjs), so nothing is probed that is not there.
let artFiles = new Set<string>();
export const artReady: Promise<void> = fetch('assets/ui4/art/manifest.json')
  .then((r) => (r.ok ? r.json() : []))
  .then((l: unknown) => {
    if (Array.isArray(l)) artFiles = new Set(l.filter((x): x is string => typeof x === 'string'));
  })
  .catch(() => undefined);
/** URL of a PO artwork file under assets/ui4/art/ when it exists, else undefined. */
export const artUrl = (rel: string): string | undefined => (artFiles.has(rel) ? `assets/ui4/art/${rel}` : undefined);

/** [x, y, w, h] -> [x0, y0, x1, y1] */
export const xywh = (b: readonly number[]): [number, number, number, number] => [b[0], b[1], b[0] + b[2], b[1] + b[3]];
