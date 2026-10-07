# Design v3 (S13b, D46): the stylized 3D stadium behind the menus, built in Blender and rendered with Cycles per screen
# shot. Ring with ropes and team-coloured corners, chain-link cage, tiered crowd with LED edges, truss with par cans
# and beams in haze, graffiti banners, speaker stacks, LED wall, neon crown, skyline. The camera is solved so a
# 1.85 m fighter standing on the ring at shot.at projects to shot.feet (reference px of the 1672x941 layout,
# the plate spans x -400..2072) with height shot.figH - the live three.js fighter then stands exactly on it.
#   python3 tools/ui3/stage.py home [scale] [samples]   -> .cache/ui3/stage/<shot>_color.png, _depth.png
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import lib  # noqa: E402
import textures as tx  # noqa: E402
from lib import Vector, bmesh, bpy  # noqa: E402

RING = 6.4
RING_H = 1.0
PW, PH, X0 = 2472, 941, -400
OUT = os.path.join(lib.CACHE, 'stage')
os.makedirs(OUT, exist_ok=True)

SHOTS = {
    'home': dict(feet=(832, 748), figH=540, fov=40, at=(0, 0), banners=[(-3.3, 7.6, 4.5, 2.2, 4.0, 'l'), (3.3, 7.6, 4.5, 2.2, 4.0, 'r')]),
    'select': dict(feet=(846, 748), figH=600, fov=40, at=(0, 0), lift=0.245, pedestals=[(-1.69, 0), (1.69, 0)], team=True,
                   banners=[(-3.1, 4.6, 3.5, 2.4, 4.4, 'blue'), (3.1, 4.6, 3.5, 2.4, 4.4, 'red')]),
    'vs': dict(feet=(830, 1150), figH=980, fov=40, pitch=-4, at=(0, 0), team=True),
    # no banners behind the big panels (only fragments of their lettering showed between them)
    'fighters': dict(feet=(920, 880), figH=760, fov=40, at=(0, 0), banners=[]),
    'custom': dict(feet=(820, 742), figH=600, fov=40, at=(0, 0), lift=0.245, pedestals=[(0, 0)], banners=[]),
    'loading': dict(feet=(836, 760), figH=330, fov=40, pitch=2, at=(0, 0)),
    'ring': dict(feet=(836, 912), figH=600, fov=40, at=(0, 0), banners=[(-3.3, 7.6, 4.5, 2.2, 4.0, 'l'), (3.3, 7.6, 4.5, 2.2, 4.0, 'r')]),
    'lobby': dict(feet=(836, 800), figH=420, fov=40, pitch=4, at=(0, 0), banners=[(-3.6, 7.6, 4.5, 2.2, 4.0, 'l'), (3.6, 7.6, 4.5, 2.2, 4.0, 'r')]),
    'arena': dict(feet=(836, 760), figH=300, fov=40, pitch=6, at=(0, 0)),
}


# ------------------------------------------------------------------ materials
def M(name, fn):
    return kit.M(name, fn)


