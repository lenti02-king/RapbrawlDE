// Night-street / concert-stage menu art (original, procedural SVG): graffiti logo with crown + mic, brush banners,
// the city backdrop for menus and the concert stage for the start/loading screen. No third-party artwork.

/** Small deterministic PRNG so the art is identical on every load (no Math.random flicker between screens). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const CROWN = `<path d="M10 62 L4 14 L30 38 L50 4 L70 38 L96 14 L90 62 Z" fill="url(#lg-gold)" stroke="#1a0f2e" stroke-width="6" stroke-linejoin="round"/>
  <rect x="8" y="58" width="84" height="16" rx="5" fill="#e59a12" stroke="#1a0f2e" stroke-width="6"/>
  <circle cx="50" cy="40" r="7" fill="#ff3d7f" stroke="#1a0f2e" stroke-width="4"/><circle cx="25" cy="50" r="5" fill="#3de2ff" stroke="#1a0f2e" stroke-width="3.5"/>
  <circle cx="75" cy="50" r="5" fill="#3de2ff" stroke="#1a0f2e" stroke-width="3.5"/><path d="M22 22 L30 38" stroke="#fff6c2" stroke-width="4" stroke-linecap="round" opacity="0.8"/>`;

const MIC = `<g transform="rotate(28 40 60)">
  <rect x="31" y="58" width="18" height="62" rx="7" fill="#2b2140" stroke="#1a0f2e" stroke-width="6"/>
  <rect x="34" y="66" width="5" height="44" rx="2.5" fill="#6c5a92"/>
  <circle cx="40" cy="36" r="27" fill="url(#lg-mic)" stroke="#1a0f2e" stroke-width="6"/>
  <path d="M18 30 Q40 20 62 30 M16 40 Q40 30 64 40 M20 50 Q40 42 60 50" stroke="#1a0f2e" stroke-width="3" fill="none" opacity="0.55"/>
  <path d="M27 21 Q35 14 46 15" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.85"/>
  <rect x="26" y="56" width="28" height="9" rx="3" fill="#ffc531" stroke="#1a0f2e" stroke-width="5"/></g>`;

/** RAPBRAWL graffiti logo (crown over the A, mic on the right). `cls` adds size variants (st-logo-sm). */
export function logoHtml(cls = ''): string {
  const drips = [
    [118, 205, 26],
    [262, 210, 40],
    [432, 206, 18],
    [598, 210, 34],
    [760, 206, 22],
    [880, 204, 30],
  ]
    .map(([x, y, h]) => `<path d="M${x - 7} ${y} Q${x} ${y + 4} ${x + 7} ${y} L${x + 5} ${y + h} Q${x} ${y + h + 9} ${x - 5} ${y + h} Z" fill="#ff3d7f" stroke="#1a0f2e" stroke-width="5"/>`)
    .join('');
  return `<div class="st-logo ${cls}" role="img" aria-label="RAPBRAWL">
  <svg viewBox="0 0 1000 300" aria-hidden="true">
    <defs>
      <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6a8"/><stop offset="0.5" stop-color="#ffd23a"/><stop offset="1" stop-color="#ff9a1f"/></linearGradient>
      <linearGradient id="lg-rap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#fff3a0"/><stop offset="1" stop-color="#ffc021"/></linearGradient>
      <linearGradient id="lg-brawl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ff4ff"/><stop offset="0.5" stop-color="#3dc8ff"/><stop offset="1" stop-color="#7a4dff"/></linearGradient>
      <radialGradient id="lg-mic" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#c9c4dc"/><stop offset="1" stop-color="#6b6487"/></radialGradient>
    </defs>
    <g transform="translate(500 175) skewX(-8) translate(-500 -175)">
      ${drips}
      <text x="500" y="205" text-anchor="middle" textLength="820" lengthAdjust="spacingAndGlyphs" class="lg-shadow">RAPBRAWL</text>
      <text x="500" y="196" text-anchor="middle" textLength="820" lengthAdjust="spacingAndGlyphs" class="lg-out">RAPBRAWL</text>
      <text x="500" y="196" text-anchor="middle" textLength="820" lengthAdjust="spacingAndGlyphs" class="lg-fill"><tspan fill="url(#lg-rap)">RAP</tspan><tspan fill="url(#lg-brawl)">BRAWL</tspan></text>
      <text x="500" y="196" text-anchor="middle" textLength="820" lengthAdjust="spacingAndGlyphs" class="lg-shine">RAPBRAWL</text>
    </g>
    <g transform="translate(232 4) scale(0.85)">${CROWN}</g>
    <g transform="translate(895 92) scale(1.0)">${MIC}</g>
  </svg></div>`;
}

