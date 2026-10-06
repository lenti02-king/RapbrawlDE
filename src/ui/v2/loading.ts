// Design v2 loading / title screen (PO master ref/v2/loading.webp): the arena behind the logo with flickering
// lights, sweeping beams, haze and embers, the gold bar grows from the left, the label and a rotating TIPP are native.
// Same functions as the v1 screen (loadingHtml / setLoading / setLoadingLabel / mountLoading dispatch here).
import { esc, fitTexts } from '../menu/kit';
import { LOADING_ART, LOADING_DIR, LOADING_LIGHTS, LOADING_PLATE, LOADING_TEXT } from './art/loading';
import { beamsHtml, hazeHtml, lightsHtml, mountV2, plateHtml, screenHtml, src, t, type ScreenArt } from './stage';

const A: ScreenArt = { dir: LOADING_DIR, plate: LOADING_PLATE, art: LOADING_ART, lights: LOADING_LIGHTS };
const T = LOADING_TEXT;
const TIPS = [
  'Specials direkt nach einem geblockten Angriff einsetzen.',
  'Im Takt treffen: Beat-Drop-Treffer machen mehr Schaden.',
  'Gegner an die Bande drücken – Wand-Splat!',
  'Gleichzeitig zugeschlagen? Im Mic-Duell schneller tippen.',
  'Nach dem letzten K.O.: SIGNATURE für die Fatality.',
  'Tief blocken gegen Feger, hoch gegen Sprungangriffe.',
];

export function loadingHtmlV2(label: string): string {
  const tr = T.bar.track;
  const tip = T.tip.tip;
  const k = Math.floor(Math.random() * TIPS.length);
  const back = `${plateHtml(A)}${lightsHtml(A, 26)}${beamsHtml([
    { x: 250, y: 30, len: 700, w: 280, rot: 18, swing: 10, color: '255 70 120', period: 7.5, alpha: 0.2 },
    { x: 1420, y: 30, len: 700, w: 280, rot: -18, swing: 10, color: '80 140 255', period: 8.5, delay: 2, alpha: 0.2 },
    { x: 830, y: 380, len: 420, w: 360, rot: 0, swing: 4, color: '255 220 150', period: 6, alpha: 0.12 },
  ])}`;
  const front = `${hazeHtml([0, 560, 1672, 800], '230 160 255', 0.55)}
    <span class="v2-ldclip" style="--x:${tr[0]};--y:${tr[1]};--w:${tr[2] - tr[0]};--h:${tr[3] - tr[1]}"><img class="v2-ldfill" alt="" src="${src(A, 'fill')}"><i class="v2-spark"></i></span>
    ${t(label, [T.bar.label[0] - 160, T.bar.label[1], T.bar.label[2] + 160, T.bar.label[3]], 0, 0, { cls: 'v2-label v2-ldlabel', fs: 30, align: 'center' })}
    <span class="v2-tip" style="--x:${tip[0]};--y:${tip[1]};--w:${1170 - tip[0]};--h:${tip[3] - tip[1]}"><b>TIPP:</b> <span>${esc(TIPS[k])}</span></span>`;
  return screenHtml(back, front);
}

export function setLoadingV2(root: HTMLElement, p: number): void {
  const k = Math.max(0, Math.min(1, p));
  root.querySelector<HTMLElement>('.v2-ldclip')?.style.setProperty('--p', k.toFixed(3));
}

export function setLoadingLabelV2(root: HTMLElement, label: string, pulse = false): void {
  const el = root.querySelector<HTMLElement>('.v2-ldlabel');
  const i = el?.firstElementChild as HTMLElement | null;
  if (!el || !i) return;
  i.textContent = label;
  i.dataset.t = label;
  el.classList.toggle('pulse', pulse);
  fitTexts(root);
}

export function mountLoadingV2(root: HTMLElement): () => void {
  root.classList.add('v2-loading');
  const stop = mountV2(root, { embers: 40, hues: [40, 330, 210] });
  let k = 0;
  const tipEl = root.querySelector<HTMLElement>('.v2-tip > span');
  const tipBox = root.querySelector<HTMLElement>('.v2-tip');
  const fitTip = () => {
    if (!tipBox) return;
    tipBox.style.setProperty('--fit', '1');
    const need = tipBox.scrollWidth;
    const have = tipBox.clientWidth;
    if (need > have && have > 0) tipBox.style.setProperty('--fit', (have / need).toFixed(3));
  };
  fitTip();
  const ro = new ResizeObserver(fitTip);
  if (tipBox) ro.observe(tipBox);
  const timer = window.setInterval(() => {
    if (!tipEl) return;
    k = (k + 1) % TIPS.length;
    tipEl.classList.remove('in');
    void tipEl.offsetWidth;
    tipEl.textContent = TIPS[k];
    tipEl.classList.add('in');
    fitTip();
  }, 4200);
  return () => {
    ro.disconnect();
    stop();
    window.clearInterval(timer);
  };
}
