// Captures of the classic screens in the master skin (Kämpfer, Karten, Profil, Einstellungen, Steuerung, Bestenliste,
// Pause, Ergebnis, Deck, Online-Lobby) on a phone in landscape. Usage: node scripts/screens.mjs [outDir] [w] [h]  (dev server running)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = process.argv[2] ?? 'artifacts/screens';
const vw = Number(process.argv[3] ?? 844);
const vh = Number(process.argv[4] ?? 390);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const shot = async (name) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}.png` });
};
const home = async () => {
  await page.evaluate(() => window.__rb.showHome());
  await page.waitForSelector('.main-menu');
};
await page.goto(`${base}/?touch=1&q=low`);
await page.waitForSelector('.splash', { timeout: 90000 });
await page.click('.splash button[data-default]');
await page.waitForSelector('.main-menu');
const only = process.env.ONLY?.split(',');
const want = (n) => !only || only.includes(n);
if (want('fighters')) {
  await page.click('[data-act="fighters"]');
  await page.waitForTimeout(500);
  await shot('fighters');
  await home();
}
if (want('profile')) {
  await page.click('[data-act="profile"]');
  await shot('profile');
  await home();
}
if (want('settings')) {
  await page.click('[data-act="settings"]');
  await shot('settings');
  await home();
}
if (want('leader')) {
  await page.click('[data-act="leader"]');
  await shot('leader');
  await home();
}
if (want('help')) {
  await page.evaluate(() => window.__rb.showHelp(() => window.__rb.showHome()));
  await shot('help');
  await home();
}
if (want('deck')) {
  await page.evaluate(() => window.__rb.showDeck(0, () => window.__rb.showHome()));
  await shot('deck');
  await home();
}
if (want('online')) {
  await page.evaluate(() => window.__rb.showOnlineLobby());
  await shot('online');
  await home();
}
if (want('pause')) {
  await page.goto(`${base}/?quick=jazeek,bonez&mode=cpu&q=low&touch=1`);
  await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 600000 });
  await page.evaluate(() => window.__rb.togglePause());
  await shot('pause');
  if (want('results')) {
    await page.evaluate(() => {
      window.__rb.togglePause();
      const s = window.__rb.runner.state;
      s.fighters[0].roundsWon = 1;
      s.fighters[1].health = 0;
      window.__rb.runner.speed = 8;
    });
    await page.waitForSelector('.result-banner', { timeout: 600000 });
    await shot('results');
  }
}
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('ok ->', out);
