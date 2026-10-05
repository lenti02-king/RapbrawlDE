"""Main menu: cut the PO's master screenshot (ref/main_menu.webp, 2000x1125) into game assets.

Output: src/ui/img/menu/*.webp + src/ui/menu/mainMenuArt.ts (sprite table in reference coordinates).
Run:    python3 tools/ui-extract/main_menu.py            (LaMa needs torch + .cache/lama/big-lama.pt, see README)
Debug:  .cache/ui/mm_*.png (masks, background plate, overlays)

Every coordinate below is in reference pixels. Text zones are where baked English text sits; it is removed from
the art and re-set as native (German) text by src/ui/menu/mainMenu.ts at the same boxes.
"""
from __future__ import annotations

import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402

REF = 'tools/ui-extract/ref/main_menu.webp'
OUT = os.path.join(uix.ROOT, 'src/ui/img/menu')
TS = os.path.join(uix.ROOT, 'src/ui/menu/mainMenuArt.ts')
DBG = os.path.join(uix.ROOT, '.cache/ui')

# id: grabcut box, text zones to remove (name -> box), extra removal polygons/boxes, transparent slot polygons
ELEMENTS = {
    'player': dict(frame=[(48, 24, 176, 138), (180, 32, 602, 122)], box=(38, 10, 608, 148),
                   text={'name': (190, 30, 302, 74), 'level': (190, 76, 270, 108), 'xp': (422, 80, 520, 106)},
                   bars=[((275, 75, 521, 110), (372, 424))],  # XP fill + numbers -> empty track (fill is its own sprite)
                   slot=[(57, 26), (177, 33), (171, 139), (48, 133)],
                   clip=[(40, 17), (186, 27), (186, 148), (38, 148)]),  # avatar frame outline (drops the hair overflow)
    'coins': dict(frame=[(1282, 30, 1506, 98)], box=(1280, 28, 1508, 100), text={'amount': (1344, 42, 1436, 82)}, flat=['amount']),
    'gems': dict(frame=[(1526, 30, 1750, 98)], box=(1524, 28, 1752, 100), text={'amount': (1589, 42, 1650, 82)}, flat=['amount']),
    'bell': dict(frame=[(1773, 30, 1862, 98)], box=(1771, 22, 1866, 100), text={}, remove=[(1826, 20, 1866, 54)]),  # badge -> own sprite
    'gear': dict(frame=[(1883, 30, 1972, 98)], box=(1881, 28, 1974, 100), text={}),
    'quick': dict(frame=[(36, 213, 526, 350)], box=(34, 190, 528, 352), text={'title': (252, 240, 470, 294), 'sub': (252, 295, 464, 323)}),
    'online': dict(frame=[(36, 362, 526, 495)], box=(34, 360, 528, 497), text={'title': (254, 382, 386, 432), 'sub': (254, 435, 484, 462)}),
    'friend': dict(frame=[(36, 505, 526, 640)], box=(34, 503, 528, 642), text={'title': (254, 521, 440, 571), 'sub': (254, 574, 472, 602)}),
    'ranked': dict(frame=[(1475, 222, 1970, 350)], box=(1473, 220, 1972, 352), text={'title': (1686, 249, 1838, 297), 'sub': (1686, 298, 1874, 327)}),
    'leader': dict(frame=[(1475, 365, 1970, 490)], box=(1473, 350, 1972, 492), text={'title': (1686, 388, 1908, 434), 'sub': (1686, 435, 1906, 466)}),
    'mode': dict(frame=[(1475, 500, 1970, 660)], box=(1473, 498, 1972, 662),
                 text={'label': (1501, 511, 1643, 536), 'name': (1495, 536, 1686, 577),
                       'status': (1554, 592, 1738, 618), 'wait': (1554, 621, 1708, 647)},
                 remove=[(1494, 587, 1550, 647)]),  # spinner ring -> own (rotating) sprite
    'play': dict(frame=[(1472, 672, 1968, 810)], box=(1470, 666, 1970, 812), text={}, remove_poly=[[(1576, 683), (1880, 683), (1864, 791), (1560, 791)]]),
    'pass': dict(frame=[(30, 960, 546, 1112)], box=(28, 940, 548, 1118),
                 text={'title': (154, 968, 364, 1015), 'level': (66, 1004, 116, 1052), 'progress': (284, 1027, 370, 1058)},
                 grad=[([(58, 1003), (121, 1003), (119, 1040), (91, 1059), (61, 1040)], (60, 1003, 70, 1008), (84, 1050, 98, 1056))],
                 text_skip=['level'],  # shield digits: plain gradient fill (LaMa invents a glyph there)
                 bars=[((159, 1024, 373, 1062), (270, 285))]),  # gold fill + numbers -> empty track (fill = own sprite)
    'tab_chars': dict(frame=[(614, 962, 818, 1104)], box=(612, 958, 820, 1108), text={'label': (642, 1044, 788, 1080)}),
    'tab_arenas': dict(frame=[(820, 962, 1000, 1104)], box=(818, 958, 1002, 1108), text={'label': (862, 1044, 954, 1082)}),
    'tab_modes': dict(frame=[(1002, 962, 1184, 1104)], box=(1000, 958, 1186, 1108), text={'label': (1048, 1046, 1130, 1080)}),
    'tab_shop': dict(frame=[(1186, 962, 1358, 1104), (1358, 975, 1388, 1092)], box=(1184, 958, 1390, 1108), text={'label': (1236, 1046, 1304, 1080)},
                     ),  # frame incl. the thin end cap of the nav bar
    'event': dict(frame=[(1454, 952, 1976, 1112)], box=(1452, 940, 1978, 1118), text={'title': (1598, 953, 1778, 992), 'sub': (1782, 1050, 1928, 1078)}),
}
LOGO_REF_BOX = (775, 12, 1258, 388)
MERCEDES_STAR = (1302, 687, 13, 14)  # centre x, y, radii: third-party logo on the car grille, removed (PO decision)

