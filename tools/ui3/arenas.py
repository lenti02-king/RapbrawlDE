# Design v3 (S13b, D46): the PO's arena locations rebuilt as stylized 3D scenes in Blender (same places as the
# paintings in tools/arena/ref, fictional names as in D40: RAPBRAWL badge, PIK ASS, KIOSK 069, WEINECK) and rendered
# into the painted-arena format (render/arenas/painted.ts): backdrop above the ground line on the plane 14 m behind
# the fight, real side margins included (meta.margin), a floor tile, neon sign boxes for the flicker.
#   python3 tools/ui3/arenas.py festival|bahnhof [scale] [samples]  -> public/assets/arena/<id>3/
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import lib  # noqa: E402
import stage as S  # noqa: E402
import textures as tx  # noqa: E402
from lib import Vector, bmesh, bpy  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter  # noqa: E402

PLANE_W = {'festival': 27.0, 'bahnhof': 25.0}  # metres of the backdrop plane (painted.ts CFG.width)
MARGIN = 0.2  # real scenery 20 % beyond each side (no mirrored edges)
CAM_D = 22.0  # camera distance to the plane (fight camera ~8 m in front of the fighters, plane 14 m behind)
CAM_Z = 1.7
H_M = 9.2  # plane height in metres (above + a little below the ground line)
BELOW_M = 0.5


def M(name, fn):
    return kit.M(name, fn)


def box(name, size, loc, mat, bevel=0.04, rot=(0, 0, 0)):
    return S.box(name, size, loc, mat, bevel, rot)


def cam_setup(arena, scale):
    W = PLANE_W[arena] * (1 + 2 * MARGIN)
    res_x = round(3000 * scale)
    res_y = round(res_x * H_M / W)
    c = bpy.data.cameras.new('cam')
    c.sensor_fit = 'HORIZONTAL'
    c.angle_x = 2 * math.atan(W / 2 / CAM_D)
    c.clip_start = 0.1
    c.clip_end = 600
    centre_z = H_M / 2 - BELOW_M
    c.shift_y = (centre_z - CAM_Z) / W
    o = lib.link(bpy.data.objects.new('cam', c))
    o.location = (0, -CAM_D, CAM_Z)
    o.rotation_euler = (math.pi / 2, 0, 0)
    sc = bpy.context.scene
    sc.camera = o
    sc.render.resolution_x = res_x
    sc.render.resolution_y = res_y
    ground_px = round(res_y * (H_M - BELOW_M) / H_M)
    return o, res_x, res_y, ground_px


def emissive_tex(name, path, strength=1.5):
    return S.tex_mat(name, path, emission=strength, rough=0.5)


def sun_sky(top='#3a2a7a', mid='#c86a9a', horizon='#ffb35a', strength=1.0):
    w = bpy.data.worlds.new('sky')
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    e = ramp.color_ramp.elements
    e[0].position = 0.0
    e[0].color = (*lib.srgb(horizon), 1)
    e[1].position = 0.32
    e[1].color = (*lib.srgb(top), 1)
    m = e.new(0.1)
    m.color = (*lib.srgb(mid), 1)
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.0
    mr.inputs['From Max'].default_value = 1.0
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputWorld')
    # world 'Generated' is the view direction: z = 0 at the horizon, 1 at the zenith
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])


def cloud(loc, scale, col_top='#ffd0e0', col_bot='#ff8a6a', seed=0):
    rng = random.Random(seed)
    parts = []
    for k in range(9):
        r = rng.uniform(0.5, 1.0)
        parts.append(lib.sphere('cl', (rng.uniform(-1.6, 1.6), rng.uniform(-0.3, 0.3), rng.uniform(-0.2, 0.5) * r), r, None, seg=16))
    o = S.mesh_from(parts, 'cloud', voxel=0.12, smooth=3)
    o.data.materials.append(kit.candy('cloud' + col_top, col_top, col_bot, 1.6, rough=0.9, coat=0.0, axis='Z', emission=0.35))
    o.location = loc
    o.scale = scale
    return o


def tree(loc, s=1.0, col=('#7ad04a', '#2f7a2a'), seed=0):
    rng = random.Random(seed)
    trunk = M('trunk', lambda: lib.mat('trunk', lib.srgb('#6a4026'), rough=0.7))
    lib.cylinder('trunk', (loc[0], loc[1], loc[2] + 0.9 * s), 0.14 * s, 1.8 * s, trunk, seg=10)
    parts = []
    for k in range(6):
        parts.append(lib.sphere('lf', (rng.uniform(-0.6, 0.6) * s, rng.uniform(-0.4, 0.4) * s, (2.2 + rng.uniform(-0.3, 0.9)) * s), rng.uniform(0.55, 0.85) * s, None, seg=14))
    o = S.mesh_from(parts, 'crown', voxel=0.08 * s, smooth=3)
    o.data.materials.append(kit.candy('leaf' + col[0], col[0], col[1], 2.0 * s, rough=0.7, coat=0.0, axis='Z'))
    o.location = (loc[0], loc[1], loc[2])


