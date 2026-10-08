// Design v2 living plates (D43): frames of one screen a moment apart + a difference image (what moves).
// Usage: node scripts/livingshot.mjs "showHome()" artifacts/s11/living [w] [h] [n=3] [gapMs=700]   (UI=v4: design v4, whose
// painting is still - the diff must show only the UI pieces' light and the 3D fighters)
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
const [, , js = 'showHome()', out = 'artifacts/living', w = '1672', h = '941', n = '3', gap = '700'] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('pageerror', (e) => logs.push(e.message));
page.on('console', (m) => m.type() === 'error' && logs.push(m.text()));
const ui = process.env.UI ?? 'v2';
await page.goto(`${base}/?ui=${ui}&q=low${process.env.EXTRA ?? ''}`);
await page.waitForFunction(() => window.__rb, null, { timeout: 240000 });
await page.evaluate(`window.__rb.${js}`);
if (ui === 'v4') await page.waitForSelector('.screen.ready', { timeout: 60000 });
else await page.waitForFunction(() => document.querySelector('.v2-living'), null, { timeout: 60000 }).catch(() => logs.push('no living plate'));
await page.waitForTimeout(3000);
const files = [];
for (let i = 0; i < +n; i++) {
  const f = `${out}-${i}.png`;
  await page.screenshot({ path: f });
  files.push(f);
  await page.waitForTimeout(+gap);
}
await browser.close();
execSync(`python3 -c "
from PIL import Image, ImageChops
a=Image.open('${files[0]}').convert('RGB'); b=Image.open('${files[files.length - 1]}').convert('RGB')
d=ImageChops.difference(a,b).point(lambda v: min(255, v*6)); d.save('${out}-diff.png')"`);
for (const l of logs) console.log(l);
console.log('saved', files.join(' '), `${out}-diff.png`);
