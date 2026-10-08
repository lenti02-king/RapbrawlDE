"""Design v4 (D47) screens from the PO's street masters: see v4x.py.

  python3 tools/ui-extract/v4_screens.py prep <dir with the 5 masters>   # -> ref/v4/<screen>.png at 1672x941
  python3 tools/ui-extract/v4_screens.py home|modes|select|custom|lobby|all  # -> public/assets/ui4 + src/ui/v4/art

Kept as the PO painted it (baked): every static label, icon, frame and the logo. Removed from the plate and set
natively: live numbers, names, codes. Removed for good: third-party marks (DB, S-Bahn logos)."""
import json
import os
import re
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402
import v2x  # noqa: E402
import v4x  # noqa: E402

MASTERS = {'modes': '46', 'custom': '47', 'select': '48', 'home': '49', 'lobby': '50'}


def TS_ART(screen):
    """The generated sprite table of a screen (after its run)."""
    ts = open(os.path.join(v2x.TS_DIR, f'{screen}.ts')).read()
    m = re.search(r'_ART = (\{.*?\n\}) as const;', ts, re.S)
    return json.loads(re.sub(r',(\s*\})', r'\1', m.group(1)))


def btn(box, inset=4, **kw):
    """A small framed button (GrabCut inside its box)."""
    x0, y0, x1, y1 = box
    return dict(box=box, core=[(x0 + inset + 4, y0 + inset + 4, x1 - inset - 4, y1 - inset - 4)], inset=2, pad=6, **kw)


def amount(zone):
    """A live number on a dark capsule: the zone is cleared row by row from its clean ends and exported for text."""
    return dict(box=zone, shape='rect', text={'amount': zone}, scan=['amount'], socket=False, fit=False)


def label(zone, name='label'):
    """A live text on a panel (no sprite): cleared row by row, exported for native text."""
    return dict(box=zone, shape='rect', text={name: zone}, scan=[name], socket=False, fit=False)


def white_part(screen, name, img, box, lo=150, gain=4.0):
    """White glyphs/icons on a coloured ground: alpha from the darkest channel (white is bright in all three)."""
    x0, y0, x1, y1 = box
    c = img[y0:y1, x0:x1]
    a = np.clip((c.min(axis=2).astype(np.float32) - lo) * gain, 0, 255).astype(np.uint8)
    return v4x.save_part(screen, name, c, cv2.GaussianBlur(a, (0, 0), 0.5), (x0, y0))


def bright_part(screen, name, img, box, lo=60, gain=3.0):
    x0, y0, x1, y1 = box
    c = img[y0:y1, x0:x1]
    v = cv2.cvtColor(c, cv2.COLOR_BGR2HSV)[..., 2].astype(np.float32)
    a = np.clip((v - lo) * gain, 0, 255).astype(np.uint8)
    return v4x.save_part(screen, name, c, cv2.GaussianBlur(a, (0, 0), 0.6), (x0, y0))


def top_bar(coins, gems, trophies, plus1, plus2, mail=None, friends=None, back=None, gear=None):
    e = {'coins': amount(coins), 'gems': amount(gems), 'trophies': amount(trophies), 'plus1': btn(plus1), 'plus2': btn(plus2)}
    for k, b in (('mail', mail), ('friends', friends), ('back', back), ('gear', gear)):
        if b:
            e[k] = btn(b)
    return e


def write_fixed(screen, img):
    """A retouched copy of the master the run works on (state pieces moved out of it)."""
    cv2.imwrite(os.path.join(v4x.REF, f'{screen}_fix.png'), img)
    return f'{screen}_fix.png'