def graffiti_tex(path, seed, w=1024, h=1024, bg=(30, 20, 60)):
    """Colourful spray panel (crown, strokes, drips) for screens, containers and banners."""
    rng = random.Random(seed)
    im = Image.new('RGB', (w, h), bg)
    d = ImageDraw.Draw(im)
    pal = [(0, 220, 255), (255, 60, 160), (255, 200, 40), (140, 80, 255), (255, 120, 40)]
    for _ in range(26):
        c = rng.choice(pal)
        x, y = rng.uniform(-100, w), rng.uniform(-100, h)
        pts = [(x + rng.uniform(-260, 260), y + rng.uniform(-260, 260)) for _ in range(4)]
        d.line(pts, fill=c, width=int(rng.uniform(30, 90)), joint='curve')
    im = im.filter(ImageFilter.GaussianBlur(2))
    d = ImageDraw.Draw(im)
    d.polygon(tx.crown_poly(w / 2, h * 0.52, w * 0.62), fill=(20, 230, 255))
    d.polygon(tx.crown_poly(w / 2, h * 0.52, w * 0.5), fill=bg)
    for k in range(8):
        x = w / 2 + rng.uniform(-w * 0.25, w * 0.25)
        y0 = h * 0.62
        d.rectangle((x - 7, y0, x + 7, y0 + rng.uniform(40, 160)), fill=(20, 230, 255))
    im.save(path)
    return path


# ====================================================================================== FESTIVAL
def truss_tower(seg, x, y, h):
    S.truss_line(seg, (x, y, 0), (x, y, h))


def excavator(x, y, s, flip=1, seed=0):
    """Bucket-wheel excavator (stylized): crawler base, body, a heavy truss boom with the wheel at its tip, turned
    to a 3/4 view so the bucket wheel reads like in the painting."""
    rust = M('rust', lambda: kit.candy('rust', '#d07a3e', '#5a2a14', 6.0, rough=0.6, coat=0.1, axis='Z'))
    dark = M('rustd', lambda: lib.mat('rustd', lib.srgb('#3a2418'), rough=0.7))
    seg = S.truss_segment()
    seg.data.materials.clear()
    seg.data.materials.append(rust)
    T = 2.4 * s  # boom thickness
    box('crawler', (6 * s, 4 * s, 1.6 * s), (x, y, 0.8 * s), dark, 0.2 * s)
    box('body', (5 * s, 3.6 * s, 4 * s), (x, y, 3.6 * s), rust, 0.15 * s)
    box('cab', (2.4 * s, 2.4 * s, 2.2 * s), (x + flip * 1.4 * s, y - 0.4 * s, 6.6 * s), rust, 0.12 * s)
    for dx in (-1.2, 1.2):
        S.truss_line(seg, (x + dx * s, y, 5.6 * s), (x + dx * 0.3 * s, y, 13 * s), 1.6 * s)
    tip = Vector((x - flip * 16 * s, y - 3.0 * s, 7.5 * s))
    S.truss_line(seg, (x - flip * 1.5 * s, y, 6.6 * s), tuple(tip), T)
    S.truss_line(seg, (x, y, 13 * s), tuple((tip + Vector((x, y, 13 * s))) / 2 + Vector((0, 0, -1.5 * s))), 1.2 * s)
    S.truss_line(seg, (x, y, 13 * s), (x + flip * 11 * s, y + 0.6 * s, 7.0 * s), 1.4 * s)
    box('counter', (3 * s, 2.4 * s, 2.0 * s), (x + flip * 11 * s, y + 0.6 * s, 6.2 * s), dark, 0.12 * s)
    # the wheel, built around its local X axis, turned toward the camera
    R = 4.4 * s
    piv = lib.link(bpy.data.objects.new('wheelpivot', None))
    piv.location = tip + Vector((-flip * 1.0 * s, -0.6 * s, 0.6 * s))
    piv.rotation_euler = (0, 0, math.radians(-flip * 50))
    parts = [lib.cylinder('wheel', (0, 0, 0), R * 0.8, 1.1 * s, rust, seg=48, rot=(0, math.pi / 2, 0), bevel=0.1 * s),
             lib.torus('rim', (0, 0, 0), R * 0.84, 0.22 * s, dark, rot=(0, math.pi / 2, 0), seg=(48, 8)),
             lib.cylinder('hub', (0, 0, 0), 0.9 * s, 1.6 * s, dark, seg=24, rot=(0, math.pi / 2, 0))]
    for k in range(16):
        a = 2 * math.pi * k / 16
        b = box('bucket', (1.4 * s, 1.5 * s, 1.1 * s), (0, math.cos(a) * R, math.sin(a) * R), rust, 0.14 * s)
        b.rotation_euler = (a, 0, 0)
        parts.append(b)
        lip = box('lip', (1.5 * s, 0.25 * s, 0.4 * s), (0, math.cos(a) * (R + 0.7 * s), math.sin(a) * (R + 0.7 * s)), dark, 0.05 * s)
        lip.rotation_euler = (a, 0, 0)
        parts.append(lip)
    for o in parts:
        o.parent = piv


