"""Design v2 arena select (PO master ref/v2/arena.webp). Unlike the other v2 screens the big picture is the selected
arena itself, so every UI piece is cut out with its glow (matted against a LaMa plate of the master) and the game
lays them over a full-screen render of the chosen arena. Run: python3 tools/ui-extract/v2_arena.py"""
import json
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402
import v2x  # noqa: E402

SCREEN = 'arena'
EL = {
    'back': dict(box=(14, 12, 108, 98), core=[(26, 22, 96, 88)]),
    'title': dict(box=(110, 10, 606, 100), core=[(124, 20, 596, 90)], text={'label': (126, 18, 522, 86)}, smooth=['label']),
    'coin': dict(box=(948, 10, 1006, 66), core=[(958, 18, 996, 58)], inset=4),
    'gem': dict(box=(1141, 12, 1202, 66), core=[(1152, 20, 1192, 58)], inset=4),
    'bolt': dict(box=(1328, 8, 1378, 70), core=[(1340, 18, 1366, 60)], inset=4),
    'plus1': dict(box=(1081, 16, 1127, 62), core=[(1088, 22, 1120, 56)], inset=3),
    'plus2': dict(box=(1266, 16, 1312, 62), core=[(1273, 22, 1305, 56)], inset=3),
    'plus3': dict(box=(1446, 16, 1494, 62), core=[(1453, 22, 1487, 56)], inset=3),
    'mail': dict(box=(1498, 6, 1568, 74), core=[(1508, 16, 1556, 64)], cut=[(1542, 0, 1582, 38)]),
    'gear': dict(box=(1586, 8, 1658, 74), core=[(1596, 18, 1648, 64)]),
    'trait1': dict(box=(1224, 372, 1353, 488), core=[(1232, 380, 1345, 480)], inset=3, text={'icon': (1250, 382, 1330, 440), 'label': (1234, 440, 1344, 484)}, smooth=['icon', 'label']),
    'trait2': dict(box=(1372, 372, 1501, 488), core=[(1380, 380, 1493, 480)], inset=3, text={'icon': (1398, 382, 1478, 440), 'label': (1382, 440, 1492, 484)}, smooth=['icon', 'label']),
    'trait3': dict(box=(1518, 372, 1649, 488), core=[(1526, 380, 1641, 480)], inset=3, text={'icon': (1544, 382, 1624, 440), 'label': (1528, 440, 1640, 484)}, smooth=['icon', 'label']),
    'button': dict(box=(1210, 496, 1664, 628), core=[(1250, 512, 1630, 612)], text={'label': (1296, 520, 1600, 598)}, flat=(1606, 1618)),
    'arrow_l': dict(box=(0, 708, 54, 808), core=[(10, 724, 42, 792)], inset=2),
    'arrow_r': dict(box=(1616, 708, 1672, 808), core=[(1628, 724, 1662, 792)], inset=2),
}
CARDS = [(61, 631, 371, 911), (382, 633, 679, 908), (692, 633, 988, 908), (1000, 633, 1295, 908), (1305, 633, 1608, 908)]


def card_ring(img, b, key):
    """Neon card frame (rounded, cut corners): bright saturated ring pixels outside an inset rect."""
    x0, y0, x1, y1 = b[0] - 16, b[1] - 16, b[2] + 16, b[3] + 16
    c = img[y0:y1, x0:x1].copy()
    hsv = cv2.cvtColor(c, cv2.COLOR_BGR2HSV).astype(np.float32)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    if key == 'gold':
        hue = np.clip(1 - np.abs(h - 22) / 14, 0, 1)
    else:
        hue = np.clip(1 - np.abs(h - 105) / 22, 0, 1)
    a = np.clip((v - 60) * (2.4 if key == 'gold' else 3.4), 0, 255) * np.clip((s - 40) / 80, 0, 1) * hue
    inner = np.zeros(c.shape[:2], np.uint8)
    inset = 26 if key == 'gold' else 18
    cv2.rectangle(inner, (16 + inset, 16 + inset), (c.shape[1] - 16 - inset, c.shape[0] - 16 - inset), 255, -1)
    a[cv2.GaussianBlur(inner, (0, 0), 3) > 128] = 0
    return c, a.astype(np.uint8), [x0, y0, x1 - x0, y1 - y0]


