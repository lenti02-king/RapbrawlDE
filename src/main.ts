import '@fontsource/lilita-one/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import '@fontsource/anton/400.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import './ui/style.css';
import './ui/theme.css';
import './ui/cr.css';
import { App } from './app/app';
import { ROSTER } from './content';
import { runLab } from './lab';
import { loadCharacterModels } from './render/glbRig';

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
const boot = document.createElement('div');
boot.className = 'boot-status';
boot.textContent = 'LADE KÄMPFER …';
ui.appendChild(boot);
let app: App | null = null;
let started = false;
const models = loadCharacterModels([...ROSTER, 'volt', 'brick'], 'assets/characters', overrides).catch(() => [] as string[]);
const timeout = new Promise((res) => setTimeout(res, 60000));
void Promise.race([models, timeout]).then(() => {
  started = true;
  boot.remove();
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
