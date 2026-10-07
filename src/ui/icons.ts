// Original inline SVG icons for cards and UI (placeholder art until painted card art exists).
import type { CardCategory } from '../core/defs';

const S = 'stroke="#14183a" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"';
const svg = (body: string) => `<svg viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;

export const CAT_COLOR: Record<CardCategory, string> = {
  offense: '#ff6a3d',
  zoning: '#3dc8ff',
  mobility: '#5ce07a',
  counter: '#b56bff',
  utility: '#ffc93d',
  grapple: '#ff4f8b',
  signature: '#ffd23a',
};

export const CAT_DE: Record<CardCategory, string> = {
  offense: 'Angriff',
  zoning: 'Distanz',
  mobility: 'Bewegung',
  counter: 'Konter',
  utility: 'Werkzeug',
  grapple: 'Griff',
  signature: 'Signature',
};

const CARD_ICONS: Record<string, string> = {
  // Jazeek
  jaz_wave: svg(
    `<path d="M14 24h8l10-9v34l-10-9h-8z" fill="#ffffff" ${S}/>
     <path d="M40 22c4 3 4 17 0 20M46 16c8 6 8 26 0 32M52 11c11 9 11 33 0 42" fill="none" stroke="#6ff7ff" stroke-width="4" stroke-linecap="round"/>`,
  ),
  jaz_blunt: svg(
    `<path d="M8 44l34-14 6 4-34 14z" fill="#f3efe2" ${S}/>
     <path d="M42 30l6 4" stroke="#14183a" stroke-width="3.5"/>
     <circle cx="47" cy="32" r="3.2" fill="#ff7a2a" stroke="#14183a" stroke-width="2"/>
     <path d="M48 26c-4-4 4-7 0-11s4-7 1-10M55 28c-3-3 3-6 0-9" fill="none" stroke="#c9d8bf" stroke-width="3.5" stroke-linecap="round"/>`,
  ),
  jaz_spot: svg(
    `<path d="M26 6h12l12 46H14z" fill="#fff6c8" ${S}/>
     <ellipse cx="32" cy="52" rx="20" ry="6" fill="#ffe36b" ${S}/>
     <path d="M20 40l-10 4M44 40l10 4" stroke="#14183a" stroke-width="3" stroke-linecap="round"/>`,
  ),
  jaz_counter: svg(
    `<path d="M32 8l20 8v14c0 13-9 22-20 26C21 52 12 43 12 30V16z" fill="#c9a6ff" ${S}/>
     <path d="M36 18v18a6 5 0 1 1-4-4.6V22l10-2v4z" fill="#ffffff" ${S}/>`,
  ),
  jaz_mvp: svg(
    `<path d="M10 44l6-26 10 12 6-16 6 16 10-12 6 26z" fill="#ffd23a" ${S}/>
     <rect x="10" y="44" width="44" height="9" rx="3" fill="#ffb300" ${S}/>
     <circle cx="32" cy="34" r="3.5" fill="#ff4fa3"/>`,
  ),
  jaz_heart: svg(
    `<path d="M32 54C14 42 8 32 8 23c0-8 6-13 12-13 5 0 9 3 12 7 3-4 7-7 12-7 6 0 12 5 12 13 0 9-6 19-24 31z" fill="#ff3d7f" ${S}/>
     <path d="M32 17l-4 9 6 6-5 8 3 9" fill="none" stroke="#14183a" stroke-width="3" stroke-linejoin="round"/>
     <ellipse cx="20" cy="22" rx="4" ry="2.6" fill="#ffd6e6" transform="rotate(-30 20 22)"/>`,
  ),
  jaz_rain: svg(
    `<path d="M22 8l8 0 4 6-8 10-8-10z" fill="#9ff4ff" ${S}/><path d="M40 20l7 0 3 5-6.5 8-6.5-8z" fill="#c6f9ff" ${S}/>
     <path d="M16 34l7 0 3 5-6.5 8-6.5-8z" fill="#7fe8ff" ${S}/><path d="M34 40l8 0 4 6-8 10-8-10z" fill="#e8fdff" ${S}/>
     <path d="M52 8l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="#fff6b0"/><path d="M10 18l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#fff6b0"/>`,
  ),
  // Bonez
  bon_car: svg(
    `<path d="M6 40l4-10 10-2 8-8h16l8 8 6 2 0 10z" fill="#9a5cff" ${S}/>
     <path d="M30 22h12l6 6H24z" fill="#bff6ff" ${S}/>
     <circle cx="18" cy="42" r="6" fill="#2b2140" ${S}/><circle cx="46" cy="42" r="6" fill="#2b2140" ${S}/>
     <circle cx="18" cy="42" r="2" fill="#ffd23a"/><circle cx="46" cy="42" r="2" fill="#ffd23a"/>
     <path d="M6 50h52" stroke="#7cff5a" stroke-width="4" stroke-linecap="round" opacity="0.9"/>
     <path d="M2 26h8M0 32h6" stroke="#14183a" stroke-width="3" stroke-linecap="round"/>`,
  ),
  bon_croc: svg(
    `<path d="M6 30l30-14c8-3 16 0 20 6l-26 8z" fill="#5cbf4e" ${S}/>
     <path d="M6 34l24 0 26 6c-4 8-14 10-22 8z" fill="#47a64a" ${S}/>
     <path d="M16 30l3 5 3-5 3 5 3-5 3 5 3-5" fill="#fff" stroke="#14183a" stroke-width="2"/>
     <circle cx="44" cy="20" r="4" fill="#ffe14a" ${S}/>`,
  ),
  bon_smoke: svg(
    `<path d="M14 46c-6 0-9-5-7-10 1-4 5-6 9-5 0-7 6-12 13-11 3-6 13-7 17 0 7-1 12 5 10 11 5 1 7 7 3 11-2 3-5 4-8 4z" fill="#e4e0ee" ${S}/>
     <circle cx="38" cy="34" r="3" fill="#ffd65a"/><path d="M38 27v14M31 34h14" stroke="#ffd65a" stroke-width="2" stroke-linecap="round"/>`,
  ),
  bon_lean: svg(
    `<path d="M20 16h24l-3 38H23z" fill="#f4f3ef" ${S}/>
     <path d="M22 26h20l-1 10H23z" fill="#9b3dff" stroke="#14183a" stroke-width="2.5"/>
     <path d="M19 22h26" stroke="#14183a" stroke-width="3" stroke-linecap="round"/>
     <path d="M46 14c4-2 8 0 8 4M50 26c3-1 6 1 6 4" fill="none" stroke="#c58cff" stroke-width="3" stroke-linecap="round"/>`,
  ),
  bon_grin: svg(
    `<path d="M10 26c6 16 38 16 44 0z" fill="#3a1d24" ${S}/>
     <path d="M16 28h32l-3 6H19z" fill="#ffd23a" stroke="#14183a" stroke-width="2.5" stroke-linejoin="round"/>
     <path d="M24 28v6M32 28v6M40 28v6" stroke="#b98400" stroke-width="2"/>
     <path d="M48 12l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff6b0"/>`,
  ),
  bon_palm: svg(
    `<circle cx="38" cy="30" r="16" fill="#ffa23a" ${S}/>
     <path d="M24 56c2-12 4-22 2-32" fill="none" stroke="#14183a" stroke-width="5" stroke-linecap="round"/>
     <path d="M26 24c-6-6-14-6-18-2 6 0 11 2 14 6M26 24c2-8 8-12 14-12-4 3-8 7-9 12M26 24c-8 0-14 6-14 12 4-5 9-7 14-8M26 24c8-2 14 2 16 8-5-3-10-4-15-3" fill="#2a1540" stroke="#14183a" stroke-width="2"/>
     <path d="M6 56h52" stroke="#14183a" stroke-width="3.5" stroke-linecap="round"/>`,
  ),
  // Manuellsen / Lacazette (S12)
  manu_schatten: svg(
    `<path d="M14 54c0-14 6-26 18-26s18 12 18 26z" fill="#1a1028" ${S}/>
     <circle cx="32" cy="22" r="10" fill="#1a1028" ${S}/>
     <circle cx="28" cy="22" r="2.2" fill="#ffd23c"/><circle cx="36" cy="22" r="2.2" fill="#ffd23c"/>
     <path d="M22 10l3-7 4 5 3-6 3 6 4-5 3 7z" fill="#ffd23c" ${S}/>`,
  ),
  laca_abc: svg(
    `<text x="32" y="44" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="26" fill="#e8edf6" stroke="#14183a" stroke-width="2.5" paint-order="stroke">FTW</text>
     <path d="M6 50h14M8 56h10" stroke="#cfe0ff" stroke-width="3" stroke-linecap="round"/>`,
  ),
  laca_chart: svg(
    `<path d="M8 54l10-14 6 5 9-16 6 6 12-23" fill="none" stroke="#14183a" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>
     <path d="M8 54l10-14 6 5 9-16 6 6 12-23" fill="none" stroke="#3cff78" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>
     <path d="M44 8l11 2-4 10z" fill="#3cff78" ${S}/>`,
  ),
};

