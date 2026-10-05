// Arena screenshots at fixed fighter distances (frame-stepped, reproducible).
// Usage: node scripts/arena-shot.mjs out-prefix [quality] [extra-query]   (dev server must be running)
import { chromium } from 'playwright';

const [, , prefix = 'artifacts/arena/shot', q = 'high', extra = ''] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(`${base}/?quick=jazeek,bonez&mode=training&q=${q}${extra}`);
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 600000 });
await page.evaluate(() => {
  window.__rb.debugHold = true;
  document.querySelector('.hud')?.style.setProperty('visibility', 'hidden');
  document.querySelectorAll('.training, .tr-panel, #ui > *').forEach((e) => e.style && e.style.setProperty('visibility', 'hidden'));
});
for (const [name, gap] of [
  ['close', 2.6],
  ['mid', 5.0],
  ['wide', 9.0],
]) {
  await page.evaluate((g) => {
    const s = window.__rb.runner.state;
    s.fighters[0].x = -Math.round((g * 10000) / 2);
    s.fighters[1].x = Math.round((g * 10000) / 2);
    s.camX = 0;
    window.__rb.debugAdvance(30, false);
  }, gap);
  await page.screenshot({ path: `${prefix}_${name}.png`, timeout: 600000 });
  console.log('shot', name);
}
await browser.close();
