// Frame-accurate capture of a signature cinematic: pauses the sim and steps to chosen
// cinematic frames. Usage: node scripts/cine.mjs volt|brick
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const who = process.argv[2] ?? 'brick';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = `artifacts/cine_${who}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const quick = who === 'brick' ? 'volt,brick' : 'volt,brick';
await page.goto(`${base}/?quick=${quick}&mode=cpu`);
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 30000 });
const idx = who === 'brick' ? 1 : 0;
await page.evaluate((idx) => {
  const r = window.__rb.runner;
  r.paused = true;
  r.sources[0].poll = () => 0;
  r.sources[1].poll = () => 0;
  const s = r.state;
  s.fighters[0].x = -6000;
  s.fighters[1].x = 6000;
  s.fighters[idx].meter = 300;
  const src = r.sources[idx];
  let once = true;
  src.poll = () => (once ? ((once = false), window.__rb.IN.S3) : 0);
}, idx);
const stepUntil = async (pred, max = 400, arg = null) => {
  for (let i = 0; i < max; i++) {
    const done = await page.evaluate(pred, arg);
    if (done) return true;
    await page.evaluate(() => window.__rb.runner.frame());
  }
  return false;
};
const files = [];
const snap = async (name) => {
  await page.waitForTimeout(450); // let the render loop blend poses/camera
  const f = `${out}/${name}.png`;
  await page.screenshot({ path: f });
  files.push(f);
};
await stepUntil(() => window.__rb.runner.state.freeze > 20);
await snap('00_flash');
const ok = await stepUntil(() => !!window.__rb.runner.state.cine);
console.log('cinematic started:', ok);
const frames = who === 'brick' ? [10, 30, 46, 56, 90, 118, 124, 134, 160] : [6, 18, 34, 48, 72, 96, 112, 118, 150];
for (const f of frames) {
  await stepUntil((f) => (window.__rb.runner.state.cine?.frame ?? 999) >= f, 300, f);
  await snap(String(f).padStart(3, '0'));
}
await stepUntil(() => !window.__rb.runner.state.cine);
const st = await page.evaluate(() => window.__rb.runner.state.fighters.map((f) => ({ st: f.state, hp: f.health })));
console.log('after cinematic:', JSON.stringify(st));
await snap('999_after');
await browser.close();
execSync(`montage ${files.join(' ')} -tile 4x -geometry 480x270+2+2 -background '#111' ${out}/sheet.png`);
console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'no page errors', `${out}/sheet.png`);
