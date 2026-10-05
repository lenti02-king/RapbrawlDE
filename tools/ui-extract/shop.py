"""Shop: cut the PO master (ref/shop.webp, 2000x1125) into game assets.

Output: src/ui/img/shop/*.webp + src/ui/menu/shopArt.ts. Run: python3 tools/ui-extract/shop.py
- plate: the store (shelves, merch, logo, the gold SHOP banner — German as is) with all UI removed, outpainted 220 px
  per side; the Nike swooshes on the shelf sneakers are retouched out (third-party marks)
- top bar: back button, coin/diamond pills (numbers out), menu button
- tabs: the master's five tabs (SKINS selected, as drawn), labels removed; categories open with the real shop
- item cards (5) and the bundle: original art, names/prices/titles removed (native German text); the swooshes on the
  sneaker card, the bundle sneaker and the GEAR icon are retouched out; the bundle's "$19.99" goes (no real money)
"""
from __future__ import annotations

import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402

REF = 'tools/ui-extract/ref/shop.webp'
OUT = os.path.join(uix.ROOT, 'src/ui/img/shop')
TS = os.path.join(uix.ROOT, 'src/ui/menu/shopArt.ts')
DBG = os.path.join(uix.ROOT, '.cache/ui')
SIDE = 220

SWOOSHES = [  # (x0, y0, x1, y1) boxes, retouched with LaMa
    (172, 152, 206, 180), (195, 260, 228, 290), (16, 318, 50, 344), (8, 560, 40, 590),  # shelves
    (1744, 738, 1799, 792), (1685, 733, 1708, 764),  # sneaker card
    (1004, 830, 1040, 852),  # bundle sneaker
    (778, 512, 806, 532),  # GEAR tab icon
]
TOP = {
    'back': dict(box=(18, 10, 172, 102)),
    'coins': dict(box=(1298, 14, 1562, 96), num=(1368, 32, 1492, 80)),
    'gems': dict(box=(1564, 14, 1822, 96), num=(1652, 32, 1758, 80)),
    'menu': dict(box=(1838, 8, 1968, 102)),
}
TABS = {  # frame boxes; label zone y 548..590
    'skins': (352, 456, 610, 594), 'gear': (612, 458, 857, 592), 'emotes': (857, 458, 1105, 592),
    'currency': (1105, 458, 1353, 592), 'bundles': (1353, 458, 1632, 592),
}
LABEL_Y = (546, 590)
CARDS = {
    'champ': (200, 610, 414, 984), 'verse': (412, 610, 622, 984), 'flow': (618, 610, 828, 984),
    'gloves': (1392, 610, 1600, 984), 'kicks': (1598, 610, 1814, 984),
}
NAME_Y = (888, 925)
PRICE_Y = (929, 967)
BUNDLE = (834, 598, 1394, 1004)
BUNDLE_TEXT = {'ribbon': (856, 620, 968, 664), 'price': (970, 932, 1200, 990)}
BUNDLE_TITLE = (896, 612, 1350, 712)


def gold_mask(img, box):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    g = ((hsv[..., 0] >= 12) & (hsv[..., 0] <= 38) & (hsv[..., 1] > 90) & (hsv[..., 2] > 140)).astype(np.uint8) * 255
    g &= uix.rect_mask(img.shape, box)
    return uix.dilate(cv2.morphologyEx(g, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)), 5)


def framed(img, box, inset=10, pad=18):
    x0, y0, x1, y1 = box
    fg = uix.rect_mask(img.shape, (x0 + inset, y0 + inset, x1 - inset, y1 - inset))
    return uix.grabcut(img, box, pad=pad, fg=fg) | fg


