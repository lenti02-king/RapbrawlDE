// End-to-end verification: runs against a dev/preview server (BASE_URL, default
// http://localhost:5173). Walks the menus on desktop, plays a fight with the
// keyboard, then repeats key checks on an emulated phone with touch input.
// Writes screenshots to artifacts/e2e and exits non-zero on failure.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = 'artifacts/e2e';
fs.mkdirSync(out, { recursive: true });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const browser = await chromium.launch({ args });
const failures = [];
const check = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures.push(msg);
};
const watchErrors = (page, list) => {
  page.on('pageerror', (e) => list.push(e.message));
  page.on('console', (m) => m.type() === 'error' && list.push(m.text()));
};
const sim = (page) =>
  page.evaluate(() => {
    const r = window.__rb.runner;
    const s = r.state;
    return { mode: window.__rb.mode, phase: s.phase, frame: s.frame, f: s.fighters.map((f) => ({ def: f.def, st: f.state, x: f.x, hp: f.health, meter: f.meter, loadout: f.loadout })) };
  });

// ------------------------------------------------------------ desktop flow
{
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  watchErrors(page, errors);
  await page.goto(base + '/');
  await page.waitForSelector('.title-screen');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/d01_title.png` });
  await page.keyboard.press('Enter');
  await page.waitForSelector('.menu');
  await page.screenshot({ path: `${out}/d02_menu.png` });
  check((await sim(page)).mode === 'demo', 'menu shows a live CPU-vs-CPU demo fight behind it');
  await page.click('[data-m="cpu"]');
  await page.waitForSelector('.fcard');
  await page.click('.fcard[data-f="volt"]');
  await page.screenshot({ path: `${out}/d03_select.png` });
  await page.click('[data-next]');
  await page.waitForSelector('.lcard');
  // build a non-default loadout: Stage Dive, Punchline, Headliner
  await page.click('[data-reset]');
  for (const id of ['volt_mic', 'volt_rush']) await page.click(`.lcard[data-c="${id}"]`); // unequip
  await page.click('.lcard[data-c="volt_dive"]');
  await page.click('.lcard[data-c="volt_counter"]');
  await page.screenshot({ path: `${out}/d04_loadout.png` });
  check(!(await page.isDisabled('[data-go]')), 'legal 3-card loadout enables FIGHT');
  await page.click('[data-go]');
  await page.waitForFunction(() => window.__rb.mode === 'cpu');
  let s = await sim(page);
  check(JSON.stringify(s.f[0].loadout) === JSON.stringify(['volt_headliner', 'volt_dive', 'volt_counter']), `chosen loadout reaches the match (${s.f[0].loadout})`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/d05_intro.png` });
  await page.waitForFunction(() => window.__rb.runner.state.phase === 'fight', null, { timeout: 20000 });
  // real keyboard input: walk forward, then attack
  const x0 = (await sim(page)).f[0].x;
  await page.keyboard.down('KeyD');
  await page.waitForFunction((x) => window.__rb.runner.state.fighters[0].x > x + 2000, x0, { timeout: 10000 }).catch(() => {});
  await page.keyboard.up('KeyD');
  const x1 = (await sim(page)).f[0].x;
  check(x1 > x0, `keyboard D walks forward (${x0} -> ${x1})`);
  // deterministic attack check: freeze the CPU and stand in jab range
  await page.evaluate(() => {
    const r = window.__rb.runner;
    r.sources[1].poll = () => 0;
    const s = r.state;
    s.fighters[1].state = 'idle';
    s.fighters[0].state = 'idle';
    s.fighters[0].x = s.fighters[1].x - 7000;
  });
  const hpBefore = (await sim(page)).f[1].hp;
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(200);
  }
  await page.keyboard.press('KeyK');
  await page.waitForFunction((hp) => window.__rb.runner.state.fighters[1].health < hp, hpBefore, { timeout: 10000 }).catch(() => {});
  await page.screenshot({ path: `${out}/d06_fight.png` });
  s = await sim(page);
  check(s.f[1].hp < hpBefore, `keyboard attacks deal damage (${hpBefore} -> ${s.f[1].hp})`);
  // pause menu
  await page.keyboard.press('Escape');
  await page.waitForSelector('.screen h2');
  const paused = await page.evaluate(() => window.__rb.runner.paused);
  check(paused, 'Escape pauses the match');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/d07_pause.png` });
  await page.click('[data-a="resume"]');
  // force a fast match end and check results + rematch
  await page.evaluate(() => {
    const s = window.__rb.runner.state;
    s.fighters[0].roundsWon = 1;
    s.fighters[1].health = 0;
  });
  const resultsVisible = await page
    .waitForSelector('.result-win', { timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  check(resultsVisible, 'match end shows results screen');
  await page.screenshot({ path: `${out}/d08_results.png` });
  if (resultsVisible) {
    await page.click('[data-a="rematch"]');
    const fresh = await page
      .waitForFunction(() => window.__rb.runner.state.phase === 'intro' && window.__rb.runner.state.fighters[1].health === 1100, null, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    check(fresh, 'rematch restarts a fresh match');
  }
  // training mode with hitboxes
  await page.goto(base + '/?quick=brick,volt&mode=training');
  await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 20000 });
  await page.keyboard.press('KeyH');
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(160);
  await page.screenshot({ path: `${out}/d09_training_hitboxes.png` });
  check(errors.length === 0, `no page errors on desktop (${errors.slice(0, 3).join(' | ')})`);
  await page.close();
}

// ------------------------------------------------------------- mobile flow
{
  const errors = [];
  // DPR 1 keeps software rendering fast enough; CSS layout is identical to the real device.
  const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'], deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  watchErrors(page, errors);
  await page.goto(base + '/');
  await page.waitForSelector('.title-screen');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/m01_title.png` });
  await page.tap('.title-screen button');
  await page.waitForSelector('.menu');
  await page.tap('[data-m="cpu"]');
  await page.waitForSelector('.fcard');
  await page.tap('[data-next]');
  await page.waitForSelector('.lcard');
  await page.screenshot({ path: `${out}/m02_loadout.png` });
  await page.tap('[data-go]');
  await page.waitForFunction(() => window.__rb.mode === 'cpu');
  await page.evaluate(() => {
    window.__rb.runner.sources[1].poll = () => 0; // freeze CPU for deterministic checks
  });
  await page.waitForFunction(() => window.__rb.runner.state.phase === 'fight', null, { timeout: 20000 });
  const touchVisible = await page.isVisible('.touch .act-light');
  check(touchVisible, 'touch controls visible on a phone');
  // drag the stick to the right using touch-like pointer events
  const zone = await page.locator('.stick-zone').boundingBox();
  const x0 = (await sim(page)).f[0].x;
  const cdp = await ctx.newCDPSession(page);
  const sx = zone.x + 90;
  const sy = zone.y + zone.height * 0.6;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + i * 12, y: sy, id: 1 }] });
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/m03_touch_walk.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const x1 = (await sim(page)).f[0].x;
  check(x1 > x0, `touch stick walks forward (${x0} -> ${x1})`);
  // tap attack buttons (multi-touch: hold stick + tap)
  await page.evaluate(() => {
    const s = window.__rb.runner.state;
    s.fighters[0].x = s.fighters[1].x - 8000;
  });
  const hp0 = (await sim(page)).f[1].hp;
  for (let i = 0; i < 3; i++) {
    await page.tap('.act-light');
    await page.waitForTimeout(250);
  }
  await page.tap('.act-heavy');
  await page.waitForFunction((hp) => window.__rb.runner.state.fighters[1].health < hp, hp0, { timeout: 10000 }).catch(() => {});
  const hp1 = (await sim(page)).f[1].hp;
  check(hp1 < hp0, `touch attack buttons deal damage (${hp0} -> ${hp1})`);
  // card button with meter
  await page.evaluate(() => {
    const s = window.__rb.runner.state;
    s.fighters[0].meter = 300;
    s.fighters[0].x = s.fighters[1].x - 15000;
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${out}/m04_cards_ready.png` });
  await page.tap('.card-btn[data-bit="S3"]');
  const flash = await page
    .waitForFunction(() => window.__rb.runner.state.freeze > 0 || window.__rb.runner.state.fighters[0].state === 'move', null, { timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  check(flash, 'touch card button triggers the signature special');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/m05_touch_super.png` });
  check(errors.length === 0, `no page errors on mobile (${errors.slice(0, 3).join(' | ')})`);
  // portrait shows rotate hint
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  check(await page.isVisible('.rotate-hint'), 'portrait phone shows rotate hint');
  await page.screenshot({ path: `${out}/m06_portrait.png` });
  await ctx.close();
}

// ------------------------------------------------------- performance probe
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(base + '/?quick=volt,brick');
  await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 20000 });
  const perf = await page.evaluate(
    () =>
      new Promise((res) => {
        const times = [];
        let last = performance.now();
        let n = 0;
        const f = () => {
          const t = performance.now();
          times.push(t - last);
          last = t;
          if (++n < 120) requestAnimationFrame(f);
          else {
            times.sort((a, b) => a - b);
            res({ median: times[60], p95: times[114], info: window.__rb.view.renderer.info.render });
          }
        };
        requestAnimationFrame(f);
      }),
  );
  console.log('PERF (SwiftShader software GL, not representative of phones):', JSON.stringify(perf));
  await page.close();
}

await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} FAILURE(S)`);
  process.exit(1);
}
console.log('\nALL E2E CHECKS PASSED');
