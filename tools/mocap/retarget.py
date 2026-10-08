"""Retarget a window of a CMU BVH clip onto the game's pose rig (render/rig.ts) -> a TypeScript keyframe module.

The game's poses are Euler angles (degrees, order ZYX, identity rest: limbs hang along -Y, torso up, the fighter faces
+X, the camera looks from +Z, L = far side) per joint of the reference rig; GlbRig then retargets that rig onto the
skinned model. Here every reference joint gets the WORLD orientation of its BVH counterpart, re-expressed in the
fighter's frame (x = toward the opponent = the guard direction of the window, y = up, z = toward the camera):

    W_ref(J, t) = T * R_bvh(b(J), t) * A * W_restAlign(J)

A maps the reference rest frame onto the BVH rest frame (BVH rest = T-pose facing +Z, left = +X), W_restAlign(J) turns
the reference segment (-Y for limbs, +Y for the torso, +X for the foot) onto the BVH rest segment (shortest arc, so a
T-pose arm is the reference arm raised sideways with the elbow hinge forward). Local angles follow from the reference
hierarchy. The hips' travel becomes root x/y (scaled to the reference leg length, drift removed for loops).

  python3 tools/mocap/retarget.py <clip.bvh> <t0> <t1> <out.ts> <ExportName> [--loop 0.4] [--mirror] [--fps 30]
"""
from __future__ import annotations

import argparse
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bvh import BVH  # noqa: E402

# reference joint -> (BVH joint, BVH segment child or None for the end site, reference rest direction)
MAP = {
    'hips': ('Hips', None, None),
    'spine': ('Spine', 'Spine1', (0, 1, 0)),
    'chest': ('Spine1', 'Neck1', (0, 1, 0)),
    'neck': ('Neck1', 'Head', (0, 1, 0)),
    'head': ('Head', None, (0, 1, 0)),
    'shL': ('LeftArm', 'LeftForeArm', (0, -1, 0)),
    'elL': ('LeftForeArm', 'LeftHand', (0, -1, 0)),
    'haL': ('LeftHand', 'LeftHandIndex1', (0, -1, 0)),
    'shR': ('RightArm', 'RightForeArm', (0, -1, 0)),
    'elR': ('RightForeArm', 'RightHand', (0, -1, 0)),
    'haR': ('RightHand', 'RightHandIndex1', (0, -1, 0)),
    'thL': ('LeftUpLeg', 'LeftLeg', (0, -1, 0)),
    'knL': ('LeftLeg', 'LeftFoot', (0, -1, 0)),
    'ftL': ('LeftFoot', 'LeftToeBase', (1, 0, 0)),
    'thR': ('RightUpLeg', 'RightLeg', (0, -1, 0)),
    'knR': ('RightLeg', 'RightFoot', (0, -1, 0)),
    'ftR': ('RightFoot', 'RightToeBase', (1, 0, 0)),
}
PARENT = {'hips': None, 'spine': 'hips', 'chest': 'spine', 'neck': 'chest', 'head': 'neck',
          'shL': 'chest', 'elL': 'shL', 'haL': 'elL', 'shR': 'chest', 'elR': 'shR', 'haR': 'elR',
          'thL': 'hips', 'knL': 'thL', 'ftL': 'knL', 'thR': 'hips', 'knR': 'thR', 'ftR': 'knR'}
ORDER = list(MAP)
# reference rest frame (x fwd, y up, z right) -> BVH rest frame (faces +Z, left = +X): columns = images of x, y, z
A = np.array([[0.0, 0, -1], [0, 1, 0], [1, 0, 0]])


def arc(a, b):
    """Shortest-arc rotation matrix taking unit a to unit b."""
    a = np.asarray(a, float) / np.linalg.norm(a)
    b = np.asarray(b, float) / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(a @ b)
    if c < -0.999999:
        ax = np.cross(a, [1, 0, 0]) if abs(a[0]) < 0.9 else np.cross(a, [0, 1, 0])
        ax /= np.linalg.norm(ax)
        return 2 * np.outer(ax, ax) - np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx / (1 + c)


