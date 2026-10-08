"""A 'blink' morph target for a rigged fighter GLB (S17, AAA pass: a face that never blinks reads dead in close-ups).

The eye openings come from MediaPipe landmarks on the model's front render (tools/meshy/facemarks.py on merge4's
'front' view, same as faceretouch.py). The upper lid - the skin between the lid margin and the brow - slides down to the
lower lid, strongest at the margin and fading out toward the brow (the crease), and moves 2 mm toward the camera so it
closes IN FRONT of the eyeball surface; the lower lid rises a little. Written as a sparse glTF morph target (only the
moved vertices are stored), name 'blink' in mesh.extras.targetNames; GlbRig drives it (render/glbRig.ts).

  python3 tools/meshy/blink.py fm.json <front render> public/assets/characters/jazeek.glb [more.glb ..] [--ortho 0,0.74,0.34,800]
"""
from __future__ import annotations

import argparse
import json
import struct
import sys

import numpy as np

EYE_R = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
EYE_L = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]
UPPER = {'R': [33, 246, 161, 160, 159, 158, 157, 173, 133], 'L': [263, 466, 388, 387, 386, 385, 384, 398, 362]}
LOWER = {'R': [33, 7, 163, 144, 145, 153, 154, 155, 133], 'L': [263, 249, 390, 373, 374, 380, 381, 382, 362]}
BROW_LOW = {'R': [46, 53, 52, 65, 55], 'L': [276, 283, 282, 295, 285]}


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def curve(pts):
    o = np.argsort(pts[:, 0])
    return pts[o, 0], pts[o, 1]


def read_glb(path):
    b = open(path, 'rb').read()
    jl = struct.unpack_from('<I', b, 12)[0]
    js = json.loads(b[20 : 20 + jl])
    off = 20 + jl
    bl = struct.unpack_from('<I', b, off)[0]
    return js, bytearray(b[off + 8 : off + 8 + bl])


def accessor(js, bb, i, n):
    a = js['accessors'][i]
    bv = js['bufferViews'][a['bufferView']]
    o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    return np.frombuffer(bytes(bb[o : o + a['count'] * 4 * n]), np.float32).reshape(a['count'], n)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('fm')
    ap.add_argument('render')
    ap.add_argument('glbs', nargs='+')
    ap.add_argument('--ortho', default='0,0.74,0.34,800')
    ap.add_argument('--forward', type=float, default=0.002, help='lid offset toward the camera when closed (m)')
    a = ap.parse_args()
    fm = json.load(open(a.fm))
    cx, cz, sc, px = (float(v) for v in a.ortho.split(','))
    P = np.array(fm[a.render]['image'])[:, :2]
    XZ = np.c_[cx + (P[:, 0] - px / 2) * sc / px, cz - (P[:, 1] - px / 2) * sc / px]
    for path in a.glbs:
        js, bb = read_glb(path)
        pr = js['meshes'][0]['primitives'][0]
        V = accessor(js, bb, pr['attributes']['POSITION'], 3)
        N = accessor(js, bb, pr['attributes']['NORMAL'], 3)
        x, z, front = V[:, 0], V[:, 1], V[:, 2]  # glTF: Y up, +Z toward the camera (Blender x, z, -y)
        D = np.zeros_like(V)
        moved = np.zeros(len(V), bool)
        for k in ('R', 'L'):
            ux, uz = curve(XZ[UPPER[k]])
            lx, lz = curve(XZ[LOWER[k]])
            bx, bz = curve(XZ[BROW_LOW[k]])
            x0, x1 = ux.min(), ux.max()
            zt = np.interp(x, ux, uz)
            zb = np.interp(x, lx, lz)
            zbr = np.interp(x, bx, bz)
            gap = np.maximum(zt - zb, 0)
            # the face's front surface around this eye
            near = (x > x0 - 0.004) & (x < x1 + 0.004) & (N[:, 2] > 0.15)
            zf = front[near & (z > zb - 0.01) & (z < zbr)]
            if len(zf) == 0:
                continue
            fz = np.percentile(zf, 90)
            surf = near & (front > fz - 0.02)
            xw = smoothstep(x0 - 0.003, x0 + 0.002, x) * (1 - smoothstep(x1 - 0.002, x1 + 0.003, x))
            # upper lid: margin (w = 1) up to 60 % of the way to the brow (w = 0)
            up = surf & (z > zt - 0.0008) & (z < zbr)
            w = (1 - smoothstep(zt, zt + 0.6 * np.maximum(zbr - zt, 0.002), z)) * xw * up
            D[:, 1] -= gap * 1.04 * w
            D[:, 2] += a.forward * np.sin(np.pi * np.clip(w, 0, 1) * 0.5) * (gap > 0.0005)
            # lower lid rises a little
            lo = surf & (z < zb + 0.0006) & (z > zb - 0.007)
            w2 = smoothstep(zb - 0.007, zb, z) * xw * lo
            D[:, 1] += gap * 0.2 * w2
            moved |= (w > 0.01) | (w2 > 0.01)
        idx = np.nonzero(moved)[0].astype(np.uint32)
        vals = D[idx].astype(np.float32)
        print(path, 'blink: moved verts', len(idx), 'max drop', round(float(-D[:, 1].min()) * 1000, 1), 'mm')
        # append sparse accessor data
        def add(data):
            pad = (-len(bb)) % 4
            bb.extend(b'\0' * pad)
            off = len(bb)
            bb.extend(data)
            js['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data)})
            return len(js['bufferViews']) - 1

        iv = add(idx.tobytes())
        vv = add(vals.tobytes())
        full_min = np.minimum(D.min(0), 0).tolist()
        full_max = np.maximum(D.max(0), 0).tolist()
        js['accessors'].append({'componentType': 5126, 'count': len(V), 'type': 'VEC3', 'min': full_min, 'max': full_max,
                                'sparse': {'count': len(idx), 'indices': {'bufferView': iv, 'componentType': 5125},
                                           'values': {'bufferView': vv}}})
        pr['targets'] = [{'POSITION': len(js['accessors']) - 1}]
        js['meshes'][0]['weights'] = [0.0]
        js['meshes'][0].setdefault('extras', {})['targetNames'] = ['blink']
        bb.extend(b'\0' * ((-len(bb)) % 4))
        js['buffers'][0]['byteLength'] = len(bb)
        jb = json.dumps(js, separators=(',', ':')).encode()
        jb += b' ' * ((-len(jb)) % 4)
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(bb)))
            f.write(struct.pack('<II', len(jb), 0x4E4F534A))
            f.write(jb)
            f.write(struct.pack('<II', len(bb), 0x004E4942))
            f.write(bb)


if __name__ == '__main__':
    sys.exit(main())
