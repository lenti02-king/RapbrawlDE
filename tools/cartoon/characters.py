"""Cartoon (Clash-Royale-like) Jazeek and Bonez MC, modelled in code from metaball "clay" + rigid details.

Skeleton lengths are the game's reference rig (src/render/stylized.ts) so fists and feet still meet the sim's
hitboxes; the cartoon look comes from volumes: big head, heavy brows, big fists, chunky sneakers.
Recognisable traits from the product owner's photos are exaggerated on purpose (caricature).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from kit import Bone, Family, Rigid, chain_ring, merge, torus, uv_sphere, box, elem_distance


def srgb(r, g, b):
    def f(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (f(r), f(g), f(b))


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


@dataclass
class Spec:
    thigh: float
    shin: float
    ankle: float
    hipHalf: float
    torsoLow: float
    torsoHigh: float
    shoulderHalf: float
    neckLen: float
    upperArm: float
    foreArm: float
    hand: float
    arm_angle: float = 38.0  # A-pose, degrees from vertical


JAZEEK = Spec(0.34, 0.33, 0.09, 0.10, 0.20, 0.32, 0.22, 0.05, 0.27, 0.26, 0.12)
BONEZ = Spec(0.40, 0.39, 0.09, 0.11, 0.22, 0.36, 0.26, 0.06, 0.31, 0.30, 0.13)


class Skel:
    def __init__(self, s: Spec):
        self.s = s
        leg = s.thigh + s.shin + s.ankle
        V = lambda *a: np.array(a, float)  # noqa: E731
        self.hips = V(0, 0, leg)
        self.spine = self.hips + V(0, 0, 0.06)
        self.chest = self.spine + V(0, 0, s.torsoLow)
        self.neck = self.chest + V(0, 0, s.torsoHigh)
        self.head = self.neck + V(0, -0.01, s.neckLen)
        a = math.radians(s.arm_angle)
        self.j = {}
        for side, sx in (('L', 1), ('R', -1)):
            sh = self.chest + V(sx * s.shoulderHalf, 0, s.torsoHigh - 0.05)
            d = V(sx * math.sin(a), -0.08, -math.cos(a))
            d /= np.linalg.norm(d)
            el = sh + d * s.upperArm
            wr = el + d * s.foreArm
            tip = wr + d * s.hand
            hip = self.hips + V(sx * s.hipHalf, 0, -0.05)
            kn = hip - V(0, 0, s.thigh)
            an = kn - V(0, 0, s.shin)
            toe = an + V(0, -0.13, -0.05)
            self.j[side] = dict(sh=sh, el=el, wr=wr, tip=tip, dir=d, hip=hip, kn=kn, an=an, toe=toe, clav=self.chest + V(sx * 0.04, 0, s.torsoHigh - 0.05))

    def bones(self) -> list[Bone]:
        t = lambda p: tuple(float(x) for x in p)  # noqa: E731
        b = [
            Bone('Hips', t(self.hips), t(self.spine), None),
            Bone('Spine', t(self.spine), t(self.chest), 'Hips'),
            Bone('Spine2', t(self.chest), t(self.neck), 'Spine'),
            Bone('Neck', t(self.neck), t(self.head), 'Spine2'),
            Bone('Head', t(self.head), t(self.head + np.array([0, 0, 0.28])), 'Neck'),
        ]
        for side, nm in (('L', 'Left'), ('R', 'Right')):
            j = self.j[side]
            b += [
                Bone(f'{nm}Shoulder', t(j['clav']), t(j['sh']), 'Spine2'),
                Bone(f'{nm}Arm', t(j['sh']), t(j['el']), f'{nm}Shoulder'),
                Bone(f'{nm}ForeArm', t(j['el']), t(j['wr']), f'{nm}Arm'),
                Bone(f'{nm}Hand', t(j['wr']), t(j['tip']), f'{nm}ForeArm'),
                Bone(f'{nm}UpLeg', t(j['hip']), t(j['kn']), 'Hips'),
                Bone(f'{nm}Leg', t(j['kn']), t(j['an']), f'{nm}UpLeg'),
                Bone(f'{nm}Foot', t(j['an']), t(j['toe']), f'{nm}Leg'),
                Bone(f'{nm}ToeBase', t(j['toe']), t(j['toe'] + np.array([0, -0.07, 0])), f'{nm}Foot'),
            ]
        return b


# ------------------------------------------------------------------ shared building blocks

def torso(f: Family, k: Skel, w: float, d: float, grow: float = 0.0, pecs=True):
    """Chest + belly + traps. w/d: half width / half depth of the chest."""
    c = k.chest
    f.ball(c + [0, 0, 0.13], 0.16 + grow, 'Spine2', scale=(w / 0.16, d / 0.16, 1.05))
    f.ball(c + [0, 0.0, -0.08], 0.135 + grow, 'Spine', scale=(w * 0.85 / 0.135, d * 0.92 / 0.135, 1.0))
    f.ball(k.spine + [0, 0, 0.02], 0.13 + grow, 'Hips', scale=(w * 0.8 / 0.13, d * 0.9 / 0.13, 0.75))
    f.capsule(k.j['R']['sh'] + [0.03, 0.02, 0.0], k.j['L']['sh'] + [-0.03, 0.02, 0.0], 0.05 + grow, 'Spine2')
    if pecs:
        for sx in (-1, 1):
            f.ball(c + [sx * w * 0.42, -d * 0.62, 0.17], 0.07 + grow, 'Spine2', scale=(1.25, 0.75, 0.9))
    return f


def arm(f: Family, k: Skel, side: str, upper=True, fore=True, r_up=0.058, r_fore=0.05, grow=0.0, upper_frac=1.0):
    j = k.j[side]
    nm = 'Left' if side == 'L' else 'Right'
    if upper:
        f.ball(j['sh'] + [0, 0, 0.01], 0.072 + grow, f'{nm}Arm')
        end = j['sh'] + (j['el'] - j['sh']) * upper_frac
        f.capsule(j['sh'], end, r_up + grow, f'{nm}Arm')
        if upper_frac > 0.7:
            f.ball(j['sh'] + (j['el'] - j['sh']) * 0.5 + [0, -0.025, 0], r_up * 0.85 + grow, f'{nm}Arm')
    if fore:
        f.ball(j['el'] + (j['wr'] - j['el']) * 0.22 + [0, -0.01, 0], r_fore * 1.12 + grow, f'{nm}ForeArm')
        f.capsule(j['el'], j['wr'], r_fore + grow, f'{nm}ForeArm')
    return f


def fist(f: Family, k: Skel, side: str, size=1.0):
    j = k.j[side]
    nm = 'Left' if side == 'L' else 'Right'
    d = j['dir']
    c = j['wr'] + d * 0.065 * size
    f.ball(c, 0.06 * size, f'{nm}Hand', scale=(1.0, 0.95, 1.08))
    # knuckle row facing forward (-Y)
    side_v = np.cross(d, [0, -1.0, 0])
    side_v /= np.linalg.norm(side_v)
    for i in range(4):
        o = (i - 1.5) * 0.024 * size
        f.ball(c + d * 0.035 * size + side_v * o + [0, -0.035 * size, 0], 0.022 * size, f'{nm}Hand')
    f.ball(c - side_v * 0.05 * size * (1 if side == 'L' else -1) + [0, -0.03 * size, 0.0], 0.024 * size, f'{nm}Hand', scale=(1, 1, 1.4))
    return f


def legs(f: Family, k: Skel, r_th=0.085, r_sh=0.072, flare=0.0, grow=0.0, sides=('L', 'R')):
    for side in sides:
        sx = 1 if side == 'L' else -1
        f.ball(k.hips + [sx * 0.07, 0, -0.02], 0.12 + grow, 'Hips', scale=(0.95, 0.95, 0.85))
        j = k.j[side]
        nm = 'Left' if side == 'L' else 'Right'
        f.capsule(j['hip'] + [0, 0, 0.02], j['kn'], r_th + grow, f'{nm}UpLeg')
        f.ball(j['kn'], r_th * 0.9 + grow, f'{nm}Leg')
        f.capsule(j['kn'], j['an'] + [0, 0, 0.07], r_sh + grow, f'{nm}Leg')
        if flare:
            f.ball(j['an'] + [0, 0.0, 0.07], r_sh + flare + grow, f'{nm}Leg', scale=(1, 1, 0.8))
    return f


def shoes(f: Family, sole: Family, k: Skel, scale=1.0):
    for side in ('L', 'R'):
        j = k.j[side]
        nm = 'Left' if side == 'L' else 'Right'
        x = j['an'][0]
        s = scale
        f.ball([x, -0.035 * s, 0.075], 0.07 * s, f'{nm}Foot', scale=(0.82, 1.55, 0.78))
        f.ball([x, -0.13 * s, 0.06], 0.052 * s, f'{nm}ToeBase', scale=(1.0, 1.25, 0.8))
        f.ball([x, 0.055 * s, 0.085], 0.058 * s, f'{nm}Foot')
        f.ball([x, 0.005, 0.15], 0.062 * s, f'{nm}Foot', scale=(1.0, 1.05, 0.85))
        f.ball([x, 0.02, 0.19], 0.05 * s, f'{nm}Leg', scale=(1.05, 1.0, 0.7))
        sole.ball([x, -0.04 * s, 0.024], 0.08 * s, f'{nm}Foot', scale=(0.82, 1.6, 0.28), stiff=4.0)
        sole.ball([x, -0.15 * s, 0.03], 0.045 * s, f'{nm}ToeBase', scale=(1.2, 1.0, 0.45), stiff=4.0)


def eyes(k: Skel, c, sep, r, iris_col, lid_drop=0.0) -> list[Rigid]:
    out = []
    white = srgb(245, 243, 238)
    for sx in (-1, 1):
        e = np.array(c, float) + [sx * sep, 0, 0]
        v, f = uv_sphere(e, r, 20, 12)
        out.append(Rigid(f'eye{sx}', v, f, white, 'Head', rough=0.15))
        front = e + [0, -r * 0.955, -lid_drop * 0.3 - r * 0.05]
        v, f = uv_sphere(front, r * 0.47, 20, 10, scale=(1, 0.26, 1))
        out.append(Rigid(f'iris{sx}', v, f, iris_col, 'Head', rough=0.2))
        v, f = uv_sphere(front + [0, -r * 0.09, 0], r * 0.24, 14, 8, scale=(1, 0.3, 1))
        out.append(Rigid(f'pupil{sx}', v, f, srgb(12, 12, 14), 'Head', rough=0.1))
        v, f = uv_sphere(front + [sx * -r * 0.16, -r * 0.16, r * 0.16], r * 0.1, 10, 6)
        out.append(Rigid(f'glint{sx}', v, f, (2.0, 2.0, 2.0), 'Head', rough=0.1))
    return out


def surface_point(families: list[Family], start, direction, gap):
    """March from inside to just outside the union of the families' positive elements."""
    p = np.array(start, float)
    d = np.asarray(direction, float)
    d /= np.linalg.norm(d)
    elems = [e for f in families for e in f.elems if not e.neg]
    for _ in range(200):
        dist = min(float(elem_distance(e, p[None])[0]) for e in elems)
        if dist > gap:
            return p
        p = p + d * 0.004
    return p


