"""Generated textures + Blender materials for the fighters (skin detail, beard, tattoos, recoloured clothes).

Everything painted here is original procedural artwork; brand marks on source textures are removed (median filter +
recolour) and no logos or lettering are added.
"""
from __future__ import annotations

import math
import os

import numpy as np
from PIL import Image, ImageDraw

import mh
import texture as tx

SKIN = 2048


# ------------------------------------------------------------------ helpers on the fitted body

def dominant_bones(part: mh.Part, base: mh.Base, sk) -> list[str]:
    from build import game_bone_of
    out = []
    cache: dict[int, str] = {}
    for idx, w in zip(part.skin_idx, part.skin_w):
        k = int(np.argmax(w))
        bi = int(idx[k])
        if bi not in cache:
            cache[bi] = game_bone_of(base.bone_of_index(bi), sk)
        out.append(cache[bi])
    return out


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def beard_field(body: mh.Part, dom: list[str], style: dict) -> np.ndarray:
    v = body.verts
    head = np.array([d in ('Head', 'Neck') for d in dom])
    hv = v[head]
    nose_i = np.argmax(np.where(hv[:, 1] > np.percentile(hv[:, 1], 40), hv[:, 2], -1e9))
    nose = hv[nose_i]
    front = hv[hv[:, 2] > nose[2] - 0.9]
    chin_y = front[:, 1].min()
    face_h = nose[1] - chin_y
    mouth_y = nose[1] - face_h * 0.42
    ear_x = np.percentile(np.abs(hv[:, 0]), 99)
    x, y, z = np.abs(v[:, 0]), v[:, 1], v[:, 2]
    zc = nose[2] - 1.15  # roughly the jaw-angle depth
    f = np.zeros(len(v))
    # lower face: cheeks and jaw line
    cheek_top = mouth_y + face_h * 0.45 - x * 0.35
    lower = smoothstep(cheek_top + 0.05, cheek_top - 0.25, y) * smoothstep(zc - 0.25, zc + 0.15, z) * smoothstep(ear_x * 0.98, ear_x * 0.8, x)
    f = np.maximum(f, lower * style['cheeks'])
    # chin (centre strip down to under the chin)
    chin = smoothstep(mouth_y - face_h * 0.08, mouth_y - face_h * 0.25, y) * smoothstep(0.75, 0.35, x) * smoothstep(zc, zc + 0.5, z)
    f = np.maximum(f, chin * style['chin'])
    # moustache
    mou = smoothstep(nose[1] - face_h * 0.12, nose[1] - face_h * 0.2, y) * smoothstep(mouth_y + face_h * 0.04, mouth_y + face_h * 0.1, y) * smoothstep(0.62, 0.45, x) * smoothstep(nose[2] - 0.6, nose[2] - 0.3, z)
    f = np.maximum(f, mou * style['moustache'])
    # neck under the jaw
    neck = smoothstep(chin_y + 0.1, chin_y - 0.25, y) * smoothstep(chin_y - 0.9, chin_y - 0.5, y) * smoothstep(zc - 0.4, zc + 0.3, z)
    f = np.maximum(f, neck * style['neck'])
    # keep lips clean
    lips = ((x / 0.5) ** 2 + ((y - mouth_y) / (face_h * 0.11)) ** 2) < 1
    f[lips & (z > nose[2] - 0.7)] = 0
    f[~head] = 0
    return f


def arm_coords(body: mh.Part, sk, side: str, seg: str):
    """(s along the bone 0..1, theta/2pi) for a forearm or upper arm."""
    if seg == 'fore':
        a, b = sk[f'lowerarm01.{side}'][0], sk[f'wrist.{side}'][0]
    else:
        a, b = sk[f'upperarm01.{side}'][0], sk[f'lowerarm01.{side}'][0]
    axis = b - a
    L = np.linalg.norm(axis)
    axis /= L
    u1 = np.cross(axis, [0, 1, 0])
    if np.linalg.norm(u1) < 1e-3:
        u1 = np.cross(axis, [0, 0, 1])
    u1 /= np.linalg.norm(u1)
    u2 = np.cross(axis, u1)
    d = body.verts - a
    s = d @ axis / L
    th = np.arctan2(d @ u2, d @ u1) / (2 * math.pi) % 1.0
    if side == 'R':
        th = 1 - th
    return s, th