def euler_zyx(m):
    """three.js Euler 'ZYX' (R = Rz * Ry * Rx) from rotation matrices (..., 3, 3) -> degrees (x, y, z)."""
    m31 = np.clip(m[..., 2, 0], -1, 1)
    y = np.arcsin(-m31)
    x = np.arctan2(m[..., 2, 1], m[..., 2, 2])
    z = np.arctan2(m[..., 1, 0], m[..., 0, 0])
    return np.degrees(np.stack([x, y, z], -1))


def solve(path, t0, t1, pivot=0.76, mirror=False, drift=False):
    """Per-frame reference-rig local Euler angles (dict joint -> (F,3) deg), root x/y (m), joint positions in the
    fighter frame (dict BVH joint -> (F,3) m, hips-relative) and the clip's frame rate."""
    b = BVH(path)
    fps_in = 1 / b.dt
    f0, f1 = int(t0 * fps_in), int(t1 * fps_in)
    R, P = b.fk(f0, f1)
    ix = b.index
    # rest pose (all rotations zero): segment directions and the standing hip height
    z = np.zeros((1, b.data.shape[1]))
    keep = b.data
    b.data = z
    R0, P0 = b.fk(0, 1)
    b.data = keep
    feet = min(P0[0, ix['LeftToeBase'], 1], P0[0, ix['RightToeBase'], 1])
    hip_h = P0[0, ix['Hips'], 1] - feet
    scale = pivot / hip_h
    # fighter frame: x = the guard direction (hands in front of the chest), averaged over the window
    chest = P[:, ix['Spine1']]
    hands = 0.5 * (P[:, ix['LeftHand']] + P[:, ix['RightHand']])
    g = (hands - chest)[:, [0, 2]].mean(0)
    g /= np.linalg.norm(g)
    xc = np.array([g[0], 0, g[1]])
    yc = np.array([0.0, 1, 0])
    zc = np.cross(xc, yc)
    T = np.stack([xc, yc, zc])
    align = {}
    for jn, (bj, child, rdir) in MAP.items():
        if rdir is None:
            align[jn] = np.eye(3)
            continue
        k = ix[bj]
        if child:
            d = P0[0, ix[child]] - P0[0, k]
        else:
            d = R0[0, k] @ b.joints[k].end
        align[jn] = arc(rdir, A.T @ d)
    W = {jn: np.einsum('ij,fjk,kl->fil', T, R[:, ix[bj]], A @ align[jn]) for jn, (bj, _c, _r) in MAP.items()}
    loc = {}
    for jn in ORDER:
        p = PARENT[jn]
        loc[jn] = W[jn] if p is None else np.einsum('fji,fjk->fik', W[p], W[jn])
    E = {jn: euler_zyx(loc[jn]) for jn in ORDER}
    hips = np.einsum('ij,fj->fi', T, P[:, ix['Hips']])
    rx = (hips[:, 0] - hips[:, 0].mean()) * scale
    # hip height over the lowest toe of the window, relative to standing straight
    ry = (P[:, ix['Hips'], 1] - P[:, [ix['LeftToeBase'], ix['RightToeBase']], 1].min() - hip_h) * scale
    if not drift:
        t = np.arange(len(rx))
        rx = rx - np.polyval(np.polyfit(t, rx, 1), t)
    if mirror:
        E = {jn: E[{'L': jn[:-1] + 'R', 'R': jn[:-1] + 'L'}.get(jn[-1], jn)] if jn[-1] in 'LR' else E[jn] for jn in ORDER}
        for jn in ORDER:
            E[jn] = E[jn] * np.array([-1, -1, 1])
    CP = {n: (np.einsum('ij,fj->fi', T, P[:, ix[n]] - P[:, ix['Hips']]) * scale) for n in ix}
    if mirror:
        swap = lambda n: 'Right' + n[4:] if n.startswith('Left') else 'Left' + n[5:] if n.startswith('Right') else n  # noqa: E731
        CP = {swap(n): v * np.array([1, 1, -1]) for n, v in CP.items()}
    return E, rx, ry, CP, fps_in


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('bvh')
    ap.add_argument('t0', type=float)
    ap.add_argument('t1', type=float)
    ap.add_argument('out')
    ap.add_argument('name')
    ap.add_argument('--fps', type=float, default=30)
    ap.add_argument('--loop', type=float, default=0.0, help='seconds of the end blended into the start (seamless loop)')
    ap.add_argument('--mirror', action='store_true', help='swap left/right (a southpaw clip for an orthodox fighter)')
    ap.add_argument('--pivot', type=float, default=0.76, help='hip height (m) of the reference rig')
    ap.add_argument('--drift', action='store_true', help='keep the travel (default: remove the linear drift)')
    ap.add_argument('--twist', default='', help='extra local Y (twist) per joint, e.g. "spine=-15,chest=-25": opens the torso '
                    'toward the camera like the game\'s 2.5D stances (the capture faces the opponent in profile)')
    a = ap.parse_args()
    E, rx, ry, CP, fps_in = solve(a.bvh, a.t0, a.t1, a.pivot, a.mirror, a.drift)
    for kv in filter(None, a.twist.split(',')):
        jn, deg = kv.split('=')
        E[jn] = E[jn] + np.array([0, float(deg), 0])
    # resample to the output rate
    n_out = int((len(rx) - 1) / fps_in * a.fps) + 1
    src = np.arange(n_out) * fps_in / a.fps
    i0 = np.floor(src).astype(int).clip(0, len(rx) - 2)
    fr = (src - i0)[:, None]

    def res(arr):
        u = np.unwrap(np.radians(arr), axis=0)
        return np.degrees(u[i0] * (1 - fr) + u[i0 + 1] * fr) if arr.ndim == 2 else arr[i0] * (1 - fr[:, 0]) + arr[i0 + 1] * fr[:, 0]

    Eo = {jn: res(E[jn]) for jn in ORDER}
    rxo, ryo = res(rx), res(ry)
    if a.loop > 0:
        nb = int(a.loop * a.fps)
        w = np.linspace(0, 1, nb)
        for jn in ORDER:
            e = Eo[jn]
            # end -> start: the last nb keys fade into the first keys' neighbourhood (angles unwrapped against them)
            d = (e[:nb] - e[-nb:] + 180) % 360 - 180
            e[-nb:] = e[-nb:] + d * w[:, None]
        for arr in (rxo, ryo):
            arr[-nb:] = arr[-nb:] + (arr[:nb] - arr[-nb:]) * w
    lines = [f'// Generated by tools/mocap/retarget.py from CMU mocap {os.path.basename(a.bvh)} {a.t0}-{a.t1} s'
             f'{" (mirrored)" if a.mirror else ""} - do not edit.',
             '// CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu): free for research and commercial projects.',
             "import type { PoseDef } from '../../pose';", '',
             f'export const {a.name}: {{ fps: number; keys: PoseDef[] }} = {{', f'  fps: {a.fps:g},', '  keys: [']
    for i in range(n_out):
        js = ', '.join(f'{jn}: [{Eo[jn][i, 0]:.1f}, {Eo[jn][i, 1]:.1f}, {Eo[jn][i, 2]:.1f}]' for jn in ORDER)
        lines.append(f'    {{ x: {rxo[i]:.3f}, y: {ryo[i]:.3f}, j: {{ {js} }} }},')
    lines += ['  ],', '};', '']
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    open(a.out, 'w').write('\n'.join(lines))
    print('wrote', a.out, n_out, 'keys', f'{(n_out - 1) / a.fps:.2f} s',
          'root x range', round(float(np.ptp(rxo)), 3), 'y', round(float(ryo.min()), 3), '..', round(float(ryo.max()), 3))
    for jn in ('hips', 'chest', 'shL', 'elL', 'shR', 'elR', 'thL', 'knL', 'thR', 'knR'):
        print(f'  {jn:5s} mean {Eo[jn].mean(0).round(0)}  range {np.ptp(Eo[jn], 0).round(0)}')


if __name__ == '__main__':
    main()
