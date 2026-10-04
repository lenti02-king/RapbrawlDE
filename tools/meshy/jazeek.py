"""Jazeek from the Meshy sculpt 'Diamond Confidence': region rules + palette.

Coordinates: metres, feet on z=0, faces -Y, character's left = +X. Height 1.898 m.
Look: off-white "diamond" puffer jacket with hood, black tee, iced-out silver cuban chain with pendant,
mid-blue denim, white sneakers, dark curls, full short beard, dark brown eyes.
"""
from __future__ import annotations

import numpy as np

from lib import ellipsoid, fbm, in_poly2, poly_dist, smoothstep, srgb, vnoise

ID = 'jazeek'
SRC = 'jazeek_src.glb'
HEIGHT = 1.898

PALETTE = {
    'skin': '#8c5c42',
    'skin_warm': '#a8604a',
    'skin_shadow': '#6e4230',
    'lips': '#7a4436',
    'hair': '#1b130e',
    'hair_hi': '#3b2a1f',
    'beard': '#1d1510',
    'brow': '#1a120c',
    'sclera': '#d8cdc2',
    'iris': '#3a2416',
    'pupil': '#0a0807',
    'jacket': '#eceae6',
    'jacket_shade': '#c9ccd3',
    'lining': '#2a2c33',
    'tee': '#18181b',
    'chain': '#e7edf5',
    'denim': '#4d6e9a',
    'denim_light': '#7d9cc2',
    'shoe': '#f2f2f0',
    'sole': '#d4d2cd',
    'lace': '#e6e4e0',
}

# landmarks (see tools/meshy/README.md for how they were measured)
EYES = [(-0.036, 1.754), (0.036, 1.754)]  # x, z of the eye centres
EYE_R = (0.0125, 0.0046)  # half width, half height of the eye opening
MOUTH = (0.0, 1.684)
PALM = {'L': (-1.0, 0.0, 0.0), 'R': (1.0, 0.0, 0.0)}  # palm normal hints (hands hang at the sides, palms in)
HEAD_PITCH = -4  # deg, offsets the stance's chin-up attitude for realistic proportions
JOINTS = dict(
    hips=(0.02, 0.93, 0.0), spine=(1.04, -0.01), chest=(1.26, -0.02), neck=(1.55, -0.005), head=(1.665, -0.015), head_top=1.9,
    sh=(0.185, 1.465), el=(0.325, 1.215), wr=(0.449, 0.975), tip=(0.49, 0.80),
    hipL=(0.11, 0.93), hipR=(-0.07, 0.93), knL=(0.145, 0.50), knR=(-0.097, 0.50), anL=(0.2, 0.10), anR=(-0.123, 0.10),
)


def shirt_front(z):
    return np.interp(z, [0.95, 1.0, 1.2, 1.4, 1.5, 1.6], [-0.155, -0.152, -0.142, -0.142, -0.10, -0.07])


CHAIN_V = [(-0.068, 1.615), (-0.05, 1.56), (-0.026, 1.505), (-0.006, 1.474), (0.018, 1.505), (0.044, 1.56), (0.064, 1.615)]


