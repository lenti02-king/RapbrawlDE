// Chunky, colourful menu icons for the cartoon main menu (thick dark outline, flat fills, a highlight).
// Original artwork drawn for RAPBRAWL; no third-party icon sets.
const OUT = '#16213f';
const svg = (body: string) =>
  `<svg viewBox="0 0 48 48" aria-hidden="true" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;

export const TOON = {
  // crossed swords: the fight tab / battle button
  swords: svg(
    `<path d="M9 7l4 0 19 19-4 4L9 11z" fill="#e8f1ff"/><path d="M39 7l-4 0-19 19 4 4 19-19z" fill="#e8f1ff"/>
     <path d="M11 9l17 17" stroke="#ffffff" stroke-width="1.6" fill="none" opacity="0.9"/>
     <path d="M25 31l-7 7-4-4 7-7M23 31l-8-8" fill="#ffc531"/><path d="M23 31l7 7 4-4-7-7M25 31l8-8" fill="#ffc531"/>
     <circle cx="13" cy="39" r="3.2" fill="#e8483f"/><circle cx="35" cy="39" r="3.2" fill="#e8483f"/>`,
  ),
  // stacked cards with a star
  cards: svg(
    `<rect x="17" y="5" width="22" height="30" rx="4" fill="#8f5cff" transform="rotate(12 28 20)"/>
     <rect x="9" y="11" width="22" height="30" rx="4" fill="#3db3ff"/>
     <path d="M20 18l2.4 5 5.4.6-4 3.6 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.6 5.4-.6z" fill="#ffd43b" stroke-width="2"/>`,
  ),
  // boxing glove: fighters
  glove: svg(
    `<path d="M14 21c0-9 6-14 14-14s11 6 11 12c0 4-1 7-4 9l-1 6H17l-2-5c-1-2-1-5-1-8z" fill="#ff4b55"/>
     <path d="M14 22c-4 0-6 3-5 6s4 4 7 3" fill="#ff4b55"/>
     <rect x="16" y="34" width="19" height="8" rx="2.5" fill="#ffffff"/>
     <path d="M21 13c3-3 9-3 12 1" stroke="#ffffff" stroke-width="2.4" fill="none" opacity="0.75"/>`,
  ),
  // dumbbell: training
  dumbbell: svg(
    `<rect x="17" y="21" width="14" height="6" rx="2" fill="#c9d3e6"/>
     <rect x="8" y="13" width="9" height="22" rx="3" fill="#4b5675"/><rect x="31" y="13" width="9" height="22" rx="3" fill="#4b5675"/>
     <rect x="3" y="18" width="6" height="12" rx="2" fill="#7c88a8"/><rect x="39" y="18" width="6" height="12" rx="2" fill="#7c88a8"/>
     <path d="M11 16v7" stroke="#ffffff" stroke-width="2" opacity="0.6"/>`,
  ),
  // gold trophy
  trophy: svg(
    `<path d="M14 6h20v11c0 7-4 12-10 12s-10-5-10-12z" fill="#ffc531"/>
     <path d="M14 10H7v3c0 5 3 8 8 8M34 10h7v3c0 5-3 8-8 8" fill="none"/>
     <path d="M20 29h8l1 6h-10z" fill="#e59a12"/><rect x="13" y="35" width="22" height="7" rx="2" fill="#8a5a2b"/>
     <path d="M19 10v9" stroke="#fff6c2" stroke-width="2.6" opacity="0.9"/>`,
  ),
  // cog: settings
  gear: svg(
    `<path d="M21 4h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z" fill="#b6c2dc"/>
     <circle cx="24" cy="24" r="6.5" fill="#4b5675"/>`,
  ),
  // two players / online
  online: svg(
    `<circle cx="17" cy="16" r="7" fill="#57d36b"/><circle cx="32" cy="17" r="6" fill="#3db3ff"/>
     <path d="M5 40c0-8 5-13 12-13s12 5 12 13z" fill="#57d36b"/><path d="M24 40c1-7 4-11 9-11s9 4 10 11z" fill="#3db3ff"/>`,
  ),
  // level star badge
  star: svg(`<path d="M24 4l6 12 13 2-9.5 9 2.3 13L24 34l-11.8 6 2.3-13L5 18l13-2z" fill="#3db3ff"/>`),
  // crown (trophy road / rank)
  crown: svg(`<path d="M6 16l9 8 9-14 9 14 9-8-3 22H9z" fill="#ffc531"/><rect x="9" y="36" width="30" height="6" rx="2" fill="#e59a12"/>`),
  // hype bolt (card cost)
  bolt: svg(`<path d="M27 3L10 27h11l-3 18 20-26H26z" fill="#c070ff"/>`),
  // speaker on / off
  sound: svg(`<path d="M7 18h8l10-8v28l-10-8H7z" fill="#ffffff"/><path d="M31 17c3 3 3 11 0 14M36 12c6 6 6 18 0 24" fill="none" stroke-width="3"/>`),
  mute: svg(`<path d="M7 18h8l10-8v28l-10-8H7z" fill="#ffffff"/><path d="M31 18l11 12M42 18L31 30" fill="none" stroke-width="3.4" stroke="#e8483f"/>`),
  // question mark bubble: help / controls
  help: svg(
    `<circle cx="24" cy="24" r="19" fill="#ffd43b"/><path d="M18 19c0-4 3-6 6-6s6 2 6 5.5c0 4-6 4.5-6 9" fill="none" stroke-width="3.6"/>
     <circle cx="24" cy="34" r="2.4" fill="${OUT}" stroke="none"/>`,
  ),
  // back arrow
  back: svg(`<path d="M28 8L12 24l16 16" fill="none" stroke-width="7" stroke="${OUT}"/><path d="M28 8L12 24l16 16" fill="none" stroke-width="3.2" stroke="#ffffff"/>`),
};
