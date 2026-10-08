// In-game calibration of the PBR fighters' colour grade (S17): one fight, the frontal face shot of P1, a screenshot per
// (saturation, gain) pair via the window.__rbLook hook (render/cel.ts) - measure the skin with tools/meshy/facemarks.py.
// Usage: F=jazeek,bonez node scripts/gradeprobe.mjs <out-prefix> "0.5:1,0.62:1.12,0.75:1.25" [WxH] [quality]
import { chromium } from 'playwright';

const [, , out = 'artifacts/grade/g', pairs = '0.62:1.12', size = '1280x720', q = 'high'] = process.argv;
const [w, h] = size.split('x').map(Number);
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
await page.goto(`${base}/?quick=${process.env.F ?? 'jazeek,bonez'}&mode=cpu&q=${q}`, { timeout: 180000 });
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight' || window.__rb?.runner?.state.phase === 'intro', null, { timeout: 600000 });
await page.waitForTimeout(Number(process.env.WAIT ?? 12000));
await page.evaluate(() => {
  const rb = window.__rb;
  rb.runner.sources[0].poll = () => 0;
  rb.runner.sources[1].poll = () => 0;
  while (rb.runner.state.phase !== 'fight') rb.runner.frame();
  rb.debugHold = true;
  rb.debugAdvance(40);
  const v = rb.view;
  const rig = v.rigs[0];
  const V = rig.root.position.constructor;
  const head = rig.joints.head.getWorldPosition(new V());
  const other = v.rigs[1].joints.hips.getWorldPosition(new V());
  const f = Math.sign(other.x - head.x) || 1;
  v.menuShot = { pos: new V(head.x + f * 0.8, head.y - 0.02, head.z + 0.05), target: new V(head.x, head.y - 0.02, head.z), fov: 22 };
  rb.debugAdvance(45);
});
for (const pair of pairs.split(',')) {
  const [sat, gain] = pair.split(':').map(Number);
  await page.evaluate(([s, g]) => {
    window.__rbLook.grade.sat.value = s;
    window.__rbLook.grade.gain.value = g;
    window.__rb.debugAdvance(1); // a held fight only renders when stepped
  }, [sat, gain]);
  await page.evaluate(() => new Promise((res) => { let n = 0; const g = () => (++n >= 6 ? res() : requestAnimationFrame(g)); requestAnimationFrame(g); }));
  await page.screenshot({ path: `${out}_${sat}_${gain}.png`, timeout: 300000 });
  console.log('shot', sat, gain);
}
await browser.close();