def neck_chain(families, k: Skel, drop, link_r, wire, n=26, lift=0.02, rx=0.115, ry=0.1):
    pts = []
    c = k.neck + [0, 0.0, lift]
    for i in range(n):
        th = 2 * math.pi * i / n
        dirv = np.array([math.sin(th), -math.cos(th), 0.0])
        z = c[2] - drop * (1 + math.cos(th)) / 2 * 1.0
        start = np.array([c[0] + rx * 0.4 * math.sin(th), c[1] - ry * 0.4 * math.cos(th), z])
        pts.append(surface_point(families, start, dirv, wire * 1.6))
    return pts


def lips_paint(center, w, h, lip_col, strength=0.75):
    def paint(v, n, col):
        dx = (v[:, 0] - center[0]) / w
        dz = (v[:, 2] - center[2]) / h
        front = smooth(center[1] + 0.03, center[1] - 0.005, v[:, 1])
        m = smooth(1.0, 0.55, np.sqrt(dx * dx + dz * dz)) * front * strength
        return col * (1 - m[:, None]) + np.asarray(lip_col) * m[:, None]
    return paint


def mouth_paint(a, b, col=None, width=0.0045):
    a, b = np.asarray(a, float), np.asarray(b, float)
    col = col if col is not None else srgb(70, 32, 28)

    def paint(v, n, cc):
        ab = b - a
        t = np.clip(((v - a) @ ab) / (ab @ ab), 0, 1)
        d = np.linalg.norm(v - (a + np.outer(t, ab)), axis=1)
        m = smooth(width * 1.6, width * 0.6, d) * (v[:, 1] < a[1] + 0.02)
        return cc * (1 - m[:, None]) + np.asarray(col) * m[:, None]
    return paint


