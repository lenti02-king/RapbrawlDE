// Close-up of a fighter's hand in a lab pose, cropped around the hand bone (hand/fist refinement).
// Usage: node scripts/handshot.mjs <fighter> <pose> <out.png> [hand=haL|haR] [yaw=47]
import { chromium } from 'playwright';
const [, , fighter = 'jazeek', pose = 'stance', out = 'artifacts/hand.png', hand = 'haL', yaw = '47'] = process.argv;
const other = fighter === 'bonez' ? 'jazeek' : 'bonez';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(`${base}/?lab=poses&a=${fighter}&b=${other}&frame=body&who=0&hide=other&q=high&yaw=${yaw}&pose=${pose}${process.env.EXTRA ?? ''}`);
await page.waitForFunction(() => window.__lab?.setPose, null, { timeout: 300000 });
await page.waitForTimeout(6000);
const p = await page.evaluate((h) => {
  const L = window.__lab;
  const j = L.rigs[0].joints[h];
  const v = j.getWorldPosition(new j.position.constructor());
  v.project(L.cam);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
}, hand);
const S = 360;
await page.screenshot({ path: out, timeout: 300000, clip: { x: Math.max(0, Math.min(1400 - S, p.x - S / 2)), y: Math.max(0, Math.min(1000 - S, p.y - S / 2)), width: S, height: S } });
await browser.close();
console.log('saved', out);