# --------------------------------------------------------------------------------------------------------- home
HOME = {
    'profile': dict(box=(78, 4, 438, 110), shape='rect', sprite=True, socket=False, fit=False,
                    text={'name': (247, 27, 346, 55), 'level': (175, 74, 197, 94)}, smooth=['level'], scan=['name'],
                    bars=[((215, 64, 418, 84), (382, 412))], marks={'xp': (276, 64, 374, 84), 'xpbar': (217, 67, 416, 81), 'avatar': (92, 18, 172, 94)}),
    'coins': amount((1164, 26, 1233, 49)),
    'gems': amount((1341, 26, 1397, 49)),
    'trophies': amount((1495, 26, 1544, 49)),
    'plus1': btn((1238, 18, 1277, 57)),
    'plus2': btn((1405, 18, 1444, 57)),
    'mail': btn((1560, 6, 1622, 64)),
    'friends': btn((1618, 6, 1672, 64)),
    'fighters': dict(shape='frame', box=(40, 280, 452, 462), core=[(80, 310, 410, 440)]),
    'deck': dict(shape='frame', box=(26, 432, 448, 594), core=[(70, 462, 405, 575)]),
    'shop': dict(shape='frame', box=(26, 578, 440, 728), core=[(65, 606, 400, 705)]),
    'events': dict(shape='frame', box=(1222, 282, 1640, 452), core=[(1262, 312, 1605, 432)]),
    'pass': dict(shape='frame', box=(1222, 436, 1650, 596), core=[(1262, 465, 1615, 576)]),
    'missions': dict(shape='frame', box=(1230, 580, 1654, 728), core=[(1270, 608, 1615, 708)]),
    'n_home': dict(box=(112, 828, 372, 922), core=[(150, 845, 340, 905)], inset=2, pad=6),
    'n_ranked': dict(box=(345, 828, 552, 922), core=[(380, 845, 520, 905)], inset=2, pad=6),
    'n_social': dict(box=(1110, 828, 1330, 922), core=[(1150, 845, 1300, 905)], inset=2, pad=6),
    'n_gear': dict(box=(1312, 828, 1564, 922), core=[(1350, 845, 1530, 905)], inset=2, pad=6),
    'fight': dict(box=(528, 770, 1118, 916), core=[(640, 790, 1040, 900)], ring=14, pad=8),
}
# third-party marks on the station bridge (Deutsche Bahn, S-Bahn): removed
HOME_REMOVE = [(1018, 284, 1066, 322), (1086, 272, 1134, 316)]
HOME_EXTRA = {'hero': {'feet': [836, 694], 'h': 352}, 'logo': [648, 120, 1030, 360]}


def home():
    v2x.run('home', 'home.png', HOME, remove=HOME_REMOVE, parts={'xp_fill': dict(box=(216, 66, 273, 82), key='bright', lo=60)},
            light_ymax=760, no_lights=[HOME_EXTRA['logo'], (0, 0, 470, 120), (1100, 0, 1672, 70)], extra=HOME_EXTRA)


# -------------------------------------------------------------------------------------------------------- modes
MODES = {
    **top_bar((1176, 26, 1242, 50), (1349, 26, 1396, 50), (1494, 26, 1539, 50), (1249, 18, 1287, 57), (1405, 18, 1442, 57),
              mail=(1556, 8, 1610, 64), friends=(1608, 8, 1668, 64), back=(18, 12, 114, 86)),
    't_1v1': dict(shape='frame', box=(334, 292, 834, 500), core=[(385, 335, 785, 465)], ring_w=16),
    't_2v2': dict(shape='frame', box=(838, 294, 1330, 496), core=[(885, 335, 1285, 465)]),
    't_friends': dict(shape='frame', box=(340, 496, 830, 700), core=[(390, 535, 785, 665)]),
    't_training': dict(shape='frame', box=(840, 496, 1328, 700), core=[(890, 535, 1285, 665)]),
    'online': dict(box=(576, 704, 840, 784), core=[(600, 718, 818, 770)], inset=2, pad=6, text={'c': (630, 718, 800, 768)}, scan=['c'], fit=False),
    'offline': dict(box=(832, 704, 1096, 784), core=[(856, 718, 1072, 770)], inset=2, pad=6, text={'c': (872, 718, 1036, 768)}, scan=['c'], fit=False),
    'weiter': dict(box=(560, 782, 1106, 914), core=[(650, 800, 1010, 896)], ring=14, pad=8),
}
MODES_REMOVE = [(1564, 192, 1628, 256)]  # Deutsche Bahn logo on the Hauptbahnhof sign