def stage_festival():
    blk = M('stageblk', lambda: lib.mat('stageblk', lib.srgb('#17141f'), rough=0.6))
    seg = S.truss_segment()
    y0 = 6.0
    # deck with graffiti fascia
    box('deck', (18, 5, 1.6), (0, y0 + 2.5, 0.8), blk, 0.05)
    g = graffiti_tex(os.path.join(tx.TEX, 'graf_a.png'), 1, 2048, 256, (24, 18, 40))
    fas = kit.plane('fascia', 18, 1.5, emissive_tex('fascia', g, 0.6))
    fas.rotation_euler = (math.pi / 2, 0, 0)
    fas.location = (0, y0 - 0.02, 0.8)
    # back wall + LED screens
    box('wall', (17, 0.6, 6.4), (0, y0 + 4.8, 4.8), M('wall', lambda: kit.candy('wall', '#2a1a4a', '#120a22', 6.4, rough=0.6, coat=0.0, axis='Z')), 0.05)
    mainscr = graffiti_tex(os.path.join(tx.TEX, 'graf_main.png'), 7, 1600, 900, (40, 16, 70))
    p = kit.plane('screen', 8.0, 4.5, emissive_tex('scr', mainscr, 2.2))
    p.rotation_euler = (math.pi / 2, 0, 0)
    p.location = (0, y0 + 4.45, 4.6)
    box('scrframe', (8.4, 0.3, 4.9), (0, y0 + 4.6, 4.6), M('frm', lambda: lib.mat('frm', lib.srgb('#0c0a12'), metallic=0.5, rough=0.4)), 0.06)
    for sx in (-1, 1):
        side = graffiti_tex(os.path.join(tx.TEX, f'graf_side{sx}.png'), 3 + sx, 600, 1200, (36, 14, 60))
        q = kit.plane('side', 2.6, 5.4, emissive_tex(f'side{sx}', side, 2.0))
        q.rotation_euler = (math.pi / 2, 0, 0)
        q.location = (sx * 6.0, y0 + 4.45, 4.9)
        # speaker line arrays + ground stacks
        for k in range(5):
            box('la', (1.0, 0.9, 0.55), (sx * 8.4, y0 + 1.5, 7.6 - k * 0.62), blk, 0.05)
        for k in range(3):
            box('sub', (1.6, 1.2, 1.1), (sx * 9.6, y0 + 0.4, 0.55 + k * 1.12), blk, 0.06)
        # top banners
        bn = graffiti_tex(os.path.join(tx.TEX, f'graf_ban{sx}.png'), 11 + sx, 500, 1000, (20, 30, 80) if sx < 0 else (70, 20, 60))
        b = kit.plane('ban', 2.0, 4.0, emissive_tex(f'ban{sx}', bn, 1.0))
        b.rotation_euler = (math.pi / 2, 0, 0)
        b.location = (sx * 4.2, y0 + 4.2, 8.0)
    # truss
    for x in (-9.5, -4.5, 4.5, 9.5):
        S.truss_line(seg, (x, y0 + 4.2, 1.6), (x, y0 + 4.2, 9.6))
    S.truss_line(seg, (-9.5, y0 + 4.2, 9.6), (9.5, y0 + 4.2, 9.6))
    S.truss_line(seg, (-9.5, y0 + 3.0, 7.4), (9.5, y0 + 3.0, 7.4))
    for k in range(10):
        x = -8.1 + k * 1.8
        S.par_can((x, y0 + 3.0, 7.1), (x * 0.8, -6, 0), ['#ffd27a', '#ff4fd2', '#3f8dff', '#ffffff'][k % 4], power=400, angle=28)
    # RAPBRAWL badge on top (replaces the painting's festival logo)
    board = box('badge', (6.4, 0.5, 2.0), (0, y0 + 4.0, 10.7), kit.candy('badge', '#ff4fa8', '#7a2aff', 2.0, coat=0.6), 0.25)
    board.rotation_euler = (0, math.radians(-4), 0)
    t = kit.text3d('rb', 'RAPBRAWL', 1.25, kit.flat('#ffffff', 0.3, 0.5), depth=0.12, bevel=0.03, loc=(0, y0 + 3.7, 10.65), rot=(math.pi / 2, math.radians(-4), 0))