def chain_paint(*fns):
    def paint(v, n, col):
        for f in fns:
            col = f(v, n, col)
        return col
    return paint


def blush(center, r, col_add, amount=0.15):
    def paint(v, n, col):
        out = col.copy()
        for sx in (-1, 1):
            c = np.array(center) * [sx, 1, 1]
            m = smooth(r, 0, np.linalg.norm(v - c, axis=1)) * amount
            out = out * (1 - m[:, None]) + np.asarray(col_add) * m[:, None]
        return out
    return paint


def top_light(col_top=1.08, col_bottom=0.9, z0=0.0, z1=2.0):
    def paint(v, n, col):
        g = col_bottom + (col_top - col_bottom) * np.clip((v[:, 2] - z0) / (z1 - z0), 0, 1)
        return col * g[:, None]
    return paint


def hair_cap(f: Family, center, radii, ball_r, offset, max_polar, seed, front_cut=0.0, back_fade=1.0, count=160, bone='Head', stiff=2.0):
    """Curls: jittered balls over the top of an ellipsoidal skull."""
    rng = np.random.default_rng(seed)
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(count):
        z = 1 - (i + 0.5) / count * (1 - math.cos(math.radians(max_polar)))
        r = math.sqrt(max(0, 1 - z * z))
        th = golden * i
        x, y = math.cos(th) * r, math.sin(th) * r
        if y < -front_cut and z < 0.75:  # keep the forehead free
            continue
        p = np.array(center) + np.array([x * radii[0], y * radii[1], z * radii[2]])
        nrm = np.array([x / radii[0], y / radii[1], z / radii[2]])
        nrm /= np.linalg.norm(nrm)
        rr = ball_r * rng.uniform(0.75, 1.2)
        f.ball(p + nrm * offset * rng.uniform(0.6, 1.3), rr, bone, stiff=stiff)


