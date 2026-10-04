"""Bonez MC from the Meshy sculpt 'Golden Hour Stare': region rules + palette.

Coordinates: metres, feet on z=0, faces -Y, character's left = +X. Height 1.901 m.
Look: camel quilted vest with stand-up collar, black tee, gold chain, charcoal cargo pants, dark leather boots,
curly top with a short fade, stubble, light-blue eyes, ink on the forearms (original abstract designs).
"""
from __future__ import annotations

import numpy as np

from lib import ellipsoid, fbm, smoothstep, srgb, vnoise

ID = 'bonez'
SRC = 'bonez_src.glb'
HEIGHT = 1.901

PALETTE = {
    'skin': '#c88e6c',
    'skin_warm': '#c97462',
    'lips': '#b06f66',
    'hair': '#2a1d15',
    'hair_hi': '#4a3526',
    'stubble': '#3b2a20',
    'brow': '#2b1e16',
    'sclera': '#ddd6cf',
    'iris': '#7499b5',
    'iris_ring': '#2f4a63',
    'pupil': '#0a0b0d',
    'vest': '#a47c4c',
    'vest_shade': '#6e5130',
    'tee': '#161618',
    'chain': '#e9b957',
    'cargo': '#2a2b2f',
    'boot': '#2b221c',
    'sole': '#7a5a3b',
    'ink': '#232b3a',
}

EYES = [(-0.036, 1.737), (0.031, 1.741)]
EYE_R = (0.0125, 0.0046)
MOUTH = (0.002, 1.662)
PALM = {'L': (-0.2, -0.4, 0.9), 'R': (0.2, -0.4, 0.9)}  # palm normal hints (open palms up)
HEAD_PITCH = -14  # deg, offsets the stance's chin-up attitude for realistic proportions
JOINTS = dict(
    hips=(0.0, 0.95, 0.0), spine=(1.06, 0.0), chest=(1.27, -0.01), neck=(1.55, -0.005), head=(1.655, -0.015), head_top=1.9,
    sh=(0.19, 1.47), el=(0.317, 1.245), wr=(0.425, 1.045), tip=(0.5, 0.93),
    hipL=(0.095, 0.95), hipR=(-0.095, 0.95), knL=(0.142, 0.50), knR=(-0.14, 0.50), anL=(0.18, 0.11), anR=(-0.18, 0.11),
)


def tee_front_poly(z):
    """x-range of the tee visible between the open vest panels at height z."""
    lo = np.interp(z, [1.0, 1.05, 1.25, 1.45, 1.55, 1.62], [-0.02, -0.02, -0.035, -0.042, -0.07, -0.075])
    hi = np.interp(z, [1.0, 1.05, 1.25, 1.45, 1.55, 1.62], [0.086, 0.086, 0.076, 0.062, 0.05, 0.07])
    return lo, hi


