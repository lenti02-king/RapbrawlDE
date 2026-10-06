"""2D cutout fighters from the PO's cartoon reference images (D42): Manuellsen, Lacazette.

The PO wants these two EXACTLY as drawn (no 3D model: Meshy makes them realistic). The reference (front view, plain
light background) is cut into puppet pieces (head, torso, upper/lower arms, thighs, shins, feet) with GrabCut-refined
edges; whatever a piece hides of the pieces behind it is inpainted (LaMa) so nothing tears open when limbs move.
The game drives the pieces with the existing skeleton animations (src/render/cutout.ts): positions come from the art
(pivots), angles from the animated skeleton seen from the side.

Run: python3 tools/characters/cutout.py manuellsen|lacazette   (reference: tools/ui-extract/ref/v2/<id>.webp, git-ignored)
Out: public/assets/characters/<id>/<piece>.webp + parts.json, debug .cache/cutout/<id>_*.png
"""
from __future__ import annotations

import json
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'ui-extract'))
import uix  # noqa: E402

ROOT = uix.ROOT
DBG = os.path.join(ROOT, '.cache/cutout')

# Piece table per character: polygon (image px), pivot (joint the piece turns about), axis end (the next joint, or
# the head top / sole), parent piece, draw order (higher = in front), skeleton bone the angle comes from.
# Image left = the character's RIGHT side (front view).
CHARS = {
    'manuellsen': dict(
        height=1.92, top=24, sole=1918,
        pieces={
            'footR': dict(poly=[(362, 1626), (528, 1626), (534, 1760), (532, 1884), (506, 1920), (296, 1920), (280, 1884), (306, 1800), (346, 1760), (360, 1700)], pivot=(445, 1660), axis=(445, 1910), parent='shinR', order=1, bone=None),
            'footL': dict(poly=[(766, 1626), (930, 1626), (944, 1700), (988, 1780), (1010, 1884), (994, 1920), (786, 1920), (760, 1884), (764, 1760)], pivot=(862, 1660), axis=(862, 1910), parent='shinL', order=1, bone=None),
            'shinR': dict(poly=[(405, 1370), (588, 1370), (575, 1530), (528, 1672), (415, 1676), (396, 1530)], pivot=(470, 1405), axis=(445, 1660), parent='thighR', order=2, bone=('knR', 'ftR')),
            'shinL': dict(poly=[(740, 1370), (928, 1370), (930, 1530), (905, 1676), (795, 1672), (748, 1530)], pivot=(848, 1405), axis=(862, 1660), parent='thighL', order=2, bone=('knL', 'ftL')),
            'thighR': dict(poly=[(342, 872), (658, 872), (658, 1268), (598, 1268), (566, 1436), (430, 1446), (396, 1330), (382, 1268), (342, 1228)], pivot=(540, 935), axis=(470, 1405), parent='torso', order=3, bone=('thR', 'knR')),
            'thighL': dict(poly=[(656, 872), (952, 872), (952, 1228), (928, 1268), (928, 1340), (898, 1446), (760, 1436), (732, 1268), (656, 1268)], pivot=(778, 935), axis=(848, 1405), parent='torso', order=3, bone=('thL', 'knL')),
            'torso': dict(poly=[(470, 282), (845, 282), (905, 340), (912, 560), (900, 760), (872, 900), (440, 900), (418, 760), (405, 560), (412, 340)], pivot=(658, 935), axis=(656, 300), parent=None, order=4, bone=('hips', 'neck')),
            'head': dict(poly=[(560, 18), (752, 18), (762, 120), (760, 250), (720, 300), (700, 330), (612, 330), (590, 300), (556, 250), (552, 120)], pivot=(656, 305), axis=(656, 30), parent='torso', order=6, bone='head'),
            'armR': dict(poly=[(342, 296), (468, 318), (470, 470), (405, 632), (352, 702), (250, 690), (240, 560), (282, 396)], pivot=(392, 372), axis=(300, 655), parent='torso', order=5, bone=('shR', 'elR')),
            'armL': dict(poly=[(990, 296), (862, 318), (860, 470), (930, 632), (982, 702), (1085, 690), (1095, 560), (1050, 396)], pivot=(935, 372), axis=(1015, 655), parent='torso', order=5, bone=('shL', 'elL')),
            'foreR': dict(poly=[(238, 632), (360, 632), (376, 880), (372, 1010), (362, 1150), (300, 1160), (236, 1120), (228, 880)], pivot=(300, 655), axis=(292, 905), parent='armR', order=7, bone=('elR', 'haR')),
            'foreL': dict(poly=[(955, 632), (1085, 632), (1104, 880), (1074, 1010), (1068, 1150), (1006, 1160), (940, 1120), (946, 880)], pivot=(1015, 655), axis=(1015, 905), parent='armL', order=7, bone=('elL', 'haL')),
        },
    ),
    'lacazette': dict(
        height=1.84, top=34, sole=1922,
        pieces={
            'footR': dict(poly=[(446, 1740), (604, 1740), (616, 1860), (610, 1928), (380, 1928), (364, 1880), (396, 1816), (436, 1786)], pivot=(520, 1765), axis=(520, 1910), parent='shinR', order=1, bone=None),
            'footL': dict(poly=[(826, 1740), (980, 1740), (1004, 1800), (1054, 1858), (1066, 1912), (1044, 1932), (836, 1932), (814, 1880), (818, 1800)], pivot=(885, 1772), axis=(885, 1910), parent='shinL', order=1, bone=None),
            'shinR': dict(poly=[(436, 1356), (604, 1356), (596, 1770), (446, 1778), (426, 1600)], pivot=(512, 1390), axis=(520, 1765), parent='thighR', order=2, bone=('knR', 'ftR')),
            'shinL': dict(poly=[(752, 1356), (906, 1356), (936, 1600), (946, 1778), (796, 1778)], pivot=(840, 1390), axis=(885, 1772), parent='thighL', order=2, bone=('knL', 'ftL')),
            'thighR': dict(poly=[(466, 872), (657, 872), (652, 1004), (606, 1408), (448, 1424), (468, 1150)], pivot=(556, 925), axis=(512, 1390), parent='torso', order=3, bone=('thR', 'knR')),
            'thighL': dict(poly=[(653, 872), (834, 872), (862, 1150), (884, 1424), (728, 1408), (660, 1004)], pivot=(762, 925), axis=(840, 1390), parent='torso', order=3, bone=('thL', 'knL')),
            'torso': dict(poly=[(520, 262), (790, 262), (860, 330), (900, 420), (902, 700), (888, 880), (836, 930), (480, 930), (424, 880), (412, 700), (414, 420), (452, 330)], pivot=(658, 925), axis=(655, 330), parent=None, order=4, bone=('hips', 'neck')),
            'head': dict(poly=[(538, 30), (770, 30), (776, 160), (768, 256), (744, 312), (690, 346), (628, 346), (578, 312), (548, 256), (532, 160)], pivot=(656, 335), axis=(656, 40), parent='torso', order=6, bone='head'),
            'armR': dict(poly=[(392, 396), (482, 420), (474, 560), (428, 742), (326, 770), (322, 600), (344, 470)], pivot=(452, 445), axis=(352, 730), parent='torso', order=5, bone=('shR', 'elR')),
            'armL': dict(poly=[(842, 420), (936, 396), (986, 470), (1004, 600), (1004, 770), (906, 742), (856, 560)], pivot=(868, 445), axis=(962, 730), parent='torso', order=5, bone=('shL', 'elL')),
            'foreR': dict(poly=[(296, 700), (426, 716), (392, 880), (398, 1000), (414, 1130), (352, 1176), (284, 1110), (292, 880)], pivot=(352, 730), axis=(338, 1000), parent='armR', order=7, bone=('elR', 'haR')),
            'foreL': dict(poly=[(900, 716), (1032, 700), (1044, 880), (1036, 1000), (994, 1134), (928, 1170), (912, 1100), (936, 1000), (930, 880)], pivot=(962, 730), axis=(985, 1000), parent='armL', order=7, bone=('elL', 'haL')),
        },
    ),
}