# ------------------------------------------------------------------ Jazeek

def jazeek():
    k = Skel(JAZEEK)
    skin_c = srgb(196, 138, 102)
    hc = k.head + [0, 0.01, 0.185]   # cranium centre
    fams: list[Family] = []
    skin = Family('skin', skin_c, rough=0.55, budget=9000)
    # head
    skin.ball(hc, 0.15, 'Head', scale=(1.0, 1.05, 1.1))
    skin.ball(k.head + [0, -0.018, 0.09], 0.118, 'Head', scale=(1.06, 0.9, 0.88))
    skin.ball(k.head + [0, -0.085, 0.045], 0.044, 'Head', scale=(1.3, 0.85, 1.0))
    skin.ball(k.head + [0, -0.152, 0.16], 0.027, 'Head', scale=(0.95, 0.85, 1.3), stiff=3.0)  # nose
    skin.ball(k.head + [0, -0.158, 0.132], 0.019, 'Head', scale=(1.55, 0.8, 0.75), stiff=3.0)
    for sx in (-1, 1):
        skin.ball(k.head + [sx * 0.153, 0.005, 0.175], 0.042, 'Head', scale=(0.45, 0.8, 1.1))  # ears
        skin.ball(k.head + [sx * 0.064, -0.128, 0.226], 0.035, 'Head', scale=(1.2, 0.9, 0.45))  # upper lids (cool, half-open)
        skin.ball(k.head + [sx * 0.088, -0.098, 0.13], 0.043, 'Head', scale=(1.0, 0.8, 0.8))  # cheeks
    skin.capsule(k.neck + [0, 0.0, -0.06], k.head + [0, 0.0, 0.08], 0.068, 'Neck')
    # bare shoulders + arms + fists (tank top)
    torso(skin, k, 0.22, 0.14, grow=-0.006)
    for s in ('L', 'R'):
        arm(skin, k, s, r_up=0.068, r_fore=0.059)
        fist(skin, k, s, 1.3)
    lip = srgb(150, 85, 70)
    skin.paint = chain_paint(lips_paint(k.head + [0, -0.155, 0.09], 0.05, 0.022, lip), mouth_paint(k.head + [-0.04, -0.16, 0.088], k.head + [0.045, -0.157, 0.094]), blush(k.head + [0.085, -0.12, 0.12], 0.05, srgb(190, 110, 90), 0.12),
                             tattoo_paint(k, ('L', 'R'), srgb(40, 45, 55), seed=3, upper=True))
    fams.append(skin)

    tank = Family('tanktop', srgb(242, 240, 233), rough=0.85, budget=3500)
    torso(tank, k, 0.22, 0.14, grow=0.012)
    tank.ball(k.neck + [0, -0.13, -0.03], 0.085, 'Spine2', scale=(1.05, 1.0, 1.35), neg=True)   # deep U neckline
    tank.ball(k.neck + [0, 0.09, 0.0], 0.07, 'Spine2', scale=(1.1, 1, 1), neg=True)
    for sx in (-1, 1):
        tank.ball(k.j['L' if sx > 0 else 'R']['sh'] + [-sx * 0.02, 0.0, -0.05], 0.085, 'Spine2', scale=(0.95, 1.25, 1.35), neg=True)  # armholes
    tank.paint = rib_paint(0.012)
    fams.append(tank)

    for side in ('L', 'R'):
        sx = 1 if side == 'L' else -1
        pants = Family(f'pants{side}', srgb(208, 184, 145), rough=0.9, budget=1900)
        legs(pants, k, r_th=0.096, r_sh=0.08, flare=0.014, sides=(side,))
        pants.ball(k.hips + [sx * 0.075, 0, 0.09], 0.12, 'Hips', scale=(1.0, 0.92, 0.5))  # waistband half
        pants.paint = monogram_paint(srgb(208, 184, 145), srgb(176, 146, 104))
        fams.append(pants)

    shoe = Family('shoes', srgb(246, 246, 244), rough=0.6, budget=1800)
    sole = Family('soles', srgb(214, 212, 205), rough=0.8, budget=900)
    shoes(shoe, sole, k)
    fams += [shoe, sole]

    hair = Family('hair', srgb(46, 34, 28), rough=0.7, budget=4500)
    hair.ball(hc + [0, 0.01, 0.02], 0.152, 'Head', scale=(1.0, 1.04, 1.06))  # tight base under the curls
    hair.ball(hc + [0, -0.05, -0.05], 0.13, 'Head', neg=True, scale=(1.1, 1.0, 0.9))       # hairline / forehead free
    hair.ball(hc + [0, 0.005, 0.1], 0.13, 'Head', scale=(1.05, 1.1, 0.72))  # volume on top
    hair_cap(hair, hc + [0, 0.02, 0.03], (0.15, 0.16, 0.17), 0.044, 0.05, 78, seed=5, front_cut=0.5, count=70, stiff=6.0)
    fams.append(hair)

    brows = Family('brows', srgb(22, 17, 15), rough=0.8)
    for sx in (-1, 1):
        brows.capsule(k.head + [sx * 0.022, -0.158, 0.238], k.head + [sx * 0.104, -0.142, 0.254], 0.014, 'Head')
    beard = Family('beard', srgb(48, 36, 30), rough=0.8)
    for sx in (-1, 1):
        beard.capsule(k.head + [sx * 0.006, -0.17, 0.112], k.head + [sx * 0.046, -0.16, 0.1], 0.0055, 'Head')  # thin moustache
    beard.ball(k.head + [0, -0.128, 0.022], 0.019, 'Head', scale=(1.1, 0.7, 1.2))                              # short chin beard
    fams += [brows, beard]

    rig = eyes(k, k.head + [0, -0.124, 0.19], 0.064, 0.037, srgb(85, 52, 30))
    body = [skin, tank]
    pts = neck_chain(body, k, 0.06, 0.009, 0.0032, n=34)
    v, f = chain_ring(pts, 0.008, 0.0028)
    rig.append(Rigid('chain1', v, f, srgb(222, 224, 230), 'Spine2', rough=0.22, metal=1.0))
    pts2 = neck_chain(body, k, 0.17, 0.011, 0.004, n=40)
    v, f = chain_ring(pts2, 0.0105, 0.0035)
    rig.append(Rigid('chain2', v, f, srgb(222, 224, 230), 'Spine2', rough=0.22, metal=1.0))
    low = min(pts2, key=lambda p: p[2] - (-p[1]) * 0.2)
    v, f = uv_sphere(low + [0, -0.012, -0.035], 0.026, 18, 8, scale=(1, 0.3, 1))
    rig.append(Rigid('medallion', v, f, srgb(225, 228, 235), 'Spine2', rough=0.18, metal=1.0))
    rig += watch(k, 'L', 0.06, srgb(222, 224, 230), srgb(30, 32, 40))
    return k, fams, rig


