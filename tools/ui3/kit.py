# Design v3 (S13b, D46): the stylized 3D UI kit - every piece is real geometry rendered in Cycles: chunky beveled
# panels, metallic frames with rivets, glossy candy buttons, 3D icons, gold chains. Units: 1 m = 100 reference px
# (the 1672x941 layout); pieces are built centred on the origin, facing +Z (the ortho camera looks down -Z).
import math
import os

import lib
from lib import Matrix, Vector, bpy, bmesh

INK = '#120b18'
CANDY = {
    # face top, face bottom, frame tint, edge (dark lip)
    'gold': ('#ffd84a', '#ff9500', '#ffcf3d', '#5a2a00'),
    'blue': ('#4fc3ff', '#1565e0', '#9fdcff', '#06215a'),
    'red': ('#ff5f6d', '#c4122e', '#ffb0b8', '#4a0612'),
    'green': ('#8dff5a', '#21b62a', '#d4ffb8', '#0a4410'),
    'purple': ('#c27bff', '#6a1fd6', '#e3c2ff', '#26084f'),
    'navy': ('#2a3591', '#0c1240', '#7d8ae0', '#05081f'),
    'dark': ('#2a2540', '#100c1c', '#6a6488', '#05030a'),
}
_mats = {}


def M(key, fn):
    if key not in _mats or _mats[key].name not in bpy.data.materials:
        _mats[key] = fn()
    return _mats[key]


def gold(t='#ffbf2e', r=0.2):
    return M(f'gold{t}{r}', lambda: lib.gold(f'gold{t}', t, r))


def steel(t='#8a93ab', r=0.3):
    return M(f'steel{t}{r}', lambda: lib.steel(f'steel{t}', t, r))


def ink():
    return M('ink', lambda: lib.mat('ink', lib.srgb('#1a1222'), rough=0.6))


def candy(name, top, bot, h=1.0, rough=0.28, coat=0.6, axis='Y', emission=0.0, spec=0.5):
    return M(f'candy{top}{bot}{h}{axis}{emission}{spec}{rough}{coat}', lambda: lib.gradient_mat(name, top, bot, rough=rough, coat=coat, axis=axis, lo=-h / 2, hi=h / 2, emission=emission, spec=spec))


def flat(hexcol, rough=0.4, coat=0.0, metallic=0.0):
    return M(f'flat{hexcol}{rough}{coat}{metallic}', lambda: lib.mat(f'flat{hexcol}', lib.srgb(hexcol), rough=rough, coat=coat, metallic=metallic))


def glow(hexcol, strength=4.0):
    return M(f'glow{hexcol}{strength}', lambda: lib.mat(f'glow{hexcol}', lib.srgb(hexcol), emission=lib.srgb(hexcol), estr=strength))


