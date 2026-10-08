// Design v4 loading screen (no master of its own, D47): the Frankfurt scene of the home master without its UI (the
// logo is part of it), the profile's XP track and blue fill from the same master as the progress bar, the label and a
// rotating TIPP natively. Same functions as the other designs (menu/loading.ts dispatches here).
import { esc, fitTexts } from '../menu/kit';
import { isPhone } from '../../render/textureBudget';
import { HOME_CLEAN_DIR, HOME_CLEAN_LIGHTS, HOME_CLEAN_PLATE } from './art/home_clean';
import { hazeHtml, lightsHtml, mountV2, plateHtml, screenHtml, t, type ScreenArt } from '../v2/stage';
import { knownWallet, kitSrc, topHtml } from './kit4';
import { HOME_DIR, HOME_LIGHTS, HOME_PLATE, HOME_TEXT } from './art/home';

const A: ScreenArt = { dir: HOME_CLEAN_DIR, plate: HOME_CLEAN_PLATE, art: {}, lights: HOME_CLEAN_LIGHTS };
const TIPS = [
  'Specials direkt nach einem geblockten Angriff einsetzen.',
  'Im Takt treffen: Beat-Drop-Treffer machen mehr Schaden.',
  'Gegner an die Bande drücken – Wand-Splat!',
  'Gleichzeitig zugeschlagen? Im Mic-Duell schneller tippen.',
  'Nach dem letzten K.O.: SIGNATURE für die Fatality.',
  'Tief blocken gegen Feger, hoch gegen Sprungangriffe.',
];
/** Bar box (reference px): on the wet floor in front of the pedestal. */
const BAR = [446, 772, 780, 52];

export function loadingHtmlV4(label: string): string {
  const [bx, by, bw, bh] = BAR;
  const k = Math.floor(Math.random() * TIPS.length);
  // the home master's capsules are painted into the scene: their amounts (the buttons stay out: nothing to press here)
  const w = knownWallet();
  const amounts = w ? topHtml({ dir: HOME_DIR, plate: HOME_PLATE, art: {}, lights: HOME_LIGHTS }, HOME_TEXT, w) : '';
  const front = `${hazeHtml([200, 600, 1470, 880], '255 190 130', 0.4)}${amounts}
    ${t(label, [bx - 120, by - 70, bx + bw + 120, by - 12], 0, 0, { cls: 'v4-title v4-ldlabel', fs: 40, align: 'center' })}
    <span class="v4-ldbar" style="--x:${bx};--y:${by};--w:${bw};--h:${bh};border-image-source:url(${kitSrc('track')})">
      <span class="v4-ldclip"><img alt="" draggable="false" src="${kitSrc('fill')}"></span></span>
    <span class="v2-tip v4-tip" style="--x:${bx - 60};--y:${by + bh + 14};--w:${bw + 120};--h:44"><b>TIPP:</b> <span>${esc(TIPS[k])}</span></span>`;
  return screenHtml(`${plateHtml(A)}${lightsHtml(A, 28)}`, front);
}

export function setLoadingV4(root: HTMLElement, p: number): void {
  const k = Math.max(0, Math.min(1, p));
  root.querySelector<HTMLElement>('.v4-ldbar')?.style.setProperty('--p', k.toFixed(3));
}

export function setLoadingLabelV4(root: HTMLElement, label: string, pulse = false): void {
  const el = root.querySelector<HTMLElement>('.v4-ldlabel');
  const i = el?.firstElementChild as HTMLElement | null;
  if (!el || !i) return;
  i.textContent = label;
  i.dataset.t = label;
  el.classList.toggle('pulse', pulse);
  fitTexts(root);
}

export function mountLoadingV4(root: HTMLElement): () => void {
  root.classList.add('v4-loading');
  // phones: the static painting while the fight's scene is built behind this screen (see v2/loading.ts, S12)
  const stop = mountV2(root, { embers: 40, hues: [40, 330, 210], living: isPhone() ? undefined : A, haze: [0.6, 0.45, 0.35], crowdY: 0.3, rigid: [[648, 120, 382, 240]] });
  let k = 0;
  const tipEl = root.querySelector<HTMLElement>('.v4-tip > span');
  const timer = window.setInterval(() => {
    if (!tipEl) return;
    k = (k + 1) % TIPS.length;
    tipEl.classList.remove('in');
    void tipEl.offsetWidth;
    tipEl.textContent = TIPS[k];
    tipEl.classList.add('in');
  }, 4200);
  return () => {
    stop();
    window.clearInterval(timer);
  };
}