const CAT_FALLBACK: Record<CardCategory, string> = {
  offense: svg(`<path d="M12 40l20-24 6 6-12 18 22-14 4 6-26 16z" fill="#ff8a5c" ${S}/>`),
  zoning: svg(`<circle cx="32" cy="32" r="12" fill="#6fdcff" ${S}/><path d="M48 18c6 8 6 20 0 28M54 12c9 11 9 29 0 40" fill="none" stroke="#14183a" stroke-width="3.5" stroke-linecap="round"/>`),
  mobility: svg(`<path d="M10 34h28l-8-10 6-4 18 14-18 14-6-4 8-10H10z" fill="#7cf08f" ${S}/>`),
  counter: svg(`<path d="M32 8l20 8v14c0 13-9 22-20 26C21 52 12 43 12 30V16z" fill="#c9a6ff" ${S}/>`),
  utility: svg(`<path d="M32 10l6 14 15 2-11 10 3 15-13-8-13 8 3-15-11-10 15-2z" fill="#ffd96b" ${S}/>`),
  grapple: svg(`<rect x="14" y="22" width="36" height="22" rx="10" fill="#ff8fb4" ${S}/>`),
  signature: svg(`<path d="M32 6l8 17 18 2-13 12 4 19-17-10-17 10 4-19L6 25l18-2z" fill="#ffd23a" ${S}/>`),
};

