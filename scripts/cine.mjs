// Frame-accurate capture of a signature cinematic: pauses the sim and steps to chosen
// cinematic frames. Usage: node scripts/cine.mjs jazeek|bonez|volt|brick|croc [f1,f2,..]
// (croc = Bonez' Krokodil-Attacke, car = Tiefergelegt, blunt = Jazeek's Blunt für dich: specials put in slot 1; projectiles
// that start a cinematic on hit; blunt also shoots the rolling/lighting/blowing move frames)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const who = process.argv[2] ?? 'brick';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = `artifacts/cine_${who}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// D43 signatures/specials by fighter: sofa (Manuellsen), gwagon (Lacazette), 99 (Jazeek), team (Bonez)
const D43 = {
  sofa: { quick: 'manuellsen,lacazette', btn: 'S3', half: 6000 },
  gwagon: { quick: 'lacazette,manuellsen', btn: 'S3', half: 16000 },
  99: { quick: 'jazeek,bonez', btn: 'S3', half: 6000 },
  team: { quick: 'bonez,jazeek', btn: 'S3', half: 6000 },
}[who];
const blunt = who === 'blunt';
const croc = who === 'croc' || who === 'car' || blunt; // card specials (button S1)
const quick = D43?.quick ?? (who === 'brick' || who === 'volt' ? 'volt,brick' : 'jazeek,bonez');
await page.goto(`${base}/?quick=${quick}&mode=cpu&q=${process.env.Q ?? 'high'}`);
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 300000 });
const idx = D43 ? 0 : who === 'brick' || who === 'bonez' || (croc && !blunt) ? 1 : 0;
await page.evaluate(([idx, croc, who, d43]) => {
  const r = window.__rb.runner;
  r.paused = true;
  r.sources[0].poll = () => 0;
  r.sources[1].poll = () => 0;
  const s = r.state;
  const half = d43 ? d43.half : who === 'blunt' ? 5000 : croc ? 16000 : 6000; // the Blunt is a grab (D42)
  s.fighters[0].x = -half;
  s.fighters[1].x = half;
  s.fighters[idx].meter = 300;
  if (croc) s.fighters[idx].loadout[0] = who === 'car' ? 'bon_car' : who === 'blunt' ? 'jaz_blunt' : 'bon_croc';
  const src = r.sources[idx];
  // tap the signature button (every other frame) until the super flash starts
  let n = 0;
  const btn = d43 ? window.__rb.IN.S3 : croc ? window.__rb.IN.S1 : window.__rb.IN.S3;
  src.poll = () => (r.state.freeze > 0 || r.state.cine || r.state.fighters[idx].state === 'move' || n > 120 ? 0 : n++ % 2 === 0 ? btn : 0);
}, [idx, croc, who, D43 ?? null]);
const stepUntil = async (pred, max = 400, arg = null) => {
  for (let i = 0; i < max; i++) {
    const done = await page.evaluate(pred, arg);
    if (done) return true;
    await page.evaluate(() => window.__rb.runner.frame());
  }
  return false;
};
const files = [];
const snap = async (name) => {
  // let the render loop blend poses/camera/dim: wait for a number of rendered frames (SwiftShader is slow)
  await page.evaluate(() => new Promise((res) => { let n = 0; const f = () => (++n >= 10 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
  const f = `${out}/${name}.png`;
  await page.screenshot({ path: f, timeout: 180000 });
  files.push(f);
};
if (blunt && process.env.MOVE !== '0') {
  for (const mf of [4, 10]) {
    await stepUntil((mf) => window.__rb.runner.state.fighters[0].mf >= mf, 200, mf);
    await snap(`m${String(mf).padStart(2, '0')}`);
  }
}
if (blunt) {
  // the grab connects on frame 12
} else if (croc) {
  await stepUntil(() => window.__rb.runner.state.projectiles.length > 0);
  await snap('00_croc_out');
  await stepUntil(() => window.__rb.runner.state.projectiles[0]?.age >= 8 || !!window.__rb.runner.state.cine);
  await snap('01_croc_run');
} else {
  await stepUntil(() => window.__rb.runner.state.freeze > 20);
  await snap('00_flash');
}
const ok = await stepUntil(() => !!window.__rb.runner.state.cine);
console.log('cinematic started:', ok);
const FRAMES = {
  brick: [10, 30, 46, 56, 90, 118, 124, 134, 160],
  volt: [6, 18, 34, 48, 72, 96, 112, 118, 150],
  jazeek: [8, 20, 34, 52, 60, 70, 86, 97, 110, 121, 128, 146],
  bonez: [10, 24, 32, 52, 70, 76, 92, 108, 116, 119, 126, 150],
  croc: [4, 9, 14, 24, 35, 50, 57, 64, 72, 80, 86, 89, 92, 97, 104],
  car: [3, 8, 20, 32, 44, 50, 56, 70, 84, 88, 92, 98, 104, 112, 118],
  blunt: [8, 16, 26, 38, 50, 56, 64, 78, 84, 100, 114, 126, 132, 136, 144, 156],
  sofa: [6, 16, 26, 44, 66, 70, 88, 92, 112, 116, 122, 132, 148, 156],
  gwagon: [4, 16, 28, 40, 60, 74, 90, 108, 117, 124, 140, 160],
  99: [8, 20, 30, 34, 48, 58, 70, 82, 100, 112, 118, 136, 150],
  team: [12, 30, 48, 56, 62, 76, 84, 96, 120, 130, 140, 160],
};
const frames = (process.argv[3] ? process.argv[3].split(',').map(Number) : null) ?? FRAMES[who];
for (const f of frames) {
  await stepUntil((f) => (window.__rb.runner.state.cine?.frame ?? 999) >= f, 600, f);
  await snap(String(f).padStart(3, '0'));
}
await stepUntil(() => !window.__rb.runner.state.cine);
const st = await page.evaluate(() => window.__rb.runner.state.fighters.map((f) => ({ st: f.state, hp: f.health })));
console.log('after cinematic:', JSON.stringify(st));
await snap('999_after');
await browser.close();
execSync(`montage ${files.join(' ')} -tile 4x -geometry 480x270+2+2 -background '#111' ${out}/sheet.png`);
console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'no page errors', `${out}/sheet.png`);