def modes():
    img = v4x.load('modes')
    v2x.run('modes', 'modes.png', MODES, remove=MODES_REMOVE, light_ymax=700, no_lights=[(640, 40, 1030, 300), (1100, 0, 1672, 70)])
    extra = {
        'ring_sel': v4x.ring_part('modes', 'ring_sel', img, (334, 292, 834, 500), [(385, 335, 785, 465)], ring=16),
        'ring_gold': v4x.ring_part('modes', 'ring_gold', img, (838, 294, 1330, 496), [(885, 335, 1285, 465)], ring=12),
        'on_label': white_part('modes', 'on_label', img, (632, 718, 792, 768)),
        'off_label': white_part('modes', 'off_label', img, (874, 718, 1034, 768)),
    }
    # the four tiles without their labels (arena select and other pickers write their own): label rows interpolated
    for tid, z in {'t_1v1': (440, 396, 742, 473), 't_2v2': (940, 396, 1242, 473), 't_friends': (444, 596, 742, 675), 't_training': (944, 596, 1242, 675)}.items():
        im = Image.open(os.path.join(v4x.PUB, 'modes', f'{tid}.webp')).convert('RGBA')
        x, y, w, h = [int(v) for v in json.loads(json.dumps(TS_ART('modes')[tid]))]
        rgb = cv2.cvtColor(np.asarray(im)[..., :3], cv2.COLOR_RGB2BGR)
        m = np.zeros(rgb.shape[:2], np.uint8)
        m[max(0, z[1] - y):z[3] - y, max(0, z[0] - x):z[2] - x] = 255
        clean = uix.fill_scanlines(rgb, m)
        extra[f'{tid}_blank'] = v4x.save_part('modes', f'{tid}_blank', clean, np.asarray(im)[..., 3], (x, y))
    v4x.append_ts('modes', extra)


# ------------------------------------------------------------------------------------------------------- select
# the 5x3 roster grid: tile boxes (frame outer edge)
COLS = [(578, 682), (688, 781), (788, 882), (891, 985), (992, 1089)]
ROWS = [(443, 529), (531, 613), (615, 697)]
GRID = [[(c[0], r[0], c[1], r[1]) for c in COLS] for r in ROWS]
SELECT = {
    **top_bar((1153, 26, 1222, 50), (1330, 26, 1384, 50), (1483, 26, 1533, 50), (1228, 18, 1266, 57), (1386, 18, 1426, 57),
              back=(20, 12, 116, 86), gear=(1574, 8, 1656, 84)),
    'p1name': label((232, 843, 458, 887), 'name'),
    'p2name': label((1214, 843, 1428, 887), 'name'),
    'weiter': dict(box=(578, 788, 1098, 914), core=[(650, 805, 1030, 896)], ring=14, pad=8),
}


def annulus(shape, box, out_pad, in_pad):
    m = uix.rect_mask(shape, (box[0] - out_pad, box[1] - out_pad, box[2] + out_pad, box[3] + out_pad))
    m[box[1] + in_pad:box[3] - in_pad, box[0] + in_pad:box[2] - in_pad] = 0
    return m


def select():
    img = v4x.load('select')
    # state pieces: the red P1 and blue P2 cursor frames (with their tags) come out of the plate; under them the grid
    # gets the plain gold frame of a neighbour tile
    p1 = GRID[0][0]
    p2 = GRID[1][4]
    tag1 = (578, 502, 616, 531)
    tag2 = (1053, 584, 1091, 615)
    cur = {}
    hole = np.zeros(img.shape[:2], np.uint8)
    for name, b, tg in (('cur_p1', p1, tag1), ('cur_p2', p2, tag2)):
        m = annulus(img.shape, b, 10, 9)
        m[tg[1]:tg[3], tg[0]:tg[2]] = 255
        hole |= m
        a = cv2.GaussianBlur(m, (0, 0), 1.2)
        x0, y0, x1, y1 = b[0] - 12, b[1] - 12, b[2] + 12, b[3] + 12
        cur[name] = (img[y0:y1, x0:x1].copy(), a[y0:y1, x0:x1].copy(), (x0, y0))  # written after the run (it clears the dir)
    fix = uix.inpaint(img.copy(), hole, max_side=1024, ctx=0.5)
    # a gold frame from the tile next to each cursor, pasted over the retouched tile
    for (dst, srcb) in ((p1, GRID[0][1]), (p2, GRID[1][3])):
        ring = annulus(img.shape, srcb, 2, 9)[srcb[1] - 2:srcb[3] + 2, srcb[0] - 2:srcb[2] + 2]
        piece = img[srcb[1] - 2:srcb[3] + 2, srcb[0] - 2:srcb[2] + 2]
        w, h = dst[2] - dst[0] + 4, dst[3] - dst[1] + 4
        piece = cv2.resize(piece, (w, h), interpolation=cv2.INTER_AREA)
        a = cv2.GaussianBlur(cv2.resize(ring, (w, h), interpolation=cv2.INTER_AREA), (0, 0), 0.8).astype(np.float32)[..., None] / 255.0
        y0, x0 = dst[1] - 2, dst[0] - 2
        roi = fix[y0:y0 + h, x0:x0 + w].astype(np.float32)
        fix[y0:y0 + h, x0:x0 + w] = (roi * (1 - a) + piece * a).astype(np.uint8)
    ref = write_fixed('select', fix)
    v2x.run('select', ref, SELECT, light_ymax=760, no_lights=[(660, 140, 1020, 440), (1090, 0, 1672, 90), (566, 380, 1104, 704)],
            extra={'grid': GRID, 'p1': {'feet': [300, 706], 'h': 440}, 'p2': {'feet': [1370, 706], 'h': 440}})
    v4x.append_ts('select', {k: v4x.save_part('select', k, *v) for k, v in cur.items()})


