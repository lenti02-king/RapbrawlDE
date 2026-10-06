// WebKit (WebKitGTK MiniBrowser via WebKitWebDriver) screenshots: the closest engine to iOS Safari available here
// (Playwright's WebKit download is blocked). Needs: apt install webkit2gtk-driver, Xvfb.
// Usage: node scripts/webkit.mjs "<path?query>" out.png [width] [height] [waitMs] [js-after-wait]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [, , path = '/', out = 'artifacts/webkit.png', w = '932', h = '430', wait = '4000', js = ''] = process.argv;
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const port = 4400 + Math.floor(Math.random() * 500);
const disp = `:${90 + Math.floor(Math.random() * 9)}`;
const xvfb = spawn('Xvfb', [disp, '-screen', '0', process.env.XSCREEN ?? '2600x1600x24'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const drv = spawn('WebKitWebDriver', [`--port=${port}`], { stdio: 'ignore', env: { ...process.env, DISPLAY: disp, GDK_SCALE: process.env.DPR ?? '1' } });
await new Promise((r) => setTimeout(r, 900));
const api = async (method, p, body) => {
  const r = await fetch(`http://127.0.0.1:${port}${p}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (j.value && j.value.error) throw new Error(`${p}: ${j.value.error} ${j.value.message}`);
  return j.value;
};
let sid = '';
try {
  const s = await api('POST', '/session', {
    capabilities: { alwaysMatch: { 'webkitgtk:browserOptions': { binary: '/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser', args: ['--automation'] } } },
  });
  sid = s.sessionId;
  await api('POST', `/session/${sid}/window/rect`, { width: +w, height: +h });
  await api('POST', `/session/${sid}/url`, { url: base + path });
  await new Promise((r) => setTimeout(r, +wait));
  if (js) {
    await api('POST', `/session/${sid}/execute/sync`, { script: js, args: [] });
    await new Promise((r) => setTimeout(r, +(process.env.AFTER ?? 1500)));
  }
  const info = await api('POST', `/session/${sid}/execute/sync`, { script: 'return [innerWidth, innerHeight, devicePixelRatio, navigator.userAgent, (window.__errs||[]).join(" | ")]', args: [] });
  console.log('viewport', JSON.stringify(info));
  const png = await api('GET', `/session/${sid}/screenshot`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(png, 'base64'));
  console.log('saved', out);
} catch (e) {
  console.error(String(e));
  process.exitCode = 1;
} finally {
  if (sid) await api('DELETE', `/session/${sid}`).catch(() => undefined);
  drv.kill();
  xvfb.kill();
}