def paint(g, detail):
    v = g.v
    n = g.nrm
    x, y, z = v[:, 0], v[:, 1], v[:, 2]
    N = len(v)
    C = lambda k: srgb(PALETTE[k])  # noqa: E731
    col = np.tile(C('vest'), (N, 1))
    rough = np.full(N, 0.6)
    metal = np.zeros(N)
    lab = np.full(N, 'vest', dtype=object)
    det = detail / np.percentile(detail, 95)
    noise = fbm(v, 9.0, 3)

    # ---------------------------------------------------------------- masks
    neck_r = np.sqrt((x / 0.072) ** 2 + ((y + 0.01) / 0.082) ** 2)
    under_chin = (z > 1.57) & (y < -0.03) & (y > -0.16) & (np.abs(x) < 0.07)
    head = (z > 1.63) & (neck_r < 1.25) | ((z > 1.575) & under_chin) | (z > 1.7)
    neck = (z > 1.47) & ~head & (neck_r < 1.0) & (y < 0.06)
    arm = np.abs(x) > 0.235
    hand = (np.abs(x) > 0.36) & (z < 1.075)
    forearm = arm & (z < 1.305) & (z > 1.0) & ~hand
    sleeve = arm & (z >= 1.305) & (z < 1.56)
    lo, hi = tee_front_poly(z)
    tee_front = (x > lo) & (x < hi) & (z > 1.0) & (z < 1.6) & (y < -0.05) & (n[:, 1] < 0.3)
    hem = (z > 0.925) & (z < 1.008) & ~arm
    legs = z < 0.925
    boots = z < 0.178
    chain = (np.abs(x - 0.01) < 0.065) & (z > 1.27) & (z < 1.62) & (det > 0.55) & (y < -0.06) & tee_front
    chain |= (z > 1.55) & (z < 1.63) & (neck_r > 0.85) & (neck_r < 1.25) & (det > 0.6) & (y < 0.03)
    # hair: curly top + fade on the sides and back
    theta = np.abs(np.arctan2(x, -(y + 0.005)))
    top_line = 1.803 - 0.02 * smoothstep(0.5, 1.4, theta) - 0.035 * smoothstep(1.6, 2.6, theta)
    curls = head & (z > top_line) | head & (z > top_line - 0.02) & (det > 0.6)
    curls = head & (g.smooth(curls * 1.0, 4) > 0.5)  # clean edge (no single-vertex islands)
    fade_lo = np.interp(theta, [0.0, 1.1, 1.5, 2.2, 3.15], [9, 1.78, 1.745, 1.70, 1.67])
    ear = (np.abs(np.abs(x) - 0.085) < 0.022) & (z > 1.69) & (z < 1.765) & (np.abs(y - 0.0) < 0.03)
    fade = head & ~curls & (z > fade_lo) & ~ear
    face = head & ~curls

    # ---------------------------------------------------------------- base colours
    # vest: camel nylon, darker in the quilting channels
    valley = smoothstep(0.25, 0.9, det)
    col[:] = C('vest') * (0.9 + 0.12 * noise[:, None])
    col = col * (1 - 0.35 * valley[:, None]) + C('vest_shade') * 0.35 * valley[:, None]
    rough[:] = 0.5

    for m in (tee_front, sleeve, hem):
        col[m] = C('tee') * (0.9 + 0.2 * noise[m, None])
        rough[m] = 0.85
        lab[m] = 'tee'
    cl = legs & ~hand
    col[cl] = C('cargo') * (0.9 + 0.2 * fbm(v[cl], 30.0, 2)[:, None])
    rough[cl] = 0.9
    lab[cl] = 'cargo'
    col[boots] = C('boot') * (0.85 + 0.3 * smoothstep(0.3, 0.9, det[boots, None]))
    rough[boots] = 0.45
    sole = boots & (z < 0.034)
    col[sole] = C('sole')
    rough[sole] = 0.8
    lab[boots] = 'boot'

    for m in (hand, forearm, neck, face):
        col[m] = C('skin') * (0.94 + 0.12 * fbm(v[m], 40.0, 3)[:, None])
        rough[m] = 0.55
        lab[m] = 'skin'
    wcheek = 1 - smoothstep(0.4, 1.0, ellipsoid(np.c_[np.abs(x), z], (0.042, 1.705), (0.032, 0.026)))
    wnose = 1 - smoothstep(0.4, 1.0, ellipsoid(np.c_[x, y, z], (0, -0.13, 1.695), (0.018, 0.03, 0.02)))
    w = (np.maximum(wcheek, wnose) * 0.28 + ear * 0.3) * face
    col = col * (1 - w[:, None]) + C('skin_warm') * w[:, None]
    lips = ellipsoid(np.c_[x, z], MOUTH, (0.024, 0.0075)) < 1.0
    col[lips & face] = col[lips & face] * 0.35 + C('lips') * 0.65
    rough[lips] = 0.4

    # stubble: jaw, chin, upper lip
    jaw_top = np.interp(np.abs(x), [0.0, 0.02, 0.04, 0.065, 0.085], [1.645, 1.65, 1.68, 1.715, 1.735])
    stub_zone = face & (z < jaw_top) & (z > 1.56) & (y < 0.02) & ~lips
    moustache = face & (np.abs(x) < 0.028) & (z > 1.672) & (z < 1.684) & (y < -0.1)
    s_amt = (g.smooth((stub_zone | moustache) * 1.0, 8) * (0.24 + 0.14 * vnoise(v, 900.0, 5)) * face)[:, None]
    col = col * (1 - s_amt) + C('stubble') * s_amt

    # hair
    hh = smoothstep(0.4, 1.2, det[curls, None])
    col[curls] = C('hair') * (1 - 0.5 * hh) + C('hair_hi') * 0.5 * hh
    rough[curls] = 0.75
    lab[curls] = 'hair'
    f_amt = (0.55 + 0.25 * smoothstep(fade_lo[fade], fade_lo[fade] + 0.05, z[fade]))[:, None] * (0.85 + 0.3 * vnoise(v[fade], 700.0, 7)[:, None])
    col[fade] = col[fade] * (1 - f_amt) + C('hair') * f_amt
    lab[fade] = 'hair'

    # eyes + brows
    for ex, ez in EYES:
        e = ellipsoid(np.c_[x, z], (ex, ez), EYE_R)
        front = (y < -0.08) & face
        eye = front & (e < 1.0)
        col[eye] = C('sclera')
        c2 = np.c_[x, z]
        ic = (ex + np.sign(-ex) * 0.0008, ez - 0.0006)
        ir = eye & (ellipsoid(c2, ic, (0.0062, 0.0062)) < 1.0)
        col[ir] = C('iris')
        ring = eye & (ellipsoid(c2, ic, (0.0062, 0.0062)) > 0.78) & ir
        col[ring] = C('iris_ring')
        pu = eye & (ellipsoid(c2, ic, (0.0024, 0.0024)) < 1.0)
        col[pu] = C('pupil')
        rough[eye] = 0.15
        lid = eye & (z > ez + 0.0012)
        col[lid] *= 0.55
        lash = front & (e >= 1.0) & (e < 1.25) & (z > ez - 0.004)
        col[lash] = col[lash] * 0.3 + C('brow') * 0.7
        brow_z = ez + 0.018 + 0.004 * (1 - np.clip(np.abs(x - ex) / 0.02, 0, 1))
        brow = front & (np.abs(z - brow_z) < 0.005) & (np.abs(x - ex) < 0.022)
        col[brow] = col[brow] * 0.2 + C('brow') * 0.8
        lab[eye] = 'eye'

    # ink: crisp original line art on the forearms (wrist bands, an outlined star, a pulse line) + a star on each hand
    ink = np.zeros(N)
    for sx in (-1, 1):
        fa = forearm & (np.sign(x) == sx)
        if fa.sum() < 50:
            continue
        top = v[fa & (z > 1.24)].mean(0) if (fa & (z > 1.24)).any() else v[fa].mean(0)
        bot = v[fa & (z < 1.10)].mean(0) if (fa & (z < 1.10)).any() else v[fa].mean(0)
        ax = bot - top
        ln = np.linalg.norm(ax)
        ax /= ln
        e1 = np.array([0.0, -1.0, 0.0]) - ax * (-ax[1])
        e1 /= np.linalg.norm(e1)
        e2 = np.cross(ax, e1)
        rel = v - top
        t = rel @ ax
        rad = rel - np.outer(t, ax)
        phi = np.arctan2(rad @ e2, rad @ e1)
        u = phi * 0.042  # arc length around the forearm (m), 0 = front
        zone = fa & (t > 0.0) & (t < ln + 0.02)
        soft = lambda dist, w: (1 - smoothstep(w * 0.55, w, dist)) * zone  # noqa: E731
        bands = np.maximum(soft(np.abs(t - (ln - 0.035)), 0.007), soft(np.abs(t - (ln - 0.058)), 0.0045))
        # outlined five-point star on the front of the forearm
        ang = np.linspace(0, 2 * np.pi, 11)[:-1] + np.pi / 2
        rr = np.where(np.arange(10) % 2 == 0, 0.034, 0.014)
        star = list(zip(np.cos(ang) * rr, 0.42 * ln + np.sin(ang) * rr))
        star.append(star[0])
        pts2 = np.c_[u, t]
        dstar = np.full(N, np.inf)
        for (x1, y1), (x2, y2) in zip(star[:-1], star[1:]):
            a_ = np.array([x1, y1])
            b_ = np.array([x2, y2])
            ab = b_ - a_
            tt = np.clip(((pts2 - a_) @ ab) / (ab @ ab), 0, 1)
            dstar = np.minimum(dstar, np.linalg.norm(pts2 - (a_ + tt[:, None] * ab), axis=1))
        star_m = soft(dstar, 0.0045) * (np.abs(u) < 0.06)
        # pulse line around the upper forearm
        pul_s = 0.17 * ln + 0.014 * np.where(np.abs(((u * 30) % 2) - 1) < 0.3, np.sign(np.sin(u * 94.0)), 0) * (np.abs(u) < 0.035)
        pulse = soft(np.abs(t - pul_s), 0.0042)
        ink = np.maximum(ink, np.maximum(bands, np.maximum(star_m, pulse)))
    for sx in (-1, 1):
        cx = sx * 0.41
        star_c = np.array([cx, -0.02, 1.0])
        rel = v - star_c
        ang = np.arctan2(rel[:, 2], rel[:, 0])
        r = np.hypot(rel[:, 0], rel[:, 2])
        star = hand & (n[:, 1] < -0.1) & (r < 0.014 * (0.55 + 0.45 * np.cos(5 * ang))) & (np.abs(rel[:, 1]) < 0.06)
        ink = np.maximum(ink, star * 1.0)
    a_ink = (ink * 0.72)[:, None]
    col = col * (1 - a_ink) + C('ink') * a_ink

    # gold chain
    col[chain] = C('chain') * (0.85 + 0.25 * smoothstep(0.2, 1.0, det[chain, None]))
    rough[chain] = 0.22
    metal[chain] = 1.0
    lab[chain] = 'chain'
    return col, rough, metal, lab
