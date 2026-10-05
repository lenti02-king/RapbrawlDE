// Deck screen screenshots for both fighters (card art check): node scripts/cards.mjs -> artifacts/ui/cards_<fighter>.png
import { chromium } from 'playwright';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const f of ['jazeek', 'bonez']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${base}/?touch=0`);
  await page.evaluate((f) => {
    localStorage.clear();
    localStorage.setItem('rapbrawl.selection', JSON.stringify({ fighters: [f, f === 'jazeek' ? 'bonez' : 'jazeek'], mode: 'cpu', level: 'normal', arena: 'podcast' }));
  }, f);
  await page.goto(`${base}/?touch=0`);
  await page.waitForSelector('.splash');
  await page.click('.splash button[data-default]');
  await page.waitForSelector('.home');
  await page.click('[data-nav="deck"]');
  await page.waitForSelector('.collection');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `artifacts/ui/cards_${f}.png` });
  await page.close();
}
await browser.close();
console.log('ok');
