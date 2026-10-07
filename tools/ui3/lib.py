# Design v3 (S13b, D46): stylized 3D mobile-game UI pieces rendered in Blender Cycles - chunky beveled panels,
# metallic frames, glossy buttons, 3D icons, soft studio light. Shared scene/material/geometry helpers.
# Run the builders with plain python3 (bpy module), e.g. python3 tools/ui3/sheet.py
import math
import os

import bpy  # noqa: I001 (bpy must come before bmesh)
import bmesh
import numpy as np
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, '.cache', 'ui3')
os.makedirs(CACHE, exist_ok=True)


# ------------------------------------------------------------------ scene
def reset(samples=64, transparent=True, look=None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.max_bounces = 8
    sc.cycles.glossy_bounces = 4
    sc.cycles.transmission_bounces = 8
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.threads_mode = 'AUTO'
    # Standard keeps the candy saturation of mobile-game art (AgX/Filmic wash the yellows out)
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = look or 'None'
    sc.view_settings.exposure = 0.0
    return sc


def studio_world(strength=1.0, warm=(1.0, 0.86, 0.66), cool=(0.55, 0.62, 1.0), name='studio'):
    """Synthetic studio HDRI: dark violet backdrop, a big soft top box, two strip lights and a warm floor bounce -
    metals get readable highlight/shadow bands (the 'gold reads as gold' part of the look)."""
    path = os.path.join(CACHE, f'{name}.exr')
    if not os.path.exists(path):
        W, H = 1024, 512
        u = (np.arange(W) + 0.5) / W
        v = (np.arange(H) + 0.5) / H
        lon = (u - 0.5) * 2 * math.pi  # -pi..pi
        lat = (0.5 - v) * math.pi  # +pi/2 top
        LON, LAT = np.meshgrid(lon, lat)
        img = np.zeros((H, W, 3), np.float32)
        base = np.array([0.05, 0.035, 0.09], np.float32)
        img[:] = base
        # sky gradient
        t = np.clip((LAT + 0.2) / 1.6, 0, 1)[..., None]
        img += t * np.array([0.12, 0.1, 0.22], np.float32)

        def box(clon, clat, wlon, wlat, col, power, soft=0.25):
            d = np.maximum(np.abs(((LON - clon + math.pi) % (2 * math.pi)) - math.pi) / wlon, np.abs(LAT - clat) / wlat)
            m = np.clip((1 + soft - d) / soft, 0, 1)
            return m[..., None] * np.array(col, np.float32) * power

        img += box(-0.5, 1.05, 0.9, 0.35, (1.0, 0.97, 0.92), 9.0)  # top softbox (front-left)
        img += box(-1.7, 0.25, 0.12, 0.6, warm, 6.0, 0.4)  # warm strip left
        img += box(1.6, 0.3, 0.12, 0.6, cool, 5.0, 0.4)  # cool strip right
        img += box(3.0, 0.4, 0.5, 0.3, (1.0, 0.4, 0.85), 2.0, 0.6)  # magenta back rim
        img += box(0.0, -0.9, 3.2, 0.5, (0.35, 0.2, 0.08), 1.0, 0.8)  # warm floor bounce
        bimg = bpy.data.images.new('studio_gen', W, H, alpha=False, float_buffer=True)
        rgba = np.concatenate([img[::-1], np.ones((H, W, 1), np.float32)], axis=2)
        bimg.pixels.foreach_set(rgba.ravel())
        bimg.filepath_raw = path
        bimg.file_format = 'OPEN_EXR'
        bimg.save()
    w = bpy.data.worlds.new('world')
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(path, check_existing=True)
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    return w


def area_light(name, loc, target=(0, 0, 0), power=300, size=4.0, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy = power
    d.size = size
    d.color = color
    o = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    look_at(o, target)
    return o


def look_at(o, target):
    d = Vector(target) - o.location
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def ortho_camera(width_m, height_m, px_per_m, z=20.0, name='cam'):
    """Camera looking down -Z onto the XY plane: x right, y up, 1 m = px_per_m pixels."""
    c = bpy.data.cameras.new(name)
    c.type = 'ORTHO'
    c.ortho_scale = max(width_m, height_m)
    c.clip_start = 0.1
    c.clip_end = 100
    o = bpy.data.objects.new(name, c)
    bpy.context.scene.collection.objects.link(o)
    o.location = (0, 0, z)
    bpy.context.scene.camera = o
    sc = bpy.context.scene
    sc.render.resolution_x = max(4, round(width_m * px_per_m))
    sc.render.resolution_y = max(4, round(height_m * px_per_m))
    sc.render.resolution_percentage = 100
    return o


def ui_lights(k=1.0):
    """Key from the upper left front, cool fill right, warm rim from behind - the soft toon studio look."""
    area_light('key', (-6, 7, 12), (0, 0, 0), 900 * k, 10, (1.0, 0.96, 0.9))
    area_light('fill', (8, -3, 8), (0, 0, 0), 180 * k, 8, (0.7, 0.78, 1.0))
    area_light('rim', (0, 9, -2), (0, 0, 0.5), 400 * k, 6, (1.0, 0.7, 0.95))


def render(path):
    sc = bpy.context.scene
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


# ------------------------------------------------------------------ materials
def mat(name, color, metallic=0.0, rough=0.4, coat=0.0, coat_rough=0.05, emission=None, estr=0.0, transmission=0.0,
        ior=1.45, spec=0.5, sss=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = rough
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Coat Roughness'].default_value = coat_rough
    p.inputs['Specular IOR Level'].default_value = spec
    p.inputs['Transmission Weight'].default_value = transmission
    p.inputs['IOR'].default_value = ior
    p.inputs['Subsurface Weight'].default_value = sss
    p.inputs['Alpha'].default_value = alpha
    if emission:
        p.inputs['Emission Color'].default_value = (*emission, 1)
        p.inputs['Emission Strength'].default_value = estr
    return m


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def gold(name='gold', tint='#ffc23d', rough=0.2):
    return mat(name, srgb(tint), metallic=1.0, rough=rough)


def steel(name='steel', tint='#9aa3b8', rough=0.28):
    return mat(name, srgb(tint), metallic=1.0, rough=rough)


def enamel(name, hexcol, rough=0.35, coat=1.0):
    return mat(name, srgb(hexcol), rough=rough, coat=coat, coat_rough=0.04)


def gradient_mat(name, top, bottom, rough=0.35, coat=1.0, axis='Z', lo=-1.0, hi=1.0, emission=0.0, metallic=0.0):
    """Base colour graded along an object-space axis (top -> bottom): the lit-from-above glossy candy look."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = lo
    mr.inputs['From Max'].default_value = hi
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*srgb(bottom), 1)
    ramp.color_ramp.elements[1].color = (*srgb(top), 1)
    nt.links.new(tc.outputs['Object'], sep.inputs['Vector'])
    nt.links.new(sep.outputs[axis], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    if emission:
        nt.links.new(ramp.outputs['Color'], p.inputs['Emission Color'])
        p.inputs['Emission Strength'].default_value = emission
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Coat Roughness'].default_value = 0.04
    return m


# ------------------------------------------------------------------ geometry
def link(o):
    bpy.context.scene.collection.objects.link(o)
    return o


def obj_from_bm(name, bm, material=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    if material:
        o.data.materials.append(material)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def rounded_rect_pts(w, h, r, seg=10):
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def poly_pts(n, rx, ry, rot=0.0, r=0.0, seg=6):
    """Regular polygon (hexagon = 6) with optional rounded corners."""
    base = [(rx * math.cos(rot + 2 * math.pi * i / n), ry * math.sin(rot + 2 * math.pi * i / n)) for i in range(n)]
    if r <= 0:
        return base
    return round_corners(base, r, seg)


def round_corners(pts, r, seg=6):
    out = []
    n = len(pts)
    for i in range(n):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        a = (p0 - p1).normalized()
        b = (p2 - p1).normalized()
        ang = math.acos(max(-1, min(1, a.dot(b))))
        d = min(r / math.tan(ang / 2), (p0 - p1).length * 0.45, (p2 - p1).length * 0.45)
        s = p1 + a * d
        e = p1 + b * d
        for k in range(seg + 1):
            t = k / seg
            q = (1 - t) ** 2 * s + 2 * (1 - t) * t * p1 + t * t * e
            out.append((q.x, q.y))
    return out


def slab(name, pts, depth, bevel, material=None, seg=5, z0=0.0, profile=0.5):
    """Extruded 2D outline (ccw points, metres) with a soft bevel on the front/back edges - a chunky UI block.
    Front face at z0 + depth, back at z0."""
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, z0)) for x, y in pts]
    f = bm.faces.new(verts)
    bmesh.ops.recalc_face_normals(bm, faces=[f])
    if f.normal.z < 0:
        f.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    top = [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0, 0, depth))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bm(name, bm, material)
    if bevel > 0:
        b = o.modifiers.new('bevel', 'BEVEL')
        b.width = bevel
        b.segments = seg
        b.limit_method = 'ANGLE'
        b.angle_limit = math.radians(50)
        b.profile = profile
        b.harden_normals = False
    return o


def tube_path(name, pts, radius, material=None, closed=True, res=6, profile=None):
    """A frame/rail: a round (or custom-profile) tube along a 2D path in the XY plane."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2] if len(p) > 2 else 0.0, 1)
    sp.use_cyclic_u = closed
    cu.bevel_mode = 'ROUND' if profile is None else 'OBJECT'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    if profile is not None:
        cu.bevel_object = profile
    cu.use_fill_caps = True
    o = link(bpy.data.objects.new(name, cu))
    if material:
        o.data.materials.append(material)
    return o


def frame(name, pts, width, depth, material, z0=0.0, bevel=None, seg=4):
    """Flat ring between an outline and its inset (beveled metal frame around a panel)."""
    inner = inset(pts, width)
    bm = bmesh.new()
    n = len(pts)
    ob = [bm.verts.new((x, y, z0)) for x, y in pts]
    ib = [bm.verts.new((x, y, z0)) for x, y in inner]
    ot = [bm.verts.new((x, y, z0 + depth)) for x, y in pts]
    it = [bm.verts.new((x, y, z0 + depth)) for x, y in inner]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ot[i], ot[j], it[j], it[i]))  # top
        bm.faces.new((ob[i], ib[i], ib[j], ob[j]))  # bottom
        bm.faces.new((ob[i], ob[j], ot[j], ot[i]))  # outer wall
        bm.faces.new((ib[i], it[i], it[j], ib[j]))  # inner wall
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bm(name, bm, material)
    b = o.modifiers.new('bevel', 'BEVEL')
    b.width = bevel if bevel is not None else min(width, depth) * 0.42
    b.segments = seg
    b.limit_method = 'ANGLE'
    b.angle_limit = math.radians(50)
    return o


def inset(pts, d):
    """Offset a ccw closed polyline inward by d (miter, fine for convex rounded shapes)."""
    n = len(pts)
    out = []
    for i in range(n):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        e0 = (p1 - p0).normalized()
        e1 = (p2 - p1).normalized()
        n0 = Vector((-e0.y, e0.x))
        n1 = Vector((-e1.y, e1.x))
        m = (n0 + n1)
        if m.length < 1e-6:
            m = n0
        m.normalize()
        k = d / max(0.3, m.dot(n0))
        q = p1 + m * k
        out.append((q.x, q.y))
    return out


def sphere(name, loc, r, material, scale=(1, 1, 1), seg=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=r)
    o = obj_from_bm(name, bm, material)
    o.location = loc
    o.scale = scale
    return o


def cylinder(name, loc, r, depth, material, seg=48, bevel=0.0, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=depth)
    o = obj_from_bm(name, bm, material)
    o.location = loc
    o.rotation_euler = rot
    if bevel:
        b = o.modifiers.new('bevel', 'BEVEL')
        b.width = bevel
        b.segments = 4
        b.limit_method = 'ANGLE'
    return o


def torus(name, loc, R, r, material, rot=(0, 0, 0), scale=(1, 1, 1), seg=(32, 12)):
    bm = bmesh.new()
    me = bpy.data.meshes.new(name)
    # build torus manually (bmesh has no torus op)
    U, V = seg
    vs = []
    for i in range(U):
        a = 2 * math.pi * i / U
        row = []
        for j in range(V):
            b = 2 * math.pi * j / V
            x = (R + r * math.cos(b)) * math.cos(a)
            y = (R + r * math.cos(b)) * math.sin(a)
            z = r * math.sin(b)
            row.append(bm.verts.new((x, y, z)))
        vs.append(row)
    for i in range(U):
        for j in range(V):
            bm.faces.new((vs[i][j], vs[(i + 1) % U][j], vs[(i + 1) % U][(j + 1) % V], vs[i][(j + 1) % V]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bm(name, bm, material)
    o.location = loc
    o.rotation_euler = rot
    o.scale = scale
    return o


def chain(name, p0, p1, link_len, thick, material, sag=0.0, rot0=0.0):
    """Gold chain between two points: alternating oval links (each rotated 90 deg about the chain axis)."""
    p0, p1 = Vector(p0), Vector(p1)
    L = (p1 - p0).length
    n = max(2, int(L / (link_len * 0.78)))
    objs = []
    for i in range(n):
        t = (i + 0.5) / n
        p = p0.lerp(p1, t)
        p.z -= 0  # straight
        p.y -= sag * 4 * t * (1 - t)
        tan = (p1 - p0).normalized()
        if sag:
            dt = 1e-3
            q = p0.lerp(p1, t + dt)
            q.y -= sag * 4 * (t + dt) * (1 - t - dt)
            tan = (q - p).normalized()
        R = link_len * 0.38
        o = torus(f'{name}_{i}', p, R, thick, material, seg=(28, 10), scale=(1.0, 0.62, 1.0))
        # orient: torus major axis (x) along tangent, alternate the ring plane
        rot = tan.to_track_quat('X', 'Z').to_matrix().to_4x4()
        spin = Matrix.Rotation(rot0 + (math.pi / 2 if i % 2 else 0), 4, 'X')
        o.matrix_world = Matrix.Translation(p) @ rot @ spin @ Matrix.Diagonal((1.0, 0.62, 1.0, 1.0))
        objs.append(o)
    return objs


def bevel_mod(o, width, seg=4, angle=50):
    b = o.modifiers.new('bevel', 'BEVEL')
    b.width = width
    b.segments = seg
    b.limit_method = 'ANGLE'
    b.angle_limit = math.radians(angle)
    return b


def extrude_poly(name, pts, depth, material, bevel=0.0, seg=4, z0=0.0):
    return slab(name, pts, depth, bevel, material, seg=seg, z0=z0)
