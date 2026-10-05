"""Game-mode tile pictures (interim): crops of the PO's clean master plates, one scene per mode, until the PO's
mode artworks (docs/ASSET_PROMPTS.md §11) arrive — then drop those in as src/ui/img/modes/<id>.webp (same names).
Run after the screen scripts (needs .cache/ui/*_bg.png): python3 tools/ui-extract/modes.py
"""
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402

OUT = os.path.join(uix.ROOT, 'src/ui/img/modes')
C = os.path.join(uix.ROOT, '.cache/ui')
W, H = 760, 420  # covers the tile window (~1.18:1) and the preview window (~2.1:1) with object-fit: cover


def crop(name, box):
    img = cv2.imread(os.path.join(C, name))
    x0, y0, x1, y1 = box
    c = img[y0:y1, x0:x1]
    s = max(W / c.shape[1], H / c.shape[0])
    c = cv2.resize(c, (int(c.shape[1] * s + 0.5), int(c.shape[0] * s + 0.5)), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
    oy, ox = (c.shape[0] - H) // 2, (c.shape[1] - W) // 2
    return c[oy:oy + H, ox:ox + W]


def split(a, b):
    """Two scenes side by side with a slanted seam (P1 | P2)."""
    out = a.copy()
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array([(W // 2 + 40, 0), (W, 0), (W, H), (W // 2 - 40, H)])], 255)
    m = cv2.GaussianBlur(m, (0, 0), 2)[..., None] / 255.0
    out = (a * (1 - m) + b * m).astype(np.uint8)
    cv2.line(out, (W // 2 + 40, 0), (W // 2 - 40, H), (60, 200, 255), 3, cv2.LINE_AA)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    tiles = {
        'quick': crop('ld_bg.png', (520, 240, 1480, 770)),
        'ranked': crop('cs_bg.png', (700, 780, 1300, 1010)),
        'friend': crop('as_bg.png', (1400, 0, 2000, 330)),
        'local': split(crop('cs_bg.png', (200, 40, 640, 560)), crop('cs_bg.png', (1360, 40, 1800, 560))),
        'training': crop('sh_bg.png', (1600, 360, 2000, 720)),
        'koop': crop('mm_bg.png', (0, 380, 760, 900)),
    }
    for k, im in tiles.items():
        uix.save_rgba(os.path.join(OUT, f'{k}.webp'), im, None, quality=86)
    print('mode tiles ->', OUT, sorted(tiles))


if __name__ == '__main__':
    main()