def figure_matte(img, pieces):
    """GrabCut on the union of the piece polygons: definite foreground = eroded polygons, definite background =
    outside the dilated union, and the near-white background colour band (the floor shadow too)."""
    H, W = img.shape[:2]
    union = np.zeros((H, W), np.uint8)
    for p in pieces.values():
        union |= uix.poly_mask(img.shape, p['poly'])
    # background colour per row (a soft gradient) from the pixels well outside the figure
    out = uix.dilate(union, 40) == 0
    f32 = img.astype(np.float32)
    bg = np.zeros_like(f32)
    for y in range(H):
        row = out[y]
        bg[y] = f32[y][row].mean(axis=0) if row.any() else (bg[y - 1, 0] if y else 240)
    dist = np.abs(f32 - bg).max(axis=2)
    mask = np.full((H, W), cv2.GC_BGD, np.uint8)
    mask[uix.dilate(union, 24) > 0] = cv2.GC_PR_BGD
    mask[union > 0] = cv2.GC_PR_FGD
    # definitely the figure: clearly different from the background, well inside the outlines
    mask[(uix.erode(union, 10) > 0) & (dist > 45)] = cv2.GC_FGD
    # the soft floor shadow round the shoes (bluish grey, a little darker than the floor) is background
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    yy = np.arange(H)[:, None]
    shadow = (yy > H * 0.85) & (hsv[..., 1] < 40) & (dist < 60) & (img[..., 0].astype(np.int16) >= img[..., 2].astype(np.int16))
    mask[shadow & (mask != cv2.GC_FGD)] = cv2.GC_BGD
    b = np.zeros((1, 65), np.float64)
    f = np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, None, b, f, 6, cv2.GC_INIT_WITH_MASK)
    m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    m = uix.fill_holes(uix.largest(m))
    return cv2.GaussianBlur(m, (0, 0), 0.9)


