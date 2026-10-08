"""Fast GLB <-> Blender I/O for very large Meshy sculpts (millions of triangles), where the glTF add-on is too slow.

load(path) reads POSITION/NORMAL/TEXCOORD_0/indices with numpy and builds the Blender mesh with foreach_set (glTF Y-up ->
Blender Z-up), plus a node material with the GLB's base colour / normal textures (original JPEG bytes, written once to
a work folder). Only single-mesh, single-primitive files (what Meshy exports) are supported.
"""
from __future__ import annotations

import json
import os
import struct

import bpy
import numpy as np

COMP = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read(path):
    b = open(path, 'rb').read()
    jl = struct.unpack_from('<I', b, 12)[0]
    js = json.loads(b[20 : 20 + jl])
    off = 20 + jl
    bl = struct.unpack_from('<I', b, off)[0]
    return js, memoryview(b)[off + 8 : off + 8 + bl]


def acc(js, binbuf, i):
    a = js['accessors'][i]
    bv = js['bufferViews'][a['bufferView']]
    dt = COMP[a['componentType']]
    n = NCOMP[a['type']]
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', 0)
    isz = np.dtype(dt).itemsize * n
    if stride and stride != isz:
        raw = np.frombuffer(binbuf, np.uint8, count=stride * a['count'], offset=start).reshape(a['count'], stride)[:, :isz]
        return raw.copy().view(dt).reshape(a['count'], n)
    return np.frombuffer(binbuf, dt, count=a['count'] * n, offset=start).reshape(a['count'], n).copy()


def arrays(path):
    """(pos[N,3] Blender Z-up, nor[N,3], uv[N,2] (glTF v: 0 = top), tris[M,3], images {slot: bytes}, js)"""
    js, bb = read(path)
    pr = js['meshes'][0]['primitives'][0]
    A = pr['attributes']
    p = acc(js, bb, A['POSITION'])
    pos = np.c_[p[:, 0], -p[:, 2], p[:, 1]]
    nor = None
    if 'NORMAL' in A:
        q = acc(js, bb, A['NORMAL'])
        nor = np.c_[q[:, 0], -q[:, 2], q[:, 1]]
    uv = acc(js, bb, A['TEXCOORD_0']) if 'TEXCOORD_0' in A else None
    tris = acc(js, bb, pr['indices']).reshape(-1, 3).astype(np.int64)
    m = js['materials'][pr.get('material', 0)]
    imgs = {}

    def img(slot):
        if not slot:
            return None
        im = js['images'][js['textures'][slot['index']]['source']]
        bv = js['bufferViews'][im['bufferView']]
        o = bv.get('byteOffset', 0)
        return bytes(bb[o : o + bv['byteLength']])

    pbr = m.get('pbrMetallicRoughness', {})
    imgs['base'] = img(pbr.get('baseColorTexture'))
    imgs['normal'] = img(m.get('normalTexture'))
    imgs['mr'] = img(pbr.get('metallicRoughnessTexture'))
    imgs['emissive'] = img(m.get('emissiveTexture'))
    return pos.astype(np.float32), nor, uv, tris, imgs, js


def build(name, pos, tris, uv=None, nor=None):
    """Blender mesh object from per-vertex arrays (uv per vertex, v glTF-style: 0 = top)."""
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(pos))
    me.vertices.foreach_set('co', pos.astype(np.float32).ravel())
    me.loops.add(tris.size)
    me.loops.foreach_set('vertex_index', tris.astype(np.int32).ravel())
    me.polygons.add(len(tris))
    me.polygons.foreach_set('loop_start', np.arange(0, tris.size, 3, dtype=np.int32))
    me.polygons.foreach_set('loop_total', np.full(len(tris), 3, np.int32))
    me.update(calc_edges=True)
    if uv is not None:
        lay = me.uv_layers.new(name='UVMap')
        lu = uv[tris.ravel()].astype(np.float32).copy()
        lu[:, 1] = 1.0 - lu[:, 1]
        lay.data.foreach_set('uv', lu.ravel())
    me.polygons.foreach_set('use_smooth', np.ones(len(tris), bool))
    if nor is not None:
        try:
            me.normals_split_custom_set_from_vertices(nor.astype(np.float32))
        except Exception:
            pass
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def material(name, imgs, work, emissive=False):
    """Principled material with the base colour (+ normal map) from the GLB's JPEG bytes."""
    os.makedirs(work, exist_ok=True)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.75
    bsdf.inputs['Metallic'].default_value = 0.0

    def tex(key, cs):
        data = imgs.get(key)
        if not data:
            return None
        p = os.path.join(work, f'{name}_{key}.jpg')
        open(p, 'wb').write(data)
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = bpy.data.images.load(p)
        n.image.colorspace_settings.name = cs
        return n

    b = tex('base', 'sRGB')
    if b:
        nt.links.new(b.outputs['Color'], bsdf.inputs['Base Color'])
    nm = tex('normal', 'Non-Color')
    if nm:
        nn = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(nm.outputs['Color'], nn.inputs['Color'])
        nt.links.new(nn.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def load(path, name='src', work=None):
    pos, nor, uv, tris, imgs, js = arrays(path)
    ob = build(name, pos, tris, uv, nor)
    if work:
        ob.data.materials.append(material(name, imgs, work))
    return ob