def sand_mat():
    m = bpy.data.materials.new('sand')
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = 0.6
    n.inputs['Detail'].default_value = 4
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.4
    ramp.color_ramp.elements[0].color = (*lib.srgb('#d99a58'), 1)
    ramp.color_ramp.elements[1].position = 0.65
    ramp.color_ramp.elements[1].color = (*lib.srgb('#f4c98a'), 1)
    nt.links.new(n.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = 0.95
    return m


def festival(scale=1.0, samples=64):
    sc = lib.reset(samples, transparent=False)
    sc.view_settings.look = 'Medium High Contrast'
    sc.cycles.volume_step_rate = 2.0
    kit._mats.clear()
    kit._link_mesh.clear()
    sun_sky(top='#4a3a9a', mid='#e07aa8', horizon='#ffb04a', strength=1.2)
    rng = random.Random(3)
    # ground: warm sand
    sand = M('sand', lambda: sand_mat())
    kit.plane('ground', 400, 400, sand, z=0)
    # lake behind the right side, river bank trees
    water = kit.plane('lake', 120, 40, M('water', lambda: lib.mat('water', lib.srgb('#6a7ad8'), rough=0.05, spec=0.8)), z=0.02, loc=(30, 40))
    for k in range(22):
        tree((rng.uniform(-44, -12), rng.uniform(14, 22), 0), rng.uniform(1.0, 1.5), seed=k)
    for k in range(12):
        tree((rng.uniform(12, 44), rng.uniform(12, 18), 0), rng.uniform(0.9, 1.4), seed=100 + k)
    # excavators
    excavator(-9, 30, 1.3, flip=1)
    excavator(13, 40, 1.1, flip=-1)
    # stage
    stage_festival()
    # tents, containers, flags, floodlights
    tent_m = M('tent', lambda: kit.candy('tent', '#ffffff', '#d8d4f0', 3.0, rough=0.6, coat=0.0, axis='Z'))
    for (x, y, c) in ((-17, 8, None), (-13.5, 10, '#ff6fae'), (15, 8, '#ff6fae'), (18.5, 10, None)):
        lib.cylinder('tbase', (x, y, 0.8), 2.0, 1.6, tent_m if not c else kit.candy('tc' + c, c, '#a02a6a', 3, rough=0.6, coat=0), seg=24)
        cone = lib.bpy.data.meshes.new('cone')
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=2.3, radius2=0.05, depth=1.8)
        bm.to_mesh(cone)
        o = lib.link(bpy.data.objects.new('troof', cone))
        o.data.materials.append(tent_m if not c else kit.candy('tc' + c, c, '#a02a6a', 3, rough=0.6, coat=0))
        o.location = (x, y, 2.5)
    for k, x in enumerate((-13.0, -10.5, 10.5, 13.0)):
        g = graffiti_tex(os.path.join(tx.TEX, f'cont{k}.png'), 20 + k, 1024, 400, [(30, 60, 120), (80, 30, 90), (20, 90, 90), (90, 60, 20)][k])
        c = box('container', (2.5, 2.4, 2.4), (x, 7.0, 1.2), S.tex_mat(f'cont{k}', g, emission=0.4, rough=0.6), 0.05)
    for x in (-19.5, -16.0, 16.0, 19.5):
        S.tube('pole', (x, 4.0, 0), (x, 4.0, 7.5), 0.07, kit.steel())
        fl = graffiti_tex(os.path.join(tx.TEX, f'flag{x}.png'), int(x), 400, 900, (40, 30, 90))
        f = kit.plane('flag', 1.1, 2.6, emissive_tex(f'flag{x}', fl, 0.8))
        f.rotation_euler = (math.pi / 2, 0, 0)
        f.location = (x + 0.6, 3.95, 5.6)
    for x in (-21.0, 21.0):
        S.tube('flp', (x, 3.0, 0), (x, 3.0, 9.0), 0.08, kit.steel())
        for k in range(4):
            lib.sphere('fll', (x + (k - 1.5) * 0.35, 2.8, 9.0), 0.16, kit.glow('#fff2c0', 18.0), seg=10)
    # big low sun + clouds
    lib.sphere('sun', (78, 160, 11), 6.0, kit.glow('#ffd86a', 6.0), seg=24)
    lib.sphere('sunhalo', (78, 162, 11), 14.0, M('halo', lambda: lib.mat('halo', (1, 0.7, 0.4), emission=lib.srgb('#ffb05a'), estr=0.8, alpha=0.25)), seg=24)
    sl = bpy.data.lights.new('sunl', 'SUN')
    sl.energy = 3.2
    sl.color = (1.0, 0.75, 0.5)
    sl.angle = math.radians(4)
    so = lib.link(bpy.data.objects.new('sunl', sl))
    so.rotation_euler = (math.radians(78), 0, math.radians(200))
    for k, (x, z, s) in enumerate(((-30, 30, 7), (-12, 36, 5), (16, 33, 8), (36, 26, 6), (2, 42, 4))):
        cloud((x, 160, z), (s, s * 0.6, s * 0.5), seed=k)
    lib.area_light('fill', (0, -10, 12), (0, 10, 2), 3000, 20, (1.0, 0.8, 0.9))
    # warm low key from the front left (the stylized read: lit faces, coloured shadows)
    kl = bpy.data.lights.new('key', 'SUN')
    kl.energy = 2.2
    kl.color = (1.0, 0.82, 0.62)
    kl.angle = math.radians(8)
    ko = lib.link(bpy.data.objects.new('key', kl))
    ko.rotation_euler = (math.radians(62), 0, math.radians(-35))
    # light haze for the beams
    hm = bpy.data.materials.new('haze')
    hm.use_nodes = True
    hn = hm.node_tree
    hn.nodes.clear()
    vs = hn.nodes.new('ShaderNodeVolumeScatter')
    vs.inputs['Density'].default_value = 0.006
    ho = hn.nodes.new('ShaderNodeOutputMaterial')
    hn.links.new(vs.outputs['Volume'], ho.inputs['Volume'])
    S.box('haze', (40, 30, 40), (0, 20, 20), hm, 0).visible_shadow = False
    return []


