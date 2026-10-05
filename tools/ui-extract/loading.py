"""Loading screen: cut the PO master (ref/loading.webp, 2000x1125) into game assets.

Output: src/ui/img/loading/*.webp + src/ui/menu/loadingArt.ts. Run: python3 tools/ui-extract/loading.py
The logo is the PO's logo file (shared with the main menu: src/ui/img/menu/logo.webp); here only its box is measured.
The bar becomes: an empty track (the red channel continued over the whole length), the blue fill as a 3-slice strip
and the white-blue spark at the fill end, separated as an additive layer (master minus the spark-free bar).
"""
from __future__ import annotations

import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402

REF = 'tools/ui-extract/ref/loading.webp'
OUT = os.path.join(uix.ROOT, 'src/ui/img/loading')
TS = os.path.join(uix.ROOT, 'src/ui/menu/loadingArt.ts')
DBG = os.path.join(uix.ROOT, '.cache/ui')

LOGO_BOX = (600, 80, 1370, 630)  # grabcut seed box around the baked logo
BAR = (604, 948, 1398, 1028)  # gold frame incl. shadow
CHANNEL_Y = (968, 1012)  # blue/red channel rows
SPARK_X = 998  # fill end in the master
BLUE_STRIP = (880, 940)  # clean columns of the blue fill
RED_STRIP = (1120, 1200)  # clean columns of the red (empty) track
CAP = 60  # rounded end of the bar (frame + channel), mirrored from the right end
LABEL = (806, 893, 1166, 960)  # "LOADING..." (native text in the game)


def main():
    os.makedirs(OUT, exist_ok=True)
    img = uix.load(REF)
    H, W = img.shape[:2]

    logo = uix.grabcut(img, LOGO_BOX)
    ys, xs = np.nonzero(logo)
    logo_box = (int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1))
    bar = uix.grabcut(img, (BAR[0] + 2, BAR[1] + 2, BAR[2] - 2, BAR[3] - 2), pad=24,
                      fg=uix.rect_mask(img.shape, (BAR[0] + 30, CHANNEL_Y[0], BAR[2] - 30, CHANNEL_Y[1])))
    label = uix.rect_mask(img.shape, LABEL)
    # the bar's soft gold glow leaks past any tight mask: the whole label+bar block is one rectangular hole
    block = uix.rect_mask(img.shape, (BAR[0] - 18, LABEL[1] - 6, BAR[2] + 18, BAR[3] + 14))
    hole = uix.dilate(logo, 10) | block | uix.dilate(bar | label, 10)
    cv2.imwrite(os.path.join(DBG, 'ld_hole.png'), hole)
    bg_path = os.path.join(DBG, 'ld_bg.png')
    if os.path.exists(bg_path) and os.environ.get('REUSE_BG'):
        bg = cv2.imread(bg_path)
    else:
        bg = uix.inpaint(img, hole, max_side=1024, ctx=0.5)
        cv2.imwrite(bg_path, bg)
    sprites = [uix.crop_sprite('bg', bg, None, OUT, '../img/loading', box=(0, 0, W, H), quality=88)]

    # empty track: red channel columns over the whole length, left end = mirrored right end
    x0, y0, x1, y1 = BAR
    track = uix.rebuild_bar(img, (x0, y0, x1, y1), RED_STRIP, cap=CAP)
    rgb, a = uix.matte(track, bg, bar, ring=8)
    sprites.append(uix.crop_sprite('track', rgb, a, OUT, '../img/loading', box=BAR))

    # blue fill: the channel between the left cap and the spark, as a strip with its own rounded left end
    cy0, cy1 = CHANNEL_Y
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    blue = ((hsv[..., 0] > 95) & (hsv[..., 0] < 130) & (hsv[..., 1] > 120)).astype(np.uint8) * 255
    blue[:cy0 - 2] = 0
    blue[cy1 + 2:] = 0
    blue[:, :x0] = 0
    blue[:, SPARK_X - 30:] = 0
    blue = cv2.morphologyEx(blue, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    blue = uix.fill_holes(uix.largest(blue))
    # continue the clean blue columns up to the spark (the master's glow sits on the last 30 px)
    fill = img.copy()
    col = img[cy0 - 2:cy1 + 2, BLUE_STRIP[0]:BLUE_STRIP[1]].astype(np.float32).mean(axis=1)
    fill[cy0 - 2:cy1 + 2, BLUE_STRIP[0]:SPARK_X] = col[:, None, :].astype(np.uint8)
    ext = np.zeros_like(blue)
    ext[:, BLUE_STRIP[0]:SPARK_X] = blue[:, BLUE_STRIP[0]:BLUE_STRIP[0] + 1].repeat(SPARK_X - BLUE_STRIP[0], axis=1)
    fa = cv2.GaussianBlur(blue | ext, (0, 0), 0.7)
    fx0 = int(np.nonzero(fa.max(axis=0) > 3)[0].min())
    sprites.append(uix.crop_sprite('fill', fill, fa, OUT, '../img/loading', box=(fx0, cy0 - 3, SPARK_X, cy1 + 3)))

    # spark: master minus the spark-free bar (blue left of the seam, red right of it) -> additive layer on black
    sx0, sx1 = SPARK_X - 60, SPARK_X + 60
    clean = img.copy()
    rcol = img[y0:y1, RED_STRIP[0]:RED_STRIP[1]].astype(np.float32).mean(axis=1)
    bcol = img[y0:y1, BLUE_STRIP[0]:BLUE_STRIP[1]].astype(np.float32).mean(axis=1)
    clean[y0:y1, sx0:SPARK_X] = bcol[:, None, :].astype(np.uint8)
    clean[y0:y1, SPARK_X:sx1] = rcol[:, None, :].astype(np.uint8)
    spark = np.clip(img.astype(np.int16) - clean.astype(np.int16), 0, 255).astype(np.uint8)
    spark[:y0] = 0
    spark[y1:] = 0
    spark[:, :sx0] = 0
    spark[:, sx1:] = 0
    spark = cv2.GaussianBlur(spark, (0, 0), 0.6)
    sprites.append(uix.crop_sprite('spark', spark, None, OUT, '../img/loading', box=(sx0, y0 - 8, sx1, y1)))
    sprites[-1].extra = {}

    uix.write_ts(TS, 'LD_ART', sprites, 'tools/ui-extract/loading.py',
                 extra={'LD_BOXES': {'logo': list(logo_box), 'label': list(LABEL), 'channel': [x0 + 26, cy0, x1 - 26, cy1], 'spark': SPARK_X}})
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f'{len(sprites)} sprites, {total / 1e6:.2f} MB, logo box {logo_box} ->', OUT)


if __name__ == '__main__':
    main()