def paint(g, detail):
    v = g.v
    n = g.nrm
    x, y, z = v[:, 0], v[:, 1], v[:, 2]
    N = len(v)
    C = lambda k: srgb(PALETTE[k])  # noqa: E731
    col = np.tile(C('jacket'), (N, 1))
    rough = np.full(N, 0.55)
    metal = np.zeros(N)
    lab = np.full(N, 'jacket', dtype=object)

    det = detail / np.percentile(detail, 95)
    noise = fbm(v, 9.0, 3)

    # ---------------------------------------------------------------- masks
    neck_r = np.sqrt((x / 0.075) ** 2 + ((y + 0.01) / 0.078) ** 2)
    under_chin = (z > 1.59) & (y < -0.03) & (y > -0.17) & (np.abs(x) < 0.075)
    head = (z > 1.665) | ((z > 1.6) & under_chin)
    neck = (z > 1.49) & ~head & (neck_r < 1.0) & (y < 0.055)
    arm = np.abs(x) > 0.33
    hand = arm & (z < 0.935)
    legs = z < 0.94
    shoes = z < 0.135
    opening = (np.abs(x + 0.015) < 0.115) & (z > 0.94) & (z < 1.6)
    tee = opening & (y > shirt_front(z) - 0.012) & (n[:, 1] < 0.2) & ~neck
    # chain: V across the chest + pendant + ring around the neck
    dchain = poly_dist(np.c_[x, np.zeros(N), z], [(a, 0, b) for a, b in CHAIN_V])
    pend = (np.abs(x + 0.005) < 0.03) & (z > 1.39) & (z < 1.478) & (y < shirt_front(z) - 0.004)
    chain_front = (dchain < 0.016) & (y < shirt_front(z) + 0.004) & (y < -0.04)
    ring = (z > 1.58) & (z < 1.645) & (neck_r > 0.85) & (neck_r < 1.3) & (det > 0.5) & (y < 0.04)
    chain = (chain_front | pend | ring) & ~head
    # face / hair: hairline rises toward the front, nape at the back
    theta = np.abs(np.arctan2(x, -(y + 0.005)))
    hairline = 1.786 - 0.05 * smoothstep(0.45, 1.25, theta) - 0.075 * smoothstep(1.7, 2.6, theta)
    # curls also hang below the hairline at the temples/sides: anything outside the skull there is hair
    skull = ellipsoid(v, (0, 0.0, 1.765), (0.079, 0.1, 0.12))
    curls = (z > 1.715) & (skull > 1.06) & (det > 0.42) & ~((y < -0.085) & (np.abs(x) < 0.062) & (z < 1.79))
    hair = head & ((z > hairline) | curls)
    face = head & ~hair
    # beard: jaw band from ear to ear under the mouth + moustache, density from the sculpted stubble
    jaw_top = np.interp(np.abs(x), [0.0, 0.022, 0.04, 0.065, 0.09], [1.668, 1.672, 1.70, 1.735, 1.75])
    beard_zone = (z < jaw_top) & (z > 1.6) & (y < 0.03)
    moustache = (np.abs(x) < 0.03) & (z > 1.697) & (z < 1.708) & (y < -0.1)
    lips = ellipsoid(np.c_[x, z], (MOUTH[0], MOUTH[1]), (0.026, 0.0085)) < 1.0
    beard_amt = np.clip(g.smooth(((beard_zone | moustache) & ~lips) * 1.0, 5) * (0.55 + 0.6 * smoothstep(0.25, 0.8, det)), 0, 1)

    # ---------------------------------------------------------------- base colours
    # jacket: off-white with cool shading in the quilting valleys and a dark lining at the edges
    jk = C('jacket') * (0.92 + 0.08 * noise[:, None])
    valley = smoothstep(0.2, 0.9, det)
    jk = jk * (1 - 0.18 * valley[:, None]) + C('jacket_shade') * 0.18 * valley[:, None]
    col[:] = jk
    rough[:] = 0.42  # slightly glossy nylon

    col[tee] = C('tee') * (0.9 + 0.2 * noise[tee, None])
    rough[tee] = 0.85
    lab[tee] = 'tee'

    # jeans + shoes
    jl = legs & ~hand
    wash = smoothstep(0.35, 0.75, vnoise(v[jl] * [1, 1, 0.5], 6.0, 3)) * 0.35 + smoothstep(0.42, 0.52, z[jl]) * (1 - smoothstep(0.52, 0.62, z[jl])) * 0.3
    col[jl] = C('denim') * (1 - wash[:, None]) + C('denim_light') * wash[:, None]
    col[jl] *= (0.92 + 0.12 * fbm(v[jl], 60.0, 2)[:, None])
    rough[jl] = 0.9
    lab[jl] = 'denim'
    col[shoes] = C('shoe')
    rough[shoes] = 0.5
    sole = shoes & (z < 0.035)
    col[sole] = C('sole')
    rough[sole] = 0.8
    lab[shoes] = 'shoe'

    # skin: hands, neck, face
    def skin(mask):
        s = C('skin') * (0.94 + 0.12 * fbm(v[mask], 40.0, 3)[:, None])
        return s

    for m in (hand, neck, face):
        col[m] = skin(m)
        rough[m] = 0.55
        lab[m] = 'skin'
    # warm cheeks / nose, shadowed under the jaw
    w = (1 - smoothstep(0.4, 1.0, ellipsoid(np.c_[np.abs(x), z], (0.045, 1.725), (0.032, 0.026)))) * 0.2 * face
    col = col * (1 - w[:, None]) + C('skin_warm') * w[:, None]
    col[neck] *= 0.92
    col[lips] = col[lips] * 0.3 + C('lips') * 0.7
    rough[lips] = 0.4

    # hair: dark curls, lighter on the curl tips (high detail)
    hcol = C('hair') * (1 - 0.5 * smoothstep(0.4, 1.2, det[hair, None])) + C('hair_hi') * 0.5 * smoothstep(0.4, 1.2, det[hair, None])
    col[hair] = hcol
    rough[hair] = 0.75
    lab[hair] = 'hair'
    b = beard_amt[:, None]
    col = col * (1 - b) + C('beard') * b
    lab[beard_amt > 0.5] = 'beard'

    # eyes: sclera, iris, pupil, lash line; brows above
    for ex, ez in EYES:
        e = ellipsoid(np.c_[x, z], (ex, ez), EYE_R)
        front = (y < -0.08) & face
        eye = front & (e < 1.0)
        col[eye] = C('sclera')
        ir = front & (ellipsoid(np.c_[x, z], (ex + np.sign(-ex) * 0.0008, ez - 0.0006), (0.0064, 0.0064)) < 1.0) & eye
        col[ir] = C('iris')
        pu = front & (ellipsoid(np.c_[x, z], (ex + np.sign(-ex) * 0.0008, ez - 0.0008), (0.0024, 0.0024)) < 1.0) & eye
        col[pu] = C('pupil')
        rough[eye] = 0.15
        # upper lid casts a soft shadow over the top of the eye
        lid = eye & (z > ez + 0.0012)
        col[lid] *= 0.55
        lash = front & (e >= 1.0) & (e < 1.25) & (z > ez - 0.004)
        col[lash] = col[lash] * 0.25 + C('brow') * 0.75
        brow_z = ez + 0.017 + 0.004 * (1 - np.clip(np.abs(x - ex) / 0.02, 0, 1))
        brow = front & (np.abs(z - brow_z) < 0.0045) & (np.abs(x - ex) < 0.021)
        col[brow] = col[brow] * 0.2 + C('brow') * 0.8
        lab[eye] = 'eye'

    # chain: polished silver
    col[chain] = C('chain') * (0.85 + 0.25 * smoothstep(0.2, 1.0, det[chain, None]))
    rough[chain] = 0.18
    metal[chain] = 1.0
    lab[chain] = 'chain'
    return col, rough, metal, lab
