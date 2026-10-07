// Design v2 in-match screens (D43): HUD skin, results and pause over the running arena.
// node scripts/v2match.mjs [out-prefix] [WxH]  -> <out>-hud.png, <out>-pause.png, <out>-results.png
import { chromium } from 'playwright';
const [, , out = 'artifacts/v2b/match', size = '1672x941'] = process.argv;
const [w, h] = size.split('x').map(Number);
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: h < 500 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}/?ui=v2&quick=${process.env.F ?? 'manuellsen,lacazette'}&mode=cpu&q=low${h < 500 ? '&touch=1' : ''}`, { timeout: 300000 });
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 300000 });
await page.evaluate(() => {
  const r = window.__rb.runner;
  r.sources[1].poll = () => 0;
  r.state.fighters[0].meter = 300;
  r.state.fighters[1].health = Math.round(r.state.fighters[1].health * 0.55);
});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}-hud.png`, timeout: 120000 });
await page.evaluate(() => window.__rb.togglePause());
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}-pause.png`, timeout: 120000 });
await page.evaluate(() => window.__rb.togglePause());
// results: pretend P1 took the match 2:1
await page.evaluate(() => {
  const app = window.__rb;
  const s = app.runner.state;
  app.runner.paused = true;
  s.matchWinner = 0;
  s.fighters[0].roundsWon = 2;
  s.fighters[1].roundsWon = 1;
  app.stats.damage = [1240, 870];
  app.stats.maxCombo = [7, 4];
  app.stats.specials = [3, 2];
  app.showResults();
});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}-results.png`, timeout: 120000 });
console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no page errors');
await browser.close();
