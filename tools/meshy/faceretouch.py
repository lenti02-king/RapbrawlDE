"""Eye retouch in texel space after the PO's photos (S17: "er sieht stoned aus und übermüdet").

The merged sculpt's eyes read tired in every light: a near-black iris without colour, a grey sclera and matte eyes
that never catch a light. This works on the baked textures of a merge4.py result (.cache/meshy4/<fighter>_src.glb),
texel by texel (finer than merge4's per-vertex tint):
  - every face texel gets its 3D position (the triangles rasterised in UV space), so the eye opening found by
    MediaPipe on the model's front render (merge4 view 'front') is a polygon test per texel;
  - iris and sclera colours are MEASURED on the photos (median of the iris ring / of the visible white) and the
    texture's own detail is kept as a luminance ratio around them; the pupil stays dark, a soft limbal ring is added;
  - the eye opening gets a low roughness in the metal/roughness map: wet eyes that reflect the arena's lights and env
    (catchlights) in the game's PBR look;
  - optional: the upper-lid band (skin between lash line and brow) lifted toward the cheek skin when it is darker;
  - the hair: the sculpt's purple-black, matte curls toward the photos' measured dark brown with some gloss.

  .cache/mpvenv/bin/python tools/meshy/facemarks.py fm.json photo1 photo2 artifacts/meshy4/<style>_final_front.png
  python3 tools/meshy/faceretouch.py <fighter> fm.json <render> <photo,photo> [--lid 0.6] [--iris-gain 1.0] [--debug dir]
Rewrites the base colour + metal/roughness images inside .cache/meshy4/<fighter>_src.glb (the untouched bake is kept
as <fighter>_src.bake.glb, so a re-run starts from it).
"""
from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import struct
import sys
import types

import numpy as np
from PIL import Image

sys.modules.setdefault('bpy', types.ModuleType('bpy'))  # glbfast's numpy readers need no Blender
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glbfast  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CACHE = os.path.join(ROOT, '.cache', 'meshy4')
EYE_R = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
EYE_L = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]
BROW_R_LOW = [46, 53, 52, 65, 55]
BROW_L_LOW = [276, 283, 282, 295, 285]
IRIS = {'R': (468, [469, 470, 471, 472]), 'L': (473, [474, 475, 476, 477])}

ap = argparse.ArgumentParser()
ap.add_argument('fighter')
ap.add_argument('fm')
ap.add_argument('render')
ap.add_argument('photos')
ap.add_argument('--ortho', default='0,0.74,0.34,800', help='front render camera: centre x, centre z, ortho scale, px')
ap.add_argument('--lid', type=float, default=0.6, help='share of the upper-lid darkness (vs. the cheeks) taken away')
ap.add_argument('--iris-gain', type=float, default=1.0, help='brightness of the measured iris colour')
ap.add_argument('--sclera', type=float, default=0.75, help='how far the sclera moves to the measured white')
ap.add_argument('--rough', type=float, default=0.16, help='roughness of the eye opening (wet look)')
ap.add_argument('--hair', type=float, default=0.8, help='how far the hair moves to the photos\' measured hair colour (0 = off)')
ap.add_argument('--hair-rough', type=float, default=0.55, help='roughness of the hair (the sculpt\'s is ~0.95: matte felt)')
ap.add_argument('--quality', type=int, default=92)
ap.add_argument('--debug', default='')
args = ap.parse_args()


def lin(c):
    c = np.asarray(c, float) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055) * 255


def inside(poly, pts):
    """Even-odd point-in-polygon for many points (pts (n,2), poly (m,2))."""
    x, y = pts[:, 0], pts[:, 1]
    res = np.zeros(len(pts), bool)
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        c = ((yi > y) != (yj > y)) & (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi)
        res ^= c
        j = i
    return res


