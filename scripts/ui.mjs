// Screenshots of the menu flow (desktop + phone landscape). Usage: node scripts/ui.mjs [prefix]
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = 'artifacts/ui';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const frames = (page, n = 8) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
for (const [tag, vp, touch] of [
  ['desk', { width: 1280, height: 720 }, false],
  ['phone', { width: 844, height: 390 }, true],
]) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag} console: ${m.text()}`));
  await page.goto(`${base}/?touch=${touch ? 1 : 0}`);
  await page.waitForSelector('.splash');
  await frames(page, 6);
  await page.screenshot({ path: `${out}/${tag}_0_title.png` });
  await page.click('.splash button[data-default]');
  await page.waitForSelector('.main-menu');
  await page.waitForTimeout(600);
  await frames(page, 10);
  await page.screenshot({ path: `${out}/${tag}_1_home.png` });
  await page.click('[data-act="fighters"]');
  await page.waitForSelector('.fcard');
  await page.waitForTimeout(400);
  await frames(page, 4);
  await page.screenshot({ path: `${out}/${tag}_2_fighters.png` });
  await page.click('[data-todeck]');
  await page.waitForSelector('.deck-slots');
  await page.click('.collection [data-card]:not(:has(.equipped))');
  await page.waitForTimeout(400);
  await frames(page, 3);
  await page.screenshot({ path: `${out}/${tag}_3_deck.png` });
  await page.click('[data-back]');
  await page.waitForSelector('.fcard');
  await page.click('[data-back]');
  await page.waitForSelector('.main-menu');
  await page.click('[data-act="event"]');
  await page.waitForTimeout(400);
  await frames(page, 3);
  await page.screenshot({ path: `${out}/${tag}_4_help.png` });
  await page.click('[data-back]');
  if (process.env.ONLY_MENU) {
    await page.click('[data-act="play"]');
    await page.waitForSelector('.st-select');
    await page.waitForTimeout(500);
    await frames(page, 4);
    await page.screenshot({ path: `${out}/${tag}_5a_select.png` });
    await page.click('[data-ready]');
    await page.waitForSelector('.st-arena');
    await page.waitForTimeout(500);
    await frames(page, 4);
    await page.screenshot({ path: `${out}/${tag}_5b_arena.png` });
    await ctx.close();
    continue;
  }
  await page.click('[data-act="play"]');
  await page.waitForSelector('.st-select');
  await page.waitForTimeout(500);
  await frames(page, 4);
  await page.screenshot({ path: `${out}/${tag}_5a_select.png` });
  await page.click('[data-ready]');
  await page.waitForSelector('.st-arena');
  await page.waitForTimeout(500);
  await frames(page, 4);
  await page.screenshot({ path: `${out}/${tag}_5b_arena.png` });
  await page.click('[data-arena-ok]');
  await page.waitForSelector('.st-loading');
  await frames(page, 4);
  await page.screenshot({ path: `${out}/${tag}_5c_loading.png` });
  // the VS splash can come and go while the 3D scene is being built (main thread busy): best effort
  await page.waitForSelector('.vs', { timeout: 8000 }).catch(() => {});
  await frames(page, 2);
  await page.screenshot({ path: `${out}/${tag}_5_vs.png` });
  await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 120000 });
  await page.evaluate(() => { const s = window.__rb.runner.state; s.fighters[0].meter = 300; s.fighters[1].meter = 150; });
  await page.waitForTimeout(1200);
  await frames(page, 6);
  await page.screenshot({ path: `${out}/${tag}_6_fight.png` });
  await page.evaluate(() => window.__rb.togglePause());
  await page.waitForTimeout(400);
  await frames(page, 4);
  await page.screenshot({ path: `${out}/${tag}_7_pause.png` });
  await page.evaluate(() => { window.__rb.togglePause(); const s = window.__rb.runner.state; s.fighters[0].roundsWon = 1; s.fighters[1].health = 0; window.__rb.runner.speed = 4; });
  await page.waitForFunction(() => window.__rb.resultsShown === true, null, { timeout: 90000 }).catch(() => errors.push(`${tag}: results not shown`));
  await page.waitForTimeout(500);
  await frames(page, 6);
  await page.screenshot({ path: `${out}/${tag}_8_results.png` });
  await ctx.close();
}
await browser.close();
console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'no page errors');
