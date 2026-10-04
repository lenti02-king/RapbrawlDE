"""Builds a rigged, textured fighter GLB from MakeHuman data with Blender (bpy).

    python3 tools/characters/build.py bonez [--out public/assets/characters/bonez.glb]

Pipeline: macro + detail targets -> fitted clothes/hair/eyes -> fists baked in -> MakeHuman default skeleton reduced
to a Mixamo-named game skeleton (what src/render/glbRig.ts retargets onto) -> generated textures -> GLB.
Only CC0 (MakeHuman bundled) or CC-BY assets are used; see CREDITS in public/assets/characters/.
"""
from __future__ import annotations

import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import mh  # noqa: E402
import texture as tx  # noqa: E402
from recipes import RECIPES  # noqa: E402

TMP = os.path.join(mh.ROOT, '.cache', 'build')

# ------------------------------------------------------------------ game skeleton

# reduced bone -> (head joint, tail joint) expressed with MakeHuman bones; parent
GAME_BONES = {
    'Hips': ('@hips', 'spine04:head', None),
    'Spine': ('spine04:head', 'spine03:head', 'Hips'),
    'Spine1': ('spine03:head', 'spine02:head', 'Spine'),
    'Spine2': ('spine02:head', 'neck01:head', 'Spine1'),
    'Neck': ('neck01:head', 'head:head', 'Spine2'),
    'Head': ('head:head', 'head:tail', 'Neck'),
    'LeftShoulder': ('clavicle.L:head', 'upperarm01.L:head', 'Spine2'),
    'LeftArm': ('upperarm01.L:head', 'lowerarm01.L:head', 'LeftShoulder'),
    'LeftForeArm': ('lowerarm01.L:head', 'wrist.L:head', 'LeftArm'),
    'LeftHand': ('wrist.L:head', 'finger3-1.L:head', 'LeftForeArm'),
    'RightShoulder': ('clavicle.R:head', 'upperarm01.R:head', 'Spine2'),
    'RightArm': ('upperarm01.R:head', 'lowerarm01.R:head', 'RightShoulder'),
    'RightForeArm': ('lowerarm01.R:head', 'wrist.R:head', 'RightArm'),
    'RightHand': ('wrist.R:head', 'finger3-1.R:head', 'RightForeArm'),
    'LeftUpLeg': ('upperleg01.L:head', 'lowerleg01.L:head', 'Hips'),
    'LeftLeg': ('lowerleg01.L:head', 'foot.L:head', 'LeftUpLeg'),
    'LeftFoot': ('foot.L:head', '@toes.L:head', 'LeftLeg'),
    'LeftToeBase': ('@toes.L:head', '@toes.L:tail', 'LeftFoot'),
    'RightUpLeg': ('upperleg01.R:head', 'lowerleg01.R:head', 'Hips'),
    'RightLeg': ('lowerleg01.R:head', 'foot.R:head', 'RightUpLeg'),
    'RightFoot': ('foot.R:head', '@toes.R:head', 'RightLeg'),
    'RightToeBase': ('@toes.R:head', '@toes.R:tail', 'RightFoot'),
}
# MakeHuman bone -> game bone (anything not listed inherits its parent's mapping)
DIRECT = {
    'root': 'Hips', 'spine05': 'Hips', 'pelvis.L': 'Hips', 'pelvis.R': 'Hips',
    'spine04': 'Spine', 'spine03': 'Spine1', 'spine02': 'Spine2', 'spine01': 'Spine2', 'breast.L': 'Spine2', 'breast.R': 'Spine2',
    'neck01': 'Neck', 'neck02': 'Neck', 'neck03': 'Neck', 'head': 'Head',
}
for s in ('L', 'R'):
    side = 'Left' if s == 'L' else 'Right'
    DIRECT.update({
        f'clavicle.{s}': f'{side}Shoulder', f'shoulder01.{s}': f'{side}Shoulder',
        f'upperarm01.{s}': f'{side}Arm', f'upperarm02.{s}': f'{side}Arm',
        f'lowerarm01.{s}': f'{side}ForeArm', f'lowerarm02.{s}': f'{side}ForeArm',
        f'wrist.{s}': f'{side}Hand',
        f'upperleg01.{s}': f'{side}UpLeg', f'upperleg02.{s}': f'{side}UpLeg',
        f'lowerleg01.{s}': f'{side}Leg', f'lowerleg02.{s}': f'{side}Leg',
        f'foot.{s}': f'{side}Foot',
    })