# ------------------------------------------------------------------------------------------------------- custom
SEG_X = {'power': 146, 'speed': 416, 'tech': 680}  # first segment's left edge per stat bar (6 segments, 26.8 px pitch)
SEG_Y = (850, 872)
SEG_W = 26.8


def seg_box(stat, i):
    x = SEG_X[stat] + i * SEG_W
    return (int(round(x)), SEG_Y[0], int(round(x + SEG_W - 1)), SEG_Y[1])


CUSTOM = {
    **top_bar((1133, 34, 1207, 60), (1316, 34, 1373, 60), (1470, 34, 1523, 60), (1212, 18, 1252, 58), (1380, 18, 1420, 58),
              mail=(1536, 8, 1600, 66), friends=(1596, 8, 1662, 66), back=(18, 16, 118, 94)),
    'title': label((200, 38, 392, 80), 'name'),
    'tab_skins': dict(box=(886, 246, 1122, 328), core=[(910, 262, 1100, 316)], inset=2, pad=6),
    'tab_walk': dict(box=(1116, 246, 1356, 328), core=[(1140, 262, 1335, 316)], inset=2, pad=6),
    'tab_fx': dict(box=(1352, 246, 1606, 328), core=[(1376, 262, 1585, 316)], inset=2, pad=6),
    's1': dict(shape='frame', box=(876, 340, 1116, 534), core=[(910, 368, 1088, 508)], ring_w=14),
    's2': dict(shape='frame', box=(1112, 342, 1358, 532), core=[(1140, 368, 1330, 508)]),
    's3': dict(shape='frame', box=(1356, 342, 1606, 532), core=[(1385, 368, 1580, 508)]),
    's4': dict(shape='frame', box=(878, 530, 1116, 718), core=[(910, 556, 1088, 698)]),
    's5': dict(shape='frame', box=(1112, 530, 1358, 718), core=[(1140, 556, 1330, 698)]),
    's6': dict(shape='frame', box=(1356, 530, 1608, 718), core=[(1385, 556, 1580, 698)]),
    'rot_l': btn((316, 714, 400, 792)),
    'rot_r': btn((558, 714, 638, 792)),
    'equip': dict(box=(1074, 750, 1616, 908), core=[(1150, 775, 1560, 885)], ring=14, pad=8),
}


def custom():
    img = v4x.load('custom')
    # stat bars: every segment becomes the plain dark segment (the last one of its bar); the lit one is a part
    fix = img.copy()
    for st in SEG_X:
        off = seg_box(st, 5)
        dark = img[off[1] - 5:off[3] + 5, off[0] - 2:off[2] + 2]
        for i in range(5):
            b = seg_box(st, i)
            fix[b[1] - 5:b[3] + 5, b[0] - 2:b[0] - 2 + dark.shape[1]] = dark
    ref = write_fixed('custom', fix)
    segs = {st: [list(seg_box(st, i)) for i in range(6)] for st in SEG_X}
    v2x.run('custom', ref, CUSTOM, light_ymax=760, no_lights=[(660, 20, 990, 240), (1080, 0, 1672, 70)],
            extra={'hero': {'feet': [490, 640], 'h': 470}, 'segs': segs})
    on = seg_box('power', 0)
    v4x.append_ts('custom', {'seg_on': bright_part('custom', 'seg_on', img, (on[0] - 3, on[1] - 3, on[2] + 4, on[3] + 3), lo=55),
                             'ring_sel': v4x.ring_part('custom', 'ring_sel', img, (876, 340, 1116, 534), [(910, 368, 1088, 508)], ring=14),
                             'ring_gold': v4x.ring_part('custom', 'ring_gold', img, (1112, 342, 1358, 532), [(1140, 368, 1330, 508)], ring=12)})


