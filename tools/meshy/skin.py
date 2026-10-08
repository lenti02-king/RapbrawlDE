"""Add a game skeleton + skin weights to a textured Meshy GLB WITHOUT touching its mesh or textures.

Usage: python3 tools/meshy/skin.py jazeek|bonez|manuellsen|lacazette [--src .cache/meshy3/<id>_std_src.glb] [--out path.glb] [--dir meshy3]

The product owner's textured models must look 1:1 in the game, so this tool never re-exports them through Blender:
  1. Blender (bpy) builds a watertight helper copy (decimate + voxel remesh) and computes bone-heat weights on it
     for a Mixamo-named skeleton placed from the landmarks in tools/meshy/<id>_cr.py
  2. numpy transfers the weights to every original vertex (nearest helper vertices) and adds finger/thumb bones
     (the game curls them into fists at runtime; the rest mesh keeps the sculpted open hands)
  3. the original GLB is rewritten with the SAME JSON objects and the SAME binary chunk, only appended:
     JOINTS_0/WEIGHTS_0 (normalised bytes), inverse bind matrices, joint nodes, a skin, and glTF extras for GlbRig.
"""
from __future__ import annotations

import argparse
import importlib
import json
import os
import struct
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

ap = argparse.ArgumentParser()
ap.add_argument('id')
ap.add_argument('--src')
ap.add_argument('--out')
ap.add_argument('--landmarks', help='GLB whose vertices place the joints (default: the untouched original, so a reduced\n'
                'game version gets exactly the same skeleton and weights as the original)')
ap.add_argument('--dir', default='meshy3', help='model folder under .cache/ (meshy2 = the session-9 models)')
args = ap.parse_args()
spec = importlib.import_module(f'{args.id}_cr')
SRC = args.src or os.path.join(ROOT, '.cache', args.dir, f'{args.id}_src.glb')
LAND = args.landmarks or os.path.join(ROOT, '.cache', args.dir, f'{args.id}_src.glb')
OUT = args.out or os.path.join(ROOT, '.cache', args.dir, f'{args.id}_rigged.glb')
WORK = os.path.join(ROOT, '.cache', args.dir, 'work', args.id)
os.makedirs(WORK, exist_ok=True)
T0 = time.time()


def log(*a):
    print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)


# ------------------------------------------------------------------ GLB I/O (no re-encoding)
def read_glb(path):
    b = open(path, 'rb').read()
    assert struct.unpack_from('<I', b, 0)[0] == 0x46546C67, 'not a GLB'
    jl, jt = struct.unpack_from('<II', b, 12)
    js = json.loads(b[20 : 20 + jl])
    off = 20 + jl
    bl, bt = struct.unpack_from('<II', b, off)
    assert bt == 0x004E4942
    return js, bytearray(b[off + 8 : off + 8 + bl])


def write_glb(path, js, binbuf):
    jb = json.dumps(js, separators=(',', ':')).encode()
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    binbuf = bytes(binbuf) + b'\0' * ((4 - len(binbuf) % 4) % 4)
    total = 12 + 8 + len(jb) + 8 + len(binbuf)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(jb), 0x4E4F534A))
        f.write(jb)
        f.write(struct.pack('<II', len(binbuf), 0x004E4942))
        f.write(binbuf)


