// Menu flow captures at one viewport: main menu (live favourite), modes, arenas (favourite), char select, arena pick,
// shop. Usage: node scripts/flowshot.mjs [outDir] [w] [h]   (dev server running)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = process.argv[2] ?? 'artifacts/flow';
const vw = Number(process.argv[3] ?? 844);
const vh = Number(process.argv[4] ?? 390);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = async (name) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}.png` });
};
await page.goto(`${base}/?touch=1&q=low`);
await page.waitForSelector('.splash', { timeout: 90000 });
await page.click('.splash button[data-default]');
await page.waitForSelector('.main-menu');
await shot('1_home');
await page.click('[data-act="mode"]');
await page.waitForSelector('.st-modes .as-tile');
await page.click('[data-item="koop"]');
await shot('2_modes');
await page.click('[data-back]');
await page.waitForSelector('.main-menu');
await page.click('[data-act="arenas"]');
await page.waitForSelector('.st-arena .as-tile');
await shot('3_arenas');
await page.click('[data-back]');
await page.waitForSelector('.main-menu');
await page.click('[data-act="shop"]');
await page.waitForSelector('.sh .cs-stage');
await shot('4_shop');
await page.click('[data-back]');
await page.waitForSelector('.main-menu');
await page.click('[data-act="play"]');
await page.waitForSelector('.cs-stage .cs-ped');
await shot('5_select');
await page.click('[data-ready]');
await page.waitForSelector('.st-arena .as-tile');
await shot('6_arena_pick');
await page.click('[data-ok]');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/7_draw.png` });
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('ok ->', out);
