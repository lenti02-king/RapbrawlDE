"""MakeHuman 1.1 data (npm package "makehuman-data") -> morphed, fitted, skinned meshes as numpy arrays.

No Blender dependency here: build.py turns the result into Blender objects and a GLB.
Coordinates stay in MakeHuman space (Y up, face towards +Z, decimetres) until build.py converts them.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA = os.environ.get('MH_DATA', os.path.join(ROOT, '.cache', 'makehuman-data'))
PUB = os.path.join(DATA, 'public', 'data')


def _json(path: str):
    with open(path, encoding='utf8') as f:
        return json.load(f)


# ---------------------------------------------------------------- three.js JSON (format 3) faces

def decode_faces(faces: list[int], n_uv_layers: int = 1):
    """Returns list of (vertex indices, material index, uv indices)."""
    out = []
    i = 0
    n = len(faces)
    while i < n:
        t = faces[i]
        i += 1
        nv = 4 if t & 1 else 3
        verts = faces[i:i + nv]
        i += nv
        mat = 0
        if t & 2:
            mat = faces[i]
            i += 1
        if t & 4:
            i += n_uv_layers
        uvs = None
        if t & 8:
            uvs = faces[i:i + nv]
            i += nv * n_uv_layers
        if t & 16:
            i += 1
        if t & 32:
            i += nv
        if t & 64:
            i += 1
        if t & 128:
            i += nv
        out.append((verts, mat, uvs))
    return out


# ---------------------------------------------------------------- macro factors (port of makehuman-js factors.js)

def macro_factors(gender=1.0, age=0.5, muscle=0.5, weight=0.5, height=0.5, proportions=0.5,
                  african=0.0, asian=0.0, caucasian=1.0, breast_size=0.5, breast_firmness=0.5) -> dict[str, float]:
    f: dict[str, float] = {}
    f['male'] = gender
    f['female'] = 1 - gender
    if age < 0.5:
        f['old'] = 0.0
        f['baby'] = max(0.0, 1 - age * 5.333)
        f['young'] = max(0.0, (age - 0.1875) * 3.2)
        f['child'] = max(0.0, min(1.0, 5.333 * age) - f['young'])
    else:
        f['child'] = f['baby'] = 0.0
        f['old'] = max(0.0, age * 2 - 1)
        f['young'] = 1 - f['old']

    def tri(v, lo, mid, hi):
        f[hi] = max(0.0, v * 2 - 1)
        f[lo] = max(0.0, 1 - v * 2)
        f[mid] = 1 - (f[hi] + f[lo]) if mid in ('averagemuscle', 'averageweight') else (1 - f[hi] if f[hi] > f[lo] else 1 - f[lo])

    tri(weight, 'minweight', 'averageweight', 'maxweight')
    tri(muscle, 'minmuscle', 'averagemuscle', 'maxmuscle')
    tri(height, 'minheight', 'averageheight', 'maxheight')
    tri(proportions, 'uncommonproportions', 'regularproportions', 'idealproportions')
    tri(breast_size, 'mincup', 'averagecup', 'maxcup')
    tri(breast_firmness, 'minfirmness', 'averagefirmness', 'maxfirmness')
    s = african + asian + caucasian
    f['african'], f['asian'], f['caucasian'] = african / s, asian / s, caucasian / s
    return f


# ---------------------------------------------------------------- targets

class Targets:
    def __init__(self, n_verts: int):
        tl = _json(os.path.join(DATA, 'src', 'json', 'targets', 'target-list.json'))['targets']
        self.categories = _json(os.path.join(DATA, 'src', 'json', 'targets', 'target-category-data.json'))
        self.paths = sorted(tl.keys())
        self.index = {p: i for i, p in enumerate(self.paths)}
        raw = np.memmap(os.path.join(PUB, 'targets', 'targets.bin'), dtype='<i2', mode='r')
        assert raw.size == len(self.paths) * n_verts * 3, 'targets.bin does not match the base mesh'
        self.data = raw.reshape(len(self.paths), n_verts * 3)
        self.info = [self._split(p) for p in self.paths]

    def _split(self, path: str):
        p = path.lower()
        p = re.sub(r'^.+targets/', '', p)
        p = re.sub(r'\.target$', '', p)
        tags = re.split(r'[/_,-]', p)
        cats = [t for t in tags if t in self.categories]
        group = '-'.join(t for t in tags if t not in self.categories)
        return group, cats

    def weights(self, factors: dict[str, float], modifiers: dict[str, float]) -> np.ndarray:
        """Macro targets get the product of their factor values; modifier groups ('torso-vshape-more')
        get value * product of any macro factors they depend on."""
        w = np.zeros(len(self.paths), dtype=np.float64)
        for i, (group, cats) in enumerate(self.info):
            macro = 1.0
            for c in cats:
                macro *= factors.get(c, 0.0)
            if group.startswith('macrodetails') or group.startswith('breast'):
                if group.startswith('breast') and factors['female'] == 0:
                    continue
                w[i] = macro
            elif group in modifiers:
                w[i] = modifiers[group] * (macro if cats else 1.0)
        return w

    def apply(self, base: np.ndarray, w: np.ndarray) -> np.ndarray:
        nz = np.nonzero(w)[0]
        d = np.zeros(base.size, dtype=np.float64)
        for i in nz:
            d += self.data[i].astype(np.float64) * w[i]
        return base + (d * 1e-3).reshape(-1, 3)

    def groups(self) -> set[str]:
        return {g for g, _ in self.info}


def expand_modifiers(mods: dict[str, float], groups: set[str]) -> dict[str, float]:
    """'torso-vshape': 0.4 -> {'torso-vshape-more': 0.4}; negative picks the min side. Direct group names pass through."""
    pairs = [('decr', 'incr'), ('less', 'more'), ('in', 'out'), ('down', 'up'), ('backward', 'forward'),
             ('forward', 'backward'), ('min', 'max'), ('decrease', 'increase'), ('narrow', 'wide'), ('deflate', 'inflate'), ('compress', 'uncompress'),
             ('small', 'big'), ('flat', 'pointed'), ('skinny', 'fat'), ('thin', 'fat'), ('concave', 'convex'),
             ('downward', 'upward'), ('slim', 'bulge'), ('lowered', 'raised'), ('round', 'square'), ('short', 'long')]
    out: dict[str, float] = {}
    for k, v in mods.items():
        if k in groups:
            out[k] = v
            continue
        hit = False
        for lo, hi in pairs:
            if f'{k}-{lo}' in groups and f'{k}-{hi}' in groups:
                if v >= 0:
                    out[f'{k}-{hi}'] = v
                else:
                    out[f'{k}-{lo}'] = -v
                hit = True
                break
        if not hit:
            raise KeyError(f'unknown modifier {k}')
    return out


# ---------------------------------------------------------------- base mesh + skeleton

@dataclass
class Part:
    name: str
    verts: np.ndarray            # (n,3)
    faces: list[list[int]]       # polygon vertex indices
    uvs: np.ndarray              # (m,2)
    face_uvs: list[list[int]]
    skin_idx: np.ndarray         # (n,4) indices into skeleton bone list
    skin_w: np.ndarray           # (n,4)
    material: dict = field(default_factory=dict)
    tex_dir: str = ''
    license: dict = field(default_factory=dict)


class Base:
    def __init__(self):
        d = _json(os.path.join(PUB, 'models', 'human_full_size.json'))
        self.verts0 = np.array(d['vertices'], dtype=np.float64).reshape(-1, 3)
        self.uvs = np.array(d['uvs'][0], dtype=np.float64).reshape(-1, 2)
        self.faces = decode_faces(d['faces'])
        self.materials = [m['DbgName'] for m in d['materials']]
        self.skin_idx = np.array(d['skinIndices'], dtype=np.int64).reshape(-1, 4)
        self.skin_w = np.array(d['skinWeights'], dtype=np.float64).reshape(-1, 4)
        self.bones = d['bones']                         # 326 entries: "<bone>____head" joint entries + tail entries
        self.joints = d['metadata']['joint_pos_idxs']   # "<bone>____head|tail" -> vertex indices

    def body_part(self, verts: np.ndarray, hidden: np.ndarray | None = None) -> Part:
        body = self.materials.index('body')
        keep = [(f, uv) for f, m, uv in self.faces if m == body]
        if hidden is not None:
            keep = [(f, uv) for f, uv in keep if hidden[f].sum() < len(f)]
        used = sorted({v for f, _ in keep for v in f})
        remap = {v: i for i, v in enumerate(used)}
        faces = [[remap[v] for v in f] for f, _ in keep]
        return Part('body', verts[used], faces, self.uvs, [uv for _, uv in keep], self.skin_idx[used], self.skin_w[used])

    def bone_of_index(self, i: int) -> str:
        """Skin indices point at the '<bone>____head' entries (the joint the bone rotates about)."""
        n = self.bones[i]['name']
        return n[:-len('____head')] if n.endswith('____head') else n

    def skeleton(self, verts: np.ndarray):
        """Real bones only: name -> (head, tail, parent name). Parents resolved through the pseudo '____head' entries."""
        names = [b['name'] for b in self.bones]
        out = {}
        for i, b in enumerate(self.bones):
            n = b['name']
            if n.endswith('____head'):
                continue
            pi = b['parent']
            parent = None
            while pi >= 0:
                pn = names[pi]
                if not pn.endswith('____head'):
                    parent = pn
                    break
                pi = self.bones[pi]['parent']
            h = verts[self.joints[n + '____head']].mean(axis=0)
            t = verts[self.joints[n + '____tail']].mean(axis=0)
            out[n] = (h, t, parent)
        return out


# ---------------------------------------------------------------- proxies (clothes, hair, eyes, eyebrows, ...)

def load_proxy(kind: str, name: str, body_verts: np.ndarray, scale: np.ndarray | None = None) -> Part:
    folder = os.path.join(PUB, 'proxies', kind, name)
    d = _json(os.path.join(folder, f'{name}.json'))
    md = d['metadata']
    ref = np.array(d['ref_vIdxs'], dtype=np.int64)
    w = np.array(d['weights'], dtype=np.float64)
    off = np.array(d['offsets'], dtype=np.float64)
    if scale is not None:
        off = off * scale
    verts = (body_verts[ref] * w[:, :, None]).sum(axis=1) + off
    faces_raw = decode_faces(d['faces'])
    uvs = np.array(d['uvs'][0], dtype=np.float64).reshape(-1, 2) if d.get('uvs') and d['uvs'][0] else np.zeros((0, 2))
    k = int(d.get('influencesPerVertex', 4))
    skin_idx = np.array(d['skinIndices'], dtype=np.int64).reshape(-1, k)
    skin_w = np.array(d['skinWeights'], dtype=np.float64).reshape(-1, k)
    if k < 4:
        skin_idx = np.pad(skin_idx, ((0, 0), (0, 4 - k)))
        skin_w = np.pad(skin_w, ((0, 0), (0, 4 - k)))
    assert len(skin_idx) == len(verts), f'{name}: skin weights do not match the vertices'
    p = Part(name, verts, [f for f, _, _ in faces_raw], uvs, [uv for _, _, uv in faces_raw], skin_idx, skin_w,
             material=d['materials'][0] if d.get('materials') else {}, tex_dir=folder, license=md.get('license', {}))
    p.delete_verts = np.array(md.get('deleteVerts') or [], dtype=bool)  # type: ignore[attr-defined]
    p.z_depth = md.get('z_depth', 0)  # type: ignore[attr-defined]
    return p


def skin_texture(name: str) -> str:
    folder = os.path.join(PUB, 'skins', name)
    d = _json(os.path.join(folder, f'{name}.json'))
    return os.path.join(folder, d['mapDiffuse'])
