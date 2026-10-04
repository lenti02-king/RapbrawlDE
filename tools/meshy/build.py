"""Build a game-ready fighter GLB from a Meshy AI sculpt.

Usage: python3 tools/meshy/build.py jazeek|bonez [--tris 42000] [--tex 2048] [--out path.glb] [--fast]

  high-poly sculpt (.cache/meshy/<id>_src.glb, supplied by the product owner)
    -> painted per-vertex colour / roughness / metal (character module) x baked AO (Cycles, on the sculpt)
    -> low-poly (collapse decimation) with UVs (face gets extra texel density)
    -> baked albedo + ORM + tangent-space normal map (selected-to-active)
    -> Mixamo-named skeleton from the character's landmarks, bone-heat weights (voxel proxy fallback)
    -> public/assets/characters/<id>.glb
"""
from __future__ import annotations

import argparse
import importlib
import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
import bpy  # noqa: E402  (must come before bmesh)
import bmesh  # noqa: E402, I001
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

import lib  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('id')
ap.add_argument('--tris', type=int, default=50000)
ap.add_argument('--tex', type=int, default=2048)
ap.add_argument('--out')
ap.add_argument('--fast', action='store_true', help='low bake quality for quick iteration')
args = ap.parse_args()
mod = importlib.import_module(args.id)
OUT = args.out or os.path.join(lib.ROOT, 'public', 'assets', 'characters', f'{args.id}.glb')
WORK = os.path.join(lib.CACHE, 'build', args.id)
os.makedirs(WORK, exist_ok=True)
T0 = time.time()


def log(*a):
    print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)


lib.reset()
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
high = lib.load_src(os.path.join(lib.CACHE, mod.SRC))
g = lib.Geo(high)
det = g.detail()
col, rough, metal, lab = mod.paint(g, det)
log('painted', len(col), 'verts')

# ------------------------------------------------------------------ AO on the sculpt (vertex colours)
lib.set_point_colors(high, 'AO', np.ones((g.n, 4)))
high.data.color_attributes.active_color = high.data.color_attributes['AO']
high.data.materials.clear()
high.data.materials.append(lib.attr_material('hi_paint', 'Col', emission=True))
sc.cycles.samples = 8 if args.fast else 48
bpy.context.view_layer.objects.active = high
for o in bpy.data.objects:
    o.select_set(o is high)
sc.render.bake.target = 'VERTEX_COLORS'
sc.world = sc.world or bpy.data.worlds.new('w')
bpy.ops.object.bake(type='AO')
ao = np.empty(g.n * 4, np.float32)
high.data.color_attributes['AO'].data.foreach_get('color', ao)
ao = np.clip(ao.reshape(-1, 4)[:, 0], 0, 1)
ao = 0.5 * ao + 0.5 * g.smooth(ao, 2)  # soften speckle
log('ao baked', float(ao.mean()))
shade = (0.38 + 0.62 * ao**0.85)[:, None]
lib.set_point_colors(high, 'Col', np.c_[col * shade, np.ones(g.n)])
lib.set_point_colors(high, 'ORM', np.c_[ao, rough, metal, np.ones(g.n)])
np.save(os.path.join(WORK, 'labels.npy'), lab.astype(str))

# ------------------------------------------------------------------ low poly
low = high.copy()
low.data = high.data.copy()
low.name = 'body'
low.data.name = 'body'
sc.collection.objects.link(low)
for a in list(low.data.color_attributes):
    low.data.color_attributes.remove(a)
tris = sum(len(p.vertices) - 2 for p in low.data.polygons)
# keep more triangles in the face and hands (small weights already bias the collapse strongly, see README)
hz = mod.JOINTS['head'][0] - 0.03
labs = lab.astype(str)
face_v = np.isin(labs, ['skin', 'beard', 'eye']) & (g.v[:, 2] > hz)
hand_v = (labs == 'skin') & (np.abs(g.v[:, 0]) > 0.36) & (g.v[:, 2] < mod.JOINTS['wr'][1] + 0.05)
pw = np.where(face_v, 0.016, np.where(hand_v, 0.006, 0.0))
pg = low.vertex_groups.new(name='protect')
for val in (0.016, 0.006):
    pg.add([int(i) for i in np.nonzero(pw == val)[0]], val, 'REPLACE')
