"""The phones' high-quality fighter copy <id>.h.glb (S17): the full mesh, every texture capped at a side length.

Phones on GRAFIKQUALITÄT HOCH load it instead of the 40k-triangle <id>.m.glb (render/glbRig.ts). The textures are
shrunk here, offline, because a 4K image decoded on the phone and shrunk there costs ~80 MB for a moment (D41) - the
copy keeps the iPhone's character budget of 2048 (render/textureBudget.ts) without that spike. Everything else
(mesh, skin, morph targets, materials) is copied byte for byte.

  python3 tools/meshy/texcap.py public/assets/characters/jazeek.glb public/assets/characters/jazeek.h.glb [--max 2048]
"""
from __future__ import annotations

import argparse
import io
import json
import struct
import sys

from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('out')
    ap.add_argument('--max', type=int, default=2048)
    ap.add_argument('--quality', type=int, default=93)
    a = ap.parse_args()
    b = open(a.src, 'rb').read()
    jl = struct.unpack_from('<I', b, 12)[0]
    js = json.loads(b[20 : 20 + jl])
    off = 20 + jl
    bl = struct.unpack_from('<I', b, off)[0]
    bin_ = b[off + 8 : off + 8 + bl]
    views = [bytes(bin_[v.get('byteOffset', 0) : v.get('byteOffset', 0) + v['byteLength']]) for v in js['bufferViews']]
    for im in js.get('images', []):
        i = im['bufferView']
        img = Image.open(io.BytesIO(views[i]))
        if max(img.size) <= a.max:
            continue
        s = a.max / max(img.size)
        small = img.resize((round(img.size[0] * s), round(img.size[1] * s)), Image.LANCZOS)
        buf = io.BytesIO()
        if im['mimeType'] == 'image/png':
            small.save(buf, 'PNG', optimize=True)
        else:
            small.convert('RGB').save(buf, 'JPEG', quality=a.quality, subsampling=0)
        print(im.get('name'), img.size, '->', small.size, len(views[i]) // 1024, '->', buf.tell() // 1024, 'KB')
        views[i] = buf.getvalue()
    out = bytearray()
    for v, data in zip(js['bufferViews'], views):
        out.extend(b'\0' * ((-len(out)) % 4))
        v['byteOffset'] = len(out)
        v['byteLength'] = len(data)
        out.extend(data)
    out.extend(b'\0' * ((-len(out)) % 4))
    js['buffers'][0]['byteLength'] = len(out)
    jb = json.dumps(js, separators=(',', ':')).encode()
    jb += b' ' * ((-len(jb)) % 4)
    with open(a.out, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(out)))
        f.write(struct.pack('<II', len(jb), 0x4E4F534A))
        f.write(jb)
        f.write(struct.pack('<II', len(out), 0x004E4942))
        f.write(out)
    print('wrote', a.out, len(out) // 1024, 'KB')


if __name__ == '__main__':
    sys.exit(main())
