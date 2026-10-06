"""Game copies of the PO's Meshy prop models (GitHub release `modelle-2`, downloaded to .cache/props/<id>.glb).

Meshy exports every model normalised to ~1.9 m along its longest side ("auf Standard exportiert"), with 8K/4K textures
and up to 1.7M triangles. This script makes the in-game copy: real-world size (PO: "du musst die Grösse der Props
anpassen"), game orientation (glTF +X = forward/long axis where it matters), a sensible origin, fewer triangles and
smaller textures (resampled from the original JPEG bytes, no repainting).

Usage: python3 tools/meshy/props.py [id ...]   ->  public/assets/props/<id>.glb
Sources: the PO's release assets (GitHub release `modelle-2`), saved as .cache/props/<id>.glb (not in git)
"""
from __future__ import annotations

import io
import json
import math
import os
import struct
import sys

import bpy
from mathutils import Matrix, Vector
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, '.cache', 'props')
OUT = os.path.join(ROOT, 'public', 'assets', 'props')

# id: triangles, base colour px, normal/ORM px, (size axis in game space after rotation, metres), origin, rotation (deg,
# Blender XYZ, applied first). Game space here is Blender's: X = glTF X (forward), Z = up, -Y = toward the camera.
SPEC = {
    # a rolled joint, 17 cm (oversized like the chunky fighters' hands, so it reads in their fingers), lit end at +X
    'joint': dict(tris=6000, base=1024, maps=512, size=('x', 0.17), origin='center', rot=(0, 0, 90)),
    # broken heart (Herzbrecher), 0.55 m wide, facing the camera (-Y)
    # (split into the nodes 'left' / 'right' along the crack so the halves can fly apart)
    'heart': dict(tris=8000, base=1024, maps=512, size=('x', 0.55), origin='center', rot=(0, 0, 0), halves=True),
    # wrecking ball incl. its chain, 1.5 m tall, origin at the top of the chain (it swings from there)
    'ball': dict(tris=24000, base=1024, maps=1024, size=('z', 1.5), origin='top', rot=(0, 0, 0)),
    # one diamond of the Diamanten-Regen (instanced many times): very low poly, 0.24 m
    'diamond': dict(tris=600, base=512, maps=256, size=('z', 0.2), origin='center', rot=(0, 0, 0)),
    # gold microphone, 0.3 m, upright (the sculpt leans: its long axis is aligned to Z, head up)
    'mic': dict(tris=16000, base=1024, maps=512, size=('z', 0.3), origin='center', rot=(0, 0, 0), upright=True),
    # the little crocodile, 1.5 m nose to tail, snout toward +X, standing on the floor. The lower jaw is cut off as its
    # own node 'jaw' (hinge at the mouth corner) so the game can open and snap it (Krokodil-Attacke, fatality).
    'croc': dict(tris=30000, base=2048, maps=1024, size=('x', 1.5), origin='bottom', rot=(0, 0, 90),
                 jaw=dict(hinge=(0.46, 0.145), tip=(0.76, 0.14))),
    # palm with speakers (Palmen-Bassdrop), 5 m tall, standing on the floor
    'palm': dict(tris=30000, base=2048, maps=1024, size=('z', 5.0), origin='bottom', rot=(0, 0, 0)),
    # tuner hatchback (no brand), 2.7 m long, nose toward +X, wheels on the floor
    'car': dict(tris=40000, base=2048, maps=1024, size=('x', 2.7), origin='bottom', rot=(0, 0, 180)),
}


def align_upright(ob) -> None:
    """Rotate the mesh so its principal (longest) axis is Z, the wider end (a mic's head) up."""
    import numpy as np

    co = np.array([v.co[:] for v in ob.data.vertices])
    c = co.mean(axis=0)
    w, vecs = np.linalg.eigh(np.cov((co - c).T))
    axis = vecs[:, int(np.argmax(w))]
    t = (co - c) @ axis
    radial = np.linalg.norm((co - c) - np.outer(t, axis), axis=1)
    hi = radial[t > np.percentile(t, 80)].mean()
    lo = radial[t < np.percentile(t, 20)].mean()
    if lo > hi:
        axis = -axis
    q = Vector(axis.tolist()).rotation_difference(Vector((0, 0, 1)))
    ob.data.transform(q.to_matrix().to_4x4())
    ob.data.update()


def split_halves(ob) -> list:
    """Broken heart: every loose part goes to the side of its centroid (x < 0: 'left', else 'right'); the halves are
    children of the (then empty) main object."""
    import bmesh

    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    seen = set()
    for f in bm.faces:
        f.select = False
    for f0 in bm.faces:
        if f0.index in seen:
            continue
        # flood fill one loose part
        part, stack = [], [f0]
        seen.add(f0.index)
        while stack:
            f = stack.pop()
            part.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g.index not in seen:
                        seen.add(g.index)
                        stack.append(g)
        cx = sum(v.co.x for f in part for v in f.verts) / sum(len(f.verts) for f in part)
        for f in part:
            f.select = cx < 0
    bmesh.update_edit_mesh(ob.data)
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    left = [o for o in bpy.data.objects if o.type == 'MESH' and o is not ob][0]
    left.name = 'left'
    ob.name = 'right'
    print(f'[props] halves: left {len(left.data.polygons)} / right {len(ob.data.polygons)} faces', flush=True)
    for o in (ob, left):
        o.select_set(True)
    return [left]