# ------------------------------------------------------------------ Bonez MC

def bonez():
    k = Skel(BONEZ)
    skin_c = srgb(232, 186, 156)
    hc = k.head + [0, 0.012, 0.2]
    fams: list[Family] = []
    skin = Family('skin', skin_c, rough=0.55, budget=9000)
    skin.ball(hc, 0.142, 'Head', scale=(0.96, 1.04, 1.16))
    skin.ball(k.head + [0, -0.035, 0.075], 0.112, 'Head', scale=(0.98, 0.95, 1.12))   # long jaw
    skin.ball(k.head + [0, -0.103, 0.0], 0.052, 'Head', scale=(1.2, 0.95, 1.05))       # strong chin
    skin.ball(k.head + [0, -0.158, 0.165], 0.03, 'Head', scale=(0.85, 1.05, 1.5), stiff=3.0)  # long nose
    skin.ball(k.head + [0, -0.168, 0.125], 0.019, 'Head', scale=(1.45, 1.0, 0.8), stiff=3.0)
    for sx in (-1, 1):
        skin.ball(k.head + [sx * 0.143, 0.01, 0.18], 0.04, 'Head', scale=(0.45, 0.8, 1.15))
        skin.ball(k.head + [sx * 0.058, -0.122, 0.226], 0.032, 'Head', scale=(1.25, 0.9, 0.5))  # heavy lids
        skin.ball(k.head + [sx * 0.075, -0.112, 0.13], 0.04, 'Head', scale=(1.0, 0.8, 0.9))
    skin.capsule(k.neck + [0, 0.0, -0.06], k.head + [0, 0.0, 0.08], 0.07, 'Neck')
    torso(skin, k, 0.24, 0.15, grow=-0.01, pecs=False)
    for s in ('L', 'R'):
        arm(skin, k, s, upper=True, r_up=0.074, r_fore=0.064)
        fist(skin, k, s, 1.35)
    skin.paint = chain_paint(lips_paint(k.head + [0, -0.15, 0.08], 0.05, 0.02, srgb(196, 120, 105)), mouth_paint(k.head + [-0.045, -0.155, 0.075], k.head + [0.05, -0.153, 0.085]),
                             blush(k.head + [0.08, -0.115, 0.13], 0.05, srgb(230, 140, 120), 0.14),
                             tattoo_paint(k, ('L', 'R'), srgb(35, 40, 55), seed=11, upper=False, hands=True))
    fams.append(skin)

    tee = Family('tee', srgb(30, 30, 33), rough=0.9, budget=3000)
    torso(tee, k, 0.24, 0.15, grow=0.01, pecs=False)
    for s in ('L', 'R'):
        arm(tee, k, s, upper=True, fore=False, r_up=0.074, grow=0.013, upper_frac=0.5)
    tee.ball(k.neck + [0, -0.07, 0.0], 0.06, 'Spine2', neg=True, scale=(1.1, 1.0, 1.0))
    fams.append(tee)

    vest = Family('vest', srgb(14, 14, 16), rough=0.28, budget=5000)
    puffer_rows(vest, k, w=0.27, d=0.178, z0=k.spine[2] - 0.02, z1=k.neck[2] - 0.02, step=0.062, tube=0.034, gap=0.05)
    fams.append(vest)

    scarf = Family('scarf', srgb(26, 26, 30), rough=0.95, budget=1500)
    ring = [k.neck + [0.095 * math.sin(t), -0.085 * math.cos(t) - 0.005, 0.03 - 0.03 * math.cos(t)] for t in np.linspace(0, 2 * math.pi, 18, endpoint=False)]
    for p in ring:
        scarf.ball(p, 0.04, 'Neck')
    for sx in (-1, 1):
        top = k.neck + [sx * 0.055, -0.125, -0.02]
        for i in range(6):
            scarf.ball(top + [sx * 0.004 * i, -0.012 - 0.004 * i, -0.045 * i], 0.034, 'Spine2', scale=(1.25, 0.55, 1.0))
    scarf.paint = scarf_paint(k)
    fams.append(scarf)

    for side in ('L', 'R'):
        sx = 1 if side == 'L' else -1
        pants = Family(f'pants{side}', srgb(26, 26, 28), rough=0.9, budget=1900)
        legs(pants, k, r_th=0.102, r_sh=0.086, flare=0.008, sides=(side,))
        pants.ball(k.hips + [sx * 0.08, 0, 0.09], 0.13, 'Hips', scale=(1.0, 0.92, 0.5))
        fams.append(pants)

    shoe = Family('shoes', srgb(24, 24, 26), rough=0.55, budget=1800)
    sole = Family('soles', srgb(238, 238, 234), rough=0.8, budget=900)
    shoes(shoe, sole, k, 1.08)
    fams += [shoe, sole]

    hair = Family('hair', srgb(124, 94, 62), rough=0.8, budget=3500)
    hair.ball(hc + [0, 0.005, 0.04], 0.14, 'Head', scale=(0.97, 1.05, 1.08))
    hair.ball(hc + [0, -0.06, -0.04], 0.125, 'Head', neg=True, scale=(1.1, 1.0, 0.9))
    hair.ball(hc + [0, 0.0, -0.075], 0.13, 'Head', neg=True, scale=(1.25, 1.2, 0.75))  # very short sides
    hair_cap(hair, hc + [0, 0.012, 0.01], (0.14, 0.152, 0.168), 0.029, 0.02, 50, seed=9, front_cut=0.6, count=80, stiff=4.0)
    fams.append(hair)
    fade = Family('fade', srgb(160, 128, 100), rough=0.9, budget=1200)  # buzzed sides
    fade.ball(hc + [0, 0.01, -0.01], 0.142, 'Head', scale=(0.985, 1.05, 1.1))
    fade.ball(hc + [0, -0.07, -0.02], 0.13, 'Head', neg=True, scale=(1.2, 1.0, 1.0))
    fade.ball(hc + [0, 0.0, -0.17], 0.15, 'Head', neg=True, scale=(1.4, 1.4, 0.8))
    fams.append(fade)

    brows = Family('brows', srgb(92, 70, 48), rough=0.8)
    for sx in (-1, 1):
        brows.capsule(k.head + [sx * 0.02, -0.15, 0.24], k.head + [sx * 0.1, -0.135, 0.244], 0.013, 'Head')
    beard = Family('beard', srgb(104, 78, 54), rough=0.85, budget=1500)
    # short full beard along the jawline: sideburn -> jaw angle -> chin (quadratic Bezier per side)
    for sx in (-1, 1):
        p0 = k.head + np.array([sx * 0.13, 0.0, 0.15])
        p1 = k.head + np.array([sx * 0.125, -0.03, 0.03])
        p2 = k.head + np.array([0, -0.11, 0.0])
        for t in np.linspace(0, 1, 11):
            p = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2
            out = np.array([p[0] - k.head[0], p[1] - k.head[1] + 0.03, 0.0])
            out = out / max(np.linalg.norm(out), 1e-6)
            beard.ball(p + out * 0.016, 0.03 + 0.01 * t, 'Head', scale=(1.0, 0.85, 1.05))
    beard.ball(k.head + [0, -0.12, 0.005], 0.04, 'Head', scale=(1.25, 0.8, 1.0))
    for sx in (-1, 1):
        beard.capsule(k.head + [0, -0.166, 0.105], k.head + [sx * 0.05, -0.152, 0.088], 0.009, 'Head')
    beard.capsule(k.head + [-0.045, -0.155, 0.075], k.head + [0.05, -0.153, 0.085], 0.012, 'Head', neg=True)  # mouth stays visible
    fams += [brows, beard]

    rig = eyes(k, k.head + [0, -0.12, 0.198], 0.058, 0.033, srgb(120, 182, 220), lid_drop=0.004)
    body = [skin, tee, vest]
    pts = neck_chain(body, k, 0.2, 0.014, 0.005, n=34, lift=-0.01)
    v, f = chain_ring(pts, 0.0135, 0.0048)
    gold = srgb(255, 196, 80)
    rig.append(Rigid('goldchain', v, f, gold, 'Spine2', rough=0.25, metal=1.0))
    low = min(pts, key=lambda p: p[2])
    v1, f1 = box(low + [0, -0.012, -0.05], (0.014, 0.012, 0.07))
    v2, f2 = box(low + [0, -0.012, -0.035], (0.045, 0.012, 0.014))
    v, f = merge((v1, f1), (v2, f2))
    rig.append(Rigid('cross', v, f, gold, 'Spine2', rough=0.2, metal=1.0))
    rig += watch(k, 'L', 0.065, gold, srgb(20, 20, 24))
    rig += grin_teeth(k)
    return k, fams, rig


