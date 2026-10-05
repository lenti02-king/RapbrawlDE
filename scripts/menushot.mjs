// Main-menu captures: reference size (2000x1125, for the pixel comparison with the PO master) and phones in landscape.
// Usage: node scripts/menushot.mjs [outDir]   (dev server on BASE_URL, default :5173)
// Then:  python3 tools/ui-extract/compare.py tools/ui-extract/ref/main_menu.webp <outDir>/ref.png <outDir>/compare.png
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = process.argv[2] ?? 'artifacts/menu';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const shots = [
  ['ref', { width: 2000, height: 1125 }, 1, ''],
  ['iphone', { width: 844, height: 390 }, 3, '&safe=47'], // notch phone: 47 px side insets, home bar
  ['android', { width: 800, height: 360 }, 3, ''],
  ['desk', { width: 1280, height: 720 }, 1, ''],
];
for (const [tag, vp, dpr, extra] of shots) {
  if (process.env.ONLY && !process.env.ONLY.split(',').includes(tag)) continue;
  const touch = tag !== 'desk' && tag !== 'ref';
  const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag} console: ${m.text()}`));
  await page.goto(`${base}/?touch=${touch ? 1 : 0}&q=low${extra}`);
  await page.waitForSelector('.splash', { timeout: 90000 });
  await page.click('.splash button[data-default]');
  await page.waitForSelector('.screen.mm');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll('.screen.mm img')].every((i) => i.complete));
  await page.waitForTimeout(500);
  // freeze the idle animations so captures are stable
  await page.addStyleTag({ content: '.mm-playbtn,.mm-spin{animation:none!important}' });
  await page.screenshot({ path: `${out}/${tag}.png` });
  if (process.env.SHEETS && tag === 'iphone') {
    await page.click('[data-act="mode"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${tag}_modes.png` });
  }
  await ctx.close();
}
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('ok ->', out);
