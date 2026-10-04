"""Procedural accessories fitted to the morphed body: puffer vest (from the T-shirt), knit scarf, chains with
pendants, wrist watches. All geometry is generated here (original), in MakeHuman space (decimetres, Y up, +Z front)."""
from __future__ import annotations

import math

import numpy as np

import mh


def bone_index(base: mh.Base, name: str) -> int:
    for i, b in enumerate(base.bones):
        if b['name'] == name + '____head':
            return i
    raise KeyError(name)


def make_part(name: str, verts, faces, uvs, face_uvs, skin_idx, skin_w, look: dict) -> mh.Part:
    p = mh.Part(name, np.asarray(verts, np.float64), faces, np.asarray(uvs, np.float64), face_uvs,
                np.asarray(skin_idx, np.int64), np.asarray(skin_w, np.float64))
    p.spec = {'kind': 'acc', 'name': name, **look}  # type: ignore[attr-defined]
    return p


def vertex_normals(verts: np.ndarray, faces) -> np.ndarray:
    n = np.zeros_like(verts)
    for f in faces:
        p = verts[f]
        fn = np.cross(p[1] - p[0], p[2] - p[0])
        if len(f) == 4:
            fn = fn + np.cross(p[2] - p[0], p[3] - p[0])
        n[f] += fn
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    ln[ln == 0] = 1
    return n / ln


def smooth_circular(a: np.ndarray, k: int) -> np.ndarray:
    pad = np.concatenate([a[-k:], a, a[:k]])
    ker = np.ones(2 * k + 1) / (2 * k + 1)
    return np.convolve(pad, ker, mode='same')[k:-k]


def tube(curve: np.ndarray, radius: float | np.ndarray, sides: int = 8, closed: bool = True, flat: float = 1.0,
         up: np.ndarray | None = None):
    """Sweep a circle (optionally flattened by `flat` along the frame normal) along a polyline."""
    n = len(curve)
    T = np.roll(curve, -1, 0) - np.roll(curve, 1, 0) if closed else np.gradient(curve, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    ref = np.array([0, 1.0, 0]) if up is None else up
    verts, uvs = [], []
    rad = np.broadcast_to(np.asarray(radius, np.float64), (n,))
    length = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(curve, axis=0), axis=1))])
    for i in range(n):
        N = np.cross(T[i], ref)
        if np.linalg.norm(N) < 1e-6:
            N = np.cross(T[i], [1.0, 0, 0])
        N /= np.linalg.norm(N)
        B = np.cross(T[i], N)
        for s in range(sides + 1):
            a = 2 * math.pi * s / sides
            verts.append(curve[i] + rad[i] * (math.cos(a) * N * flat + math.sin(a) * B))
            uvs.append((length[i] / (2 * math.pi * rad.mean() * 1.5), s / sides))
    faces = []
    rows = n if closed else n - 1
    for i in range(rows):
        j = (i + 1) % n
        for s in range(sides):
            a, b = i * (sides + 1) + s, i * (sides + 1) + s + 1
            c, d = j * (sides + 1) + s + 1, j * (sides + 1) + s
            faces.append([a, d, c, b])
    if closed:  # duplicate seam column in u for continuous mapping: fine for tiling textures
        pass
    return np.array(verts), faces, np.array(uvs)


def box(center, ax_u, ax_v, ax_w, su, sv, sw):
    """Oriented box: 8 verts, 6 quads, simple planar UVs."""
    c = np.asarray(center, np.float64)
    corners = []
    for z in (-1, 1):
        for y in (-1, 1):
            for x in (-1, 1):
                corners.append(c + ax_u * su * x + ax_v * sv * y + ax_w * sw * z)
    f = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]
    uv = [((x + 1) / 2, (y + 1) / 2) for z in (-1, 1) for y in (-1, 1) for x in (-1, 1)]
    return np.array(corners), f, np.array(uv)


# ------------------------------------------------------------------ fitting helpers