def main():
    out_dir = os.path.join(v2x.PUB, SCREEN)
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        os.remove(os.path.join(out_dir, f))
    img = uix.load(os.path.join(v2x.REF_DIR, 'arena.webp'))
    H, W = img.shape[:2]
    masks = {k: v2x.element_mask(img, e) for k, e in EL.items()}
    hole = np.zeros((H, W), np.uint8)
    for m in masks.values():
        hole |= uix.dilate(m, 10)
    for b in CARDS:
        hole |= uix.rect_mask(img.shape, (b[0] - 18, b[1] - 18, b[2] + 18, b[3] + 18))
    bg_path = os.path.join(v2x.DBG, 'arena_bg.png')
    if os.path.exists(bg_path) and os.environ.get('REUSE_BG'):
        bg = cv2.imread(bg_path)
    else:
        bg = uix.inpaint(img, hole, max_side=1024, ctx=0.4)
        cv2.imwrite(bg_path, bg)
    sprites, texts = {}, {}
    for k, e in EL.items():
        work = img.copy()
        # smooth fills (dark plates) and flat fills (yellow button) before the matte
        for n in e.get('smooth', []):
            z = v2x.fit_zone(img, e['text'][n])
            zm = uix.rect_mask(img.shape, (z[0] - 3, z[1] - 3, z[2] + 3, z[3] + 3)) & uix.dilate(masks[k], 1)
            ring = uix.dilate(zm, 10) & ~uix.dilate(zm, 3) & masks[k]
            px = img[ring > 0].reshape(-1, 3).astype(np.float32)
            base = px[px.mean(axis=1) <= np.percentile(px.mean(axis=1), 40)].mean(axis=0) if len(px) else np.array([12, 12, 16])
            fill = np.full_like(work, base.astype(np.uint8))
            rng = np.random.default_rng(5)
            fill = np.clip(fill.astype(np.float32) + rng.normal(0, 3.0, fill.shape[:2])[..., None], 0, 255).astype(np.uint8)
            a = (cv2.GaussianBlur(zm, (0, 0), 1.5).astype(np.float32) / 255.0)[..., None]
            work = (work * (1 - a) + fill * a).astype(np.uint8)
        if e.get('flat'):
            z = v2x.fit_zone(img, e['text']['label'])
            zm = uix.rect_mask(img.shape, (z[0] - 3, z[1] - 3, z[2] + 3, z[3] + 3))
            sx0, sx1 = e['flat']
            col = cv2.GaussianBlur(work[:, sx0:sx1].astype(np.float32).mean(axis=1, keepdims=True), (1, 0), sigmaX=0.1, sigmaY=2)
            fill = np.repeat(col, W, axis=1)
            a = (cv2.GaussianBlur(zm, (0, 0), 2.5).astype(np.float32) / 255.0)[..., None]
            work = (work * (1 - a) + fill * a).astype(np.uint8)
        rgb, a = uix.matte(work, bg, masks[k], ring=e.get('ring', 10))
        sp = uix.crop_sprite(k, rgb, a, out_dir, '', pad=1)
        sprites[k] = [sp.x, sp.y, sp.w, sp.h]
        if e.get('text'):
            texts[k] = {n: list(z) for n, z in e['text'].items()}
    for k, i in (('card_sel', 0), ('card', 1)):
        c, a, b = card_ring(img, CARDS[i], 'gold' if i == 0 else 'blue')
        uix.save_rgba(os.path.join(out_dir, f'{k}.webp'), c, a, quality=92)
        sprites[k] = b
    # the mail badge (shared look with the home screen)
    x0, y0, x1, y1 = 1540, 2, 1580, 38
    m = v2x.element_mask(img, {'box': (x0, y0, x1, y1), 'inset': 4, 'pad': 4})
    rgb, a = uix.matte(img, bg, m, ring=5)
    uix.save_rgba(os.path.join(out_dir, 'badge.webp'), rgb[y0:y1, x0:x1], a[y0:y1, x0:x1], quality=92)
    sprites['badge'] = [x0, y0, x1 - x0, y1 - y0]
    v2x.write_ts(SCREEN, sprites, texts, {'l': [0, 0, 0, 0], 'c': [0, 0, 0, 0], 'r': [0, 0, 0, 0]}, [],
                 {'cards': [list(c) for c in CARDS]}, (W, H))
    total = sum(os.path.getsize(os.path.join(out_dir, f)) for f in os.listdir(out_dir))
    print(f'arena: {len(sprites)} sprites, {total / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
