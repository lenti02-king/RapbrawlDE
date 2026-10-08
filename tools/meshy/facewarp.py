"""Face proportions toward the real photos (S17): a smooth 2D warp of the face, measured, not eyeballed.

From tools/meshy/facemarks.py landmarks of the PO's photos and of a front orthographic render of the merged model
(merge4.py --stage geo, view 'front'), every photo is turned frontal, scaled/rotated/shifted onto the model's face by
the stable points (eye corners, nasion, cheekbones) and the remaining differences at the eyes, brows, nose, lips and
jaw become displacements in model units. Several photos are averaged; `--alpha` keeps part of the sculpt's style.

  python3 tools/meshy/facewarp.py fm.json <model render> <photo,photo> out.json [--ortho 0,0.74,0.34,800] [--alpha 0.85]

merge4.py --facewarp out.json applies it to the head (thin-plate spline over x/z, front-facing vertices only).
"""
from __future__ import annotations

import argparse
import json

import numpy as np

EYE_R = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
EYE_L = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]
BROWS = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46, 300, 293, 334, 296, 336, 285, 295, 282, 283, 276]
NOSE = [168, 6, 197, 195, 5, 4, 1, 2, 98, 327, 64, 294, 48, 278, 129, 358]
LIPS = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
        78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]
JAW = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 132, 58]
WARP = EYE_R + EYE_L + BROWS + NOSE + LIPS + JAW
STABLE = [33, 133, 263, 362, 168, 6, 234, 454]


def similarity(src, dst):
    """Least-squares scale/rotation/translation mapping src (n,2) onto dst (n,2)."""
    ms, md = src.mean(0), dst.mean(0)
    a, b = src - ms, dst - md
    u, s, vt = np.linalg.svd(a.T @ b)
    r = (u @ vt).T
    if np.linalg.det(r) < 0:
        vt[-1] *= -1
        r = (u @ vt).T
    k = s.sum() / (a ** 2).sum()
    return lambda p: (k * (r @ (p - ms).T)).T + md


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('fm')
    ap.add_argument('model')
    ap.add_argument('photos')
    ap.add_argument('out')
    ap.add_argument('--ortho', default='0,0.74,0.34,800', help='render camera: centre x, centre z, ortho scale, px')
    ap.add_argument('--alpha', type=float, default=0.85)
    ap.add_argument('--max', type=float, default=0.006, help='largest displacement (model units)')
    a = ap.parse_args()
    fm = json.load(open(a.fm))
    cx, cz, sc, px = (float(v) for v in a.ortho.split(','))
    m = fm[a.model]
    M_img = np.array(m['image'])[:, :2]  # render px of the model's landmarks (frontal: the render is a front view)
    M_f = np.array(m['frontal'])[:, :2]
    deltas = []
    for p in a.photos.split(','):
        F = np.array(fm[p]['frontal'])[:, :2]
        T = similarity(F[STABLE], M_f[STABLE])
        deltas.append(T(F[WARP]) - M_f[WARP])
    d = np.mean(deltas, 0) * a.alpha
    unit = sc / px  # model units per render px (y down in the image = -z)
    pts = np.c_[cx + (M_img[WARP, 0] - px / 2) * unit, cz - (M_img[WARP, 1] - px / 2) * unit]
    dl = np.c_[d[:, 0] * unit, -d[:, 1] * unit]
    # symmetric: the sculpt is symmetric, the photos' small asymmetries (pose, expression) are not his face
    mir = np.c_[-pts[:, 0], pts[:, 1]]
    pair = np.argmin(((pts[:, None, :] - mir[None, :, :]) ** 2).sum(-1), axis=1)
    dl = 0.5 * (dl + np.c_[-dl[pair, 0], dl[pair, 1]])
    dl[np.abs(pts[:, 0]) < 0.002, 0] = 0.0
    n = np.linalg.norm(dl, axis=1)
    dl *= np.minimum(1, a.max / np.maximum(n, 1e-9))[:, None]
    json.dump({'points': pts.round(6).tolist(), 'delta': dl.round(6).tolist(), 'alpha': a.alpha, 'photos': a.photos.split(',')}, open(a.out, 'w'))
    print('warp points', len(pts), 'mean |d|', round(float(np.linalg.norm(dl, axis=1).mean()), 5), 'max', round(float(np.linalg.norm(dl, axis=1).max()), 5))
    for name, ids in (('eyes', EYE_R + EYE_L), ('brows', BROWS), ('nose', NOSE), ('lips', LIPS), ('jaw', JAW)):
        sel = [WARP.index(i) for i in ids]
        print(f'  {name:6s} mean dx {dl[sel, 0].mean():+.5f} dz {dl[sel, 1].mean():+.5f}  |d| {np.linalg.norm(dl[sel], axis=1).mean():.5f}')


if __name__ == '__main__':
    main()