def main():
    os.makedirs(OUT, exist_ok=True)
    img = uix.load(REF)
    H, W = img.shape[:2]

    # 0. swooshes out of the master first (everything below cuts from this retouched copy)
    sw = np.zeros((H, W), np.uint8)
    for b in SWOOSHES:
        x0, y0, x1, y1 = b
        cv2.ellipse(sw, ((x0 + x1) // 2, (y0 + y1) // 2), ((x1 - x0) // 2 + 2, (y1 - y0) // 2 + 2), 0, 0, 360, 255, -1)
    img = uix.inpaint(img, sw, max_side=512, ctx=2.5, min_ctx=40, feather=2)
    cv2.imwrite(os.path.join(DBG, 'sh_retouched.png'), img)

    masks = {}
    for k, v in TOP.items():
        masks[k] = framed(img, v['box'], inset=14, pad=14)
    for k, b in TABS.items():
        masks['tab_' + k] = framed(img, b, inset=12)
    for k, b in CARDS.items():
        masks['card_' + k] = framed(img, b, inset=14)
    masks['bundle'] = framed(img, BUNDLE, inset=16)

    hole = np.zeros((H, W), np.uint8)
    for m in masks.values():
        hole |= uix.dilate(m, 12)
    cv2.imwrite(os.path.join(DBG, 'sh_hole.png'), hole)
    bg_path = os.path.join(DBG, 'sh_wide.png')
    if os.path.exists(bg_path) and os.environ.get('REUSE_BG'):
        wide = cv2.imread(bg_path)
    else:
        bg0 = uix.inpaint(img, hole, max_side=1024, ctx=0.5)
        wide = uix.outpaint_sides(bg0, SIDE)
        cv2.imwrite(bg_path, wide)
    bg = wide[:, SIDE:SIDE + W]
    sprites = [uix.crop_sprite('bg', wide, None, OUT, '../img/shop', box=(0, 0, wide.shape[1], H), quality=86)]
    sprites[0].x = -SIDE

    def cut(sid, src, m, ring=10):
        rgb, a = uix.matte(src, bg, m, ring=ring)
        sprites.append(uix.crop_sprite(sid, rgb, a, OUT, '../img/shop', pad=1))

    # top bar
    for k, v in TOP.items():
        src = img
        if 'num' in v:
            src = cv2.inpaint(img, uix.text_mask(img, v['num'], thr=30, dil=3, k=31), 9, cv2.INPAINT_TELEA)
        cut(k, src, masks[k])

    # tabs: the master's tabs (SKINS selected, as drawn) with the labels removed
    for k, b in TABS.items():
        x0, y0, x1, y1 = b
        label = uix.text_mask(img, (x0 + 14, LABEL_Y[0], x1 - 14, LABEL_Y[1]), thr=28, dil=4, k=31)
        src = uix.inpaint_local(img, label & masks['tab_' + k], region=(x0 - 10, y0 - 10, x1 + 10, y1 + 10), max_side=1024, feather=1, whole=True)
        cut('tab_' + k, src, masks['tab_' + k], ring=14)

    # item cards
    price_x = {}
    for k, b in CARDS.items():
        x0, y0, x1, y1 = b
        tm = uix.text_mask(img, (x0 + 12, NAME_Y[0], x1 - 12, NAME_Y[1]), thr=28, dil=3, k=31)
        # price digits only: the coin/diamond icon (largest saturated blob in the row) stays
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        colored = (((hsv[..., 1] > 120) & (hsv[..., 2] > 110)).astype(np.uint8) * 255) & uix.rect_mask(img.shape, (x0 + 16, PRICE_Y[0], x1 - 16, PRICE_Y[1]))
        cys, cxs = np.nonzero(uix.largest(cv2.morphologyEx(colored, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))))
        tm |= uix.text_mask(img, (int(cxs.max()) + 4, PRICE_Y[0], x1 - 16, PRICE_Y[1]), thr=28, dil=3, k=31)
        price_x[k] = int(cxs.max()) + 6
        src = cv2.inpaint(img, tm & masks['card_' + k], 9, cv2.INPAINT_TELEA)
        cut('card_' + k, src, masks['card_' + k])

    # bundle
    tm = gold_mask(img, BUNDLE_TITLE)
    for z in BUNDLE_TEXT.values():
        tm |= uix.text_mask(img, z, thr=28, dil=4, k=31)
    x0, y0, x1, y1 = BUNDLE
    src = uix.inpaint_local(img, tm & masks['bundle'], region=(x0, y0, x1, y1), max_side=1024, feather=1, whole=True)
    cut('bundle', src, masks['bundle'])

    uix.write_ts(TS, 'SH_ART', sprites, 'tools/ui-extract/shop.py', extra={'SH_BOXES': {
        **{k: list(v) for k, v in TABS.items()}, **{f'card_{k}': list(v) for k, v in CARDS.items()},
        'labelY': list(LABEL_Y), 'nameY': list(NAME_Y), 'priceY': list(PRICE_Y), 'bundle': list(BUNDLE),
        'bundleTitle': list(BUNDLE_TITLE), **{f'bundle_{k}': list(v) for k, v in BUNDLE_TEXT.items()},
        'priceX': price_x, 'coinsNum': list(TOP['coins']['num']), 'gemsNum': list(TOP['gems']['num'])}})
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f'{len(sprites)} sprites, {total / 1e6:.2f} MB ->', OUT)


if __name__ == '__main__':
    main()