/** Yellow brush-stroke banner with a marker-font label (ARENA WÄHLEN, KÄMPFERWAHL, ...). */
export function brushBanner(text: string, color = 'yellow'): string {
  return `<div class="st-brush ${color}"><svg viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true">
    <path d="M14 34 Q40 12 120 18 L300 10 Q470 4 560 16 Q596 22 588 48 Q600 70 582 92 Q560 112 420 106 L250 112 Q110 118 40 104 Q6 96 12 70 Q2 52 14 34 Z"/>
    <path class="hl" d="M40 30 Q200 18 420 22" /><path class="hl" d="M60 96 Q240 104 480 94" /></svg><span>${text}</span></div>`;
}

/** Night street backdrop: skyline with lit windows, neon shop signs, graffiti wall, wet street with reflections. */
export function streetBg(): string {
  const r = rng(7);
  const far: string[] = [];
  const win: string[] = [];
  let x = -20;
  while (x < 1640) {
    const w = 60 + r() * 110;
    const h = 220 + r() * 300;
    far.push(`<rect x="${x.toFixed(0)}" y="${(640 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}"/>`);
    for (let wy = 640 - h + 18; wy < 600; wy += 26)
      for (let wx = x + 10; wx < x + w - 14; wx += 20)
        if (r() < 0.32) win.push(`<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="9" height="13" fill="${r() < 0.75 ? '#ffcf6a' : '#7fe8ff'}" opacity="${(0.35 + r() * 0.55).toFixed(2)}"/>`);
    x += w + 4 + r() * 10;
  }
  const tags = [
    [190, 760, -8, 'BLOCK', '#ff3d7f', '#2de1ff'],
    [560, 790, 4, 'KIEZ', '#ffd23a', '#9a5cff'],
    [1060, 770, -5, 'RB', '#2de1ff', '#ff3d7f'],
    [1390, 790, 6, 'BEEF', '#9aff5a', '#ff3d7f'],
  ]
    .map(
      ([tx, ty, rot, t, a, b]) =>
        `<text x="${tx}" y="${ty}" transform="rotate(${rot} ${tx} ${ty})" class="st-tag" fill="${a}" stroke="${b}">${t}</text>`,
    )
    .join('');
  return `<div class="st-bg" aria-hidden="true"><svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
    <defs>
      <linearGradient id="sb-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#090a24"/><stop offset="0.55" stop-color="#2a1050"/><stop offset="1" stop-color="#5a1a6e"/></linearGradient>
      <linearGradient id="sb-street" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1236"/><stop offset="1" stop-color="#07060f"/></linearGradient>
      <linearGradient id="sb-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1838"/><stop offset="1" stop-color="#150c22"/></linearGradient>
      <pattern id="sb-brick" width="64" height="28" patternUnits="userSpaceOnUse"><rect width="64" height="28" fill="none"/>
        <path d="M0 0H64M0 14H64M0 28H64M16 0V14M48 0V14M0 14V28M32 14V28" stroke="#0b0614" stroke-width="2.4" opacity="0.65"/></pattern>
      <filter id="sb-glow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <rect width="1600" height="900" fill="url(#sb-sky)"/>
    <circle cx="1250" cy="150" r="70" fill="#ffe9c2" opacity="0.9"/><circle cx="1250" cy="150" r="150" fill="#ff7ad9" opacity="0.12"/>
    <g fill="#160b2c">${far.join('')}</g><g>${win.join('')}</g>
    <rect x="0" y="600" width="1600" height="230" fill="url(#sb-wall)"/><rect x="0" y="600" width="1600" height="230" fill="url(#sb-brick)"/>
    <g class="st-neon">
      <rect x="120" y="630" width="250" height="70" rx="16" fill="none" stroke="#ff3d7f" stroke-width="16" filter="url(#sb-glow)" opacity="0.9"/>
      <rect x="120" y="630" width="250" height="70" rx="16" fill="none" stroke="#ffd0e4" stroke-width="5"/>
      <text x="245" y="680" text-anchor="middle" class="st-sign" fill="#ffe4f0">SPÄTI 24/7</text>
      <rect x="1180" y="626" width="290" height="74" rx="37" fill="none" stroke="#2de1ff" stroke-width="16" filter="url(#sb-glow)" opacity="0.9"/>
      <rect x="1180" y="626" width="290" height="74" rx="37" fill="none" stroke="#d6fbff" stroke-width="5"/>
      <text x="1325" y="677" text-anchor="middle" class="st-sign" fill="#e8fdff">BEATS · BARS</text>
    </g>
    ${tags}
    <rect x="0" y="826" width="1600" height="74" fill="url(#sb-street)"/>
    <rect x="160" y="836" width="200" height="10" rx="5" fill="#ff3d7f" opacity="0.35" filter="url(#sb-glow)"/>
    <rect x="1220" y="836" width="230" height="10" rx="5" fill="#2de1ff" opacity="0.35" filter="url(#sb-glow)"/>
  </svg><div class="st-haze"></div></div>`;
}