# ====================================================================================== BAHNHOF
def facade_tex(path, cols, rows, wall, lit=0.6, seed=0, shop=False):
    """Plaster facade: framed windows (some lit warm, some pink/blue), sills, a cornice line per floor."""
    rng = random.Random(seed)
    W, H = 128 * cols, 192 * rows
    im = Image.new('RGB', (W, H), wall)
    d = ImageDraw.Draw(im)
    dark = tuple(int(c * 0.7) for c in wall)
    for r in range(rows):
        y0 = r * 192
        d.rectangle((0, y0 + 178, W, y0 + 192), fill=dark)
        for c in range(cols):
            x0 = c * 128
            on = rng.random() < lit
            col = rng.choice([(255, 196, 120), (255, 170, 90), (255, 120, 190), (120, 190, 255)]) if on else (30, 34, 60)
            d.rectangle((x0 + 30, y0 + 40, x0 + 98, y0 + 150), fill=(250, 240, 220))
            d.rectangle((x0 + 36, y0 + 46, x0 + 92, y0 + 144), fill=col)
            d.line((x0 + 64, y0 + 46, x0 + 64, y0 + 144), fill=(250, 240, 220), width=4)
            d.line((x0 + 36, y0 + 90, x0 + 92, y0 + 90), fill=(250, 240, 220), width=4)
            d.rectangle((x0 + 24, y0 + 150, x0 + 104, y0 + 160), fill=dark)
    im.save(path)
    return path


GF = 4.0  # ground floor height (shops)
FH = 3.0  # upper floors


def building(x, y, w, d, floors, wall, seed, lit=0.6, roof='#3a2a3a'):
    """Front facade as UV-mapped planes (plain ground floor for the 3D shop fronts, textured upper floors with
    windows), a box behind for the volume, cornice + floor ledges."""
    h = GF + (floors - 1) * FH
    cols = max(2, round(w / 2.0))
    path = facade_tex(os.path.join(tx.TEX, f'fac{seed}.png'), cols, floors - 1, wall, lit, seed)
    up = kit.plane(f'up{seed}', w, h - GF, S.tex_mat(f'fac{seed}', path, emission=0.25, rough=0.7))
    up.rotation_euler = (math.pi / 2, 0, 0)
    up.location = (x, y - 0.02, GF + (h - GF) / 2)
    gwall = tuple(int(c * 0.82) for c in wall)
    gf = kit.plane(f'gf{seed}', w, GF, kit.flat('#%02x%02x%02x' % gwall, 0.7))
    gf.rotation_euler = (math.pi / 2, 0, 0)
    gf.location = (x, y - 0.02, GF / 2)
    box(f'bld{seed}', (w, d, h), (x, y + d / 2, h / 2), kit.flat('#%02x%02x%02x' % wall, 0.7), 0.0)
    box('cornice', (w + 0.3, 0.5, 0.35), (x, y - 0.1, h + 0.15), kit.flat(roof, 0.6), 0.06)
    box('gfledge', (w + 0.1, 0.35, 0.2), (x, y - 0.12, GF), kit.flat('#d8c8b0', 0.6), 0.03)
    for f in range(2, floors):
        box('ledge', (w + 0.1, 0.25, 0.12), (x, y - 0.1, GF + (f - 1) * FH), kit.flat('#d8c8b0', 0.6), 0.03)
    return h


def neon_text(text, loc, size, color, board=None, font='anton', depth=0.06):
    if board:
        bw, bh, bc = board
        box('board', (bw, 0.25, bh), (loc[0], loc[1] + 0.15, loc[2]), kit.flat(bc, 0.5), 0.08)
    kit.text3d('neon', text, size, kit.glow(color, 9.0), depth=depth, bevel=0.012, font=font, loc=loc, rot=(math.pi / 2, 0, 0))


def street_lamp(x, y, h=4.2):
    pole = M('lampp', lambda: lib.mat('lampp', lib.srgb('#1c1a26'), metallic=0.7, rough=0.35))
    S.tube('lp', (x, y, 0), (x, y, h), 0.07, pole)
    S.tube('la', (x, y, h), (x + 0.5, y, h + 0.2), 0.05, pole)
    box('lh', (0.32, 0.32, 0.45), (x + 0.55, y, h - 0.05), pole, 0.05)
    lib.sphere('lb', (x + 0.55, y, h - 0.1), 0.15, kit.glow('#ffc26a', 30.0), seg=12)
    pl = bpy.data.lights.new('lamp', 'POINT')
    pl.energy = 300
    pl.color = (1.0, 0.75, 0.45)
    pl.shadow_soft_size = 0.3
    po = lib.link(bpy.data.objects.new('lamp', pl))
    po.location = (x + 0.55, y - 0.3, h - 0.3)


def shop_window(x, y, z, w, h, color, seed):
    rng = random.Random(seed)
    W, H = 512, 400
    im = Image.new('RGB', (W, H), (40, 30, 30))
    d = ImageDraw.Draw(im)
    for r in range(5):
        d.rectangle((0, 70 + r * 66, W, 76 + r * 66), fill=(200, 200, 210))
        for k in range(18):
            c = rng.choice([(255, 80, 80), (80, 200, 255), (255, 220, 80), (120, 255, 120), (255, 140, 40), (230, 230, 230)])
            xx = 8 + k * 28
            d.rectangle((xx, 20 + r * 66, xx + 20, 68 + r * 66), fill=c)
    p = os.path.join(tx.TEX, f'shop{seed}.png')
    im.save(p)
    q = kit.plane('win', w, h, S.tex_mat(f'shop{seed}', p, emission=1.6, rough=0.3))
    q.rotation_euler = (math.pi / 2, 0, 0)
    q.location = (x, y, z)
    box('wframe', (w + 0.2, 0.2, h + 0.2), (x, y + 0.12, z), kit.flat(color, 0.4), 0.04)


