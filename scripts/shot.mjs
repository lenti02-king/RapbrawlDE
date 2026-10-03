// Usage: node scripts/shot.mjs "<path?query>" out.png [width] [height] [waitMs]
// Takes a screenshot of the running dev server (default http://localhost:5173).
import { chromium } from 'playwright';
const [, , path = '/', out = 'artifacts/shot.png', w = '1280', h = '720', wait = '1500'] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(base + path);
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
for (const l of logs) console.log(l);
await browser.close();
console.log('saved', out);
