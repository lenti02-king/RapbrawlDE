// Frame-accurate capture of the cartoon hit VFX (impact stars, speed lines, smears, puffs, cracks, impact frame).
// The real-time loop is held; every frame is stepped and rendered at a fixed 1/60 s, so captures are reproducible.
// Usage: node scripts/vfx.mjs [quality] [p1,p2]   (dev server must be running) -> artifacts/vfx/sheet.png
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const q = process.argv[2] ?? 'medium';
const pair = process.argv[3] ?? 'jazeek,bonez';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = `artifacts/vfx${process.argv[3] ? '_' + process.argv[3].split(',')[0] : ''}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(`${base}/?quick=${pair}&mode=cpu&q=${q}${process.env.EXTRA ?? ''}`);
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 240000 });
await page.evaluate(() => {
  const rb = window.__rb;
  rb.debugHold = true;
  document.querySelector('.announce')?.remove();
  const r = rb.runner;
  const snap = structuredClone(r.state);
  const queues = [[], []];
  r.sources[0].poll = () => queues[0].shift() ?? 0;
  r.sources[1].poll = () => queues[1].shift() ?? 0;
  const log = [];
  r.listeners.push({ onEvents: (s, ev) => ev.forEach((e) => log.push({ ...e, frame: s.frame })) });
  window.__cap = {
    reset(dist, hp2) {
      r.state = structuredClone(snap);
      const [a, b] = r.state.fighters;
      a.x = -Math.round((dist * 10000) / 2);
      b.x = Math.round((dist * 10000) / 2);
      r.state.camX = 0;
      if (hp2) b.health = hp2;
      queues[0].length = 0;
      queues[1].length = 0;
      log.length = 0;
      rb.debugAdvance(20, false);
    },
    input(p, seq) {
      queues[p].push(...seq);
    },
    /** step until an event of type t (by player a / p if given) occurred, then k more frames; returns frames stepped */
    until(t, k = 0, max = 120) {
      let n = 0;
      while (n < max && !log.some((e) => e.t === t)) {
        rb.debugAdvance(1);
        n++;
      }
      rb.debugAdvance(k);
      return n + k;
    },
    step(n) {
      rb.debugAdvance(n);
    },
  };
});
const IN = await page.evaluate(() => ({ ...window.__rb.IN }));
const files = [];
const shot = async (name) => {
  await page.waitForTimeout(120);
  const file = `${out}/${name}.png`;
  await page.screenshot({ path: file });
  files.push(file);
  console.log('shot', name);
};

// 1) heavy punch: star pop + speed lines, then the collapse
await page.evaluate(() => __cap.reset(1.0));
await page.evaluate((b) => __cap.input(0, [b]), IN.HEAVY);
await page.evaluate(() => __cap.until('hit', 1));
await shot('01_heavy_hit_f1');
await page.evaluate(() => __cap.step(9));
await shot('02_heavy_hit_f10');

// 2) L·L·L: smear on the Drehkick
await page.evaluate(() => __cap.reset(0.9));
await page.evaluate((L) => __cap.input(0, [L, ...Array(8).fill(0), L, ...Array(8).fill(0), L]), IN.LIGHT);
await page.evaluate(() => {
  // wait for the third move (Drehkick) to become active
  const r = window.__rb.runner;
  for (let i = 0; i < 90; i++) {
    window.__rb.debugAdvance(1);
    const f = r.state.fighters[0];
    if (f.move === 'jaz_LLL' && f.mf >= 9) break;
  }
});
await shot('03_LLL_smear');
console.log(
  'smears',
  JSON.stringify(await page.evaluate(() => window.__rb.view.toon.smears.map((s) => ({ f: s.fighter, live: +s.live.toFixed(3), n: s.pts.length, vis: s.mesh.visible, limb: s.limb })))),
);

// 3) H·H Encore-Haken: big hit, then knockdown dust + ground crack
await page.evaluate(() => __cap.reset(0.9));
await page.evaluate((H) => __cap.input(0, [H, ...Array(13).fill(0), H]), IN.HEAVY);
await page.evaluate(() => {
  const r = window.__rb.runner;
  for (let i = 0; i < 90; i++) {
    window.__rb.debugAdvance(1);
    const f = r.state.fighters[0];
    if (f.move === 'jaz_HH' && f.mf >= 8) break;
  }
  window.__rb.debugAdvance(1);
});
await shot('04_HH_hit');
await page.evaluate(() => __cap.until('knockdown', 2));
await shot('05_knockdown_crack');

// 4) block
await page.evaluate(() => __cap.reset(1.0));
await page.evaluate(([H, B]) => {
  __cap.input(0, [H]);
  __cap.input(1, Array(40).fill(B));
}, [IN.HEAVY, IN.BLOCK]);
await page.evaluate(() => __cap.until('block', 1));
await shot('06_block');

// 5) throw
await page.evaluate(() => __cap.reset(0.8));
await page.evaluate((G) => __cap.input(0, [G]), IN.GRAB);
await page.evaluate(() => __cap.until('throwHit', 3));
await shot('07_throw');

// 6) KO: impact frame, then the star + rubble
await page.evaluate(() => __cap.reset(1.0, 20));
await page.evaluate((H) => __cap.input(0, [H]), IN.HEAVY);
await page.evaluate(() => __cap.until('ko', 0));
await page.evaluate(() => window.__rb.debugAdvance(1, false));
await shot('08_ko_impact_frame');
await page.evaluate(() => __cap.step(6));
await shot('09_ko_after');

// 7) ground decal, puffs and rubble in isolation (fighters apart)
await page.evaluate(() => __cap.reset(4.0));
await page.evaluate(() => {
  const t = window.__rb.view.toon;
  t.crack(0, 2);
  t.puff(0, 0, 8, 1, undefined, 0.3, 0.8);
  t.rubble(0, 0, 10, 3);
  window.__rb.debugAdvance(6);
});
await shot('10_crack_puff_rubble');
console.log(
  'crack',
  JSON.stringify(
    await page.evaluate(() => {
      const c = window.__rb.view.toon.cracks[0];
      const m = c.mesh.material;
      const wp = c.mesh.getWorldPosition(new c.mesh.position.constructor());
      return { vis: c.mesh.visible, life: c.life, t: c.t, op: m.opacity, img: m.map?.image?.width, wp: wp.toArray(), sc: c.mesh.scale.toArray(), parentVis: c.mesh.parent?.visible, layers: c.mesh.layers.mask };
    }),
  ),
);

// 8) whiffed normals: smear shapes (2 frames after the first active frame)
for (const [name, bits] of [
  ['5L', IN.LIGHT],
  ['5H', IN.HEAVY],
  ['2L', IN.LIGHT | IN.DOWN],
  ['2H', IN.HEAVY | IN.DOWN],
]) {
  await page.evaluate(() => __cap.reset(3.2));
  await page.evaluate(
    ([b, d]) => __cap.input(0, [b, ...Array(12).fill(d)]),
    [bits, bits & IN.DOWN],
  );
  await page.evaluate(() => {
    const f = window.__rb.runner.state.fighters[0];
    for (let i = 0; i < 40; i++) {
      window.__rb.debugAdvance(1);
      if (f.state === 'move' && window.__rb.view.toon.smears.some((s) => s.fighter === 0 && s.live > 0)) break;
    }
    window.__rb.debugAdvance(2);
  });
  await shot(`11_smear_${name}`);
}

await browser.close();
execSync(`montage ${files.join(' ')} -tile 4x -geometry 400x225+2+2 -background '#111' ${out}/sheet.png`);
console.log('sheet', `${out}/sheet.png`);
