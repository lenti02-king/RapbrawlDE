"""Comparison sheet: the PO's photos next to model renders / in-game captures, all aligned on the same stable face points
(eye corners, nasion, cheekbones), plus per model an overlay of the photos' mean landmark contours (yellow) on the
model (cyan) - the comparison the PO asked for, against the REAL photos (S17).

  python3 tools/meshy/facesheet.py fm.json out.jpg "photo:FOTO,photo:FOTO" "render:BLENDER,shot:SPIEL" [tile=360]
Each entry is <image path as stored in fm.json>:<label>. The first group are the references (photos)."""
from __future__ import annotations

import json
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from facewarp import STABLE, similarity  # noqa: E402

LINES = [
    [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33],
    [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263],
    [70, 63, 105, 66, 107], [46, 53, 52, 65, 55], [300, 293, 334, 296, 336], [276, 283, 282, 295, 285],
    [168, 6, 197, 195, 5, 4, 1, 2], [48, 64, 98, 2, 327, 294, 278],
    [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61],
    [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78],
    [132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361],
]


def font(px):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'):
        try:
            return ImageFont.truetype(f, px)
        except OSError:
            pass
    return ImageFont.load_default()


def main():
    fm = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    refs = [e.rsplit(':', 1) for e in sys.argv[3].split(',')]
    models = [e.rsplit(':', 1) for e in sys.argv[4].split(',')]
    T = int(sys.argv[5]) if len(sys.argv) > 5 else 360
    H = int(T * 1.25)
    # canonical frame: the first photo's frontal stable points, eye corners at 30 % / 70 % of the tile width
    C0 = np.array(fm[refs[0][0]]['frontal'])[:, :2]
    s = 0.4 * T / np.linalg.norm(C0[263] - C0[33])
    mid = 0.5 * (C0[33] + C0[263])
    C = (C0 - mid) * s + np.array([T / 2, 0.42 * H])

    def tile(path, label, overlay=None):
        d = fm[path]
        P = np.array(d['image'])[:, :2]
        fwd = similarity(P[STABLE], C[STABLE])
        # PIL wants output -> input: fit the inverse on the same pairs
        inv = similarity(C[STABLE], P[STABLE])
        o = inv(np.zeros((1, 2)))[0]
        ex, ey = inv(np.array([[1.0, 0.0]]))[0] - o, inv(np.array([[0.0, 1.0]]))[0] - o
        im = Image.open(path).convert('RGB').transform((T, H), Image.AFFINE, (ex[0], ey[0], o[0], ex[1], ey[1], o[1]),
                                                       resample=Image.BICUBIC, fillcolor=(24, 22, 28))
        dr = ImageDraw.Draw(im)
        if overlay is not None:
            mine = fwd(P)
            for ln in LINES:
                dr.line([tuple(mine[i]) for i in ln], fill=(60, 230, 255), width=2)
            for ln in LINES:
                dr.line([tuple(overlay[i]) for i in ln], fill=(255, 214, 40), width=2)
        dr.rectangle([0, H - 34, T, H], fill=(0, 0, 0))
        dr.text((10, H - 30), label, fill=(255, 255, 255), font=font(20))
        return im, fwd

    tiles = []
    photo_pts = []
    for path, label in refs:
        im, fwd = tile(path, label)
        tiles.append(im)
        # frontal landmarks of the photo, fitted into the canonical frame (pose removed)
        F = np.array(fm[path]['frontal'])[:, :2]
        photo_pts.append(similarity(F[STABLE], C[STABLE])(F))
    mean_photo = np.mean(photo_pts, 0)
    row2 = []
    for path, label in models:
        im, _ = tile(path, label)
        tiles.append(im)
        ov, _ = tile(path, label + '  (gelb = Fotos)', overlay=mean_photo)
        row2.append(ov)
    n = len(tiles)
    sheet = Image.new('RGB', (T * max(n, len(row2)), H * 2), (24, 22, 28))
    for i, im in enumerate(tiles):
        sheet.paste(im, (i * T, 0))
    for i, im in enumerate(row2):
        sheet.paste(im, ((len(refs) + i) * T, H))
    dr = ImageDraw.Draw(sheet)
    dr.text((12, H + 12), 'Unten: Modell (cyan) und\nMittel der Fotos (gelb),\nausgerichtet an Augenwinkeln,\nNasenwurzel, Wangenknochen', fill=(230, 230, 230), font=font(18))
    sheet.save(out, quality=90)
    print('wrote', out, sheet.size)


if __name__ == '__main__':
    main()
