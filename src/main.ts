import '@fontsource/lilita-one/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import '@fontsource/anton/400.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/latin-600-italic.css';
import '@fontsource/barlow-condensed/latin-700-italic.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import '@fontsource/barlow-condensed/latin-900-italic.css';
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
import { loadPropModels, PROP_IDS } from './render/propModels';
import { isCutout, loadCutouts } from './render/cutout';
import { loadingHtml, mountLoading, setLoading } from './ui/menu/loading';

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
// boot = the PO's loading screen (D38); the title screen replaces it with the same art and "TIPPEN ZUM STARTEN"
const boot = document.createElement('div');
boot.className = 'screen boot-screen';
boot.innerHTML = loadingHtml('LÄDT …');
if (!params.get('lab') && !params.get('quick')) {
  ui.appendChild(boot);
  mountLoading(boot);
}
let bootPct = 4;
let bootTarget = 10;
const bootTick = window.setInterval(() => {
  bootPct += (Math.min(96, bootTarget) - bootPct) * 0.12;
  setLoading(boot, bootPct / 100);
}, 50);
let app: App | null = null;
let started = false;
const modelIds = [...ROSTER, 'volt', 'brick'];
let modelsDone = 0;
let propsDone = 0;
const progress = () => (bootTarget = 10 + ((modelsDone + propsDone) / (modelIds.length + PROP_IDS.length)) * 80);
// the PO's prop models (croc, car, mic, ...) load alongside; every user falls back to its procedural prop without them
const props = loadPropModels('assets/props', (d) => ((propsDone = d), progress())).catch(() => []);
void props.then((ok) => ((window as unknown as { __props: string[] }).__props = ok)); // read by scripts/artifact-check.mjs
const models = Promise.all([
  loadCharacterModels(modelIds.filter((id) => !isCutout(id)), 'assets/characters', overrides, (d) => ((modelsDone = d), progress())).catch(() => [] as string[]),
  props,
  loadCutouts('assets/characters').catch(() => [] as string[]),
]).then(([ok, , cut]) => [...ok, ...cut]);
const timeout = new Promise((res) => setTimeout(res, 60000));
void Promise.race([models, timeout]).then(() => {
  started = true;
  window.clearInterval(bootTick);
  setLoading(boot, 1);
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