def surface_ring(clouds: list[np.ndarray], center: np.ndarray, y_back: float, y_front: float, offset: float,
                 n: int = 72, band: float = 0.18, min_r: float = 0.5) -> np.ndarray:
    pts = np.concatenate(clouds)
    out = []
    rs = []
    for k in range(n):
        th = 2 * math.pi * k / n
        d = np.array([math.sin(th), 0, math.cos(th)])
        y = y_back + (y_front - y_back) * (1 + math.cos(th)) / 2
        sel = pts[np.abs(pts[:, 1] - y) < band]
        rel = sel - center
        proj = rel[:, 0] * d[0] + rel[:, 2] * d[2]
        lateral = np.abs(rel[:, 0] * d[2] - rel[:, 2] * d[0])
        cand = proj[(lateral < 0.2) & (proj > 0)]
        rs.append(cand.max() if len(cand) else np.nan)
    rs = np.array(rs)
    rs = np.where(np.isnan(rs), np.nanmedian(rs), rs)
    rs = smooth_circular(np.maximum(rs, min_r), 3) + offset
    for k in range(n):
        th = 2 * math.pi * k / n
        y = y_back + (y_front - y_back) * (1 + math.cos(th)) / 2
        out.append(center + np.array([rs[k] * math.sin(th), y - center[1], rs[k] * math.cos(th)]))
    return np.array(out)


def chain(name, base, sk, clouds, *, drop: float, offset: float, radius: float, look: dict, back_lift=0.15, pendant=None):
    c = sk['neck01'][0].copy()
    ring = surface_ring(clouds, c, c[1] + back_lift, c[1] - drop, offset)
    v, f, uv = tube(ring, radius, sides=8)
    ni, si = bone_index(base, 'neck01'), bone_index(base, 'spine01')
    # back of the ring follows the neck a little
    t = np.clip((v[:, 1] - (c[1] - drop * 0.4)) / (drop * 0.6 + back_lift), 0, 1) * 0.5
    sk_idx = np.stack([np.full(len(v), si), np.full(len(v), ni), np.zeros(len(v)), np.zeros(len(v))], 1)
    sk_w = np.stack([1 - t, t, np.zeros(len(v)), np.zeros(len(v))], 1)
    parts = [make_part(name, v, f, uv, f, sk_idx, sk_w, look)]
    if pendant:
        low = ring[np.argmin(ring[:, 1])]
        front = np.array([0, 0, 1.0])
        if pendant['shape'] == 'cross':
            h, w, th = pendant['size'], pendant['size'] * 0.62, 0.06
            cen = low + np.array([0, -h * 0.55, 0.04])
            bv, bf, buv = box(cen, np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), front, th * 1.3, h * 0.5, th)
            hv, hf, huv = box(cen + np.array([0, h * 0.18, 0]), np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), front, w * 0.5, th * 1.3, th)
            V = np.concatenate([bv, hv])
            F = bf + [[i + 8 for i in q] for q in hf]
            UV = np.concatenate([buv, huv])
        else:  # round medallion
            r = pendant['size'] * 0.5
            cen = low + np.array([0, -r * 1.1, 0.05])
            ring_pts = np.array([cen + np.array([math.cos(a) * r, math.sin(a) * r, 0]) for a in np.linspace(0, 2 * math.pi, 25)[:-1]])
            V = np.concatenate([[cen + front * 0.05], ring_pts + front * 0.05, ring_pts - front * 0.02])
            F = [[0, 1 + i, 1 + (i + 1) % 24] for i in range(24)] + [[1 + i, 25 + i, 25 + (i + 1) % 24, 1 + (i + 1) % 24] for i in range(24)]
            UV = np.concatenate([[(0.5, 0.5)], [((math.cos(a) + 1) / 2, (math.sin(a) + 1) / 2) for a in np.linspace(0, 2 * math.pi, 25)[:-1]] * 2])
        parts.append(make_part(name + '_pendant', V, F, UV, F, np.tile([si, 0, 0, 0], (len(V), 1)), np.tile([1.0, 0, 0, 0], (len(V), 1)), look))
    return parts


