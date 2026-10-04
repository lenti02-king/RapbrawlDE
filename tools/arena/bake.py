"""Bakes the courtyard lightmap with Blender/Cycles (direct + bounced light, soft shadows, emissive windows/LEDs).

    node tools/arena/export.mjs                 # dev server running: serialise the procedural arena
    python3 tools/arena/bake.py [--size 2048] [--samples 96]

Writes public/assets/arena/courtyard.{json,uv.json,jpg}: meta (mesh index -> loop count + offset, intensity),
the second UV set per triangle corner (base64 float32) and the sRGB-encoded lightmap.
Runtime: src/render/arenas/bake.ts (applyLightmap).
"""
from __future__ import annotations

import base64
import json
import math
import os
import sys
import time

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, '.cache', 'arena', 'scene.json')
OUT = os.path.join(ROOT, 'public', 'assets', 'arena')


def arg(name, default):
    return type(default)(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default


SIZE = arg('--size', 2048)
SAMPLES = arg('--samples', 96)


def f32(b64: str) -> np.ndarray:
    return np.frombuffer(base64.b64decode(b64), dtype=np.float32)


def to_bl(p):
    p = np.asarray(p, dtype=np.float64)
    return np.stack([p[..., 0], -p[..., 2], p[..., 1]], -1)


def look_rotation(direction):
    """Quaternion rotating -Z onto `direction` (Blender lights point down their local -Z)."""
    from mathutils import Vector
    d = Vector(direction).normalized()
    return d.to_track_quat('-Z', 'Y')


def main():
    import bpy
    from mathutils import Vector

    scene_data = json.load(open(SRC))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = SAMPLES
    sc.cycles.max_bounces = 4
    sc.cycles.diffuse_bounces = 3
    sc.cycles.use_denoising = False
    sc.render.bake.margin = 6

    img = bpy.data.images.new('lightmap', SIZE, SIZE, float_buffer=True, alpha=False)

    bake_objs = []
    order = []  # (mesh index, object, loop count)
    for m in scene_data['meshes']:
        emissive = max(m['emissive']) > 0
        if not m['bake'] and not emissive:
            continue
        pos = to_bl(f32(m['pos']).reshape(-1, 3))
        nrm = to_bl(f32(m['nrm']).reshape(-1, 3))
        if m.get('idx'):
            tri = np.frombuffer(base64.b64decode(m['idx']), dtype=np.uint32).reshape(-1, 3)
        else:
            tri = np.arange(len(pos), dtype=np.uint32).reshape(-1, 3)
        # weld coincident vertices so islands are connected (UVs stay per corner, so runtime order is kept)
        key = np.round(pos / 1e-4).astype(np.int64)
        uniq, idx_first, inverse = np.unique(key, axis=0, return_index=True, return_inverse=True)
        inverse = inverse.reshape(-1)
        verts = pos[idx_first]
        faces = inverse[tri]
        me = bpy.data.meshes.new(f'm{m["i"]}')
        me.from_pydata([tuple(v) for v in verts], [], [tuple(int(x) for x in f) for f in faces])
        me.update()
        # keep the exporter's per-corner normals (hard edges where the arena has them)
        corner_n = nrm[tri.reshape(-1)]
        me.normals_split_custom_set([tuple(n) for n in corner_n])
        ob = bpy.data.objects.new(f'm{m["i"]}', me)
        sc.collection.objects.link(ob)
        if m.get('uv'):
            uv0 = f32(m['uv']).reshape(-1, 2)[tri.reshape(-1)]
            l0 = me.uv_layers.new(name='uv0')
            l0.data.foreach_set('uv', uv0.astype(np.float32).ravel())
        # material: flat albedo (bounce colour) + emission
        mat = bpy.data.materials.new(f'mat{m["i"]}')
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = nt.nodes['Principled BSDF']
        a = m['albedo']
        bsdf.inputs['Base Color'].default_value = (min(a[0], 0.95), min(a[1], 0.95), min(a[2], 0.95), 1)
        bsdf.inputs['Roughness'].default_value = 0.85
        if emissive:
            e = m['emissive']
            strength = max(e)
            col = [c / strength for c in e]
            bsdf.inputs['Emission Strength'].default_value = strength * 1.6
            if m.get('emissiveMap'):
                path = os.path.join(ROOT, '.cache', 'arena', f'em{m["i"]}.png')
                with open(path, 'wb') as fh:
                    fh.write(base64.b64decode(m['emissiveMap'].split(',', 1)[1]))
                t = nt.nodes.new('ShaderNodeTexImage')
                t.image = bpy.data.images.load(path)
                uvn = nt.nodes.new('ShaderNodeUVMap')
                uvn.uv_map = 'uv0'
                nt.links.new(uvn.outputs['UV'], t.inputs['Vector'])
                nt.links.new(t.outputs['Color'], bsdf.inputs['Emission Color'])
            else:
                bsdf.inputs['Emission Color'].default_value = (*col, 1)
        if m['bake']:
            tn = nt.nodes.new('ShaderNodeTexImage')
            tn.image = img
            nt.nodes.active = tn
            bake_objs.append(ob)
            order.append((m['i'], ob, len(tri) * 3))
        ob.data.materials.append(mat)
        if not m['cast'] and not emissive:
            ob.visible_shadow = False

    # ---- lights
    for l in scene_data['lights']:
        col = l['color']
        p = Vector(tuple(to_bl(l['pos'])))
        if l['type'] == 'DirectionalLight':
            ld = bpy.data.lights.new('sun', 'SUN')
            ld.energy = l['intensity']
            ld.angle = math.radians(2.5)
            t = Vector(tuple(to_bl(l['target'])))
            ob = bpy.data.objects.new('sun', ld)
            ob.rotation_mode = 'QUATERNION'
            ob.rotation_quaternion = look_rotation(t - p)
        elif l['type'] == 'PointLight':
            ld = bpy.data.lights.new('point', 'POINT')
            ld.energy = 4 * math.pi * l['intensity']
            ld.shadow_soft_size = 0.25
            ob = bpy.data.objects.new('point', ld)
        else:
            ld = bpy.data.lights.new('spot', 'SPOT')
            ld.energy = 4 * math.pi * l['intensity']
            ld.spot_size = 2 * l['angle']
            ld.spot_blend = l['penumbra']
            ld.shadow_soft_size = 0.12
            t = Vector(tuple(to_bl(l['target'])))
            ob = bpy.data.objects.new('spot', ld)
            ob.rotation_mode = 'QUATERNION'
            ob.rotation_quaternion = look_rotation(t - p)
        ld.color = col
        ob.location = p
        sc.collection.objects.link(ob)

    # ---- sky: hemisphere gradient (ground colour below the horizon, sky colour above)
    world = bpy.data.worlds.new('sky')
    sc.world = world
    world.use_nodes = True
    wn = world.node_tree
    bg = wn.nodes['Background']
    hemi = scene_data.get('hemi') or {'sky': [0.5, 0.55, 0.8], 'ground': [0.05, 0.04, 0.03], 'intensity': 0.8}
    tc = wn.nodes.new('ShaderNodeTexCoord')
    sep = wn.nodes.new('ShaderNodeSeparateXYZ')
    ramp = wn.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[0].color = (*hemi['ground'], 1)
    ramp.color_ramp.elements[1].position = 0.62
    ramp.color_ramp.elements[1].color = (*hemi['sky'], 1)
    mr = wn.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = -1
    mr.inputs['From Max'].default_value = 1
    wn.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    wn.links.new(sep.outputs['Z'], mr.inputs['Value'])
    wn.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
    wn.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = hemi['intensity'] / math.pi * 1.4

    # ---- lightmap UVs: smart project per object, packed together into one atlas
    lay = bpy.context.view_layer
    for ob in bake_objs:
        ob.data.uv_layers.new(name='lightmap')
        ob.data.uv_layers.active = ob.data.uv_layers['lightmap']
    bpy.ops.object.select_all(action='DESELECT')
    for ob in bake_objs:
        ob.select_set(True)
    lay.objects.active = bake_objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin=0.003)
    bpy.ops.object.mode_set(mode='OBJECT')

    # ---- bake
    t0 = time.time()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=6, use_clear=True, uv_layer='lightmap')
    print(f'[bake] {len(bake_objs)} objects, {SIZE}px, {SAMPLES} samples: {time.time() - t0:.0f} s')

    px = np.array(img.pixels[:], dtype=np.float32).reshape(SIZE, SIZE, 4)[::-1, :, :3]  # top row first
    # masked blur against residual noise (does not bleed into empty texels)
    valid = (px.sum(-1) > 1e-6).astype(np.float32)
    from PIL import Image, ImageFilter

    def gblur(a, r):
        k = np.arange(-int(3 * r) - 1, int(3 * r) + 2, dtype=np.float32)
        k = np.exp(-(k * k) / (2 * r * r))
        k /= k.sum()
        out = a.astype(np.float32)
        for axis in (0, 1):
            out = np.apply_along_axis(lambda v: np.convolve(v, k, mode='same'), axis, out)
        return out

    num = gblur(px * valid[..., None], 1.2)
    den = gblur(valid[..., None], 1.2)
    sm = np.where(den > 1e-3, num / np.maximum(den, 1e-3), px)
    lit = sm[valid > 0]
    scale = float(np.percentile(lit.max(-1), 99.7)) if len(lit) else 1.0
    lin = np.clip(sm / scale, 0, 1)
    srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray((srgb * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, 'courtyard.jpg'), quality=92)

    # ---- per-corner UV2 in the exporter's triangle order
    chunks, meta, off = [], [], 0
    for i, ob, nloops in order:
        uv = np.empty(len(ob.data.loops) * 2, dtype=np.float32)
        ob.data.uv_layers['lightmap'].data.foreach_get('uv', uv)
        assert len(ob.data.loops) == nloops, (i, len(ob.data.loops), nloops)
        chunks.append(uv)
        meta.append({'i': i, 'count': nloops, 'offset': off})
        off += nloops * 2
    allv = np.concatenate(chunks).astype(np.float32)
    with open(os.path.join(OUT, 'courtyard.uv.json'), 'w') as fh:
        json.dump({'data': base64.b64encode(allv.tobytes()).decode('ascii')}, fh)
    # three.js MeshBasicMaterial: out = albedo * lightmap * intensity / PI; Cycles DIFFUSE (no colour) is radiance per albedo
    with open(os.path.join(OUT, 'courtyard.json'), 'w') as fh:
        json.dump({'intensity': scale * math.pi, 'size': SIZE, 'samples': SAMPLES, 'uvFile': 'courtyard.uv.json', 'meshes': meta}, fh)
    print(f'[bake] wrote {OUT}/courtyard.(jpg|json|uv.json); scale {scale:.3f}')


if __name__ == '__main__':
    main()