def split_jaw(ob, jaw: dict) -> None:
    """Separate the lower jaw: faces in front of the hinge and under the mouth line (hinge -> tip, in final metres,
    x forward / z up) become the object 'jaw', whose origin is moved to the hinge."""
    import bmesh

    (hx, hz), (tx, tz) = jaw['hinge'], jaw['tip']
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(ob.data)
    for f in bm.faces:
        cx = sum(v.co.x for v in f.verts) / len(f.verts)
        cz = sum(v.co.z for v in f.verts) / len(f.verts)
        line = hz + (tz - hz) * max(0.0, min(1.0, (cx - hx) / max(1e-6, tx - hx)))
        f.select = cx > hx and cz < line
    bmesh.update_edit_mesh(ob.data)
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    j = [o for o in bpy.data.objects if o.type == 'MESH' and o is not ob][0]
    j.name = 'jaw'
    j.data.transform(Matrix.Translation(Vector((-hx, 0, -hz))))
    j.location = (hx, 0, hz)
    j.parent = ob
    for o in (ob, j):
        o.select_set(True)
    print(f'[props] jaw: {len(j.data.polygons)} faces split off', flush=True)


def process(pid: str, spec: dict) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    src = os.path.join(SRC, f'{pid}.glb')
    bpy.ops.import_scene.gltf(filepath=src)
    ob = [o for o in bpy.data.objects if o.type == 'MESH'][0]
    for o in bpy.data.objects:
        o.select_set(o is ob)
    bpy.context.view_layer.objects.active = ob
    # bake the import transform + the orientation fix into the mesh
    rx, ry, rz = (math.radians(a) for a in spec['rot'])
    ob.matrix_world = Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X') @ ob.matrix_world
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if spec.get('upright'):
        align_upright(ob)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tris > spec['tris']:
        dm = ob.modifiers.new('dec', 'DECIMATE')
        dm.ratio = spec['tris'] / tris
        dm.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier='dec')
    out_tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    halves = split_halves(ob) if spec.get('halves') else None
    # scale + origin
    vs = [v.co for o in [ob] + (halves or []) for v in o.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    axis, metres = spec['size']
    k = metres / (mx - mn)['xyz'.index(axis)]
    c = (mn + mx) / 2
    if spec['origin'] == 'bottom':
        c.z = mn.z
    elif spec['origin'] == 'top':
        c.z = mx.z
    for o in [ob] + (halves or []):
        o.data.transform(Matrix.Scale(k, 4) @ Matrix.Translation(-c))
        o.data.update()
    dims = (mx - mn) * k
    if not halves:
        ob.name = pid
    if spec.get('jaw'):
        split_jaw(ob, spec['jaw'])
    # textures from the original JPEG bytes
    raw = open(src, 'rb').read()
    jl = struct.unpack_from('<I', raw, 12)[0]
    js = json.loads(raw[20 : 20 + jl])
    bin0 = 20 + jl + 8
    by_name = {}
    for i, img in enumerate(js['images']):
        bv = js['bufferViews'][img['bufferView']]
        by_name[img.get('name') or f'Image_{i}'] = raw[bin0 + bv.get('byteOffset', 0) : bin0 + bv.get('byteOffset', 0) + bv['byteLength']]
    tmp = os.path.join(SRC, 'work', pid)
    os.makedirs(tmp, exist_ok=True)
    for im in bpy.data.images:
        data = by_name.get(im.name)
        if data is None:
            continue
        pil = Image.open(io.BytesIO(data)).convert('RGB')
        target = spec['base'] if im.colorspace_settings.name == 'sRGB' else spec['maps']
        pil = pil.resize((target, target), Image.LANCZOS)
        path = os.path.join(tmp, f'{im.name}.jpg')
        pil.save(path, quality=90, subsampling=0, optimize=True)
        cs = im.colorspace_settings.name
        if im.packed_file:
            im.unpack(method='REMOVE')
        im.filepath = path
        im.source = 'FILE'
        im.reload()
        im.colorspace_settings.name = cs
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, f'{pid}.glb')
    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB', use_selection=True, export_texcoords=True, export_normals=True,
        export_tangents=False, export_materials='EXPORT', export_image_format='AUTO', export_yup=True, export_apply=False,
    )
    print(f'[props] {pid}: {tris} -> {out_tris} tris, size {tuple(round(d, 3) for d in dims)} m, '
          f'{os.path.getsize(out) / 1e6:.2f} MB', flush=True)


if __name__ == '__main__':
    ids = [a for a in sys.argv[1:] if a in SPEC] or list(SPEC)
    for pid in ids:
        process(pid, SPEC[pid])
