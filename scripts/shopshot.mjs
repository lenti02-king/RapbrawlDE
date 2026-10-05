// Shop captures: reference size (comparison with the PO master) + phones in landscape.
// Usage: node scripts/shopshot.mjs [outDir]   (dev server running)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = process.argv[2] ?? 'artifacts/shop';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [tag, vp, dpr, extra] of [
  ['ref', { width: 2000, height: 1125 }, 1, ''],
  ['iphone', { width: 844, height: 390 }, 3, '&safe=47'],
]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  await page.goto(`${base}/?touch=1&q=low${extra}`);
  await page.waitForSelector('.splash', { timeout: 90000 });
  await page.click('.splash button[data-default]');
  await page.waitForSelector('.main-menu');
  await page.click('[data-act="shop"]');
  await page.waitForSelector('.sh .cs-stage');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll('.cs-stage img')].every((i) => i.complete));
  await page.addStyleTag({ content: '*{animation:none!important}' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${tag}.png` });
  await ctx.close();
}
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('ok ->', out);
