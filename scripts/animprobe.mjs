// Animation glitch probe (S13): runs seeded bot-vs-bot matches through the real game loop (sim -> animator -> GLB rig,
// cinematics included) WITHOUT drawing, records the world position of the key joints every frame and reports what
// reads as a glitch: pops (a joint's acceleration spikes), transition snaps (spikes right after an animation change),
// feet through the floor or floating in standing states, sliding feet while standing.
// Usage: node scripts/animprobe.mjs [fighters=jazeek,bonez] [frames=3000] [seed=7] [out=artifacts/probe]
//        SHOTS=1200,1450 node scripts/animprobe.mjs ...   also renders a frame strip (-6..+6) around those frames
//        CINE=sofa|gwagon|99|team|blunt node scripts/animprobe.mjs x 900   starts that signature/special at once and
//        records it (the pair comes from the cinematic; frames count from the trigger)
// Dev server must be running (BASE_URL, default :5173).
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const CINES = {
  sofa: { quick: 'manuellsen,lacazette', btn: 'S3', half: 6000 },
  gwagon: { quick: 'lacazette,manuellsen', btn: 'S3', half: 16000 },
  99: { quick: 'jazeek,bonez', btn: 'S3', half: 6000 },
  team: { quick: 'bonez,jazeek', btn: 'S3', half: 6000 },
  blunt: { quick: 'jazeek,bonez', btn: 'S1', half: 5000, card: 'jaz_blunt' },
};
const cineDef = CINES[process.env.CINE ?? ''];
const argv = process.argv.slice();
if (cineDef) argv[2] = cineDef.quick;
const [, , pair = 'jazeek,bonez', framesArg = '3000', seedArg = '7', outArg] = argv;
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const N = Number(framesArg);
const out = outArg ?? (cineDef ? `artifacts/probe/cine_${process.env.CINE}` : `artifacts/probe/${pair.replace(',', '_')}_${seedArg}`);
fs.mkdirSync(out, { recursive: true });
const shots = (process.env.SHOTS ?? '').split(',').filter(Boolean).map(Number);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/?quick=${pair}&mode=${cineDef ? 'cpu' : 'demo'}&q=low&hold=1&seed=${seedArg}`, { timeout: 300000 });
await page.waitForFunction(() => window.__rb?.runner?.state && window.__rb.view.rigs.length === 2, null, { timeout: 300000 });
await page.waitForTimeout(1500);

// CINE: both stand still, then P1 (meter full, card in slot 1 for specials) taps the button until it starts
const setupCine = (pg) =>
  cineDef &&
  pg.evaluate((d) => {
    const app = window.__rb;
    app.debugHold = true;
    const r = app.runner;
    r.sources[0].poll = () => 0;
    r.sources[1].poll = () => 0;
    for (let i = 0; i < 240 && !r.state.fighters.every((f) => f.state === 'idle' && f.y === 0); i++) app.debugAdvance(1);
    const s = r.state;
    s.fighters[0].x = -d.half;
    s.fighters[1].x = d.half;
    s.fighters[0].meter = 300;
    if (d.card) s.fighters[0].loadout[0] = d.card;
    let n = 0;
    const btn = app.IN[d.btn];
    r.sources[0].poll = () => (r.state.freeze > 0 || r.state.cine || r.state.fighters[0].state === 'move' || n > 120 ? 0 : n++ % 2 === 0 ? btn : 0);
  }, cineDef);
await setupCine(page);

const JOINTS = ['hips', 'chest', 'head', 'haL', 'haR', 'elL', 'elR', 'knL', 'knR', 'ftL', 'ftR'];
// record in chunks (keeps each evaluate short)
const rec = [];
for (let start = 0; start < N; start += 200) {
  const n = Math.min(200, N - start);
  const chunk = await page.evaluate(
    ({ n, JOINTS, start, shotList }) => {
      const app = window.__rb;
      app.debugHold = true;
      const view = app.view;
      const post = view.post;
      if (!post.__real) post.__real = post.render.bind(post);
      const res = [];
      for (let i = 0; i < n; i++) {
        const fr = start + i;
        post.render = shotList.includes(fr) ? post.__real : () => {};
        app.debugAdvance(1);
        const s = app.runner.state;
        const row = { f: fr, phase: s.phase, cine: s.cine ? `${s.cine.id}:${s.cine.frame}` : s.fatal ? `fatal:${s.fatal.frame}` : null, F: [] };
        for (let k = 0; k < 2; k++) {
          const rig = view.rigs[k];
          const an = view.anims[k];
          const f = s.fighters[k];
          rig.root.updateMatrixWorld(true);
          const P = {};
          for (const j of JOINTS) {
            const v = rig.joints[j].getWorldPosition(new rig.root.position.constructor());
            P[j] = [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];
          }
          let sole = Infinity;
          for (const b of rig.soles ?? []) sole = Math.min(sole, b.getWorldPosition(new rig.root.position.constructor()).y);
          row.F.push({ df: an.drawFacing, key: an.key, st: f.state, mv: f.move ?? null, mf: f.mf, sf: f.sf, hs: f.hitstop, y: f.y, vis: rig.root.visible, sole: +sole.toFixed(4), R: [+rig.root.position.x.toFixed(4), +rig.root.position.y.toFixed(4), 0], P });
        }
        res.push(row);
      }
      return res;
    },
    { n, JOINTS, start, shotList: [] },
  );
  rec.push(...chunk);
}
fs.writeFileSync(`${out}/rec.json`, JSON.stringify(rec));

// ---------------------------------------------------------------- analysis
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const LIMB = new Set(['haL', 'haR', 'ftL', 'ftR', 'elL', 'elR', 'knL', 'knR']);
const STAND = new Set(['idle', 'walkF', 'walkB', 'guard', 'crouch', 'blockstun']);
const pops = [];
const bounces = [];
const teleports = [];
const trans = [];
const feet = [];
for (let k = 0; k < 2; k++) {
  // each model's own sole height at rest (big shoes sit higher): the 10th percentile while standing
  const soles = rec.map((r) => r.F[k]).filter((F) => STAND.has(F.st) && F.y === 0 && Number.isFinite(F.sole)).map((F) => F.sole).sort((a, b) => a - b);
  const base = soles.length ? soles[Math.floor(soles.length * 0.1)] : 0;
  for (let t = 2; t < rec.length; t++) {
    const A = rec[t - 2].F[k];
    const B = rec[t - 1].F[k];
    const C = rec[t].F[k];
    if (!A.vis || !B.vis || !C.vis) continue;
    // a facing swap mirrors the rig: left and right joints trade names (the turn blends into the mirrored pose first)
    if (A.df !== B.df || B.df !== C.df) continue;
    // body-relative motion (the root moving with the sim is not a pose glitch): joints relative to the hips
    let worst = { j: '', a: 0 };
    for (const j of JOINTS) {
      // hips relative to the fighter's root (the sim moving them is not a pose glitch), the rest relative to the hips
      const rel = (R) => (j === 'hips' ? sub(R.P.hips, R.R) : sub(R.P[j], R.P.hips));
      const v1 = sub(rel(B), rel(A));
      const v2 = sub(rel(C), rel(B));
      const acc = len(sub(v2, v1));
      const lim = j === 'hips' ? 0.05 : LIMB.has(j) ? 0.14 : 0.07;
      const score = acc / lim;
      if (score > worst.a) worst = { j, a: score, acc };
    }
    // the two signatures of a real glitch: a joint that shoots out and comes straight back (direction reversal at
    // speed), and a teleport (faster than a body can move: limbs > 0.3 m/frame relative to the hips = 18 m/s)
    for (const j of JOINTS) {
      const rel = (R) => (j === 'hips' ? sub(R.P.hips, R.R) : sub(R.P[j], R.P.hips));
      const v1 = sub(rel(B), rel(A));
      const v2 = sub(rel(C), rel(B));
      const s1 = len(v1);
      const s2 = len(v2);
      const lim = j === 'hips' ? 0.06 : 0.09;
      const dot = (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / Math.max(1e-9, s1 * s2);
      if (s1 > lim && s2 > lim && dot < -0.3 && C.hs === 0) bounces.push({ fighter: k, f: rec[t].f, j, key: C.key, from: A.key, s: +Math.min(s1, s2).toFixed(3), cine: rec[t].cine });
      const tel = j === 'hips' ? 0.16 : 0.3;
      if (s2 > tel && !(B.vis !== C.vis)) teleports.push({ fighter: k, f: rec[t].f, j, key: C.key, from: B.key, s: +s2.toFixed(3), cine: rec[t].cine });
    }
    const keyChange = B.key !== C.key || A.key !== B.key;
    const ev = { fighter: k, f: rec[t].f, j: worst.j, score: +worst.a.toFixed(2), acc: +(worst.acc ?? 0).toFixed(3), from: A.key, key: C.key, st: C.st, mv: C.mv, mf: C.mf, sf: C.sf, hs: C.hs, cine: rec[t].cine };
    if (worst.a > 1) pops.push(ev);
    if (keyChange) trans.push(ev);
    // feet
    if (STAND.has(C.st) && C.y === 0 && !rec[t].cine) {
      if (C.sole < Math.min(base, 0.02) - 0.03) feet.push({ ...ev, kind: 'through floor', sole: C.sole });
      if (C.sole > base + 0.04 && C.st !== 'walkF' && C.st !== 'walkB') feet.push({ ...ev, kind: 'floating', sole: C.sole });
      if (C.st === 'idle' || C.st === 'guard' || C.st === 'crouch')
        for (const fj of ['ftL', 'ftR']) {
          const d = len(sub(C.P[fj], B.P[fj]).map((x, i) => (i === 1 ? 0 : x)));
          if (C.P[fj][1] < 0.16 && B.st === C.st && d > 0.012) feet.push({ ...ev, kind: `slide ${fj}`, d: +d.toFixed(3) });
        }
    }
  }
}
pops.sort((a, b) => b.score - a.score);
const tr = trans.filter((e) => e.score > 0.6).sort((a, b) => b.score - a.score);
// group pops by animation key so one bad clip shows once with a count
const byKey = {};
for (const e of pops) {
  const g = (byKey[`${e.key}${e.cine ? ' [' + e.cine.split(':')[0] + ']' : ''}`] ??= { n: 0, max: 0, at: [] });
  g.n++;
  if (e.score > g.max) g.max = e.score;
  if (g.at.length < 4) g.at.push(`f${e.f}/P${e.fighter + 1} ${e.j} ${e.score}`);
}
function group(list) {
  const g = {};
  for (const e of list) {
    const k = `${e.key}${e.cine ? ' [' + e.cine.split(':')[0] + ']' : ''}${e.from !== e.key ? ' <- ' + e.from : ''}`;
    (g[k] ??= { n: 0, max: 0, at: [] }).n++;
    if (e.s > g[k].max) g[k].max = e.s;
    if (g[k].at.length < 3) g[k].at.push(`f${e.f}/P${e.fighter + 1} ${e.j} ${e.s}`);
  }
  return Object.entries(g).sort((a, b) => b[1].max - a[1].max);
}
const feetBy = {};
for (const e of feet) (feetBy[`${e.kind} @ ${e.key}`] ??= []).push(e.f);
const report = {
  pair,
  seed: seedArg,
  frames: rec.length,
  errors,
  popsTotal: pops.length,
  popsByAnim: Object.entries(byKey).sort((a, b) => b[1].max - a[1].max),
  worstTransitions: tr.slice(0, 25).map((e) => `f${e.f} P${e.fighter + 1} ${e.from} -> ${e.key} ${e.j} x${e.score}`),
  feet: Object.entries(feetBy).map(([k, v]) => `${k}: ${v.length} frames (e.g. ${v.slice(0, 5).join(',')})`),
  bounces: group(bounces),
  teleports: group(teleports),
};
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, popsByAnim: report.popsByAnim.slice(0, 30) }, null, 1));

if (shots.length) {
  // strip around each shot frame: re-run with screenshots
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p2.setDefaultTimeout(600000);
  await p2.goto(`${base}/?quick=${pair}&mode=${cineDef ? 'cpu' : 'demo'}&q=low&hold=1&seed=${seedArg}`, { timeout: 300000 });
  await p2.waitForFunction(() => window.__rb?.runner?.state && window.__rb.view.rigs.length === 2, null, { timeout: 300000 });
  await p2.waitForTimeout(1500);
  await setupCine(p2);
  let at = 0;
  for (const s0 of shots) {
    const files = [];
    for (let fr = s0 - 6; fr <= s0 + 6; fr++) {
      await p2.evaluate(
        ({ to, at }) => {
          const app = window.__rb;
          app.debugHold = true;
          const post = app.view.post;
          if (!post.__real) post.__real = post.render.bind(post);
          post.render = () => {};
          if (to - at > 1) app.debugAdvance(to - at - 1);
          post.render = post.__real;
          app.debugAdvance(1);
        },
        { to: fr + 1, at },
      );
      at = fr + 1;
      const f = `${out}/s${s0}_${String(fr).padStart(5, '0')}.png`;
      await p2.screenshot({ path: f });
      files.push(f);
    }
    // a tile per frame, cropped to the middle of the screen where the fighters are (CROP=x0,y0,x1,y1 to move it)
    const crop = (process.env.CROP ?? '370,170,910,720').split(',').join(' ');
    console.log(execSync(`python3 scripts/stripcrop.py ${out} ${s0} ${out}/strip_${s0}.jpg ${crop} 7`).toString().trim());
  }
}
await browser.close();
