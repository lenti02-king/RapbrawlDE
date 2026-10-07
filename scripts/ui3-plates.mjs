// Design v3 plates (S13): renders the 3D menu arena for each screen shot (src/ui/v3/shots.ts) at 1.5x, then
// downsamples and slices it like the v2 plates (l/c/r around the 1672x941 layout) plus the depth map for the living
// plate. Usage: node scripts/ui3-plates.mjs [shot,shot..]   (dev server must be running; BASE_URL)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const base = process.env.BASE_URL ?? 'http://localhost:5173';
const SCALE = Number(process.env.SCALE ?? 1.5);
const W = Math.round(2472 * SCALE);
const H = Math.round(941 * SCALE);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.setDefaultTimeout(600000);
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
const first = (process.argv[2] ?? 'home').split(',');
await page.goto(`${base}/?lab=ui3&shot=${first[0]}&scale=${SCALE}`, { timeout: 300000 });
await page.waitForFunction(() => window.__ui3?.ready, null, { timeout: 300000 });
const shots = process.argv[2] ? first : await page.evaluate(() => window.__ui3.shots);
const tmp = 'artifacts/v3/tmp';
fs.mkdirSync(tmp, { recursive: true });
for (const id of shots) {
  await page.evaluate((id) => window.__ui3.shot(id), id);
  await page.waitForTimeout(300);
  await page.locator('canvas').screenshot({ path: `${tmp}/${id}_color.png` });
  await page.evaluate((id) => window.__ui3.depth(id), id);
  await page.waitForTimeout(300);
  await page.locator('canvas').screenshot({ path: `${tmp}/${id}_depth.png` });
  const out = `public/assets/ui3/${id}`;
  fs.mkdirSync(out, { recursive: true });
  execSync(`python3 tools/ui-extract/ui3_slice.py ${tmp}/${id}_color.png ${tmp}/${id}_depth.png ${out}`, { stdio: 'inherit' });
  console.log('plate', id);
}
await browser.close();
