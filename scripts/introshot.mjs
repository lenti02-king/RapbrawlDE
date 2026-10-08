// Round-1 fighter showcase (emote, face close-up, name overlay) at chosen intro frames.
// Usage: node scripts/introshot.mjs [f1,f2,..] [w] [h]  -> artifacts/intro/<frame>.png + sheet.png  (F=jazeektoon,jazeek: other pairing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const frames = (process.argv[2] ?? '6,20,40,60,84,110,140,170,186,200').split(',').map(Number);
const W = Number(process.argv[3] ?? 960);
const H = Number(process.argv[4] ?? 540);
const out = 'artifacts/intro';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/?quick=${process.env.F ?? 'jazeek,bonez'}&mode=cpu${process.env.EXTRA ?? ''}`);
await page.waitForFunction(() => window.__rb?.runner?.state, null, { timeout: 300000 });
await page.evaluate(() => {
  const r = window.__rb.runner;
  r.paused = true;
  r.sources[0].poll = () => 0;
  r.sources[1].poll = () => 0;
});
const files = [];
for (const f of frames) {
  await page.evaluate((f) => {
    const r = window.__rb.runner;
    while (r.state.phase === 'intro' && r.state.phaseFrame < f) r.frame();
  }, f);
  await page.evaluate(() => new Promise((res) => { let n = 0; const g = () => (++n >= 12 ? res() : requestAnimationFrame(g)); requestAnimationFrame(g); }));
  const file = `${out}/${String(f).padStart(3, '0')}.png`;
  await page.screenshot({ path: file });
  files.push(file);
}
await browser.close();
execSync(`montage ${files.join(' ')} -tile 4x -geometry 480x270+2+2 -background '#111' ${out}/sheet.png`);
console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'no page errors', `${out}/sheet.png`);