# -------------------------------------------------------------------------------------------------------- lobby
ROWS_L = [  # friend rows: name zone, status zone, invite button, avatar window
    ((212, 358, 332, 395), (211, 397, 294, 427), (428, 374, 596, 442), (88, 343, 180, 431)),
    ((208, 466, 332, 499), (207, 503, 294, 531), (428, 474, 592, 542), (80, 447, 180, 535)),
    ((205, 570, 317, 604), (204, 606, 290, 635), (424, 571, 592, 639), (76, 555, 176, 643)),
    ((204, 671, 332, 704), (203, 708, 290, 736), (424, 668, 592, 738), (72, 658, 172, 751)),
]
LOBBY = {
    **top_bar((1146, 27, 1213, 51), (1323, 27, 1375, 51), (1478, 27, 1523, 51), (1222, 18, 1260, 57), (1385, 18, 1421, 57),
              mail=(1538, 8, 1600, 66), friends=(1596, 8, 1660, 66), back=(24, 14, 126, 92)),
    'code': label((1422, 276, 1553, 320), 'code'),
    'copy': btn((1550, 270, 1596, 316)),
    'host': label((1259, 370, 1362, 405), 'name'),
    'slot1': dict(box=(1108, 446, 1602, 542), core=[(1140, 462, 1580, 528)], inset=2, pad=6, text={'label': (1250, 477, 1362, 513)}, scan=['label'], fit=False),
    'slot2': dict(box=(1108, 532, 1602, 632), core=[(1140, 548, 1580, 618)], inset=2, pad=6),
    'slot3': dict(box=(1108, 622, 1610, 718), core=[(1140, 638, 1585, 704)], inset=2, pad=6),
    'b_1v1': dict(box=(1154, 718, 1360, 784), core=[(1170, 728, 1345, 774)], inset=2, pad=6),
    'b_2v2': dict(box=(1354, 718, 1564, 784), core=[(1372, 728, 1550, 774)], inset=2, pad=6),
    'create': dict(box=(546, 784, 1114, 914), core=[(640, 805, 1030, 896)], ring=14, pad=8),
}
for _i, (_n, _s, _b, _a) in enumerate(ROWS_L):
    LOBBY[f'f{_i + 1}'] = dict(box=(min(_n[0], _s[0]), _n[1], max(_n[2], _s[2]), _s[3]), shape='rect', text={'name': _n, 'status': _s}, scan=['name', 'status'], socket=False, fit=False, marks={'avatar': _a})
    LOBBY[f'inv{_i + 1}'] = btn(_b)


def blank(screen, name, img, e, zone):
    """A button of the master with its label rows interpolated away: the same button for other labels (screens
    without a master of their own)."""
    clean = uix.fill_scanlines(img.copy(), uix.rect_mask(img.shape, zone))
    m = v2x.element_mask(img, e)
    a = cv2.GaussianBlur(m, (0, 0), 0.8)
    ys, xs = np.nonzero(a > 2)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    return v4x.save_part(screen, name, clean[y0:y1, x0:x1], a[y0:y1, x0:x1], (x0, y0))


def lobby():
    img = v4x.load('lobby')
    v2x.run('lobby', 'lobby.png', LOBBY, light_ymax=780, no_lights=[(660, 20, 1010, 250), (1080, 0, 1672, 70)])
    v4x.append_ts('lobby', {
        'btn_blue': blank('lobby', 'btn_blue', img, LOBBY['inv1'], (444, 388, 582, 430)),
        'btn_gold': blank('lobby', 'btn_gold', img, LOBBY['create'], (636, 812, 1046, 898)),
    })


SCREENS = {'home': home, 'modes': modes, 'select': select, 'custom': custom, 'lobby': lobby}

if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if what == 'prep':
        from PIL import Image
        src = sys.argv[2]
        os.makedirs(v4x.REF, exist_ok=True)
        for name, n in MASTERS.items():
            im = Image.open(os.path.join(src, f'{n}.jpg')).convert('RGB')
            im.resize((1672, 941), Image.LANCZOS).save(os.path.join(v4x.REF, f'{name}.png'))
        print('masters ->', v4x.REF)
    else:
        for k in (SCREENS if what == 'all' else what.split(',')):
            SCREENS[k]()