dm = low.modifiers.new('dec', 'DECIMATE')
dm.vertex_group = 'protect'
dm.invert_vertex_group = True
dm.decimate_type = 'COLLAPSE'
dm.ratio = min(1.0, args.tris / tris)
dm.use_collapse_triangulate = True
bpy.context.view_layer.objects.active = low
for o in bpy.data.objects:
    o.select_set(o is low)
bpy.ops.object.modifier_apply(modifier='dec')
low.vertex_groups.remove(low.vertex_groups['protect'])
bpy.ops.object.shade_smooth()
low.data.materials.clear()
log('decimated', tris, '->', sum(len(p.vertices) - 2 for p in low.data.polygons))

# ------------------------------------------------------------------ skeleton
lv = g.v  # dense sculpt positions (same space as the low poly)
J = mod.JOINTS


def centre(z, x0, x1, y0=-0.3, y1=0.3, h=0.008):
    m_ = (np.abs(lv[:, 2] - z) < h) & (lv[:, 0] > x0) & (lv[:, 0] < x1) & (lv[:, 1] > y0) & (lv[:, 1] < y1)
    p = lv[m_]
    return np.array([(p[:, 0].min() + p[:, 0].max()) / 2, (p[:, 1].min() + p[:, 1].max()) / 2, z])


hx = J['hips'][0]
P = {'hips': np.array([hx, J['hips'][2], J['hips'][1]])}
for k in ('spine', 'chest', 'neck', 'head'):
    P[k] = np.array([hx, J[k][1], J[k][0]])
P['head_top'] = np.array([hx, P['head'][1], J['head_top']])
for side, sx, nm_ in (('L', 1, 'Left'), ('R', -1, 'Right')):
    shx, shz = J['sh']
    P['sh' + side] = np.array([sx * shx, P['chest'][1] + 0.005, shz])
    P['clav' + side] = np.array([sx * 0.035 + hx, P['chest'][1] - 0.01, shz + 0.02])
    for k in ('el', 'wr', 'tip'):
        jx, jz = J[k]
        c = centre(jz, sx * jx - 0.07 if sx > 0 else -jx - 0.07, sx * jx + 0.07 if sx > 0 else -jx + 0.07)
        P[k + side] = c
    for k, kk in (('hip', 'hip'), ('kn', 'kn'), ('an', 'an')):
        jx, jz = J[kk + side]
        if k == 'hip':
            P['hip' + side] = np.array([jx, P['hips'][1], jz])
        else:
            P[k + side] = centre(jz, jx - 0.075, jx + 0.075)
    P['toe' + side] = P['an' + side] + np.array([0, -0.12, -0.07])
    P['toeEnd' + side] = P['toe' + side] + np.array([0, -0.07, 0])
log('joints', {k: [round(float(a), 3) for a in v_] for k, v_ in P.items()})

BONES = [('Hips', 'hips', 'spine', None), ('Spine', 'spine', 'chest', 'Hips'), ('Spine2', 'chest', 'neck', 'Spine'),
         ('Neck', 'neck', 'head', 'Spine2'), ('Head', 'head', 'head_top', 'Neck')]
for side, nm_ in (('L', 'Left'), ('R', 'Right')):
    BONES += [
        (f'{nm_}Shoulder', 'clav' + side, 'sh' + side, 'Spine2'),
        (f'{nm_}Arm', 'sh' + side, 'el' + side, f'{nm_}Shoulder'),
        (f'{nm_}ForeArm', 'el' + side, 'wr' + side, f'{nm_}Arm'),
        (f'{nm_}Hand', 'wr' + side, 'tip' + side, f'{nm_}ForeArm'),
        (f'{nm_}UpLeg', 'hip' + side, 'kn' + side, 'Hips'),
        (f'{nm_}Leg', 'kn' + side, 'an' + side, f'{nm_}UpLeg'),
        (f'{nm_}Foot', 'an' + side, 'toe' + side, f'{nm_}Leg'),
        (f'{nm_}ToeBase', 'toe' + side, 'toeEnd' + side, f'{nm_}Foot'),
    ]

