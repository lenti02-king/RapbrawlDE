"""Game version of a textured Meshy model: fewer triangles and smaller textures, same UVs and the SAME texture content.

Usage: python3 tools/meshy/reduce.py jazeek|bonez [--tris 120000] [--base 4096] [--maps 2048]
  .cache/meshy2/<id>_src.glb  ->  .cache/meshy2/<id>_std_src.glb   (then: python3 tools/meshy/skin.py <id> --src ... --out ...)

The sculpt's UV islands are separate geometry after glTF import, so collapse decimation keeps every UV seam; textures are
only resampled (Lanczos, from the original JPEG data) — no repainting, no re-baking.
"""
from __future__ import annotations

import argparse
import os

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ap = argparse.ArgumentParser()
ap.add_argument('id')
ap.add_argument('--tris', type=int, default=120000)
ap.add_argument('--base', type=int, default=4096, help='base colour size')
ap.add_argument('--maps', type=int, default=2048, help='normal + metal/roughness size')
ap.add_argument('--out')
args = ap.parse_args()
SRC = os.path.join(ROOT, '.cache', 'meshy2', f'{args.id}_src.glb')
OUT = args.out or os.path.join(ROOT, '.cache', 'meshy2', f'{args.id}_std_src.glb')

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

raw = open(SRC, 'rb').read()
jl = struct.unpack_from('<I', raw, 12)[0]
js = json.loads(raw[20 : 20 + jl])
bin0 = 20 + jl + 8
tmp = os.path.join(ROOT, '.cache', 'meshy2', 'work', args.id)
os.makedirs(tmp, exist_ok=True)
by_name = {}
for i, img in enumerate(js['images']):
    bv = js['bufferViews'][img['bufferView']]
    data = raw[bin0 + bv.get('byteOffset', 0) : bin0 + bv.get('byteOffset', 0) + bv['byteLength']]
    by_name[img.get('name') or f'Image_{i}'] = data
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
        pil.save(path, quality=95, subsampling=0, optimize=True)
    else:
        open(path, 'wb').write(data)  # already small enough: the original JPEG bytes, untouched
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
