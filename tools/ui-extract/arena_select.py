"""Arena select: cut the PO master (ref/arena_select.webp, 2000x1125) into game assets.

Output: src/ui/img/arenasel/*.webp + src/ui/menu/arenaSelectArt.ts. Run: python3 tools/ui-extract/arena_select.py
- plate: the street with the logo, title banner (lettering removed -> native "ARENA-WAHL"), the info panel (texts
  removed, icons + divider kept), the tile row and both buttons removed
- preview: the master's preview frame (incl. mic, glove, taped post) as an overlay with a transparent window; the
  arena thumbnail sits underneath
- tiles: normal (blue) and selected (red + crown) frames with a transparent window; the master's "?" interior (name
  removed) is the picture for locked arenas
- buttons: ZURÜCK (blue) / ARENA WÄHLEN (red), lettering removed, chevrons kept
"""
from __future__ import annotations

import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402

REF = 'tools/ui-extract/ref/arena_select.webp'
OUT = os.path.join(uix.ROOT, 'src/ui/img/arenasel')
TS = os.path.join(uix.ROOT, 'src/ui/menu/arenaSelectArt.ts')
DBG = os.path.join(uix.ROOT, '.cache/ui')
SIDE = 220  # outpainted margin per side (19.5:9 phones)

PREVIEW = (358, 368, 1222, 784)  # frame overlay crop (mic + glove + post included; stops above the tile row)
PREVIEW_SEED = (600, 450)
TITLE = (700, 296, 1282, 394)  # gold brush lettering "ARENA SELECT"
INFO = {  # baked texts in the info panel (whole boxes: the panel is flat)
    'name': (1248, 414, 1608, 462), 'district': (1294, 476, 1504, 508), 'desc': (1246, 520, 1610, 608),
    'labels': (1296, 626, 1388, 746), 'values': (1438, 626, 1552, 746),
}
CAR_BADGES = [(328, 660, 7, 8), (343, 677, 6, 6)]  # hood ornament + grille emblem on the car (third-party marks, removed)
TILE_X0, TILE_DX, TILE_Y = 357, 213.3, (786, 960)
TILE_W = 207
BUTTONS = {
    'back': dict(box=(46, 980, 476, 1082), text=(250, 1006, 366, 1054)),
    'go': dict(box=(1420, 974, 1952, 1082), text=(1514, 1004, 1792, 1056)),
}


def tile_box(k: int, pad=0):
    x0 = int(round(TILE_X0 + TILE_DX * k))
    return (x0 - pad, TILE_Y[0] - pad, x0 + TILE_W + pad, TILE_Y[1] + pad)


def flood(img, seed, tol, lim):
    H, W = img.shape[:2]
    b = cv2.GaussianBlur(img, (0, 0), 1.5)
    m = np.ones((H + 2, W + 2), np.uint8)
    x0, y0, x1, y1 = lim
    m[y0 + 1:y1 + 1, x0 + 1:x1 + 1] = 0
    cv2.floodFill(b, m, seed, (0, 0, 0), (tol,) * 3, (tol,) * 3, cv2.FLOODFILL_MASK_ONLY | (2 << 8) | 8)
    return uix.fill_holes((m[1:-1, 1:-1] == 2).astype(np.uint8) * 255)


def preview_window(img):
    lab = cv2.cvtColor(cv2.GaussianBlur(img, (0, 0), 2), cv2.COLOR_BGR2LAB).astype(np.float32)
    mu = np.median(lab[430:520, 480:700].reshape(-1, 3), axis=0)
    d = np.sqrt(((lab - mu) ** 2 * np.array([0.3, 1, 1])).sum(axis=2))
    m = (d < 18).astype(np.uint8) * 255
    lim = uix.rect_mask(img.shape, (385, 385, 1212, 775))
    m = cv2.morphologyEx(m & lim, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    _, lb, _, _ = cv2.connectedComponentsWithStats(m)
    m = np.where(lb == lb[PREVIEW_SEED[1], PREVIEW_SEED[0]], 255, 0).astype(np.uint8)
    m = uix.fill_holes(cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8)))
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))
    return cv2.morphologyEx(cv2.morphologyEx(m, cv2.MORPH_OPEN, k), cv2.MORPH_CLOSE, k)


