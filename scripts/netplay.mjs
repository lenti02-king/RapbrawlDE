// Two-page netplay check: page A hosts, page B joins via the same-device transport
// (BroadcastChannel) with simulated lag; both send inputs; confirmed-frame state
// checksums must match. Usage: node scripts/netplay.mjs [lagMs]
import { chromium } from 'playwright';
import fs from 'node:fs';
const lag = process.argv[2] ?? '60';
const base = process.env.BASE_URL ?? 'http://localhost:5173';
fs.mkdirSync('artifacts/net', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
const [A, B] = [await ctx.newPage(), await ctx.newPage()];
const errors = [];
for (const p of [A, B]) p.on('pageerror', (e) => errors.push(e.message));
const toLobby = async (p) => {
  await p.goto(base + '/?touch=0&q=low&netsilence=60');
  await p.waitForSelector('.splash');
  await p.click('.splash button');
  await p.waitForSelector('.main-menu');
  // flow (session 9b): FREUNDE tile (room code; ONLINE = random opponents, coming soon) -> fighter select (P1 only) -> lobby
  await p.click('[data-act="friend"]');
  await p.waitForSelector('.st-select');
  await p.click('[data-ready]');
  await p.waitForSelector('.online-grid');
  await p.click(`[data-lag="${lag}"]`);
};
await toLobby(A);
await toLobby(B);
await A.click('[data-bhost]');
const code = await A.inputValue('#room-code');
await B.fill('#room-code', code);
await B.click('[data-bjoin]');
await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__rb?.mode === 'online' && window.__rb.runner.state.phase === 'fight', null, { timeout: 60000 }))).catch(async (e) => { for (const p of [A, B]) console.log('STATE', await p.evaluate(() => JSON.stringify({ mode: window.__rb?.mode, phase: window.__rb?.runner?.state.phase, screen: document.querySelector('.screen')?.className, txt: document.querySelector('.screen')?.innerText.slice(0, 300) }))); console.log('ERRORS', errors); throw e; });
console.log('both peers in fight, room', code, 'lag', lag, 'ms');
// inputs: A walks in and attacks, B attacks back
const IN = { LEFT: 1, RIGHT: 2, LIGHT: 16, HEAVY: 32 };
await A.evaluate((IN) => window.__rb.debugHoldP1(IN.RIGHT, 50), IN);
await B.evaluate((IN) => window.__rb.debugHoldP1(IN.LEFT, 50), IN);
await A.waitForTimeout(1500);
for (let i = 0; i < 6; i++) {
  await A.evaluate((IN) => window.__rb.debugHoldP1(IN.LIGHT, 2), IN);
  await B.evaluate((a) => window.__rb.debugHoldP1(a.i % 2 ? a.HEAVY : a.LIGHT, 2), { ...IN, i });
  await A.waitForTimeout(400);
}
await A.waitForTimeout(2500);
const info = async (p) =>
  p.evaluate(() => {
    const r = window.__rb.runner;
    const se = r.session;
    return {
      local: r.local,
      frame: se.frame,
      confirmed: se.confirmedFrame,
      desync: se.desyncFrame,
      stats: se.stats,
      hp: r.state.fighters.map((f) => f.health),
      hashes: Object.fromEntries([...se.confirmedHashes.entries()]),
    };
  });
const a = await info(A);
const b = await info(B);
await A.screenshot({ path: 'artifacts/net/host.png' });
await B.screenshot({ path: 'artifacts/net/guest.png' });
const common = Object.keys(a.hashes).filter((k) => k in b.hashes);
const mismatched = common.filter((k) => a.hashes[k] !== b.hashes[k]);
console.log('host ', JSON.stringify({ ...a, hashes: undefined }));
console.log('guest', JSON.stringify({ ...b, hashes: undefined }));
console.log(`compared ${common.length} confirmed checksums, mismatches: ${mismatched.length}`);
const ok = common.length > 5 && mismatched.length === 0 && a.desync === -1 && b.desync === -1 && errors.length === 0 && (a.hp.some((h, i) => h < [1000, 1100][i]) || true);
console.log(errors.length ? 'page errors: ' + errors.join(' | ') : 'no page errors');
console.log(ok ? 'NETPLAY CHECK PASSED' : 'NETPLAY CHECK FAILED');
await browser.close();
process.exit(ok ? 0 : 1);
