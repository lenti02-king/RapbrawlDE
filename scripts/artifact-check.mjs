// Builds the Artifact payload (single-file page + models as .gltf.json) and loads it under an Artifact-like CSP
// (relative fetches only: no data:/blob: in connect-src). Fails if the fighter models do not load there.
// Usage: node scripts/artifact-check.mjs [outDir]   (no dev server needed)
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? 'dist-single');
fs.mkdirSync(path.join(out, 'assets/characters'), { recursive: true });
execSync(`node scripts/single-file.mjs ${path.join(out, 'rapbrawl.html')}`, { stdio: 'inherit' });
const ids = ['jazeek', 'bonez'];
for (const id of ids) execSync(`node scripts/glb-to-json.mjs public/assets/characters/${id}.glb ${path.join(out, 'assets/characters', id + '.gltf.json')}`, { stdio: 'inherit' });

const CSP =
  "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' data: blob:; worker-src 'self' blob:";
const types = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const file = path.join(out, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(out) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  const headers = { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' };
  if (file.endsWith('.html')) headers['content-security-policy'] = CSP;
  res.writeHead(200, headers).end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text().slice(0, 200)));
await page.goto(`http://localhost:${port}/rapbrawl.html?q=low`);
await page.waitForFunction(() => window.__models, null, { timeout: 120000 });
const models = await page.evaluate(() => window.__models);
await page.waitForFunction(() => window.__rb, null, { timeout: 120000 });
await page.evaluate(() => window.__rb.showFighters(0));
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(out, 'artifact-check.png') });
await browser.close();
server.close();
const missing = ids.filter((id) => !models.includes(id));
console.log('models loaded under CSP:', models.join(', ') || '(none)');
if (errors.length) console.log('console errors:', errors);
if (missing.length) {
  console.error('FAIL: models missing under the Artifact CSP:', missing.join(', '));
  process.exit(1);
}
console.log('OK — payload ready in', out, '(publish rapbrawl.html + assets/characters/*.gltf.json)');
