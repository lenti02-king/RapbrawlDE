// Captures the special-move presentation (VFX/props) of the real roster at chosen frames.
// Usage: node scripts/specials.mjs   (dev server must be running) -> artifacts/specials/sheet.png
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = 'artifacts/specials';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/?quick=jazeek,bonez&mode=training`);
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 30000 });
await page.evaluate(() => {
  const r = window.__rb.runner;
  r.paused = true;
  r.sources[0].poll = () => 0;
  r.sources[1].poll = () => 0;
});
// [fighter index, move, frame to show]
const shots = [
  [0, 'jaz_wave', 16, 30000],
  [1, 'bon_smoke', 40, 30000],
  [0, 'jaz_spot', 8],
  [0, 'jaz_counter', 8],
  [0, 'jaz_mvp', 9],
  [1, 'bon_croc', 14],
  [1, 'bon_croc', 21],
  [1, 'bon_smoke', 30],
  [1, 'bon_grin', 30],
];
const files = [];
for (const [idx, key, at, far] of shots) {
  await page.evaluate(([idx, key, far]) => {
    window.__rb.freezeMove(idx, key, 1);
    if (far) window.__rb.runner.state.fighters[1 - idx].x = far;
  }, [idx, key, far ?? 0]);
  for (let i = 1; i < at; i++) await page.evaluate(() => window.__rb.runner.frame());
  await page.evaluate(() => new Promise((res) => { let n = 0; const f = () => (++n >= 8 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
  const file = `${out}/${key}_${at}.png`;
  await page.screenshot({ path: file });
  files.push(file);
}
await browser.close();
execSync(`montage ${files.join(' ')} -tile 4x -geometry 480x300+2+2 -background '#111' ${out}/sheet.png`);
console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'no page errors', `${out}/sheet.png`);
