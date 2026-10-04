import '@fontsource/lilita-one/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './ui/style.css';
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
const timeout = new Promise((res) => setTimeout(res, 20000));
void Promise.race([loadCharacterModels([...ROSTER, 'volt', 'brick'], 'assets/characters', overrides).catch(() => []), timeout]).then(() => {
  if (params.get('lab')) runLab(canvas);
  else new App(canvas, ui);
});
