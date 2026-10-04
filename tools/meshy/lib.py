"""Shared helpers: Meshy AI sculpt (untextured, unrigged, one fused shell) -> painted, baked, rigged fighter GLB.

Pipeline (see build.py):
  1. load_src: import the high-poly sculpt, put the feet on z=0, centre it (Blender Z-up, character faces -Y, left = +X)
  2. Geo: numpy view of the mesh (positions, normals, edges) + neighbourhood smoothing and a surface-detail measure
     (curls, stubble, quilting and knit are high-frequency; skin and smooth cloth are not)
  3. character module paints per-vertex colour / roughness / metalness on the high-poly with region rules
  4. bake: decimated low-poly with UVs gets albedo, ORM and a tangent-space normal map baked from the high-poly
  5. rig: Mixamo-named skeleton from landmarks, bone-heat weights (voxel proxy fallback), GLB export
"""
from __future__ import annotations

import math
import os

import bpy
import numpy as np
from scipy.sparse import coo_matrix, diags

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CACHE = os.path.join(ROOT, '.cache', 'meshy')


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load_src(path: str) -> bpy.types.Object:
    """Import the sculpt and normalise it: feet on z=0, bbox centred in x/y, transforms applied."""
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in bpy.data.objects:
        o.select_set(o in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.data.objects):
        if o is not ob:
            bpy.data.objects.remove(o)
    v = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get('co', v)
    v = v.reshape(-1, 3)
    off = np.array([-(v[:, 0].min() + v[:, 0].max()) / 2, -(v[:, 1].min() + v[:, 1].max()) / 2, -v[:, 2].min()])
    v += off
    ob.data.vertices.foreach_set('co', v.ravel())
    ob.data.update()
    ob.name = 'high'
    return ob


class Geo:
    """Numpy view of a mesh with neighbourhood operators."""

    def __init__(self, ob: bpy.types.Object):
        me = ob.data
        n = len(me.vertices)
        self.n = n
        v = np.empty(n * 3)
        me.vertices.foreach_get('co', v)
        self.v = v.reshape(-1, 3)
        nr = np.empty(n * 3)
        me.vertices.foreach_get('normal', nr)
        self.nrm = nr.reshape(-1, 3)
        e = np.empty(len(me.edges) * 2, np.int64)
        me.edges.foreach_get('vertices', e)
        self.e = e.reshape(-1, 2)
        a = coo_matrix((np.ones(len(self.e) * 2), (np.r_[self.e[:, 0], self.e[:, 1]], np.r_[self.e[:, 1], self.e[:, 0]])), shape=(n, n)).tocsr()
        deg = np.asarray(a.sum(1)).ravel()
        deg[deg == 0] = 1
        self.avg = diags(1.0 / deg) @ a  # row-normalised adjacency: mean over neighbours
        el = np.linalg.norm(self.v[self.e[:, 0]] - self.v[self.e[:, 1]], axis=1)
        self.edge_len = np.bincount(self.e[:, 0], el, n) + np.bincount(self.e[:, 1], el, n)
        cnt = np.bincount(self.e[:, 0], minlength=n) + np.bincount(self.e[:, 1], minlength=n)
        self.edge_len /= np.maximum(cnt, 1)

    def smooth(self, f: np.ndarray, iters: int = 4) -> np.ndarray:
        for _ in range(iters):
            f = self.avg @ f
        return f

    def detail(self, iters: int = 6) -> np.ndarray:
        """Normal-direction deviation from the neighbourhood mean at several scales, normalised by edge length."""
        out = np.zeros(self.n)
        p = self.v.copy()
        for scale in range(3):
            q = self.smooth(p, 2 + scale * 3)
            d = np.abs(np.einsum('ij,ij->i', p - q, self.nrm)) / np.maximum(self.edge_len, 1e-6)
            out += d
        return self.smooth(out, iters)

    def grow(self, mask: np.ndarray, iters: int = 1) -> np.ndarray:
        f = mask.astype(float)
        for _ in range(iters):
            f = self.avg @ f
        return f > 0


# ------------------------------------------------------------------ procedural helpers (numpy)
def _hash3(ix, iy, iz):
    h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)
    h = (h ^ (h >> 13)) * 1274126177
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def vnoise(p: np.ndarray, freq: float, seed: int = 0) -> np.ndarray:
    """Trilinear value noise in [0,1]."""
    q = p * freq + seed * 17.13
    i = np.floor(q).astype(np.int64)
    f = q - i
    f = f * f * (3 - 2 * f)
    out = np.zeros(len(p))
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dz else 1 - f[:, 2])
                out += w * _hash3(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz)
    return out