def bahnhof(scale=1.0, samples=64):
    sc = lib.reset(samples, transparent=False)
    sc.view_settings.look = 'Medium High Contrast'
    kit._mats.clear()
    kit._link_mesh.clear()
    sun_sky(top='#0a0f2e', mid='#1a2a6a', horizon='#3a3a7a', strength=0.6)
    signs = []
    # street + sidewalk (wet)
    asph = M('asph', lambda: lib.mat('asph', lib.srgb('#14141c'), rough=0.12, spec=0.8))
    kit.plane('street', 200, 200, asph, z=0)
    box('curb', (80, 2.4, 0.18), (0, 1.6, 0.09), M('walk', lambda: lib.mat('walk', lib.srgb('#3a3644'), rough=0.3)), 0.03)
    y = 2.8
    row_before = set(bpy.data.objects)
    # left corner building (sign plate, shutter, posters)
    building(-17.5, y, 8, 8, 5, (214, 196, 168), 1)
    box('shutter', (2.6, 0.1, 3.0), (-18.5, y - 0.05, 1.5), M('shut', lambda: lib.mat('shut', lib.srgb('#5a5a66'), metallic=0.6, rough=0.4)), 0.02)
    box('stsign', (2.6, 0.1, 0.6), (-19.0, y - 0.08, 4.4), kit.candy('stsign', '#2a4ad8', '#142a8a', 0.6), 0.05)
    kit.text3d('st', 'ELBESTRASSE', 0.34, kit.flat('#ffffff', 0.4), depth=0.02, bevel=0.0, font='anton', loc=(-19.0, y - 0.15, 4.4), rot=(math.pi / 2, 0, 0))
    poster = graffiti_tex(os.path.join(tx.TEX, 'poster1.png'), 41, 512, 700, (30, 24, 40))
    pp = kit.plane('poster', 1.6, 2.2, S.tex_mat('poster', poster, emission=0.3))
    pp.rotation_euler = (math.pi / 2, 0, 0)
    pp.location = (-15.6, y - 0.06, 1.9)
    # club "PIK ASS": dark red facade, rounded canopy with red neon, double doors
    building(-9.0, y, 9, 8, 4, (120, 60, 70), 2, lit=0.5)
    canopy = lib.cylinder('canopy', (-9.0, y - 0.6, 4.75), 3.6, 1.4, kit.candy('canopy', '#5a1022', '#240610', 1.6, coat=0.6), seg=48, rot=(0, 0, 0))
    canopy.scale = (1.0, 0.45, 1.0)
    lib.torus('neonring', (-9.0, y - 0.6, 4.05), 3.55, 0.06, kit.glow('#ff2a4a', 12.0), seg=(64, 8)).scale = (1.0, 0.45, 1.0)
    neon_text('PIK ASS', (-9.0, y - 2.25, 4.75), 2.0, '#ff3355')
    spade = [(0, 0.5), (0.35, 0.05), (0.18, -0.15), (0.06, -0.05), (0.15, -0.45), (-0.15, -0.45), (-0.06, -0.05), (-0.18, -0.15), (-0.35, 0.05)]
    lib.tube_path('spade', [(-9.0 + x * 1.3, y - 1.2, 6.6 + z * 1.3) for x, z in spade] + [(-9.0, y - 1.2, 6.6 + 0.65)], 0.07, kit.glow('#ff3355', 14.0), closed=True)
    box('door', (2.6, 0.2, 3.0), (-9.0, y - 0.05, 1.5), kit.candy('door', '#5a0a16', '#2a040a', 3.0, coat=0.8), 0.05)
    for sx in (-1, 1):
        S.tube('np', (-9.0 + sx * 2.2, y - 0.4, 0), (-9.0 + sx * 2.2, y - 0.4, 3.6), 0.08, kit.glow('#ff2a4a', 8.0))
        lib.cylinder('post', (-9.0 + sx * 1.9, y - 1.8, 0.5), 0.06, 1.0, kit.gold(), seg=12)
    S.tube('rope', (-10.9, y - 1.8, 0.85), (-7.1, y - 1.8, 0.85), 0.04, kit.candy('ropec', '#ff3355', '#a01028', 0.1))
    # kiosk "KIOSK 069": blue neon board, striped awning, glowing shelves
    building(0.5, y, 10, 8, 4, (196, 170, 150), 3, lit=0.55)
    box('kboard', (8.6, 0.3, 1.5), (0.5, y - 0.2, 4.4), kit.candy('kboard', '#0e1e4a', '#060c22', 1.5), 0.08)
    lib.frame('kneon', [(x + 0.5, z) for x, z in lib.rounded_rect_pts(8.4, 1.3, 0.2)], 0.05, 0.06, kit.glow('#28d0ff', 10.0), bevel=0.01, seg=2)
    bpy.data.objects['kneon'].rotation_euler = (math.pi / 2, 0, 0)
    bpy.data.objects['kneon'].location = (0, y - 0.36, 4.4)
    neon_text('KIOSK 069', (0.5, y - 0.42, 4.4), 1.7, '#38d8ff')
    shop_window(-1.2, y - 0.05, 1.75, 3.2, 2.4, '#1a2a6a', 4)
    shop_window(3.0, y - 0.05, 1.75, 2.4, 2.4, '#1a2a6a', 5)
    for k in range(10):
        stripe = box('aw', (0.86, 1.4, 0.08), (-3.4 + k * 0.86, y - 0.75, 3.35), kit.flat('#2a5ad8' if k % 2 else '#ffffff', 0.5), 0.0)
        stripe.rotation_euler = (math.radians(-22), 0, 0)
    neon_text('OFFEN', (3.0, y - 0.25, 2.6), 0.32, '#ff4ad8', font='lilita')
    # wine bar "WEINECK": warm sign, wood front
    building(10.5, y, 8, 8, 4, (170, 140, 110), 6, lit=0.6)
    building(-25.5, y, 8, 8, 5, (180, 150, 170), 9, lit=0.6)
    box('wboard', (5.4, 0.3, 1.2), (10.5, y - 0.2, 4.2), kit.candy('wboard', '#3a1e0a', '#1a0c04', 1.2), 0.08)
    neon_text('WEINECK', (10.5, y - 0.42, 4.2), 1.4, '#ffb050')
    shop_window(10.5, y - 0.05, 1.75, 4.4, 2.4, '#5a3010', 7)
    # the shop row sits left of centre so the street gap with the skyline is inside the fight view
    OX = -5.5
    for o in set(bpy.data.objects) - row_before:
        if o.parent is None:
            o.location.x += OX
    # the street running away to the right: facades facing the street axis (pink neon windows like the painting)
    for k in range(7):
        piv = lib.link(bpy.data.objects.new('row', None))
        before = set(bpy.data.objects)
        building(0, 0, 9, 8, 4 + (k % 2), (196 - k * 8, 120 + k * 5, 156), 10 + k, lit=0.75)
        for o in set(bpy.data.objects) - before:
            if o.parent is None and o is not piv:
                o.parent = piv
        piv.location = (19.5, y + 6 + k * 9.2, 0)
        piv.rotation_euler = (0, 0, math.radians(-90))
    for k in range(3):
        building(7.0, y + 40 + k * 14, 7, 6, 4, (150, 140, 160), 30 + k, lit=0.5)
    for k in range(6):
        street_lamp(17.0 + k * 0.4, y + 1 + k * 7.5)
    street_lamp(-18.5, y - 1.2)
    street_lamp(0.1, y - 1.2)
    for k in range(9):
        tx.windows(seed=20 + k)
        x = 4 + k * 5.5
        h = 20 + (k * 37) % 40
        mtl = S.tex_mat(f'sky{k}', os.path.join(tx.TEX, f'windows{20 + k}.png'), emission=1.0, rough=0.5)
        t = box('tower', (5, 5, h), (x, 90 + (k % 3) * 12, h / 2), mtl, 0.0)
    # the tall tower with the red tip (skyline icon)
    tw = box('main', (6, 6, 70), (22, 110, 35), S.tex_mat('mainT', os.path.join(tx.TEX, 'windows21.png'), emission=1.3, rough=0.5), 0.0)
    S.tube('spire', (22, 110, 70), (22, 110, 82), 0.3, kit.glow('#ff2a4a', 10.0))
    # props: bins, bollards, crates
    for x in (-9.0, 0.5, 1.5):
        lib.cylinder('bin', (x, y - 0.6, 0.5), 0.35, 1.0, M('bin', lambda: lib.mat('bin', lib.srgb('#6a6e7a'), metallic=0.6, rough=0.35)), seg=20, bevel=0.03)
    for k in range(6):
        lib.cylinder('bollard', (9.5 + k * 1.4, y - 1.3, 0.5), 0.09, 1.0, M('bol', lambda: lib.mat('bol', lib.srgb('#1a1a22'), metallic=0.6, rough=0.4)), seg=12)
    # neon signs for the flicker (uv boxes in the backdrop image)
    signs = [('PIK ASS', (-18.4, -11.2, 4.1, 7.7), '#ff1e3c'), ('KIOSK 069', (-9.3, -0.7, 3.7, 5.1), '#28beff'), ('WEINECK', (2.3, 7.7, 3.6, 4.8), '#ff9632')]
    # moon light + fill
    sl = bpy.data.lights.new('moon', 'SUN')
    sl.energy = 0.4
    sl.color = (0.6, 0.7, 1.0)
    so = lib.link(bpy.data.objects.new('moon', sl))
    so.rotation_euler = (math.radians(55), 0, math.radians(-25))
    lib.area_light('fill', (0, -12, 8), (0, 3, 3), 1600, 20, (0.8, 0.7, 1.0))
    return signs


