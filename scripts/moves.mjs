// Captures every move of a fighter at its first active frame with the hitbox overlay,
// to verify that poses visually match sim hitboxes.
// Usage: node scripts/moves.mjs jazeek|bonez|volt|brick   (dev server must be running)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const fighter = process.argv[2] ?? 'volt';
const other = { volt: 'brick', brick: 'volt', jazeek: 'bonez', bonez: 'jazeek' }[fighter] ?? 'jazeek';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = `artifacts/moves_${fighter}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
await page.goto(`${base}/?quick=${fighter},${other}&mode=training${process.env.EXTRA ?? ''}`);
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 180000 });
await page.evaluate(() => {
  const r = window.__rb.runner;
  r.paused = true;
  r.sources[0].poll = () => 0;
  r.sources[1].poll = () => 0;
  window.__rb.view.debug = true;
});
const list = await page.evaluate(() => window.__rb.moveList(0));
const files = [];
for (const m of list) {
  const frame = await page.evaluate((key) => window.__rb.freezeMove(0, key), m);
  await page.waitForTimeout(350);
  const file = `${out}/${m}.png`;
  await page.screenshot({ path: file });
  files.push(file);
  console.log(m, 'frame', frame);
}
await browser.close();
// contact sheet (ImageMagick)
execSync(`montage ${files.join(' ')} -tile 4x -geometry 480x300+2+2 -background '#111' ${out}/sheet.png`);
console.log('sheet', `${out}/sheet.png`);
