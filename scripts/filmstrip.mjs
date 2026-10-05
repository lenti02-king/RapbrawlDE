// Frame-by-frame film strips of a fighter's motion (moves, walk, jump, dash, reactions) for animation work.
// Usage: node scripts/filmstrip.mjs <fighter> <action[,action..]> [every=2] [quality=low] [frames]
//   action = move key (e.g. jaz_5L), walkF, walkB, jump, jumpF, dashF, dashB, crouch, idle, hit (P1 gets hit by P2's jab)
// Output: artifacts/film/<fighter>_<action>.png (tiles labelled with the frame number). Dev server must be running.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const [, , fighter = 'jazeek', actions = 'walkF', every = '2', q = 'low', framesArg] = process.argv;
const other = { jazeek: 'bonez', bonez: 'jazeek', volt: 'brick', brick: 'volt' }[fighter] ?? 'bonez';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = 'artifacts/film';
const tag = process.env.TAG ?? '';
fs.mkdirSync(`${out}/tmp`, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(`${base}/?quick=${fighter},${other}&mode=training&q=${q}${process.env.EXTRA ?? ''}`);
await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 600000 });
await page.evaluate(() => {
  window.__rb.debugHold = true;
  document.querySelectorAll('.hud, .training, .tr-panel, #ui > *').forEach((e) => e.style && e.style.setProperty('visibility', 'hidden'));
  if (new URLSearchParams(location.search).get('hb')) window.__rb.view.debug = true;
});

for (const action of actions.split(',')) {
  const isMove = await page.evaluate((a) => window.__rb.moveList(0).includes(a), action);
  const seqLen = action.startsWith('seq:') ? action.slice(4).split('.').reduce((a, t) => a + Number(t.split('*')[1] ?? 1), 0) : 0;
  const total = Number(framesArg ?? (isMove ? 0 : seqLen ? seqLen + 10 : action.startsWith('jump') ? 48 : action === 'hit' ? 30 : 40));
  const n = await page.evaluate(
    ({ action, isMove, total, GAP }) => {
      const rb = window.__rb;
      const r = rb.runner;
      const s = r.state;
      // reset both fighters to neutral, close range
      for (const [i, f] of s.fighters.entries()) {
        Object.assign(f, { state: 'idle', y: 0, vy: 0, vx: 0, move: null, mf: 0, hitstop: 0, crouching: false, sf: 0, timer: 0 });
        f.x = i ? GAP / 2 : -GAP / 2;
        f.facing = i ? -1 : 1;
        f.hp = f.maxHp ?? f.hp;
      }
      s.camX = 0;
      s.projectiles = [];
      r.sources[1].poll = () => 0;
      r.sources[0].poll = () => 0;
      rb.debugAdvance(12);
      if (isMove) {
        rb.freezeMove(0, action, 1);
        // freezeMove places the fighters for hitbox checks; keep close range
        s.fighters[0].x = -GAP / 2;
        s.fighters[1].x = GAP / 2;
      } else if (action === 'dashF' || action === 'dashB') {
        const b = action === 'dashF' ? rb.IN.RIGHT : rb.IN.LEFT;
        let k = 0;
        r.sources[0].poll = () => [b, 0, b][k++] ?? 0;
      } else if (action.startsWith('seq:')) {
        // input script: F/B/U/D directions, l light, h heavy, g grab, _ neutral; "*n" repeats, "+" combines (F+l), "." separates
        const map = { F: rb.IN.RIGHT, B: rb.IN.LEFT, U: rb.IN.UP, D: rb.IN.DOWN, l: rb.IN.LIGHT, h: rb.IN.HEAVY, g: rb.IN.GRAB, _: 0 };
        const frames = [];
        for (const tok of action.slice(4).split('.')) {
          const [code, n] = tok.split('*');
          const bits = code.split('+').reduce((a, c) => a | (map[c] ?? 0), 0);
          for (let k = 0; k < Number(n ?? 1); k++) frames.push(bits);
        }
        let k = 0;
        r.sources[0].poll = () => frames[k++] ?? 0;
      } else if (action === 'hit') {
        r.sources[1].poll = (() => {
          let k = 0;
          return () => (k++ < 2 ? rb.IN.LIGHT : 0);
        })();
      } else {
        const bits = { walkF: rb.IN.RIGHT, walkB: rb.IN.LEFT, jump: rb.IN.UP, jumpF: rb.IN.UP | rb.IN.RIGHT, crouch: rb.IN.DOWN, idle: 0 }[action] ?? 0;
        r.sources[0].poll = () => bits;
      }
      return total;
    },
    { action, isMove, total, GAP: Number(process.env.GAP ?? (action.startsWith('walk') || action.startsWith('dash') ? 34000 : action === 'hit' ? 11000 : 19000)) },
  );
  const name = process.env.NAME ?? action.replace(/[^a-zA-Z0-9_]+/g, '_').slice(0, 40);
  const len = isMove && !total ? (await page.evaluate((a) => window.__rb.moveTotal(0, a), action)) + 6 : n;
  const files = [];
  for (let f = 0; f < len; f++) {
    if (f % Number(every) === 0) {
      const file = `${out}/tmp/${fighter}${tag}_${name}_${String(f).padStart(3, '0')}.png`;
      // crop around P1 (left half of the close-range framing)
      const box = await page.evaluate(() => {
        const v = window.__rb.view;
        const p = v.screenOf?.(0);
        return p ?? null;
      });
      const clip = box ? { x: Math.max(0, Math.min(960 - 420, box.x - 210)), y: Math.max(0, Math.min(540 - 440, box.y - 300)), width: 420, height: 440 } : { x: 160, y: 60, width: 420, height: 440 };
      await page.screenshot({ path: file, timeout: 300000, ...(process.env.CROP === 'full' ? {} : { clip }) });
      files.push([file, f]);
    }
    await page.evaluate(() => window.__rb.debugAdvance(1));
  }
  const args = files.map(([file, f]) => `-label ${f} ${file}`).join(' ');
  const sheet = `${out}/${fighter}${tag}_${name}.png`;
  if (process.env.GIF) {
    // animated GIF at game speed (60 fps capture / every-n frames)
    const gif = `${out}/${fighter}${tag}_${name}.gif`;
    const crop = process.env.GIFCROP ? `-crop ${process.env.GIFCROP} +repage` : '';
    execSync(`convert -delay ${Math.round((100 / 60) * Number(every))} -loop 0 ${files.map(([f]) => f).join(' ')} ${crop} -resize ${process.env.GIFW ?? 360}x -layers Optimize ${gif}`);
    console.log('gif', gif);
  }
  execSync(`montage ${args} -tile ${Math.min(8, files.length)}x -geometry 210x220+1+1 -pointsize 14 -fill '#ffd65a' -background '#111' ${sheet}`);
  console.log('sheet', sheet, `${files.length} tiles`);
}
await browser.close();
