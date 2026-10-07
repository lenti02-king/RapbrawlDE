// Design v4 (D47): list the PO's artwork drop-ins (public/assets/ui4/art/**) for the game -> manifest.json.
// The screens show a file only when it is listed (no 404 probes). Run after adding/removing artwork files:
//   node scripts/art-manifest.mjs
import fs from 'node:fs';
import path from 'node:path';
const dir = 'public/assets/ui4/art';
const out = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(webp|png|jpe?g)$/i.test(e.name)) out.push(path.relative(dir, p).split(path.sep).join('/'));
  }
};
fs.mkdirSync(dir, { recursive: true });
walk(dir);
out.sort();
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`${out.length} artwork file(s) in ${dir}/manifest.json`);
