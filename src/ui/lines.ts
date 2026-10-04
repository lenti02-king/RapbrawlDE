// Monochrome line icons (stroke = currentColor) for the "Block Beats Night" menus. Original artwork.
const s = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const LINE = {
  user: s('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  gear: s(
    '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3"/>',
  ),
  play: s('<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>'),
  grid: s('<rect x="3.5" y="3.5" width="7" height="7"/><rect x="13.5" y="3.5" width="7" height="7"/><rect x="3.5" y="13.5" width="7" height="7"/><rect x="13.5" y="13.5" width="7" height="7"/>'),
  fighter: s('<circle cx="12" cy="6" r="3"/><path d="M6 21l2-8 4 2 4-2 2 8M8 13l-2-3 4-1M16 13l2-3-4-1"/>'),
  cards: s('<rect x="4" y="6" width="11" height="15" rx="1"/><path d="M8.5 3h10.5v15"/>'),
  swords: s('<path d="M4 4l9 9M20 4l-9 9M6.5 15.5l2 2M15.5 17.5l2-2M3.5 20.5l3-3M20.5 20.5l-3-3"/>'),
  online: s('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5S9.5 6.1 12 3.5z"/>'),
  pad: s('<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r="0.9" fill="currentColor"/><circle cx="18" cy="13.5" r="0.9" fill="currentColor"/>'),
  trophy: s('<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8M9.5 18h5"/>'),
  chart: s('<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>'),
  crown: s('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/><path d="M5 19h14"/>'),
  sound: s('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  mute: s('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  back: s('<path d="M14.5 5L7.5 12l7 7"/>'),
  lock: s('<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  bolt: s('<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>'),
};
