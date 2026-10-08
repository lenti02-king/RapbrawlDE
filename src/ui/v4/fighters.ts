// Design v4 KÄMPFER (S15, PO): every fighter as a card - the PO's card artwork goes into the card's picture window
// (assets/ui4/art/fighters/<id>.webp, see design/v4/README.md), until then the fighter's rendered portrait; name and
// home town clearly under it. No master of its own (D47): the Frankfurt scene without UI, the lobby panels' look
// (navy, gold frame, thin blue line), the masters' blue and gold buttons. Tap a card to pick it, tap it again (or
// ANPASSEN) for the customise screen; FAVORIT puts the fighter on the home pedestal; DECK opens his cards.
import { esc } from '../menu/kit';
import { HOME_CLEAN_DIR, HOME_CLEAN_LIGHTS, HOME_CLEAN_PLATE } from './art/home_clean';
import { plateHtml, screenHtml, t, type ScreenArt } from '../v2/stage';
import { mountRing } from '../v2/ring';
import { kitButton, topBarV4, type Wallet } from './kit4';

const A: ScreenArt = { dir: HOME_CLEAN_DIR, plate: HOME_CLEAN_PLATE, art: {}, lights: HOME_CLEAN_LIGHTS };

export interface FighterCardV4 {
  id: string;
  name: string;
  /** Home town in capitals. */
  city: string;
  /** Card picture: the PO's artwork when it exists, else the rendered portrait. */
  img: string;
  /** True when img is the PO's card artwork (fills the window edge to edge). */
  art: boolean;
  fav: boolean;
}

export type FightersV4Action = 'back' | 'custom' | 'fav' | 'deck';

/** Card geometry (reference px): the cards in a row under the logo, the buttons below. Up to four at full size; a
 *  fifth fighter (S16: Jazeek Cartoon) shrinks the row so it still fits between the screen edges. */
const CARD = { w: 292, h: 438, gap: 36, y: 362 };
const WIN = { x: 10, y: 10, w: 272, h: 334 }; // picture window inside the card (4:5 artwork, see README)

function cardHtml(c: FighterCardV4, i: number, n: number, on: boolean): string {
  const k = Math.min(1, 1500 / (n * CARD.w + (n - 1) * CARD.gap));
  const w = Math.round(CARD.w * k);
  const h = Math.round(CARD.h * k);
  const gap = Math.round(CARD.gap * k);
  const win = { x: WIN.x * k, y: WIN.y * k, w: WIN.w * k, h: WIN.h * k };
  const x0 = (1672 - (n * w + (n - 1) * gap)) / 2 + i * (w + gap);
  const y0 = CARD.y + (CARD.h - h) / 2;
  const pic = c.img ? `<img alt="" draggable="false" src="${c.img}">` : '';
  const name = c.name.length > 10 ? 34 * k * 0.82 : 34 * k;
  return `<button class="v2-btn v4-fcard ${on ? 'on' : ''} ${c.art ? 'art' : ''}" data-f="${esc(c.id)}" aria-label="${esc(c.name)}" style="--x:${x0};--y:${y0};--w:${w};--h:${h};--d:${i * 0.5}s">
      <span class="v4-win v4-fart" style="--x:${win.x};--y:${win.y};--w:${win.w};--h:${win.h}">${pic}</span>
      ${c.fav ? t('FAVORIT', [win.x + 10, win.y + 10, win.x + 120 * k, win.y + 40 * k], 0, 0, { cls: 'v4-city v4-favtag', fs: 20 * k, align: 'center' }) : ''}
      ${t(c.name, [6, win.y + win.h + 6 * k, w - 6, win.y + win.h + 50 * k], 0, 0, { cls: 'v4-pname', fs: name, align: 'center' })}
      ${t(c.city, [6, win.y + win.h + 52 * k, w - 6, win.y + win.h + 82 * k], 0, 0, { cls: 'v4-city', fs: 24 * k, align: 'center' })}
    </button>`;
}

export function fightersHtmlV4(cards: FighterCardV4[], sel: string, w: Wallet): string {
  const front = `${topBarV4('KÄMPFER', w)}
    ${cards.map((c, i) => cardHtml(c, i, cards.length, c.id === sel)).join('')}
    ${kitButton('blue', 'custom', 'ANPASSEN', [380, 822, 264, 70], 30)}
    ${kitButton('gold', 'fav', 'FAVORIT', [664, 808, 344, 96], 44)}
    ${kitButton('blue', 'deck', 'DECK', [1028, 822, 264, 70], 30)}`;
  return screenHtml(plateHtml(A), front);
}

export function mountFightersV4(root: HTMLElement, sel: string, onAction: (a: FightersV4Action, id: string) => void): () => void {
  root.classList.add('v4-fighters');
  const stop = mountRing(root, null);
  let cur = sel;
  const cards = [...root.querySelectorAll<HTMLElement>('[data-f]')];
  for (const c of cards)
    c.addEventListener('click', () => {
      const id = c.dataset.f!;
      if (id === cur) return onAction('custom', id); // a second tap on the picked card opens its customising
      cur = id;
      cards.forEach((x) => x.classList.toggle('on', x === c));
    });
  root.querySelectorAll<HTMLElement>('[data-act="custom"], [data-act="fav"], [data-act="deck"]').forEach((b) =>
    b.addEventListener('click', () => onAction(b.dataset.act as FightersV4Action, cur)),
  );
  root.querySelector('[data-back]')?.addEventListener('click', () => onAction('back', cur));
  return stop;
}