def game_bone_of(name: str, sk) -> str:
    n = name
    while n is not None:
        if n in DIRECT:
            return DIRECT[n]
        if n.startswith('toe') and n.endswith(('.L', '.R')):
            return ('Left' if n.endswith('.L') else 'Right') + 'ToeBase'
        n = sk[n][2]
    return 'Hips'


def joint(spec: str, sk) -> np.ndarray:
    if spec == '@hips':
        l, r = sk['upperleg01.L'][0], sk['upperleg01.R'][0]
        return (l + r) / 2 + np.array([0, 0.25, 0])
    if spec.startswith('@toes.'):
        s = spec[6]
        which = spec.split(':')[1]
        pts = [sk[f'toe{k}-1.{s}'][0 if which == 'head' else 1] for k in range(1, 6)]
        if which == 'tail':
            pts = [sk[f'toe{k}-3.{s}' if f'toe{k}-3.{s}' in sk else f'toe{k}-2.{s}'][1] for k in range(1, 6)]
        return np.mean(pts, axis=0)
    b, which = spec.split(':')
    return sk[b][0 if which == 'head' else 1]


def remap_weights(part: mh.Part, base: mh.Base, sk, order: list[str]):
    idx = {n: i for i, n in enumerate(order)}
    cache: dict[int, int] = {}
    out = np.zeros((len(part.verts), len(order)), np.float32)
    for k in range(4):
        for vi, (bi, w) in enumerate(zip(part.skin_idx[:, k], part.skin_w[:, k])):
            if w <= 0:
                continue
            g = cache.get(int(bi))
            if g is None:
                g = idx[game_bone_of(base.bone_of_index(int(bi)), sk)]
                cache[int(bi)] = g
            out[vi, g] += w
    # keep top 4, normalise
    top = np.argsort(-out, axis=1)[:, :4]
    w4 = np.take_along_axis(out, top, axis=1)
    s = w4.sum(1, keepdims=True)
    s[s == 0] = 1
    w4 /= s
    w4[np.isnan(w4)] = 0
    return top, w4


# ------------------------------------------------------------------ fists (linear blend skinning on the finger bones)

def rot(axis, ang):
    axis = axis / np.linalg.norm(axis)
    x, y, z = axis
    c, s, C = math.cos(ang), math.sin(ang), 1 - math.cos(ang)
    return np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
                     [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                     [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])


def fist_transforms(sk, amount=1.0):
    """World (rest-space) 4x4 transforms for every finger bone of both hands."""
    M = {}
    for s in ('L', 'R'):
        W = sk[f'wrist.{s}'][0]
        I, P, Md = sk[f'finger2-1.{s}'][0], sk[f'finger5-1.{s}'][0], sk[f'finger3-1.{s}'][0]
        n = np.cross(I - P, Md - W)
        n /= np.linalg.norm(n)
        thumb_tip = sk[f'finger1-3.{s}'][1]
        if np.dot(n, thumb_tip - (I + P + Md) / 3) < 0:
            n = -n  # n points out of the palm
        for f in range(1, 6):
            parent = np.eye(4)
            angles = [0.55, 0.7, 0.55] if f == 1 else [1.45, 1.6, 1.15]
            for k in range(1, 4):
                b = f'finger{f}-{k}.{s}'
                h, t, _ = sk[b]
                d = (t - h) / np.linalg.norm(t - h)
                ax = np.cross(d, n)
                if f == 1:  # thumb folds across the palm towards the pinky side
                    ax = np.cross(d, n * 0.6 + (P - I) / np.linalg.norm(P - I) * 0.4)
                R = rot(ax, angles[k - 1] * amount)
                L = np.eye(4)
                L[:3, :3] = R
                L[:3, 3] = h - R @ h
                parent = parent @ L
                M[b] = parent.copy()
    return M


