// Design v3 (S13b): dump the game's own fighter renders (bust, hero, card, card art) as PNGs for the Blender UI kit
// (tile art, avatars) -> .cache/ui3/portraits/<id>_<kind>.png. Dev server must run (BASE_URL).
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = '.cache/ui3/portraits';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${base}/?ui=v2&q=high`);
await page.waitForFunction(() => window.__rb, null, { timeout: 240000 });
await page.waitForTimeout(8000); // models arrive, portraits re-render
const shots = await page.evaluate(async () => {
  const P = await import('/src/ui/portraits.ts');
  const C = await import('/src/content/index.ts');
  const R = await import('/src/core/registry.ts');
  const res = {};
  for (const id of C.ROSTER) {
    const f = R.getFighter(id);
    const kinds = ['bust', 'hero', 'card', ...f.cards.map((c) => `art:${c.id}`)];
    P.renderPortraits([id], ['bust', 'hero', 'card'], true);
    for (const k of kinds) {
      const u = P.portrait(id, k);
      if (u) res[`${id}_${k.replace(':', '-')}`] = u;
    }
  }
  return res;
});
for (const [k, u] of Object.entries(shots)) fs.writeFileSync(`${out}/${k}.png`, Buffer.from(u.split(',')[1], 'base64'));
console.log(Object.keys(shots).length, 'renders ->', out);
await browser.close();