# UVs: unwrap a heavily smoothed copy (curls and folds would shatter the islands) with seams between body parts
# and front/back halves, copy the UVs back, give the face more texels, pack.
PART_OF = {'Hips': 'torso', 'Spine': 'torso', 'Spine2': 'torso', 'Neck': 'neck', 'Head': 'head'}
for nm_ in ('Left', 'Right'):
    s_ = nm_[0]
    PART_OF.update({f'{nm_}Shoulder': 'torso', f'{nm_}Arm': 'arm' + s_, f'{nm_}ForeArm': 'arm' + s_, f'{nm_}Hand': 'hand' + s_,
                    f'{nm_}UpLeg': 'leg' + s_, f'{nm_}Leg': 'leg' + s_, f'{nm_}Foot': 'foot' + s_, f'{nm_}ToeBase': 'foot' + s_})


def face_parts(cent):
    """Nearest bone segment -> part name; + front/back (or inner/outer for feet) half."""
    best = np.full(len(cent), np.inf)
    part = np.empty(len(cent), dtype=object)
    axis = np.zeros((len(cent), 3))
    for name, h, t, _ in BONES:
        d = lib.seg_dist(cent, P[h], P[t])
        if name == 'LeftShoulder' or name == 'RightShoulder':
            d = d + 0.03  # prefer arm/torso
        upd = d < best
        best[upd] = d[upd]
        part[upd] = PART_OF[name]
        a_, b_ = P[h], P[t]
        ab = b_ - a_
        tt = np.clip(((cent[upd] - a_) @ ab) / (ab @ ab), 0, 1)
        axis[upd] = a_ + tt[:, None] * ab
    side = np.where(np.char.startswith(part.astype(str), 'foot'), np.sign(cent[:, 0] - axis[:, 0]), np.sign(cent[:, 1] - axis[:, 1] - np.where(part == 'head', 0.02, 0.0)))
    return part, side


smooth = low.copy()
smooth.data = low.data.copy()
smooth.name = 'uvproxy'
sc.collection.objects.link(smooth)
smm = smooth.modifiers.new('sm', 'SMOOTH')
smm.factor = 1.0
smm.iterations = 30
bpy.context.view_layer.objects.active = smooth
for o in bpy.data.objects:
    o.select_set(o is smooth)
bpy.ops.object.modifier_apply(modifier='sm')
cent = np.empty(len(low.data.polygons) * 3)
low.data.polygons.foreach_get('center', cent)
cent = cent.reshape(-1, 3)
fpart, fside = face_parts(cent)
# the face (skin/beard/eyes of the head, front half) gets its own island; hair keeps front/back halves
from scipy.spatial import cKDTree  # noqa: E402

near = cKDTree(g.v).query(cent)[1]
flab = lab[near].astype(str)
is_face = (fpart == 'head') & np.isin(flab, ['skin', 'beard', 'eye']) & (cent[:, 1] < P['head'][1] - 0.02)
fpart = np.where(is_face, 'face', fpart)
fside = np.where(is_face, 0, fside)
key = np.array([f'{a_}{int(b_)}' for a_, b_ in zip(fpart, fside)])
bpy.ops.object.mode_set(mode='EDIT')
bm = bmesh.from_edit_mesh(smooth.data)
bm.faces.ensure_lookup_table()
for e in bm.edges:
    lf = e.link_faces
    e.seam = len(lf) != 2 or key[lf[0].index] != key[lf[1].index]
bmesh.update_edit_mesh(smooth.data)
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.unwrap(method='ANGLE_BASED', margin=0.002)
bpy.ops.object.mode_set(mode='OBJECT')
uv = np.empty(len(smooth.data.loops) * 2, np.float32)
smooth.data.uv_layers.active.data.foreach_get('uv', uv)
bpy.data.objects.remove(smooth)
while low.data.uv_layers:
    low.data.uv_layers.remove(low.data.uv_layers[0])
low.data.uv_layers.new(name='UVMap')
uv = uv.reshape(-1, 2)
# texel density: face/head x2.1, hands x1.3 (scaling about the origin is fine, packing re-places the islands)
loop_face = np.empty(len(low.data.loops), np.int64)
for pidx, poly in enumerate(low.data.polygons):
    loop_face[poly.loop_start : poly.loop_start + poly.loop_total] = pidx
