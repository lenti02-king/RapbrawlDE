// In-game character quality captures (S17): the real fight renderer, arena and lights, the camera moved by
// view.menuShot. Per fighter: the fight framing, a full-body 3/4 shot and a face close-up.
// Usage: F=jazeek,bonez node scripts/charshot.mjs <out-prefix> [WxH=1280x720] [dpr=2] [quality=high]
//   EXTRA="&toon=0" adds URL params (A/B comparisons), SHOTS=fight,body0,face0,front0,body1,face1,front1 picks shots
//   (front = straight at the face, for the landmark comparison with the photos).
import { chromium } from 'playwright';

const [, , out = 'artifacts/charshot/x', size = '1280x720', dpr = '2', q = 'high'] = process.argv;
const [w, h] = size.split('x').map(Number);
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const shots = (process.env.SHOTS ?? 'fight,body0,face0,body1,face1').split(',');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: Number(dpr) });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/?quick=${process.env.F ?? 'jazeek,bonez'}&mode=cpu&q=${q}${process.env.EXTRA ?? ''}`, { timeout: 180000 });
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight' || window.__rb?.runner?.state.phase === 'intro', null, { timeout: 600000 });
await page.waitForTimeout(Number(process.env.WAIT ?? 8000)); // arena textures + light probe
await page.evaluate(() => {
  const rb = window.__rb;
  rb.runner.sources[0].poll = () => 0;
  rb.runner.sources[1].poll = () => 0;
  while (rb.runner.state.phase !== 'fight') rb.runner.frame();
  rb.debugHold = true;
  rb.debugAdvance(40);
});
// PRE="<js>" runs in the page before the shots (A/B checks, e.g. PRE="__rb.view.rigs[0].root.traverse(o=>o.receiveShadow=false)")
if (process.env.PRE) await page.evaluate(process.env.PRE);
for (const shot of shots) {
  await page.evaluate((shot) => {
    const rb = window.__rb;
    const v = rb.view;
    if (shot === 'fight') {
      v.menuShot = null;
    } else {
      const i = Number(shot.slice(-1));
      const rig = v.rigs[i];
      const V = rig.root.position.constructor;
      const head = rig.joints.head.getWorldPosition(new V());
      const hips = rig.joints.hips.getWorldPosition(new V());
      const other = v.rigs[1 - i].joints.hips.getWorldPosition(new V());
      const f = Math.sign(other.x - hips.x) || 1; // the fighter looks toward the opponent
      if (shot.startsWith('front')) {
        // straight at the face (landmark comparison with the photos: tools/meshy/facemarks.py + facesheet.py)
        v.menuShot = { pos: new V(head.x + f * 0.8, head.y + 0.09, head.z + 0.05), target: new V(head.x, head.y + 0.09, head.z), fov: 20 }; // eye level
      } else if (shot.startsWith('face')) {
        v.menuShot = { pos: new V(head.x + f * 0.42, head.y + 0.04, head.z + 0.62), target: new V(head.x + f * 0.03, head.y + 0.02, head.z), fov: 22 };
      } else {
        v.menuShot = { pos: new V(hips.x + f * 1.5, hips.y + 0.35, hips.z + 2.6), target: new V(hips.x, hips.y + 0.2, hips.z), fov: 34 };
      }
    }
    rb.debugAdvance(45); // the director eases into the override
  }, shot);
  await page.evaluate(() => new Promise((res) => { let n = 0; const g = () => (++n >= 8 ? res() : requestAnimationFrame(g)); requestAnimationFrame(g); }));
  await page.screenshot({ path: `${out}_${shot}.png`, timeout: 300000 });
}
console.log(errors.length ? `page errors: ${errors.slice(0, 3).join(' | ')}` : 'no page errors', out);
await browser.close();
