"""Minimal BVH reader + forward kinematics (numpy) for the CMU motion-capture clips (S17, PO: the bodies move
"mechanisch" - hand-built poses; real captured motion instead).

The CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu) is free for research and commercial projects; the BVH
conversion used here is Bruce Hahne's (cgspeed), mirrored at github.com/una-dinosauria/cmu-mocap (data/<subject>/<take>.bvh).
"""
from __future__ import annotations

import numpy as np


class Joint:
    def __init__(self, name, parent):
        self.name = name
        self.parent = parent
        self.offset = np.zeros(3)
        self.channels: list[str] = []
        self.children: list[Joint] = []
        self.end = None  # end-site offset


def _rot(axis, deg):
    a = np.radians(deg)
    c, s = np.cos(a), np.sin(a)
    n = len(a)
    m = np.zeros((n, 3, 3))
    if axis == 'X':
        m[:, 0, 0] = 1
        m[:, 1, 1], m[:, 1, 2], m[:, 2, 1], m[:, 2, 2] = c, -s, s, c
    elif axis == 'Y':
        m[:, 1, 1] = 1
        m[:, 0, 0], m[:, 0, 2], m[:, 2, 0], m[:, 2, 2] = c, s, -s, c
    else:
        m[:, 2, 2] = 1
        m[:, 0, 0], m[:, 0, 1], m[:, 1, 0], m[:, 1, 1] = c, -s, s, c
    return m


class BVH:
    def __init__(self, path):
        tok = open(path).read().split()
        i = 0
        self.joints: list[Joint] = []
        stack: list[Joint] = []
        cur = None
        while tok[i] != 'MOTION':
            t = tok[i]
            if t in ('ROOT', 'JOINT'):
                cur = Joint(tok[i + 1], stack[-1] if stack else None)
                if cur.parent:
                    cur.parent.children.append(cur)
                self.joints.append(cur)
                i += 2
            elif t == 'End':
                # End Site { OFFSET x y z }
                cur = stack[-1]
                cur.end = np.array([float(v) for v in tok[i + 4 : i + 7]])
                i += 8
                cur = None
                continue
            elif t == '{':
                stack.append(cur)
                i += 1
            elif t == '}':
                stack.pop()
                i += 1
            elif t == 'OFFSET':
                stack[-1].offset = np.array([float(v) for v in tok[i + 1 : i + 4]])
                i += 4
            elif t == 'CHANNELS':
                n = int(tok[i + 1])
                stack[-1].channels = tok[i + 2 : i + 2 + n]
                i += 2 + n
            else:
                i += 1
        self.frames = int(tok[i + 2])
        self.dt = float(tok[i + 5])
        vals = np.array(tok[i + 6 :], float)
        nch = sum(len(j.channels) for j in self.joints)
        self.data = vals[: self.frames * nch].reshape(self.frames, nch)
        self.index = {j.name: k for k, j in enumerate(self.joints)}

    def fk(self, f0=0, f1=None):
        """World rotations (F, J, 3, 3) and positions (F, J, 3) for frames f0..f1 (BVH units, Y up)."""
        d = self.data[f0:f1]
        F, J = len(d), len(self.joints)
        R = np.zeros((F, J, 3, 3))
        P = np.zeros((F, J, 3))
        c = 0
        for k, j in enumerate(self.joints):
            loc = np.tile(np.eye(3), (F, 1, 1))
            pos = np.tile(j.offset, (F, 1))
            for ch in j.channels:
                if ch.endswith('position'):
                    pos = pos.copy()
                    pos[:, 'XYZ'.index(ch[0])] = d[:, c] + j.offset['XYZ'.index(ch[0])]
                else:
                    loc = loc @ _rot(ch[0], d[:, c])
                c += 1
            if j.parent is None:
                R[:, k] = loc
                P[:, k] = pos
            else:
                p = self.index[j.parent.name]
                R[:, k] = R[:, p] @ loc
                P[:, k] = P[:, p] + np.einsum('fij,j->fi', R[:, p], j.offset)
        return R, P

    def end_pos(self, R, P, name):
        k = self.index[name]
        return P[:, k] + np.einsum('fij,j->fi', R[:, k], self.joints[k].end)
