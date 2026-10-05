// Loading/title screen captures: reference size (pixel comparison with the PO master) + phones in landscape.
// Usage: node scripts/loadshot.mjs [outDir]   (dev server running). Holds the boot screen at ~50 % (the master's state).
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = process.argv[2] ?? 'artifacts/loading';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [tag, vp, dpr, extra] of [
  ['ref', { width: 2000, height: 1125 }, 1, ''],
  ['iphone', { width: 844, height: 390 }, 3, '&safe=47'],
  ['android', { width: 800, height: 360 }, 3, ''],
]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  // keep the boot screen up: models never arrive in this capture
  await page.route('**/assets/characters/**', () => {});
  await page.goto(`${base}/?touch=1&q=low${extra}`);
  await page.waitForSelector('.boot-screen .ld-bar', { timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const { setLoading } = await import('/src/ui/menu/loading.ts');
    const b = document.querySelector('.boot-screen');
    for (let i = 0; i < 99999; i++) clearInterval(i);
    setLoading(b, 0.5);
    b.querySelectorAll('*').forEach((e) => (e.style.animation = 'none'));
  });
  await page.addStyleTag({ content: '.ld-fill,.ld-spark{transition:none!important}' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${tag}.png` });
  await ctx.close();
}
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('ok ->', out);
