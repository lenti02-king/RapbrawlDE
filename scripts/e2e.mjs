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
  page.setDefaultTimeout(120000); // software GL: ~1 s per frame at 720p, screenshots wait for one
  watchErrors(page, errors);
  await page.goto(base + '/?touch=0&q=low&ui=v1');
  await page.evaluate(() => localStorage.clear());
  await page.goto(base + '/?touch=0&q=low&ui=v1');
  await page.waitForSelector('.splash');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/d01_title.png` });
  await page.keyboard.press('Enter');
  await page.waitForSelector('.main-menu');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/d02_home.png` });
  check(await page.evaluate(() => window.__rb.mode === 'menu' && !window.__rb.runner), 'home screen is a plain menu (3D scene not running yet)');
  // KÄMPFER: view Bonez MC, make him the favourite (P1 at match start), adjust his abilities
  await page.click('[data-act="fighters"]');
  await page.waitForSelector('.kf-tile[data-f="bonez"]');
  await page.click('.kf-tile[data-f="bonez"]');
  await page.waitForSelector('.kf-tile.on[data-f="bonez"]');
  await page.click('[data-fav]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/d03_fighters.png` });
  check((await page.evaluate(() => JSON.parse(localStorage.getItem('rapbrawl.favFighter')))) === 'bonez', 'KÄMPFER sets Bonez MC as favourite');
  // abilities: swap special 2 (Abriss) for Rauchwand
  await page.click('[data-deck]');
  await page.waitForSelector('.collection [data-card="bon_smoke"]');
  await page.click('.collection [data-card="bon_smoke"]');
  await page.click('[data-use]');
  await page.click('.deck-slots [data-slot="1"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/d04_deck.png` });
  check(!(await page.isDisabled('[data-ok]')), 'legal 2+1 deck enables FERTIG');
  await page.click('[data-ok]');
  await page.waitForSelector('.kf-tile');
  await page.click('[data-back]');
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
  check(await page.evaluate(() => window.__rb.viewArena === window.__rb.sel.arena && ['festival', 'bahnhof', 'podcast', 'toon', 'club', 'courtyard'].includes(window.__rb.sel.arena)), 'drawn arena is used for the match');
  let s = await sim(page);
  check(JSON.stringify(s.f[0].loadout) === JSON.stringify(['bon_croc', 'bon_smoke', 'bon_team']), `chosen deck reaches the match (${s.f[0].loadout})`);
  check(await page.evaluate(() => window.__vsSeen), 'VS intro is shown at match start');
  const fullHp = s.f[1].hp;
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/d05_vs.png` });
  // round 1 opens with the fighter showcase (D39); a fresh LIGHT press skips it — tap J until the fight starts
  let skipped = false;
  for (let k = 0; k < 160 && !skipped; k++) {
    skipped = await page.evaluate(() => window.__rb.runner.state.phase === 'fight');
    if (skipped) break;
    await page.keyboard.down('KeyJ');
    await page.waitForTimeout(80);
    await page.keyboard.up('KeyJ');
    await page.waitForTimeout(600);
  }
  await page.waitForFunction(() => window.__rb.runner.state.phase === 'fight', null, { timeout: 60000 });
  check(true, 'fighter showcase skipped with J, fight starts');
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
    delete document.querySelector('.sig-ready').dataset.shown;
    s.fighters[0].meter = 300;
    s.fighters[0].x = s.fighters[1].x - 12000;
  });
  // the banner is a 2.4 s real-time tween; with SwiftShader frames of 2-4 s under load its opacity can be missed, so
  // the HUD stamps the moment it fires (data-shown) and the banner text must be the German one
  const banner = await page
    .waitForFunction(() => {
      const el = document.querySelector('.sig-ready');
      return !!el.dataset.shown && el.textContent.includes('SIGNATURE BEREIT');
    }, null, { timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  check(banner, '"SIGNATURE BEREIT!" banner appears when Hype is full');
  await page.screenshot({ path: `${out}/d07_sig_ready.png` });
  await page.keyboard.press('KeyO');
  const sig = await page
    .waitForFunction(() => window.__rb.runner.state.freeze > 0 || window.__rb.runner.state.fighters[0].move === 'bon_team', null, { timeout: 20000 })
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
    window.__rb.runner.speed = 8;
  });
  // KO slow-mo, the fatality window (FINISH_WINDOW, nobody plays the card), round over, match over (~600 sim frames)
  const resultsVisible = await page
    .waitForSelector('.result-banner', { timeout: 600000 }) // SwiftShader: ~2 s per rendered frame with the ink outlines (D43)
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
  await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 300000 });
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
  page.setDefaultTimeout(120000);
  watchErrors(page, errors);
  await page.goto(base + '/?q=low&ui=v1');
  await page.evaluate(() => localStorage.clear());
  await page.goto(base + '/?q=low&ui=v1');
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
  // the round-1 showcase: tap the skip area until the fight starts (touch skip = a Light press)
  for (let k = 0; k < 160; k++) {
    if (await page.evaluate(() => window.__rb.runner.state.phase === 'fight')) break;
    const skip = await page.$('.show-ui');
    if (skip && (await skip.isVisible())) await skip.tap().catch(() => {});
    await page.waitForTimeout(700);
  }
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

// ------------------------------------------------ design v4 flow (default, D47: the PO's street masters)
{
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(120000);
  watchErrors(page, errors);
  await page.goto(base + '/?touch=0&q=low');
  await page.evaluate(() => localStorage.clear());
  await page.goto(base + '/?touch=0&q=low');
  await page.waitForSelector('.splash');
  check(await page.evaluate(() => document.documentElement.dataset.design === 'v4'), 'design v4 is the default');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.v4-home.ready');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/w01_home.png` });
  // KÄMPFER: every fighter as a card, name + home town (S15)
  await page.click('.v4-home [data-act="fighters"]');
  await page.waitForSelector('.v4-fighters.ready');
  check((await page.locator('.v4-fighters [data-f]').count()) >= 4, 'v4 KÄMPFER shows every fighter as a card');
  const roster = await page.locator('.v4-fighters').innerText();
  check(['AACHEN', 'HAMBURG', 'BERLIN', 'MÜLHEIM AN DER RUHR'].every((c) => roster.includes(c)), 'v4 KÄMPFER: the home towns under the names');
  check(roster.includes('JAZEEK CARTOON') && (await page.locator('.v4-fighters [data-f="jazeektoon"]').count()) === 1, 'v4 KÄMPFER: Jazeek Cartoon (S16) has a card of his own');
  await page.waitForTimeout(800); // the screen fades in
  await page.screenshot({ path: `${out}/w02_fighters.png` });
  // Lacazette's card -> ANPASSEN (customise); AUSRÜSTEN makes him the favourite; back -> KÄMPFER -> home
  await page.click('.v4-fighters [data-f="lacazette"]');
  await page.click('.v4-fighters [data-act="custom"]');
  await page.waitForSelector('.v4-custom.ready [data-act="equip"]');
  check((await page.locator('.v4-custom').innerText()).includes('BERLIN'), 'v4 customise: the home town under the name');
  await page.click('.v4-custom [data-act="equip"]');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('rapbrawl.favFighter') ?? '""') === 'lacazette'), 'v4 customise: AUSRÜSTEN sets the favourite');
  await page.screenshot({ path: `${out}/w02_custom.png` });
  await page.click('.v4-custom [data-act="back"]');
  await page.waitForSelector('.v4-fighters.ready');
  await page.click('.v4-fighters [data-back]');
  await page.waitForSelector('.v4-home.ready');
  // ANPASSEN is a menu item of its own on the home screen
  await page.click('.v4-home [data-act="custom"]');
  await page.waitForSelector('.v4-custom.ready');
  check(true, 'v4 home: ANPASSEN opens the customising');
  await page.click('.v4-custom [data-act="back"]');
  await page.waitForSelector('.v4-home.ready');
  // FREUNDE -> lobby with a room code
  await page.click('.v4-home [data-act="social"]');
  await page.waitForSelector('.v4-lobby.ready');
  check(/RB-[A-Z]{4}/.test(await page.locator('.v4-lobby').innerText()), 'v4 lobby: shows a room code');
  await page.waitForTimeout(800); // the screen fades in
  await page.screenshot({ path: `${out}/w03_lobby.png` });
  await page.evaluate(() => window.__rb.showHome());
  await page.waitForSelector('.v4-home.ready');
  // FIGHT -> modes (1 VS 1 offline = vs CPU) -> select -> arena -> loading -> fight
  await page.click('.v4-home [data-act="fight"]');
  await page.waitForSelector('.v4-modes.ready');
  await page.click('.v4-modes [data-act="duel"]');
  await page.click('.v4-modes [data-act="offline"]');
  await page.screenshot({ path: `${out}/w04_modes.png` });
  await page.click('.v4-modes [data-act="next"]');
  await page.waitForSelector('.v4-select.ready');
  check((await page.locator('.v4-select [data-f]').count()) >= 4, 'v4 fighter select lists the whole roster');
  check(await page.evaluate(() => window.__rb.sel.fighters[0] === 'lacazette'), 'v4 select: P1 starts on the favourite');
  // both sides pick, the same fighter too: P1 picks -> the CPU opponent's turn -> P2 takes the same fighter
  await page.click('.v4-select [data-f="lacazette"]');
  await page.waitForSelector('.v4-select.ready .v4-pick.p2');
  check(true, 'v4 select: after P1 picks, P2 (CPU opponent) is picking');
  await page.click('.v4-select [data-f="lacazette"]');
  await page.waitForSelector('.v4-select.ready .v4-pick.p2');
  check(await page.evaluate(() => window.__rb.sel.fighters.join() === 'lacazette,lacazette'), 'v4 select: both sides can pick the same fighter (mirror match)');
  check((await page.locator('.v4-select').innerText()).includes('BERLIN'), 'v4 select: the home town under the name plates');
  await page.waitForTimeout(800); // the screen fades in
  await page.screenshot({ path: `${out}/w05_select.png` });
  await page.click('.v4-select [data-ready]');
  await page.waitForSelector('.v4-arena.ready [data-ok]');
  check((await page.locator('.v4-arena [data-item]').count()) >= 6, 'v4 arena select lists every arena (two pages)');
  await page.click('.v4-arena [data-more]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/w06_arena.png` });
  await page.click('.v4-arena [data-ok]');
  await page.waitForSelector('.v4-loading', { timeout: 60000 });
  await page.screenshot({ path: `${out}/w07_loading.png` });
  await page.waitForFunction(() => window.__rb.mode === 'cpu' && window.__rb.runner?.state, null, { timeout: 120000 });
  check(await page.evaluate(() => window.__rb.viewArena === window.__rb.sel.arena), 'v4 flow: the arena picked is built');
  // mirror match: both fighters are Lacazette (cel look), P2 told apart by the blue ink (PBR fighters: a blue rim light)
  const inks = await page.evaluate(() => {
    const st = window.__rb.runner.state;
    const mark = (i) => {
      // cel fighters: the ink hull's colour; PBR fighters (the Jazeek pair, S17): the rim light's colour
      const r = window.__rb.view.rigs[i];
      let c = null;
      r?.root.traverse((o) => {
        if (c === null && o.name.endsWith('_ink')) c = o.material.color.getHex();
      });
      return c ?? r?.rim?.uRim.value.getHexString() ?? null;
    };
    return { defs: st.fighters.map((f) => f.def).join(), p1: mark(0), p2: mark(1) };
  });
  check(inks.defs === 'lacazette,lacazette' && inks.p1 !== null && inks.p2 !== null && inks.p1 !== inks.p2, `v4 flow: mirror match starts, P2 has its own rim/outline colour (${JSON.stringify(inks)})`);
  check(errors.length === 0, `no page errors in the v4 flow (${errors.slice(0, 3).join(' | ')})`);
  await page.close();
}