def watch(name, base, sk, body: mh.Part, side: str, look: dict, band_w=0.24, face_r=0.22, offset=0.03):
    e, w = sk[f'lowerarm01.{side}'][0], sk[f'wrist.{side}'][0]
    ax = (w - e) / np.linalg.norm(w - e)
    c = w - ax * 0.35
    rel = body.verts - c
    along = rel @ ax
    radial = np.linalg.norm(rel - np.outer(along, ax), axis=1)
    sel = rel[(np.abs(along) < 0.12) & (radial < 0.8)]
    u1 = np.cross(ax, [0, 1.0, 0])
    u1 /= np.linalg.norm(u1)
    u2 = np.cross(ax, u1)
    n = 32
    ring = []
    for k in range(n):
        a = 2 * math.pi * k / n
        d = math.cos(a) * u1 + math.sin(a) * u2
        proj = sel @ d
        lat = np.linalg.norm(sel - np.outer(proj, d) - np.outer(sel @ ax, ax), axis=1)
        cand = proj[lat < 0.12]
        ring.append(cand.max() if len(cand) else np.nan)
    r = np.array(ring)
    r = np.where(np.isnan(r), np.nanmedian(r), r) + offset
    r = smooth_circular(r, 2)
    curve = np.array([c + r[k] * (math.cos(2 * math.pi * k / n) * u1 + math.sin(2 * math.pi * k / n) * u2) for k in range(n)])
    v, f, uv = tube(curve, band_w * 0.5, sides=6, flat=0.35, up=ax)
    bi = bone_index(base, f'lowerarm02.{side}')
    parts = [make_part(name, v, f, uv, f, np.tile([bi, 0, 0, 0], (len(v), 1)), np.tile([1.0, 0, 0, 0], (len(v), 1)), look)]
    # watch face on the back of the wrist (opposite the palm)
    I, P, Md = sk[f'finger2-1.{side}'][0], sk[f'finger5-1.{side}'][0], sk[f'finger3-1.{side}'][0]
    pn = np.cross(I - P, Md - w)
    pn /= np.linalg.norm(pn)
    if np.dot(pn, sk[f'finger1-3.{side}'][1] - (I + P + Md) / 3) < 0:
        pn = -pn
    back = -pn - ax * np.dot(-pn, ax)
    back /= np.linalg.norm(back)
    k = int(np.argmax(curve @ back))
    cen = curve[k] + back * 0.05
    side_ax = np.cross(back, ax)
    pts = [cen + face_r * (math.cos(a) * ax + math.sin(a) * side_ax) for a in np.linspace(0, 2 * math.pi, 21)[:-1]]
    V = np.concatenate([[cen + back * 0.05], np.array(pts) + back * 0.05, np.array(pts) - back * 0.03])
    F = [[0, 1 + i, 1 + (i + 1) % 20] for i in range(20)] + [[1 + i, 21 + i, 21 + (i + 1) % 20, 1 + (i + 1) % 20] for i in range(20)]
    UV = np.concatenate([[(0.5, 0.5)], [((math.cos(a) + 1) / 2, (math.sin(a) + 1) / 2) for a in np.linspace(0, 2 * math.pi, 21)[:-1]] * 2])
    parts.append(make_part(name + '_face', V, F, UV, F, np.tile([bi, 0, 0, 0], (len(V), 1)), np.tile([1.0, 0, 0, 0], (len(V), 1)), {**look, 'look': look['look'] + '_face'}))
    return parts


def vest_from_tee(tee: mh.Part, look: dict, thickness=0.26, v_min=0.59, u_max=0.66, open_front=0.0) -> mh.Part:
    keep = [i for i, uv in enumerate(tee.face_uvs) if uv is not None and tee.uvs[uv][:, 1].min() > v_min and tee.uvs[uv][:, 0].max() < u_max]
    if open_front > 0:  # zip open: drop the front strip
        cz = tee.verts[:, 2].mean()
        keep = [i for i in keep if not (abs(tee.verts[tee.faces[i]][:, 0].mean()) < open_front and tee.verts[tee.faces[i]][:, 2].mean() > cz)]
    faces = [tee.faces[i] for i in keep]
    fuv = [tee.face_uvs[i] for i in keep]
    n = vertex_normals(tee.verts, faces)
    # thinner towards the neckline and the shoulders so it reads as a vest, not a neck pillow
    top = tee.verts[:, 1].max()
    t = np.clip((top - tee.verts[:, 1]) / 0.9, 0.25, 1.0)
    v = tee.verts + n * (thickness * t)[:, None]
    p = mh.Part('vest', v, faces, tee.uvs, fuv, tee.skin_idx, tee.skin_w)
    p.spec = {'kind': 'acc', 'name': 'vest', **look}  # type: ignore[attr-defined]
    return p