def gold_mask(img, box):
    x0, y0, x1, y1 = box
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    g = ((hsv[..., 0] >= 12) & (hsv[..., 0] <= 38) & (hsv[..., 1] > 90) & (hsv[..., 2] > 120)).astype(np.uint8) * 255
    g &= uix.rect_mask(img.shape, box)
    g = cv2.morphologyEx(g, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    return uix.dilate(g, 6)  # + the dark outline around the letters


def main():
    os.makedirs(OUT, exist_ok=True)
    img = uix.load(REF)
    H, W = img.shape[:2]

    # tiles: outer masks (plate holes) and windows
    tiles, wins = [], []
    for k in range(6):
        b = tile_box(k)
        tiles.append(uix.grabcut(img, (b[0] - (8 if k == 0 else 0), b[1] - (26 if k == 0 else 0), b[2] + (8 if k == 0 else 0), b[3]), pad=20))
        cx = (b[0] + b[2]) // 2
        wins.append(flood(img, (cx - 60, 830), 10, (b[0] + 4, b[1] + 4, b[2] - 4, b[3] - 4)))
    btn = {k: uix.grabcut(img, v['box'], pad=16) for k, v in BUTTONS.items()}

    hole = np.zeros((H, W), np.uint8)
    for m in tiles:
        hole |= uix.dilate(m, 14)
    for m in btn.values():
        hole |= uix.dilate(m, 12)
    hole |= gold_mask(img, TITLE)
    for z in INFO.values():
        hole |= uix.rect_mask(img.shape, z)
    for cx, cy, rx, ry in CAR_BADGES:
        cv2.ellipse(hole, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)
    cv2.imwrite(os.path.join(DBG, 'as_hole.png'), hole)
    bg_path = os.path.join(DBG, 'as_bg.png')
    if os.path.exists(bg_path) and os.environ.get('REUSE_BG'):
        bg = cv2.imread(bg_path)
    else:
        # the info panel is flat: a smooth fill beats LaMa there (which invents dotted lines)
        info = np.zeros((H, W), np.uint8)
        for z in INFO.values():
            info |= uix.rect_mask(img.shape, z)
        bg = cv2.inpaint(np.where(info[..., None] > 0, 0, img).astype(np.uint8), info, 9, cv2.INPAINT_TELEA)
        bg = np.where(info[..., None] > 0, bg, uix.inpaint(img, hole & ~info, max_side=1024, ctx=0.5)).astype(np.uint8)
        cv2.imwrite(bg_path, bg)
    wpath = os.path.join(DBG, 'as_wide.png')
    if os.path.exists(wpath) and os.environ.get('REUSE_BG'):
        wide = cv2.imread(wpath)
    else:
        wide = uix.outpaint_sides(bg, SIDE)
        cv2.imwrite(wpath, wide)
    sprites = [uix.crop_sprite('bg', wide, None, OUT, '../img/arenasel', box=(0, 0, wide.shape[1], H), quality=86)]
    sprites[0].x = -SIDE

    # preview frame overlay: master pixels, window transparent (soft edge)
    win = preview_window(img)
    a = 255 - cv2.GaussianBlur(win, (0, 0), 1.2)
    a = np.where(uix.dilate(tiles[0], 4) > 0, 0, a).astype(np.uint8)  # the selected tile's crown is not part of the frame
    sprites.append(uix.crop_sprite('preview', img, a, OUT, '../img/arenasel', box=PREVIEW))
    ys, xs = np.nonzero(win)
    pwin = [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]

    # tile frames: selected (tile 0) and normal (tile 1), windows transparent
    for sid, k in (('tile_on', 0), ('tile', 1)):
        rgb, al = uix.matte(img, bg, tiles[k], ring=12)
        al = np.where(uix.erode(wins[k], 1) > 0, 0, al).astype(np.uint8)
        sprites.append(uix.crop_sprite(sid, rgb, al, OUT, '../img/arenasel', pad=1))
    ys, xs = np.nonzero(wins[1])
    twin = [int(xs.min()) - tile_box(1)[0], int(ys.min()) - TILE_Y[0], int(xs.max() + 1) - tile_box(1)[0], int(ys.max() + 1) - TILE_Y[0]]
    # locked picture: tile 1's interior without its name
    tb = tile_box(1)
    name = uix.text_mask(img, (tb[0] + 14, 892, tb[2] - 14, 952), thr=26, dil=3, k=31)
    clean = uix.inpaint_local(img, name, region=(tb[0], tb[1], tb[2], tb[3]), feather=1, whole=True)
    wx0, wy0, wx1, wy1 = twin
    sprites.append(uix.crop_sprite('locked', clean, None, OUT, '../img/arenasel', box=(tb[0] + wx0, TILE_Y[0] + wy0, tb[0] + wx1, TILE_Y[0] + wy1)))

    for k, v in BUTTONS.items():
        tm = uix.text_mask(img, v['text'], thr=30, dil=4, k=31) & btn[k]
        x0, y0, x1, y1 = v['box']
        work = uix.inpaint_local(img, tm, region=(x0 - 10, y0 - 10, x1 + 10, y1 + 10), feather=1, whole=True)
        rgb, al = uix.matte(work, bg, btn[k], ring=10)
        sprites.append(uix.crop_sprite(k, rgb, al, OUT, '../img/arenasel', pad=1))

    uix.write_ts(TS, 'AS_ART', sprites, 'tools/ui-extract/arena_select.py', extra={'AS_BOXES': {
        'previewWindow': pwin, 'tileWindow': twin, 'tiles': [list(tile_box(k)) for k in range(6)], 'title': list(TITLE),
        **{k: list(v) for k, v in INFO.items()}, **{f'{k}_text': list(v['text']) for k, v in BUTTONS.items()}}})
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f'{len(sprites)} sprites, {total / 1e6:.2f} MB ->', OUT)


if __name__ == '__main__':
    main()