// ------------------------------------------------ design v2 flow (D42; selectable in the settings)
{
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(120000);
  watchErrors(page, errors);
  await page.goto(base + '/?touch=0&q=low');
  await page.evaluate(() => localStorage.clear());
  await page.goto(base + '/?touch=0&q=low&ui=v2');
  await page.waitForSelector('.splash');
  check(await page.evaluate(() => document.documentElement.dataset.design === 'v2'), 'design v2 from ?ui=v2');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.v2-home.ready');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/v01_home.png` });
  await page.click('.v2-home [data-act="fight"]');
  await page.waitForSelector('.v2-select');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/v02_select.png` });
  check((await page.locator('.v2-select [data-f]').count()) >= 4, 'v2 fighter select lists the whole roster (incl. Manuellsen, Lacazette)');
  await page.click('.v2-select [data-ready]');
  await page.waitForSelector('.v2-arena [data-ok]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/v03_arena.png` });
  await page.click('.v2-arena [data-ok]');
  await page.waitForSelector('.v2-vs [data-act="ready"]', { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/v04_vs.png` });
  await page.click('.v2-vs [data-act="ready"]');
  await page.waitForSelector('.v2-loading');
  await page.screenshot({ path: `${out}/v05_loading.png` });
  await page.waitForFunction(() => window.__rb.mode === 'cpu' && window.__rb.runner?.state, null, { timeout: 120000 });
  check(await page.evaluate(() => window.__rb.viewArena === window.__rb.sel.arena), 'v2 flow: the arena picked on the VS screen is built');
  check(errors.length === 0, `no page errors in the v2 flow (${errors.slice(0, 3).join(' | ')})`);
  await page.close();
}

// ------------------------------------------------ design v2 ring screens (profile, settings, deck; D43)
{
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(120000);
  watchErrors(page, errors);
  await page.goto(base + '/?touch=0&q=low&ui=v2');
  await page.waitForFunction(() => window.__rb, null, { timeout: 240000 });
  await page.evaluate(() => window.__rb.showProfile());
  await page.waitForSelector('.v2-profilescreen.ready .rg-card');
  check((await page.locator('.v2-profilescreen .rg-card').count()) >= 8, 'v2 profile: player, rank, numbers, history and fighter cards');
  await page.screenshot({ path: `${out}/v06_profile.png` });
  await page.evaluate(() => window.__rb.showSettings());
  await page.waitForSelector('.v2-settingsscreen [data-toggle="blood"]');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('rapbrawl.blood') ?? 'true'));
  await page.click('.v2-settingsscreen [data-toggle="blood"]');
  await page.waitForSelector('.v2-settingsscreen [data-toggle="blood"]');
  check((await page.evaluate(() => JSON.parse(localStorage.getItem('rapbrawl.blood') ?? 'true'))) === !before, 'v2 settings: the BLUT switch toggles');
  await page.screenshot({ path: `${out}/v07_settings.png` });
  await page.evaluate(() => {
    window.__rb.sel.fighters[0] = 'bonez';
    window.__rb.sel.loadouts[0] = ['bon_croc', 'bon_lean', 'bon_team'];
    window.__rb.showDeck(0, () => window.__rb.showHome());
  });
  await page.waitForSelector('.v2-deckscreen [data-card="bon_smoke"]');
  await page.click('.v2-deckscreen [data-card="bon_smoke"]');
  await page.click('.v2-deckscreen [data-use]');
  await page.click('.v2-deckscreen [data-slot="1"]');
  await page.waitForTimeout(200);
  check((await page.evaluate(() => [...document.querySelectorAll('.v2-deckscreen [data-slot]')].map((e) => e.getAttribute('data-slot') && e.closest('.rg-slot')?.querySelector('.rg-dname')?.textContent))).includes('Rauchwand'), 'v2 deck: Rauchwand swapped into special 2');
  check(!(await page.isDisabled('.v2-deckscreen [data-act="ok"]')), 'v2 deck: a legal 2+1 deck enables FERTIG');
  await page.screenshot({ path: `${out}/v08_deck.png` });
  await page.click('.v2-deckscreen [data-act="ok"]');
  await page.waitForSelector('.v2-home');
  // a deck saved before S12 still names removed cards (bon_abriss): the editor falls back to the default deck
  await page.evaluate(() => {
    window.__rb.sel.loadouts[0] = ['bon_croc', 'bon_abriss', 'bon_team'];
    window.__rb.showDeck(0, () => window.__rb.showHome());
  });
  await page.waitForSelector('.v2-deckscreen [data-act="ok"]');
  check(!(await page.isDisabled('.v2-deckscreen [data-act="ok"]')), 'v2 deck: a stale saved deck (removed card) opens as the default deck');
  await page.click('.v2-deckscreen [data-act="ok"]');
  await page.waitForSelector('.v2-home');
  check(errors.length === 0, `no page errors on the v2 ring screens (${errors.slice(0, 3).join(' | ')})`);
  await page.close();
}

// ------------------------------------------------------- S16: Jazeek Cartoon plays with Jazeek's kit on its own model
{
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.setDefaultTimeout(120000);
  watchErrors(page, errors);
  await page.goto(base + '/?quick=jazeektoon,jazeek&mode=cpu&q=low');
  await page.waitForFunction(() => window.__rb?.runner?.state && window.__rb.view.rigs.length === 2, null, { timeout: 180000 });
  const info = await page.evaluate(() => {
    const st = window.__rb.runner.state;
    const rigs = window.__rb.view.rigs.map((r) => r.constructor.name + ':' + (r.model ? 'glb' : 'proc'));
    return { defs: st.fighters.map((f) => f.def).join(), deck: st.fighters[0].loadout?.join() ?? '', rigs };
  });
  check(info.defs === 'jazeektoon,jazeek' && info.rigs.every((r) => r.endsWith(':glb')), `S16: Jazeek Cartoon vs Jazeek starts with both 3D models (${JSON.stringify(info)})`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/s16_toon_vs_jazeek.png` });
  check(errors.length === 0, `no page errors with Jazeek Cartoon (${errors.slice(0, 3).join(' | ')})`);
  await page.close();
}

// ------------------------------------------------------- performance probe
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(120000); // software GL: ~1 s per frame at 720p, screenshots wait for one
  await page.goto(base + '/?quick=jazeek,bonez&q=low');
  await page.waitForFunction(() => window.__rb?.runner?.state, null, { timeout: 120000 });
  for (let k = 0; k < 200; k++) {
    if (await page.evaluate(() => window.__rb.runner.state.phase === 'fight')) break;
    await page.keyboard.press('KeyJ'); // skip the round-1 showcase
    await page.waitForTimeout(600);
  }
  await page.waitForFunction(() => window.__rb?.runner?.state.phase === 'fight', null, { timeout: 300000 });
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
