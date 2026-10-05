// Visual reach vs. sim hitbox for every move with a hitbox: at the first active frame, where are the fists/feet
// compared with the box (fighter at the origin facing +x, metres)? A strike should end near the box's far edge.
// Usage: node scripts/reach.mjs jazeek|bonez [moveKey,..]   (dev server must be running; uses the GLB models)
import { chromium } from 'playwright';

const [, , fighter = 'jazeek', only] = process.argv;
const other = fighter === 'bonez' ? 'jazeek' : 'bonez';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 200, height: 200 } });
await page.goto(`${process.env.BASE_URL ?? 'http://localhost:5173'}/?lab=poses&a=${fighter}&b=${other}&q=low${process.env.EXTRA ?? ''}`);
await page.waitForFunction(() => window.__lab?.reach, null, { timeout: 300000 });
const rows = await page.evaluate(
  ({ fighter, only }) => {
    const lab = window.__lab;
    const moves = lab.moveData(fighter);
    const U = 10000;
    const res = [];
    for (const [key, mv] of Object.entries(moves)) {
      if (only && !only.split(',').includes(key)) continue;
      const h = mv.hits?.[0];
      if (!h?.boxes?.length) continue;
      const b = h.boxes[0];
      const box = [b.x0 / U, b.x1 / U, b.y0 / U, b.y1 / U];
      const pos = lab.reach(0, `move:${key}:${h.start}`);
      // the limb point furthest forward inside the box's height band (+-0.15 m)
      let best = null;
      for (const [j, p] of Object.entries(pos)) {
        if (j === 'head') continue;
        const y = p[1] + (mv.air ? 0 : 0);
        if (y < box[2] - 0.15 || y > box[3] + 0.15) continue;
        if (!best || p[0] > best[1][0]) best = [j, p];
      }
      const all = Object.fromEntries(Object.entries(pos).map(([j, p]) => [j, p.map((v) => +v.toFixed(2))]));
      res.push({ key, start: h.start, air: !!mv.air, box: box.map((v) => +v.toFixed(2)), limb: best?.[0] ?? '-', at: best ? best[1].map((v) => +v.toFixed(2)) : null, all });
    }
    return res;
  },
  { fighter, only },
);
await browser.close();
for (const r of rows) {
  const d = r.at ? +(r.at[0] - r.box[1]).toFixed(2) : null;
  const tag = d === null ? 'NO LIMB IN BAND' : d > 0.12 ? `OVER +${d}` : d < -0.15 ? `SHORT ${d}` : `ok ${d}`;
  console.log(`${r.key.padEnd(16)} f${String(r.start).padEnd(3)} box x ${r.box[0]}..${r.box[1]} y ${r.box[2]}..${r.box[3]}  ${r.limb} @ ${r.at ? r.at.join(',') : '-'}  ${tag}${r.air ? ' (air)' : ''}`);
  if (process.env.ALL) console.log('    ', Object.entries(r.all).map(([j, p]) => `${j} ${p.join(',')}`).join(' | '));
}
