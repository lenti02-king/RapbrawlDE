// Design v3 icons and tile illustrations (S13): chunky cartoon vector art in the fighters' toon language - flat cel
// bands (a light and a shade tone per surface), a thick dark ink outline, a hard white highlight. Vector so they stay
// sharp on every phone and cost no texture memory.
const INK = '#120b18';
const S = 4.2; // outline width in the 100-unit viewBox

let uid = 0;
const svg = (body: string, vb = '0 0 100 100') => `<svg class="i3" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
/** Two-tone vertical cel gradient (hard band, like the toon ramp). */
function cel(a: string, b: string, at = 0.55): [string, string] {
  const id = `c3_${uid++}`;
  return [`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="${at}" stop-color="${a}"/><stop offset="${at}" stop-color="${b}"/></linearGradient>`, `url(#${id})`];
}
const ink = (d: string, fill: string, w = S) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const shine = (d: string, o = 0.55) => `<path d="${d}" fill="#fff" opacity="${o}"/>`;

export const ICON3 = {
  home: () => {
    const [g, f] = cel('#7fd0ff', '#3b8fe0', 0.5);
    return svg(`<defs>${g}</defs>${ink('M14 50 L50 18 L86 50 L78 50 L78 84 L58 84 L58 62 L42 62 L42 84 L22 84 L22 50 Z', f)}${shine('M24 48 L50 25 L60 34 L36 52 Z', 0.4)}`);
  },
  fighter: () => {
    const [g, f] = cel('#ffd27a', '#e59a2a');
    return svg(
      `<defs>${g}</defs>${ink('M50 14c15 0 25 11 25 26 0 10-4 17-9 21l12 6c5 3 8 8 8 14v6H14v-6c0-6 3-11 8-14l12-6c-5-4-9-11-9-21 0-15 10-26 25-26z', f)}${ink('M24 34c0-12 11-22 26-22s26 10 26 22l-8-4c-4-4-10-6-18-6s-14 2-18 6z', '#2b2338', 3.4)}${shine('M36 30c4-6 10-8 16-8l-2 6c-5 0-9 2-12 5z', 0.5)}`,
    );
  },
  cards: () => {
    const [g1, f1] = cel('#ff7fd6', '#c93a9e');
    const [g2, f2] = cel('#7fb6ff', '#3a6fd6');
    return svg(
      `<defs>${g1}${g2}</defs><g transform="rotate(-14 40 56)">${ink('M18 24h40v56H18z', f1)}</g><g transform="rotate(10 60 54)">${ink('M42 20h40v56H42z', f2)}${shine('M47 25h30v8H47z', 0.4)}</g>`,
    );
  },
  trophy: () => {
    const [g, f] = cel('#ffe066', '#e6a313');
    return svg(
      `<defs>${g}</defs>${ink('M28 14h44v18c0 15-10 26-22 26S28 47 28 32z', f)}${ink('M28 20H16c0 12 6 18 14 20M72 20h12c0 12-6 18-14 20', 'none', 4)}${ink('M44 58h12v12H44z', f)}${ink('M30 70h40l4 14H26z', '#8a5a1f')}${shine('M34 18h10v18c0 6-3 10-6 12-3-4-4-8-4-12z', 0.5)}`,
    );
  },
  shop: () => {
    const [g, f] = cel('#ffffff', '#cfc6e6', 0.6);
    return svg(
      `<defs>${g}</defs>${ink('M16 40h68v44H16z', f)}${ink('M12 22h76l-4 18H16z', '#ff5a6e')}<path d="M24 22l-2 18M40 22v18M60 22v18M76 22l2 18" stroke="${INK}" stroke-width="3"/>${ink('M42 58h16v26H42z', '#5aa0ff')}`,
    );
  },
  friends: () => {
    const [g, f] = cel('#9ae6b4', '#3fb37a');
    const [g2, f2] = cel('#ffd27a', '#e59a2a');
    return svg(
      `<defs>${g}${g2}</defs>${ink('M64 30a12 12 0 1 1 0.1 0zM44 84c0-16 9-26 20-26s20 10 20 26z', f)}${ink('M36 26a14 14 0 1 1 0.1 0zM12 84c0-18 10-30 24-30s24 12 24 30z', f2)}`,
    );
  },
  mail: () => {
    const [g, f] = cel('#ffffff', '#d6d0ee', 0.6);
    return svg(`<defs>${g}</defs>${ink('M12 26h76v52H12z', f)}${ink('M12 26l38 30 38-30', 'none', 4)}`);
  },
  gear: () => {
    const [g, f] = cel('#e6e1f5', '#9c93bd', 0.5);
    return svg(
      `<defs>${g}</defs>${ink('M44 8h12l3 12 9 4 11-6 8 8-6 11 4 9 12 3v12l-12 3-4 9 6 11-8 8-11-6-9 4-3 12H44l-3-12-9-4-11 6-8-8 6-11-4-9-12-3V44l12-3 4-9-6-11 8-8 11 6 9-4z', f, 3.8)}${ink('M50 36a14 14 0 1 1-0.1 0z', '#3a2f55', 3.8)}`,
    );
  },
  coin: () => {
    const [g, f] = cel('#ffe066', '#e6a313', 0.5);
    return svg(
      `<defs>${g}</defs>${ink('M50 8a42 42 0 1 1-0.1 0z', f)}${ink('M50 20a30 30 0 1 1-0.1 0z', 'none', 3)}${ink('M34 58l2-20 8 8 6-12 6 12 8-8 2 20z', '#fff3b0', 3)}${shine('M28 24c6-6 14-9 22-9l-2 6c-6 0-12 3-16 7z', 0.6)}`,
    );
  },
  gem: () =>
    svg(
      `${ink('M28 14h44l18 22-40 52L10 36z', '#3ec7ff')}<path d="M10 36h80M28 14l12 22 10 52 10-52 12-22M40 36l10-22 10 22" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>${shine('M30 18h14l-6 16H16z', 0.55)}<path d="M50 36l-10 0 10 50z" fill="#1d8fd6" opacity="0.7"/>`,
    ),
  bolt: () => {
    const [g, f] = cel('#d79bff', '#9a3ef2', 0.5);
    return svg(`<defs>${g}</defs>${ink('M58 6L20 54h22l-8 40 46-56H56z', f)}${shine('M54 14L32 46h10z', 0.5)}`);
  },
  plus: () => svg(`${ink('M40 12h20v28h28v20H60v28H40V60H12V40h28z', '#ffffff')}`),
  fist: () => {
    const [g, f] = cel('#ffd9b0', '#e2a77a', 0.5);
    return svg(
      `<defs>${g}</defs>${ink('M22 40c0-8 6-12 12-12h34c8 0 12 6 12 12v18c0 14-10 24-24 24H40c-10 0-18-8-18-18z', f)}<path d="M38 28v18M52 28v18M66 30v16" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>${ink('M22 46c-6 0-10 4-10 10s4 10 10 10h12', f, 3.6)}${shine('M30 34h40v4H30z', 0.5)}`,
    );
  },
  crown: () => {
    const [g, f] = cel('#ffe066', '#e6a313', 0.55);
    return svg(`<defs>${g}</defs>${ink('M10 34l18 16 22-30 22 30 18-16-8 46H18z', f)}${ink('M18 80h64v10H18z', '#c97f10')}<circle cx="50" cy="20" r="6" fill="#ff4f8b" stroke="${INK}" stroke-width="3"/>`);
  },
  calendar: () => {
    const [g, f] = cel('#ffffff', '#d6d0ee', 0.6);
    return svg(`<defs>${g}</defs>${ink('M12 20h76v66H12z', f)}${ink('M12 20h76v18H12z', '#ff5a6e')}<path d="M30 12v16M70 12v16" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M26 52h12M44 52h12M62 52h12M26 68h12M44 68h12" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`);
  },
  ticket: () => {
    const [g, f] = cel('#ffe066', '#e6a313', 0.55);
    return svg(`<defs>${g}</defs>${ink('M10 28h80v14a8 8 0 0 0 0 16v14H10V58a8 8 0 0 0 0-16z', f)}<path d="M66 30v40" stroke="${INK}" stroke-width="3" stroke-dasharray="5 5"/>`);
  },
  clipboard: () => {
    const [g, f] = cel('#ffffff', '#d6d0ee', 0.6);
    return svg(`<defs>${g}</defs>${ink('M18 16h64v74H18z', '#8a5a1f')}${ink('M26 24h48v58H26z', f)}${ink('M36 10h28v14H36z', '#c0c0d0')}<path d="M32 42l6 6 10-12M32 62l6 6 10-12" fill="none" stroke="#2fbf6e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M54 44h14M54 64h14" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`);
  },
};

