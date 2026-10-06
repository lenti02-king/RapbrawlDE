// Pose iteration sheet (D42): one fighter, 3/4 front framing, several pose overrides side by side.
// node scripts/posegrid.mjs jazeek out.png '<json1>' '<json2>' ...   (each JSON is a PoseDef layered on pose=showcase)
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
const [, , id = 'jazeek', out = 'artifacts/posegrid.png', ...variants] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const files = [];
const list = variants.length ? variants : ['{}'];
for (let i = 0; i < list.length; i++) {
  const page = await browser.newPage({ viewport: { width: 420, height: 600 } });
  const pose = process.env.POSE ?? 'showcase';
  await page.goto(`${base}/?lab=poses&a=${id}&b=${id}&pose=${pose}&frame=body&who=0&hide=other&yaw=${process.env.YAW ?? 10}&q=low&pj=${encodeURIComponent(list[i])}`);
  await page.waitForTimeout(5000);
  const f = `${out}.${i}.png`;
  await page.screenshot({ path: f });
  files.push(f);
  await page.close();
}
await browser.close();
execSync(`DEL=1 python3 scripts/montage.py ${out} ${files.join(' ')}`);
console.log('saved', out);
