// Look development for the PBR fighters in the real fight renderer (S17 render pass): one fight, P1 framed per shot,
// a screenshot per parameter set (render/cel.ts window.__rbLook + P1's material), then one contact sheet per shot.
// Usage: F=jazeek,bonez node scripts/lookprobe.mjs <out-prefix> '<json>;<json>;..' [shots=fight,body,face] [WxH]
//   json keys: sat gain tint:[r,g,b] neutral amb ao key:[r,g,b] keyDir:[x,y,z] rim:[r,g,b] rimPow
//              rough spec env normal (P1's material: roughness factor, specularIntensity, envMapIntensity, normalScale)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

const [, , out = 'artifacts/look/x', sets = '{}', shotList = 'fight,body,face', size = '1280x720'] = process.argv;
const [w, h] = size.split('x').map(Number);
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/?quick=${process.env.F ?? 'jazeek,bonez'}&mode=cpu&q=${process.env.Q ?? 'high'}${process.env.EXTRA ?? ''}`, { timeout: 180000 });
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight' || window.__rb?.runner?.state.phase === 'intro', null, { timeout: 600000 });
await page.waitForTimeout(Number(process.env.WAIT ?? 10000));
await page.evaluate(() => {
  const rb = window.__rb;
  rb.runner.sources[0].poll = () => 0;
  rb.runner.sources[1].poll = () => 0;
  while (rb.runner.state.phase !== 'fight') rb.runner.frame();
  rb.debugHold = true;
  rb.debugAdvance(40);
});
const params = sets.split(';').map((s) => JSON.parse(s || '{}'));
const files = {};
for (const shot of shotList.split(',')) {
  await page.evaluate((shot) => {
    const v = window.__rb.view;
    const rig = v.rigs[0];
    const V = rig.root.position.constructor;
    const head = rig.joints.head.getWorldPosition(new V());
    const hips = rig.joints.hips.getWorldPosition(new V());
    const f = Math.sign(v.rigs[1].joints.hips.getWorldPosition(new V()).x - hips.x) || 1;
    if (shot === 'fight') v.menuShot = null;
    else if (shot === 'face') v.menuShot = { pos: new V(head.x + f * 0.42, head.y + 0.04, head.z + 0.62), target: new V(head.x + f * 0.03, head.y + 0.02, head.z), fov: 22 };
    else v.menuShot = { pos: new V(hips.x + f * 1.5, hips.y + 0.35, hips.z + 2.6), target: new V(hips.x, hips.y + 0.2, hips.z), fov: 34 };
    window.__rb.debugAdvance(45);
  }, shot);
  files[shot] = [];
  for (const [i, p] of params.entries()) {
    await page.evaluate((p) => {
      const L = window.__rbLook;
      const def = (L.defaults ??= {
        sat: L.grade.sat.value, gain: L.grade.gain.value, tint: L.grade.tint.value.toArray(), neutral: L.neutral.value,
        amb: L.light.amb.value, ao: L.light.ao.value, key: L.light.keyCol.value.toArray(), keyDir: L.light.keyDir.value.toArray(),
      });
      const q = { ...def, ...p };
      L.grade.sat.value = q.sat;
      L.grade.gain.value = q.gain;
      L.grade.tint.value.fromArray(q.tint);
      L.neutral.value = q.neutral;
      L.light.amb.value = q.amb;
      L.light.ao.value = q.ao;
      L.light.keyCol.value.fromArray(q.key);
      L.light.keyDir.value.fromArray(q.keyDir).normalize();
      const rig = window.__rb.view.rigs[0];
      rig.root.traverse((o) => {
        const m = o.material;
        if (!o.isMesh || !m?.isMeshPhysicalMaterial) return;
        const d = (m.userData.look0 ??= { rough: m.roughness, spec: m.specularIntensity, env: m.envMapIntensity, normal: m.normalScale.x, aoI: m.aoMapIntensity });
        m.roughness = p.rough ?? d.rough;
        m.specularIntensity = p.spec ?? d.spec;
        m.envMapIntensity = p.env ?? d.env;
        m.normalScale.setScalar(p.normal ?? d.normal);
        m.aoMapIntensity = p.aoI ?? d.aoI;
      });
      if (p.rim) for (const r of [rig]) r.rim?.uRim.value.fromArray(p.rim);
      if (p.rimPow) rig.rim && (rig.rim.uRimPow.value = p.rimPow);
      window.__rb.debugAdvance(1);
    }, p);
    await page.evaluate(() => new Promise((res) => { let n = 0; const g = () => (++n >= 6 ? res() : requestAnimationFrame(g)); requestAnimationFrame(g); }));
    const file = `${out}_${shot}_${i}.png`;
    await page.screenshot({ path: file, timeout: 300000 });
    files[shot].push(file);
    console.log('shot', shot, i, JSON.stringify(p));
  }
}
console.log(errors.length ? `page errors: ${errors.slice(0, 3).join(' | ')}` : 'no page errors');
await browser.close();
// one sheet per shot (fight: the left half, where P1 stands)
for (const [shot, list] of Object.entries(files)) {
  const py = `
import sys
from PIL import Image, ImageDraw
fs = sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in fs]
if sys.argv[1] == 'fight':
    ims = [im.crop((int(im.width * 0.12), int(im.height * 0.22), int(im.width * 0.5), im.height)) for im in ims]
W, H = ims[0].size
cols = min(3, len(ims))
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (W * cols, H * rows), 'black')
for i, im in enumerate(ims):
    sheet.paste(im, ((i % cols) * W, (i // cols) * H))
    ImageDraw.Draw(sheet).text(((i % cols) * W + 8, (i // cols) * H + 8), str(i), fill='yellow')
sheet.save(fs[0].rsplit('_', 1)[0] + '_sheet.jpg', quality=88)
`;
  execFileSync('python3', ['-c', py, shot, ...list]);
  console.log('sheet', `${out}_${shot}_sheet.jpg`);
}
