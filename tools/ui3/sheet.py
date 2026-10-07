# Look calibration (S13b): a few v3 pieces rendered one by one -> artifacts/ui3/sheet/*.png
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402
from lib import Vector  # noqa: E402

OUT = os.path.join(lib.ROOT, 'artifacts', 'ui3', 'sheet')
os.makedirs(OUT, exist_ok=True)
PX = 200  # px per metre (1 ref px = 1 cm, rendered at 2x)
only = sys.argv[1].split(',') if len(sys.argv) > 1 else None


def go(name, fn, w, h, samples=96):
    if only and name not in only:
        return
    t = time.time()
    lib.reset(samples)
    lib.studio_world(0.55)
    lib.ui_lights()
    fn()
    lib.ortho_camera(w, h, PX)
    lib.render(os.path.join(OUT, f'{name}.png'))
    print(name, f'{time.time() - t:.1f}s', flush=True)


def gold_button():
    W, H = 5.3, 1.36
    outer = lib.rounded_rect_pts(W, H, 0.42)
    # chunky gold frame
    lib.frame('rim', outer, 0.16, 0.34, lib.gold(), bevel=0.07)
    # dark inner lip
    lib.frame('lip', lib.inset(outer, 0.15), 0.05, 0.26, lib.mat('lip', lib.srgb('#3a1d00'), rough=0.5), bevel=0.02)
    # glossy yellow face, graded top->bottom
    face = lib.slab('face', lib.inset(outer, 0.19), 0.24, 0.09, lib.gradient_mat('yel', '#ffd21f', '#ff8a00', axis='Y', lo=-0.55, hi=0.55, rough=0.3, coat=0.5), seg=6)
    # top gloss band
    gl = lib.slab('gloss', lib.rounded_rect_pts(W - 0.7, 0.34, 0.17), 0.02, 0.01, lib.mat('gl', (1, 1, 1), rough=0.1, alpha=0.22, emission=(1, 1, 0.9), estr=0.25), z0=0.25)
    gl.location.y = 0.33
    # bolts in the corners of the frame
    for sx in (-1, 1):
        for sy in (-1, 1):
            lib.sphere('bolt', (sx * (W / 2 - 0.2), sy * (H / 2 - 0.2), 0.32), 0.06, lib.steel('bs', '#e9e3d0', 0.2), scale=(1, 1, 0.6))
    # chains to both sides
    for sx in (-1, 1):
        lib.chain(f'ch{sx}', (sx * (W / 2 - 0.08), 0.25, 0.2), (sx * (W / 2 + 0.55), -0.45, 0.2), 0.42, 0.07, lib.gold('cg', '#ffb829', 0.2))


def navy_panel():
    W, H = 4.0, 0.98
    outer = lib.rounded_rect_pts(W, H, 0.2)
    lib.frame('rim', outer, 0.07, 0.2, lib.gold(), bevel=0.03)
    lib.slab('face', lib.inset(outer, 0.06), 0.12, 0.03, lib.gradient_mat('navy', '#1d2466', '#0b0e30', axis='Y', lo=-0.5, hi=0.5, rough=0.45, coat=0.4), seg=4)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lib.sphere('rv', (sx * (W / 2 - 0.12), sy * (H / 2 - 0.12), 0.2), 0.035, lib.gold('rg', '#ffe08a', 0.15), scale=(1, 1, 0.6))


def coin():
    g = lib.gold('coin', '#ffbf2e', 0.18)
    lib.cylinder('c', (0, 0, 0), 0.5, 0.16, g, seg=64, bevel=0.045)
    lib.frame('ring', [(0.43 * math.cos(a), 0.43 * math.sin(a)) for a in [2 * math.pi * i / 64 for i in range(64)]], 0.05, 0.03, lib.gold('cr', '#ffd75a', 0.15), z0=0.08)
    # crown emboss
    pts = [(-0.24, -0.14), (0.24, -0.14), (0.28, 0.16), (0.12, 0.02), (0.0, 0.22), (-0.12, 0.02), (-0.28, 0.16)]
    lib.slab('crown', pts, 0.05, 0.015, lib.gold('cw', '#fff0a8', 0.12), z0=0.08)
    o = bpy.data.objects
    for ob in list(o):
        if ob.type == 'MESH':
            ob.rotation_euler = (math.radians(14), math.radians(-18), 0)


def gem():
    # brilliant-ish cut: table, crown, girdle, pavilion
    import bmesh
    bm = bmesh.new()
    n = 8
    table = [bm.verts.new((0.26 * math.cos(2 * math.pi * i / n), 0.26 * math.sin(2 * math.pi * i / n), 0.2)) for i in range(n)]
    gird = [bm.verts.new((0.5 * math.cos(2 * math.pi * (i + 0.5) / n), 0.5 * math.sin(2 * math.pi * (i + 0.5) / n), 0.04)) for i in range(n)]
    tip = bm.verts.new((0, 0, -0.42))
    bm.faces.new(table)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((table[i], gird[i], table[j]))
        bm.faces.new((gird[i], gird[j], table[j]))
        bm.faces.new((gird[i], tip, gird[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    m = lib.mat('gem', lib.srgb('#0a7bff'), rough=0.02, transmission=1.0, ior=1.6)
    o = lib.obj_from_bm('gem', bm, m, smooth=False)
    o.rotation_euler = (math.radians(-62), 0, math.radians(8))
    # inner glow core so it reads blue, not black
    lib.sphere('core', (0, 0, -0.05), 0.18, lib.mat('glow', lib.srgb('#1f7bff'), emission=lib.srgb('#3fa0ff'), estr=3.0))


def bolt():
    pts = [(0.08, 0.55), (-0.3, -0.05), (-0.02, -0.05), (-0.12, -0.55), (0.32, 0.12), (0.04, 0.12), (0.18, 0.55)]
    pts = list(reversed(pts))
    lib.slab('bolt', lib.round_corners(pts, 0.03, 3), 0.16, 0.05, lib.gradient_mat('by', '#ffe02a', '#ff8800', axis='Y', lo=-0.5, hi=0.5, rough=0.25, coat=0.5))
    bpy.data.objects['bolt'].rotation_euler = (math.radians(10), math.radians(-14), 0)


import bpy  # noqa: E402

go('button', gold_button, 6.6, 2.0)
go('panel', navy_panel, 4.3, 1.3)
go('coin', coin, 1.4, 1.4)
go('gem', gem, 1.4, 1.4)
go('bolt', bolt, 1.4, 1.4)