export function cardIcon(id: string, cat: CardCategory): string {
  return CARD_ICONS[id] ?? CAT_FALLBACK[cat];
}

const U = 'stroke="#14183a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
export const UI_ICONS = {
  swords: svg(
    `<path d="M10 10l26 26-4 4L6 14zM54 10L28 36l4 4 26-26z" fill="#e8eefc" ${U}/>
     <path d="M18 40l6 6-8 8-6-6zM46 40l-6 6 8 8 6-6z" fill="#ffc93d" ${U}/>`,
  ),
  fighter: svg(
    `<circle cx="32" cy="20" r="11" fill="#ffd2a8" ${U}/>
     <path d="M12 56c0-13 9-21 20-21s20 8 20 21z" fill="#5aa8ff" ${U}/>`,
  ),
  cards: svg(
    `<rect x="8" y="14" width="26" height="36" rx="5" fill="#8fb8ff" transform="rotate(-12 21 32)" ${U}/>
     <rect x="28" y="12" width="26" height="36" rx="5" fill="#ffd23a" transform="rotate(10 41 30)" ${U}/>
     <path d="M41 22l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z" fill="#fff" transform="rotate(10 41 30)"/>`,
  ),
  online: svg(
    `<circle cx="32" cy="32" r="22" fill="#5ce07a" ${U}/>
     <path d="M10 32h44M32 10c-8 8-8 36 0 44M32 10c8 8 8 36 0 44" fill="none" ${U}/>`,
  ),
  pad: svg(
    `<path d="M14 22h36c6 0 10 6 10 16s-4 14-9 14c-4 0-6-4-10-8H23c-4 4-6 8-10 8-5 0-9-4-9-14s4-16 10-16z" fill="#b8c4e8" ${U}/>
     <path d="M18 32h10M23 27v10" ${U}/><circle cx="42" cy="30" r="3" fill="#ff6a3d"/><circle cx="48" cy="36" r="3" fill="#3dc8ff"/>`,
  ),
  sound: svg(`<path d="M10 24h10l12-10v36L20 40H10z" fill="#e8eefc" ${U}/><path d="M40 24c4 4 4 12 0 16M46 18c8 8 8 20 0 28" fill="none" ${U}/>`),
  mute: svg(`<path d="M10 24h10l12-10v36L20 40H10z" fill="#e8eefc" ${U}/><path d="M42 24l14 16M56 24L42 40" ${U}/>`),
  help: svg(`<circle cx="32" cy="32" r="24" fill="#5aa8ff" ${U}/><path d="M24 25c0-5 4-8 8-8s8 3 8 8c0 6-8 6-8 12" fill="none" ${U}/><circle cx="32" cy="46" r="2.5" fill="#14183a"/>`),
  back: svg(`<path d="M38 12L18 32l20 20" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`),
  star: svg(`<path d="M32 6l8 17 18 2-13 12 4 19-17-10-17 10 4-19L6 25l18-2z" fill="#ffd23a" ${U}/>`),
  crown: svg(`<path d="M8 46l4-28 12 12 8-16 8 16 12-12 4 28z" fill="currentColor" ${U}/>`),
  pause: svg(`<rect x="16" y="12" width="11" height="40" rx="3" fill="#fff"/><rect x="37" y="12" width="11" height="40" rx="3" fill="#fff"/>`),
  bolt: svg(`<path d="M36 4L14 36h14l-4 24 26-36H34z" fill="#ffd23a" ${U}/>`),
};

/** Hype "drop" cost badge content. */
export function costBadge(cost: number): string {
  return `<span class="cost"><b>${cost / 100}</b></span>`;
}
