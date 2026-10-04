// Builds a single self-contained HTML file of the game (JS, CSS and fonts inlined)
// for hosts that serve one page without companion files (e.g. a claude.ai Artifact).
// Usage: node scripts/single-file.mjs <out.html>
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] ?? 'artifacts/rapbrawl-single.html';
const dir = 'dist-single';
execSync(`npx vite build --outDir ${dir} --emptyOutDir --assetsInlineLimit 100000000`, { stdio: 'inherit' });
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g)].map((m) => fs.readFileSync(path.join(dir, m[1]), 'utf8'));
const js = [...html.matchAll(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g)].map((m) => fs.readFileSync(path.join(dir, m[1]), 'utf8'));
if (!css.length || !js.length) throw new Error('could not find built assets in index.html');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '').trim();
const safeJs = js.join('\n').replace(/<\/script/gi, '<\\/script');
const page = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>RAPBRAWL</title>
<style>
${css.join('\n')}
</style>
${body}
<script type="module">
${safeJs}
</script>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
const ext = page.match(/(?:src|href)="https?:\/\/[^"]+"/g) ?? [];
console.log(`wrote ${out} (${(page.length / 1024).toFixed(0)} KB); external refs: ${ext.length ? ext.join(', ') : 'none'}`);
