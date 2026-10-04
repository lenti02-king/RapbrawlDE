import '@fontsource/lilita-one/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './ui/style.css';
import { App } from './app/app';
import { runLab } from './lab';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const params = new URLSearchParams(location.search);

if (params.get('lab')) runLab(canvas);
else new App(canvas, ui);
