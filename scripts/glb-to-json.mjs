// Converts a .glb into a self-contained glTF JSON (buffer as data URI) for hosts that do not serve .glb
// (e.g. the claude.ai Artifact). Usage: node scripts/glb-to-json.mjs in.glb out.gltf.json
import fs from 'node:fs';

const [inp, out] = process.argv.slice(2);
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
json.buffers[0].uri = `data:application/octet-stream;base64,${bin.toString('base64')}`;
fs.writeFileSync(out, JSON.stringify(json));
console.log(`wrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
