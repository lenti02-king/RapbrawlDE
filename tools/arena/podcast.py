"""BLOCK BEATS PODCAST arena (Clash-Royale style) after the product owner's concept image, built in Blender.

Usage:
  python3 tools/arena/podcast.py preview [out.png]   # Cycles render from the game camera (iterate on the layout)
  python3 tools/arena/podcast.py bake                # baked textures + GLB -> public/assets/arena/podcast*

Coordinates (Blender): x right, y away from the camera, z up; the fighters stand on y=0 (the game's z=0 plane),
the back wall is at y=WALL_Y. glTF export converts to the game's Y-up (camera at +z).
"""
from __future__ import annotations

import math
import os
import sys

import bpy  # noqa: I001  (bpy must be imported before bmesh/mathutils)
import bmesh
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
FONT_SCRIPT = os.path.join(HERE, 'fonts', 'KaushanScript_400Regular.ttf')
FONT_BOLD = os.path.join(HERE, 'fonts', 'Anton_400Regular.ttf')

WALL_Y = 5.2
STEP_Y = 3.0
STEP_H = 0.18
HALF_W = 14.0

# ------------------------------------------------------------------ helpers


def lin(hexstr):
    c = [int(hexstr[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


MATS: dict[str, bpy.types.Material] = {}


def mat(name, color='#808080', rough=0.5, emit=None, strength=0.0, metal=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = lin(color)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    if emit:
        bs.inputs['Emission Color'].default_value = lin(emit)
        bs.inputs['Emission Strength'].default_value = strength
    MATS[name] = m
    return m


def brick_mat(name, c1, c2, mortar, w, h, mortar_size=0.015, rough=0.8, bump=0.6, offset=0.5, vertical=False):
    """Brick pattern from object coordinates; vertical=True lays it on x/z (walls) instead of x/y (floors)."""
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bs = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    br = nt.nodes.new('ShaderNodeTexBrick')
    br.offset = offset
    br.inputs['Color1'].default_value = lin(c1)
    br.inputs['Color2'].default_value = lin(c2)
    br.inputs['Mortar'].default_value = lin(mortar)
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = mortar_size
    br.inputs['Brick Width'].default_value = w
    br.inputs['Row Height'].default_value = h
    br.inputs['Bias'].default_value = 0.0
    if vertical:
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        comb = nt.nodes.new('ShaderNodeCombineXYZ')
        nt.links.new(tc.outputs['Object'], sep.inputs[0])
        nt.links.new(sep.outputs['X'], comb.inputs['X'])
        nt.links.new(sep.outputs['Z'], comb.inputs['Y'])
        nt.links.new(sep.outputs['Y'], comb.inputs['Z'])
        nt.links.new(comb.outputs[0], br.inputs['Vector'])
    else:
        nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
    nt.links.new(br.outputs['Color'], bs.inputs['Base Color'])
    bp = nt.nodes.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = bump
    bp.inputs['Distance'].default_value = 0.01
    nt.links.new(br.outputs['Fac'], bp.inputs['Height'])
    nt.links.new(bp.outputs['Normal'], bs.inputs['Normal'])
    bs.inputs['Roughness'].default_value = rough
    MATS[name] = m
    return m


def image_mat(name, path, rough=0.8, obj_scale=None):
    """Image texture; with obj_scale the image is mapped from object coordinates (planar, centred)."""
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bs = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = bpy.data.images.load(path)
    if obj_scale:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (1 / obj_scale, 1 / obj_scale, 1)
        mp.inputs['Location'].default_value = (0.5, 0.5, 0)
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
        nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
    nt.links.new(t.outputs['Color'], bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = rough
    MATS[name] = m
    return m


SCN = None
GROUPS: dict[str, list[bpy.types.Object]] = {'set': [], 'floor': [], 'rug': [], 'glow': []}


def link(ob, group='set'):
    SCN.collection.objects.link(ob)
    GROUPS[group].append(ob)
    ob['rb_group'] = group
    return ob


def mesh_obj(name, bm, material, group='set'):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    return link(ob, group)


def box(name, size, loc, material, bevel=0.03, rot=(0, 0, 0), group='set', segs=3):
    """size (w along x, d along y, h along z); loc = centre of the bottom face."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], (v.co.z + 0.5) * size[2]))
    ob = mesh_obj(name, bm, material, group)
    ob.location = loc
    ob.rotation_euler = Euler(rot)
    if bevel > 0:
        b = ob.modifiers.new('bevel', 'BEVEL')
        b.width = bevel
        b.segments = segs
        b.limit_method = 'ANGLE'
    return ob


def cyl(name, r, h, loc, material, rot=(0, 0, 0), seg=24, group='set', bevel=0.0, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    for v in bm.verts:
        v.co.z += h / 2
    ob = mesh_obj(name, bm, material, group)
    ob.location = loc
    ob.rotation_euler = Euler(rot)
    if bevel > 0:
        b = ob.modifiers.new('bevel', 'BEVEL')
        b.width = bevel
        b.segments = 2
        b.limit_method = 'ANGLE'
    return ob


def sphere(name, r, loc, material, scale=(1, 1, 1), group='set', seg=24, rings=12):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    ob = mesh_obj(name, bm, material, group)
    ob.location = loc
    ob.scale = scale
    return ob


def torus(name, R, r, loc, material, rot=(0, 0, 0), group='set', seg=48, tube=12, arc=1.0):
    bm = bmesh.new()
    verts = []
    for i in range(seg + (0 if arc >= 1 else 1)):
        a = 2 * math.pi * arc * i / seg
        ring = []
        for j in range(tube):
            b = 2 * math.pi * j / tube
            p = Vector(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))
            ring.append(bm.verts.new(p))
        verts.append(ring)
    n = len(verts)
    for i in range(n if arc >= 1 else n - 1):
        a, b_ = verts[i], verts[(i + 1) % n]
        for j in range(tube):
            bm.faces.new((a[j], b_[j], b_[(j + 1) % tube], a[(j + 1) % tube]))
    ob = mesh_obj(name, bm, material, group)
    ob.location = loc
    ob.rotation_euler = Euler(rot)
    return ob


def tube(name, pts, r, material, group='set', closed=False):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 3
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for p, q in zip(sp.points, pts):
        p.co = (q[0], q[1], q[2], 1)
    sp.use_cyclic_u = closed
    ob = bpy.data.objects.new(name, cu)
    ob.data.materials.append(material)
    return link(ob, group)


def text(name, body, font, size, loc, material, rot=(math.pi / 2, 0, 0), extrude=0.02, bevel=0.006, group='glow', spacing=1.0):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.font = bpy.data.fonts.load(font, check_existing=True)
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = bevel
    cu.bevel_resolution = 2
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.space_character = spacing
    ob = bpy.data.objects.new(name, cu)
    ob.data.materials.append(material)
    ob.location = loc
    ob.rotation_euler = Euler(rot)
    return link(ob, group)


# ------------------------------------------------------------------ rug texture (original: purple pile, gold rings, crown)
def rug_texture(size=2048):
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter

    out = os.path.join(ROOT, '.cache', 'arena', 'rug.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    rng = np.random.default_rng(7)
    yy, xx = np.mgrid[0:size, 0:size] / size - 0.5
    r = np.sqrt(xx**2 + yy**2) * 2
    base = np.array([0.075, 0.028, 0.19])  # linear (#4b2a7a)
    pile = rng.normal(0, 1, (size, size))
    pile = np.array(Image.fromarray(((pile - pile.min()) / (pile.max() - pile.min()) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))) / 255.0
    shade = 0.85 + 0.3 * pile
    img = base[None, None, :] * shade[..., None]
    img *= (1 - 0.25 * np.clip((r - 0.86) / 0.14, 0, 1))[..., None]
    gold = np.array([0.69, 0.37, 0.06])  # linear (#d9a441)
    for r0, w in ((0.885, 0.035), (0.80, 0.008)):
        band = np.clip(1 - np.abs(r - r0) / w, 0, 1) ** 0.5
        img = img * (1 - band[..., None]) + (gold * (0.85 + 0.25 * pile[..., None])) * band[..., None]
    im = Image.fromarray((np.clip(img, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    c = size / 2
    w = size * 0.15
    h = w * 1.45
    pts = [(-1, 0.6), (-1, -0.4), (-0.5, 0.1), (0, -0.7), (0.5, 0.1), (1, -0.4), (1, 0.6)]
    d.polygon([(c + px * w, c + py * h + h * 0.1) for px, py in pts], fill=(214, 160, 76))
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    im.save(out)
    return out


# ------------------------------------------------------------------ materials
def materials():
    M = {}
    M['brick'] = brick_mat('brick', '#3e2434', '#311b2a', '#160d14', 0.42, 0.14, 0.02, bump=0.8, vertical=True)
    M['brick_dark'] = brick_mat('brick_dark', '#2c1a26', '#24151f', '#130c11', 0.42, 0.14, 0.02, bump=0.6, vertical=True)
    M['floor'] = brick_mat('floor', '#6c3519', '#5c2c13', '#22100a', 2.0, 0.2, 0.006, rough=0.25, bump=0.3)
    M['step'] = mat('step', '#4a2a1c', 0.5)
    M['foam'] = mat('foam', '#2a2335', 0.95)
    M['wood'] = mat('wood', '#8f5a31', 0.45)
    M['wood_dark'] = mat('wood_dark', '#4a2a17', 0.5)
    M['leather'] = mat('leather', '#7a4025', 0.38)
    M['leather_dark'] = mat('leather_dark', '#5a2c18', 0.4)
    M['black'] = mat('black', '#18171c', 0.45)
    M['black_soft'] = mat('black_soft', '#24222a', 0.7)
    M['gold'] = mat('gold', '#e6b04a', 0.3)
    M['gold_dark'] = mat('gold_dark', '#b07a24', 0.35)
    M['frame'] = mat('frame', '#20140f', 0.4)
    M['plaque'] = mat('plaque', '#cfa04a', 0.3)
    M['cone'] = mat('cone', '#d9a43c', 0.35)
    M['grey'] = mat('grey', '#6d6c72', 0.6)
    M['pot'] = mat('pot', '#5e5d63', 0.55)
    M['leaf'] = mat('leaf', '#2f8a3c', 0.6)
    M['leaf_dark'] = mat('leaf_dark', '#1f6a2c', 0.6)
    M['ivy'] = mat('ivy', '#3e8d3a', 0.6)
    M['shelf'] = mat('shelf', '#6a3f22', 0.55)
    M['vinyl_a'] = mat('vinyl_a', '#6b3fa0', 0.5)
    M['vinyl_b'] = mat('vinyl_b', '#d9a441', 0.5)
    M['vinyl_c'] = mat('vinyl_c', '#232026', 0.5)
    M['vinyl_d'] = mat('vinyl_d', '#a33a4a', 0.5)
    M['vinyl_e'] = mat('vinyl_e', '#3f5fa0', 0.5)
    M['white'] = mat('white', '#e8e4dc', 0.5)
    M['fader'] = mat('fader', '#9a9aa2', 0.4)
    # emitters (glow group: exported as dynamic emissive meshes, but they light the bake)
    M['led_gold'] = mat('led_gold', '#ffb33a', 0.3, '#ffb33a', 26.0)
    M['led_purple'] = mat('led_purple', '#b24dff', 0.3, '#b24dff', 26.0)
    M['neon_pink'] = mat('neon_pink', '#f2c4ff', 0.3, '#c455ff', 34.0)
    M['neon_gold'] = mat('neon_gold', '#ffd27a', 0.3, '#ffa826', 26.0)
    M['neon_purple'] = mat('neon_purple', '#d9a6ff', 0.3, '#a352ff', 26.0)
    M['onair'] = mat('onair', '#7a0a10', 0.3, '#d0141e', 3.0)
    M['onair_text'] = mat('onair_text', '#ffffff', 0.3, '#fff0f0', 22.0)
    M['rug'] = image_mat('rug', rug_texture(), 0.95, obj_scale=6.8)
    M['ring'] = mat('ring', '#ffffff', 0.3, '#fff3e0', 10.0)
    M['btn_blue'] = mat('btn_blue', '#4ab0ff', 0.3, '#4ab0ff', 6.0)
    M['btn_yellow'] = mat('btn_yellow', '#ffd23a', 0.3, '#ffd23a', 6.0)
    M['btn_red'] = mat('btn_red', '#ff4a4a', 0.3, '#ff4a4a', 6.0)
    M['lamp'] = mat('lamp', '#ffcf7a', 0.3, '#ffb85a', 8.0)
    return M


# ------------------------------------------------------------------ geometry
def foam_panel(name, x0, x1, z0, z1, M, y=WALL_Y - 0.01, cell=0.22):
    bm = bmesh.new()
    nx = max(1, round((x1 - x0) / cell))
    nz = max(1, round((z1 - z0) / cell))
    cx = (x1 - x0) / nx
    cz = (z1 - z0) / nz
    for i in range(nx):
        for j in range(nz):
            a = Vector((x0 + i * cx, y, z0 + j * cz))
            b = a + Vector((cx, 0, 0))
            c = a + Vector((cx, 0, cz))
            d = a + Vector((0, 0, cz))
            tip = (a + c) / 2 + Vector((0, -0.09, 0))
            vs = [bm.verts.new(p) for p in (a, b, c, d, tip)]
            for f in ((0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)):
                bm.faces.new([vs[k] for k in f])
    return mesh_obj(name, bm, M['foam'])


def speaker(name, x, M):
    base_z = STEP_H
    cyl(f'{name}_pole', 0.035, 1.55, (x, WALL_Y - 0.55, base_z), M['black'])
    cyl(f'{name}_foot', 0.22, 0.05, (x, WALL_Y - 0.55, base_z), M['black'], seg=24)
    box(f'{name}_cab', (0.62, 0.55, 1.0), (x, WALL_Y - 0.55, base_z + 1.55), M['black'], bevel=0.05)
    cyl(f'{name}_woofer_rim', 0.25, 0.04, (x, WALL_Y - 0.83, base_z + 1.88), M['black_soft'], rot=(math.pi / 2, 0, 0))
    cyl(f'{name}_woofer', 0.215, 0.05, (x, WALL_Y - 0.82, base_z + 1.88), M['cone'], rot=(math.pi / 2, 0, 0), r2=0.12)
    sphere(f'{name}_cap', 0.07, (x, WALL_Y - 0.88, base_z + 1.88), M['black'], scale=(1, 0.5, 1))
    cyl(f'{name}_tweeter', 0.09, 0.04, (x, WALL_Y - 0.83, base_z + 2.33), M['cone'], rot=(math.pi / 2, 0, 0), r2=0.05)


def gold_record(name, x, z, M, s=0.72):
    box(f'{name}_frame', (s, 0.06, s * 1.12), (x, WALL_Y - 0.04, z - s * 0.56), M['frame'], bevel=0.02)
    box(f'{name}_mat', (s * 0.86, 0.02, s * 0.98), (x, WALL_Y - 0.075, z - s * 0.49), M['gold_dark'], bevel=0.0)
    box(f'{name}_inner', (s * 0.8, 0.02, s * 0.92), (x, WALL_Y - 0.085, z - s * 0.46), M['black'], bevel=0.0)
    cyl(f'{name}_disc', s * 0.32, 0.015, (x, WALL_Y - 0.1, z + 0.04), M['gold'], rot=(math.pi / 2, 0, 0), seg=40)
    cyl(f'{name}_label', s * 0.08, 0.02, (x, WALL_Y - 0.105, z + 0.04), M['black'], rot=(math.pi / 2, 0, 0))
    box(f'{name}_plaque', (s * 0.4, 0.02, s * 0.1), (x, WALL_Y - 0.1, z - s * 0.44), M['plaque'], bevel=0.0)


def chair(name, x, M, face=1):
    y = WALL_Y - 1.25
    z = STEP_H
    box(f'{name}_base', (1.15, 1.0, 0.42), (x, y, z), M['leather_dark'], bevel=0.08)
    box(f'{name}_seat', (0.85, 0.85, 0.18), (x, y - 0.05, z + 0.42), M['leather'], bevel=0.08)
    box(f'{name}_back', (1.1, 0.32, 0.78), (x, y + 0.36, z + 0.4), M['leather'], bevel=0.1)
    for s in (-1, 1):
        box(f'{name}_arm{s}', (0.22, 0.95, 0.5), (x + s * 0.5, y, z + 0.38), M['leather'], bevel=0.09)
    # tufting buttons
    for i in range(3):
        sphere(f'{name}_tuft{i}', 0.022, (x - 0.3 + i * 0.3, y + 0.2, z + 0.9), M['leather_dark'])


def mic(name, x, M, tilt=1):
    ty = WALL_Y - 1.55
    tz = STEP_H + 1.02
    cyl(f'{name}_clamp', 0.04, 0.09, (x, ty + 0.25, tz), M['black'])
    p0 = Vector((x, ty + 0.25, tz + 0.09))
    p1 = p0 + Vector((tilt * 0.06, -0.02, 0.55))
    p2 = p1 + Vector((tilt * 0.16, -0.42, 0.05))
    tube(f'{name}_arm', [p0, p1, p2], 0.024, M['black'])
    m = cyl(f'{name}_head', 0.075, 0.3, p2 + Vector((0, -0.03, -0.26)), M['black_soft'], seg=20)
    m.rotation_euler = Euler((0.35, 0, 0))
    torus(f'{name}_band', 0.078, 0.013, p2 + Vector((0, -0.06, -0.06)), M['gold'], rot=(0.35, 0, 0), seg=24, tube=6)


def headphones(name, x, y, z, M, rot=0.0):
    torus(f'{name}_band', 0.1, 0.012, (x, y, z + 0.08), M['black'], rot=(math.pi / 2, 0, rot), arc=0.5, seg=20, tube=6)
    for s in (-1, 1):
        cyl(f'{name}_cup{s}', 0.05, 0.035, (x + s * 0.1 * math.cos(rot), y + s * 0.1 * math.sin(rot), z), M['black'], rot=(0, math.pi / 2, rot))


def table(M):
    y = WALL_Y - 1.75
    z = STEP_H
    box('table_top', (4.0, 0.95, 0.12), (0, y, z + 0.92), M['wood'], bevel=0.04)
    box('table_body', (3.7, 0.8, 0.92), (0, y + 0.04, z), M['wood_dark'], bevel=0.03)
    for i in range(-17, 18):
        box(f'table_slat{i}', (0.06, 0.04, 0.74), (i * 0.1, y - 0.37, z + 0.09), M['shelf'], bevel=0.01, segs=1)
    box('table_emblem_plate', (0.62, 0.05, 0.42), (0, y - 0.41, z + 0.25), M['wood_dark'], bevel=0.02)
    crown(0, y - 0.45, z + 0.46, 0.4, M['gold'], 'table_crown', group='set', flat=True)
    box('table_led', (3.6, 0.04, 0.04), (0, y - 0.38, z + 0.02), M['led_gold'], bevel=0.0, group='glow')
    # mixer
    box('mixer', (0.95, 0.42, 0.08), (0, y - 0.05, z + 1.04), M['black'], bevel=0.02)
    cols = [M['btn_blue'], M['btn_yellow'], M['btn_red'], M['btn_blue'], M['btn_yellow']]
    for i in range(10):
        box(f'mixer_btn{i}', (0.05, 0.05, 0.02), (-0.4 + i * 0.09, y - 0.17, z + 1.12), cols[i % 5], bevel=0.0, group='glow')
        box(f'mixer_fader{i}', (0.025, 0.12, 0.015), (-0.4 + i * 0.09, y + 0.02, z + 1.12), M['fader'], bevel=0.0)
    for i, x in enumerate((-1.45, -0.62, 0.62, 1.45)):
        mic(f'mic{i}', x, M, tilt=1 if x < 0 else -1)
    for i, x in enumerate((-1.25, -0.35, 0.35, 1.25)):
        headphones(f'hp{i}', x, y - 0.12, z + 1.07, M, rot=0.2 * (1 if i % 2 else -1))


def crown(x, y, z, w, material, name, group='glow', flat=False, r=0.025):
    """Five-point crown outline (neon tube), or a flat badge when flat=True."""
    h = w * 0.62
    pts2 = [(-0.5, 0), (-0.5, 0.55), (-0.27, 0.3), (0, 0.75), (0.27, 0.3), (0.5, 0.55), (0.5, 0), (-0.5, 0)]
    pts = [Vector((x + px * w, y, z + py * h)) for px, py in pts2]
    if flat:
        bm = bmesh.new()
        vs = [bm.verts.new(p) for p in pts[:-1]]
        f = bm.faces.new(vs)
        bmesh.ops.triangulate(bm, faces=[f])
        ext = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
        for v in [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]:
            v.co.y -= 0.03
        return mesh_obj(name, bm, material, group)
    return tube(name, pts, r, material, group=group, closed=True)


def neon_sign(M):
    z0 = 2.28
    for name, body, x, z in (('neon_block', 'Block', -0.22, z0 + 1.27), ('neon_beats', 'Beats', 0.12, z0 + 0.5)):
        t = text(name, body, FONT_SCRIPT, 1.12, (x, WALL_Y - 0.12, z), M['neon_pink'], extrude=0.035, bevel=0.02)
        t.rotation_euler = Euler((math.pi / 2, 0, 0))
        t.rotation_euler.rotate(Euler((0, -0.17, 0)))
    t3 = text('neon_podcast', 'PODCAST', FONT_BOLD, 0.44, (0.3, WALL_Y - 0.12, z0 - 0.1), M['neon_gold'], extrude=0.03, bevel=0.01, spacing=1.06)
    t3.rotation_euler = Euler((math.pi / 2, 0, 0))
    t3.rotation_euler.rotate(Euler((0, -0.1, 0)))
    for s, (x, z) in ((-1, (-0.85, z0 - 0.17)), (1, (1.45, z0 - 0.02))):
        for k in range(2):
            tube(f'neon_dash{s}{k}', [Vector((x - 0.3, WALL_Y - 0.12, z + k * 0.11)), Vector((x + 0.3, WALL_Y - 0.12, z + k * 0.11 + 0.06))], 0.022, M['neon_gold'], group='glow')
    crown(0.1, WALL_Y - 0.12, z0 + 1.95, 0.8, M['neon_gold'], 'neon_crown', r=0.026)


def on_air(M):
    box('onair_box', (1.05, 0.12, 0.48), (2.62, WALL_Y - 0.08, 2.0), M['black'], bevel=0.03)
    box('onair_face', (0.95, 0.02, 0.38), (2.62, WALL_Y - 0.15, 2.05), M['onair'], bevel=0.0, group='glow')
    text('onair_text', 'ON AIR', FONT_BOLD, 0.3, (2.62, WALL_Y - 0.17, 2.24), M['onair_text'], extrude=0.012, bevel=0.0, spacing=1.05)


def cassette_neon(M):
    x, z = 7.4, 3.9
    pts = [(-0.75, -0.42), (0.75, -0.42), (0.75, 0.42), (-0.75, 0.42)]
    tube('cassette_outline', [Vector((x + px, WALL_Y - 0.1, z + pz)) for px, pz in pts], 0.025, M['neon_purple'], group='glow', closed=True)
    tube('cassette_window', [Vector((x + px, WALL_Y - 0.1, z + pz)) for px, pz in [(-0.45, -0.05), (0.45, -0.05), (0.45, 0.2), (-0.45, 0.2)]], 0.018, M['neon_purple'], group='glow', closed=True)
    for s in (-1, 1):
        torus(f'cassette_reel{s}', 0.12, 0.018, (x + s * 0.3, WALL_Y - 0.1, z + 0.075), M['neon_purple'], rot=(math.pi / 2, 0, 0), group='glow', seg=24, tube=6)
    tube('cassette_bottom', [Vector((x + px, WALL_Y - 0.1, z + pz)) for px, pz in [(-0.5, -0.42), (-0.38, -0.25), (0.38, -0.25), (0.5, -0.42)]], 0.018, M['neon_purple'], group='glow')


def plant(name, x, y, M, s=1.0):
    cyl(f'{name}_pot', 0.3 * s, 0.55 * s, (x, y, 0), M['pot'], r2=0.36 * s, seg=28, bevel=0.02)
    cyl(f'{name}_soil', 0.33 * s, 0.03, (x, y, 0.52 * s), M['black_soft'])
    import random

    rnd = random.Random(hash(name) & 0xFFFF)
    for i in range(9):
        a = i / 9 * math.tau + rnd.uniform(-0.2, 0.2)
        h = (0.75 + rnd.uniform(0, 0.55)) * s
        r = (0.25 + rnd.uniform(0, 0.25)) * s
        tip = Vector((x + math.cos(a) * r, y + math.sin(a) * r * 0.7, 0.55 * s + h))
        tube(f'{name}_stem{i}', [Vector((x, y, 0.55 * s)), Vector((x + math.cos(a) * r * 0.4, y + math.sin(a) * r * 0.3, 0.55 * s + h * 0.6)), tip], 0.012 * s, M['leaf_dark'])
        leaf = sphere(f'{name}_leaf{i}', 0.25 * s, tip, M['leaf'] if i % 2 else M['leaf_dark'], scale=(1.0, 0.18, 0.72), seg=20, rings=10)
        leaf.rotation_euler = Euler((rnd.uniform(-0.5, 0.2), 0, a + math.pi / 2))


def ring_light(name, x, M):
    y = 1.9
    for k in range(3):
        a = k / 3 * math.tau + 0.4
        tube(f'{name}_leg{k}', [Vector((x, y, 1.0)), Vector((x + math.cos(a) * 0.45, y + math.sin(a) * 0.45, 0))], 0.018, M['black'])
    cyl(f'{name}_pole', 0.022, 1.2, (x, y, 0.95), M['black'])
    torus(f'{name}_ring', 0.27, 0.035, (x, y, 2.38), M['ring'], rot=(math.pi / 2, 0, 0), group='glow', seg=40, tube=10)
    box(f'{name}_cam', (0.32, 0.22, 0.2), (x, y + 0.02, 2.12), M['black'], bevel=0.03)
    cyl(f'{name}_lens', 0.07, 0.18, (x, y - 0.08, 2.22), M['black_soft'], rot=(math.pi / 2, 0, 0))


def shelf_unit(name, x0, x1, M, levels=(0.9, 1.7, 2.5, 3.3), top=4.1, figurines=True):
    import random

    rnd = random.Random(hash(name) & 0xFFFF)
    w = x1 - x0
    cx = (x0 + x1) / 2
    y = WALL_Y - 0.25
    box(f'{name}_back', (w, 0.05, top), (cx, WALL_Y - 0.03, 0), M['shelf'], bevel=0.0)
    for s in (x0, x1):
        box(f'{name}_side{s:.1f}', (0.06, 0.45, top), (s, y, 0), M['shelf'], bevel=0.01)
    for i, z in enumerate((0.05,) + tuple(levels) + (top - 0.06,)):
        box(f'{name}_board{i}', (w, 0.45, 0.06), (cx, y, z), M['shelf'], bevel=0.01)
    vmats = [M['vinyl_a'], M['vinyl_b'], M['vinyl_c'], M['vinyl_d'], M['vinyl_e'], M['vinyl_c']]
    for li, z in enumerate((0.11,) + tuple(levels[:-1])):
        xx = x0 + 0.08
        while xx < x1 - 0.12:
            if figurines and rnd.random() < 0.08:
                trophy(f'{name}_tro{li}_{xx:.2f}', xx + 0.12, y, z + 0.06, M)
                xx += 0.32
                continue
            t = rnd.uniform(0.03, 0.05)
            hgt = rnd.uniform(0.62, 0.7)
            lean = rnd.uniform(-0.12, 0.12) if rnd.random() < 0.2 else 0
            b = box(f'{name}_v{li}_{xx:.2f}', (t, 0.36, hgt), (xx, y, z + 0.06), rnd.choice(vmats), bevel=0.004, segs=1)
            b.rotation_euler = Euler((0, lean, 0))
            xx += t + 0.005
    return cx


def trophy(name, x, y, z, M):
    cyl(f'{name}_base', 0.07, 0.06, (x, y, z), M['gold_dark'])
    cyl(f'{name}_stem', 0.025, 0.1, (x, y, z + 0.06), M['gold'])
    crown(x, y - 0.02, z + 0.17, 0.18, M['gold'], f'{name}_crown', group='set', flat=True)


def ivy(name, x, z, M, n=14):
    import random

    rnd = random.Random(hash(name) & 0xFFFF)
    for i in range(n):
        p = Vector((x + rnd.uniform(-0.45, 0.45), WALL_Y - 0.3 + rnd.uniform(-0.1, 0.1), z - rnd.uniform(0, 1.3)))
        lf = sphere(f'{name}_l{i}', 0.07, p, M['ivy'], scale=(1, 0.3, 0.8), seg=12, rings=6)
        lf.rotation_euler = Euler((rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.uniform(0, 3)))


def build():
    global SCN
    bpy.ops.wm.read_factory_settings(use_empty=True)
    SCN = bpy.context.scene
    M = materials()
    # floor (wide, the fighters stand on y=0) + stage step + rug
    box('floor', (HALF_W * 2, 17.2, 0.1), (0, -3.4, -0.1), M['floor'], bevel=0.0, group='floor')
    box('step', (HALF_W * 2, WALL_Y - STEP_Y, STEP_H), (0, (STEP_Y + WALL_Y) / 2, 0), M['step'], bevel=0.02, group='set')
    box('step_led', (HALF_W * 2, 0.04, 0.035), (0, STEP_Y - 0.02, STEP_H - 0.05), M['led_gold'], bevel=0.0, group='glow')
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, cap_tris=False, segments=128, radius=3.4)
    rug = mesh_obj('rug', bm, M['rug'], group='rug')
    rug.location = (0, 0.2, 0.012)
    rug.scale = (1.0, 0.62, 1.0)
    # back wall
    box('wall', (HALF_W * 2, 0.3, 9.0), (0, WALL_Y + 0.15, 0), M['brick'], bevel=0.0)
    box('wall_top', (HALF_W * 2, 0.32, 2.4), (0, WALL_Y + 0.13, 6.6), M['brick_dark'], bevel=0.0)
    box('cornice', (HALF_W * 2, 0.4, 0.22), (0, WALL_Y - 0.05, 6.4), M['black'], bevel=0.02)
    # LED frame of the centre bay (gold) and outer pillars (purple)
    for s in (-1, 1):
        box(f'led_gold_v{s}', (0.06, 0.06, 4.9), (s * 3.95, WALL_Y - 0.05, STEP_H), M['led_gold'], bevel=0.0, group='glow')
        box(f'led_purple_v{s}', (0.06, 0.06, 6.3), (s * 5.55, WALL_Y - 0.05, 0.0), M['led_purple'], bevel=0.0, group='glow')
        box(f'led_purple_far{s}', (0.06, 0.06, 6.3), (s * 11.0, WALL_Y - 0.05, 0.0), M['led_purple'], bevel=0.0, group='glow')
        box(f'pillar{s}', (0.5, 0.25, 6.4), (s * 5.55, WALL_Y - 0.12, 0), M['black_soft'], bevel=0.03)
    box('led_gold_top', (7.96, 0.06, 0.06), (0, WALL_Y - 0.05, STEP_H + 4.85), M['led_gold'], bevel=0.0, group='glow')
    box('led_gold_floor', (7.9, 0.05, 0.03), (0, WALL_Y - 0.08, STEP_H + 0.02), M['led_gold'], bevel=0.0, group='glow')
    # acoustic foam
    foam_panel('foam_l1', -3.85, -1.65, 3.85, 4.95, M)
    foam_panel('foam_l2', -3.85, -2.75, 0.95, 2.6, M)
    foam_panel('foam_r1', 1.65, 3.85, 3.85, 4.95, M)
    foam_panel('foam_r2', 3.3, 3.85, 0.95, 2.6, M)
    foam_panel('foam_ol', -5.3, -4.15, 3.2, 4.95, M)
    foam_panel('foam_or', 4.15, 5.3, 3.2, 4.95, M)
    foam_panel('foam_fl', -10.7, -8.6, 4.4, 5.95, M)
    foam_panel('foam_fr', 8.6, 10.7, 4.4, 5.95, M)
    # neon sign, records, ON AIR
    neon_sign(M)
    for i, x in enumerate((-3.05, -2.2, 2.25, 3.1)):
        gold_record(f'record{i}', x, 3.25, M, s=0.64)
    on_air(M)
    cassette_neon(M)
    # furniture
    table(M)
    chair('chair_l', -2.75, M)
    chair('chair_r', 2.75, M)
    speaker('spk_l', -4.6, M)
    speaker('spk_r', 4.6, M)
    # sides: vinyl shelves, trophies, ivy, plants, ring lights with cameras, lamps
    shelf_unit('shelf_l', -9.6, -6.2, M)
    shelf_unit('shelf_r', 8.4, 10.6, M, levels=(0.9, 1.7, 2.5), top=2.6)
    ivy('ivy_l', -8.6, 4.0, M)
    plant('plant_l', -5.3, 2.5, M)
    plant('plant_r', 5.3, 2.5, M)
    ring_light('ring_l', -6.5, M)
    ring_light('ring_r', 6.5, M)
    for i, x in enumerate((-6.6, 9.9)):
        cyl(f'lamp{i}_base', 0.06, 0.25, (x, WALL_Y - 0.3, 4.1 if x < 0 else 2.6), M['gold_dark'])
        sphere(f'lamp{i}_bulb', 0.09, (x, WALL_Y - 0.3, (4.1 if x < 0 else 2.6) + 0.33), M['lamp'], group='glow')
    lights()
    return M


def lights():
    w = bpy.data.worlds.new('world')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.012, 0.008, 0.022, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    SCN.world = w

    def area(name, loc, rot, size, energy, color, shape='RECTANGLE', size_y=None):
        L = bpy.data.lights.new(name, 'AREA')
        L.shape = shape
        L.size = size
        if size_y:
            L.size_y = size_y
        L.energy = energy
        L.color = color
        ob = bpy.data.objects.new(name, L)
        ob.location = loc
        ob.rotation_euler = Euler(rot)
        SCN.collection.objects.link(ob)

    def point(name, loc, energy, color, radius=0.2):
        L = bpy.data.lights.new(name, 'POINT')
        L.energy = energy
        L.color = color
        L.shadow_soft_size = radius
        ob = bpy.data.objects.new(name, L)
        ob.location = loc
        SCN.collection.objects.link(ob)

    # warm key from above the camera, aimed at the set
    area('key', (0, -3.5, 7.5), (math.radians(35), 0, 0), 12.0, 1500, (1.0, 0.78, 0.58), size_y=3.0)
    # purple fill from the sides
    area('fill_l', (-9, -2, 4), (math.radians(60), 0, math.radians(-50)), 4.0, 500, (0.7, 0.4, 1.0))
    area('fill_r', (9, -2, 4), (math.radians(60), 0, math.radians(50)), 4.0, 500, (0.7, 0.4, 1.0))
    # practicals: warm glow over the table, lamps, neon spill
    point('table_glow', (0, WALL_Y - 1.6, 2.6), 180, (1.0, 0.72, 0.4), 0.5)
    area('wall_wash', (0, WALL_Y - 2.2, 5.6), (math.radians(-30), 0, 0), 9.0, 650, (1.0, 0.62, 0.42), size_y=0.6)
    point('neon_spill', (0.1, WALL_Y - 0.6, 4.1), 420, (0.8, 0.35, 1.0), 0.8)
    for s in (-1, 1):
        point(f'pillar_glow{s}', (s * 5.55, WALL_Y - 0.4, 2.5), 160, (0.7, 0.35, 1.0), 0.4)
        point(f'gold_glow{s}', (s * 3.95, WALL_Y - 0.4, 2.5), 110, (1.0, 0.65, 0.25), 0.4)


def preview(out):
    sc = SCN
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = int(os.environ.get('SAMPLES', 48))
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:  # noqa: BLE001
        pass
    sc.cycles.max_bounces = 4
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Punchy'
    sc.render.resolution_x = int(os.environ.get('W', 1280))
    sc.render.resolution_y = int(os.environ.get('H', 720))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.angle = math.radians(float(os.environ.get('FOV', 28)))
    dist = float(os.environ.get('DIST', 11.0))
    cx = float(os.environ.get('CX', 0.0))
    cam.location = (cx, -dist, 1.3 + dist * 0.03 + float(os.environ.get('CY', 0.0)))
    target = Vector((cx, 0.0, 1.12 + float(os.environ.get('TY', 0.0))))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)


# ------------------------------------------------------------------ bake + export
OUT_DIR = os.path.join(ROOT, 'public', 'assets', 'arena', 'podcast')
GLOW_ANIM = {'neon_pink': 'neon', 'neon_gold': 'neon', 'neon_purple': 'cassette', 'led_gold': 'led', 'led_purple': 'led', 'onair': 'onair',
             'onair_text': 'onair', 'ring': 'ring', 'btn_blue': 'buttons', 'btn_yellow': 'buttons', 'btn_red': 'buttons', 'lamp': 'lamp'}
FLOOR_X = HALF_W
FLOOR_Y0, FLOOR_Y1 = -12.0, STEP_Y + 0.05  # front edge far enough for the widest fight camera
TILE = 4.0  # metres per floor-albedo tile


def select_only(objs, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]


def to_mesh(objs):
    select_only(objs)
    bpy.ops.object.convert(target='MESH')
    return list(bpy.context.selected_objects)


def join(objs, name):
    select_only(objs)
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


def fresh_uv(ob, name='UVMap'):
    while ob.data.uv_layers:
        ob.data.uv_layers.remove(ob.data.uv_layers[0])
    return ob.data.uv_layers.new(name=name)


def new_image(name, w, h):
    im = bpy.data.images.new(name, w, h, alpha=True, float_buffer=True)
    im.colorspace_settings.name = 'Linear Rec.709'
    im.generated_color = (0, 0, 0, 0)
    return im


def bake(ob, img, kind, filt, samples):
    for slot in ob.material_slots:
        nt = slot.material.node_tree
        n = nt.nodes.get('BAKE') or nt.nodes.new('ShaderNodeTexImage')
        n.name = 'BAKE'
        n.image = img
        nt.nodes.active = n
    SCN.cycles.samples = samples
    select_only([ob])
    bpy.ops.object.bake(type=kind, pass_filter=filt, margin=8, use_clear=True)
    import numpy as np

    a = np.empty(img.size[0] * img.size[1] * 4, np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)[::-1]


def denoise(rgba, sigma):
    """Coverage-masked gaussian: smooths sampling noise without bleeding across island borders."""
    import numpy as np
    from scipy.ndimage import gaussian_filter

    m = (rgba[..., 3] > 0.5).astype(np.float32)
    out = np.empty_like(rgba[..., :3])

    def blur(ch):
        return gaussian_filter(ch.astype(np.float32), sigma)

    bm = blur(m)
    for c in range(3):
        out[..., c] = np.where(bm > 1e-4, blur(rgba[..., c] * m) / np.maximum(bm, 1e-4), rgba[..., c])
    return out, m


def resize_f(arr, w, h):
    import numpy as np
    from PIL import Image

    return np.stack([np.asarray(Image.fromarray(arr[..., c].astype(np.float32), mode='F').resize((w, h), Image.BILINEAR)) for c in range(arr.shape[2])], -1)


def save_srgb(arr, path, q=90, size=None):
    import numpy as np
    from PIL import Image

    a = np.clip(arr, 0, 1)
    a = np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055)
    im = Image.fromarray((a * 255 + 0.5).astype(np.uint8))
    if size:
        im = im.resize(size, Image.LANCZOS)
    im.save(path, quality=q, optimize=True)


def floor_tile(size=2048):
    """Seamless plank albedo (TILE x TILE metres): planks along x, staggered joints, per-plank tone, grain, grooves."""
    import numpy as np

    px = size / TILE
    plank_w, plank_l = 0.2, 2.0
    yy, xx = np.mgrid[0:size, 0:size] / px
    row = np.floor(yy / plank_w).astype(int)
    off = (row * 0.37 % 1.0) * plank_l
    col = np.floor(((xx + off) % TILE) / plank_l).astype(int)
    pid = row * 13 + col * 7
    h = (np.sin(pid * 12.9898) * 43758.5453) % 1.0
    base = np.array([0.155, 0.055, 0.02])  # linear, warm dark wood
    tone = 0.78 + 0.45 * h
    gr = np.sin((xx * 3.1 + np.sin(yy * 9 + pid) * 0.6) * 6.0 + pid) * 0.5 + 0.5
    grain = 0.88 + 0.16 * gr
    img = base[None, None] * (tone * grain)[..., None]
    fy = (yy % plank_w) / plank_w
    fx = ((xx + off) % plank_l) / plank_l
    groove = np.minimum(np.minimum(fy, 1 - fy) * plank_w, np.minimum(fx, 1 - fx) * plank_l)
    img *= (0.35 + 0.65 * np.clip(groove / 0.008, 0, 1))[..., None]
    return img


def bake_export():
    import json

    import numpy as np

    build()
    os.makedirs(OUT_DIR, exist_ok=True)
    sc = SCN
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.max_bounces = 4
    q = float(os.environ.get('QUALITY', 1.0))
    # floor: replace the box by a plane with a tile UV (albedo) and a light UV (lightmap)
    old = [o for o in GROUPS['floor']]
    for o in old:
        bpy.data.objects.remove(o)
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((-FLOOR_X, FLOOR_Y0, 0), (FLOOR_X, FLOOR_Y0, 0), (FLOOR_X, FLOOR_Y1, 0), (-FLOOR_X, FLOOR_Y1, 0))]
    bm.faces.new(vs)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=7, use_grid_fill=True)
    me = bpy.data.meshes.new('arena_floor')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MATS['floor'])
    floor = bpy.data.objects.new('arena_floor', me)
    SCN.collection.objects.link(floor)
    uv_t = floor.data.uv_layers.new(name='tile')
    uv_l = floor.data.uv_layers.new(name='light')
    for lp in floor.data.loops:
        co = floor.data.vertices[lp.vertex_index].co
        uv_t.data[lp.index].uv = (co.x / TILE, co.y / TILE)
        uv_l.data[lp.index].uv = ((co.x + FLOOR_X) / (2 * FLOOR_X), (co.y - FLOOR_Y0) / (FLOOR_Y1 - FLOOR_Y0))
    # rug: planar UVs from object coordinates
    rug = to_mesh(GROUPS['rug'])[0]
    rug.name = 'arena_rug'
    uv = fresh_uv(rug)
    for lp in rug.data.loops:
        co = rug.data.vertices[lp.vertex_index].co
        uv.data[lp.index].uv = (co.x / 6.8 + 0.5, co.y / 6.8 + 0.5)
    # static set: one mesh, one atlas
    set_objs = to_mesh([o for o in GROUPS['set'] if o.name in bpy.data.objects])
    arena = join(set_objs, 'arena_set')
    fresh_uv(arena)
    select_only([arena])
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.002, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(rotate=True, margin=0.002)
    bpy.ops.object.mode_set(mode='OBJECT')
    tris = sum(len(p.vertices) - 2 for p in arena.data.polygons)
    print('[bake] set triangles', tris, flush=True)
    glow = to_mesh([o for o in GROUPS['glow'] if o.name in bpy.data.objects])

    S = 4096
    L = int(2048 * q)
    samples = int(96 * q)
    col = bake(arena, new_image('set_col', S, S), 'DIFFUSE', {'COLOR'}, 1)
    print('[bake] set colour done', flush=True)
    lit = bake(arena, new_image('set_light', L, L), 'DIFFUSE', {'DIRECT', 'INDIRECT'}, samples)
    print('[bake] set light done', flush=True)
    lit_d, _ = denoise(lit, 1.6)
    final = col[..., :3] * resize_f(lit_d, S, S)
    # floor lightmap (via the 'light' UV), rug albedo x light
    floor.data.uv_layers.active = floor.data.uv_layers['light']
    fl = bake(floor, new_image('floor_light', L, L // 2), 'DIFFUSE', {'DIRECT', 'INDIRECT'}, samples)
    fl_d, _ = denoise(fl, 1.4)
    rcol = bake(rug, new_image('rug_col', 2048, 2048), 'DIFFUSE', {'COLOR'}, 1)
    rl = bake(rug, new_image('rug_light', 1024, 1024), 'DIFFUSE', {'DIRECT', 'INDIRECT'}, samples)
    rl_d, _ = denoise(rl, 1.4)
    rfinal = rcol[..., :3] * resize_f(rl_d, 2048, 2048)
    print('[bake] floor + rug done', flush=True)

    # textures: linear radiance / range stored as sRGB (8-bit precision where it matters); the game multiplies by the
    # range in unlit materials and tone maps with AgX like the Blender preview
    def rng_of(a, cov=None):
        v = a.max(-1) if cov is None else a.max(-1)[cov > 0.5]
        return float(max(0.25, np.percentile(v, 99.7)))

    r_set = rng_of(final, col[..., 3])
    r_rug = rng_of(rfinal, rcol[..., 3])
    tile = floor_tile()
    r_floor = rng_of(fl_d, fl[..., 3])
    print('[bake] ranges set %.3f rug %.3f floor-light %.3f' % (r_set, r_rug, r_floor), flush=True)
    save_srgb(final / r_set, os.path.join(OUT_DIR, 'set.jpg'), 90)
    save_srgb(final / r_set, os.path.join(OUT_DIR, 'set_2k.jpg'), 88, (2048, 2048))
    save_srgb(rfinal / r_rug, os.path.join(OUT_DIR, 'rug.jpg'), 90)
    save_srgb(fl_d / r_floor, os.path.join(OUT_DIR, 'floor_light.jpg'), 92)
    save_srgb(tile, os.path.join(OUT_DIR, 'floor_tile.jpg'), 90)

    # glow meshes: joined per material, colour + intensity + animation group as extras
    by_mat = {}
    for o in glow:
        m = o.data.materials[0].name if o.data.materials else 'led_gold'
        by_mat.setdefault(m, []).append(o)
    exported = [arena, floor, rug]
    for m, objs in by_mat.items():
        g = join(objs, f'glow_{m}')
        bs = MATS[m].node_tree.nodes['Principled BSDF']
        c = list(bs.inputs['Emission Color'].default_value)[:3]
        g['rb_glow'] = json.dumps({'color': c, 'strength': bs.inputs['Emission Strength'].default_value, 'base': list(bs.inputs['Base Color'].default_value)[:3], 'anim': GLOW_ANIM.get(m, 'led')})
        while g.data.uv_layers:
            g.data.uv_layers.remove(g.data.uv_layers[0])
        exported.append(g)
    for o in exported:
        o.data.materials.clear()
    meta = {'range': r_set, 'rugRange': r_rug, 'floorRange': r_floor, 'tile': TILE, 'floor': [FLOOR_X, FLOOR_Y0, FLOOR_Y1], 'wallZ': -WALL_Y, 'stepZ': -STEP_Y, 'stepH': STEP_H, 'set_tris': tris}
    with open(os.path.join(OUT_DIR, 'arena.json'), 'w') as fh:
        json.dump(meta, fh, indent=1)
    select_only(exported)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT_DIR, 'arena.glb'), export_format='GLB', use_selection=True, export_yup=True,
                              export_texcoords=True, export_normals=False, export_materials='NONE', export_extras=True, export_apply=True)
    print('[bake] exported', OUT_DIR, flush=True)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    if cmd == 'preview':
        build()
    if cmd == 'preview':
        preview(sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'artifacts', 'arena', 'podcast_preview.png'))
    elif cmd == 'bake':
        bake_export()
