// Converts a .glb into glTF JSON for hosts that do not serve .glb (e.g. the claude.ai Artifact).
// Usage: node scripts/glb-to-json.mjs in.glb out.gltf.json [--external-images]
//   default: one self-contained file (buffer as a data URI)
//   --external-images: every embedded image is written next to the JSON as <name>.<i>.jpg|png (its original bytes) and
//   referenced by a relative URI; the data-URI buffer keeps only the geometry. Keeps each file under the Artifact's
//   per-file limit for big textured models (the loader fetches the images as <img>, which the Artifact CSP allows).
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const external = args.includes('--external-images');
const [inp, out] = args.filter((a) => !a.startsWith('--'));
const b = fs.readFileSync(inp);
if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
let off = 12;
let json = null;
let bin = null;
while (off < b.length) {
  const len = b.readUInt32LE(off);
  const type = b.readUInt32LE(off + 4);
  const chunk = b.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
  else if (type === 0x004e4942) bin = chunk;
  off += 8 + len;
}
if (external && json.images?.length) {
  const stem = path.basename(out).replace(/\.gltf\.json$|\.json$/, '');
  const imageViews = new Set();
  json.images.forEach((img, i) => {
    if (img.bufferView === undefined) return;
    const bv = json.bufferViews[img.bufferView];
    const data = bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    const ext = img.mimeType === 'image/png' ? 'png' : 'jpg';
    const file = `${stem}.${i}.${ext}`;
    fs.writeFileSync(path.join(path.dirname(out), file), data);
    imageViews.add(img.bufferView);
    delete img.bufferView;
    img.uri = file;
  });
  // repack the remaining views (geometry, skin) into a compact buffer and renumber them
  const remap = new Map();
  const views = [];
  const parts = [];
  let len = 0;
  json.bufferViews.forEach((bv, i) => {
    if (imageViews.has(i)) return;
    const data = bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    const pad = (4 - (len % 4)) % 4;
    if (pad) parts.push(Buffer.alloc(pad));
    len += pad;
    remap.set(i, views.length);
    views.push({ ...bv, byteOffset: len });
    parts.push(data);
    len += data.length;
  });
  json.bufferViews = views;
  for (const a of json.accessors ?? []) {
    if (a.bufferView !== undefined) a.bufferView = remap.get(a.bufferView);
    if (a.sparse) {
      a.sparse.indices.bufferView = remap.get(a.sparse.indices.bufferView);
      a.sparse.values.bufferView = remap.get(a.sparse.values.bufferView);
    }
  }
  bin = Buffer.concat(parts);
  json.buffers[0].byteLength = bin.length;
}
json.buffers[0].uri = `data:application/octet-stream;base64,${bin.toString('base64')}`;
fs.writeFileSync(out, JSON.stringify(json));
const extra = external ? ` + ${json.images?.length ?? 0} image files` : '';
console.log(`wrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB${extra})`);
