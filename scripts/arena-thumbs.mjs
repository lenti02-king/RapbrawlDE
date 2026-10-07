// Arena select thumbnails: each arena in-game (post-processing on, fighters + HUD hidden) -> src/ui/img/arena-<id>.jpg
// Usage: node scripts/arena-thumbs.mjs [ids=podcast,toon,club,courtyard] [q=high]
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
const [, , ids = 'podcast,toon,club,courtyard', q = 'high'] = process.argv;
// BIG=1: 1672x941 backgrounds for the design-v2 arena screen (public/assets/ui2/arenas/<id>.webp, D42)
const big = !!process.env.BIG;
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const id of ids.split(',')) {
  const page = await browser.newPage({ viewport: big ? { width: 1672, height: 941 } : { width: 1280, height: 720 } });
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
  if (big) {
    execSync('mkdir -p public/assets/ui2/arenas');
    execSync(`python3 -c "from PIL import Image; Image.open('${png}').convert('RGB').save('public/assets/ui2/arenas/${id}.webp', 'WEBP', quality=84, method=6)"`);
  } else execSync(`convert ${png} -resize 800x450 -quality 82 src/ui/img/arena-${id}.jpg`);
  console.log('thumb', id);
  await page.close();
}
await browser.close();
