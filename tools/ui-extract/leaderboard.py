"""Leaderboard + the shared panel kit, cut from the PO master (ref/leaderboard.webp, 2000x1125).

Output: src/ui/img/board/*.webp + src/ui/menu/boardArt.ts. Run: python3 tools/ui-extract/leaderboard.py
- plate: the stadium with the three panels, every text removed (title, tier labels, table header + rows, stats,
  buttons), row 6 ("You") normalised to a plain row; the "You" row background is its own sprite
- kit (used by every other menu screen, D38): `backdrop` (stadium without panels, outpainted), `panel` (the table's
  frame with an empty interior, 9-slice), `side` (the tier panel's frame, 9-slice), `btn_blue` / `btn_gold`
  (ZURÜCK / SEASON REWARDS buttons without text; icons removed so they can carry any label)
"""
from __future__ import annotations

import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402

REF = 'tools/ui-extract/ref/leaderboard.webp'
OUT = os.path.join(uix.ROOT, 'src/ui/img/board')
TS = os.path.join(uix.ROOT, 'src/ui/menu/boardArt.ts')
DBG = os.path.join(uix.ROOT, '.cache/ui')

PANELS = {'tiers': (84, 333, 390, 830), 'table': (407, 403, 1454, 1029), 'stats': (1474, 378, 1927, 920)}
SEASON = (1500, 946, 1942, 1057)
BACK = (68, 983, 364, 1064)
TITLE = (668, 288, 1420, 402)
LOGO = (760, 0, 1230, 286)
# text zones (removed; native in the game)
TEXT = [
    (160, 350, 322, 388),  # RANK TIERS
    (226, 432, 360, 800),  # tier labels
    (430, 408, 1300, 440),  # table header
    (470, 455, 525, 690),  # laurel digits rows 1-3
    (484, 700, 524, 1010),  # rank numbers 4-8
    (690, 455, 1000, 1020),  # player names + mottos
    (1030, 455, 1112, 1012),  # wins
    (1176, 455, 1296, 1012),  # rating values
    (1504, 398, 1680, 434),  # YOUR STATS
    (1676, 462, 1900, 534),  # name + motto
    (1508, 596, 1700, 790),  # stat labels
    (1764, 596, 1900, 790),  # stat values
    (1708, 764, 1762, 822),  # "Epic Crate"
    (1620, 968, 1900, 1032),  # SEASON REWARDS
    (180, 992, 300, 1040),  # BACK
    (440, 840, 486, 872),  # "You" tag
]
ROW_Y = [(450, 536), (544, 612), (618, 690), (696, 758), (760, 822), (826, 890), (890, 952), (954, 1016)]
ROW_X = (412, 1450)
AVATAR_X = (588, 668)


def gold_mask(img, box):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    g = ((hsv[..., 0] >= 10) & (hsv[..., 0] <= 40) & (hsv[..., 1] > 80) & (hsv[..., 2] > 110)).astype(np.uint8) * 255
    g &= uix.rect_mask(img.shape, box)
    return uix.dilate(cv2.morphologyEx(g, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)), 6)


