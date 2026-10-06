// Design v2 screen captures (D42): node scripts/v2shot.mjs <screen-js> <out-prefix> [sizes]
//   screen-js: JS run on window.__rb after boot, e.g. "showHome()" ; sizes: "1672x941,932x430,750x300"
import { chromium } from 'playwright';
const [, , js = 'showHome()', out = 'artifacts/v2/home', sizes = '1672x941,932x430,844x390,750x300', wait = '3500'] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const sz of sizes.split(',')) {
  const [w, h] = sz.split('x').map(Number);
  const touch = h < 500;
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: false, deviceScaleFactor: Number(process.env.DPR ?? 1) });
  const logs = [];
  page.on('console', (m) => m.type() === 'error' && logs.push(`[console] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`${base}/?ui=v2&q=low${process.env.EXTRA ?? ''}`);
  await page.waitForFunction(() => window.__rb, null, { timeout: 240000 });
  await page.evaluate(`window.__rb.${js}`);
  await page.waitForTimeout(+wait);
  await page.screenshot({ path: `${out}-${w}x${h}.png` });
  for (const l of logs) console.log(sz, l);
  await page.close();
}
await browser.close();
console.log('saved', out);