# ------------------------------------------------------------------ details

def puffer_rows(f: Family, k: Skel, w, d, z0, z1, step, tube, gap):
    """Quilted puffer vest: stacked rings of tubes around the torso, open at the front."""
    z = z0
    row = 0
    while z <= z1:
        t = (z - z0) / max(z1 - z0, 1e-6)
        ww = w * (0.86 + 0.18 * math.sin(math.pi * min(1, t * 1.15)))
        dd = d * (0.9 + 0.12 * math.sin(math.pi * t))
        segs = 26
        pts = []
        for i in range(segs + 1):
            a = -math.pi + gap + (2 * math.pi - 2 * gap) * i / segs  # angle 0 = front (-Y); skip the front opening
            pts.append(np.array([ww * math.sin(a), -dd * math.cos(a), z]))
        bone = 'Spine2' if z > k.chest[2] + 0.05 else 'Spine'
        for i in range(segs):
            f.capsule(pts[i], pts[i + 1], tube, bone)
        z += step
        row += 1
    # stand-up collar
    for i in range(14):
        a = -math.pi + gap * 1.4 + (2 * math.pi - 2.8 * gap) * i / 13
        f.ball(k.neck + [0.1 * math.sin(a), -0.09 * math.cos(a), 0.0], 0.03, 'Spine2')