def apply_fist(part: mh.Part, base: mh.Base, M):
    v = np.zeros_like(part.verts)
    wsum = np.zeros(len(part.verts))
    hom = np.c_[part.verts, np.ones(len(part.verts))]
    for k in range(4):
        bi = part.skin_idx[:, k]
        w = part.skin_w[:, k]
        names = [base.bone_of_index(int(i)) for i in bi]
        for name in set(names):
            sel = np.array([n == name for n in names]) & (w > 0)
            if not sel.any():
                continue
            T = M.get(name)
            p = hom[sel] @ T.T if T is not None else hom[sel]
            v[sel] += p[:, :3] * w[sel, None]
            wsum[sel] += w[sel]
    wsum[wsum == 0] = 1
    moved = v / wsum[:, None]
    has = part.skin_w.sum(1) > 0
    part.verts = np.where(has[:, None], moved, part.verts)


# ------------------------------------------------------------------ build

def build(char: str, out: str):
    R = RECIPES[char]
    os.makedirs(os.path.join(TMP, char), exist_ok=True)
    base = mh.Base()
    T = mh.Targets(len(base.verts0))
    f = mh.macro_factors(**R['macro'])
    mods = mh.expand_modifiers(R.get('modifiers', {}), T.groups())
    V = T.apply(base.verts0, T.weights(f, mods))
    sk = base.skeleton(V)
    scale = (V.max(0) - V.min(0)) / (base.verts0.max(0) - base.verts0.min(0))

    parts: list[mh.Part] = []
    hidden = np.zeros(len(V), bool)
    waist_y = sk['spine04'][0][1]
    for spec in R['proxies']:
        p = mh.load_proxy(spec['kind'], spec['name'], V, scale)
        p.spec = spec  # type: ignore[attr-defined]
        if spec.get('keep_below_uv_v') is not None:
            keep_faces = [i for i, uv in enumerate(p.face_uvs) if uv is not None and p.uvs[uv][:, 1].max() <= spec['keep_below_uv_v']]
            p.faces = [p.faces[i] for i in keep_faces]
            p.face_uvs = [p.face_uvs[i] for i in keep_faces]
            if p.delete_verts.size:
                p.delete_verts = p.delete_verts & (V[:, 1] < waist_y)
        if spec.get('shrink'):  # pull hair volume towards the skull
            hc = sk['head'][0] + (sk['head'][1] - sk['head'][0]) * 0.45
            p.verts = hc + (p.verts - hc) * spec['shrink']
        if spec['kind'] == 'eyes':
            # the cornea shell is mapped onto a transparent corner of the texture: drop it so the iris shows
            keep = [i for i, uv in enumerate(p.face_uvs) if not (p.uvs[uv][:, 0].min() > 0.85 and p.uvs[uv][:, 1].max() < 0.15)]
            p.faces = [p.faces[i] for i in keep]
            p.face_uvs = [p.face_uvs[i] for i in keep]
        if spec['kind'] == 'clothes' and p.delete_verts.size and spec.get('hide_body', True):
            hidden |= p.delete_verts
        parts.append(p)
    body = base.body_part(V, hidden)
    body.spec = {'kind': 'body', 'name': 'body'}  # type: ignore[attr-defined]
    parts.insert(0, body)

    import accessories
    parts += accessories.make(R, parts, base, sk)

    M = fist_transforms(sk, R.get('fist', 1.0))
    for p in parts:
        apply_fist(p, base, M)

    order = list(GAME_BONES.keys())
    bones = {n: (joint(h, sk), joint(t, sk), par) for n, (h, t, par) in GAME_BONES.items()}

    write_credits(char, parts, out)

    import bpy
    import materials  # noqa: E402  (needs the fitted parts)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = materials.make(char, R, parts, base, sk, os.path.join(TMP, char))
    blender_export(char, parts, bones, order, base, sk, mats, out)


CC0_BUNDLED = 'CC0 (MakeHuman 1.1 bundled asset, see https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md)'


