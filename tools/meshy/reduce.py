"""Game version of a textured Meshy model: fewer triangles and smaller textures, same UVs and the SAME texture content.

Usage: python3 tools/meshy/reduce.py jazeek|bonez|manuellsen|lacazette [--tris 120000] [--base 4096] [--maps 2048] [--dir meshy3]
  .cache/<dir>/<id>_src.glb  ->  .cache/<dir>/<id>_std_src.glb   (then: python3 tools/meshy/skin.py <id> --src ... --out ...)

The sculpt's UV islands are separate geometry after glTF import, so collapse decimation keeps every UV seam; textures are
only resampled (Lanczos, from the original JPEG data) — no repainting, no re-baking. The one exception is RETOUCH in
tools/meshy/<id>_cr.py: regions (3D boxes) whose texels are smoothed out, e.g. a third-party monogram print on clothes
(base colour and normal map, so no relief of the print survives either).
"""
from __future__ import annotations

import argparse
import importlib
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ap = argparse.ArgumentParser()
ap.add_argument('id')
ap.add_argument('--tris', type=int, default=120000)
ap.add_argument('--base', type=int, default=4096, help='base colour size')
ap.add_argument('--maps', type=int, default=2048, help='normal + metal/roughness size')
ap.add_argument('--out')
ap.add_argument('--dir', default='meshy3', help='source folder under .cache/ (meshy2 = the session-9 models)')
ap.add_argument('--quality', type=int, default=88, help='JPEG quality when a texture must be re-encoded (or is bigger than 3 MB)')
ap.add_argument('--keep-mr', action='store_true', help='keep the metal/roughness map (the cel-shaded game material does not use it)')
args = ap.parse_args()
SRC = os.path.join(ROOT, '.cache', args.dir, f'{args.id}_src.glb')
OUT = args.out or os.path.join(ROOT, '.cache', args.dir, f'{args.id}_std_src.glb')
try:
    SPEC = importlib.import_module(f'{args.id}_cr')
except ImportError:
    SPEC = None
RETOUCH = getattr(SPEC, 'RETOUCH', []) if SPEC else []

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
ob = [o for o in bpy.data.objects if o.type == 'MESH'][0]
tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
dm = ob.modifiers.new('dec', 'DECIMATE')
dm.ratio = min(1.0, args.tris / tris)
dm.use_collapse_triangulate = True
bpy.context.view_layer.objects.active = ob
for o in bpy.data.objects:
    o.select_set(o is ob)
bpy.ops.object.modifier_apply(modifier='dec')
print('[reduce] triangles', tris, '->', sum(len(p.vertices) - 2 for p in ob.data.polygons), flush=True)
# textures: decode the ORIGINAL JPEG bytes from the source GLB, Lanczos-resample with PIL, save once as JPEG q95 and let the
# exporter copy those files as they are (no second re-encode)
import io  # noqa: E402
import json  # noqa: E402
import struct  # noqa: E402

from PIL import Image  # noqa: E402

import numpy as np  # noqa: E402


def region_mask(size: int) -> np.ndarray:
    """Texel mask (size x size, row 0 = top) of the faces whose centre lies in one of the RETOUCH boxes."""
    from PIL import ImageDraw

    me = ob.data
    me.calc_loop_triangles()
    uv = me.uv_layers.active.data
    mw = ob.matrix_world
    img = Image.new('L', (size, size), 0)
    dr = ImageDraw.Draw(img)
    n = 0
    for t in me.loop_triangles:
        c = mw @ t.center
        for r in RETOUCH:
            if r['z'][0] <= c.z <= r['z'][1] and abs(c.x) <= r['x'] and r.get('y', (-9, 9))[0] <= c.y <= r.get('y', (-9, 9))[1]:
                pts = [(uv[li].uv[0] * size, (1 - uv[li].uv[1]) * size) for li in t.loops]
                dr.polygon(pts, fill=255)
                n += 1
                break
    print('[reduce] retouch faces', n, flush=True)
    return np.asarray(img) > 0


