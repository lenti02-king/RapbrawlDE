// Shop from the PO master (D38): store plate (logo + gold SHOP banner as drawn), the master's tabs, item cards and
// bundle with native German names/prices. Placeholder economy (PO decision): local coins/diamonds, nothing can be
// bought yet, no real money anywhere (the bundle's "$19.99" became "BALD VERFÜGBAR").
import { SH_ART, SH_BOXES } from './shopArt';
import { de, esc, keepLaidOut, layoutStage, pos, text, type Box } from './kit';

type Art = keyof typeof SH_ART;
const B = SH_BOXES;
/** Everything interactive or readable (reference px): kept on screen, as large as possible. */
const SAFE: Box = [10, 2, 1970, 1016];

export interface ShopModel {
  coins: number;
  gems: number;
}

const TABS: [keyof typeof B & ('skins' | 'gear' | 'emotes' | 'currency' | 'bundles'), string][] = [
  ['skins', 'SKINS'],
  ['gear', 'AUSRÜSTUNG'],
  ['emotes', 'EMOTES'],
  ['currency', 'WÄHRUNG'],
  ['bundles', 'PAKETE'],
];
const ITEMS: ['champ' | 'verse' | 'flow' | 'gloves' | 'kicks', string, number][] = [
  ['champ', 'STRASSEN-CHAMP', 1200],
  ['verse', 'GOLD-VERS', 1490],
  ['flow', 'NACHT-FLOW', 1200],
  ['gloves', 'CHAMP-HANDSCHUHE', 800],
  ['kicks', 'BRAWL-KICKS', 950],
];

function art(id: Art, cls = '', ox = 0, oy = 0): string {
  const s = SH_ART[id];
  return `<img class="mm-art ${cls}" alt="" draggable="false" src="${s.src}" style="${pos(s.x - ox, s.y - oy, s.w, s.h)}">`;
}

function btn(id: Art, attrs: string, label: string, inner = ''): string {
  const s = SH_ART[id];
  return `<button class="mm-btn sh-btn" ${attrs} aria-label="${esc(label)}" style="${pos(s.x, s.y, s.w, s.h)}">${art(id, '', s.x, s.y)}${inner}</button>`;
}

export function shopHtml(m: ShopModel): string {
  const bg = SH_ART.bg;
  const num = (id: 'coins' | 'gems', v: number, b: readonly number[]) => {
    const s = SH_ART[id];
    return btn(id, 'data-buy="currency"', id === 'coins' ? 'Münzen' : 'Diamanten', text(de(v), [b[0], b[1], b[2] + 20, b[3]], s.x, s.y, { cls: 'mm-num', fs: 40 }));
  };
  const tabs = TABS.map(([k, label]) => {
    const s = SH_ART[`tab_${k}`];
    const b = B[k];
    return `<button class="mm-btn sh-tab ${k === 'skins' ? 'on' : ''}" data-tab="${k}" aria-label="${esc(label)}" style="${pos(s.x, s.y, s.w, s.h)}">${art(`tab_${k}`, '', s.x, s.y)}${text(
      label,
      [b[0] + 14, B.labelY[0], b[2] - 14, B.labelY[1]],
      s.x,
      s.y,
      { cls: `sh-tablabel ${k === 'skins' ? 'on' : ''}`, fs: 34, align: 'center' },
    )}</button>`;
  }).join('');
  const cards = ITEMS.map(([k, name, price]) => {
    const id = `card_${k}` as Art;
    const s = SH_ART[id];
    const b = B[`card_${k}`];
    return `<button class="mm-btn sh-card" data-buy="${k}" aria-label="${esc(name)}" style="${pos(s.x, s.y, s.w, s.h)}">${art(id, '', s.x, s.y)}
      ${text(name, [b[0] + 14, B.nameY[0], b[2] - 14, B.nameY[1]], s.x, s.y, { cls: 'sh-name', fs: 30, align: 'center' })}
      ${text(de(price), [B.priceX[k], B.priceY[0], b[2] - 12, B.priceY[1]], s.x, s.y, { cls: 'mm-num sh-price', fs: 34 })}</button>`;
  }).join('');
  const bs = SH_ART.bundle;
  const [tx0, ty0, tx1, ty1] = B.bundleTitle;
  const rb = B.bundle_ribbon;
  const pb = B.bundle_price;
  const bundle = `<button class="mm-btn sh-bundle" data-buy="bundle" aria-label="Fight-Night-Paket" style="${pos(bs.x, bs.y, bs.w, bs.h)}">${art('bundle', '', bs.x, bs.y)}
    ${text('NUR KURZ', [rb[0] - 4, rb[1] + 4, rb[2] + 4, rb[3] - 10], bs.x, bs.y, { cls: 'sh-ribbon', fs: 25, align: 'center' })}
    ${text('SPEZIAL', [tx0 + 80, ty0, tx1 - 80, ty0 + 40], bs.x, bs.y, { cls: 'as-title sh-btitle', fs: 40, align: 'center' })}
    ${text('FIGHT-NIGHT-PAKET', [tx0 - 10, ty0 + 38, tx1 + 10, ty1 - 2], bs.x, bs.y, { cls: 'as-title sh-btitle', fs: 58, align: 'center' })}
    ${text('BALD VERFÜGBAR', [pb[0], pb[1], pb[2] + 2, pb[3] - 4] as unknown as Box, bs.x, bs.y, { cls: 'cs-ready sh-bprice', fs: 40, align: 'center' })}</button>`;
  return `<div class="cs-blur" style="background-image:url(${bg.src})"></div>
    <div class="cs-stage">
      <img class="cs-bg" alt="" draggable="false" src="${bg.src}" style="${pos(bg.x, bg.y, bg.w, bg.h)}">
      ${btn('back', 'data-back', 'Zurück')}
      ${num('coins', m.coins, B.coinsNum)}${num('gems', m.gems, B.gemsNum)}
      ${btn('menu', 'data-settings', 'Einstellungen')}
      <div class="sh-wip">${tabs}${cards}${bundle}</div>
      <div class="sh-tape a" style="${pos(150, 720, 1700, 70)}"><span>${'KOMMT BALD · DESIGNER AM WERK · '.repeat(4)}</span></div>
      <div class="sh-tape b" style="${pos(150, 720, 1700, 70)}"><span>${'DIE ERSTE KOLLEKTION WIRD GERADE ENTWORFEN · '.repeat(3)}</span></div>
    </div>
    <div class="mm-toast" hidden></div>`;
}

export function mountShop(root: HTMLElement): () => void {
  root.classList.add('mm', 'sh');
  const stage = root.querySelector<HTMLElement>('.cs-stage')!;
  return keepLaidOut(root, () => layoutStage(root, stage, SAFE, SH_ART.bg));
}