def watch(k: Skel, side, r_band, band_col, face_col) -> list[Rigid]:
    j = k.j[side]
    d = j['dir']
    c = j['wr'] - d * 0.035
    v, f = torus(c, r_band, 0.011, normal=d, seg=24, sides=6)
    out = [Rigid('watchband', v, f, band_col, 'LeftForeArm' if side == 'L' else 'RightForeArm', rough=0.25, metal=1.0)]
    up = np.cross(d, [0, 1.0, 0])
    up /= np.linalg.norm(up)
    if up[2] < 0:
        up = -up
    v, f = uv_sphere(c + up * (r_band + 0.006), 0.022, 16, 8, scale=(1, 1, 0.35))
    out.append(Rigid('watchface', v, f, face_col, 'LeftForeArm' if side == 'L' else 'RightForeArm', rough=0.15, metal=0.4))
    return out


def grin_teeth(k: Skel) -> list[Rigid]:
    """Gold-tooth grin shown on taunts/wins (GlbRig toggles the object named prop_teeth)."""
    c = k.head + [0, -0.158, 0.082]
    parts, cols = [], []
    v, f = uv_sphere(c + [0, 0.004, 0], 0.042, 18, 8, scale=(1.25, 0.25, 0.42))
    parts.append((v, f))
    cols.append(np.tile(srgb(60, 14, 16), (len(v), 1)))
    for i in range(6):
        x = (i - 2.5) * 0.0125
        v, f = box(c + [x, -0.008 + abs(x) * 0.15, 0.007], (0.011, 0.006, 0.013))
        parts.append((v, f))
        cols.append(np.tile(srgb(255, 196, 70) if i in (1, 4) else srgb(245, 242, 232), (len(v), 1)))
    v, f = merge(*parts)
    return [Rigid('prop_teeth', v, f, (1, 1, 1), 'Head', rough=0.25, metal=0.5, hidden_prop=True, colors=np.concatenate(cols))]


