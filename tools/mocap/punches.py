"""List the punches in CMU boxing clips: hand, kind (straight/hook/uppercut), start/peak/end times, extension.

  python3 tools/mocap/punches.py clip.bvh [clip.bvh ..]
A punch = a peak of the hand's reach along the guard direction (hands in front of the chest, smoothed over 1 s) well
beyond the guard; kind from the arm's straightness at the peak and the hand's path (sideways arc = hook, rise =
uppercut)."""
from __future__ import annotations

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bvh import BVH  # noqa: E402


def punches(path):
    b = BVH(path)
    R, P = b.fk()
    ix = b.index
    fps = 1 / b.dt
    chest = P[:, ix['Spine1']]
    hands = 0.5 * (P[:, ix['LeftHand']] + P[:, ix['RightHand']])
    g = (hands - chest)[:, [0, 2]]
    k = int(fps)
    ker = np.ones(k) / k
    gx, gz = np.convolve(g[:, 0], ker, 'same'), np.convolve(g[:, 1], ker, 'same')
    n = np.hypot(gx, gz)
    gx, gz = gx / n, gz / n
    out = []
    for side in ('Left', 'Right'):
        sh, el, ha = P[:, ix[side + 'Arm']], P[:, ix[side + 'ForeArm']], P[:, ix[side + 'Hand']]
        L = np.linalg.norm(el - sh, axis=1).mean() + np.linalg.norm(ha - el, axis=1).mean()
        rel = ha - chest
        e = (rel[:, 0] * gx + rel[:, 2] * gz) / L  # reach along the guard direction, in arm lengths
        lat = (rel[:, 0] * -gz + rel[:, 2] * gx) / L
        up = (ha[:, 1] - sh[:, 1]) / L
        straight = np.linalg.norm(ha - sh, axis=1) / L
        guard = np.median(e)
        i = 1
        while i < len(e) - 1:
            if e[i] > guard + 0.35 and e[i] >= e[i - 1] and e[i] >= e[i + 1] and e[i] == e[max(0, i - 30) : i + 30].max():
                s = i
                while s > 0 and e[s] > guard + 0.08 and i - s < fps * 0.6:
                    s -= 1
                t = i
                while t < len(e) - 1 and e[t] > guard + 0.08 and t - i < fps * 0.8:
                    t += 1
                dl = lat[i] - lat[s]
                du = up[i] - up[s]
                kind = 'straight' if straight[i] > 0.88 else 'hook' if abs(dl) > abs(du) else 'uppercut'
                out.append(dict(hand=side[0], kind=kind, start=s / fps, peak=i / fps, end=t / fps, reach=round(float(e[i] - guard), 2),
                                straight=round(float(straight[i]), 2)))
                i = t
            i += 1
    return sorted(out, key=lambda p: p['peak'])


if __name__ == '__main__':
    for p in sys.argv[1:]:
        ps = punches(p)
        print(os.path.basename(p), len(ps), 'punches')
        for q in ps:
            print(f"  {q['hand']} {q['kind']:9s} {q['start']:6.2f} {q['peak']:6.2f} {q['end']:6.2f}  up {q['peak'] - q['start']:.2f}s back {q['end'] - q['peak']:.2f}s reach {q['reach']} straight {q['straight']}")
