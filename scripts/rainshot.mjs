// Diamanten-Regen capture (D42): chain flash, warning ring at the opponent, the shower. Steps the paused sim and shoots
// fixed moments. Usage: node scripts/rainshot.mjs [out=artifacts/rain]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const out = process.argv[2] ?? 'artifacts/rain';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/?quick=jazeek,bonez&mode=cpu&q=low`);
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 300000 });
await page.evaluate(() => {
  const r = window.__rb.runner;
  r.paused = true;
  const s = r.state;
  s.fighters[0].x = -15000;
  s.fighters[1].x = 12000;
  s.fighters[0].meter = 300;
  s.fighters[0].loadout[0] = 'jaz_rain';
  let n = 0;
  r.sources[0].poll = () => (s.fighters[0].state === 'move' || n > 60 ? 0 : n++ % 2 === 0 ? window.__rb.IN.S1 : 0);
  r.sources[1].poll = () => 0;
});
const step = async (pred, max = 300) => {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate(pred)) return true;
    await page.evaluate(() => window.__rb.runner.frame());
  }
  return false;
};
const files = [];
const snap = async (name) => {
  await page.evaluate(() => new Promise((res) => { let n = 0; const f = () => (++n >= 8 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
  const f = `${out}/${name}.png`;
  await page.screenshot({ path: f, timeout: 180000 });
  files.push(f);
};
for (const mf of [8, 16]) {
  await step(`window.__rb.runner.state.fighters[0].mf >= ${mf}`);
  await snap(`m${mf}`);
}
for (const age of [6, 20, 34, 44, 58]) {
  await step(`(window.__rb.runner.state.projectiles[0]?.age ?? (window.__rb.runner.state.fighters[0].mf > 30 ? 999 : 0)) >= ${age}`);
  await snap(`p${age}`);
}
const st = await page.evaluate(() => window.__rb.runner.state.fighters.map((f) => f.state + ':' + f.health));
console.log('after:', st.join(' '), errors.length ? 'ERRORS ' + errors.join(' | ') : 'no page errors');
await browser.close();
execSync(`montage ${files.join(' ')} -tile 4x -geometry 480x270+2+2 -background '#111' ${out}/sheet.png`);
console.log('saved', `${out}/sheet.png`);
