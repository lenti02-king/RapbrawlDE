"""Design v2 character select (PO master ref/v2/select.jpg): see v2x.py. Run: python3 tools/ui-extract/v2_select.py
The two neon silhouettes are removed (the chosen fighters stand there in 3D); the hex grid keeps the master's dark
silhouettes as locked slots, the selected tiles' neon frames become movable sprites."""
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402
import v2x  # noqa: E402

# hex tiles (frame boxes, reference px): row by row
TILES = [
    (780, 117, 890, 217),
    (670, 224, 773, 318), (780, 224, 890, 318), (897, 224, 1000, 318),
    (550, 322, 659, 424), (667, 322, 773, 424), (778, 322, 890, 424), (897, 322, 1007, 424), (1013, 322, 1120, 424),
    (660, 424, 777, 528), (780, 424, 890, 528), (897, 424, 1003, 528),
    (780, 528, 890, 625),
]
CROWN = 6  # the gold crown tile (random pick)
SEL_P1 = 9  # baked blue frame
SEL_P2 = 7  # baked red frame
ELEMENTS = {
    'title': dict(box=(628, 10, 1052, 102), core=[(650, 22, 1030, 92)], text={'label': (660, 30, 958, 94)}, smooth=['label'], socket=False),
    'names': dict(box=(400, 630, 1280, 830), shape='rect', socket=False,
                  text={'p1_label': (545, 650, 662, 676), 'p1_name': (520, 680, 700, 738), 'p2_label': (1038, 650, 1162, 676),
                        'p2_name': (1008, 680, 1148, 738), 'timer': (808, 688, 864, 738), 'status': (724, 760, 948, 800)},
                  smooth=['status']),
    'bar': dict(box=(536, 872, 1138, 941), shape='rect', socket=False,
                text={'back': (596, 888, 654, 924), 'mid': (760, 888, 914, 924), 'lock': (1002, 888, 1080, 924)},
                marks={'t_back': (545, 876, 704, 941), 't_mid': (712, 876, 958, 941), 't_lock': (964, 876, 1130, 941)}),
}
LEFT = [(300, 92), (420, 92), (545, 165), (568, 232), (525, 300), (528, 560), (478, 600), (478, 748), (430, 766), (330, 766),
        (250, 748), (200, 766), (95, 766), (95, 700), (155, 640), (175, 520), (190, 440), (225, 330), (255, 280), (275, 160)]
RIGHT = [(1160, 84), (1470, 84), (1482, 330), (1472, 420), (1522, 520), (1552, 640), (1562, 752), (1522, 778), (1250, 778), (1208, 752),
         (1258, 640), (1276, 560), (1168, 520), (1156, 330)]


def octagon(b, inset=0, cut=0.2):
    x0, y0, x1, y1 = b[0] + inset, b[1] + inset, b[2] - inset, b[3] - inset
    cx = (x1 - x0) * cut
    cy = (y1 - y0) * cut
    return [(x0 + cx, y0), (x1 - cx, y0), (x1, y0 + cy), (x1, y1 - cy), (x1 - cx, y1), (x0 + cx, y1), (x0, y1 - cy), (x0, y0 + cy)]


def plate_fix(img, bg):
    """The two selected tiles get a normal tile's look (frames become sprites that move with the selection)."""
    out = bg.copy()
    for sel, donor in ((SEL_P1, 5), (SEL_P2, 5)):
        sb, db = TILES[sel], TILES[donor]
        src = img[db[1] - 6:db[3] + 6, db[0] - 6:db[2] + 6]
        w, h = sb[2] - sb[0] + 12, sb[3] - sb[1] + 12
        src = cv2.resize(src, (w, h), interpolation=cv2.INTER_CUBIC)
        m = np.zeros((h, w), np.uint8)
        cv2.fillPoly(m, [np.array([(x - sb[0] + 6, y - sb[1] + 6) for x, y in octagon(sb, -6, 0.22)], np.int32)], 255)
        a = cv2.GaussianBlur(m, (0, 0), 1.6).astype(np.float32)[..., None] / 255.0
        y0, x0 = sb[1] - 6, sb[0] - 6
        out[y0:y0 + h, x0:x0 + w] = (out[y0:y0 + h, x0:x0 + w] * (1 - a) + src * a).astype(np.uint8)
    # timer disc: dark glass with a soft highlight (the game sets VS / the countdown on it)
    cx, cy, r = 836, 713, 29
    yy, xx = np.mgrid[0:out.shape[0], 0:out.shape[1]]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    a = np.clip((r - d) / 2.0, 0, 1)[..., None]
    t = np.clip((yy - (cy - r)) / (2 * r), 0, 1)[..., None]
    disc = (np.array([34, 22, 14], np.float32) * (1 - t) + np.array([10, 8, 6], np.float32) * t)
    hl = np.exp(-(((xx - cx) / (r * 0.7)) ** 2 + ((yy - (cy - r * 0.55)) / (r * 0.28)) ** 2))[..., None] * 40
    out = (out * (1 - a) + (disc + hl) * a).astype(np.uint8)
    return out


def ring_parts(img, out_dir):
    """Neon selection frames (blue P1, red P2): ring between the outer octagon and the portrait window."""
    res = {}
    for k, i in (('sel_p1', SEL_P1), ('sel_p2', SEL_P2)):
        b = TILES[i]
        x0, y0, x1, y1 = b[0] - 14, b[1] - 14, b[2] + 14, b[3] + 14
        c = img[y0:y1, x0:x1].copy()
        hsv = cv2.cvtColor(c, cv2.COLOR_BGR2HSV)
        inner = np.zeros(c.shape[:2], np.uint8)
        cv2.fillPoly(inner, [np.array([(x - x0, y - y0) for x, y in octagon(b, 13, 0.2)], np.int32)], 255)
        a = np.clip((hsv[..., 2].astype(np.float32) - 60) * 2.2, 0, 255) * np.clip((hsv[..., 1].astype(np.float32) - 40) / 80, 0, 1)
        a[cv2.GaussianBlur(inner, (0, 0), 2) > 128] = 0
        uix.save_rgba(os.path.join(out_dir, f'{k}.webp'), c, a.astype(np.uint8), quality=92)
        res[k] = [x0, y0, x1 - x0, y1 - y0]
    return res


if __name__ == '__main__':
    img = uix.load(os.path.join(v2x.REF_DIR, 'select.jpg'))
    v2x.run('select', 'select.jpg', ELEMENTS,
            figures=[dict(poly=LEFT, grow=10, fill='lama'), dict(poly=RIGHT, grow=10, fill='lama', exact=True)],
            plate_fix=plate_fix, no_lights=[(540, 100, 1130, 640), (400, 630, 1280, 941)],
            extra={'tiles': [list(t) for t in TILES], 'crown': CROWN, 'feet': [[300, 748], [1392, 748]], 'fig_h': 600})
    # selection rings: cut from the untouched master, appended to the generated table
    out_dir = os.path.join(v2x.PUB, 'select')
    rings = ring_parts(img, out_dir)
    ts = os.path.join(v2x.TS_DIR, 'select.ts')
    s = open(ts).read()
    s = s.replace('export const SELECT_ART = {', 'export const SELECT_ART = {\n' + ''.join(f'  "{k}": {v},\n' for k, v in rings.items()), 1)
    open(ts, 'w').write(s)