def fbm(p: np.ndarray, freq: float, octaves: int = 3, seed: int = 0) -> np.ndarray:
    out = np.zeros(len(p))
    amp = 0.5
    tot = 0
    for o in range(octaves):
        out += amp * vnoise(p, freq * 2**o, seed + o)
        tot += amp
        amp *= 0.5
    return out / tot


def srgb(hexstr: str) -> np.ndarray:
    """'#rrggbb' -> linear RGB."""
    c = np.array([int(hexstr[i : i + 2], 16) / 255 for i in (1, 3, 5)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def ellipsoid(p, c, r):
    """Normalised ellipsoid distance (1 = on the surface)."""
    return np.sqrt((((p - np.asarray(c)) / np.asarray(r)) ** 2).sum(1))


def seg_dist(p, a, b):
    a = np.asarray(a, float)
    b = np.asarray(b, float)
    ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)


def poly_dist(p, pts):
    """Distance to a 3D polyline."""
    d = np.full(len(p), np.inf)
    for a, b in zip(pts[:-1], pts[1:]):
        d = np.minimum(d, seg_dist(p, a, b))
    return d


def in_poly2(x, y, poly):
    """Point-in-polygon (even-odd) for arrays x, y."""
    inside = np.zeros(len(x), bool)
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        cond = (y1 > y) != (y2 > y)
        xi = (x2 - x1) * (y - y1) / ((y2 - y1) + 1e-12) + x1
        inside ^= cond & (x < xi)
    return inside


# ------------------------------------------------------------------ attributes + preview
def set_point_colors(ob, name: str, rgba: np.ndarray) -> None:
    me = ob.data
    if name in me.color_attributes:
        me.color_attributes.remove(me.color_attributes[name])
    a = me.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
    a.data.foreach_set('color', rgba.astype(np.float32).ravel())


def attr_material(name: str, attr: str, emission: bool = False) -> bpy.types.Material:
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    at = nt.nodes.new('ShaderNodeAttribute')
    at.attribute_name = attr
    if emission:
        em = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(at.outputs['Color'], em.inputs['Color'])
        nt.links.new(em.outputs[0], out.inputs[0])
    else:
        bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
        nt.links.new(at.outputs['Color'], bs.inputs['Base Color'])
        bs.inputs['Roughness'].default_value = 0.6
        nt.links.new(bs.outputs[0], out.inputs[0])
    return m


def preview(ob, out_prefix: str, views=('front', 'side', 'back', 'face', 'face3q'), samples=12, size=(360, 560)) -> list[str]:
    """Cycles CPU renders of the painted high-poly (colour attribute 'Col')."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 2
    if not sc.world:
        sc.world = bpy.data.worlds.new('w')
        sc.world.use_nodes = True
        sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.32, 0.32, 0.36, 1)
    if 'sun0' not in bpy.data.objects:
        for i, (rot, e) in enumerate([((50, 0, 30), 3.2), ((60, 0, -120), 1.3), ((-20, 0, 180), 0.8)]):
            L = bpy.data.objects.new(f'sun{i}', bpy.data.lights.new(f'sun{i}', 'SUN'))
            L.data.energy = e
            L.rotation_euler = [math.radians(v) for v in rot]
            sc.collection.objects.link(L)
    cam = bpy.data.objects.get('pcam')
    if not cam:
        cam = bpy.data.objects.new('pcam', bpy.data.cameras.new('pcam'))
        sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    from mathutils import Vector

    co = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get('co', co)
    top = float(co[2::3].max())
    files = []
    for vname in views:
        yaw, scale, tz, w, h, tx = {
            'front': (0, top * 1.05, top / 2, *size, 0),
            'side': (90, top * 1.05, top / 2, *size, 0),
            'back': (180, top * 1.05, top / 2, *size, 0),
            'face': (0, 0.36, top - 0.17, 420, 420, 0),
            'face3q': (35, 0.36, top - 0.17, 420, 420, 0),
            'armR': (-20, 0.42, top * 0.62, 420, 420, -0.36),
            'armL': (20, 0.42, top * 0.62, 420, 420, 0.36),
        }[vname]
        sc.render.resolution_x = w
        sc.render.resolution_y = h
        cam.data.ortho_scale = scale
        a = math.radians(yaw)
        cam.location = (tx + math.sin(a) * 4, -math.cos(a) * 4, tz)
        cam.rotation_euler = (Vector((tx, 0, tz)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        f = f'{out_prefix}_{vname}.png'
        sc.render.filepath = f
        bpy.ops.render.render(write_still=True)
        files.append(f)
    return files