def main(cid: str):
    spec = CHARS[cid]
    img = uix.load(f'tools/ui-extract/ref/v2/{cid}.webp')
    H, W = img.shape[:2]
    os.makedirs(DBG, exist_ok=True)
    out_dir = os.path.join(ROOT, 'public/assets/characters', cid)
    os.makedirs(out_dir, exist_ok=True)
    pieces = spec['pieces']
    matte = figure_matte(img, pieces)
    cv2.imwrite(os.path.join(DBG, f'{cid}_matte.png'), matte)
    s = spec['height'] / (spec['sole'] - spec['top'])  # metres per px
    meta = {'id': cid, 'scale': s, 'height': spec['height'], 'top': spec['top'], 'sole': spec['sole'], 'size': [W, H], 'pieces': {}}
    dbg = img.copy()
    masks = {k: uix.poly_mask(img.shape, p['poly']) for k, p in pieces.items()}
    for k, p in pieces.items():
        # pixels of pieces drawn in front of this one (at rest) are filled from this piece's own surroundings
        front = np.zeros((H, W), np.uint8)
        for k2, p2 in pieces.items():
            if k2 != k and p2['order'] > p['order']:
                front |= masks[k2]
        own = masks[k] & (matte > 8)
        hole = uix.dilate(front & matte & masks[k], 3) & uix.dilate(masks[k], 2)
        src = img
        if hole.any():
            x0, y0, w, h = cv2.boundingRect(uix.dilate(masks[k], 30))
            region = (x0, y0, x0 + w, y0 + h)
            src = uix.inpaint_local(img, hole, region=region, max_side=768, feather=2, whole=True)
        # alpha: the figure matte inside the polygon; where the hole was filled the polygon itself (the fill
        # continues the piece's surface), feathered
        a = np.where(own > 0, matte, 0).astype(np.float32)
        a = np.maximum(a, (hole > 0).astype(np.float32) * 255 * (masks[k] > 0))
        a = cv2.GaussianBlur(a, (0, 0), 1.0) * (cv2.GaussianBlur(masks[k], (0, 0), 1.2) / 255.0)
        a = np.clip(a, 0, 255).astype(np.uint8)
        ys, xs = np.nonzero(a > 4)
        bx0, by0, bx1, by1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
        crop = src[by0:by1, bx0:bx1]
        ca = a[by0:by1, bx0:bx1]
        # keep the art crisp but not huge: at most 1.0 px per mm of figure height in the game (~2K tall texture)
        uix.save_rgba(os.path.join(out_dir, f'{k}.webp'), crop, ca, quality=90)
        meta['pieces'][k] = {
            'bbox': [bx0, by0, bx1 - bx0, by1 - by0],
            'pivot': list(p['pivot']),
            'axis': list(p['axis']),
            'parent': p['parent'],
            'order': p['order'],
            'bone': p['bone'],
        }
        cnts, _ = cv2.findContours((a > 128).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cv2.drawContours(dbg, cnts, -1, (0, 200, 0), 2)
        cv2.circle(dbg, tuple(p['pivot']), 9, (0, 0, 255), -1)
        cv2.line(dbg, tuple(p['pivot']), tuple(p['axis']), (255, 0, 255), 2)
    cv2.imwrite(os.path.join(DBG, f'{cid}_pieces.png'), dbg)
    with open(os.path.join(out_dir, 'parts.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    total = sum(os.path.getsize(os.path.join(out_dir, x)) for x in os.listdir(out_dir))
    print(f'{cid}: {len(pieces)} pieces, {total / 1e6:.2f} MB -> {out_dir}')


if __name__ == '__main__':
    for c in sys.argv[1:] or list(CHARS):
        main(c)