def write_credits(char: str, parts, out: str):
    """Per-asset licence list next to the GLB. MakeHuman-team assets (bundled) are CC0 today even where the 2016
    metadata still says AGPL; community assets keep their own licence (only CC-BY/CC0 ones are allowed)."""
    import json
    rows = [{'asset': 'MakeHuman base mesh, targets, skeleton, skin textures', 'licence': CC0_BUNDLED}]
    for p in parts:
        spec = p.spec
        if spec['kind'] in ('body', 'acc'):
            continue
        lic = p.license or {}
        l, author = str(lic.get('license', '?')), str(lic.get('author', '?'))
        team = any(n in author for n in ('Manuel Bastioni', 'Jonas Hauquier', 'Thomas Larsson', 'MakeHuman'))
        if 'AGPL' in l and not team:
            raise SystemExit(f'{spec["name"]}: community asset with licence {l} by {author} is not allowed')
        rows.append({'asset': f'{spec["kind"]}/{spec["name"]}', 'author': author, 'licence': CC0_BUNDLED if team else l})
    rows.append({'asset': 'accessories, beard, tattoos, fabric patterns, recolouring', 'licence': 'original procedural work (tools/characters)'})
    with open(out.replace('.glb', '.credits.json'), 'w') as f:
        json.dump(rows, f, indent=1)


def to_blender(p: np.ndarray) -> np.ndarray:
    p = np.asarray(p, dtype=np.float64) * 0.1
    return np.stack([p[..., 0], -p[..., 2], p[..., 1]], -1)


def blender_export(char, parts, bones, order, base, sk, mats, out):
    import bpy

    scene = bpy.context.scene
    arm_data = bpy.data.armatures.new(f'{char}_rig')
    arm = bpy.data.objects.new(f'{char}', arm_data)
    scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for n in order:
        h, t, par = bones[n]
        b = arm_data.edit_bones.new(n)
        b.head = tuple(to_blender(h))
        b.tail = tuple(to_blender(t))
        if (b.tail - b.head).length < 1e-4:
            b.tail = b.head + type(b.head)((0, 0, 0.02))
        if par:
            b.parent = eb[par]
        eb[n] = b
    bpy.ops.object.mode_set(mode='OBJECT')

    for p in parts:
        name = p.spec.get('object', p.spec['name'])
        verts = to_blender(p.verts)
        used = sorted({v for f in p.faces for v in f})
        remap = {v: i for i, v in enumerate(used)}
        faces = [[remap[v] for v in f] for f in p.faces]
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in verts[used]], [], faces)
        me.update()
        if len(p.uvs):
            uvl = me.uv_layers.new(name='UVMap')
            loop_uv = []
            for fuv in p.face_uvs:
                for k in fuv:
                    loop_uv.append(p.uvs[k])
            uvl.data.foreach_set('uv', np.array(loop_uv, np.float32).ravel())
        for poly in me.polygons:
            poly.use_smooth = True
        ob = bpy.data.objects.new(name, me)
        scene.collection.objects.link(ob)
        ob.parent = arm
        mat = mats.get(p.spec['name'])
        if mat:
            me.materials.append(mat)
        top, w4 = remap_weights(p, base, sk, order)
        groups = [ob.vertex_groups.new(name=n) for n in order]
        for new_i, old_i in enumerate(used):
            for k in range(4):
                if w4[old_i, k] > 1e-4:
                    groups[top[old_i, k]].add([new_i], float(w4[old_i, k]), 'REPLACE')
        mod = ob.modifiers.new('Armature', 'ARMATURE')
        mod.object = arm
        if p.spec.get('decimate'):
            dm = ob.modifiers.new('Decimate', 'DECIMATE')
            dm.ratio = p.spec['decimate']
            dm.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.modifier_move_to_index(modifier='Decimate', index=0)
            bpy.ops.object.modifier_apply(modifier='Decimate')

    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB', export_skins=True, export_animations=False, export_morph=False,
        export_yup=True, export_image_format='AUTO', export_texcoords=True, export_normals=True,
        export_materials='EXPORT', export_extras=False,
    )
    tris = sum(sum(len(pl.vertices) - 2 for pl in o.data.polygons) for o in scene.objects if o.type == 'MESH')
    print(f'[build] {char}: {out} ({os.path.getsize(out) / 1e6:.1f} MB, {tris} triangles, {len(order)} bones)')


if __name__ == '__main__':
    char = sys.argv[1]
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else os.path.join(mh.ROOT, 'public', 'assets', 'characters', f'{char}.glb')
    build(char, out)
