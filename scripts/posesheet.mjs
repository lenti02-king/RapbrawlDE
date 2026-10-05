// Pose contact sheet straight from the authored clips (no sim, no blending): one lab page, many poses.
// Usage: node scripts/posesheet.mjs <fighter> <spec[,spec..]> [out.png]
//   spec = move:<key>:<from>-<to>[:<step>]  (e.g. move:jaz_5L:1-14:1), walkF:0-4:0.5, motion:<clip>:0-8:2, or any
//          single lab pose (stance, move:jaz_5H:9, hitHigh)
// Camera: game side view (&yaw=47), full figure. Dev server must be running.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const [, , fighter = 'jazeek', specArg = 'stance', outArg] = process.argv;
const other = fighter === 'bonez' ? 'jazeek' : 'bonez';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = outArg ?? `artifacts/poses/${fighter}_${specArg.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60)}.png`;
const tmp = `artifacts/poses/tmp/${process.pid}`;
fs.mkdirSync(tmp, { recursive: true });

// expand ranges
const specs = [];
for (const sp of specArg.split(',')) {
  const parts = sp.split(':');
  const range = parts.find((p) => /^-?[\d.]+--?[\d.]+$/.test(p));
  if (!range) {
    specs.push(sp);
    continue;
  }
  const ri = parts.indexOf(range);
  const [a, b] = range.split(/(?<=\d)-/).map(Number);
  const step = Number(parts[ri + 1] ?? 1);
  for (let v = a; v <= b + 1e-6; v += step) specs.push([...parts.slice(0, ri), String(+v.toFixed(3))].join(':'));
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 560), height: 520 } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(`${base}/?lab=poses&a=${fighter}&b=${other}&frame=full&who=0&hide=other&q=low&yaw=${process.env.YAW ?? 47}${process.env.EXTRA ?? ''}`);
await page.waitForFunction(() => window.__lab?.setPose, null, { timeout: 300000 });
await page.waitForTimeout(4000);
const files = [];
for (const [i, sp] of specs.entries()) {
  await page.evaluate((s) => window.__lab.setPose(0, s), sp);
  await page.waitForTimeout(250);
  const file = `${tmp}/${String(i).padStart(3, '0')}.png`;
  await page.screenshot({ path: file, timeout: 300000 });
  files.push([file, sp.split(':').slice(1).join(' ').replace(/^(jaz|bon)_/, '')]);
}
await browser.close();
const args = files.map(([f, l]) => `-label '${l}' ${f}`).join(' ');
execSync(`montage ${args} -tile ${Math.min(8, files.length)}x -geometry 280x260+1+1 -pointsize 14 -fill '#ffd65a' -background '#111' ${out}`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('sheet', out, files.length);
