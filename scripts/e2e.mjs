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
  await page.goto(base + '/?touch=0&q=low');
  await page.evaluate(() => localStorage.clear());
  await page.goto(base + '/?touch=0&q=low');
  await page.waitForSelector('.splash');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/d01_title.png` });
  await page.keyboard.press('Enter');
  await page.waitForSelector('.main-menu');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/d02_home.png` });
  check(await page.evaluate(() => window.__rb.mode === 'menu' && !window.__rb.runner), 'home screen is a plain menu (3D scene not running yet)');
  // fighter select: pick Bonez MC
  await page.click('[data-act="fighters"]');
  await page.waitForSelector('.fcard[data-f="bonez"]');
  await page.click('.fcard[data-f="bonez"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/d03_fighters.png` });
  check((await page.evaluate(() => window.__rb.sel.fighters[0])) === 'bonez', 'fighter select picks Bonez MC');
  // deck (from the fighter screen): swap special 2 (Abriss) for Rauchwand
  await page.click('[data-todeck]');
  await page.waitForSelector('.collection [data-card="bon_smoke"]');
  await page.click('.collection [data-card="bon_smoke"]');
  await page.click('[data-use]');
  await page.click('.deck-slots [data-slot="1"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/d04_deck.png` });
  check(!(await page.isDisabled('[data-ok]')), 'legal 2+1 deck enables FERTIG');
  await page.click('[data-ok]');
  await page.waitForSelector('.fcard');
  await page.click('[data-ok]');
  await page.waitForSelector('.main-menu');
  await page.evaluate(() => {
    window.__vsSeen = false;
    new MutationObserver(() => {
      if (document.querySelector('.vs')) window.__vsSeen = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.click('[data-act="play"]');
  // new flow: Tekken-style fighter select -> arena select -> loading screen -> fight
  await page.waitForSelector('.st-select');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/d05a_select.png` });
  check((await page.textContent('.cs-name.p1')).includes('BONEZ') && (await page.isVisible('.mm-figures')), 'fighter select shows the chosen P1 fighter big on the left');
  await page.click('[data-ready]');
  await page.waitForSelector('.st-arena');
  await page.click('[data-item="club"]');
  await page.waitForSelector('.as-tile.on[data-item="club"]');
  await page.screenshot({ path: `${out}/d05b_arena.png` });
  await page.click('[data-ok]');
  await page.waitForSelector('.st-loading');
  await page.screenshot({ path: `${out}/d05c_loading.png` });
  await page.waitForFunction(() => window.__rb.mode === 'cpu', null, { timeout: 60000 });
  // vs CPU: the player's pick and the CPU's pick are drawn; the drawn arena must be the one that is built
  check(await page.evaluate(() => window.__rb.viewArena === window.__rb.sel.arena && ['podcast', 'toon', 'club', 'courtyard'].includes(window.__rb.sel.arena)), 'drawn arena is used for the match');
  let s = await sim(page);
  check(JSON.stringify(s.f[0].loadout) === JSON.stringify(['bon_croc', 'bon_smoke', 'bon_palm']), `chosen deck reaches the match (${s.f[0].loadout})`);
  check(await page.evaluate(() => window.__vsSeen), 'VS intro is shown at match start');
  const fullHp = s.f[1].hp;
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/d05_vs.png` });
  await page.waitForFunction(() => window.__rb.runner.state.phase === 'fight', null, { timeout: 60000 });
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
    s.fighters[0].x = s.fighters[1].x - 8000;
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
  // Signature: full Hype shows the banner, O fires it
  await page.waitForFunction(() => ['idle', 'crouch', 'walkF', 'walkB'].includes(window.__rb.runner.state.fighters[0].state), null, { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => {
    const s = window.__rb.runner.state;
    s.fighters[0].meter = 300;
    s.fighters[0].x = s.fighters[1].x - 12000;
  });
  const banner = await page
    .waitForFunction(() => Number(document.querySelector('.sig-ready').style.opacity) > 0.5, null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  check(banner, '"SIGNATURE BEREIT!" banner appears when Hype is full');
  await page.screenshot({ path: `${out}/d07_sig_ready.png` });
  await page.keyboard.press('KeyO');
  const sig = await page
    .waitForFunction(() => window.__rb.runner.state.freeze > 0 || window.__rb.runner.state.fighters[0].move === 'bon_palm', null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  check(sig, 'key O fires the Signature card');
  await page.waitForFunction(() => !window.__rb.runner.state.cine && window.__rb.runner.state.freeze === 0 && window.__rb.runner.state.fighters[0].state !== 'move', null, { timeout: 30000 }).catch(() => {});
  // pause menu
  await page.keyboard.press('Escape');
  await page.waitForSelector('.modal');
  check(await page.evaluate(() => window.__rb.runner.paused), 'Escape pauses the match');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/d08_pause.png` });
  await page.click('[data-a="resume"]');
  // force a fast match end and check results + rematch
  await page.evaluate(() => {
    const s = window.__rb.runner.state;
    s.fighters[0].roundsWon = 1;
    s.fighters[1].health = 0;
    window.__rb.runner.speed = 4;
  });
  const resultsVisible = await page
    .waitForSelector('.result-banner', { timeout: 150000 })
    .then(() => true)
    .catch(() => false);
  check(resultsVisible, 'match end shows results screen');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/d09_results.png` });
  if (resultsVisible) {
    check((await page.textContent('.result-banner')).includes('SIEG'), 'results show SIEG! for the winner');
    await page.click('[data-a="rematch"]');
    const fresh = await page
      .waitForFunction((hp) => window.__rb.runner.state.phase === 'intro' && window.__rb.runner.state.fighters[1].health === hp, fullHp, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    check(fresh, 'rematch restarts a fresh match');
  }
  // training mode with hitboxes
  await page.goto(base + '/?quick=bonez,jazeek&mode=training&q=low');
  await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 60000 });
  await page.keyboard.press('KeyH');
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(160);
  await page.screenshot({ path: `${out}/d10_training_hitboxes.png` });
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
  await page.goto(base + '/?q=low');
  await page.evaluate(() => localStorage.clear());
  await page.goto(base + '/?q=low');
  await page.waitForSelector('.splash');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/m01_title.png` });
  await page.tap('.splash button');
  await page.waitForSelector('.main-menu');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/m02_home.png` });
  await page.tap('[data-act="play"]');
  await page.waitForSelector('.st-select');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/m02a_select.png` });
  await page.tap('[data-ready]');
  await page.waitForSelector('.st-arena');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/m02b_arena.png` });
  await page.tap('[data-ok]');
  await page.waitForFunction(() => window.__rb.mode === 'cpu', null, { timeout: 60000 });
  await page.evaluate(() => {
    window.__rb.runner.sources[1].poll = () => 0; // freeze CPU for deterministic checks
  });
  await page.waitForFunction(() => window.__rb.runner.state.phase === 'fight', null, { timeout: 60000 });
  check(await page.isVisible('.touch .act-light'), 'touch controls visible on a phone');
  check(await page.isVisible('.hand.tap .hcard.sig'), 'golden Signature card is visible as a touch button');
  // drag the stick to the right using touch events
  const zone = await page.locator('.stick-zone').boundingBox();
  const x0 = (await sim(page)).f[0].x;
  const cdp = await ctx.newCDPSession(page);
  const sx = zone.x + 90;
  const sy = zone.y + zone.height * 0.6;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + i * 12, y: sy - i * 4, id: 1 }] });
  }
  const IN = await page.evaluate(() => window.__rb.IN);
  // wait for the sim to sample the stick (frames are slow in software GL)
  await page.waitForFunction((R) => (window.__rb.runner.lastInputs[0] & R) !== 0, IN.RIGHT, { timeout: 15000 }).catch(() => {});
  const bits = await page.evaluate(() => window.__rb.runner.lastInputs[0]);
  check((bits & IN.RIGHT) !== 0 && (bits & IN.UP) === 0, `stick 18° above horizontal walks without jumping (bits ${bits})`);
  await page.waitForFunction((x) => window.__rb.runner.state.fighters[0].x > x + 1000, x0, { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: `${out}/m03_touch_walk.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const x1 = (await sim(page)).f[0].x;
  check(x1 > x0, `touch stick walks forward (${x0} -> ${x1})`);
  // tap attack buttons
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
  await page.waitForFunction((hp) => window.__rb.runner.state.fighters[1].health < hp, hp0, { timeout: 20000 }).catch(() => {});
  const hp1 = (await sim(page)).f[1].hp;
  check(hp1 < hp0, `touch attack buttons deal damage (${hp0} -> ${hp1})`);
  // signature card with meter
  await page.waitForFunction(() => ['idle', 'crouch', 'walkF', 'walkB'].includes(window.__rb.runner.state.fighters[0].state), null, { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => {
    const s = window.__rb.runner.state;
    s.fighters[0].meter = 300;
    s.fighters[0].x = s.fighters[1].x - 15000;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/m04_sig_ready.png` });
  await page.tap('.hcard[data-slot="2"]');
  const flash = await page
    .waitForFunction(() => window.__rb.runner.state.freeze > 0 || window.__rb.runner.state.fighters[0].state === 'move', null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  check(flash, 'tapping the golden card triggers the Signature');
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
  await page.goto(base + '/?quick=jazeek,bonez&q=low');
  await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 60000 });
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