def tex_mat(name, path, emission=0.0, rough=0.5, scale=(1, 1), alpha=False, metallic=0.0, tint=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (scale[0], scale[1], 1)
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = bpy.data.images.load(path, check_existing=True)
    nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
    col = t.outputs['Color']
    if tint:
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        mix.inputs[7].default_value = (*lib.srgb(tint), 1)
        nt.links.new(col, mix.inputs[6])
        col = mix.outputs[2]
    nt.links.new(col, p.inputs['Base Color'])
    if emission:
        nt.links.new(col, p.inputs['Emission Color'])
        p.inputs['Emission Strength'].default_value = emission
    if alpha:
        nt.links.new(t.outputs['Alpha'], p.inputs['Alpha'])
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metallic
    return m


def random_color_mat(name, palette, rough=0.55):
    """Per-object colour from a palette (crowd clothes) via Object Info > Random."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    oi = nt.nodes.new('ShaderNodeObjectInfo')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    els = ramp.color_ramp.elements
    while len(els) < len(palette):
        els.new(0.5)
    for i, c in enumerate(palette):
        els[i].position = i / len(palette)
        els[i].color = (*lib.srgb(c), 1)
    nt.links.new(oi.outputs['Random'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = rough
    p.inputs['Coat Weight'].default_value = 0.2
    return m


def floor_mat():
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = 0.35
    n.inputs['Detail'].default_value = 6
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.42
    mr.inputs['From Max'].default_value = 0.62
    mr.inputs['To Min'].default_value = 0.05
    mr.inputs['To Max'].default_value = 0.45
    nt.links.new(n.outputs['Fac'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], p.inputs['Roughness'])
    p.inputs['Base Color'].default_value = (*lib.srgb('#0d0b1a'), 1)
    p.inputs['Specular IOR Level'].default_value = 0.7
    return m


# ------------------------------------------------------------------ helpers
def box(name, size, loc, material, bevel=0.03, rot=(0, 0, 0)):
    bm = bmesh.new()
    bm.loops.layers.uv.new()
    bmesh.ops.create_cube(bm, size=1.0, calc_uvs=True)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    o = lib.obj_from_bm(name, bm, material, smooth=False)
    o.location = loc
    o.rotation_euler = rot
    if bevel:
        lib.bevel_mod(o, bevel, 3)
    return o


def tube(name, a, b, r, material, seg=16):
    a, b = Vector(a), Vector(b)
    d = b - a
    o = lib.cylinder(name, (a + b) / 2, r, d.length, material, seg=seg)
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return o


def instance(name, src, loc, rot=(0, 0, 0), scale=(1, 1, 1)):
    o = lib.link(bpy.data.objects.new(name, src.data))
    o.location = loc
    o.rotation_euler = rot
    o.scale = scale
    return o


def mesh_from(objs, name, voxel=None, smooth=0):
    """Join objects into one mesh (optionally voxel-remeshed = boolean union, then smoothed); sources deleted."""
    bm = bmesh.new()
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        me.transform(o.matrix_world)
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    for o in objs:
        bpy.data.objects.remove(o)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = lib.link(bpy.data.objects.new(name, me))
    if voxel:
        r = o.modifiers.new('remesh', 'REMESH')
        r.mode = 'VOXEL'
        r.voxel_size = voxel
        if smooth:
            s = o.modifiers.new('smooth', 'SMOOTH')
            s.iterations = smooth
            s.factor = 0.6
        dg = bpy.context.evaluated_depsgraph_get()
        me2 = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        bpy.data.objects.remove(o)
        o = lib.link(bpy.data.objects.new(name, me2))
    for p in o.data.polygons:
        p.use_smooth = True
    return o


# ------------------------------------------------------------------ pieces
def build_ring(team):
    m_core = M('ringcore', lambda: lib.mat('ringcore', lib.srgb('#140c22'), rough=0.6))
    box('ringcore', (RING, RING, RING_H - 0.1), (0, 0, (RING_H - 0.1) / 2), m_core, 0.05)
    top = box('ringtop', (RING + 0.1, RING + 0.1, 0.16), (0, 0, RING_H - 0.08), M('pad', lambda: lib.mat('pad', lib.srgb('#2a1450'), rough=0.55)), 0.07)
    can = kit.plane('canvas', RING - 0.1, RING - 0.1, M('canvas', lambda: tex_mat('canvas', tx.ring_canvas(), rough=0.45, emission=0.0, tint='#a090c0')), z=RING_H + 0.002)
    ap = M('apron', lambda: tex_mat('apron', tx.apron(), rough=0.45, emission=0.35, scale=(1, 1)))
    for k in range(4):
        a = k * math.pi / 2
        pl = kit.plane(f'apron{k}', RING + 0.12, RING_H - 0.12, ap)
        pl.rotation_euler = (math.pi / 2, 0, a)
        # side k faces outward: front (-Y), right (+X), back (+Y), left (-X)
        nx, ny = math.sin(a), -math.cos(a)
        pl.location = (nx * (RING / 2 + 0.06), ny * (RING / 2 + 0.06), (RING_H - 0.12) / 2)
    # posts, pads, ropes
    post_m = M('post', lambda: lib.mat('post', lib.srgb('#26233a'), metallic=0.8, rough=0.3))
    P = RING / 2 - 0.12
    corners = [(-P, -P), (P, -P), (P, P), (-P, P)]
    H = RING_H + 1.55
    for i, (x, y) in enumerate(corners):
        lib.cylinder(f'post{i}', (x, y, (H + RING_H) / 2), 0.085, H - RING_H, post_m, seg=24, bevel=0.02)
        lib.sphere(f'cap{i}', (x, y, H + 0.02), 0.1, kit.gold(), scale=(1, 1, 0.6))
        col = ('blue' if x < 0 else 'red') if team else ('red' if (i % 2) else 'blue')
        for h in (0.45, 0.85, 1.25):
            pad = box(f'pad{i}{h}', (0.24, 0.24, 0.3), (x * 0.985, y * 0.985, RING_H + h), kit.candy('pad' + col, kit.CANDY[col][0], kit.CANDY[col][1], 0.3, coat=0.8), 0.08)
            pad.rotation_euler = (0, 0, math.radians(45))
    rope_cols = [('#ff4d5e', '#b8102a'), ('#ffffff', '#c9cde0'), ('#4fb4ff', '#1550c0')]
    for j, h in enumerate((1.25, 0.85, 0.45)):
        mat = kit.candy(f'rope{j}', rope_cols[j][0], rope_cols[j][1], 0.08, coat=1.0)
        for s in range(4):
            if s == 0:  # the front side stays open (the live fighter stands in front of it)
                continue
            a, b = corners[s], corners[(s + 1) % 4]
            pts = []
            for k in range(13):
                t = k / 12
                sag = 0.06 * 4 * t * (1 - t)
                pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, RING_H + h - sag))
            lib.tube_path(f'rope{j}{s}', pts, 0.038, mat, closed=False, res=4)
    # steps
    for sx in (-1, 1):
        box(f'step{sx}', (1.2, 0.5, 0.45), (sx * 2.2, -RING / 2 - 0.5, 0.225), m_core, 0.04)


def chainlink_fence(x0, y0, x1, y1, h=2.6):
    m = M('fence', lambda: tex_mat('fence', tx.chainlink(), rough=0.35, metallic=0.9, alpha=True, scale=(1, 1)))
    a, b = Vector((x0, y0, 0)), Vector((x1, y1, 0))
    L = (b - a).length
    p = kit.plane('fence', L, h, m)
    # tile the texture: 1 cell per 0.12 m
    for lp in p.data.uv_layers.active.data:
        lp.uv = (lp.uv[0] * L / 1.4, lp.uv[1] * h / 1.4)
    p.rotation_euler = (math.pi / 2, 0, math.atan2(b.y - a.y, b.x - a.x))
    p.location = ((a + b) / 2) + Vector((0, 0, h / 2))
    post_m = M('fpost', lambda: lib.mat('fpost', lib.srgb('#3a3650'), metallic=0.8, rough=0.35))
    n = max(1, int(L / 3.0))
    for i in range(n + 1):
        q = a.lerp(b, i / n)
        lib.cylinder('fp', (q.x, q.y, h / 2 + 0.1), 0.06, h + 0.2, post_m, seg=12)
    tube('frail', (a.x, a.y, h), (b.x, b.y, h), 0.045, post_m)


def crowd_meshes():
    """Three stylized fan bodies (rounded, big heads) - arms up, one arm up, arms down."""
    skin = None
    variants = []
    for v in range(3):
        parts = []
        parts.append(lib.sphere('torso', (0, 0, 1.05), 0.3, skin, scale=(1, 0.7, 1.25), seg=20))
        parts.append(lib.sphere('hips', (0, 0, 0.72), 0.24, skin, scale=(1.05, 0.75, 0.8), seg=16))
        parts.append(lib.sphere('head', (0, 0, 1.6), 0.2, skin, scale=(1, 1, 1.08), seg=20))
        for sx in (-1, 1):
            parts.append(lib.cylinder('leg', (sx * 0.12, 0, 0.36), 0.1, 0.72, skin, seg=12))
            up = v == 0 or (v == 1 and sx > 0)
            if up:
                a = Vector((sx * 0.28, 0, 1.3))
                b = Vector((sx * 0.48, 0.05, 1.95))
            else:
                a = Vector((sx * 0.3, 0, 1.3))
                b = Vector((sx * 0.4, 0.05, 0.8))
            parts.append(tube('arm', a, b, 0.075, skin, seg=10))
            parts.append(lib.sphere('hand', tuple(b), 0.09, skin, seg=10))
        o = mesh_from(parts, f'fan{v}', voxel=0.035, smooth=4)
        o.hide_render = True
        o.hide_viewport = True
        variants.append(o)
    return variants


def build_crowd(rng, team):
    fans = crowd_meshes()
    pal = ['#1b1a3a', '#2a1a40', '#3b1022', '#10283a', '#1a1a1a', '#35234f', '#4a1428', '#123a5a', '#1e1e2a', '#2a2238', '#6a5a20', '#5a2a4a']
    cm = random_color_mat('crowd', pal)
    for f in fans:
        f.data.materials.append(cm)
    stand_m = M('stand', lambda: lib.mat('stand', lib.srgb('#1c1830'), rough=0.6))
    rail_m = M('rail', lambda: lib.mat('rail', lib.srgb('#8a8fa8'), metallic=0.9, rough=0.3))
    tiers = [(8.5, 0.0), (9.6, 0.6), (10.7, 1.2), (11.8, 1.8), (12.9, 2.4)]
    for ti, (y, z) in enumerate(tiers):
        box(f'tier{ti}', (34, 1.2, 0.6 + z), (0, y, (0.6 + z) / 2), stand_m, 0.03)
        led = kit.glow('#ff3fd2' if ti % 2 else '#3f8dff', 6.0)
        box(f'led{ti}', (34, 0.05, 0.06), (0, y - 0.6, 0.62 + z), led, 0)
        x = -16.0
        while x < 16.0:
            fan = fans[rng.randrange(3)]
            s = rng.uniform(0.9, 1.08)
            instance('fan', fan, (x + rng.uniform(-0.12, 0.12), y + rng.uniform(-0.15, 0.15), 0.6 + z), (0, 0, rng.uniform(-0.3, 0.3)), (s, s, s))
            x += rng.uniform(0.55, 0.75)
    # side stands (angled toward the ring)
    for sx in (-1, 1):
        for ti in range(4):
            xs = sx * (9.5 + ti * 1.1)
            box(f'side{sx}{ti}', (1.2, 14, 0.6 + ti * 0.6), (xs, 1.5, (0.6 + ti * 0.6) / 2), stand_m, 0.03)
            y = -5.0
            while y < 8.0:
                instance('fan', fans[rng.randrange(3)], (xs + rng.uniform(-0.12, 0.12), y, 0.6 + ti * 0.6), (0, 0, -sx * math.pi / 2 + rng.uniform(-0.3, 0.3)))
                y += rng.uniform(0.55, 0.75)
    # balcony
    bz = 5.2
    box('balcony', (40, 2.4, 0.4), (0, 16.0, bz), stand_m, 0.04)
    box('balcony_face', (40, 0.2, 1.1), (0, 14.8, bz - 0.2), M('balface', lambda: lib.mat('balface', lib.srgb('#120e22'), rough=0.5)), 0.03)
    box('balcony_led', (40, 0.05, 0.08), (0, 14.68, bz - 0.55), kit.glow('#ffb52e', 5.0), 0)
    tube('brail', (-20, 14.9, bz + 1.1), (20, 14.9, bz + 1.1), 0.05, rail_m)
    bulb = kit.glow('#ffc070', 14.0)
    for k in range(48):
        x = -19.5 + k * 0.83
        lib.sphere('bb', (x, 14.6, bz + 1.0 - 0.18 * math.sin(k * 0.83 / 2.5 * math.pi) ** 2), 0.06, bulb, seg=10)
    for k in range(40):
        x = -8.4 + k * 0.43
        lib.sphere('fb', (x, 6.55, 2.62 - 0.12 * math.sin(k * 0.43 / 3.0 * math.pi) ** 2), 0.045, bulb, seg=10)
    x = -19.0
    while x < 19.0:
        instance('fan', fans[rng.randrange(3)], (x, 16.0 + rng.uniform(-0.3, 0.3), bz + 0.2), (0, 0, rng.uniform(-0.3, 0.3)))
        x += rng.uniform(0.6, 0.8)


def truss_segment():
    m = M('truss', lambda: lib.mat('truss', lib.srgb('#5a5f78'), metallic=0.85, rough=0.32))
    parts = []
    s = 0.36
    for cx, cz in ((-s / 2, -s / 2), (s / 2, -s / 2), (-s / 2, s / 2), (s / 2, s / 2)):
        parts.append(tube('ch', (0, cx, cz), (1.0, cx, cz), 0.03, m, seg=8))
    for cx, cz, cx2, cz2 in ((-s / 2, -s / 2, s / 2, -s / 2), (-s / 2, s / 2, s / 2, s / 2), (-s / 2, -s / 2, -s / 2, s / 2), (s / 2, -s / 2, s / 2, s / 2)):
        parts.append(tube('dg', (0, cx, cz), (0.5, cx2, cz2), 0.014, m, seg=6))
        parts.append(tube('dg', (0.5, cx2, cz2), (1.0, cx, cz), 0.014, m, seg=6))
    o = mesh_from(parts, 'trussseg')
    o.data.materials.append(m)
    o.hide_render = True
    o.hide_viewport = True
    return o


def truss_line(seg, a, b, thick=1.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    n = max(1, round(d.length / thick))
    q = d.to_track_quat('X', 'Z').to_euler()
    for i in range(n):
        instance('truss', seg, a + d * (i / n), q, (d.length / n, thick, thick))


def par_can(loc, aim, color, power=900, angle=24, beam=True):
    body = M('parbody', lambda: lib.mat('parbody', lib.srgb('#18161f'), metallic=0.6, rough=0.35))
    d = (Vector(aim) - Vector(loc)).normalized()
    c = lib.cylinder('par', loc, 0.16, 0.36, body, seg=20)
    c.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    lens = lib.cylinder('lens', Vector(loc) + d * 0.19, 0.13, 0.02, kit.glow(color, 30.0), seg=20)
    lens.rotation_euler = c.rotation_euler
    if beam:
        sd = bpy.data.lights.new('spot', 'SPOT')
        sd.energy = power
        sd.color = lib.srgb(color)
        sd.spot_size = math.radians(angle)
        sd.spot_blend = 0.6
        sd.shadow_soft_size = 0.1
        so = lib.link(bpy.data.objects.new('spot', sd))
        so.location = Vector(loc) + d * 0.25
        lib.look_at(so, aim)


def build_rig(team, rng):
    seg = truss_segment()
    zt = 5.5
    # back gantry and the two side beams, towers at the back corners
    truss_line(seg, (-7.5, 5.8, zt), (7.5, 5.8, zt))
    truss_line(seg, (-7.5, -2.5, zt), (-7.5, 5.8, zt))
    truss_line(seg, (7.5, -2.5, zt), (7.5, 5.8, zt))
    truss_line(seg, (-7.5, -2.5, zt), (7.5, -2.5, zt))
    for sx in (-1, 1):
        truss_line(seg, (sx * 7.5, 5.8, 0), (sx * 7.5, 5.8, zt))
    cols = ['#ff3fd2', '#3f8dff', '#ffb52e', '#ffffff']
    for i, x in enumerate([-6.0, -3.6, -1.2, 1.2, 3.6, 6.0]):
        col = cols[i % 4] if not team else ('#3f8dff' if x < 0 else '#ff3355') if i % 2 == 0 else '#ffffff'
        par_can((x, 5.8, zt - 0.35), (x * 1.1, -2.5, RING_H), col, power=1500)
    for i, x in enumerate([-6.5, -3.0, 3.0, 6.5]):
        par_can((x, -2.5, zt - 0.35), (x * 0.3, 1.0, RING_H), '#fff2dc', power=500, angle=30)
    # back rim beams through the haze toward the camera
    for i, x in enumerate([-5.0, 0.0, 5.0]):
        par_can((x, 5.8, zt + 0.3), (x * 1.5, -8, 2.0), ['#ff3fd2', '#7a5cff', '#3f8dff'][i], power=4000, angle=14)
    # tower bulbs (bokeh points)
    for sx in (-1, 1):
        for k in range(5):
            lib.sphere('bulb', (sx * 7.5, 5.55, 1.5 + k * 1.2), 0.07, kit.glow('#ffd27a', 12.0))


DEFAULT_BANNERS = [(-5.0, 5.0, 3.15, 2.5, 5.0, 'l'), (5.0, 5.0, 3.15, 2.5, 5.0, 'r')]


def build_banners(spec):
    for (bx, by, bz, w, h, style) in spec:
        sx = -1 if bx < 0 else 1
        if style in ('l', 'r'):
            path = os.path.join(tx.TEX, f'banner_{style}.png')
            if style == 'l':
                tx.banner(['WORTE', 'WIE', 'FÄUSTE'], path, colors=((255, 255, 255), (255, 60, 90), (255, 255, 255)))
            else:
                tx.banner(['BARS', 'TREFFEN', 'HÄRTER'], path, colors=((255, 255, 255), (255, 60, 90), (255, 60, 90)))
        else:
            path = os.path.join(tx.TEX, f'banner_{style}.png')
            tx.team_banner(path, (60, 140, 255) if style == 'blue' else (255, 50, 80), (10, 16, 48) if style == 'blue' else (48, 8, 18))
        m = tex_mat(f'banner{bx}', path, emission=0.6, rough=0.8)
        bm = bmesh.new()
        nx, ny = 12, 20
        uv = bm.loops.layers.uv.new()
        vs = [[bm.verts.new((-w / 2 + w * i / nx, 0.06 * math.sin(i / nx * math.pi * 3), -h / 2 + h * j / ny)) for j in range(ny + 1)] for i in range(nx + 1)]
        for i in range(nx):
            for j in range(ny):
                f = bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
                for lp, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                    lp[uv].uv = (a / nx, b / ny)
        o = lib.obj_from_bm(f'banner{bx}', bm, m)
        o.location = (bx, by, bz)
        o.rotation_euler = (0, 0, sx * math.radians(10))
        # hanging bar
        bar = tube('bar', (-w / 2 - 0.12, 0, 0), (w / 2 + 0.12, 0, 0), 0.04, kit.gold())
        bar.location = (bx, by, bz + h / 2 + 0.05)
        bar.rotation_euler = (0, math.pi / 2, sx * math.radians(10))


def build_speakers():
    box_m = M('spk', lambda: lib.mat('spk', lib.srgb('#15131d'), rough=0.55))
    cone_m = M('cone', lambda: lib.mat('cone', lib.srgb('#2c2a38'), rough=0.4))
    for sx in (-1, 1):
        for k, (w, h) in enumerate(((1.2, 0.9), (1.2, 0.9), (1.0, 0.8))):
            z = sum(hh for _, hh in ((1.2, 0.9), (1.2, 0.9), (1.0, 0.8))[:k]) + h / 2
            x, y = sx * 5.6, 4.2
            box(f'spk{sx}{k}', (w, 0.8, h), (x, y, z), box_m, 0.06)
            for dx in ((-0.25, 0.25) if k < 2 else (0,)):
                c = lib.cylinder('cone', (x + dx, y - 0.41, z), 0.22 if k < 2 else 0.26, 0.04, cone_m, seg=32, rot=(math.pi / 2, 0, 0))
                lib.torus('surround', (x + dx, y - 0.43, z), 0.23 if k < 2 else 0.27, 0.025, kit.gold(), rot=(math.pi / 2, 0, 0), seg=(32, 8))
                lib.sphere('dust', (x + dx, y - 0.43, z), 0.07, cone_m, scale=(1, 0.5, 1))


def build_back(team):
    led = tex_mat('led', tx.led_wall(), emission=1.6, rough=0.4)
    p = kit.plane('ledwall', 9.0, 4.0, led)
    p.rotation_euler = (math.pi / 2, 0, 0)
    p.location = (0, 18.0, 9.0)
    box('ledframe', (9.4, 0.3, 4.4), (0, 18.2, 9.0), M('ledf', lambda: lib.mat('ledf', lib.srgb('#1a1726'), metallic=0.6, rough=0.4)), 0.05)
    # neon crown (right) and neon RB ring (left)
    pts = tx.CROWN
    crown = [(x * 3.0 + 10.5, 0, y * 3.0 + 10.0) for x, y in pts] + [(pts[0][0] * 3.0 + 10.5, 0, pts[0][1] * 3.0 + 10.0)]
    o = lib.tube_path('neoncrown', [(x, 17.0, z) for x, _, z in crown], 0.07, kit.glow('#ffd23f', 18.0), closed=False)
    ring = [(-10.5 + 1.4 * math.cos(a), 17.0, 10.0 + 1.4 * math.sin(a)) for a in [2 * math.pi * i / 48 for i in range(49)]]
    lib.tube_path('neonring', ring, 0.06, kit.glow('#ff3fd2', 16.0), closed=False)


def build_skyline(rng):
    for k in range(3):
        tx.windows(seed=k + 1)
    mats = [tex_mat(f'win{k}', os.path.join(tx.TEX, f'windows{k + 1}.png'), emission=0.7, rough=0.5, tint='#8a7ab0') for k in range(3)]
    x = -60.0
    while x < 60.0:
        w = rng.uniform(5, 10)
        h = rng.uniform(16, 46) * (0.75 if abs(x) < 15 else 1.0)
        y = rng.uniform(45, 70)
        b = box('tower', (w, w * 0.8, h), (x + w / 2, y, h / 2), mats[rng.randrange(3)], 0.0)
        # UV per face would need unwrapping: use a generated box projection instead
        b.data.uv_layers.new()
        for poly in b.data.polygons:
            for li in poly.loop_indices:
                v = b.data.vertices[b.data.loops[li].vertex_index].co
                n = poly.normal
                if abs(n.z) > 0.5:
                    uvc = (0, 0)
                elif abs(n.x) > abs(n.y):
                    uvc = ((v.y + 0.5) * w * 0.8 / 12, (v.z + 0.5) * h / 24)
                else:
                    uvc = ((v.x + 0.5) * w / 12, (v.z + 0.5) * h / 24)
                b.data.uv_layers.active.data[li].uv = uvc
        if rng.random() < 0.3:
            lib.sphere('beacon', (x + w / 2, y, h + 0.6), 0.35, kit.glow('#ff3355', 20.0))
        x += w + rng.uniform(1, 4)


def build_pedestals(spots, team):
    for i, (x, y) in enumerate(spots):
        col = ('blue' if x < 0 else 'red') if team else 'gold'
        top = kit.CANDY[col]
        lib.cylinder(f'ped{i}', (x, y, RING_H + 0.12), 0.95, 0.24, M('pedb', lambda: lib.mat('pedb', lib.srgb('#191626'), metallic=0.5, rough=0.35)), seg=64, bevel=0.05)
        lib.torus(f'pedring{i}', (x, y, RING_H + 0.24), 0.93, 0.045, kit.gold(), seg=(64, 10))
        lib.torus(f'pedled{i}', (x, y, RING_H + 0.05), 0.97, 0.03, kit.glow(top[0], 10.0), seg=(64, 8))
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new()
        vs = [bm.verts.new((x + 0.9 * math.cos(2 * math.pi * k / 64), y + 0.9 * math.sin(2 * math.pi * k / 64), RING_H + 0.245)) for k in range(64)]
        f = bm.faces.new(vs)
        for lp in f.loops:
            lp[uv].uv = ((lp.vert.co.x - x) / 1.8 + 0.5, (lp.vert.co.y - y) / 1.8 + 0.5)
        lib.obj_from_bm(f'pedtop{i}', bm, M('pedtop', lambda: tex_mat('pedtop', tx.ring_canvas(), rough=0.4, emission=0.08)), smooth=False)


def world(team):
    w = bpy.data.worlds.new('night')
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[0].color = (*lib.srgb('#3a1650'), 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (*lib.srgb('#070818'), 1)
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = -1
    mr.inputs['From Max'].default_value = 1
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 0.18
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    # haze only inside the hall (the skyline stays crisp)
    hm = bpy.data.materials.new('haze')
    hm.use_nodes = True
    hn = hm.node_tree
    hn.nodes.clear()
    vs = hn.nodes.new('ShaderNodeVolumeScatter')
    vs.inputs['Density'].default_value = 0.011
    vs.inputs['Anisotropy'].default_value = 0.6
    vs.inputs['Color'].default_value = (0.9, 0.85, 1.0, 1)
    ho = hn.nodes.new('ShaderNodeOutputMaterial')
    hn.links.new(vs.outputs['Volume'], ho.inputs['Volume'])
    hb = box('hazebox', (34, 19, 9), (0, 4.5, 4.5), hm, 0)
    hb.visible_shadow = False


def key_lights(team):
    # a warm pool on the canvas, the rest of the hall in the dark
    sd = bpy.data.lights.new('ringpool', 'SPOT')
    sd.energy = 1800
    sd.color = (1.0, 0.86, 0.7)
    sd.spot_size = math.radians(40)
    sd.spot_blend = 0.7
    sd.shadow_soft_size = 1.0
    so = lib.link(bpy.data.objects.new('ringpool', sd))
    so.location = (0, -1.0, 9.0)
    lib.look_at(so, (0, 0.5, RING_H))
    lib.area_light('ringfill', (0, -6, 6), (0, 0, RING_H), 60, 6, (0.75, 0.7, 1.0))
    lib.area_light('crowdfill', (0, 2, 9), (0, 11, 2), 120, 12, (0.5, 0.4, 1.0))
    # rim light from behind the stands: coloured silhouettes (narrow spots, so the haze is not flooded)
    for x, c in ((-10, (1.0, 0.25, 0.8)), (0, (0.45, 0.35, 1.0)), (10, (0.25, 0.55, 1.0))):
        sd = bpy.data.lights.new('crowdrim', 'SPOT')
        sd.energy = 5000
        sd.color = c
        sd.spot_size = math.radians(38)
        sd.spot_blend = 0.6
        so = lib.link(bpy.data.objects.new('crowdrim', sd))
        so.location = (x, 19, 4.5)
        lib.look_at(so, (x * 0.8, 10, 1.2))
    if team:
        for sx, c in ((-1, '#3f8dff'), (1, '#ff3355')):
            sd = bpy.data.lights.new('team', 'SPOT')
            sd.energy = 2200
            sd.color = lib.srgb(c)
            sd.spot_size = math.radians(30)
            sd.spot_blend = 0.5
            so = lib.link(bpy.data.objects.new('team', sd))
            so.location = (sx * 2.6, -1.0, 7.5)
            lib.look_at(so, (sx * 1.7, 0, RING_H))


# ------------------------------------------------------------------ camera
def solve_camera(shot, scale):
    fov = math.radians(shot.get('fov', 40))
    t = math.tan(fov / 2)
    D = 1.85 * PH / (2 * shot['figH'] * t)
    cx, cy = PW / 2, PH / 2
    dxN = (shot['feet'][0] - X0 - cx) / cx
    dyN = (shot['feet'][1] - cy) / cy
    pitch = math.radians(shot.get('pitch', 0))
    at = shot.get('at', (0, 0))
    P = Vector((at[0], at[1], RING_H + shot.get('lift', 0.0)))  # lift: the feet stand on a pedestal top
    # camera space (x right, y up, -z forward) -> world for a camera looking +Y pitched down by `pitch`
    dir_cam = Vector((dxN * t * PW / PH, -dyN * t, -1.0))
    rx = math.pi / 2 - pitch
    from mathutils import Euler
    R = Euler((rx, 0, 0)).to_matrix()
    dir_w = (R @ dir_cam).normalized()
    dist = D * dir_cam.length
    cam_pos = P - dir_w * dist
    c = bpy.data.cameras.new('cam')
    c.sensor_fit = 'VERTICAL'
    c.angle_y = fov
    c.clip_start = 0.1
    c.clip_end = 300
    c.dof.use_dof = True
    c.dof.focus_distance = D
    c.dof.aperture_fstop = shot.get('fstop', 4.0)
    o = lib.link(bpy.data.objects.new('cam', c))
    o.location = cam_pos
    o.rotation_euler = (rx, 0, 0)
    sc = bpy.context.scene
    sc.camera = o
    sc.render.resolution_x = round(PW * scale)
    sc.render.resolution_y = round(PH * scale)
    return o


def depth_output(path):
    """Compositor: depth -> 3.2 / d clamped (bright = near), like the v2 MiDaS maps, as a 16-bit PNG."""
    sc = bpy.context.scene
    sc.view_layers[0].use_pass_z = True
    sc.use_nodes = True
    nt = sc.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers')
    comp = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(rl.outputs['Image'], comp.inputs['Image'])
    div = nt.nodes.new('CompositorNodeMath')
    div.operation = 'DIVIDE'
    div.inputs[0].default_value = 3.2
    nt.links.new(rl.outputs['Depth'], div.inputs[1])
    mn = nt.nodes.new('CompositorNodeMath')
    mn.operation = 'MINIMUM'
    mn.inputs[1].default_value = 1.0
    nt.links.new(div.outputs[0], mn.inputs[0])
    fo = nt.nodes.new('CompositorNodeOutputFile')
    fo.base_path = os.path.dirname(path)
    fo.file_slots[0].path = os.path.basename(path).replace('.png', '')
    fo.format.file_format = 'PNG'
    fo.format.color_mode = 'BW'
    fo.format.color_depth = '16'
    nt.links.new(mn.outputs[0], fo.inputs[0])


def build(shot_id, scale=1.0, samples=64):
    shot = SHOTS[shot_id]
    team = shot.get('team', False)
    rng = random.Random(7)
    lib.reset(samples, transparent=False)
    sc = bpy.context.scene
    sc.cycles.volume_step_rate = 2.0
    sc.cycles.volume_max_steps = 128
    sc.cycles.max_bounces = 6
    sc.view_settings.look = 'Medium High Contrast'
    kit._mats.clear()
    kit._link_mesh.clear()
    world(team)
    floor = kit.plane('floor', 120, 120, floor_mat())
    build_ring(team)
    chainlink_fence(-8.5, 6.6, 8.5, 6.6)
    chainlink_fence(-8.5, -3.5, -8.5, 6.6)
    chainlink_fence(8.5, -3.5, 8.5, 6.6)
    build_crowd(rng, team)
    build_rig(team, rng)
    build_banners(shot.get('banners', DEFAULT_BANNERS))
    build_speakers()
    build_back(team)
    build_skyline(rng)
    if shot.get('pedestals'):
        build_pedestals(shot['pedestals'], team)
    key_lights(team)
    solve_camera(shot, scale)
    color = os.path.join(OUT, f'{shot_id}_color.png')
    depth = os.path.join(OUT, f'{shot_id}_depth.png')
    depth_output(depth)
    sc.render.filepath = color
    bpy.ops.render.render(write_still=True)
    # the file output node appends the frame number
    fn = depth.replace('.png', '0001.png')
    if os.path.exists(fn):
        os.replace(fn, depth)
    return color, depth


if __name__ == '__main__':
    sid = sys.argv[1] if len(sys.argv) > 1 else 'home'
    scale = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
    samples = int(sys.argv[3]) if len(sys.argv) > 3 else 64
    import time
    t0 = time.time()
    print(build(sid, scale, samples), f'{time.time() - t0:.0f}s')