/** Concert stage (start + loading screen): truss with moving heads, LED wall, haze, crowd silhouettes. */
export function stageBg(): string {
  const r = rng(11);
  const crowd = (y0: number, n: number, scale: number, fill: string) => {
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const cx = (i / (n - 1)) * 1700 - 50 + (r() - 0.5) * 30;
      const s = scale * (0.85 + r() * 0.3);
      const hy = y0 - 64 * s - r() * 14;
      parts.push(`<circle cx="${cx.toFixed(0)}" cy="${hy.toFixed(0)}" r="${(26 * s).toFixed(1)}"/>`);
      parts.push(`<rect x="${(cx - 48 * s).toFixed(0)}" y="${(hy + 22 * s).toFixed(0)}" width="${(96 * s).toFixed(0)}" height="200" rx="${(34 * s).toFixed(0)}"/>`);
      if (r() < 0.42) {
        // a raised arm (some with a phone light)
        const side = r() < 0.5 ? -1 : 1;
        const ax = cx + side * 40 * s;
        const tx = ax + side * (10 + r() * 30) * s;
        const ty = hy - (70 + r() * 50) * s;
        parts.push(`<path d="M${ax.toFixed(0)} ${(hy + 40 * s).toFixed(0)} L${tx.toFixed(0)} ${ty.toFixed(0)}" stroke="${fill}" stroke-width="${(20 * s).toFixed(0)}" stroke-linecap="round"/>`);
        if (r() < 0.35) parts.push(`<rect x="${(tx - 7 * s).toFixed(0)}" y="${(ty - 16 * s).toFixed(0)}" width="${(14 * s).toFixed(0)}" height="${(22 * s).toFixed(0)}" rx="3" fill="#e9f6ff" class="st-phone"/>`);
      }
    }
    return `<g fill="${fill}">${parts.join('')}</g>`;
  };
  const truss = (x: number, y: number, w: number, h: number) => {
    const n = Math.round(w / h);
    let d = `M${x} ${y}H${x + w}M${x} ${y + h}H${x + w}`;
    for (let i = 0; i <= n; i++) d += `M${x + (i * w) / n} ${y}V${y + h}`;
    for (let i = 0; i < n; i++) d += `M${x + (i * w) / n} ${y}L${x + ((i + 1) * w) / n} ${y + h}`;
    return `<path d="${d}" stroke="#4a4560" stroke-width="5" fill="none"/>`;
  };
  const vtruss = (x: number, y: number, w: number, h: number) => {
    const n = Math.round(h / w);
    let d = `M${x} ${y}V${y + h}M${x + w} ${y}V${y + h}`;
    for (let i = 0; i <= n; i++) d += `M${x} ${y + (i * h) / n}H${x + w}`;
    for (let i = 0; i < n; i++) d += `M${x} ${y + (i * h) / n}L${x + w} ${y + ((i + 1) * h) / n}`;
    return `<path d="${d}" stroke="#3a3550" stroke-width="5" fill="none"/>`;
  };
  const heads = [180, 420, 660, 940, 1180, 1420]
    .map((hx, i) => `<g class="st-head"><rect x="${hx - 22}" y="96" width="44" height="34" rx="8" fill="#1d1a2c"/><circle cx="${hx}" cy="136" r="15" fill="${i % 2 ? '#bff6ff' : '#ffe7a8'}"/></g>`)
    .join('');
  const led: string[] = [];
  for (let gy = 190; gy < 560; gy += 22) for (let gx = 300; gx < 1300; gx += 22) led.push(`M${gx} ${gy}h0.1`);
  const beams = [
    ['8%', '#ff3dc8', -24, 0],
    ['22%', '#3de2ff', 16, 1.4],
    ['38%', '#ffd23a', -10, 0.7],
    ['62%', '#ffd23a', 10, 2.1],
    ['78%', '#3de2ff', -16, 0.3],
    ['92%', '#ff3dc8', 24, 1.1],
  ]
    .map(([l, c, a, d]) => `<i class="st-beam" style="left:${l};--c:${c};--a:${a}deg;animation-delay:-${d}s"></i>`)
    .join('');
  return `<div class="st-stage" aria-hidden="true"><svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
    <defs>
      <radialGradient id="ss-back" cx="0.5" cy="0.42" r="0.75"><stop offset="0" stop-color="#4b1d7a"/><stop offset="0.55" stop-color="#1a0b36"/><stop offset="1" stop-color="#05040c"/></radialGradient>
      <linearGradient id="ss-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a48"/><stop offset="1" stop-color="#0a0714"/></linearGradient>
      <radialGradient id="ss-led" cx="0.5" cy="0.5" r="0.6"><stop offset="0" stop-color="#ff7ad9"/><stop offset="0.6" stop-color="#6b3dff"/><stop offset="1" stop-color="#1a0b36"/></radialGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#ss-back)"/>
    <rect x="290" y="180" width="1020" height="390" rx="10" fill="#0d0a1c"/>
    <path d="${led.join('')}" stroke="url(#ss-led)" stroke-width="9" stroke-linecap="round" opacity="0.55" class="st-led"/>
    ${truss(60, 60, 1480, 40)}${vtruss(60, 100, 40, 560)}${vtruss(1500, 100, 40, 560)}${heads}
    <rect x="200" y="600" width="1200" height="70" fill="#151024"/><rect x="200" y="600" width="1200" height="8" fill="#ffd23a" opacity="0.7"/>
    <rect x="0" y="668" width="1600" height="232" fill="url(#ss-floor)"/>
    <g class="st-speaker"><rect x="110" y="470" width="120" height="200" rx="10" fill="#120e1e" stroke="#2a2440" stroke-width="5"/><circle cx="170" cy="530" r="36" fill="#1d1830" stroke="#3a3356" stroke-width="6"/><circle cx="170" cy="618" r="22" fill="#1d1830" stroke="#3a3356" stroke-width="5"/></g>
    <g class="st-speaker"><rect x="1370" y="470" width="120" height="200" rx="10" fill="#120e1e" stroke="#2a2440" stroke-width="5"/><circle cx="1430" cy="530" r="36" fill="#1d1830" stroke="#3a3356" stroke-width="6"/><circle cx="1430" cy="618" r="22" fill="#1d1830" stroke="#3a3356" stroke-width="5"/></g>
    ${crowd(850, 24, 1.0, '#1a1030')}${crowd(930, 18, 1.35, '#07050d')}
  </svg>${beams}<div class="st-haze"></div></div>`;
}