/** Big tile illustrations (viewBox 0 0 200 120). */
export const ART3 = {
  shop: () => {
    const [g, f] = cel('#ffcf4a', '#d98b14', 0.5);
    const [gw, fw] = cel('#b9773a', '#7d4a1f', 0.5);
    const [gc, fc] = cel('#ffe680', '#e6a313', 0.5);
    return svg(
      `<defs>${g}${gw}${gc}</defs>
      ${ink('M40 58h120v52H40z', fw)}
      ${ink('M36 40c0-14 12-24 30-24h68c18 0 30 10 30 24v20H36z', fw)}
      ${ink('M36 54h128v10H36z', f)}${ink('M90 50h20v26H90z', f)}<circle cx="100" cy="64" r="4" fill="${INK}"/>
      ${ink('M40 70h120v8H40z', f)}
      ${shine('M48 26c6-4 12-6 20-6h30v6H66c-8 0-12 2-16 6z', 0.45)}
      ${ink('M150 92a14 14 0 1 1-0.1 0z', fc, 3.4)}${ink('M172 100a12 12 0 1 1-0.1 0z', fc, 3.4)}${ink('M30 98a12 12 0 1 1-0.1 0z', fc, 3.4)}
      <path d="M92 10l4 10 10 2-8 6 2 10-8-6-8 6 2-10-8-6 10-2z" fill="#fff" stroke="${INK}" stroke-width="2.4"/>`,
      '0 0 200 120',
    );
  },
  events: () => {
    const [g, f] = cel('#ffe066', '#e6a313', 0.55);
    const [gm, fm] = cel('#4a4458', '#24202e', 0.5);
    const [gh, fh] = cel('#e6e1f5', '#9c93bd', 0.5);
    return svg(
      `<defs>${g}${gm}${gh}</defs>
      <g transform="rotate(-10 70 64)">${ink('M22 50l20 18 26-34 26 34 20-18-10 52H32z', f)}${ink('M32 102h72v10H32z', '#c97f10')}<circle cx="68" cy="30" r="7" fill="#ff4f8b" stroke="${INK}" stroke-width="3"/><circle cx="22" cy="48" r="5" fill="#3ec7ff" stroke="${INK}" stroke-width="3"/><circle cx="114" cy="48" r="5" fill="#3ec7ff" stroke="${INK}" stroke-width="3"/></g>
      <g transform="rotate(24 150 60)">${ink('M142 54h18v58h-18z', fm)}${ink('M151 14a20 20 0 1 1-0.1 0z', fh)}<path d="M138 30h26M136 38h30M140 22h22" stroke="${INK}" stroke-width="2.4" opacity="0.6"/>${ink('M140 54h22v6h-22z', '#ffd25e', 3)}</g>
      <path d="M100 8l3 8 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z" fill="#fff" stroke="${INK}" stroke-width="2"/>`,
      '0 0 200 120',
    );
  },
  pass: () => {
    const [g, f] = cel('#ffe066', '#e6a313', 0.55);
    return svg(
      `<defs>${g}</defs>
      <g transform="rotate(-8 100 60)">${ink('M22 30h156v18a12 12 0 0 0 0 24v18H22V72a12 12 0 0 0 0-24z', f)}
      <path d="M140 34v52" stroke="${INK}" stroke-width="3" stroke-dasharray="6 6"/>
      ${ink('M52 66l8-24 12 12 10-18 10 18 12-12 8 24z', '#fff3b0', 3.4)}${ink('M54 66h60v8H54z', '#c97f10', 3)}
      ${shine('M30 36h100v6H30z', 0.5)}</g>`,
      '0 0 200 120',
    );
  },
  missions: () => {
    const [g, f] = cel('#ffffff', '#d6d0ee', 0.6);
    return svg(
      `<defs>${g}</defs>
      <g transform="rotate(-6 90 64)">${ink('M44 14h96v100H44z', '#8a5a1f')}${ink('M54 24h76v82H54z', f)}${ink('M76 8h32v16H76z', '#c0c0d0')}
      <path d="M62 46l7 7 12-14M62 72l7 7 12-14" fill="none" stroke="#2fbf6e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M90 48h30M90 74h30M62 96h56" stroke="${INK}" stroke-width="6" stroke-linecap="round"/></g>
      <path d="M160 28l4 10 10 2-8 6 2 10-8-6-8 6 2-10-8-6 10-2z" fill="#ffd25e" stroke="${INK}" stroke-width="2.4"/>`,
      '0 0 200 120',
    );
  },
};
