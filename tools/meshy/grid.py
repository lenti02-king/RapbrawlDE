"""Orthographic front/side renders of a Meshy GLB with a coordinate grid (Blender units, Z up), for placing the
skeleton landmarks in tools/meshy/<id>_cr.py.

Usage: python3 tools/meshy/grid.py model.glb outprefix [views=front,side] [px_per_m=500] [zoom=x0,z0,x1,z1]
"""
from __future__ import annotations

import math
import os
import sys

import bpy
from PIL import Image, ImageDraw

src, outp = sys.argv[1], sys.argv[2]
views = (sys.argv[3] if len(sys.argv) > 3 else 'front,side').split(',')
ppm = float(sys.argv[4]) if len(sys.argv) > 4 else 500.0
zoom = [float(v) for v in sys.argv[5].split(',')] if len(sys.argv) > 5 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
if os.path.getsize(src) > 60e6:
    # multi-million-triangle sculpts (modelle-4 heads): numpy loader, the glTF add-on needs minutes
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import glbfast
    ob = glbfast.load(src, 'src', work=os.path.join(os.path.dirname(os.path.abspath(outp)), '.grid_work'))
else:
    bpy.ops.import_scene.gltf(filepath=src)
    ob = [o for o in bpy.data.objects if o.type == 'MESH'][0]
import numpy as np  # noqa: E402

_co = np.empty(len(ob.data.vertices) * 3)
ob.data.vertices.foreach_get('co', _co)
_co = _co.reshape(-1, 3) @ np.array(ob.matrix_world)[:3, :3].T + np.array(ob.matrix_world)[:3, 3]
xs = _co[:, 0]; ys = _co[:, 1]; zs = _co[:, 2]
print('bbox x', min(xs), max(xs), 'y', min(ys), max(ys), 'z', min(zs), max(zs), flush=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = 12
sc.cycles.device = 'CPU'
sc.world = bpy.data.worlds.new('w')
sc.world.use_nodes = True
sc.world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.8, 0.8, 0.82, 1)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = 'ORTHO'
for view in views:
    if zoom:
        x0, z0, x1, z1 = zoom
    else:
        h0 = (min(xs), max(xs)) if view in ('front', 'back') else (min(ys), max(ys))
        x0, x1, z0, z1 = h0[0] - 0.05, h0[1] + 0.05, min(zs) - 0.03, max(zs) + 0.03
    w, h = x1 - x0, z1 - z0
    sc.render.resolution_x = int(w * ppm)
    sc.render.resolution_y = int(h * ppm)
    cam.data.ortho_scale = max(w, h)
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    if view == 'front':  # model faces -Y: look along +Y
        cam.location = (cx, -5, cz); cam.rotation_euler = (math.pi / 2, 0, 0)
    elif view == 'back':
        cam.location = (-cx, 5, cz); cam.rotation_euler = (math.pi / 2, 0, math.pi)
    else:  # side: from +X looking along -X (front of the model = -Y = image left... )
        cam.location = (5, cx, cz); cam.rotation_euler = (math.pi / 2, 0, math.pi / 2)
    path = f'{outp}_{view}.png'
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    im = Image.open(path).convert('RGB')
    d = ImageDraw.Draw(im)
    W, H = im.size
    step = 0.05
    def px(u, v):
        return ((u - x0) / w * W, (z1 - v) / h * H)
    u = math.floor(x0 / step) * step
    while u <= x1:
        X, _ = px(u, 0)
        major = abs(round(u / 0.1) * 0.1 - u) < 1e-6
        d.line([(X, 0), (X, H)], fill=(255, 0, 0) if abs(u) < 1e-6 else ((0, 90, 255) if major else (150, 180, 255)), width=1)
        if major:
            d.text((X + 2, 2), f'{u:.1f}', fill=(0, 0, 160))
        u += step
    v = math.floor(z0 / step) * step
    while v <= z1:
        _, Y = px(0, v)
        major = abs(round(v / 0.1) * 0.1 - v) < 1e-6
        d.line([(0, Y), (W, Y)], fill=(255, 0, 0) if abs(v) < 1e-6 else ((0, 90, 255) if major else (150, 180, 255)), width=1)
        if major:
            d.text((2, Y + 2), f'{v:.1f}', fill=(0, 0, 160))
        v += step
    im.save(path)
    import json
    json.dump({'view': view, 'x0': x0, 'x1': x1, 'z0': z0, 'z1': z1, 'W': W, 'H': H}, open(path[:-4] + '.json', 'w'))
    print('wrote', path, im.size, flush=True)
