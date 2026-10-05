import '@fontsource/lilita-one/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import '@fontsource/anton/400.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/permanent-marker/400.css';
import './ui/style.css';
import './ui/theme.css';
import './ui/cr.css';
import './ui/street.css';
import './ui/hud.css';
import { App } from './app/app';
import { ROSTER } from './content';
import { runLab } from './lab';
import { loadCharacterModels } from './render/glbRig';
import { logoHtml, stageBg } from './ui/street';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const params = new URLSearchParams(location.search);

// Optional imported character models: assets/characters/<id>.glb (or ?glb=id:url,id:url for testing).
const overrides: Record<string, string> = {};
for (const pair of (params.get('glb') ?? '').split(',')) {
  const [id, url] = pair.split(':');
  if (id && url) overrides[id] = url;
}
// Models are ~4 MB each: wait for them (up to 60 s) so menus and fights show them; if they arrive later the menus
// are re-rendered, and if they fail a visible note says the placeholders are active (instead of failing silently).
// boot = the start screen's concert stage with a loading bar (the title screen replaces it with the same art)
const boot = document.createElement('div');
boot.className = 'screen st-title boot-screen';
boot.innerHTML = `${stageBg()}<div class="st-season">SAISON 1 · BLOCK BEATS</div>${logoHtml()}
  <div class="st-load"><div class="st-load-label">LÄDT KÄMPFER</div><div class="st-bar"><i></i></div></div>`;
if (!params.get('lab') && !params.get('quick')) ui.appendChild(boot);
const bootBar = boot.querySelector<HTMLElement>('.st-bar i')!;
let bootPct = 4;
let bootTarget = 10;
const bootTick = window.setInterval(() => {
  bootPct += (Math.min(96, bootTarget) - bootPct) * 0.12;
  bootBar.style.width = `${bootPct.toFixed(1)}%`;
}, 50);
let app: App | null = null;
let started = false;
const modelIds = [...ROSTER, 'volt', 'brick'];
const models = loadCharacterModels(modelIds, 'assets/characters', overrides, (done) => (bootTarget = 10 + (done / modelIds.length) * 80)).catch(() => [] as string[]);
const timeout = new Promise((res) => setTimeout(res, 60000));
void Promise.race([models, timeout]).then(() => {
  started = true;
  window.clearInterval(bootTick);
  bootBar.style.width = '100%';
  // the App renders portraits synchronously; the title screen then replaces the boot screen (same art)
  if (params.get('lab') || params.get('quick')) boot.remove();
  if (params.get('lab')) runLab(canvas);
  else app = new App(canvas, ui);
});
void models.then((ok) => {
  (window as unknown as { __models: string[] }).__models = ok; // read by scripts/artifact-check.mjs
  const missing = ROSTER.filter((id) => !ok.includes(id));
  if (missing.length) {
    const note = document.createElement('div');
    note.className = 'boot-note';
    note.textContent = `3D-Modelle nicht geladen (${missing.join(', ')}) – Platzhalter aktiv`;
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 10000);
  } else if (started && app) app.modelsArrived();
});
