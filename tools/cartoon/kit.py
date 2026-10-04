"""Cartoon character kit for Blender (bpy): metaball "clay" families, rigid parts, skinning from construction,
vertex-colour painting + AO, game skeleton (Mixamo names) and GLB export.

Coordinates: metres, Blender Z up, the character faces -Y, its left side is +X (glTF export turns this into
+Z forward / +X left, the convention src/render/glbRig.ts expects).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

MB_K = 0.575  # surface radius of a metaball element with stiffness 2 / threshold 0.6 = MB_K * radius


@dataclass
class Elem:
    kind: str                      # 'ball' | 'capsule'
    co: tuple                      # centre (ball) or start point (capsule)
    r: float                       # surface radius (metres)
    end: tuple | None = None       # capsule end point
    scale: tuple = (1.0, 1.0, 1.0)  # ellipsoid axes (ball only), in the element's local frame
    rot: tuple | None = None       # quaternion (w, x, y, z) for ellipsoids
    bone: str = 'Hips'
    neg: bool = False
    stiff: float = 2.0


@dataclass
class Family:
    name: str
    color: tuple
    rough: float = 0.6
    metal: float = 0.0
    elems: list[Elem] = field(default_factory=list)
    res: float = 0.009
    bones: tuple | None = None     # allowed bones (None = any element bone)
    paint: object = None           # f(verts (n,3), normals (n,3)) -> colours (n,3) override
    decimate: float = 1.0
    budget: int = 0                # target triangles after decimation (0 = use `decimate`)

    def ball(self, co, r, bone, scale=(1, 1, 1), rot=None, neg=False, stiff=2.0):
        self.elems.append(Elem('ball', tuple(co), r, None, tuple(scale), rot, bone, neg, stiff))
        return self

    def capsule(self, a, b, r, bone, neg=False, stiff=2.0):
        self.elems.append(Elem('capsule', tuple(a), r, tuple(b), (1, 1, 1), None, bone, neg, stiff))
        return self


@dataclass
class Rigid:
    """Polygon mesh part (eyes, chains, teeth...): verts (n,3), faces, one colour, one bone."""
    name: str
    verts: np.ndarray
    faces: list
    color: tuple
    bone: str
    rough: float = 0.5
    metal: float = 0.0
    hidden_prop: bool = False
    colors: np.ndarray | None = None  # optional per-vertex colours


# ------------------------------------------------------------------ primitive meshes (numpy)

def uv_sphere(c, r, seg=16, rings=10, scale=(1, 1, 1)):
    verts, faces = [], []
    for i in range(rings + 1):
        th = math.pi * i / rings
        for j in range(seg):
            ph = 2 * math.pi * j / seg
            verts.append((r * scale[0] * math.sin(th) * math.cos(ph), r * scale[1] * math.sin(th) * math.sin(ph), r * scale[2] * math.cos(th)))
    for i in range(rings):
        for j in range(seg):
            a, b = i * seg + j, i * seg + (j + 1) % seg
            faces.append([a, b, b + seg, a + seg])
    return np.array(verts) + np.asarray(c), faces


def torus(c, R, r, normal=(0, 0, 1), seg=12, sides=6, ellipse=(1.0, 1.0)):
    n = np.asarray(normal, float)
    n /= np.linalg.norm(n)
    u = np.cross(n, (0, 0, 1) if abs(n[2]) < 0.9 else (1, 0, 0))
    u /= np.linalg.norm(u)
    v = np.cross(n, u)
    verts, faces = [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        d = math.cos(a) * u * ellipse[0] + math.sin(a) * v * ellipse[1]
        for j in range(sides):
            b = 2 * math.pi * j / sides
            verts.append(np.asarray(c) + d * R + (math.cos(b) * d + math.sin(b) * n) * r)
    for i in range(seg):
        for j in range(sides):
            a0 = i * sides + j
            a1 = i * sides + (j + 1) % sides
            b0 = ((i + 1) % seg) * sides + j
            b1 = ((i + 1) % seg) * sides + (j + 1) % sides
            faces.append([a0, b0, b1, a1])
    return np.array(verts), faces


def box(c, size, axes=None):
    ax = np.eye(3) if axes is None else np.asarray(axes, float)
    hs = np.asarray(size) / 2
    vs = []
    for z in (-1, 1):
        for y in (-1, 1):
            for x in (-1, 1):
                vs.append(np.asarray(c) + ax[0] * hs[0] * x + ax[1] * hs[1] * y + ax[2] * hs[2] * z)
    f = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]
    return np.array(vs), f


def merge(*parts):
    vs, fs, off = [], [], 0
    for v, f in parts:
        vs.append(v)
        fs += [[i + off for i in q] for q in f]
        off += len(v)
    return np.concatenate(vs), fs


def chain_ring(points, link_r, wire, look_dir=None):
    """Cuban-style chain along a closed polyline: alternating flat links."""
    parts = []
    pts = np.asarray(points)
    n = len(pts)
    for i in range(n):
        p, q = pts[i], pts[(i + 1) % n]
        t = q - p
        L = np.linalg.norm(t)
        if L < 1e-6:
            continue
        t /= L
        out = np.cross(t, (0, 0, 1))
        if np.linalg.norm(out) < 1e-6:
            out = np.array([1.0, 0, 0])
        out /= np.linalg.norm(out)
        nrm = np.cross(t, out) if i % 2 == 0 else out
        parts.append(torus((p + q) / 2, link_r, wire, normal=nrm, seg=10, sides=5, ellipse=(1.35, 1.0)))
    return merge(*parts)


# ------------------------------------------------------------------ Blender side

def build_family(bpy, fam: Family):
    mb = bpy.data.metaballs.new(fam.name)
    mb.resolution = fam.res
    mb.render_resolution = fam.res
    mb.threshold = 0.6
    ob = bpy.data.objects.new(fam.name, mb)
    bpy.context.scene.collection.objects.link(ob)
    for e in fam.elems:
        el = mb.elements.new()
        el.stiffness = e.stiff
        el.use_negative = e.neg
        rr = e.r / MB_K
        if e.kind == 'ball':
            el.type = 'ELLIPSOID' if e.scale != (1, 1, 1) else 'BALL'
            el.co = e.co
            el.radius = rr
            el.size_x, el.size_y, el.size_z = e.scale
            if e.rot:
                el.rotation = e.rot
        else:
            a, b = np.asarray(e.co), np.asarray(e.end)
            d = b - a
            L = np.linalg.norm(d)
            el.type = 'CAPSULE'
            el.co = tuple((a + b) / 2)
            el.radius = rr
            el.size_x = L / 2 / 1.0
            # capsule axis is local X: rotate X onto d
            from mathutils import Vector
            q = Vector((1, 0, 0)).rotation_difference(Vector(tuple(d / max(L, 1e-9))))
            el.rotation = q
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    bpy.data.metaballs.remove(mb)
    return me


def elem_distance(e: Elem, p: np.ndarray) -> np.ndarray:
    """Approximate signed distance from points to the element surface (metres)."""
    if e.kind == 'capsule':
        a, b = np.asarray(e.co), np.asarray(e.end)
        ab = b - a
        t = np.clip(((p - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
        d = np.linalg.norm(p - (a + np.outer(t, ab)), axis=1)
        return d - e.r
    c = np.asarray(e.co)
    s = np.asarray(e.scale) * e.r
    q = p - c
    if e.rot:
        w, x, y, z = e.rot
        R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        q = q @ R  # into local frame
    k = np.linalg.norm(q / s, axis=1)
    return (k - 1) * s.mean()


def skin_weights(verts: np.ndarray, elems: list[Elem], bones: list[str], allowed=None, sharp=55.0):
    """Weights from construction: each positive element pulls its vertices to its bone, blended by distance."""
    pos = [e for e in elems if not e.neg and (allowed is None or e.bone in allowed)]
    D = np.stack([elem_distance(e, verts) for e in pos], 1)  # (n, E)
    W = np.exp(-sharp * (D - D.min(1, keepdims=True)))
    out = np.zeros((len(verts), len(bones)))
    idx = {b: i for i, b in enumerate(bones)}
    for k, e in enumerate(pos):
        out[:, idx[e.bone]] += W[:, k]
    top = np.argsort(-out, 1)[:, :4]
    w4 = np.take_along_axis(out, top, 1)
    w4 /= w4.sum(1, keepdims=True)
    return top, w4


@dataclass
class Bone:
    name: str
    head: tuple
    tail: tuple
    parent: str | None


def export(bpy, out: str, bones: list[Bone], fams: list[Family], rigids: list[Rigid], ao_samples=48):
    from mathutils import Vector
    sc = bpy.context.scene
    arm_data = bpy.data.armatures.new('rig')
    arm = bpy.data.objects.new('rig', arm_data)
    sc.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for b in bones:
        e = arm_data.edit_bones.new(b.name)
        e.head = b.head
        e.tail = b.tail
        if b.parent:
            e.parent = eb[b.parent]
        eb[b.name] = e
    bpy.ops.object.mode_set(mode='OBJECT')
    names = [b.name for b in bones]
    objs = []

    def finish(ob, colors, rough, metal, top, w4, emissive=False):
        me = ob.data
        # colours as a point colour attribute (exported as COLOR_0)
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        rgba = np.concatenate([colors, np.ones((len(colors), 1))], 1).astype(np.float32)
        ca.data.foreach_set('color', rgba.ravel())
        me.color_attributes.active_color = ca
        mat = bpy.data.materials.new(ob.name)
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = nt.nodes['Principled BSDF']
        vc = nt.nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metal
        mat.use_backface_culling = True
        me.materials.append(mat)
        for p in me.polygons:
            p.use_smooth = True
        groups = [ob.vertex_groups.new(name=n) for n in names]
        for vi in range(len(me.vertices)):
            for k in range(4):
                if w4[vi, k] > 1e-3:
                    groups[top[vi, k]].add([vi], float(w4[vi, k]), 'REPLACE')
        mod = ob.modifiers.new('Armature', 'ARMATURE')
        mod.object = arm
        ob.parent = arm
        objs.append(ob)

    for fam in fams:
        me = build_family(bpy, fam)
        ob = bpy.data.objects.new(fam.name, me)
        sc.collection.objects.link(ob)
        tri0 = sum(len(p.vertices) - 2 for p in me.polygons)
        ratio = min(1.0, fam.budget / max(tri0, 1)) if fam.budget else fam.decimate
        if ratio < 0.98:
            bpy.context.view_layer.objects.active = ob
            dm = ob.modifiers.new('dec', 'DECIMATE')
            dm.ratio = ratio
            bpy.ops.object.modifier_apply(modifier='dec')
        n = len(me.vertices)
        v = np.empty(n * 3)
        me.vertices.foreach_get('co', v)
        v = v.reshape(-1, 3)
        nr = np.empty(n * 3)
        me.vertices.foreach_get('normal', nr)
        nr = nr.reshape(-1, 3)
        col = np.tile(np.asarray(fam.color, float), (n, 1))
        if fam.paint:
            col = fam.paint(v, nr, col)
        top, w4 = skin_weights(v, fam.elems, names, fam.bones)
        finish(ob, col, fam.rough, fam.metal, top, w4)
    for rg in rigids:
        me = bpy.data.meshes.new(rg.name)
        me.from_pydata([tuple(p) for p in rg.verts], [], [list(f) for f in rg.faces])
        me.update()
        ob = bpy.data.objects.new(rg.name, me)
        sc.collection.objects.link(ob)
        n = len(me.vertices)
        col = np.asarray(rg.colors, float) if rg.colors is not None else np.tile(np.asarray(rg.color, float), (n, 1))
        top = np.zeros((n, 4), int)
        top[:, 0] = names.index(rg.bone)
        w4 = np.zeros((n, 4))
        w4[:, 0] = 1
        finish(ob, col, rg.rough, rg.metal, top, w4)

    # ambient occlusion multiplied into the colours (Cycles bake to the colour attribute)
    if ao_samples:
        sc.render.engine = 'CYCLES'
        sc.cycles.device = 'CPU'
        sc.cycles.samples = ao_samples
        world = bpy.data.worlds.new('w')
        world.use_nodes = True
        world.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)
        sc.world = world
        for ob in objs:
            me = ob.data
            base = np.empty(len(me.vertices) * 4, np.float32)
            me.color_attributes['Col'].data.foreach_get('color', base)
            ao = me.color_attributes.new('AO', 'FLOAT_COLOR', 'POINT')
            me.color_attributes.active_color = ao
            bpy.ops.object.select_all(action='DESELECT')
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            try:
                bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
                a = np.empty(len(me.vertices) * 4, np.float32)
                ao.data.foreach_get('color', a)
                a = a.reshape(-1, 4)[:, :1]
                b = base.reshape(-1, 4)
                b[:, :3] *= 0.35 + 0.65 * np.clip(a, 0, 1) ** 0.8
                me.color_attributes['Col'].data.foreach_set('color', b.ravel())
            except RuntimeError as err:  # noqa: PERF203
                print('[ao] skipped', ob.name, err)
            me.color_attributes.remove(me.color_attributes['AO'])
            me.color_attributes.active_color = me.color_attributes['Col']

    for ob in objs:
        if getattr(ob, '_prop', False):
            pass
    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB', export_skins=True, export_animations=False, export_morph=False,
        export_yup=True, export_texcoords=False, export_normals=True, export_materials='EXPORT', export_vertex_color='ACTIVE',
    )
    tris = sum(sum(len(pl.vertices) - 2 for pl in o.data.polygons) for o in objs)
    return tris