def rib_paint(period):
    def paint(v, n, col):
        stripe = 0.94 + 0.06 * np.sin(np.arctan2(v[:, 0], -v[:, 1]) * 2 * math.pi / (period * 6))
        return col * stripe[:, None]
    return paint


def monogram_paint(base, ink):
    """Original all-over pattern: offset diamond lattice (no brand marks)."""
    def paint(v, n, col):
        a = np.arctan2(v[:, 0], -v[:, 1]) * 0.13
        u = (a / 0.045) % 1.0
        w = (v[:, 2] / 0.045 + np.floor(a / 0.045) * 0.5) % 1.0
        dmd = np.abs(u - 0.5) + np.abs(w - 0.5)
        m = (dmd < 0.22).astype(float) * 0.85
        return col * (1 - m[:, None]) + np.asarray(ink) * m[:, None]
    return paint


def scarf_paint(k: Skel):
    def paint(v, n, col):
        hang = v[:, 2] < k.neck[2] - 0.12
        band = (np.abs(((v[:, 2] - k.neck[2]) / 0.03) % 2 - 1) > 0.55) & hang & (v[:, 2] > k.neck[2] - 0.22)
        out = col.copy()
        out[band] = srgb(232, 232, 228)
        return out
    return paint


def tattoo_paint(k: Skel, sides, ink, seed, upper=True, hands=False):
    """Bold cartoon tattoos (stars, bands, a rose-like swirl) by arm-local coordinates."""
    rng = np.random.default_rng(seed)
    designs = []
    for side in sides:
        j = k.j[side]
        segs = [('fore', j['el'], j['wr'])] + ([('up', j['sh'], j['el'])] if upper else [])
        for name, a, b in segs:
            for i in range(3):
                designs.append((a, b, rng.uniform(0.2, 0.85), rng.uniform(-math.pi, math.pi), int(rng.choice([0, 2, 2]))))
        if hands:
            designs.append((j['wr'], j['tip'], 0.45, math.pi, 3))

    def paint(v, n, col):
        out = col.copy()
        for a, b, t, ang, kind in designs:
            ax = b - a
            L = np.linalg.norm(ax)
            ax = ax / L
            c = a + ax * L * t
            rel = v - c
            along = rel @ ax
            u1 = np.cross(ax, [0, 0, 1.0])
            if np.linalg.norm(u1) < 1e-3:
                u1 = np.cross(ax, [1.0, 0, 0])
            u1 /= np.linalg.norm(u1)
            u2 = np.cross(ax, u1)
            th = np.arctan2(rel @ u2, rel @ u1) - ang
            th = (th + math.pi) % (2 * math.pi) - math.pi
            arc = th * 0.055
            if kind == 0:  # star
                r = np.sqrt(along ** 2 + arc ** 2)
                phi = np.arctan2(arc, along)
                star = 0.022 * (0.55 + 0.45 * np.cos(5 * phi))
                m = (r < star) & (np.abs(th) < 1.2)
            elif kind == 1:  # band
                m = np.abs(along) < 0.008
            elif kind == 2:  # swirl
                r = np.sqrt(along ** 2 + arc ** 2)
                phi = np.arctan2(arc, along)
                m = (np.abs(((r / 0.007 - phi / (2 * math.pi)) % 1.0) - 0.5) < 0.18) & (r < 0.03) & (np.abs(th) < 1.2)
            else:  # hand: crown on the back of the hand
                m = (np.abs(arc) < 0.025) & (along > 0.0) & (along < 0.045) & (np.abs(th) < 0.9)
            out[m] = np.asarray(ink)
        return out
    return paint


BUILDERS = {'jazeek': jazeek, 'bonez': bonez}
