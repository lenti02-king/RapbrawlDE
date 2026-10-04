// Serialises the procedural courtyard (via /?lab=bake-export on the dev server) to .cache/arena/scene.json.
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto(`${base}/?lab=bake-export&nobake`);
await p.waitForFunction(() => window.__bake, null, { timeout: 120000 });
const json = await p.evaluate(() => window.__bake);
fs.mkdirSync('.cache/arena', { recursive: true });
fs.writeFileSync('.cache/arena/scene.json', json);
const s = JSON.parse(json);
console.log(`meshes ${s.meshes.length} (bake ${s.meshes.filter((m) => m.bake).length}), lights ${s.lights.length}, ${(json.length / 1e6).toFixed(1)} MB`);
await b.close();