def sign_uvs(signs, arena):
    """Project the neon sign boxes (x0, x1, z0, z1 at the facade line y=2.8) into backdrop uv (0..1, v from the top)."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    bpy.context.view_layer.update()  # the new camera's matrix_world is identity until the depsgraph updates
    cam = sc.camera
    out = []
    for _name, (x0, x1, z0, z1), col in signs:
        a = world_to_camera_view(sc, cam, Vector((x0, 2.6, z1)))
        b = world_to_camera_view(sc, cam, Vector((x1, 2.6, z0)))
        out.append({'uv': [round(a.x, 4), round(1 - a.y, 4), round(b.x, 4), round(1 - b.y, 4)], 'color': col})
    return out


def glare(threshold):
    sc = bpy.context.scene
    sc.use_nodes = True
    nt = sc.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers')
    g = nt.nodes.new('CompositorNodeGlare')
    g.glare_type = 'FOG_GLOW'
    g.quality = 'HIGH'
    g.threshold = threshold
    g.size = 8
    g.mix = -0.55
    comp = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(rl.outputs['Image'], g.inputs['Image'])
    nt.links.new(g.outputs['Image'], comp.inputs['Image'])


def render(arena, scale=1.0, samples=64, meta_only=False):
    signs = festival(scale, samples) if arena == 'festival' else bahnhof(scale, samples)
    cam, rx, ry, ground = cam_setup(arena, scale)
    signs = sign_uvs(signs, arena) if signs else []
    out = os.path.join(lib.ROOT, 'public', 'assets', 'arena', f'{arena}3')
    os.makedirs(out, exist_ok=True)
    if meta_only:  # re-project the sign boxes without rendering (argument 'meta')
        with open(os.path.join(out, 'meta.json')) as f:
            meta = json.load(f)
        meta['signs'] = signs
        with open(os.path.join(out, 'meta.json'), 'w') as f:
            json.dump(meta, f, indent=1)
        return out
    tmp = os.path.join(lib.CACHE, f'arena_{arena}.png')
    glare(0.9 if arena == 'bahnhof' else 0.95)
    bpy.context.scene.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    from PIL import ImageEnhance
    im = Image.open(tmp).convert('RGB')
    im = ImageEnhance.Color(im).enhance(1.15)
    im.save(os.path.join(out, 'backdrop.jpg'), quality=88)
    lo = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    lo.save(os.path.join(out, 'backdrop_low.jpg'), quality=85)
    meta = {'width_px': rx, 'height_px': ry, 'ground_px': ground, 'margin': MARGIN, 'signs': signs}
    with open(os.path.join(out, 'meta.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    im.resize((1500, round(1500 * ry / rx))).save(os.path.join(lib.ROOT, 'artifacts', 'ui3', f'arena_{arena}.jpg'), quality=85)
    return out


if __name__ == '__main__' and (len(sys.argv) < 2 or sys.argv[1] != 'floors'):
    a = sys.argv[1] if len(sys.argv) > 1 else 'festival'
    sc = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
    sp = int(sys.argv[3]) if len(sys.argv) > 3 else 64
    import time
    t0 = time.time()
    print(render(a, sc, sp, len(sys.argv) > 4 and sys.argv[4] == 'meta'), f'{time.time() - t0:.0f}s')


def floor_tiles():
    """Stylized floor tiles under the fighters (tile seamlessly): warm sand for the festival, wet asphalt with
    puddles and cracks for the Bahnhofsviertel."""
    import numpy as np
    N = 1024
    rng = np.random.default_rng(5)

    def noise(scale, oct=4):
        acc = np.zeros((N, N), np.float32)
        amp = 1.0
        for o in range(oct):
            k = scale * 2 ** o
            g = rng.random((k, k)).astype(np.float32)
            # periodic: interpolate a 3x3 tiling of the grid and keep the middle -> the tile wraps without seams
            big = Image.fromarray((np.tile(g, (3, 3)) * 255).astype(np.uint8)).resize((3 * N, 3 * N), Image.BICUBIC)
            a = np.asarray(big, np.float32)[N:2 * N, N:2 * N] / 255
            acc += a * amp
            amp *= 0.5
        return (acc - acc.min()) / (acc.max() - acc.min())

    out = os.path.join(lib.ROOT, 'public', 'assets', 'arena')
    n = noise(4)
    c1, c2 = np.array([217, 154, 88]), np.array([244, 201, 138])
    sand = c1 + (c2 - c1) * np.clip((n - 0.3) / 0.5, 0, 1)[..., None]
    fine = noise(64, 2)[..., None]
    sand = sand * (0.92 + 0.12 * fine)
    Image.fromarray(np.clip(sand, 0, 255).astype(np.uint8)).save(os.path.join(out, 'festival3', 'floor.jpg'), quality=88)
    n = noise(6)
    base = np.array([24, 22, 32]) + (np.array([44, 40, 58]) - np.array([24, 22, 32])) * n[..., None]
    puddle = np.clip((noise(3) - 0.55) / 0.15, 0, 1)[..., None]
    base = base * (1 - 0.45 * puddle) + np.array([30, 34, 60]) * 0.45 * puddle
    im = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    r = random.Random(4)
    for _ in range(14):
        x, y = r.uniform(0, N), r.uniform(0, N)
        pts = [(x, y)]
        for k in range(6):
            x += r.uniform(-60, 60)
            y += r.uniform(-60, 60)
            pts.append((x % N, y % N))
        d.line(pts, fill=(14, 12, 20), width=3)
        d.line([(x2 - N if x2 > N / 2 else x2 + N, y2) for x2, y2 in pts], fill=(14, 12, 20), width=3)
    im.save(os.path.join(out, 'bahnhof3', 'floor.jpg'), quality=88)


if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] == 'floors':
    floor_tiles()