def image_mat(name, path, emission=1.0, rough=0.5, alpha=True):
    """A picture on a card (art window, banner print): emissive so it keeps its colours under any light."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(path, check_existing=True)
    tex.extension = 'CLIP'
    nt.links.new(tex.outputs['Color'], p.inputs['Base Color'])
    if emission:
        nt.links.new(tex.outputs['Color'], p.inputs['Emission Color'])
        p.inputs['Emission Strength'].default_value = emission
    if alpha:
        nt.links.new(tex.outputs['Alpha'], p.inputs['Alpha'])
        m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    p.inputs['Roughness'].default_value = rough
    return m


def plane(name, w, h, material, z=0.0, loc=(0, 0)):
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, 0)) for x, y in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2))]
    f = bm.faces.new(vs)
    uv = bm.loops.layers.uv.new()
    for lp, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = (u, v)
    o = lib.obj_from_bm(name, bm, material, smooth=False)
    o.location = (loc[0], loc[1], z)
    return o


# ------------------------------------------------------------------ chains
_link_mesh = {}


def _link(len_, wire, r):
    key = (round(len_, 4), round(wire, 4))
    if key in _link_mesh and _link_mesh[key].name in bpy.data.objects:
        return _link_mesh[key]
    s = max(0.0, len_ - 2 * r)
    pts = []
    for cx, a0 in ((s / 2, -90), (-s / 2, 90)):
        for i in range(13):
            a = math.radians(a0 + 180 * i / 12)
            pts.append((cx + r * math.cos(a), r * math.sin(a), 0))
    o = lib.tube_path('link', pts, wire, gold('#ffbf2e', 0.18), closed=True, res=4)
    bpy.context.view_layer.update()
    # to mesh so it can be instanced cheaply
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    bpy.data.objects.remove(o)
    lo = lib.link(bpy.data.objects.new('linkmesh', me))
    lo.hide_render = True
    lo.hide_viewport = True
    for p in me.polygons:
        p.use_smooth = True
    _link_mesh[key] = lo
    return lo


def chain(name, pts, link_len=0.34, wire=0.045, material=None, z=0.0, twist=0.0):
    """Interlocking gold chain along a polyline (list of (x, y[, z])); links alternate 90 deg about the axis."""
    r = link_len * 0.3
    src = _link(link_len, wire, r)
    me = src.data
    if material:
        me = me.copy()
        me.materials.clear()
        me.materials.append(material)
    P = [Vector((p[0], p[1], p[2] if len(p) > 2 else z)) for p in pts]
    # resample by arc length
    seg = [(P[i + 1] - P[i]).length for i in range(len(P) - 1)]
    L = sum(seg)
    step = link_len - 2 * wire - 0.01 * link_len
    n = max(1, int(L / step))
    out = []
    for k in range(n + 1):
        d = k * L / n
        i = 0
        while i < len(seg) - 1 and d > seg[i]:
            d -= seg[i]
            i += 1
        t = d / max(1e-6, seg[i])
        p = P[i].lerp(P[i + 1], min(1, t))
        tan = (P[i + 1] - P[i]).normalized()
        o = lib.link(bpy.data.objects.new(f'{name}{k}', me))
        rot = tan.to_track_quat('X', 'Z').to_matrix().to_4x4()
        spin = Matrix.Rotation(twist + (math.pi / 2 if k % 2 else 0.35), 4, 'X')
        o.matrix_world = Matrix.Translation(p) @ rot @ spin
        out.append(o)
    return out


def hang(p0, p1, sag, n=16):
    """Points of a chain hanging between two points (parabola in the screen plane)."""
    p0, p1 = Vector(p0), Vector(p1)
    return [tuple(p0.lerp(p1, i / n) - Vector((0, sag * 4 * (i / n) * (1 - i / n), 0))) for i in range(n + 1)]


# ------------------------------------------------------------------ panels and buttons
def rivets(pts, z, r=0.032, material=None):
    for i, (x, y) in enumerate(pts):
        lib.sphere(f'rivet{i}', (x, y, z), r, material or gold('#ffe08a', 0.15), scale=(1, 1, 0.55), seg=16)


def corners(w, h, inset):
    return [(sx * (w / 2 - inset), sy * (h / 2 - inset)) for sx in (-1, 1) for sy in (-1, 1)]


def panel(w, h, r=0.2, face=('#26307f', '#0d1240'), rim='gold', rim_w=0.075, depth=0.16, rivet=True, inner_line=None, pts=None, coat=0.35, rough=0.42):
    """Chunky enamel panel with a beveled metal frame. Returns the top z (for things laid on it)."""
    outer = pts or lib.rounded_rect_pts(w, h, r)
    rim_mat = {'gold': gold(), 'steel': steel(), 'dark': steel('#4b4f63', 0.35)}.get(rim) if isinstance(rim, str) and rim in ('gold', 'steel', 'dark') else candy('rim' + rim, CANDY[rim][2], CANDY[rim][1], h) if isinstance(rim, str) else rim
    lib.frame('rim', outer, rim_w, depth + 0.06, rim_mat, bevel=min(rim_w, 0.06) * 0.45)
    lib.slab('face', lib.inset(outer, rim_w * 0.8), depth, 0.035, candy(f'face{coat}{rough}', face[0], face[1], h, rough=rough, coat=coat, spec=0.5 if coat > 0.2 else 0.12), seg=4)
    if inner_line:
        lib.frame('line', lib.inset(outer, rim_w + 0.05), 0.012, depth + 0.012, glow(inner_line, 2.5), bevel=0.004, seg=2)
    if rivet:
        rivets(corners(w, h, rim_w * 0.5 + 0.035), depth + 0.07)
    return depth + 0.06


def candy_button(w, h, color='gold', r=None, depth=0.3, chains=False, gloss=True, frame_mat=None):
    """Glossy 3D push button: metal frame, dark lip, candy face graded top -> bottom, a soft gloss band."""
    top, bot, fr, edge = CANDY[color]
    r = r if r is not None else min(h * 0.32, 0.42)
    outer = lib.rounded_rect_pts(w, h, r)
    fw = max(0.06, min(0.15, h * 0.11))
    lib.frame('rim', outer, fw, depth + 0.08, frame_mat or (gold() if color == 'gold' else candy('rim' + color, fr, bot, h)), bevel=fw * 0.45)
    lib.frame('lip', lib.inset(outer, fw * 0.95), 0.035, depth, flat(edge, 0.5), bevel=0.015)
    lib.slab('face', lib.inset(outer, fw * 1.15), depth - 0.04, min(0.09, h * 0.08), candy('face' + color, top, bot, h * 0.9), seg=6)
    if gloss:
        gh = h * 0.24
        g = lib.slab('gloss', lib.rounded_rect_pts(w - 2 * fw - 0.24, gh, gh / 2), 0.012, 0.005, M('gloss', lambda: lib.mat('gloss', (1, 1, 1), rough=0.1, alpha=0.13, emission=(1, 1, 1), estr=0.18)), z0=depth - 0.035)
        g.location.y = h / 2 - fw - gh * 0.72
    rivets(corners(w, h, fw * 0.5), depth + 0.09, r=min(0.045, fw * 0.32), material=steel('#f2ecd8', 0.2))
    if chains:
        for sx in (-1, 1):
            chain(f'ch{sx}', hang((sx * (w / 2 - 0.05), h * 0.18, 0.15), (sx * (w / 2 + 0.6), -h * 0.62, 0.15), 0.12), 0.36, 0.05)
    return depth + 0.08


def pill(w, h, color='dark', rim='gold'):
    """Currency capsule: dark glossy body in a thin metal rim."""
    pts = lib.rounded_rect_pts(w, h, h / 2 - 0.001, seg=14)
    lib.frame('rim', pts, 0.045, 0.14, gold() if rim == 'gold' else steel(), bevel=0.02)
    lib.slab('face', lib.inset(pts, 0.035), 0.1, 0.03, candy('pillface', '#2b2648', '#0e0b1c', h, rough=0.3, coat=0.8), seg=4)
    return 0.14


def disc(r, color='red', depth=0.12, rim='gold'):
    top, bot, fr, edge = CANDY[color]
    pts = [(r * math.cos(a), r * math.sin(a)) for a in [2 * math.pi * i / 48 for i in range(48)]]
    lib.frame('rim', pts, r * 0.18, depth + 0.04, gold() if rim == 'gold' else candy('drim' + color, fr, bot, 2 * r), bevel=r * 0.07)
    lib.slab('face', lib.inset(pts, r * 0.15), depth, r * 0.12, candy('dface' + color, top, bot, 2 * r), seg=6)
    return depth + 0.04


def badge(r=0.18):
    """Red alert badge with a white '!'"""
    disc(r, 'red', 0.1, rim='white')
    z = 0.11
    bar = lib.slab('ex', lib.rounded_rect_pts(r * 0.24, r * 0.82, r * 0.11), 0.05, 0.015, flat('#ffffff', 0.3, 0.5), z0=z)
    bar.location.y = r * 0.18
    lib.sphere('dot', (0, -r * 0.5, z + 0.02), r * 0.13, flat('#ffffff', 0.3, 0.5), scale=(1, 1, 0.5))


# ------------------------------------------------------------------ 3D icons (unit size ~1 m, centred)
def tilt(objs, rx=12, ry=-16, rz=0):
    root = bpy.data.objects.new('tilt', None)
    lib.link(root)
    for o in objs:
        if o.parent is None:
            o.parent = root
    root.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
    return root


def new_objs(fn):
    before = set(bpy.data.objects)
    fn()
    return [o for o in bpy.data.objects if o not in before and not o.hide_render]


def icon_coin(s=1.0):
    def f():
        g = gold('#ffb21f', 0.2)
        lib.cylinder('c', (0, 0, 0), 0.5 * s, 0.17 * s, g, seg=64, bevel=0.05 * s)
        ring = [(0.41 * s * math.cos(a), 0.41 * s * math.sin(a)) for a in [2 * math.pi * i / 64 for i in range(64)]]
        lib.frame('ring', ring, 0.045 * s, 0.03 * s, gold('#ffd75a', 0.15), z0=0.085 * s)
        pts = [(-0.24, -0.15), (0.24, -0.15), (0.29, 0.15), (0.12, 0.0), (0.0, 0.23), (-0.12, 0.0), (-0.29, 0.15)]
        lib.slab('crown', [(x * s, y * s) for x, y in pts], 0.05 * s, 0.018 * s, gold('#ffe36b', 0.12), z0=0.085 * s)
    return tilt(new_objs(f), 12, -20)


def icon_gem(s=1.0):
    def f():
        bm = bmesh.new()
        n = 8
        table = [bm.verts.new((0.27 * s * math.cos(2 * math.pi * i / n), 0.27 * s * math.sin(2 * math.pi * i / n), 0.2 * s)) for i in range(n)]
        gird = [bm.verts.new((0.5 * s * math.cos(2 * math.pi * (i + 0.5) / n), 0.5 * s * math.sin(2 * math.pi * (i + 0.5) / n), 0.04 * s)) for i in range(n)]
        tip = bm.verts.new((0, 0, -0.44 * s))
        bm.faces.new(table)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((table[i], gird[i], table[j]))
            bm.faces.new((gird[i], gird[j], table[j]))
            bm.faces.new((gird[i], tip, gird[j]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        lib.obj_from_bm('gem', bm, M('gemglass', lambda: lib.mat('gem', lib.srgb('#0a7bff'), rough=0.02, transmission=1.0, ior=1.6)), smooth=False)
        lib.sphere('core', (0, 0, -0.05 * s), 0.19 * s, glow('#3fa0ff', 3.0))
    r = tilt(new_objs(f), -62, 0, 8)
    return r


def icon_bolt(s=1.0):
    def f():
        pts = [(0.08, 0.55), (-0.3, -0.05), (-0.02, -0.05), (-0.12, -0.55), (0.32, 0.12), (0.04, 0.12), (0.18, 0.55)]
        pts = [(x * s, y * s) for x, y in reversed(pts)]
        lib.slab('bolt', lib.round_corners(pts, 0.03 * s, 3), 0.16 * s, 0.05 * s, candy('bolt', '#ffe02a', '#ff8800', s), seg=4)
    return tilt(new_objs(f), 10, -14)


def icon_plus(s=1.0, color='green'):
    def f():
        candy_button(0.9 * s, 0.9 * s, color, r=0.2 * s, depth=0.18 * s, gloss=False, frame_mat=flat('#0f3d12', 0.5))
        bars = [lib.slab('p', lib.rounded_rect_pts(w_ * s, h_ * s, 0.06 * s), 0.07 * s, 0.0, None, z0=0.16 * s) for w_, h_ in ((0.52, 0.16), (0.16, 0.52))]
        union(bars, 'plus', 0.008 * s, 3, flat('#ffffff', 0.3, 0.6))
    return tilt(new_objs(f), 0, 0)


def icon_mail(s=1.0):
    def f():
        w, h = 0.9 * s, 0.62 * s
        lib.slab('env', lib.rounded_rect_pts(w, h, 0.06 * s), 0.12 * s, 0.03 * s, candy('env', '#ffffff', '#c9d4ff', h, rough=0.4, coat=0.3), seg=3)
        flap = [(-w / 2 + 0.04 * s, h / 2 - 0.03 * s), (0, -0.02 * s), (w / 2 - 0.04 * s, h / 2 - 0.03 * s)]
        lib.tube_path('flap', [(x, y, 0.125 * s) for x, y in flap], 0.022 * s, flat('#9fb0e8', 0.4), closed=False, res=3)
        lib.sphere('seal', (0, -0.04 * s, 0.14 * s), 0.09 * s, candy('seal', '#ff6070', '#c4122e', 0.2), scale=(1, 1, 0.45))
    return tilt(new_objs(f), 8, -14)


def icon_gear(s=1.0):
    def f():
        pts = []
        teeth = 9
        for i in range(teeth * 4):
            a = 2 * math.pi * i / (teeth * 4)
            rr = 0.5 if (i % 4) in (1, 2) else 0.38
            pts.append((rr * s * math.cos(a), rr * s * math.sin(a)))
        lib.slab('gear', lib.round_corners(pts, 0.02 * s, 2), 0.16 * s, 0.04 * s, steel('#c9d2e6', 0.25), seg=3)
        lib.cylinder('hub', (0, 0, 0.17 * s), 0.17 * s, 0.06 * s, candy('hub', '#4fc3ff', '#1565e0', 0.3), seg=40, bevel=0.02 * s)
    return tilt(new_objs(f), 10, -16)


def icon_home(s=1.0, color='blue'):
    def f():
        top, bot = CANDY[color][0], CANDY[color][1]
        body = [(-0.32, -0.42), (0.32, -0.42), (0.32, 0.06), (-0.32, 0.06)]
        lib.slab('body', [(x * s, y * s) for x, y in body], 0.2 * s, 0.04 * s, candy('hb' + color, '#ffffff', '#cfd8ff', s, coat=0.4), seg=3)
        roof = [(-0.5, 0.02), (0.0, 0.48), (0.5, 0.02), (0.38, 0.02), (0.0, 0.33), (-0.38, 0.02)]
        lib.slab('roof', lib.round_corners([(x * s, y * s) for x, y in roof], 0.02 * s, 2), 0.26 * s, 0.04 * s, candy('roof' + color, top, bot, s), seg=3)
        door = [(-0.1, -0.42), (0.1, -0.42), (0.1, -0.12), (-0.1, -0.12)]
        lib.slab('door', [(x * s, y * s) for x, y in door], 0.04 * s, 0.015 * s, candy('door' + color, top, bot, s), z0=0.2 * s)
    return tilt(new_objs(f), 8, -14)


def union(parts, name, voxel, smooth, material):
    """Boolean union of overlapping solids via a voxel remesh (+ smoothing); sources removed."""
    bm = bmesh.new()
    dg = bpy.context.evaluated_depsgraph_get()
    for o in parts:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        me.transform(o.matrix_world)
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        bpy.data.objects.remove(o)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = lib.link(bpy.data.objects.new(name, me))
    r = o.modifiers.new('remesh', 'REMESH')
    r.mode = 'VOXEL'
    r.voxel_size = voxel
    if smooth:
        sm = o.modifiers.new('smooth', 'SMOOTH')
        sm.iterations = smooth
    o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def icon_glove(s=1.0, color='red'):
    """Boxing glove: spheres united by a voxel remesh (fist, thumb, cuff) + white cuff band."""
    def f():
        top, bot = CANDY[color][0], CANDY[color][1]
        parts = [
            lib.sphere('g1', (0.04 * s, 0.14 * s, 0), 0.34 * s, None, scale=(1.0, 0.95, 0.85)),
            lib.sphere('g2', (0.16 * s, 0.24 * s, 0.04 * s), 0.24 * s, None, scale=(1, 1, 0.8)),
            lib.sphere('g3', (-0.2 * s, 0.0, 0.1 * s), 0.16 * s, None, scale=(1.3, 0.85, 0.75)),
            lib.cylinder('g4', (-0.02 * s, -0.26 * s, 0), 0.21 * s, 0.3 * s, None, seg=32, rot=(math.radians(90), 0, 0)),
        ]
        bm = bmesh.new()
        dg = bpy.context.evaluated_depsgraph_get()
        for o in parts:
            me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
            me.transform(o.matrix_world)
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
            bpy.data.objects.remove(o)
        me = bpy.data.meshes.new('glove')
        bm.to_mesh(me)
        bm.free()
        o = lib.link(bpy.data.objects.new('glove', me))
        r = o.modifiers.new('remesh', 'REMESH')
        r.mode = 'VOXEL'
        r.voxel_size = 0.018 * s
        sm = o.modifiers.new('smooth', 'SMOOTH')
        sm.iterations = 6
        o.data.materials.append(candy('glove' + color, top, bot, 0.9 * s, coat=0.8))
        band = lib.cylinder('band', (-0.02 * s, -0.33 * s, 0), 0.225 * s, 0.1 * s, flat('#ffffff', 0.4, 0.4), seg=40, rot=(math.radians(90), 0, 0), bevel=0.02 * s)
    return tilt(new_objs(f), 10, -24, -18)


def icon_cards(s=1.0):
    def f():
        for i, (c, rz, dx) in enumerate((('blue', 14, -0.16), ('purple', 0, 0.0), ('red', -14, 0.16))):
            pts = lib.rounded_rect_pts(0.5 * s, 0.72 * s, 0.06 * s)
            o = lib.slab(f'card{i}', pts, 0.05 * s, 0.015 * s, candy('card' + c, CANDY[c][0], CANDY[c][1], 0.72 * s), z0=i * 0.06 * s)
            lib.frame(f'cf{i}', pts, 0.035 * s, 0.07 * s, gold(), z0=i * 0.06 * s, bevel=0.012 * s)
            for ob in (o, bpy.data.objects[f'cf{i}']):
                ob.rotation_euler = (0, 0, math.radians(rz))
                ob.location = (dx * s, -abs(dx) * 0.3 * s, 0)
    return tilt(new_objs(f), 8, -12)


def icon_trophy(s=1.0):
    def f():
        prof = [(0.0, -0.45), (0.26, -0.45), (0.26, -0.37), (0.1, -0.33), (0.07, -0.12), (0.12, -0.06), (0.3, 0.12), (0.34, 0.42), (0.0, 0.42)]
        bm = bmesh.new()
        n = 40
        rings = []
        for i in range(n):
            a = 2 * math.pi * i / n
            rings.append([bm.verts.new((x * s * math.cos(a), x * s * math.sin(a), y * s)) for x, y in prof])
        for i in range(n):
            j = (i + 1) % n
            for k in range(len(prof) - 1):
                bm.faces.new((rings[i][k], rings[j][k], rings[j][k + 1], rings[i][k + 1]))
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        o = lib.obj_from_bm('cup', bm, gold('#ffbf2e', 0.18))
        o.rotation_euler = (math.radians(-90), 0, 0)
        for sx in (-1, 1):
            h = lib.torus(f'h{sx}', (sx * 0.34 * s, 0.22 * s, 0), 0.12 * s, 0.035 * s, gold('#ffbf2e', 0.18))
    return tilt(new_objs(f), 6, -10)


def icon_bag(s=1.0, color='purple'):
    def f():
        top, bot = CANDY[color][0], CANDY[color][1]
        body = [(-0.36, -0.42), (0.36, -0.42), (0.3, 0.2), (-0.3, 0.2)]
        lib.slab('bag', lib.round_corners([(x * s, y * s) for x, y in body], 0.06 * s, 3), 0.3 * s, 0.06 * s, candy('bag' + color, top, bot, s), seg=4)
        lib.tube_path('handle', [(0.18 * s * math.cos(a), 0.2 * s + 0.2 * s * math.sin(a), 0.15 * s) for a in [math.pi * i / 16 for i in range(17)]], 0.035 * s, gold(), closed=False)
        star = [(0.16 * math.cos(math.pi / 2 + i * math.pi / 5) * (1 if i % 2 == 0 else 0.45), 0.16 * math.sin(math.pi / 2 + i * math.pi / 5) * (1 if i % 2 == 0 else 0.45) - 0.12) for i in range(10)]
        lib.slab('star', [(x * s, y * s) for x, y in star], 0.04 * s, 0.012 * s, gold('#ffe36b', 0.15), z0=0.3 * s)
    return tilt(new_objs(f), 8, -16)


def icon_people(s=1.0, color='blue'):
    def f():
        top, bot = CANDY[color][0], CANDY[color][1]
        for dx, sc, z in ((-0.2, 0.85, -0.05), (0.2, 0.85, -0.05), (0.0, 1.0, 0.1)):
            lib.sphere('head', (dx * s, 0.16 * s * sc + 0.04 * s, z * s + 0.1 * s), 0.17 * s * sc, candy('ph' + color, top, bot, 0.5 * s))
            b = lib.sphere('body', (dx * s, -0.24 * s * sc, z * s), 0.3 * s * sc, candy('pb' + color, top, bot, 0.9 * s), scale=(1, 0.75, 0.6))
    return tilt(new_objs(f), 8, -12)


def icon_crown(s=1.0):
    def f():
        pts = [(-0.42, -0.22), (0.42, -0.22), (0.5, 0.28), (0.22, 0.04), (0.0, 0.38), (-0.22, 0.04), (-0.5, 0.28)]
        lib.slab('crown', lib.round_corners([(x * s, y * s) for x, y in pts], 0.03 * s, 3), 0.2 * s, 0.05 * s, gold('#ffc02e', 0.18), seg=4)
        for x, y in ((-0.5, 0.28), (0.0, 0.38), (0.5, 0.28)):
            lib.sphere('jewel', (x * s, y * s + 0.04 * s, 0.12 * s), 0.07 * s, gold('#ffe36b', 0.12))
        for i, x in enumerate((-0.22, 0.0, 0.22)):
            lib.sphere('gem', (x * s, -0.1 * s, 0.21 * s), 0.055 * s, glow(('#ff3355', '#3d8dff', '#21d35a')[i], 1.5), scale=(1, 1, 0.5))
    return tilt(new_objs(f), 8, -14)


def icon_calendar(s=1.0):
    def f():
        lib.slab('cal', lib.rounded_rect_pts(0.8 * s, 0.76 * s, 0.1 * s), 0.14 * s, 0.03 * s, candy('cal', '#ffffff', '#d6dcff', s), seg=3)
        top = lib.slab('calt', lib.rounded_rect_pts(0.8 * s, 0.22 * s, 0.08 * s), 0.16 * s, 0.03 * s, candy('calt', '#ff5f6d', '#c4122e', 0.3 * s))
        top.location.y = 0.27 * s
        for x in (-0.2, 0.2):
            lib.cylinder('ring', (x * s, 0.38 * s, 0.1 * s), 0.04 * s, 0.2 * s, steel(), seg=16, rot=(math.radians(90), 0, 0))
        for i in range(6):
            lib.slab(f'd{i}', lib.rounded_rect_pts(0.14 * s, 0.12 * s, 0.03 * s), 0.02 * s, 0.006 * s, flat('#4a5bd6', 0.4), z0=0.14 * s).location = ((-0.22 + 0.22 * (i % 3)) * s, (-0.02 - 0.18 * (i // 3)) * s, 0)
    return tilt(new_objs(f), 8, -14)


def icon_ticket(s=1.0):
    def f():
        pts = lib.rounded_rect_pts(0.95 * s, 0.56 * s, 0.08 * s)
        lib.slab('t', pts, 0.1 * s, 0.03 * s, gold('#ffbf2e', 0.22), seg=3)
        lib.frame('tf', lib.inset(pts, 0.06 * s), 0.025 * s, 0.12 * s, gold('#ffe36b', 0.15), bevel=0.008 * s)
    objs = new_objs(f)
    r = tilt(objs, 10, -16, 12)
    icon_crown(0.5 * s).parent = r
    return r


def icon_clipboard(s=1.0):
    def f():
        lib.slab('board', lib.rounded_rect_pts(0.72 * s, 0.92 * s, 0.08 * s), 0.08 * s, 0.03 * s, candy('board', '#c98a4a', '#8a5222', s), seg=3)
        lib.slab('paper', lib.rounded_rect_pts(0.58 * s, 0.72 * s, 0.03 * s), 0.02 * s, 0.006 * s, flat('#ffffff', 0.5), z0=0.08 * s).location.y = -0.05 * s
        clip = lib.slab('clip', lib.rounded_rect_pts(0.32 * s, 0.14 * s, 0.05 * s), 0.08 * s, 0.025 * s, steel('#c9d2e6'), z0=0.08 * s)
        clip.location.y = 0.44 * s
        for i in range(3):
            y = (0.18 - 0.2 * i) * s
            chk = [(-0.22 * s, y), (-0.17 * s, y - 0.05 * s), (-0.08 * s, y + 0.06 * s)]
            lib.tube_path(f'ck{i}', [(x, yy, 0.11 * s) for x, yy in chk], 0.02 * s, flat('#21b62a', 0.4), closed=False, res=2)
            lib.slab(f'ln{i}', lib.rounded_rect_pts(0.24 * s, 0.04 * s, 0.02 * s), 0.01 * s, 0.004 * s, flat('#9aa6d6', 0.5), z0=0.1 * s).location = (0.1 * s, y, 0)
    return tilt(new_objs(f), 8, -14)


def icon_mic(s=1.0):
    def f():
        lib.sphere('head', (0, 0.26 * s, 0), 0.22 * s, steel('#d8dde8', 0.35))
        lib.cylinder('neck', (0, 0.06 * s, 0), 0.17 * s, 0.08 * s, gold(), seg=40, rot=(math.radians(90), 0, 0))
        b = lib.cylinder('body', (0, -0.24 * s, 0), 0.11 * s, 0.5 * s, candy('mic', '#3a3550', '#120f1e', 0.5 * s), seg=40, rot=(math.radians(90), 0, 0))
        b.scale = (1, 1, 1)
    return tilt(new_objs(f), 10, -20, -24)


ICONS = {
    'coin': icon_coin, 'gem': icon_gem, 'bolt': icon_bolt, 'plus': icon_plus, 'mail': icon_mail, 'gear': icon_gear,
    'home': icon_home, 'glove': icon_glove, 'cards': icon_cards, 'trophy': icon_trophy, 'bag': icon_bag,
    'people': icon_people, 'crown': icon_crown, 'calendar': icon_calendar, 'ticket': icon_ticket,
    'clipboard': icon_clipboard, 'mic': icon_mic,
}


def place(root, x, y, z, size):
    """Move/scale an icon root (built at unit size) to (x, y) with the given size (m)."""
    root.location = (x, y, z)
    root.scale = (size, size, size)
    return root


def icon_chest(s=1.0, color='purple'):
    """Loot chest: candy body, rounded lid, gold bands and lock."""
    def f():
        top, bot = CANDY[color][0], CANDY[color][1]
        w, d, h = 0.9 * s, 0.55 * s, 0.42 * s
        lib.slab('base', lib.rounded_rect_pts(w, h, 0.05 * s), d, 0.04 * s, candy('chest' + color, top, bot, h), seg=3, z0=-d / 2).location.y = -0.12 * s
        lid = lib.cylinder('lid', (0, 0.09 * s, 0), d / 2, w, candy('lid' + color, top, bot, d), seg=40, rot=(0, math.radians(90), 0), bevel=0.03 * s)
        lid.scale = (1, 0.75, 1)
        for x in (-0.3, 0.3):
            lib.slab('band', lib.rounded_rect_pts(0.1 * s, 0.68 * s, 0.03 * s), d + 0.04 * s, 0.015 * s, gold(), z0=-d / 2 - 0.02 * s).location = (x * s, -0.06 * s, 0)
        lib.slab('lock', lib.rounded_rect_pts(0.16 * s, 0.2 * s, 0.04 * s), 0.06 * s, 0.02 * s, gold('#ffe36b', 0.15), z0=d / 2).location.y = -0.04 * s
        for k in range(5):
            lib.sphere('coin', ((-0.3 + 0.15 * k) * s, (0.32 + 0.04 * (k % 2)) * s, 0.0), 0.08 * s, gold('#ffd23f', 0.2), scale=(1, 1, 0.35))
    return tilt(new_objs(f), 14, -22)


ICONS['chest'] = icon_chest


def icon_lock(s=1.0):
    def f():
        lib.slab('body', lib.rounded_rect_pts(0.62 * s, 0.5 * s, 0.1 * s), 0.22 * s, 0.05 * s, gold('#ffbf2e', 0.22), seg=3, z0=-0.11 * s).location.y = -0.16 * s
        arc = [(0.19 * s * math.cos(a), 0.09 * s + 0.2 * s * math.sin(a), 0) for a in [math.pi * i / 20 for i in range(21)]]
        arc = [(arc[0][0], -0.05 * s, 0)] + arc + [(arc[-1][0], -0.05 * s, 0)]
        lib.tube_path('shackle', arc, 0.055 * s, steel('#c9d2e6', 0.25), closed=False)
        lib.sphere('hole', (0, -0.14 * s, 0.11 * s), 0.06 * s, flat('#3a1d00', 0.5), scale=(1, 1, 0.4))
    return tilt(new_objs(f), 8, -14)


ICONS['lock'] = icon_lock


def octagon_pts(w, h, cut=0.2, r=0.02):
    cx, cy = w * cut, h * cut
    pts = [(-w / 2 + cx, -h / 2), (w / 2 - cx, -h / 2), (w / 2, -h / 2 + cy), (w / 2, h / 2 - cy), (w / 2 - cx, h / 2), (-w / 2 + cx, h / 2), (-w / 2, h / 2 - cy), (-w / 2, -h / 2 + cy)]
    return lib.round_corners(pts, r, 3) if r else pts


FONTS = {
    'lilita': os.path.join(lib.ROOT, 'node_modules', '@fontsource', 'lilita-one', 'files', 'lilita-one-latin-400-normal.woff'),
    'anton': os.path.join(lib.ROOT, 'tools', 'arena', 'fonts', 'Anton_400Regular.ttf'),
}


def text3d(name, s, size, material, depth=0.12, bevel=0.03, font='lilita', align='CENTER', loc=(0, 0, 0), rot=(0, 0, 0)):
    """Extruded, beveled 3D lettering (emblems like the gold VS - real UI text stays native German HTML)."""
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = s
    cu.font = bpy.data.fonts.load(FONTS[font], check_existing=True)
    cu.size = size
    cu.extrude = depth
    cu.bevel_depth = bevel
    cu.bevel_resolution = 4
    cu.align_x = align
    cu.align_y = 'CENTER'
    o = lib.link(bpy.data.objects.new(name, cu))
    o.data.materials.append(material)
    o.location = loc
    o.rotation_euler = rot
    return o


def arrow(w, h, color='gold', left=True):
    """Chunky candy chevron button (arena arrows)."""
    pts = [(-0.22, 0.5), (0.3, 0.0), (-0.22, -0.5), (-0.42, -0.34), (0.0, 0.0), (-0.42, 0.34)]
    pts = [((-x if left else x) * w, y * h) for x, y in pts]
    if left:
        pts = list(reversed(pts))
    top, bot, fr, edge = CANDY[color]
    lib.slab('arrow', lib.round_corners(pts, 0.04, 3), 0.22, 0.05, candy('arrow' + color, top, bot, h), seg=4)


def icon_bulb(s=1.0):
    def f():
        lib.sphere('glass', (0, 0.1 * s, 0), 0.32 * s, candy('bulb', '#fff4a0', '#ffc21a', 0.6 * s, emission=0.8))
        lib.cylinder('base', (0, -0.3 * s, 0), 0.15 * s, 0.22 * s, steel('#c9d2e6', 0.25), seg=24, rot=(math.radians(90), 0, 0), bevel=0.02 * s)
    return tilt(new_objs(f), 6, -10)


ICONS['bulb'] = icon_bulb


def icon_shield(s=1.0, color='green'):
    def f():
        top, bot = CANDY[color][0], CANDY[color][1]
        pts = [(-0.4, 0.42), (0.4, 0.42), (0.4, 0.02), (0.0, -0.48), (-0.4, 0.02)]
        pts = lib.round_corners([(x * s, y * s) for x, y in pts], 0.08 * s, 4)
        lib.frame('srim', pts, 0.07 * s, 0.22 * s, gold(), bevel=0.03 * s)
        lib.slab('shield', lib.inset(pts, 0.06 * s), 0.18 * s, 0.05 * s, candy('sh' + color, top, bot, s), seg=4)
    return tilt(new_objs(f), 6, -12)


def icon_wing(s=1.0, color='blue'):
    """Speed: three swept feathers."""
    def f():
        top, bot = CANDY[color][0], CANDY[color][1]
        for k in range(3):
            pts = [(-0.42, -0.1 + 0.18 * k), (0.4, 0.28 + 0.12 * k), (0.3, 0.12 + 0.12 * k), (-0.38, -0.24 + 0.18 * k)]
            lib.slab(f'f{k}', lib.round_corners([(x * s, (y - 0.12) * s) for x, y in pts], 0.06 * s, 3), 0.12 * s, 0.035 * s, candy('wing' + color, top, bot, s), seg=3, z0=-0.03 * k * s)
    return tilt(new_objs(f), 6, -12)


ICONS['shield'] = icon_shield
ICONS['wing'] = icon_wing


def icon_jacket(s=1.0, color='gold'):
    def f():
        top, bot = CANDY[color][0], CANDY[color][1]
        body = [(-0.3, -0.45), (0.3, -0.45), (0.3, 0.12), (0.5, -0.1), (0.62, 0.05), (0.32, 0.42), (0.12, 0.46), (0.0, 0.32), (-0.12, 0.46), (-0.32, 0.42), (-0.62, 0.05), (-0.5, -0.1), (-0.3, 0.12)]
        lib.slab('jacket', lib.round_corners([(x * s, y * s) for x, y in body], 0.04 * s, 3), 0.24 * s, 0.06 * s, candy('jk' + color, top, bot, s), seg=4)
        lib.slab('zip', lib.rounded_rect_pts(0.05 * s, 0.7 * s, 0.02 * s), 0.04 * s, 0.01 * s, flat('#2a1600', 0.5), z0=0.24 * s).location.y = -0.08 * s
    return tilt(new_objs(f), 6, -12)


def icon_sneaker(s=1.0):
    def f():
        sole = [(-0.55, -0.3), (0.58, -0.3), (0.62, -0.18), (-0.55, -0.18)]
        lib.slab('sole', lib.round_corners([(x * s, y * s) for x, y in sole], 0.05 * s, 3), 0.3 * s, 0.04 * s, flat('#ffffff', 0.4, 0.3), seg=3, z0=-0.15 * s)
        up = [(-0.52, -0.18), (0.6, -0.18), (0.55, -0.02), (0.1, 0.12), (-0.12, 0.38), (-0.48, 0.38)]
        lib.slab('upper', lib.round_corners([(x * s, y * s) for x, y in up], 0.08 * s, 4), 0.28 * s, 0.06 * s, candy('snk', '#4fc3ff', '#1565e0', s), seg=4, z0=-0.14 * s)
        sw = [(-0.3, -0.05), (0.3, 0.02), (0.3, 0.08), (-0.3, 0.04)]
        lib.slab('swoosh', [(x * s, y * s) for x, y in sw], 0.03 * s, 0.01 * s, flat('#ffffff', 0.4), z0=0.14 * s)
    return tilt(new_objs(f), 8, -18)


def icon_person(s=1.0, color='blue'):
    def f():
        top, bot = CANDY[color][0], CANDY[color][1]
        lib.sphere('head', (0, 0.3 * s, 0), 0.17 * s, candy('pph' + color, top, bot, 0.4 * s))
        parts = [lib.sphere('torso', (0, -0.02 * s, 0), 0.24 * s, None, scale=(1, 1.1, 0.7))]
        for sx in (-1, 1):
            parts.append(lib.cylinder('leg', (sx * 0.1 * s, -0.36 * s, 0), 0.08 * s, 0.34 * s, None, seg=12))
            arm = lib.cylinder('arm', (sx * 0.27 * s, -0.04 * s, 0), 0.065 * s, 0.34 * s, None, seg=12)
            arm.rotation_euler = (0, 0, sx * 0.35)
            parts.append(arm)
        union(parts, 'body', 0.02 * s, 3, candy('ppb' + color, top, bot, 0.9 * s))
    return tilt(new_objs(f), 6, -12)


def icon_palette(s=1.0):
    def f():
        pts = [(0.48 * math.cos(a) * (1.0 if i % 12 else 1.0), 0.38 * math.sin(a)) for i, a in enumerate([2 * math.pi * k / 40 for k in range(40)])]
        lib.slab('pal', [(x * s / 0.48 * 0.5, y * s) for x, y in pts], 0.1 * s, 0.03 * s, candy('pal', '#e8c08a', '#b07a3a', s, rough=0.5), seg=3)
        lib.sphere('hole', (0.26 * s, -0.12 * s, 0.1 * s), 0.07 * s, flat('#5a3a1a', 0.6), scale=(1, 1, 0.3))
        for k, c in enumerate(('#ff3355', '#ffd23f', '#21d35a', '#3d8dff', '#c27bff')):
            a = math.radians(150 - k * 42)
            lib.sphere(f'paint{k}', (0.3 * s * math.cos(a) - 0.04 * s, 0.22 * s * math.sin(a) + 0.02 * s, 0.11 * s), 0.08 * s, candy('pt' + c, c, c, 0.2, coat=1.0), scale=(1, 1, 0.45))
    return tilt(new_objs(f), 10, -16)


def icon_dice(s=1.0):
    def f():
        lib.slab('die', lib.rounded_rect_pts(0.7 * s, 0.7 * s, 0.14 * s), 0.7 * s, 0.12 * s, candy('die', '#ffffff', '#d7dcef', 0.7 * s, coat=0.6), seg=5, z0=-0.35 * s)
        for x, y in ((-0.17, 0.17), (0.17, -0.17), (0.0, 0.0), (0.17, 0.17), (-0.17, -0.17)):
            lib.sphere('pip', (x * s, y * s, 0.355 * s), 0.065 * s, flat('#1a1222', 0.4), scale=(1, 1, 0.35))
    return tilt(new_objs(f), 24, -30, 12)


def icon_back(s=1.0, color='white'):
    def f():
        pts = [(-0.45, 0.0), (0.0, 0.42), (0.0, 0.16), (0.42, 0.16), (0.42, -0.16), (0.0, -0.16), (0.0, -0.42)]
        lib.slab('arrow', lib.round_corners([(x * s, y * s) for x, y in reversed(pts)], 0.04 * s, 3), 0.16 * s, 0.05 * s, flat('#ffffff', 0.3, 0.6) if color == 'white' else candy('bk', CANDY[color][0], CANDY[color][1], s), seg=4)
    return tilt(new_objs(f), 0, 0)


def icon_burst(s=1.0, color='gold'):
    def f():
        pts = []
        for k in range(16):
            a = math.pi / 2 + 2 * math.pi * k / 16
            r = 0.5 if k % 2 == 0 else 0.26
            pts.append((r * s * math.cos(a), r * s * math.sin(a)))
        lib.slab('burst', pts, 0.16 * s, 0.04 * s, candy('bu' + color, '#fff07a', '#ff6a00', s), seg=3)
    return tilt(new_objs(f), 8, -14)


def icon_person_plus(s=1.0):
    def f():
        p = icon_person(0.9 * s, 'white' if False else 'blue')
        p.location = (-0.12 * s, 0, 0)
        g = icon_plus(0.42 * s)
        g.location = (0.3 * s, -0.22 * s, 0.25 * s)
    return tilt(new_objs(f), 0, 0)


def icon_copy(s=1.0):
    def f():
        for k, z in ((0, 0.0), (1, 0.08)):
            o = lib.slab(f'pg{k}', lib.rounded_rect_pts(0.5 * s, 0.62 * s, 0.07 * s), 0.06 * s, 0.02 * s, candy('pg', '#ffffff', '#c9d4ff', s), seg=3, z0=z * s)
            o.location = ((-0.08 + 0.16 * k) * s, (0.08 - 0.16 * k) * s, 0)
    return tilt(new_objs(f), 6, -10)


ICONS.update({'jacket': icon_jacket, 'sneaker': icon_sneaker, 'person': icon_person, 'palette': icon_palette, 'dice': icon_dice,
              'back': icon_back, 'burst': icon_burst, 'person_plus': icon_person_plus, 'copy': icon_copy})