lk = np.select([fpart == 'face', fpart == 'head', np.char.startswith(fpart.astype(str), 'hand')], [3.2, 1.5, 1.3], 1.0)[loop_face]
uv *= lk[:, None]
low.data.uv_layers['UVMap'].data.foreach_set('uv', uv.ravel())
bpy.context.view_layer.objects.active = low
for o in bpy.data.objects:
    o.select_set(o is low)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.pack_islands(rotate=True, margin=0.004)
bpy.ops.object.mode_set(mode='OBJECT')
log('uv packed', len(set(key)), 'part halves')
# debug: UV layout coloured by part
from PIL import ImageDraw  # noqa: E402

dbg = Image.new('RGB', (1024, 1024), (20, 20, 24))
dr = ImageDraw.Draw(dbg)
uvf = np.empty(len(low.data.loops) * 2, np.float32)
low.data.uv_layers['UVMap'].data.foreach_get('uv', uvf)
uvf = uvf.reshape(-1, 2)
pal = {}
for pidx, poly in enumerate(low.data.polygons):
    k_ = key[pidx]
    if k_ not in pal:
        h_ = abs(hash(k_)) % 360
        import colorsys

        pal[k_] = tuple(int(c * 255) for c in colorsys.hsv_to_rgb(h_ / 360, 0.6, 0.9))
    pts_ = [(float(uvf[li][0]) * 1024, (1 - float(uvf[li][1])) * 1024) for li in range(poly.loop_start, poly.loop_start + poly.loop_total)]
    dr.polygon(pts_, fill=pal[k_])
dbg.save(os.path.join(WORK, 'uv_parts.png'))

# ------------------------------------------------------------------ bakes (selected to active)
TEX = args.tex


def new_img(name, size, data=False):
    im = bpy.data.images.new(name, size, size, alpha=False, float_buffer=True)
    im.colorspace_settings.name = 'Non-Color' if data else 'Linear Rec.709'
    return im


bake_mat = bpy.data.materials.new('bake_target')
bake_mat.use_nodes = True
tex_node = bake_mat.node_tree.nodes.new('ShaderNodeTexImage')
bake_mat.node_tree.nodes.active = tex_node
low.data.materials.append(bake_mat)

sc.render.bake.target = 'IMAGE_TEXTURES'
sc.render.bake.use_selected_to_active = True
sc.render.bake.cage_extrusion = 0.012
sc.render.bake.max_ray_distance = 0.05
sc.render.bake.margin = 12
sc.cycles.samples = 1
for o in bpy.data.objects:
    o.select_set(o in (high, low))
bpy.context.view_layer.objects.active = low


def bake_emit(attr, img):
    high.data.materials.clear()
    high.data.materials.append(lib.attr_material(f'emit_{attr}', attr, emission=True))
    tex_node.image = img
    bpy.ops.object.bake(type='EMIT')
    a = np.empty(img.size[0] * img.size[1] * 4, np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)[::-1, :, :3]