def poly_dist(poly, pts):
    """Distance of points to a closed polygon outline."""
    d = np.full(len(pts), np.inf)
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        ab = b - a
        t = np.clip(((pts - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
        d = np.minimum(d, np.linalg.norm(pts - (a + t[:, None] * ab), axis=1))
    return d


# ------------------------------------------------------------------ landmarks -> model x/z
fm = json.load(open(args.fm))
cx, cz, sc, px = (float(v) for v in args.ortho.split(','))
unit = sc / px
P = np.array(fm[args.render]['image'])[:, :2]
XZ = np.c_[cx + (P[:, 0] - px / 2) * unit, cz - (P[:, 1] - px / 2) * unit]
eyes = {'R': XZ[EYE_R], 'L': XZ[EYE_L]}
iris_c = {k: XZ[c] for k, (c, _) in IRIS.items()}
iris_r = {k: float(np.mean(np.linalg.norm(XZ[r] - XZ[c], axis=1))) for k, (c, r) in IRIS.items()}
brows = {'R': XZ[BROW_R_LOW], 'L': XZ[BROW_L_LOW]}
print('iris radius mm', {k: round(v * 1000, 2) for k, v in iris_r.items()}, 'eye width mm',
      {k: round(float(np.ptp(v[:, 0])) * 1000, 1) for k, v in eyes.items()})


# ------------------------------------------------------------------ colours measured on the photos
def photo_colours(path):
    d = fm[path]
    Q = np.array(d['image'])[:, :2]
    im = np.asarray(Image.open(path).convert('RGB')).astype(float)
    H, W, _ = im.shape
    yy, xx = np.mgrid[0:H, 0:W]
    irs, scl = [], []
    for k, ids in (('R', EYE_R), ('L', EYE_L)):
        c, rr = IRIS[k]
        ctr = Q[c]
        r = np.mean(np.linalg.norm(Q[rr] - ctr, axis=1))
        x0, x1 = int(Q[ids, 0].min()) - 2, int(Q[ids, 0].max()) + 3
        y0, y1 = int(Q[ids, 1].min()) - 2, int(Q[ids, 1].max()) + 3
        pts = np.c_[xx[y0:y1, x0:x1].ravel(), yy[y0:y1, x0:x1].ravel()].astype(float)
        col = im[y0:y1, x0:x1].reshape(-1, 3)
        inn = inside(Q[ids], pts)
        dd = np.linalg.norm(pts - ctr, axis=1)
        lum = col.mean(1)
        ring = inn & (dd > 0.5 * r) & (dd < 0.9 * r)
        ring &= lum < np.percentile(lum[ring], 85)  # no catchlight
        irs.append(col[ring])
        white = inn & (dd > 1.15 * r)
        white &= lum > np.percentile(lum[white], 40)  # the lit part of the sclera, not the lid's shadow on it
        scl.append(col[white])
    return np.median(np.concatenate(irs), 0), np.median(np.concatenate(scl), 0)


def photo_hair(path):
    """Median of the darker 60 % of the pixels above the forehead landmark, between the cheekbones."""
    Q = np.array(fm[path]['image'])[:, :2]
    im = np.asarray(Image.open(path).convert('RGB')).astype(float)
    iod = np.linalg.norm(Q[468] - Q[473])
    y1, y0 = int(Q[10, 1] - 0.15 * iod), max(0, int(Q[10, 1] - 1.0 * iod))
    reg = im[y0:y1, int(Q[234, 0]) : int(Q[454, 0])].reshape(-1, 3)
    lum = reg.mean(1)
    return np.median(reg[lum < np.percentile(lum, 60)], 0)


cols = [photo_colours(p) for p in args.photos.split(',')]
HAIR_RGB = np.mean([photo_hair(p) for p in args.photos.split(',')], 0)
IRIS_RGB = np.mean([c[0] for c in cols], 0) * args.iris_gain
SCLERA_RGB = np.mean([c[1] for c in cols], 0)
print('photos: iris', IRIS_RGB.round(1), 'sclera', SCLERA_RGB.round(1), 'hair', HAIR_RGB.round(1))

# ------------------------------------------------------------------ texel positions of the eye area
src = os.path.join(CACHE, f'{args.fighter}_src.glb')
bake = os.path.join(CACHE, f'{args.fighter}_src.bake.glb')
if not os.path.exists(bake):
    shutil.copy(src, bake)
pos, nor, uv, tris, imgs, js = glbfast.arrays(bake)
base = np.asarray(Image.open(io.BytesIO(imgs['base'])).convert('RGB')).astype(np.float32)
mr = np.asarray(Image.open(io.BytesIO(imgs['mr'])).convert('RGB')).astype(np.float32) if imgs.get('mr') else None
TH, TW, _ = base.shape
allx = np.concatenate([v[:, 0] for v in eyes.values()] + [v[:, 0] for v in brows.values()])
allz = np.concatenate([v[:, 1] for v in eyes.values()] + [v[:, 1] for v in brows.values()])
X0, X1 = allx.min() - 0.03, allx.max() + 0.03
Z0, Z1 = allz.min() - 0.03, allz.max() + 0.015
tc = pos[tris].mean(1)
fn = np.cross(pos[tris[:, 1]] - pos[tris[:, 0]], pos[tris[:, 2]] - pos[tris[:, 0]])
fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
front_y = np.percentile(tc[(tc[:, 0] > X0) & (tc[:, 0] < X1) & (tc[:, 2] > Z0) & (tc[:, 2] < Z1), 1], 2)
sel = (tc[:, 0] > X0) & (tc[:, 0] < X1) & (tc[:, 2] > Z0) & (tc[:, 2] < Z1) & (fn[:, 1] < -0.15) & (tc[:, 1] < front_y + 0.045)
print('face triangles in the eye area', int(sel.sum()), 'front y', round(float(front_y), 4))
PX = np.full((TH, TW, 3), np.nan, np.float32)
for t in tris[sel]:
    q = uv[t] * [TW, TH]
    u0, v0 = np.floor(q.min(0)).astype(int)
    u1, v1 = np.ceil(q.max(0)).astype(int)
    if u1 - u0 > 200 or v1 - v0 > 200:
        continue
    gu, gv = np.meshgrid(np.arange(u0, u1 + 1) + 0.5, np.arange(v0, v1 + 1) + 0.5)
    p = np.c_[gu.ravel(), gv.ravel()]
    a, b, c = q
    m = np.array([[b[0] - a[0], c[0] - a[0]], [b[1] - a[1], c[1] - a[1]]])
    det = np.linalg.det(m)
    if abs(det) < 1e-9:
        continue
    l12 = np.linalg.solve(m, (p - a).T).T
    l0 = 1 - l12.sum(1)
    ok = (l0 >= -0.02) & (l12[:, 0] >= -0.02) & (l12[:, 1] >= -0.02)
    if not ok.any():
        continue
    w = np.c_[l0, l12][ok]
    xyz = w @ pos[t]
    iu = np.clip(p[ok, 0].astype(int), 0, TW - 1)
    iv = np.clip(p[ok, 1].astype(int), 0, TH - 1)
    PX[iv, iu] = xyz
valid = ~np.isnan(PX[..., 0])
vy, vx = np.nonzero(valid)
P3 = PX[vy, vx]
xz = P3[:, [0, 2]]
print('texels with a position', len(vy))

# ------------------------------------------------------------------ masks
col = base[vy, vx]
eye_in = np.zeros(len(vy), bool)
iris_w = np.zeros(len(vy))
pupil_w = np.zeros(len(vy))
limbal = np.zeros(len(vy))
open_w = np.zeros(len(vy))
lid_w = np.zeros(len(vy))
for k in ('R', 'L'):
    poly = eyes[k]
    inn = inside(poly, xz)
    eye_in |= inn
    d_edge = poly_dist(poly, xz)
    # soft opening mask: 1 inside, fading over 0.4 mm outside (the lash line keeps its own dark)
    open_w = np.maximum(open_w, np.where(inn, 1.0, np.clip(1 - d_edge / 0.0004, 0, 1)))
    rr = np.linalg.norm(xz - iris_c[k], axis=1) / iris_r[k]
    iris_w = np.maximum(iris_w, inn * np.clip((1.08 - rr) / 0.12, 0, 1))
    pupil_w = np.maximum(pupil_w, inn * np.clip((0.46 - rr) / 0.1, 0, 1))
    limbal = np.maximum(limbal, inn * np.exp(-((rr - 0.97) / 0.08) ** 2))
    # upper lid: above the eye opening, below the brow's lower edge, 0.7 mm clear of the lash line
    top = poly[np.argsort(poly[:, 1])[-9:]]
    bx = brows[k]
    zb = np.interp(xz[:, 0], *zip(*sorted(zip(bx[:, 0], bx[:, 1]))))
    ze = np.interp(xz[:, 0], *zip(*sorted(zip(top[:, 0], top[:, 1]))))
    xin = (xz[:, 0] > poly[:, 0].min() - 0.004) & (xz[:, 0] < poly[:, 0].max() + 0.002)
    band = xin & ~inn & (xz[:, 1] > ze + 0.0007) & (xz[:, 1] < zb - 0.001)
    fade = np.clip((xz[:, 1] - ze - 0.0007) / 0.0015, 0, 1) * np.clip((zb - 0.001 - xz[:, 1]) / 0.002, 0, 1)
    lid_w = np.maximum(lid_w, band * fade)
print('eye opening texels', int(eye_in.sum()), 'iris', int((iris_w > 0.5).sum()), 'lid band', int((lid_w > 0.5).sum()))

# ------------------------------------------------------------------ colours
L = lin(col)
lum = L @ [0.2126, 0.7152, 0.0722]
# iris: the measured colour, the texture's own radial detail kept as a luminance ratio (pupil and catchlights stay)
im_ = iris_w > 0.5
ref_i = np.median(lum[im_ & (pupil_w < 0.1)]) if (im_ & (pupil_w < 0.1)).any() else 1.0
tgt_i = lin(IRIS_RGB)
detail = np.clip(lum / max(ref_i, 1e-4), 0.55, 1.6)[:, None]
new_iris = tgt_i[None, :] * detail * (1 - 0.45 * limbal[:, None])
new_iris = new_iris * (1 - pupil_w[:, None]) + L * pupil_w[:, None] * 0.7
# sclera: toward the measured white, shading kept
scl_m = eye_in & (iris_w < 0.05)
ref_s = np.median(lum[scl_m]) if scl_m.any() else 1.0
tgt_s = lin(SCLERA_RGB)
new_scl = L + (tgt_s[None, :] * np.clip(lum / max(ref_s, 1e-4), 0.6, 1.25)[:, None] - L) * args.sclera
w_scl = (open_w * (1 - iris_w))[:, None]
out = L * (1 - w_scl) + new_scl * w_scl
out = out * (1 - iris_w[:, None]) + new_iris * iris_w[:, None]
# upper lid: lift toward the cheek skin when darker
cheek = np.zeros(len(vy), bool)
for k in ('R', 'L'):
    poly = eyes[k]
    cx_ = poly[:, 0].mean()
    cheek |= (np.abs(xz[:, 0] - cx_) < 0.006) & (xz[:, 1] < poly[:, 1].min() - 0.008) & (xz[:, 1] > poly[:, 1].min() - 0.016)
ref_c = np.median(out[cheek], 0) if cheek.sum() > 50 else None
if ref_c is not None and args.lid > 0:
    lum_o = out @ [0.2126, 0.7152, 0.0722]
    lum_c = float(ref_c @ [0.2126, 0.7152, 0.0722])
    lift = np.clip(lum_c / np.maximum(lum_o, 1e-4), 1.0, 2.2) ** args.lid
    lw = lid_w[:, None]
    out = out * (1 + (lift[:, None] - 1) * lw)
    print('lid: cheek lum', round(lum_c, 4), 'band median before', round(float(np.median(lum_o[lid_w > 0.5])), 4) if (lid_w > 0.5).any() else '-',
          'after', round(float(np.median((out @ [0.2126, 0.7152, 0.0722])[lid_w > 0.5])), 4) if (lid_w > 0.5).any() else '-')
new = base.copy()
new[vy, vx] = srgb(out)
print('iris before', srgb(np.median(L[im_ & (pupil_w < 0.1)], 0)).round(0), 'after', srgb(np.median(out[im_ & (pupil_w < 0.1)], 0)).round(0),
      '| sclera before', srgb(np.median(L[scl_m], 0)).round(0), 'after', srgb(np.median(out[scl_m], 0)).round(0))

# ------------------------------------------------------------------ wet eyes in the metal/roughness map
if mr is not None:
    rough = mr[vy, vx, 1]
    ow = np.clip(open_w, 0, 1)
    mr2 = mr.copy()
    mr2[vy, vx, 1] = rough * (1 - ow) + args.rough * 255 * ow
    mr2[vy, vx, 2] = mr[vy, vx, 2] * (1 - ow)
else:
    mr2 = None

# ------------------------------------------------------------------ hair: colour + gloss (texel mask from triangles)
if args.hair > 0:
    from PIL import ImageDraw

    brow_z = max(float(v[:, 1].max()) for v in brows.values())
    face_x = max(float(np.abs(v[:, 0]).max()) for v in eyes.values()) + 0.012
    tc_ = pos[tris].mean(1)
    head_t = (tc_[:, 2] > 0.70) & ~((tc_[:, 1] < front_y + 0.035) & (np.abs(tc_[:, 0]) < face_x) & (tc_[:, 2] < brow_z + 0.012))
    mimg = Image.new('L', (TW, TH), 0)
    dr = ImageDraw.Draw(mimg)
    for q in uv[tris[head_t]] * [TW, TH]:
        dr.polygon([tuple(q[0]), tuple(q[1]), tuple(q[2])], fill=255)
    hm = (np.asarray(mimg) > 0) & (new.max(2) < 70)
    hy, hx = np.nonzero(hm)
    Lh = lin(new[hy, hx])
    lh = Lh @ [0.2126, 0.7152, 0.0722]
    ref_h = float(np.median(lh))
    tgt_h = lin(HAIR_RGB)
    nh = tgt_h[None, :] * np.clip(lh / max(ref_h, 1e-5), 0.3, 3.0)[:, None]
    new[hy, hx] = srgb(Lh + (nh - Lh) * args.hair)
    if mr2 is not None:
        mr2[hy, hx, 1] = args.hair_rough * 255
        mr2[hy, hx, 2] = 0
    print('hair texels', len(hy), 'median before', srgb(np.median(Lh, 0)).round(0), 'after', np.median(new[hy, hx], 0).round(0))

if args.debug:
    os.makedirs(args.debug, exist_ok=True)
    u0, u1, v0, v1 = vx.min(), vx.max(), vy.min(), vy.max()
    Image.fromarray(base[v0:v1, u0:u1].astype(np.uint8)).save(os.path.join(args.debug, f'{args.fighter}_eyes_before.png'))
    Image.fromarray(np.clip(new[v0:v1, u0:u1], 0, 255).astype(np.uint8)).save(os.path.join(args.debug, f'{args.fighter}_eyes_after.png'))
    dbg = np.zeros((TH, TW, 3), np.uint8)
    dbg[vy, vx] = np.c_[iris_w * 255, open_w * 255, lid_w * 255]
    Image.fromarray(dbg[v0:v1, u0:u1]).save(os.path.join(args.debug, f'{args.fighter}_eyes_masks.png'))


# ------------------------------------------------------------------ write the GLB back
def encode(a):
    b = io.BytesIO()
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(b, 'JPEG', quality=args.quality, subsampling=0)
    return b.getvalue()


jsn, binbuf = glbfast.read(bake)
mat = jsn['materials'][jsn['meshes'][0]['primitives'][0].get('material', 0)]
pbr = mat['pbrMetallicRoughness']
repl = {jsn['images'][jsn['textures'][pbr['baseColorTexture']['index']]['source']]['bufferView']: encode(new)}
if mr2 is not None:
    repl[jsn['images'][jsn['textures'][pbr['metallicRoughnessTexture']['index']]['source']]['bufferView']] = encode(mr2)
chunks, off = [], 0
for i, bv in enumerate(jsn['bufferViews']):
    o = bv.get('byteOffset', 0)
    data = repl.get(i, bytes(binbuf[o : o + bv['byteLength']]))
    pad = (-off) % 4
    if pad:
        chunks.append(b'\0' * pad)
        off += pad
    bv['byteOffset'] = off
    bv['byteLength'] = len(data)
    chunks.append(data)
    off += len(data)
for im in jsn['images']:
    im['mimeType'] = 'image/jpeg' if im['bufferView'] in repl else im.get('mimeType', 'image/jpeg')
binb = b''.join(chunks)
binb += b'\0' * ((-len(binb)) % 4)
jsn['buffers'][0]['byteLength'] = len(binb)
jb = json.dumps(jsn, separators=(',', ':')).encode()
jb += b' ' * ((-len(jb)) % 4)
with open(src, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(binb)))
    f.write(struct.pack('<II', len(jb), 0x4E4F534A))
    f.write(jb)
    f.write(struct.pack('<II', len(binb), 0x004E4942))
    f.write(binb)
print('wrote', src, round(os.path.getsize(src) / 1e6, 1), 'MB')