def scarf(base, sk, clouds, look: dict, radius=0.26, drop=0.35, tail=2.6):
    c = sk['neck01'][0].copy()
    ring = surface_ring([clouds[0]], c + np.array([0, 0.25, 0]), c[1] + 0.5, c[1] - drop, radius * 0.9, band=0.2, min_r=0.4)
    v, f, uv = tube(ring, radius, sides=10, flat=0.75)
    ni, si = bone_index(base, 'neck01'), bone_index(base, 'spine01')
    parts = [make_part('scarf', v, f, uv, f, np.tile([ni, si, 0, 0], (len(v), 1)), np.tile([0.6, 0.4, 0, 0], (len(v), 1)), look)]
    # two hanging ends down the chest, following the front surface
    pts = np.concatenate(clouds)
    for sx in (-1, 1):
        x0 = sx * 0.3
        top = ring[np.argmin(np.abs(ring[:, 0] - x0) + (ring[:, 2] < c[2]) * 10)]
        strip = []
        for k in range(10):
            y = top[1] - k * tail / 9
            sel = pts[(np.abs(pts[:, 1] - y) < 0.15) & (np.abs(pts[:, 0] - x0) < 0.2)]
            z = (sel[:, 2].max() if len(sel) else top[2]) + 0.1
            strip.append(np.array([x0, y, z]))
        strip = np.array(strip)
        w = 0.5
        V, UV = [], []
        for k, pnt in enumerate(strip):
            for s in (-1, 1):
                V.append(pnt + np.array([s * w * 0.5, 0, 0]))
                UV.append(((s + 1) / 2, 1 - k / 9))
            for s in (-1, 1):
                V.append(pnt + np.array([s * w * 0.5, 0, -0.1]))
                UV.append(((s + 1) / 2, 1 - k / 9))
        F = []
        for k in range(9):
            a = k * 4
            b = a + 4
            F += [[a, b, b + 1, a + 1], [a + 3, b + 3, b + 2, a + 2], [a + 1, b + 1, b + 3, a + 3], [a + 2, b + 2, b, a]]
        F.append([0, 1, 3, 2])
        parts.append(make_part(f'scarf_end{"L" if sx > 0 else "R"}', V, F, UV, F, np.tile([si, 0, 0, 0], (len(V), 1)), np.tile([1.0, 0, 0, 0], (len(V), 1)), {**look, 'look': look['look'] + '_end'}))
    return parts


TORSO = {'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder'}


def torso_points(p: mh.Part, base: mh.Base, sk) -> np.ndarray:
    """Vertices whose strongest influence is a torso/neck bone (arms are excluded so rings hug the chest)."""
    from build import game_bone_of
    cache: dict[int, str] = {}
    keep = []
    for i, (idx, w) in enumerate(zip(p.skin_idx, p.skin_w)):
        b = int(idx[int(np.argmax(w))])
        if b not in cache:
            cache[b] = game_bone_of(base.bone_of_index(b), sk)
        if cache[b] in TORSO:
            keep.append(i)
    return p.verts[keep]


def make(R: dict, parts: list[mh.Part], base: mh.Base, sk) -> list[mh.Part]:
    out: list[mh.Part] = []
    body = parts[0]
    by_name = {p.spec['name']: p for p in parts}
    for a in R.get('accessories', []):
        kind = a['type']
        tops = [torso_points(by_name[n], base, sk) for n in a.get('over', []) if n in by_name]
        tops += [torso_points(p, base, sk) for p in out if p.spec['name'] == 'vest']
        clouds = [torso_points(body, base, sk)] + tops
        if kind == 'vest':
            out.append(vest_from_tee(by_name[a['from']], {'look': 'puffer'}, thickness=a.get('thickness', 0.26), open_front=a.get('open_front', 0.0)))
        elif kind == 'chain':
            out += chain(a['name'], base, sk, clouds, drop=a['drop'], offset=a.get('offset', 0.08), radius=a['radius'],
                         look={'look': a['look']}, back_lift=a.get('back_lift', 0.15), pendant=a.get('pendant'))
        elif kind == 'watch':
            out += watch(a['name'], base, sk, body, a.get('side', 'L'), {'look': a['look']})
        elif kind == 'scarf':
            out += scarf(base, sk, clouds, {'look': a['look']})
    return out
