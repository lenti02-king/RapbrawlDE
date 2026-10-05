"""Character select: cut the PO master (ref/char_select.webp, 2000x1125) into game assets.

Output: src/ui/img/select/*.webp + src/ui/menu/charSelectArt.ts. Run: python3 tools/ui-extract/char_select.py
The background keeps the master's banners, tile grid, name ribbon (incl. the gold VS) and logo. Removed: the two
pedestal silhouettes (the game puts the chosen fighters there), the baked names, the buttons (own sprites, text out).
The plate is outpainted (uix.extend_plate) so wide phones and tablets are filled edge to edge.
"""
from __future__ import annotations

import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402

REF = 'tools/ui-extract/ref/char_select.webp'
OUT = os.path.join(uix.ROOT, 'src/ui/img/select')
TS = os.path.join(uix.ROOT, 'src/ui/menu/charSelectArt.ts')
DBG = os.path.join(uix.ROOT, '.cache/ui')
SIDE, TOP = uix.PLATE_SIDE, uix.PLATE_TOP  # outpainted plate margins

FIGURES = [(150, 350, 585, 830), (1415, 345, 1855, 830)]  # pedestal silhouettes (removed)
NAMES = {  # baked texts on the ribbon (removed; native in the game)
    'p1_label': (676, 802, 796, 834), 'p1_name': (640, 832, 890, 905), 'p1_city': (712, 900, 838, 950),
    'p2_label': (1208, 802, 1336, 834), 'p2_name': (1094, 832, 1418, 905), 'p2_city': (1172, 900, 1306, 950),
}
BUTTONS = {
    'back': dict(box=(352, 984, 644, 1072), text=(472, 1004, 576, 1052)),  # the arrow icon stays
    'ready': dict(box=(1332, 980, 1662, 1080), text=(1366, 994, 1630, 1068)),
}
# portrait windows of the two tiles the roster uses (beveled squares, inside the tile frame)
TILES = {'p1': (801, 441, 916, 539), 'p2': (1081, 440, 1201, 539)}
PEDESTALS = {'p1': (165, 300, 565, 860), 'p2': (1435, 300, 1835, 860)}  # where the fighter renders stand


def figure_mask(img, box):
    x0, y0, x1, y1 = box
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    seed = np.zeros(img.shape[:2], np.uint8)
    v = hsv[y0:y1, x0:x1, 2]
    s = (v < 50).astype(np.uint8) * 255
    seed[y0:y1, x0:x1] = uix.largest(cv2.morphologyEx(s, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)))
    m = uix.grabcut(img, box, pad=10, fg=uix.erode(seed, 2))
    return uix.dilate(m | seed, 12)  # + the rim light around the figure


def main():
    os.makedirs(OUT, exist_ok=True)
    img = uix.load(REF)
    H, W = img.shape[:2]

    hole = np.zeros((H, W), np.uint8)
    for b in FIGURES:
        hole |= figure_mask(img, b)
    for z in NAMES.values():  # whole boxes: the brush strokes of the names have splashes a glyph mask misses
        hole |= uix.rect_mask(img.shape, (z[0] - 6, z[1] - 4, z[2] + 6, z[3] + 4))
    btn_masks = {}
    for k, b in BUTTONS.items():
        btn_masks[k] = uix.grabcut(img, b['box'], pad=16)
        hole |= uix.dilate(btn_masks[k], 10)
    cv2.imwrite(os.path.join(DBG, 'cs_hole.png'), hole)

    bg_path = os.path.join(DBG, 'cs_bg.png')
    if os.path.exists(bg_path) and os.environ.get('REUSE_BG'):
        bg = uix.center_crop_w(cv2.imread(bg_path), W)
    else:
        bg = uix.inpaint(img, hole, max_side=1024, ctx=0.5)
    cv2.imwrite(bg_path, bg)
    wide = uix.extend_plate(bg, os.path.join(DBG, 'cs_plate.png'))
    sprites = [uix.crop_sprite('bg', wide, None, OUT, '../img/select', box=(0, 0, wide.shape[1], wide.shape[0]), quality=86)]
    sprites[0].x, sprites[0].y = -SIDE, -TOP

    for k, b in BUTTONS.items():
        tm = uix.text_mask(img, b['text'], thr=30, dil=4, k=31) & btn_masks[k]
        x0, y0, x1, y1 = b['box']
        work = uix.inpaint_local(img, tm, region=(x0 - 10, y0 - 10, x1 + 10, y1 + 10), max_side=1024, feather=1, whole=True)
        rgb, a = uix.matte(work, bg, btn_masks[k], ring=10)
        sprites.append(uix.crop_sprite(k, rgb, a, OUT, '../img/select', pad=1))

    uix.write_ts(TS, 'CS_ART', sprites, 'tools/ui-extract/char_select.py',
                 extra={'CS_BOXES': {**{k: list(v) for k, v in NAMES.items()}, **{f'tile_{k}': list(v) for k, v in TILES.items()},
                                     **{f'ped_{k}': list(v) for k, v in PEDESTALS.items()},
                                     **{f'{k}_text': list(b['text']) for k, b in BUTTONS.items()}, 'side': SIDE, 'top': TOP}})
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f'{len(sprites)} sprites, {total / 1e6:.2f} MB ->', OUT)


if __name__ == '__main__':
    main()
