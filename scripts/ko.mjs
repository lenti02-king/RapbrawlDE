// Frame-accurate capture of a KO -> round over -> next round sequence.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = 'artifacts/ko';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`${base}/?quick=jazeek,bonez&mode=cpu`);
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 30000 });
await page.evaluate(() => {
  const r = window.__rb.runner;
  r.paused = true;
  r.sources[1].poll = () => 0;
  const s = r.state;
  s.fighters[0].x = -4000;
  s.fighters[1].x = 4000;
  s.fighters[1].health = 30;
  let n = 0;
  r.sources[0].poll = () => (n++ === 0 ? window.__rb.IN.HEAVY : 0);
});
const files = [];
const step = (k) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.__rb.runner.frame(); }, k);
const snap = async (name) => { await page.waitForTimeout(500); const f = `${out}/${name}.png`; await page.screenshot({ path: f }); files.push(f); };
const phase = () => page.evaluate(() => { const s = window.__rb.runner.state; return `${s.phase}:${s.phaseFrame} slowmo=${s.slowmo} p2=${s.fighters[1].state}`; });
await step(10);
console.log('after hit', await phase());
await snap('a_hit');
for (const [k, name] of [[12, 'b_ko_slowmo'], [30, 'c_ko_fall'], [70, 'd_ko_down'], [60, 'e_roundover'], [130, 'f_next_round']]) {
  await step(k);
  console.log(name, await phase());
  await snap(name);
}
await browser.close();
execSync(`montage ${files.join(' ')} -tile 3x -geometry 480x270+2+2 -background '#111' ${out}/sheet.png`);
console.log(`${out}/sheet.png`);