def hand_coords(body: mh.Part, sk, side: str):
    W = sk[f'wrist.{side}'][0]
    I, P, Md = sk[f'finger2-1.{side}'][0], sk[f'finger5-1.{side}'][0], sk[f'finger3-1.{side}'][0]
    n = np.cross(I - P, Md - W)
    n /= np.linalg.norm(n)
    if np.dot(n, sk[f'finger1-3.{side}'][1] - (I + P + Md) / 3) < 0:
        n = -n
    ax = Md - W
    L = np.linalg.norm(ax)
    ax /= L
    across = np.cross(n, ax)
    d = body.verts - W
    a = d @ ax / L
    b = d @ across / np.linalg.norm(P - I) * 0.9 + 0.5
    back = (d @ n) < 0.05
    return a, b, back


# ------------------------------------------------------------------ original tattoo artwork

def tattoo_sheet(w: int, h: int, seed: int, dense: bool) -> np.ndarray:
    """Ink coverage in [0,1] (1 = ink). Roses, stars, crowns, notes, ornamental bands. No lettering."""
    rng = np.random.default_rng(seed)
    im = Image.new('L', (w, h), 0)
    g = ImageDraw.Draw(im)
    lw = max(2, w // 220)

    def rose(cx, cy, r):
        for k in range(5, 0, -1):
            rr = r * k / 5
            g.arc([cx - rr, cy - rr * 0.9, cx + rr, cy + rr * 0.9], start=rng.uniform(0, 360), end=rng.uniform(200, 340) + 360, fill=255, width=lw)
        for k in range(3):
            a = rng.uniform(0, 2 * math.pi)
            lx, ly = cx + math.cos(a) * r * 1.6, cy + math.sin(a) * r * 1.2
            g.polygon([(cx + math.cos(a) * r, cy + math.sin(a) * r * 0.9), (lx, ly - r * 0.3), (lx + r * 0.4, ly)], outline=255, width=lw)

    def star(cx, cy, r, fill=False):
        pts = []
        for k in range(10):
            a = -math.pi / 2 + k * math.pi / 5
            rr = r if k % 2 == 0 else r * 0.45
            pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
        g.polygon(pts, outline=255, fill=180 if fill else None, width=lw)

    def crown(cx, cy, r):
        pts = [(cx - r, cy + r * 0.5), (cx - r, cy - r * 0.2), (cx - r * 0.5, cy + r * 0.15), (cx, cy - r * 0.6),
               (cx + r * 0.5, cy + r * 0.15), (cx + r, cy - r * 0.2), (cx + r, cy + r * 0.5)]
        g.polygon(pts, outline=255, width=lw)
        g.line([(cx - r, cy + r * 0.75), (cx + r, cy + r * 0.75)], fill=255, width=lw)

    def note(cx, cy, r):
        g.ellipse([cx - r * 0.45, cy + r * 0.4, cx + r * 0.25, cy + r * 0.9], fill=230)
        g.line([(cx + r * 0.22, cy + r * 0.6), (cx + r * 0.22, cy - r * 0.8)], fill=255, width=lw)
        g.line([(cx + r * 0.22, cy - r * 0.8), (cx + r * 0.7, cy - r * 0.4)], fill=255, width=lw)

    def band(y, hh):
        g.line([(0, y), (w, y)], fill=255, width=lw)
        g.line([(0, y + hh), (w, y + hh)], fill=255, width=lw)
        step = hh * 1.2
        x = 0.0
        while x < w:
            g.polygon([(x, y + hh / 2), (x + step / 2, y + 2), (x + step, y + hh / 2), (x + step / 2, y + hh - 2)], outline=255, width=lw)
            x += step

    motifs = [rose, star, crown, note]
    n = 9 if dense else 4
    for i in range(n):
        m = motifs[i % len(motifs)] if dense else motifs[int(rng.integers(0, len(motifs)))]
        cx = rng.uniform(0.1, 0.9) * w
        cy = (i + 0.5) / n * h * 0.85 + h * 0.05
        m(cx, cy, rng.uniform(0.07, 0.12) * w)
    if dense:
        band(h * 0.03, h * 0.035)
    a = np.asarray(im, np.float32) / 255
    return a


# ------------------------------------------------------------------ skin

def skin_maps(char: str, R: dict, body: mh.Part, base: mh.Base, sk, tmp: str):
    acc = None
    for name, w in R['skin']['blend'].items():
        t = tx.load_rgb(mh.skin_texture(name), SKIN) * w
        acc = t if acc is None else acc + t
    col = acc * np.array(R['skin']['tint'], np.float32)
    # the source skins are 512 px: sharpen the upscale a little so features stay crisp
    col = np.clip(col + (col - tx.blur(col, 2.0)) * 0.6, 0, 1)
    # micro detail: pores + mottling
    pores = tx.fbm(SKIN, 11, octaves=3, base=256)
    mott = tx.fbm(SKIN, 12, octaves=4, base=16)
    col *= (0.96 + 0.08 * pores)[..., None] * (0.97 + 0.06 * mott)[..., None]

    tri_v, tri_uv = tx.triangles(body.faces, body.face_uvs)
    dom = dominant_bones(body, base, sk)

    # beard / stubble
    bf = beard_field(body, dom, R['beard'])
    bm = tx.raster(SKIN, tri_v, tri_uv, body.uvs, bf[:, None])[..., 0]
    bm = np.nan_to_num(bm)
    bm = tx.blur(bm[..., None].repeat(3, -1), 4)[..., 0]
    fine = tx.fbm(SKIN, 21, octaves=2, base=1024)
    clump = tx.fbm(SKIN, 22, octaves=3, base=96)
    hair = np.clip((fine - 0.35) * 2.2, 0, 1) * (0.75 + 0.5 * clump)
    full = R['beard']['length']  # 0 = stubble, 1 = full short beard
    dens = np.clip(bm * (full * 0.75 + (1 - full * 0.75) * hair), 0, 1)
    bc = np.array(R['beard']['color'], np.float32)
    shade = (0.8 + 0.4 * fine)[..., None]
    col = col * (1 - dens[..., None] * 0.9) + bc * shade * dens[..., None] * 0.9

    # tattoos
    ink = np.zeros((SKIN, SKIN), np.float32)
    tat = R['tattoos']
    for side in ('L', 'R'):
        for seg, on in (('fore', tat['forearms']), ('upper', tat['upperarms'])):
            if not on:
                continue
            bone = ('Left' if side == 'L' else 'Right') + ('ForeArm' if seg == 'fore' else 'Arm')
            s, th = arm_coords(body, sk, side, seg)
            sel = np.array([d == bone for d in dom]) & (s > 0.02) & (s < 0.95)
            vals = np.stack([np.where(sel, s, np.nan), th, np.where(sel, 1.0, 0.0)], -1)
            m = tx.raster(SKIN, tri_v, tri_uv, body.uvs, vals, pad=1)
            sheet = tattoo_sheet(1024, 1024, tat['seed'] + (0 if side == 'L' else 50) + (0 if seg == 'fore' else 100), dense=True)
            ok = ~np.isnan(m[..., 0]) & (m[..., 2] > 0.99)
            ss = np.clip(np.nan_to_num(m[..., 0]), 0, 0.999)
            tt = np.clip(np.nan_to_num(m[..., 1]), 0, 0.999)
            samp = sheet[(ss * 1023).astype(int), (tt * 1023).astype(int)]
            ink = np.maximum(ink, np.where(ok, samp, 0))
        if tat['hands']:
            a, b, back = hand_coords(body, sk, side)
            bone = ('Left' if side == 'L' else 'Right') + 'Hand'
            sel = np.array([d == bone for d in dom]) & back & (a > 0.05) & (a < 0.95) & (b > 0) & (b < 1)
            vals = np.stack([np.where(sel, a, np.nan), b, np.where(sel, 1.0, 0.0)], -1)
            m = tx.raster(SKIN, tri_v, tri_uv, body.uvs, vals, pad=1)
            sheet = tattoo_sheet(512, 512, tat['seed'] + 7 + (0 if side == 'L' else 3), dense=False)
            ok = ~np.isnan(m[..., 0]) & (m[..., 2] > 0.99)
            aa = np.clip(np.nan_to_num(m[..., 0]), 0, 0.999)
            bb = np.clip(np.nan_to_num(m[..., 1]), 0, 0.999)
            ink = np.maximum(ink, np.where(ok, sheet[(aa * 511).astype(int), (bb * 511).astype(int)], 0))
    ink = tx.blur(ink[..., None].repeat(3, -1), 0.8)[..., 0]
    inkc = np.array([0.08, 0.09, 0.11], np.float32)
    col = col * (1 - ink[..., None] * 0.78) + inkc * ink[..., None] * 0.78

    cpath = os.path.join(tmp, 'skin.jpg')
    tx.save(col, cpath, quality=90)
    # normal: pores + soft relief from the albedo
    h = 0.5 * pores + 0.5 * tx.blur(tx.luminance(col)[..., None].repeat(3, -1), 1.5)[..., 0] + 0.25 * dens
    npath = os.path.join(tmp, 'skin_n.jpg')
    tx.save(tx.normal_from_height(h, 1.4), npath, quality=88)
    return cpath, npath


# ------------------------------------------------------------------ clothes and hair

def monogram(size: int, base_col, ink_col) -> np.ndarray:
    """Original all-over pattern (diamond lattice with four-petal flowers). Not any brand's monogram."""
    im = Image.new('RGB', (size, size), tuple(int(c * 255) for c in base_col))
    g = ImageDraw.Draw(im)
    ic = tuple(int(c * 255) for c in ink_col)
    step = size // 40
    for j in range(41):
        for i in range(41):
            cx = i * step + (step // 2 if j % 2 else 0)
            cy = j * step
            r = step * 0.28
            if (i + j) % 2 == 0:
                for a in range(4):
                    ang = a * math.pi / 2 + math.pi / 4
                    px, py = cx + math.cos(ang) * r * 0.55, cy + math.sin(ang) * r * 0.55
                    g.ellipse([px - r * 0.4, py - r * 0.4, px + r * 0.4, py + r * 0.4], fill=ic)
            else:
                g.polygon([(cx, cy - r), (cx + r * 0.7, cy), (cx, cy + r), (cx - r * 0.7, cy)], outline=ic, width=max(1, size // 512))
    return np.asarray(im, np.float32) / 255


def cloth_maps(spec: dict, R: dict, p: mh.Part, tmp: str):
    name = spec['name']
    mat = p.material
    src = os.path.join(p.tex_dir, mat['mapDiffuse']) if mat.get('mapDiffuse') else None
    nsrc = os.path.join(p.tex_dir, mat['mapNormal']) if mat.get('mapNormal') else None
    size = 1024
    outfit = R['outfit']
    alpha = None
    col = None
    if src:
        rgba = tx.load_rgba(src, size)
        col, alpha = rgba[..., :3], rgba[..., 3]
    if name == 'male_casualsuit04':
        v = 1 - (np.arange(size) + 0.5) / size
        top = (v > 0.59)[:, None].repeat(size, 1)
        if outfit.get('top') == 'black_tee':
            fabric = tx.fbm(size, 31, octaves=3, base=128)
            shade = tx.median(col, 9)
            lum = tx.luminance(shade)
            tee = (0.03 + 0.03 * fabric + 0.05 * np.clip(lum - lum.mean(), -0.3, 0.3))[..., None] * np.array([1, 1, 1.08], np.float32)
            col = np.where(top[..., None], tee, col)
        pants = outfit.get('pants')
        if pants == 'black_jeans':
            jeans = tx.recolor(col, (0.075, 0.075, 0.085), contrast=1.3)
            col = np.where(top[..., None], col, jeans)
        elif pants == 'beige_monogram':
            jeans = tx.recolor(col, (0.80, 0.70, 0.55), contrast=0.6)
            mono = monogram(size, (1, 1, 1), (0.86, 0.8, 0.7))
            col = np.where(top[..., None], col, jeans * mono)
    elif name == 'Tank_Top_01':
        ribs = 0.5 + 0.5 * np.sin(np.arange(size) * 2 * math.pi / 5.0)[None, :].repeat(size, 0)
        col = (0.9 + 0.04 * ribs)[..., None] * np.array([1, 1, 0.985], np.float32)
        col = col * (0.97 + 0.05 * tx.fbm(size, 41, octaves=3, base=64))[..., None]
    elif name.startswith('shoes'):
        clean = tx.median(col, 15)
        if outfit.get('shoes') == 'black':
            col = tx.recolor(clean, (0.06, 0.06, 0.065), contrast=1.2)
        else:
            col = tx.recolor(clean, (0.9, 0.9, 0.88), contrast=0.5)
    elif spec['kind'] in ('hair', 'eyebrows', 'eyelashes'):
        hc = {'hair': R['hair_color'], 'eyebrows': R.get('brow_color', R['hair_color']), 'eyelashes': (0.05, 0.04, 0.04)}[spec['kind']]
        col = tx.recolor(col, hc, contrast=1.2, mask=None if alpha is None else alpha > 0.5)
    elif spec['kind'] == 'eyes':
        col = tx.load_rgb(os.path.join(p.tex_dir, 'textures', R['eye_texture']), size)
    cpath = os.path.join(tmp, f'{name}.png' if alpha is not None and spec['kind'] in ('hair', 'eyebrows', 'eyelashes') else f'{name}.jpg')
    if cpath.endswith('.png'):
        tx.save(np.concatenate([col, alpha[..., None]], -1), cpath)
    else:
        tx.save(col, cpath, quality=88)
    npath = None
    if nsrc:
        n = tx.load_rgb(nsrc, size)
        if name == 'Tank_Top_01':
            ribs_h = 0.5 + 0.5 * np.sin(np.arange(size) * 2 * math.pi / 5.0)[None, :].repeat(size, 0)
            rn = tx.normal_from_height(ribs_h, 0.6)
            n = np.clip((n - 0.5) + (rn - 0.5) + 0.5, 0, 1)
            n[..., 2] = np.clip(n[..., 2] + 0.25, 0, 1)
        npath = os.path.join(tmp, f'{name}_n.jpg')
        tx.save(n, npath, quality=88)
    return cpath, npath


# ------------------------------------------------------------------ Blender materials

def principled(name: str, color_path: str | None, normal_path: str | None, rough: float, alpha: bool = False,
               normal_strength: float = 1.0, metal: float = 0.0):
    import bpy
    m = bpy.data.materials.new(('cut_' if alpha else '') + name)
    m.use_nodes = True
    m.use_backface_culling = not alpha  # glTF doubleSided only for hair cards
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if color_path:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(color_path)
        nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
        if alpha:
            nt.links.new(t.outputs['Alpha'], bsdf.inputs['Alpha'])
            if hasattr(m, 'blend_method'):
                m.blend_method = 'CLIP'
    if normal_path:
        t2 = nt.nodes.new('ShaderNodeTexImage')
        t2.image = bpy.data.images.load(normal_path)
        t2.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = normal_strength
        nt.links.new(t2.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def make(char: str, R: dict, parts: list[mh.Part], base: mh.Base, sk, tmp: str):
    out = {}
    for p in parts:
        spec = p.spec
        kind, name = spec['kind'], spec['name']
        if kind == 'acc':
            out[name] = acc_material(spec, tmp)
        elif kind == 'body':
            c, n = skin_maps(char, R, p, base, sk, tmp)
            out[name] = principled('skin', c, n, 0.5, normal_strength=0.45)
        else:
            c, n = cloth_maps(spec, R, p, tmp)
            alpha = kind in ('hair', 'eyebrows', 'eyelashes')
            rough = {'eyes': 0.08, 'hair': 0.55}.get(kind, 0.8)
            out[name] = principled(name.lower(), c, n, rough, alpha=alpha)
    return out


# ------------------------------------------------------------------ accessories

def _links(w: int, h: int, n: int, angle: float) -> np.ndarray:
    """Height field of chain links along u (n links per tile), alternating tilt."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    out = np.zeros((h, w), np.float32)
    for k in range(n):
        cx = (k + 0.5) * w / n
        a = angle if k % 2 else -angle
        dx, dy = xx - cx, yy - h / 2
        rx = dx * math.cos(a) + dy * math.sin(a)
        ry = -dx * math.sin(a) + dy * math.cos(a)
        r = np.sqrt((rx / (w / n * 0.62)) ** 2 + (ry / (h * 0.62)) ** 2)
        ring = np.clip(1 - np.abs(r - 0.72) / 0.28, 0, 1)
        out = np.maximum(out, ring)
    return out


def acc_material(spec: dict, tmp: str):
    look = spec['look']
    name = spec['name']
    if look == 'puffer':
        size = 1024
        v = (np.arange(size) + 0.5) / size
        rows = np.abs(np.sin(v * math.pi * 26)) ** 0.45
        h = rows[:, None].repeat(size, 1) * (0.92 + 0.08 * tx.fbm(size, 51, octaves=3, base=32))
        col = (0.025 + 0.025 * h)[..., None] * np.array([1, 1, 1.1], np.float32)
        c, n = os.path.join(tmp, 'vest.jpg'), os.path.join(tmp, 'vest_n.jpg')
        tx.save(col, c)
        tx.save(tx.normal_from_height(h, 5.0), n)
        return principled('vest', c, n, 0.3, normal_strength=1.0)
    if look.startswith('knit'):
        w, hgt = 512, 256
        yy, xx = np.mgrid[0:hgt, 0:w].astype(np.float32)
        knit = np.abs(((xx / 8) % 2) - 1) * 0.5 + np.abs(((yy / 6 + np.abs(((xx / 8) % 2) - 1) * 2) % 2) - 1) * 0.5
        col = np.full((hgt, w, 3), 0.045, np.float32) * (0.8 + 0.4 * knit)[..., None]
        c, n = os.path.join(tmp, f'{name}.jpg'), os.path.join(tmp, f'{name}_n.jpg')
        tx.save(col, c)
        tx.save(tx.normal_from_height(knit, 2.0), n)
        return principled(name, c, n, 0.9, normal_strength=0.8)
    metal = {'gold': (1.0, 0.76, 0.33), 'silver': (0.93, 0.93, 0.95)}['gold' if look.startswith('gold') else 'silver']
    if look.endswith('_face'):
        size = 256
        yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
        r = np.sqrt((xx - size / 2) ** 2 + (yy - size / 2) ** 2) / (size / 2)
        col = np.zeros((size, size, 3), np.float32) + 0.04
        col[r > 0.82] = metal
        ang = np.arctan2(yy - size / 2, xx - size / 2)
        ticks = (np.abs(((ang / (2 * math.pi) * 12) % 1) - 0.5) > 0.46) & (r > 0.62) & (r < 0.78)
        col[ticks] = metal
        c = os.path.join(tmp, f'{name}.jpg')
        tx.save(col, c)
        return principled(name, c, None, 0.25, metal=0.6)
    if 'cuban' in look or 'rope' in look:
        w, hgt = 256, 64
        hf = _links(w, hgt, 2 if 'cuban' in look else 4, 0.55 if 'cuban' in look else 0.9)
        col = np.ones((hgt, w, 3), np.float32) * np.array(metal, np.float32) * (0.45 + 0.55 * hf)[..., None]
        c, n = os.path.join(tmp, f'{name}.jpg'), os.path.join(tmp, f'{name}_n.jpg')
        tx.save(col, c)
        tx.save(tx.normal_from_height(hf, 3.0), n)
        return principled(name, c, n, 0.22, metal=1.0, normal_strength=1.0)
    c = os.path.join(tmp, f'{name}.jpg')
    tx.save(np.ones((8, 8, 3), np.float32) * np.array(metal, np.float32), c)
    return principled(name, c, None, 0.24, metal=1.0)