# small sprites cut from the untouched reference (dynamic parts)
PARTS = {
    'xp_fill': dict(box=(274, 78, 368, 106), key='bright'),
    'pass_fill': dict(box=(156, 1027, 274, 1060), key='bright'),
    'spinner': dict(box=(1494, 587, 1550, 647), key='ring'),
    'badge': dict(box=(1826, 20, 1866, 54), key='grabcut'),
    'avatar': dict(box=(46, 24, 180, 141), key='slot'),  # default profile picture (sits behind the frame window)
}


def element_masks(img):
    masks = {}
    for k, e in ELEMENTS.items():
        # the frame interior is definitely foreground; GrabCut only decides the bevel edge and overhanging art
        fg = np.zeros(img.shape[:2], np.uint8)
        for r in e['frame']:
            fg |= uix.erode(uix.rect_mask(img.shape, r), 8)
        m = uix.grabcut(img, e['box'], fg=fg) | fg
        if 'clip' in e:
            x0 = min(p[0] for p in e['clip'])
            x1 = max(p[0] for p in e['clip'])
            keep = uix.poly_mask(img.shape, e['clip'])
            band = np.zeros_like(m)
            band[:, x0:x1 + 1] = 255
            m = np.where(band > 0, m & keep, m)
        masks[k] = m
    return masks


def logo_ref_mask(img):
    return uix.grabcut(img, LOGO_REF_BOX)


def text_masks(img, e, flat=False):
    """LaMa mask (flat=False) or the mask of the zones listed in e['flat'] (smooth OpenCV fill, flat=True)."""
    out = np.zeros(img.shape[:2], np.uint8)
    for n, z in e.get('text', {}).items():
        if n in e.get('text_skip', []):
            continue
        if (n in e.get('flat', [])) == flat:
            out |= uix.text_mask(img, z, thr=30, dil=4, k=31)
    if flat:
        return out
    for outer, _ in e.get('bars', []):  # rebuilt, not inpainted
        out[outer[1]:outer[3], outer[0]:outer[2]] = 0
    for r in e.get('remove', []):
        out |= uix.rect_mask(img.shape, r)
    for p in e.get('remove_poly', []):
        out |= uix.poly_mask(img.shape, p)
    return out