alb = bake_emit('Col', new_img('albedo', TEX))
log('albedo baked')
orm = bake_emit('ORM', new_img('orm', TEX // 2, True))
log('orm baked')
nimg = new_img('normal', TEX, True)
tex_node.image = nimg
sc.render.bake.normal_space = 'TANGENT'
bpy.ops.object.bake(type='NORMAL')
nrm = np.empty(TEX * TEX * 4, np.float32)
nimg.pixels.foreach_get(nrm)
nrm = nrm.reshape(TEX, TEX, 4)[::-1, :, :3]
log('normal baked')


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def save(arr, path, q=90):
    Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path, quality=q, optimize=True)
    return path


f_alb = save(to_srgb(alb), os.path.join(WORK, f'{args.id}_albedo.jpg'), 90)
f_orm = save(orm, os.path.join(WORK, f'{args.id}_orm.jpg'), 90)
f_nrm = save(nrm, os.path.join(WORK, f'{args.id}_normal.jpg'), 92)
log('textures saved')

# ------------------------------------------------------------------ final material
bpy.data.objects.remove(high)
low.data.materials.clear()
m = bpy.data.materials.new(f'{args.id}_skin')
m.use_nodes = True
nt = m.node_tree
bs = nt.nodes['Principled BSDF']
ta = nt.nodes.new('ShaderNodeTexImage')
ta.image = bpy.data.images.load(f_alb)
nt.links.new(ta.outputs['Color'], bs.inputs['Base Color'])
to = nt.nodes.new('ShaderNodeTexImage')
to.image = bpy.data.images.load(f_orm)
to.image.colorspace_settings.name = 'Non-Color'
sep = nt.nodes.new('ShaderNodeSeparateColor')
nt.links.new(to.outputs['Color'], sep.inputs[0])
nt.links.new(sep.outputs['Green'], bs.inputs['Roughness'])
nt.links.new(sep.outputs['Blue'], bs.inputs['Metallic'])
tn = nt.nodes.new('ShaderNodeTexImage')
tn.image = bpy.data.images.load(f_nrm)
tn.image.colorspace_settings.name = 'Non-Color'
nm = nt.nodes.new('ShaderNodeNormalMap')
nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
low.data.materials.append(m)

# ------------------------------------------------------------------ armature
arm_data = bpy.data.armatures.new('rig')
arm = bpy.data.objects.new('rig', arm_data)
sc.collection.objects.link(arm)
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


def weights_ok(ob):
    me = ob.data
    nog = sum(1 for v_ in me.vertices if not any(gr.weight > 1e-4 for gr in v_.groups))
    return nog / len(me.vertices), nog


def auto_weights(ob):
    for o in bpy.data.objects:
        o.select_set(o in (ob, arm))
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')


auto_weights(low)
frac, nog = weights_ok(low)
log('bone heat: unweighted verts', nog, f'({frac:.2%})')
if frac > 0.002:
    # voxel proxy: watertight copy gets heat weights, transferred back to the real mesh
    for gr in list(low.vertex_groups):
        low.vertex_groups.remove(gr)
    proxy = low.copy()
    proxy.data = low.data.copy()
    proxy.name = 'proxy'
    sc.collection.objects.link(proxy)
    proxy.parent = None
    for mm in list(proxy.modifiers):
        proxy.modifiers.remove(mm)
    rm = proxy.modifiers.new('vox', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = 0.012
    bpy.context.view_layer.objects.active = proxy
    for o in bpy.data.objects:
        o.select_set(o is proxy)
    bpy.ops.object.modifier_apply(modifier='vox')
    auto_weights(proxy)
    log('proxy unweighted', weights_ok(proxy))
    for name, *_ in BONES:
        low.vertex_groups.new(name=name)
    dt = low.modifiers.new('dt', 'DATA_TRANSFER')
    dt.object = proxy
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'
    dt.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.objects.active = low
    for o in bpy.data.objects:
        o.select_set(o is low)
    bpy.ops.object.modifier_move_to_index(modifier='dt', index=0)
    bpy.ops.object.modifier_apply(modifier='dt')
    bpy.data.objects.remove(proxy)
    log('weights transferred, unweighted', weights_ok(low))
bpy.context.view_layer.objects.active = low
for o in bpy.data.objects:
    o.select_set(o is low)
bpy.ops.object.vertex_group_limit_total(limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)

# ------------------------------------------------------------------ fists
# The sculpts have open hands; fighters need fists. Curl the four fingers toward the palm in two joints
# (knuckles, middle joints) directly in the rest mesh. The palm side comes from a PCA of the hand plus a hint.


def rot(pts, pivot, axis, ang):
    k = axis / np.linalg.norm(axis)
    p_ = pts - pivot
    c, s_ = np.cos(ang), np.sin(ang)
    if np.ndim(ang):
        c = c[:, None]
        s_ = s_[:, None]
    return pivot + p_ * c + np.cross(k, p_) * s_ + k * (p_ @ k)[:, None] * (1 - c)


co = np.empty(len(low.data.vertices) * 3)
low.data.vertices.foreach_get('co', co)
co = co.reshape(-1, 3)
gidx = {gr.name: gr.index for gr in low.vertex_groups}
for side, nm_ in (('L', 'Left'), ('R', 'Right')):
    hint = np.array(mod.PALM[side], float)
    gi = gidx[f'{nm_}Hand']
    w_hand = np.array([next((gg.weight for gg in v_.groups if gg.group == gi), 0.0) for v_ in low.data.vertices])
    hv = w_hand > 0.5
    wr, tip = P['wr' + side], P['tip' + side]
    d = tip - wr
    L_ = np.linalg.norm(d)
    d /= L_
    pts = co[hv]
    _, _, vt = np.linalg.svd(pts - pts.mean(0), full_matrices=False)
    nrm_ = vt[2] - d * (vt[2] @ d)
    nrm_ /= np.linalg.norm(nrm_)
    if nrm_ @ hint < 0:
        nrm_ = -nrm_
    axis = np.cross(d, nrm_)
    t = ((co - wr) @ d) / L_
    lat = (co - wr) @ (axis / np.linalg.norm(axis))
    # thumb: off to the side of the hand axis and short of the knuckles; which side depends on the hand
    thumb_side = np.sign(np.median(lat[hv & (t > 0.2) & (t < 0.5)]) or 1.0)
    thumb = hv & (t < 0.62) & (lat * thumb_side > 0.028)
    fingers = hv & ~thumb
    out = co.copy()
    piv2 = wr + d * L_ * 0.74
    for t0, ang in ((0.5, math.radians(80)), (0.74, math.radians(95))):
        piv = wr + d * L_ * t0 if t0 == 0.5 else piv2
        wgt = lib.smoothstep(t0 - 0.04, t0 + 0.04, t) * fingers
        m_ = wgt > 0
        out[m_] = rot(out[m_], piv, axis, ang * wgt[m_])
        if t0 == 0.5:
            piv2 = rot(piv2[None], piv, axis, ang)[0]
    # bring a spread thumb alongside the hand (rotation about the palm normal), then fold it toward the palm
    if thumb.any():
        base = wr + d * L_ * 0.12
        tip_i = np.argmax(np.where(thumb, (co - base) @ (axis / np.linalg.norm(axis)) * thumb_side, -np.inf))
        u_ = co[tip_i] - base
        u_ -= nrm_ * (u_ @ nrm_)
        target = d * math.cos(math.radians(30)) + (axis / np.linalg.norm(axis)) * thumb_side * math.sin(math.radians(30))
        cr = np.cross(u_ / np.linalg.norm(u_), target)
        spread = math.atan2(cr @ nrm_, (u_ / np.linalg.norm(u_)) @ target)
        if abs(spread) > math.radians(10):
            wsp = lib.smoothstep(0.005, 0.03, lat * thumb_side) * thumb
            ms = wsp > 0
            out[ms] = rot(out[ms], base, nrm_, spread * wsp[ms])
        log('thumb spread', side, round(math.degrees(spread)))
    wt = lib.smoothstep(0.012, 0.04, lat * thumb_side) * thumb
    m_ = wt > 0
    out[m_] = rot(out[m_], wr + d * L_ * 0.15, d, -thumb_side * math.radians(70) * wt[m_])
    co = out
    log('fist', side, 'fingers', int(fingers.sum()), 'thumb', int(thumb.sum()))
low.data.vertices.foreach_set('co', co.ravel())
low.data.update()

# ------------------------------------------------------------------ export
arm['rb_fit'] = 'height'  # GlbRig: scale to the fighter's gameplay height (realistic proportions)
arm['rb_head_pitch'] = float(getattr(mod, 'HEAD_PITCH', 0.0))  # GlbRig: head pitch offset (deg, negative = chin down)
for o in bpy.data.objects:
    o.select_set(o in (low, arm))
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True, export_skins=True, export_animations=False, export_morph=False,
    export_yup=True, export_texcoords=True, export_normals=True, export_tangents=True, export_materials='EXPORT',
    export_vertex_color='NONE', export_image_format='AUTO', export_extras=True,
)
tris = sum(len(p.vertices) - 2 for p in low.data.polygons)
size = os.path.getsize(OUT)
log('exported', OUT, f'{size / 1e6:.2f} MB', tris, 'tris')
with open(OUT.replace('.glb', '.credits.json'), 'w') as fh:
    json.dump({
        'model': f'{args.id}.glb',
        'source': f'Meshy AI sculpt supplied by the product owner ({mod.SRC}); textures, UVs, retopology and rig made with tools/meshy (Blender)',
        'license': "Depends on the product owner's Meshy plan: free-plan generations are CC BY 4.0 (credit Meshy), paid plans grant ownership - verify before release",
        'likeness': 'Depicts a real person at the product owner\'s request; name/likeness rights must be cleared before release',
        'triangles': tris,
    }, fh, indent=2)
