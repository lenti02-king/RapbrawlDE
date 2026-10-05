// Arena select thumbnails: each arena in-game (post-processing on, fighters + HUD hidden) -> src/ui/img/arena-<id>.jpg
// Usage: node scripts/arena-thumbs.mjs [ids=podcast,toon,club,courtyard] [q=high]
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
const [, , ids = 'podcast,toon,club,courtyard', q = 'high'] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const id of ids.split(',')) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.goto(`${base}/?quick=jazeek,bonez&mode=training&arena=${id}&q=${q}`);
  await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 600000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    const rb = window.__rb;
    rb.debugHold = true;
    document.querySelectorAll('#ui > *').forEach((e) => e.style && e.style.setProperty('visibility', 'hidden'));
    if (!new URLSearchParams(location.search).get('keep')) rb.view.rigs.forEach((r) => (r.root.visible = false));
    rb.debugAdvance(2, false);
  });
  const png = `artifacts/arena_thumb_${id}.png`;
  await page.screenshot({ path: png, timeout: 300000 });
  execSync(`convert ${png} -resize 800x450 -quality 82 src/ui/img/arena-${id}.jpg`);
  console.log('thumb', id);
  await page.close();
}
await browser.close();