def retouch(path: str, normal: bool) -> None:
    """Smooth the print away inside the region: per texel the masked neighbourhood average (normalised convolution, so
    nothing from outside bleeds in) at a radius larger than the print's motifs; folds and shading are larger and stay."""
    from PIL import ImageFilter

    im0 = Image.open(path).convert('RGB')
    W = im0.size[0]
    m = region_mask(W)
    a = np.asarray(im0).astype(np.float32)
    if not normal:
        # only the fabric itself (saturated tan/brown); white tops, grey soles and skin outside the box stay
        hsv = np.asarray(im0.convert('HSV')).astype(np.float32)
        fab = (hsv[..., 1] > 50) & (hsv[..., 0] > 8) & (hsv[..., 0] < 40)
        m &= np.asarray(Image.fromarray((fab * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
    rad = max(4, W // 180)
    mk = Image.fromarray((m * 255).astype(np.uint8))
    wsum = np.asarray(mk.filter(ImageFilter.GaussianBlur(rad))).astype(np.float32) / 255.0
    out = a.copy()
    for ch in range(3):
        layer = Image.fromarray(np.clip(a[..., ch] * m, 0, 255).astype(np.uint8))
        blur = np.asarray(layer.filter(ImageFilter.GaussianBlur(rad))).astype(np.float32)
        out[..., ch] = np.where(m, blur / np.maximum(wsum, 1e-3), a[..., ch])
    if not normal:
        # a little fabric grain so the smoothed area does not look like plastic
        rng = np.random.default_rng(7)
        grain = np.asarray(Image.fromarray((rng.normal(128, 9, m.shape)).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) - 128
        out += (grain * m)[..., None] * 0.6
    edge = np.asarray(mk.filter(ImageFilter.GaussianBlur(2))).astype(np.float32)[..., None] / 255.0
    res = a * (1 - edge) + out * edge
    Image.fromarray(np.clip(res, 0, 255).astype(np.uint8)).save(path, quality=args.quality, subsampling=0)
    print('[reduce] retouched', os.path.basename(path), 'texels', int(m.sum()), 'radius', rad, flush=True)


raw = open(SRC, 'rb').read()
jl = struct.unpack_from('<I', raw, 12)[0]
js = json.loads(raw[20 : 20 + jl])
bin0 = 20 + jl + 8
tmp = os.path.join(ROOT, '.cache', args.dir, 'work', args.id)
os.makedirs(tmp, exist_ok=True)
by_name = {}
for i, img in enumerate(js['images']):
    bv = js['bufferViews'][img['bufferView']]
    data = raw[bin0 + bv.get('byteOffset', 0) : bin0 + bv.get('byteOffset', 0) + bv['byteLength']]
    by_name[img.get('name') or f'Image_{i}'] = data
_mat = js['materials'][0]
_src_of = lambda slot: f"Image_{js['textures'][slot['index']]['source']}" if slot else None  # noqa: E731
BASE_IMG = _src_of(_mat.get('pbrMetallicRoughness', {}).get('baseColorTexture'))
NORMAL_IMG = _src_of(_mat.get('normalTexture'))
MR_IMG = _src_of(_mat.get('pbrMetallicRoughness', {}).get('metallicRoughnessTexture'))
if MR_IMG and not args.keep_mr:
    # D43: the fighters are cel shaded (MeshToonMaterial: no roughness/metalness) -> the map is dead weight on phones
    for mat in bpy.data.materials:
        if not mat.node_tree:
            continue
        for nd in list(mat.node_tree.nodes):
            if nd.type == 'TEX_IMAGE' and nd.image and nd.image.name == MR_IMG:
                mat.node_tree.nodes.remove(nd)
        for nd in mat.node_tree.nodes:
            if nd.type == 'BSDF_PRINCIPLED':
                nd.inputs['Metallic'].default_value = 0.0
                nd.inputs['Roughness'].default_value = 1.0
    print('[reduce] dropped metal/roughness map', MR_IMG, flush=True)
for im in bpy.data.images:
    data = by_name.get(im.name)
    if data is None:
        continue
    pil = Image.open(io.BytesIO(data))
    w, h = pil.size
    target = args.base if im.colorspace_settings.name == 'sRGB' else args.maps
    path = os.path.join(tmp, f'{im.name}.jpg')
    if max(w, h) > target:
        pil = pil.convert('RGB').resize((target, target), Image.LANCZOS)
        pil.save(path, quality=args.quality, subsampling=0, optimize=True)
    elif len(data) > 3_000_000:
        pil.convert('RGB').save(path, quality=args.quality, subsampling=0, optimize=True)  # same pixels, sane file size
    else:
        open(path, 'wb').write(data)  # already small enough: the original JPEG bytes, untouched
    if RETOUCH and im.name in (BASE_IMG, NORMAL_IMG):
        retouch(path, normal=im.name == NORMAL_IMG)
    cs = im.colorspace_settings.name
    im.unpack(method='REMOVE') if im.packed_file else None
    im.filepath = path
    im.source = 'FILE'
    im.reload()
    im.colorspace_settings.name = cs
    print('[reduce] image', im.name, (w, h), '->', pil.size, cs, f'{os.path.getsize(path) / 1e6:.1f} MB', flush=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True, export_texcoords=True, export_normals=True, export_tangents=False,
    export_materials='EXPORT', export_image_format='AUTO', export_yup=True, export_apply=False,
)
print('[reduce] wrote', OUT, f'{os.path.getsize(OUT) / 1e6:.1f} MB', flush=True)
