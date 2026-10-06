// Blunt cinematic geometry probe: steps to cinematic frames and prints the victim's joint positions in the attacker's
// frame next to the joint axis (no screenshots, fast). node scripts/blunt-measure.mjs [f1,f2,..]
import { chromium } from 'playwright';
const frames = (process.argv[2] ?? '50,72,78,96').split(',').map(Number);
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`${base}/?quick=jazeek,bonez&mode=cpu&q=low`);
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 300000 });
await page.evaluate(() => {
  const r = window.__rb.runner;
  r.paused = true;
  r.sources[0].poll = () => 0;
  r.sources[1].poll = () => 0;
  const s = r.state;
  s.fighters[0].x = -5000;
  s.fighters[1].x = 5000;
  s.fighters[0].meter = 300;
  s.fighters[0].loadout[0] = 'jaz_blunt';
  let n = 0;
  r.sources[0].poll = () => (r.state.cine || r.state.fighters[0].state === 'move' || n > 120 ? 0 : n++ % 2 === 0 ? window.__rb.IN.S1 : 0);
});
for (const F of frames) {
  for (let i = 0; i < 2000; i++) {
    const done = await page.evaluate((F) => (window.__rb.runner.state.cine?.frame ?? -1) >= F, F);
    if (done) break;
    await page.evaluate(() => window.__rb.runner.frame());
  }
  await page.evaluate(() => new Promise((res) => { let n = 0; const f = () => (++n >= 3 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
  const m = await page.evaluate(() => {
    const v = window.__rb.view;
    const a = v.rigs[0].root;
    const d = v.rigs[1];
    a.updateWorldMatrix(true, true);
    const inv = a.matrixWorld.clone().invert();
    const P = (o) => { const p = o.getWorldPosition(o.position.clone()); p.applyMatrix4(inv); return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]; };
    const out = { cf: window.__rb.runner.state.cine?.frame, ascale: a.scale.toArray().map((x) => +x.toFixed(2)) };
    for (const j of ['head', 'neck', 'chest', 'hips', 'knL', 'ftL', 'ftR', 'haL', 'haR']) out[j] = P(d.joints[j]);
    // the ember glow sprite (orange, additive): is it in the scene and visible?
    const glows = [];
    v.scene.traverse((o) => {
      if (o.isSprite && o.material.color.getHex() === 0xff7a2a) {
        let vis = true;
        for (let q = o; q; q = q.parent) vis = vis && q.visible;
        glows.push({ vis, op: +o.material.opacity.toFixed(2), sc: +o.scale.x.toFixed(2), at: P(o), dt: o.material.depthTest, ro: o.renderOrder });
      }
    });
    out.glows = glows;
    out.atkHead = P(v.rigs[0].joints.head);
    out.atkHaR = P(v.rigs[0].joints.haR);
    return out;
  });
  console.log(JSON.stringify(m));
}
await browser.close();
