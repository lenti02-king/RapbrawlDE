// Usage: node scripts/play.mjs <scenario> [outdir]
// Drives the running dev server with Playwright: loads a quick match, injects
// inputs through the debug API (window.__rb) and captures screenshots.
import { chromium } from 'playwright';
import fs from 'node:fs';
const [, , scenario = 'basic', outdir = 'artifacts'] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5173';
fs.mkdirSync(outdir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const shot = async (name) => { await page.screenshot({ path: `${outdir}/${scenario}_${name}.png` }); console.log('shot', name); };
const state = () => page.evaluate(() => { const s = window.__rb.runner.state; return { frame: s.frame, phase: s.phase, f: s.fighters.map((f) => ({ st: f.state, x: f.x, hp: f.health, m: f.meter, mv: f.move })) }; });
await page.goto(base + '/?quick=jazeek,bonez&mode=' + (scenario === 'training' ? 'training' : 'cpu'));
await page.waitForFunction(() => window.__rb && window.__rb.runner, null, { timeout: 15000 });
const waitPhase = async (p) => page.waitForFunction((p) => window.__rb.runner.state.phase === p, p, { timeout: 20000 });
if (scenario === 'basic') {
  await page.waitForTimeout(700);
  await shot('intro');
  await waitPhase('fight');
  // freeze the CPU so the screenshot sequence is controlled
  await page.evaluate(() => { window.__rb.runner.sources[1].poll = () => 0; });
  await page.evaluate(() => window.__rb.debugHoldP1(window.__rb.IN.RIGHT, 40));
  await page.waitForTimeout(700);
  await shot('walk');
  await page.evaluate(() => window.__rb.debugHoldP1(window.__rb.IN.LIGHT, 1));
  await page.waitForTimeout(80);
  await shot('jab');
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__rb.debugHoldP1(window.__rb.IN.HEAVY, 1));
  await page.waitForTimeout(170);
  await shot('cross');
  console.log(JSON.stringify(await state()));
} else if (scenario === 'super') {
  await waitPhase('fight');
  await page.evaluate(() => { const r = window.__rb.runner; r.sources[1].poll = () => 0; const s = r.state; s.fighters[0].meter = 300; s.fighters[0].x = -7500; s.fighters[1].x = 7500; });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__rb.debugHoldP1(window.__rb.IN.S3, 1));
  await page.waitForTimeout(250);
  await shot('flash');
  await page.waitForFunction(() => window.__rb.runner.state.cine, null, { timeout: 5000 });
  const t0 = Date.now();
  for (const ms of [200, 450, 900, 1300, 1650, 1950, 2300]) {
    const wait = ms - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await shot('cine_' + ms);
  }
  await page.waitForTimeout(900);
  await shot('after');
  console.log(JSON.stringify(await state()));
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
