// Loading screen from the PO master (D38): clean background plate + the PO logo (both in background space, so the
// logo stays where the master has it), the extracted bar (empty track, blue fill as 3-slice, spark as additive layer)
// and a native label, anchored to the bottom of the screen. Used for the boot, the title ("TIPPEN ZUM STARTEN") and
// the pre-match load.
import { MM_ART } from './mainMenuArt';
import { LD_ART, LD_BOXES } from './loadingArt';
import { clamp, coverOf, fitTexts, pos, safeInsets, text } from './kit';

const REF_W = 2000;
const REF_H = 1125;
const BG_ANCHOR_Y = 0.12; // phones crop the 16:9 plate: keep the sky/logo, lose some wet floor
const [LX0, LY0, LX1, LY1] = LD_BOXES.logo;
const CH1 = LD_BOXES.channel[2];
const T = LD_ART.track;
const F = LD_ART.fill;
const SP = LD_ART.spark;
const GX0 = T.x;
const GY0 = LD_BOXES.label[1];
const GW = T.w;
const GH = T.y + T.h - GY0;

export function loadingHtml(label: string): string {
  return `<div class="mm-bg ld-bg" style="background-image:url(${LD_ART.bg.src})"></div>
    <div class="ld-logo" style="${pos(LX0, LY0, LX1 - LX0, LY1 - LY0)}"><img alt="RAP BRAWL" draggable="false" src="${MM_ART.logo.src}"></div>
    <div class="mm-g ld-bar" style="--w:${GW};--h:${GH}">
      <img class="mm-art" alt="" draggable="false" src="${T.src}" style="${pos(T.x - GX0, T.y - GY0, T.w, T.h)}">
      <span class="ld-clip" style="${pos(F.x - GX0, F.y - GY0, CH1 - F.x, F.h)}"><span class="ld-fill" style="border-image-source:url(${F.src})"></span></span>
      <img class="ld-spark" alt="" draggable="false" src="${SP.src}" style="${pos(SP.x - GX0, SP.y - GY0, SP.w, SP.h)}">
      ${text(label, [LD_BOXES.label[0] - 140, LD_BOXES.label[1], LD_BOXES.label[2] + 140, LD_BOXES.label[3]], GX0, GY0, { cls: 'ld-label', fs: 58, align: 'center' })}
    </div>`;
}

/** Set the bar to `p` (0..1): the fill strip grows from its left cap; the spark rides on its end. */
export function setLoading(root: HTMLElement, p: number): void {
  const k = clamp(p, 0, 1);
  const w = 40 + k * (CH1 - F.x - 40);
  const bar = root.querySelector<HTMLElement>('.ld-bar');
  if (!bar) return;
  bar.style.setProperty('--fill', `${w}`);
  bar.style.setProperty('--spark', `${F.x - GX0 + w - (LD_BOXES.spark - SP.x)}`);
  bar.classList.toggle('full', k >= 0.999);
}

export function setLoadingLabel(root: HTMLElement, label: string, pulse = false): void {
  const t = root.querySelector<HTMLElement>('.ld-label');
  if (!t) return;
  const i = t.firstElementChild as HTMLElement;
  i.textContent = label;
  i.dataset.t = label;
  t.classList.toggle('pulse', pulse);
  fitTexts(root);
}

export function layoutLoading(root: HTMLElement): void {
  const W = root.clientWidth;
  const H = root.clientHeight;
  if (!W || !H) return;
  const ins = safeInsets(root);
  const c = coverOf(W, H, REF_W, REF_H, 0.5, BG_ANCHOR_Y);
  const bg = root.querySelector<HTMLElement>('.ld-bg');
  if (bg) {
    bg.style.backgroundSize = `${REF_W * c.s}px ${REF_H * c.s}px`;
    bg.style.backgroundPosition = `${c.ox}px ${c.oy}px`;
  }
  // logo in background space (sits on its hole in the plate), kept inside the top edge
  const logo = root.querySelector<HTMLElement>('.ld-logo');
  if (logo) {
    const top = Math.max(c.oy + LY0 * c.s, ins.t + 6);
    logo.style.transform = `translate(${c.ox + LX0 * c.s}px, ${top}px)`;
    logo.style.setProperty('--u', `${c.s}px`);
  }
  // bar: screen space, bottom-anchored like the master; 1:1 at 16:9, up to 15 % larger on wider phones
  const base = Math.min((H - ins.t - ins.b) / REF_H, (W - ins.l - ins.r) / REF_W);
  const grow = clamp(1 + ((W - ins.l - ins.r) / base - REF_W) / 1500, 1, 1.15);
  const u = clamp(base * grow, 0, (W * 0.9) / GW);
  const bar = root.querySelector<HTMLElement>('.ld-bar');
  if (bar) {
    bar.style.setProperty('--u', `${u}px`);
    const y = H - ins.b - (REF_H - GY0 - GH) * u - GH * u;
    bar.style.transform = `translate(${(W - GW * u) / 2}px, ${y}px)`;
  }
  root.style.setProperty('--u', `${u}px`);
  fitTexts(root);
}

export function mountLoading(root: HTMLElement): () => void {
  root.classList.add('mm', 'ld');
  const re = () => layoutLoading(root);
  re();
  document.fonts?.ready.then(re).catch(() => undefined);
  const ro = new ResizeObserver(re);
  ro.observe(root);
  return () => ro.disconnect();
}