/** Mode tile pictograms (thick outline, flat fills; original). */
export const MODE_ICON = {
  quick: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M36 4L12 36h16l-4 24 28-34H36z" fill="#ffd23a" stroke="#1a0f2e" stroke-width="4" stroke-linejoin="round"/><path d="M33 12L22 28" stroke="#fff6c2" stroke-width="3" stroke-linecap="round"/></svg>`,
  online: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="24" fill="#3dc8ff" stroke="#1a0f2e" stroke-width="4"/><path d="M8 32h48M32 8c-9 8-9 40 0 48M32 8c9 8 9 40 0 48M13 19h38M13 45h38" fill="none" stroke="#1a0f2e" stroke-width="3"/><path d="M18 16q6-5 12-6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  versus: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="21" cy="20" r="10" fill="#ffd23a" stroke="#1a0f2e" stroke-width="4"/><circle cx="43" cy="20" r="10" fill="#9aff5a" stroke="#1a0f2e" stroke-width="4"/><path d="M5 56c0-12 7-20 16-20s16 8 16 20z" fill="#ffd23a" stroke="#1a0f2e" stroke-width="4"/><path d="M27 56c0-12 7-20 16-20s16 8 16 20z" fill="#9aff5a" stroke="#1a0f2e" stroke-width="4"/></svg>`,
  ranked: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4l22 8v18c0 14-10 24-22 30C20 54 10 44 10 30V12z" fill="#9a5cff" stroke="#1a0f2e" stroke-width="4" stroke-linejoin="round"/><path d="M32 16l4.5 9 10 1.4-7.3 7 1.8 10-9-4.8-9 4.8 1.8-10-7.3-7 10-1.4z" fill="#ffd23a" stroke="#1a0f2e" stroke-width="3" stroke-linejoin="round"/></svg>`,
  training: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="28" width="20" height="8" rx="3" fill="#c9d3e6" stroke="#1a0f2e" stroke-width="3.5"/><rect x="10" y="16" width="12" height="32" rx="4" fill="#ff5a6e" stroke="#1a0f2e" stroke-width="4"/><rect x="42" y="16" width="12" height="32" rx="4" fill="#ff5a6e" stroke="#1a0f2e" stroke-width="4"/><rect x="3" y="23" width="8" height="18" rx="3" fill="#7c88a8" stroke="#1a0f2e" stroke-width="3.5"/><rect x="53" y="23" width="8" height="18" rx="3" fill="#7c88a8" stroke="#1a0f2e" stroke-width="3.5"/></svg>`,
  board: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="30" width="16" height="26" rx="3" fill="#c9d3e6" stroke="#1a0f2e" stroke-width="4"/><rect x="24" y="14" width="16" height="42" rx="3" fill="#ffd23a" stroke="#1a0f2e" stroke-width="4"/><rect x="42" y="38" width="16" height="18" rx="3" fill="#e59a52" stroke="#1a0f2e" stroke-width="4"/><path d="M32 4l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="#fff" stroke="#1a0f2e" stroke-width="2.5"/></svg>`,
  fighters: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 28c0-12 8-19 18-19s15 8 15 16c0 6-2 10-6 12l-1 8H22l-3-7c-1-3-1-6-1-10z" fill="#ff4b55" stroke="#1a0f2e" stroke-width="4" stroke-linejoin="round"/><path d="M18 30c-5 0-8 4-7 8s5 5 9 4" fill="#ff4b55" stroke="#1a0f2e" stroke-width="4"/><rect x="21" y="44" width="25" height="11" rx="3" fill="#fff" stroke="#1a0f2e" stroke-width="4"/></svg>`,
  arenas: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M6 50l26-10 26 10-26 10z" fill="#9a5cff" stroke="#1a0f2e" stroke-width="4" stroke-linejoin="round"/><rect x="14" y="10" width="36" height="28" rx="4" fill="#3dc8ff" stroke="#1a0f2e" stroke-width="4"/><path d="M20 30l8-10 6 7 4-4 6 7z" fill="#fff" stroke="#1a0f2e" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  cards: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="24" y="6" width="28" height="40" rx="5" fill="#9a5cff" stroke="#1a0f2e" stroke-width="4" transform="rotate(12 38 26)"/><rect x="10" y="14" width="28" height="40" rx="5" fill="#3dc8ff" stroke="#1a0f2e" stroke-width="4"/><path d="M24 24l3 6.4 7 .9-5.1 4.8 1.3 6.9-6.2-3.4-6.2 3.4 1.3-6.9-5.1-4.8 7-.9z" fill="#ffd23a" stroke="#1a0f2e" stroke-width="2.5"/></svg>`,
  profile: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="22" r="13" fill="#ffd23a" stroke="#1a0f2e" stroke-width="4"/><path d="M8 58c0-14 10-22 24-22s24 8 24 22z" fill="#3dc8ff" stroke="#1a0f2e" stroke-width="4"/></svg>`,
  lock: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="28" width="40" height="30" rx="6" fill="#5a5470" stroke="#1a0f2e" stroke-width="4"/><path d="M20 28v-8a12 12 0 0124 0v8" fill="none" stroke="#1a0f2e" stroke-width="8"/><path d="M20 28v-8a12 12 0 0124 0v8" fill="none" stroke="#8a84a6" stroke-width="3.5"/><circle cx="32" cy="42" r="5" fill="#1a0f2e"/></svg>`,
};

/** Silhouette for locked roster slots. */
export const SILHOUETTE = `<svg viewBox="0 0 100 120" aria-hidden="true"><circle cx="50" cy="34" r="20" fill="currentColor"/><path d="M14 120c0-34 16-56 36-56s36 22 36 56z" fill="currentColor"/></svg>`;
