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
for (const id of ids)
  execSync(`node scripts/glb-to-json.mjs public/assets/characters/${id}.glb ${path.join(out, 'assets/characters', id + '.gltf.json')} --external-images`, { stdio: 'inherit' });
// the Vite build copies public/ (incl. .glb and the gitignored test models); the Artifact gets none of that
fs.rmSync(path.join(out, 'test-models'), { recursive: true, force: true });
for (const dir of ['assets/characters', 'assets/arena/podcast'])
  if (fs.existsSync(path.join(out, dir))) for (const f of fs.readdirSync(path.join(out, dir))) if (f.endsWith('.glb')) fs.rmSync(path.join(out, dir, f));
// podcast arena: geometry as .gltf.json, baked textures and meta as they are
const arenaDir = path.join(out, 'assets/arena/podcast');
fs.mkdirSync(arenaDir, { recursive: true });
for (const f of fs.readdirSync('public/assets/arena/podcast')) {
  if (f.endsWith('.glb')) execSync(`node scripts/glb-to-json.mjs public/assets/arena/podcast/${f} ${path.join(arenaDir, f.replace(/\.glb$/, '.gltf.json'))}`, { stdio: 'inherit' });
  else fs.copyFileSync(path.join('public/assets/arena/podcast', f), path.join(arenaDir, f));
}
const big = [];
for (const dir of ['assets/characters', 'assets/arena/podcast', '.'])
  for (const f of fs.readdirSync(path.join(out, dir))) {
    const st = fs.statSync(path.join(out, dir, f));
    if (st.isFile() && st.size > 15e6) big.push(`${dir}/${f} ${(st.size / 1e6).toFixed(1)} MB`);
  }
if (big.length) {
  console.error('FAIL: files over the Artifact per-file limit (15 MB):', big);
  process.exit(1);
}

const CSP =
  "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' data: blob:; worker-src 'self' blob:";
const types = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(out, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  // like the Artifact host: .glb is not served
  if (!file.startsWith(out) || file.endsWith('.glb') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
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
const fetched = new Set();
page.on('response', (r) => r.ok() && /\.(gltf\.json|jpg)$/.test(r.url()) && fetched.add(new URL(r.url()).pathname));
await page.goto(`http://localhost:${port}/rapbrawl.html?q=low`);
await page.waitForFunction(() => window.__models, null, { timeout: 120000 });
const models = await page.evaluate(() => window.__models);
await page.waitForFunction(() => window.__rb, null, { timeout: 120000 });
await page.evaluate(() => window.__rb.showFighters(0));
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(out, 'artifact-check.png') });
// the arena (geometry + baked textures) must load too
await page.goto(`http://localhost:${port}/rapbrawl.html?q=low&quick=jazeek,bonez&mode=training`);
const arenaOk = await page
  .waitForFunction(
    () => {
      let n = 0;
      window.__rb?.view?.arena?.group?.traverse((o) => (n += o.isMesh && o.material?.map?.image ? 1 : 0));
      return n >= 3;
    },
    null,
    { timeout: 240000 },
  )
  .then(() => true)
  .catch(() => false);
await page.screenshot({ path: path.join(out, 'artifact-check-arena.png') });
await browser.close();
server.close();
const missing = ids.filter((id) => !models.includes(id));
console.log('models loaded under CSP:', models.join(', ') || '(none)');
if (errors.length) console.log('console errors:', errors);
console.log('podcast arena loaded under CSP:', arenaOk);
console.log('model/arena files fetched:', [...fetched].sort().join(' '));
const notJson = ids.filter((id) => ![...fetched].some((f) => f.endsWith(`/${id}.gltf.json`)));
if (notJson.length) {
  console.error('FAIL: did not load the .gltf.json of', notJson.join(', '));
  process.exit(1);
}
if (!arenaOk) {
  console.error('FAIL: podcast arena did not load under the Artifact CSP');
  process.exit(1);
}
if (missing.length) {
  console.error('FAIL: models missing under the Artifact CSP:', missing.join(', '));
  process.exit(1);
}
console.log('OK — payload ready in', out, '(publish rapbrawl.html + every file under assets/)');
