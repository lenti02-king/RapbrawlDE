// Character-select + arena-select captures: reference size (comparison with the PO master) + phones in landscape.
// Usage: node scripts/selectshot.mjs [outDir]   (dev server running)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = process.argv[2] ?? 'artifacts/select';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [tag, vp, dpr, extra] of [
  ['ref', { width: 2000, height: 1125 }, 1, ''],
  ['iphone', { width: 844, height: 390 }, 3, '&safe=47'],
  ['viewer', { width: 844, height: 330 }, 3, ''], // phone in landscape inside the Claude app / a browser (bars eat height)
  ['tablet', { width: 1024, height: 768 }, 2, ''],
  ['android', { width: 800, height: 360 }, 3, ''],
]) {
  if (process.env.ONLY && !process.env.ONLY.split(',').includes(tag)) continue;
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  await page.goto(`${base}/?touch=1&q=low${extra}`);
  await page.waitForSelector('.splash', { timeout: 90000 });
  await page.click('.splash button[data-default]');
  await page.waitForSelector('.main-menu');
  await page.click(`[data-act="${process.env.MODE ?? 'quick'}"]`);
  await page.waitForSelector('.cs-stage');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll('.cs-stage img')].every((i) => i.complete));
  await page.addStyleTag({ content: '*{animation:none!important}' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${tag}.png` });
  // arena select (BEREIT!)
  await page.click('[data-ready]');
  await page.waitForSelector('.as-tile');
  await page.waitForFunction(() => [...document.querySelectorAll('.cs-stage img')].every((i) => i.complete));
  await page.addStyleTag({ content: '*{animation:none!important}' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${tag}_arena.png` });
  await ctx.close();
}
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('ok ->', out);