def empty_interior(img, inner, base_from):
    """Panel frame with a plain interior: the `inner` rect replaced by a smooth vertical gradient sampled from
    `base_from` (a clean strip of the same glass) plus a little grain."""
    x0, y0, x1, y1 = inner
    out = img.copy()
    bx0, by0, bx1, by1 = base_from
    col = img[by0:by1, bx0:bx1].astype(np.float32).mean(axis=1)  # (h, 3) gradient along y
    ih = y1 - y0
    grad = cv2.resize(col[:, None, :], (1, ih), interpolation=cv2.INTER_LINEAR)[:, 0, :]
    rng = np.random.default_rng(3)
    noise = cv2.GaussianBlur(rng.normal(0, 3.0, (ih, x1 - x0)).astype(np.float32), (0, 0), 0.8)[..., None]
    fill = np.clip(grad[:, None, :] + noise, 0, 255).astype(np.uint8)
    out[y0:y1, x0:x1] = fill
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    img = uix.load(REF)
    H, W = img.shape[:2]

    # ---- leaderboard plate
    # row 6 ("You") -> copy of row 7's background (same height band); texts are masked AFTER the copy
    work = img.copy()
    (a0, a1), (b0, b1) = ROW_Y[5], ROW_Y[6]
    you = img[a0:a1, ROW_X[0]:ROW_X[1]].copy()
    h = min(a1 - a0, b1 - b0)
    pad = 5  # the highlighted row glows a few px beyond its band
    work[a0 - pad:a0 + h + pad, ROW_X[0] - 4:ROW_X[1] + 4] = img[b0 - pad:b0 + h + pad, ROW_X[0] - 4:ROW_X[1] + 4]
    tm = np.zeros((H, W), np.uint8)
    for z in TEXT:
        tm |= uix.text_mask(work, z, thr=24, dil=3, k=31)
    title = gold_mask(img, TITLE)
    # text sits on horizontally banded glass: scanline interpolation keeps the gloss; the gold title (photo
    # background) goes through LaMa
    plate = uix.fill_scanlines(work, tm & ~title)
    plate = uix.inpaint(plate, title, max_side=1024, ctx=0.4, feather=2)
    cv2.imwrite(os.path.join(DBG, 'lb_plate.png'), plate)
    sprites = [uix.crop_sprite('plate', plate, None, OUT, '../img/board', box=(0, 0, W, H), quality=86)]
    # the "You" row background without its texts
    ytm = np.zeros((H, W), np.uint8)
    for z in TEXT:
        ytm |= uix.text_mask(img, z, thr=24, dil=3, k=31)
    you_clean = uix.fill_scanlines(img, ytm)[a0:a1, ROW_X[0]:ROW_X[1]]
    ya = np.full(you_clean.shape[:2], 255, np.uint8)
    uix.save_rgba(os.path.join(OUT, 'you_row.webp'), you_clean, ya)
    sprites.append(uix.Sprite('you_row', ROW_X[0], a0, ROW_X[1] - ROW_X[0], a1 - a0, '../img/board/you_row.webp'))

    # ---- kit: backdrop without panels/title/buttons (outpainted)
    hole = np.zeros((H, W), np.uint8)
    for b in list(PANELS.values()) + [SEASON, BACK]:
        hole |= uix.rect_mask(img.shape, (b[0] - 16, b[1] - 16, b[2] + 16, b[3] + 16))
    hole |= uix.dilate(gold_mask(img, (TITLE[0] - 120, TITLE[1], TITLE[2], TITLE[3])), 8)
    bd_path = os.path.join(DBG, 'lb_backdrop.png')
    if os.path.exists(bd_path) and os.environ.get('REUSE_BG'):
        bd = cv2.imread(bd_path)
    else:
        bd = uix.inpaint(img, hole, max_side=1024, ctx=0.5)
        cv2.imwrite(bd_path, bd)
    wide = uix.extend_plate(bd, os.path.join(DBG, 'lb_backdrop_plate.png'))
    sp = uix.crop_sprite('backdrop', wide, None, OUT, '../img/board', box=(0, 0, wide.shape[1], wide.shape[0]), quality=84)
    sp.x, sp.y = -uix.PLATE_SIDE, -uix.PLATE_TOP
    sprites.append(sp)

    # ---- kit: 9-slice panel frames with empty interiors
    def framed(box, inset=12):
        x0, y0, x1, y1 = box
        fg = uix.rect_mask(img.shape, (x0 + inset, y0 + inset, x1 - inset, y1 - inset))
        return uix.grabcut(img, box, pad=16, fg=fg) | fg

    def frame(sid, box, inner, base_from):
        m = framed(box)
        e = empty_interior(img, inner, base_from)
        rgb, a = uix.matte(e, bd, m, ring=10)
        sprites.append(uix.crop_sprite(sid, rgb, a, OUT, '../img/board', pad=1))

    frame('panel', PANELS['table'], (416, 406, 1447, 1024), (1480, 440, 1494, 830))
    frame('side', PANELS['tiers'], (92, 342, 383, 824), (1480, 440, 1494, 830))

    # ---- kit: buttons without text and icons
    def button(sid, box, zones):
        m = framed(box, 10)
        z = np.zeros((H, W), np.uint8)
        for t in zones:
            z |= uix.rect_mask(img.shape, t)
        x0, y0, x1, y1 = box
        clean = uix.inpaint_local(img, z & uix.erode(m, 8), region=(x0 - 8, y0 - 8, x1 + 8, y1 + 8), max_side=1024, feather=1, whole=True)
        rgb, a = uix.matte(clean, bd, m, ring=10)
        sprites.append(uix.crop_sprite(sid, rgb, a, OUT, '../img/board', pad=1))

    button('btn_blue', BACK, [(96, 994, 300, 1052)])
    button('btn_gold', SEASON, [(1550, 964, 1906, 1036)])

    uix.write_ts(TS, 'LB_ART', sprites, 'tools/ui-extract/leaderboard.py', extra={'LB_BOXES': {
        'rows': [list(r) for r in ROW_Y], 'rowX': list(ROW_X), 'avatarX': list(AVATAR_X), 'title': list(TITLE),
        **{k: list(v) for k, v in PANELS.items()}, 'season': list(SEASON), 'back': list(BACK)}})
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f'{len(sprites)} sprites, {total / 1e6:.2f} MB ->', OUT)


if __name__ == '__main__':
    main()