def accessor_array(js, binbuf, idx):
    a = js['accessors'][idx]
    bv = js['bufferViews'][a['bufferView']]
    comp = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}[a['componentType']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    return np.frombuffer(bytes(binbuf[start : start + a['count'] * n * np.dtype(comp).itemsize]), comp).reshape(a['count'], n)


def append_view(js, binbuf, data: bytes, target=None):
    while len(binbuf) % 4:
        binbuf.append(0)
    view = {'buffer': 0, 'byteOffset': len(binbuf), 'byteLength': len(data)}
    if target:
        view['target'] = target
    binbuf.extend(data)
    js['bufferViews'].append(view)
    return len(js['bufferViews']) - 1


# Blender coordinates (Z up, character faces -Y) <-> glTF (Y up, faces +Z)
def b2g(p):
    p = np.asarray(p, float)
    return np.stack([p[..., 0], p[..., 2], -p[..., 1]], -1)


def g2b(p):
    p = np.asarray(p, float)
    return np.stack([p[..., 0], -p[..., 2], p[..., 1]], -1)


js, binbuf = read_glb(SRC)
src_bytes = len(binbuf)
mesh_nodes = [i for i, n in enumerate(js['nodes']) if 'mesh' in n]
assert len(mesh_nodes) == 1, 'expected one mesh node'
mnode = js['nodes'][mesh_nodes[0]]
M = np.array(mnode.get('matrix', np.eye(4).ravel().tolist()), float).reshape(4, 4).T  # column-major
prims = js['meshes'][mnode['mesh']]['primitives']
pos_g = [accessor_array(js, binbuf, p['attributes']['POSITION']).astype(float) for p in prims]
allpos_g = np.concatenate(pos_g)
world_g = (M[:3, :3] @ allpos_g.T).T + M[:3, 3]
V = g2b(world_g)  # Blender-space positions of every original vertex
log('source', os.path.getsize(SRC) / 1e6, 'MB,', len(V), 'vertices')
if os.path.abspath(LAND) == os.path.abspath(SRC):
    VL = V
else:
    # joints come from the original's vertices: slice centres of a decimated mesh shift by centimetres (sparser extremes)
    ljs, lbin = read_glb(LAND)
    lnode = [n for n in ljs['nodes'] if 'mesh' in n][0]
    LM = np.array(lnode.get('matrix', np.eye(4).ravel().tolist()), float).reshape(4, 4).T
    lpos = np.concatenate([accessor_array(ljs, lbin, p['attributes']['POSITION']).astype(float) for p in ljs['meshes'][lnode['mesh']]['primitives']])
    VL = g2b((LM[:3, :3] @ lpos.T).T + LM[:3, 3])
    del lbin
    log('landmarks from', os.path.relpath(LAND, ROOT), len(VL), 'vertices')


# ------------------------------------------------------------------ landmarks -> joints (Blender coords)
def centre(z, x0, x1, h=0.006):
    m = (np.abs(VL[:, 2] - z) < h) & (VL[:, 0] > x0) & (VL[:, 0] < x1)
    p = VL[m]
    if not len(p):
        return np.array([(x0 + x1) / 2, 0.0, z])
    return np.array([(p[:, 0].min() + p[:, 0].max()) / 2, (p[:, 1].min() + p[:, 1].max()) / 2, z])


J = spec.JOINTS
P = {}
for k in ('hips', 'spine', 'chest', 'neck', 'head'):
    z = J[k]
    c = centre(z, -0.06, 0.06)
    P[k] = np.array([0.0, c[1] + J.get('spine_dy', 0.0), z])
P['head_top'] = np.array([0.0, P['head'][1], VL[:, 2].max()])
for side, sx in (('L', 1), ('R', -1)):
    P['sh' + side] = np.array([sx * J['sh'][0], P['chest'][1], J['sh'][1]])
    P['clav' + side] = np.array([sx * 0.04, P['chest'][1], J['sh'][1] + 0.02])
    for k in ('el', 'wr', 'tip'):
        x, z = J[k]
        P[k + side] = centre(z, sx * x - 0.09, sx * x + 0.09)
    x, z = J['hip']
    P['hip' + side] = np.array([sx * x, P['hips'][1], z])
    for k in ('kn', 'an'):
        x, z = J[k]
        P[k + side] = centre(z, sx * x - 0.12, sx * x + 0.12)
    P['toe' + side] = P['an' + side] + np.array([0, -J.get('toe', 0.12), -(P['an' + side][2] - VL[:, 2].min()) * 0.6])
    P['toeEnd' + side] = P['toe' + side] + np.array([0, -0.06, 0])
log('joints', {k: [round(float(a), 3) for a in v] for k, v in P.items()})
json.dump({k: [float(a) for a in v] for k, v in P.items()}, open(os.path.join(WORK, 'joints.json'), 'w'))  # tools/meshy/jointshot.py

BONES = [('Hips', 'hips', 'spine', None), ('Spine', 'spine', 'chest', 'Hips'), ('Spine2', 'chest', 'neck', 'Spine'),
         ('Neck', 'neck', 'head', 'Spine2'), ('Head', 'head', 'head_top', 'Neck')]
for side, nm in (('L', 'Left'), ('R', 'Right')):
    BONES += [
        (f'{nm}Shoulder', 'clav' + side, 'sh' + side, 'Spine2'),
        (f'{nm}Arm', 'sh' + side, 'el' + side, f'{nm}Shoulder'),
        (f'{nm}ForeArm', 'el' + side, 'wr' + side, f'{nm}Arm'),
        (f'{nm}Hand', 'wr' + side, 'tip' + side, f'{nm}ForeArm'),
        (f'{nm}UpLeg', 'hip' + side, 'kn' + side, 'Hips'),
        (f'{nm}Leg', 'kn' + side, 'an' + side, f'{nm}UpLeg'),
        (f'{nm}Foot', 'an' + side, 'toe' + side, f'{nm}Leg'),
        (f'{nm}ToeBase', 'toe' + side, 'toeEnd' + side, f'{nm}Foot'),
    ]
NAMES = [b[0] for b in BONES]

# ------------------------------------------------------------------ bone heat on a watertight helper (Blender)
cache = os.path.join(WORK, 'proxy_weights.npz')
key = json.dumps({k: [round(float(a), 4) for a in v] for k, v in P.items()}, sort_keys=True)
if os.path.exists(cache) and str(np.load(cache)['key']) == key:
    d = np.load(cache)
    PV, PW = d['pv'], d['pw']
    log('proxy weights from cache')
else:
    import bpy  # noqa: E402

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    ob = [o for o in bpy.data.objects if o.type == 'MESH'][0]
    bpy.context.view_layer.objects.active = ob
    for o in bpy.data.objects:
        o.select_set(o is ob)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    dm = ob.modifiers.new('dec', 'DECIMATE')
    dm.ratio = 120000 / max(1, len(ob.data.polygons))
    rm = ob.modifiers.new('vox', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = 0.007
    bpy.ops.object.modifier_apply(modifier='dec')
    bpy.ops.object.modifier_apply(modifier='vox')
    # bone heat fails for the WHOLE mesh when one loose speck can't see a bone (S16: an 8-vertex crumb of the merged
    # Jazeek): keep only the big connected parts
    import bmesh  # noqa: E402

    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    seen = set()
    parts = []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, part = [v], []
        seen.add(v.index)
        while stack:
            a = stack.pop()
            part.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen:
                    seen.add(b.index)
                    stack.append(b)
        parts.append(part)
    small = [v for part in parts if len(part) < 0.01 * len(bm.verts) for v in part]
    if small:
        bmesh.ops.delete(bm, geom=small, context='VERTS')
        bm.to_mesh(ob.data)
    bm.free()
    log('helper', len(ob.data.vertices), 'verts', f'(dropped {len(small)} in loose specks)' if small else '')
    arm_data = bpy.data.armatures.new('rig')
    arm = bpy.data.objects.new('rig', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    for o in bpy.data.objects:
        o.select_set(o is arm)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for name, h, t, parent in BONES:
        e = arm_data.edit_bones.new(name)
        e.head = tuple(P[h])
        e.tail = tuple(P[t])
        if parent:
            e.parent = eb[parent]
        eb[name] = e
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in bpy.data.objects:
        o.select_set(o in (ob, arm))
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    PV = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get('co', PV)
    PV = PV.reshape(-1, 3)
    gi = {g.index: NAMES.index(g.name) for g in ob.vertex_groups if g.name in NAMES}
    PW = np.zeros((len(PV), len(NAMES)), np.float32)
    for v in ob.data.vertices:
        for g in v.groups:
            if g.group in gi:
                PW[v.index, gi[g.group]] = g.weight
    s = PW.sum(1)
    log('bone heat: unweighted helper verts', int((s < 1e-4).sum()))
    np.savez(cache, pv=PV, pw=PW, key=key)

# ------------------------------------------------------------------ transfer to every original vertex
from scipy.spatial import cKDTree  # noqa: E402

ok = PW.sum(1) > 1e-4
tree = cKDTree(PV[ok])
dist, idx = tree.query(V, k=6)
w_idw = 1.0 / np.maximum(dist, 1e-5) ** 2
w_idw /= w_idw.sum(1, keepdims=True)
W = np.einsum('nk,nkb->nb', w_idw, PW[ok][idx])
W /= np.maximum(W.sum(1, keepdims=True), 1e-8)
log('weights transferred, max helper distance', round(float(dist[:, 0].max()), 4))


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ fingers + thumb (fists are curled at runtime)
extra_bones = []  # (name, parent, head, rotation matrix columns in Blender space)
for side, nm in (('L', 'Left'), ('R', 'Right')):
    hb = NAMES.index(f'{nm}Hand')
    wr, tip = P['wr' + side], P['tip' + side]
    d = tip - wr
    L = np.linalg.norm(d)
    d /= L
    hv = W[:, hb] > 0.5
    pts = V[hv]
    _, _, vt = np.linalg.svd(pts - pts.mean(0), full_matrices=False)
    n = vt[2] - d * (vt[2] @ d)
    n /= np.linalg.norm(n)
    if n @ np.array(spec.PALM[side], float) < 0:
        n = -n
    a = np.cross(d, n)
    a /= np.linalg.norm(a)
    t = ((V - wr) @ d) / L
    lat = (V - wr) @ a
    band = hv & (t > 0.15) & (t < 0.5)
    ts = 1.0 if np.median(lat[band]) > 0 else -1.0
    ts = float(getattr(spec, 'THUMB_SIDE', {}).get(side, ts))  # per-model override when the mass vote picks the fingers
    thumb = hv & (t < spec.THUMB_T) & (lat * ts > spec.THUMB_LAT)
    fingers = hv & ~thumb
    f1 = smoothstep(spec.KNUCKLE - 0.05, spec.KNUCKLE + 0.04, t) * fingers
    f2 = smoothstep(spec.MIDDLE - 0.04, spec.MIDDLE + 0.04, t) * fingers
    th = smoothstep(spec.THUMB_LAT - 0.01, spec.THUMB_LAT + 0.025, lat * ts) * thumb
    hand_w = W[:, hb].copy()
    W[:, hb] = hand_w * (1 - f1 - th)
    names_here = [f'{nm}HandFingers1', f'{nm}HandFingers2', f'{nm}HandThumb']
    cols_f = np.stack([a, d, n], 1)  # X = knuckle axis (+rotation curls toward the palm), Y = along the fingers, Z = palm
    xt = -ts * d
    yt = ts * a
    cols_t = np.stack([xt, yt, np.cross(xt, yt)], 1)
    k1 = wr + d * L * spec.KNUCKLE
    k2 = wr + d * L * spec.MIDDLE
    kt = wr + d * L * 0.12 + a * ts * spec.THUMB_LAT
    extra_bones += [(names_here[0], f'{nm}Hand', k1, cols_f), (names_here[1], names_here[0], k2, cols_f), (names_here[2], f'{nm}Hand', kt, cols_t)]
    W = np.concatenate([W, (hand_w * (f1 - f2))[:, None], (hand_w * f2)[:, None], (hand_w * th)[:, None]], 1)
    log('hand', side, 'fingers', int(fingers.sum()), 'thumb', int(thumb.sum()), 'thumb side', ts)
ALL = NAMES + [e[0] for e in extra_bones]

# top 4 influences, normalised to bytes summing to 255
order = np.argsort(-W, 1)[:, :4]
top = np.take_along_axis(W, order, 1)
top /= np.maximum(top.sum(1, keepdims=True), 1e-8)
q = np.floor(top * 255).astype(np.int32)
q[:, 0] += 255 - q.sum(1)
joints_u8 = order.astype(np.uint8)
weights_u8 = q.astype(np.uint8)

# ------------------------------------------------------------------ joint nodes, inverse bind matrices, skin
heads = {name: P[h] for name, h, _t, _p in BONES}
parents = {name: p for name, _h, _t, p in BONES}
rots = {name: np.eye(3) for name in NAMES}
for name, parent, head, cols in extra_bones:
    heads[name] = head
    parents[name] = parent
    rots[name] = cols
C = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)  # Blender -> glTF basis
world = {}
for name in ALL:
    T = np.eye(4)
    T[:3, :3] = C @ rots[name] @ C.T
    T[:3, 3] = b2g(heads[name])
    world[name] = T


def mat_to_quat(m):
    tr = m[0, 0] + m[1, 1] + m[2, 2]
    if tr > 0:
        s = np.sqrt(tr + 1.0) * 2
        return [(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, 0.25 * s]
    i = int(np.argmax([m[0, 0], m[1, 1], m[2, 2]]))
    j, k = (i + 1) % 3, (i + 2) % 3
    s = np.sqrt(1.0 + m[i, i] - m[j, j] - m[k, k]) * 2
    qv = [0.0, 0.0, 0.0, 0.0]
    qv[i] = 0.25 * s
    qv[j] = (m[j, i] + m[i, j]) / s
    qv[k] = (m[k, i] + m[i, k]) / s
    qv[3] = (m[k, j] - m[j, k]) / s
    return qv


base = len(js['nodes'])
node_of = {name: base + i for i, name in enumerate(ALL)}
for name in ALL:
    par = parents[name]
    local = world[name] if par is None else np.linalg.inv(world[par]) @ world[name]
    node = {'name': name, 'translation': [float(x) for x in local[:3, 3]]}
    qv = mat_to_quat(local[:3, :3])
    if abs(qv[3]) < 0.999999:
        node['rotation'] = [float(x) for x in qv]
    kids = [node_of[c] for c in ALL if parents[c] == name]
    if kids:
        node['children'] = kids
    js['nodes'].append(node)
arm_node = {'name': 'Armature', 'children': [node_of['Hips']], 'extras': {'rb_fit': 'height', 'rb_head_pitch': float(spec.HEAD_PITCH), 'rb_fist': bool(getattr(spec, 'FIST', True))}}
js['nodes'].append(arm_node)
js['scenes'][js.get('scene', 0)]['nodes'].append(len(js['nodes']) - 1)

ibm = np.stack([(np.linalg.inv(world[name]) @ M).T.ravel() for name in ALL]).astype(np.float32)  # column-major
v_ibm = append_view(js, binbuf, ibm.tobytes())
js['accessors'].append({'bufferView': v_ibm, 'componentType': 5126, 'count': len(ALL), 'type': 'MAT4'})
js.setdefault('skins', []).append({'name': 'rig', 'joints': [node_of[n] for n in ALL], 'inverseBindMatrices': len(js['accessors']) - 1, 'skeleton': node_of['Hips']})
mnode['skin'] = len(js['skins']) - 1

start = 0
for p, pg in zip(prims, pos_g):
    cnt = len(pg)
    vj = append_view(js, binbuf, joints_u8[start : start + cnt].tobytes(), 34962)
    js['accessors'].append({'bufferView': vj, 'componentType': 5121, 'count': cnt, 'type': 'VEC4'})
    p['attributes']['JOINTS_0'] = len(js['accessors']) - 1
    vw = append_view(js, binbuf, weights_u8[start : start + cnt].tobytes(), 34962)
    js['accessors'].append({'bufferView': vw, 'componentType': 5121, 'normalized': True, 'count': cnt, 'type': 'VEC4'})
    p['attributes']['WEIGHTS_0'] = len(js['accessors']) - 1
    start += cnt
js['buffers'][0]['byteLength'] = len(binbuf)
write_glb(OUT, js, binbuf)
log('wrote', OUT, f'{os.path.getsize(OUT) / 1e6:.1f} MB (source bytes kept: {src_bytes} of {len(binbuf)})')