def part_sprite(img, key, box):
    x0, y0, x1, y1 = box
    c = img[y0:y1, x0:x1]
    hsv = cv2.cvtColor(c, cv2.COLOR_BGR2HSV)
    if key == 'bright':
        a = np.clip((hsv[..., 2].astype(np.float32) - 70) * 3.0, 0, 255)
        a = cv2.GaussianBlur(a, (0, 0), 0.6)
    elif key == 'ring':
        a = np.clip((np.maximum(hsv[..., 1].astype(np.float32), hsv[..., 2].astype(np.float32) * 0.7) - 90) * 2.5, 0, 255)
        a *= (hsv[..., 2] > 60)
    elif key == 'slot':
        m = uix.dilate(uix.poly_mask(img.shape, ELEMENTS['player']['slot']), 2)[y0:y1, x0:x1]
        a = m.astype(np.float32)
    else:
        m = uix.grabcut(img, box, pad=8)[y0:y1, x0:x1]
        a = cv2.GaussianBlur(m, (0, 0), 0.7).astype(np.float32)
    return c, a.astype(np.uint8)


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(DBG, exist_ok=True)
    img = uix.load(REF)
    H, W = img.shape[:2]

    masks = element_masks(img)
    union = np.zeros((H, W), np.uint8)
    for m in masks.values():
        union |= m
    lm = logo_ref_mask(img)
    cx, cy, rx, ry = MERCEDES_STAR
    star = np.zeros((H, W), np.uint8)
    cv2.ellipse(star, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)
    # close small gaps (e.g. between the currency pills) so LaMa never sees half a UI edge as context
    hole = cv2.morphologyEx(uix.dilate(union | lm, 12), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))) | star
    cv2.imwrite(os.path.join(DBG, 'mm_hole.png'), hole)

    bg_path = os.path.join(DBG, 'mm_bg.png')
    if os.path.exists(bg_path) and os.environ.get('REUSE_BG'):
        bg = cv2.imread(bg_path)
    else:
        bg = uix.inpaint(img, hole, max_side=1024, ctx=0.5)
        # second, full-resolution pass over the seams of the big holes sharpens the fill
        cv2.imwrite(bg_path, bg)

    sprites = [uix.crop_sprite('bg', bg, None, OUT, '../img/menu', box=(0, 0, W, H), quality=90)]
    sprites[0].id = 'bg'
    text_boxes = {}
    dbg = img.copy()
    for k, e in ELEMENTS.items():
        tm = text_masks(img, e)
        x0, y0, x1, y1 = e['box']
        region = (max(0, x0 - 16), max(0, y0 - 16), min(W, x1 + 16), min(H, y1 + 16))
        src = img
        for outer, strip in e.get('bars', []):
            src = uix.rebuild_bar(src, outer, strip)
        for poly, tb, bb in e.get('grad', []):
            src = uix.fill_gradient(src, poly, tb, bb)
        fm = text_masks(img, e, flat=True)
        if fm.any():
            src = cv2.inpaint(src, fm, 9, cv2.INPAINT_TELEA)
        work = uix.inpaint_local(src, tm & uix.dilate(masks[k], 2), region=region, max_side=1024, feather=1, whole=True)
        rgb, a = uix.matte(work, bg, masks[k], ring=10)
        if 'slot' in e:
            slot = uix.poly_mask(img.shape, e['slot'])
            a = np.where(slot > 0, 0, a).astype(np.uint8)
        sp = uix.crop_sprite(k, rgb, a, OUT, '../img/menu', pad=1)
        sprites.append(sp)
        text_boxes[k] = {n: list(z) for n, z in e.get('text', {}).items()}
        if 'slot' in e:
            text_boxes[k]['slot'] = [list(p) for p in e['slot']]
        cnts, _ = cv2.findContours(masks[k], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cv2.drawContours(dbg, cnts, -1, (0, 255, 0), 1)
        tc, _ = cv2.findContours(tm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cv2.drawContours(dbg, tc, -1, (255, 0, 255), 1)
    for k, p in PARTS.items():
        c, a = part_sprite(img, p['key'], p['box'])
        full_rgb = np.zeros_like(img)
        full_a = np.zeros((H, W), np.uint8)
        x0, y0, x1, y1 = p['box']
        full_rgb[y0:y1, x0:x1] = c
        full_a[y0:y1, x0:x1] = a
        if k == 'badge':  # digit out, the count is native text
            tm = uix.text_mask(img, (1838, 27, 1854, 48), thr=50, dil=1)
            full_rgb = uix.inpaint_local(full_rgb, tm, region=(x0, y0, x1, y1), feather=1, whole=True)
        sprites.append(uix.crop_sprite(k, full_rgb, full_a, OUT, '../img/menu', box=p['box']))
    cv2.imwrite(os.path.join(DBG, 'mm_masks.png'), dbg)

    # PO logo (separate file, on black): opaque silhouette incl. its dark outline, feathered edge
    logo = uix.load('tools/ui-extract/ref/logo.jpg')
    v = logo.max(axis=2)
    sil = uix.fill_holes(uix.largest(cv2.morphologyEx((v > 7).astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))))
    a = cv2.GaussianBlur(uix.erode(sil, 1), (0, 0), 0.9)
    ys, xs = np.nonzero(a > 3)
    lx0, ly0, lx1, ly1 = max(0, xs.min() - 2), max(0, ys.min() - 2), min(logo.shape[1], xs.max() + 3), min(logo.shape[0], ys.max() + 3)
    uix.save_rgba(os.path.join(OUT, 'logo.webp'), logo[ly0:ly1, lx0:lx1], a[ly0:ly1, lx0:lx1], quality=92)
    logo_sprite = uix.Sprite('logo', LOGO_REF_BOX[0], LOGO_REF_BOX[1], LOGO_REF_BOX[2] - LOGO_REF_BOX[0], LOGO_REF_BOX[3] - LOGO_REF_BOX[1], '../img/menu/logo.webp',
                             {'srcW': int(lx1 - lx0), 'srcH': int(ly1 - ly0)})
    sprites.append(logo_sprite)

    os.makedirs(os.path.dirname(TS), exist_ok=True)
    uix.write_ts(TS, 'MM_ART', sprites, 'tools/ui-extract/main_menu.py',
                 extra={'MM_TEXT': text_boxes, 'MM_LOGO_SRC': {'w': int(lx1 - lx0), 'h': int(ly1 - ly0)}})
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f'{len(sprites)} sprites, {total / 1e6:.2f} MB ->', OUT)


if __name__ == '__main__':
    main()
