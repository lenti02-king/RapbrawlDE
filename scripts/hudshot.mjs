// One in-game frame with the HUD (desktop or phone landscape): node scripts/hudshot.mjs out.png [w] [h] [touch]
// (F=bonez,bonez for another pairing, e.g. a mirror match)
import { chromium } from 'playwright';
const [, , out = 'artifacts/hud.png', w = '1280', h = '720', touch = '0'] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, hasTouch: touch === '1', isMobile: touch === '1' });
await page.goto(`${base}/?quick=${process.env.F ?? 'jazeek,bonez'}&mode=cpu&q=${process.env.Q ?? 'medium'}&touch=${touch}`, { timeout: 180000 });
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 600000 });
await page.evaluate(() => {
  const rb = window.__rb;
  rb.debugHold = true;
  const s = rb.runner.state;
  s.fighters[0].meter = 230;
  s.fighters[1].meter = 120;
  s.fighters[0].health = 720;
  s.fighters[1].health = 380;
  s.fighters[0].roundsWon = 1;
  rb.runner.sources[1].poll = () => 0;
  rb.debugAdvance(30);
});
await page.screenshot({ path: out, timeout: 300000 });
await browser.close();
console.log('saved', out);
