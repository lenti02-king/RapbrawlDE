// Crowd lab close-up: node scripts/crowdshot.mjs "style=hipster&t=1.1&n=1&zoom=1.6" out.png [w] [h]   (dev server must be running)
import { chromium } from 'playwright';
const [, , query, out, w = '1600', h = '700'] = process.argv;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.text()); });
await page.goto(`${process.env.BASE_URL ?? 'http://localhost:5173'}/?lab=crowd&${query}`);
await page.waitForFunction(() => window.__crowdReady, null, { timeout: 120000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
await browser.close();
