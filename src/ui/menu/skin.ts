// App-wide skin from the PO masters (D38): every screen that is not a full master layout (Kämpfer, Karten, Profil,
// Einstellungen, Steuerung, Pause, Ergebnis, Online) gets the leaderboard stadium as backdrop, the master's glass
// panel frame (9-slice) for panels and dialogs, and the master's blue/gold buttons (9-slice) for buttons. The sprite
// URLs are exposed as CSS variables; skin.css does the rest.
import './skin.css';
import { LB_ART } from './boardArt';

const root = document.documentElement.style;
root.setProperty('--kit-backdrop', `url(${LB_ART.backdrop.src})`);
root.setProperty('--kit-panel', `url(${LB_ART.panel.src})`);
root.setProperty('--kit-side', `url(${LB_ART.side.src})`);
root.setProperty('--kit-btn', `url(${LB_ART.btn_blue.src})`);
root.setProperty('--kit-btn-gold', `url(${LB_ART.btn_gold.src})`);
