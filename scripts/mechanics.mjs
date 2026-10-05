// Frame captures of the session 8 mechanics in the real game (2-player mode, scripted inputs, debug stepping).
// Usage: node scripts/mechanics.mjs duel|splat|fatality|fatality-bonez|beat [every=4] [q=low]
// Output: artifacts/mech/<scenario>.png (contact sheet) and .gif (GIF=1). Dev server must be running.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const [, , scenario = 'duel', every = '4', q = 'low'] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = 'artifacts/mech';
const tmp = `${out}/tmp/${process.pid}`;
fs.mkdirSync(tmp, { recursive: true });
const fighters = scenario === 'fatality-bonez' ? 'bonez,jazeek' : process.env.F ?? 'jazeek,bonez';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(`${base}/?quick=${fighters}&mode=local&q=${q}&touch=${process.env.TOUCH ?? 0}${process.env.EXTRA ?? ''}`);
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 600000 });
const total = await page.evaluate((scenario) => {
  const rb = window.__rb;
  rb.debugHold = true;
  const r = rb.runner;
  const s = r.state;
  const [a, b] = s.fighters;
  const IN = rb.IN;
  let k = 0;
  const idle = () => 0;
  r.sources[0].poll = idle;
  r.sources[1].poll = idle;
  const place = (ax, bx) => {
    for (const f of s.fighters) Object.assign(f, { state: 'idle', y: 0, vy: 0, vx: 0, move: null, mf: 0, hitstop: 0, sf: 0, timer: 0 });
    a.x = ax;
    b.x = bx;
    a.facing = 1;
    b.facing = -1;
    s.camX = Math.max(-75000 + 29000, Math.min(75000 - 29000, (ax + bx) / 2));
  };
  if (scenario === 'duel') {
    place(-5000, 5000);
    r.sources[0].poll = () => (k === 0 ? IN.HEAVY : s.duel && k % 3 === 0 ? IN.LIGHT : 0) | (k++, 0);
    r.sources[1].poll = () => (k === 1 ? IN.HEAVY : s.duel && k % 7 === 0 ? IN.LIGHT : 0);
    return 230;
  }
  if (scenario === 'splat') {
    place(75000 - 3000 - 13000, 75000 - 3000 - 3000);
    let pressed = false;
    r.sources[0].poll = () => {
      k++;
      if (k === 1) return IN.HEAVY;
      if (!pressed && a.state === 'move' && a.move?.endsWith('_5H') && a.connected === 'hit') return (pressed = true), IN.HEAVY;
      if (b.state === 'wallSplat' && a.state === 'idle') return IN.LIGHT;
      return 0;
    };
    return 130;
  }
  if (scenario.startsWith('fatality')) {
    place(-4000, 4000);
    a.roundsWon = s.config.roundsToWin - 1;
    b.health = 5;
    r.sources[0].poll = () => {
      k++;
      if (k === 1) return IN.LIGHT;
      if (s.phase === 'finish' && s.phaseFrame === 30) return IN.S3;
      return 0;
    };
    return 0;
  }
  if (scenario === 'beat') {
    place(-4000, 4000);
    r.sources[0].poll = () => (k++ % 20 === 0 ? IN.LIGHT : 0);
    return 120;
  }
  return 60;
}, scenario);
// fatality: skip ahead to the finish phase quickly, then film the fatality
if (scenario.startsWith('fatality')) {
  await page.evaluate(() => {
    const rb = window.__rb;
    for (let i = 0; i < 400 && !(rb.runner.state.phase === 'finish' && rb.runner.state.phaseFrame >= 26); i++) rb.debugAdvance(1);
  });
}
const frames = scenario.startsWith('fatality') ? Number(process.env.N ?? 320) : total;
const files = [];
for (let f = 0; f < frames; f++) {
  if (f % Number(every) === 0) {
    const file = `${tmp}/${String(f).padStart(4, '0')}.png`;
    await page.screenshot({ path: file, timeout: 300000 });
    const lbl = await page.evaluate(() => {
      const s = window.__rb.runner.state;
      return `${s.phase}${s.duel ? ' duel' + s.duel.frame : ''}${s.fatal ? ' fatal' + s.fatal.frame : ''} ${s.fighters.map((x) => x.state).join('/')}`;
    });
    files.push([file, `${f} ${lbl}`]);
  }
  await page.evaluate(() => window.__rb.debugAdvance(1));
}
await browser.close();
fs.mkdirSync(out, { recursive: true });
if (process.env.GIF) execSync(`convert -delay ${Math.round((100 / 60) * Number(every))} -loop 0 ${files.map(([f]) => f).join(' ')} -resize ${process.env.GIFW ?? 480}x -layers Optimize ${out}/${scenario}.gif`);
execSync(`montage ${files.map(([f, l]) => `-label '${l}' ${f}`).join(' ')} -tile 4x -geometry 400x225+2+2 -pointsize 12 -fill '#ffd65a' -background '#111' ${out}/${scenario}.png`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('sheet', `${out}/${scenario}.png`, files.length);
