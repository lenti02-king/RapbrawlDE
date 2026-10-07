// Design v2 "Kämpfer anpassen" (PO master ref/v2/custom.webp): category menu on the left, the fighter in 3D on the
// pedestal (arrows switch fighters), style presets and a preview on the right, LOOK SPEICHERN. Outfits, gloves, shoes
// and colours do not exist yet: those categories say so honestly ("KOMMT BALD"); POSE switches the menu pose.
import { de, esc } from '../menu/kit';
import { menuFigures } from '../menu/figures';
import { CUSTOM_ART, CUSTOM_DIR, CUSTOM_LIGHTS, CUSTOM_PLATE, CUSTOM_TEXT } from './art/custom';
import { topBarHtml, type TopBar } from './arena';
import { button, hazeHtml, lightsHtml, mountV2, plateHtml, screenHtml, src, t, zone, type ScreenArt } from './stage';

const A: ScreenArt = { dir: CUSTOM_DIR, plate: CUSTOM_PLATE, art: CUSTOM_ART, lights: CUSTOM_LIGHTS };
const T = CUSTOM_TEXT;
const FEET: [number, number] = [820, 742];
const FIG_H = 560;

export const CUSTOM_MENU = ['OUTFIT', 'HANDSCHUHE', 'SCHUHE', 'POSE', 'INTRO', 'FINISHER', 'FARBEN', 'ACCESSOIRES'];

export interface CustomModel {
  id: string;
  name: string;
  hero: string; // big render for the preview window
  presets: string[]; // up to 4 portraits (the roster)
  presetIds: string[];
  tab: number;
  bar: TopBar;
}

function pills(bar: TopBar): string {
  const C = T.cur;
  const tap = (b: readonly number[], act: string, label: string, inner = '') =>
    `<button class="v2-hit" data-act="${act}" aria-label="${label}" style="--x:${b[0]};--y:${b[1]};--w:${b[2] - b[0]};--h:${b[3] - b[1]}">${inner}</button>`;
  const amt = (v: string, z: readonly number[], b: readonly number[]) => t(v, [z[0] - 6, z[1], z[2] + 6, z[3]], b[0], b[1], { cls: 'v2-num', fs: 27 });
  return `${tap(C.t_coins, 'shop', 'Münzen', amt(de(bar.coins), C.coins, C.t_coins))}
    ${tap(C.t_gems, 'shop', 'Diamanten', amt(de(bar.gems), C.gems, C.t_gems))}
    ${tap(C.t_energy, 'shop', 'Energie', amt(bar.energy, C.energy, C.t_energy))}
    ${tap(C.t_mail, 'news', 'Postfach')}${tap(C.t_gear, 'settings', 'Einstellungen')}`;
}

export function customHtml(m: CustomModel): string {
  const [fx, fy] = FEET;
  const back = `${plateHtml(A)}${lightsHtml(A, 22)}
    <span class="fig-anchor" data-fig="0" style="--x:${fx - FIG_H / 4};--y:${fy - FIG_H};--w:${FIG_H / 2};--h:${FIG_H}"></span>`;
  const menu = CUSTOM_MENU.map((label, i) => {
    const id = `m${i}` as 'm0';
    const tz = T[id].label;
    return button(A, id, `tab:${i}`, label, (ox, oy) => t(label, [tz[0] - 4, tz[1], tz[2] + 6, tz[3]], ox, oy, { cls: `v2-label ${i === m.tab ? 'v2-ink' : ''}`, fs: 27 }), i === m.tab ? 'v2-on' : 'v2-off');
  }).join('');
  const P = T.panels;
  const preset = (k: number) => {
    const b = P[`p${k}` as 'p0'];
    const img = m.presets[k];
    const pid = m.presetIds[k];
    return img
      ? `<button class="v2-hit v2-preset ${pid === m.id ? 'on' : ''}" data-preset="${pid}" aria-label="${esc(pid)}" style="--x:${b[0]};--y:${b[1]};--w:${b[2] - b[0]};--h:${b[3] - b[1]}"><img alt="" src="${img}"></button>`
      : '';
  };
  const w = P.win;
  const sv = T.save.label;
  const front = `${hazeHtml([400, 600, 1200, 820], '255 200 120', 0.45)}
    ${topBarHtml(null, null)}${pills(m.bar)}
    ${t('KÄMPFER ANPASSEN', [130, 16, 600, 80], 0, 0, { cls: 'v2-marker v2-gold', fs: 52 })}
    ${menu}
    <button class="v2-hit" data-switch="-1" aria-label="Vorheriger Kämpfer" style="--x:548;--y:430;--w:70;--h:90"></button>
    <button class="v2-hit" data-switch="1" aria-label="Nächster Kämpfer" style="--x:968;--y:430;--w:70;--h:90"></button>
    ${t(m.name, [600, 752, 1040, 792], 0, 0, { cls: 'v2-label', fs: 34, align: 'center' })}
    ${t('KÄMPFER', [P.presets[0] - 4, P.presets[1], P.presets[2] + 60, P.presets[3]], 0, 0, { cls: 'v2-marker', fs: 34 })}
    ${preset(0)}${preset(1)}${preset(2)}${preset(3)}
    ${t('VORSCHAU', [P.preview[0] - 4, P.preview[1], P.preview[2] + 60, P.preview[3]], 0, 0, { cls: 'v2-marker', fs: 34 })}
    <span class="v2-win2 v2-preview" style="--x:${w[0]};--y:${w[1]};--w:${w[2] - w[0]};--h:${w[3] - w[1]}"><img alt="" src="${m.hero}"></span>
    <span class="v2-tabnote" style="--x:${w[0] + 20};--y:${w[3] - 60};--w:${w[2] - w[0] - 40};--h:44"></span>
    ${button(A, 'dice', 'random', 'Zufall')}
    ${button(A, 'save', 'save', 'Look speichern', (ox, oy) => t('LOOK SPEICHERN', zone([sv[0] - 30, sv[1], sv[2] + 30, sv[3]]), ox, oy, { cls: 'v2-brush', fs: 58, align: 'center' }), 'v2-main', `--mask:url(${src(A, 'save')})`)}`;
  return screenHtml(back, front);
}

export function mountCustom(root: HTMLElement, id: string, pose: 'showcase' | 'fight'): () => void {
  root.classList.add('v2-custom');
  const stop = mountV2(root, { hues: [42, 30, 50], living: A, haze: [0.62, 0.46, 0.3], crowdY: 0.5 });
  const figs = menuFigures(root);
  const anchor = root.querySelector<HTMLElement>('[data-fig="0"]');
  if (anchor) figs.set([{ id, anchor, facing: 1, rim: 0xffb02e, rim2: 0xff6a2e, turn: 0.7, showcase: pose === 'showcase' }]);
  return () => {
    stop();
    figs.dispose();
  };
}
