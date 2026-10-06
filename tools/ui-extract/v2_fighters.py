"""Design v2 fighter roster (PO master ref/v2/fighters.webp): see v2x.py. Run: python3 tools/ui-extract/v2_fighters.py
The centre silhouette goes (the chosen fighter stands there in 3D); roster cards keep their art (free slots = locked
silhouettes), every baked "Lv. 24" is removed; stat bars are rebuilt empty (fills are part sprites)."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import v2x  # noqa: E402

COLS = [(28, 182), (190, 338), (350, 496), (508, 656)]
ROWS = [(325, 502), (516, 692), (706, 885)]
CARDS = [(c[0], r[0], c[1], r[1]) for r in ROWS for c in COLS]
lv = {}
for i, (x0, y0, x1, y1) in enumerate(CARDS):
    lv[f'lv{i}'] = (x0 + 80, y0 + 118, x1 - 8, y0 + 156)
ELEMENTS = {
    'roster': dict(box=(18, 236, 676, 900), shape='rect', socket=False, text=lv, smooth=list(lv),
                   marks={f'card{i}': c for i, c in enumerate(CARDS)}),
    'tabs': dict(box=(26, 240, 650, 312), shape='rect', socket=False,
                 text={'all': (66, 280, 110, 304), 'brawler': (170, 280, 250, 304), 'rapper': (298, 280, 368, 304),
                       'speed': (428, 280, 480, 304), 'defender': (522, 280, 604, 304)}, smooth=['all', 'brawler', 'rapper', 'speed', 'defender'],
                 marks={'t0': (32, 244, 146, 310), 't1': (150, 244, 272, 310), 't2': (276, 244, 396, 310), 't3': (400, 244, 506, 310), 't4': (510, 244, 640, 310)}),
    'info': dict(box=(1176, 214, 1660, 590), shape='rect', socket=False,
                 text={'name': (1284, 222, 1584, 290), 'cls': (1268, 292, 1440, 324), 'lv': (1202, 340, 1330, 375),
                       'p_l': (1254, 390, 1330, 422), 'p_v': (1592, 390, 1640, 422), 's_l': (1254, 437, 1322, 468), 's_v': (1592, 437, 1640, 468),
                       'd_l': (1254, 484, 1342, 516), 'd_v': (1592, 484, 1640, 516), 'abil': (1184, 540, 1346, 584)},
                 smooth=['name', 'lv', 'p_l', 'p_v', 's_l', 's_v', 'd_l', 'd_v', 'abil'],
                 bars=[((1340, 344, 1636, 370), (1520, 1610)), ((1361, 394, 1576, 419), (1540, 1570)),
                       ((1361, 441, 1576, 466), (1520, 1570)), ((1361, 488, 1576, 514), (1545, 1570))],
                 marks={'lvbar': (1344, 347, 1632, 367), 'pbar': (1364, 397, 1572, 416), 'sbar': (1364, 444, 1572, 463), 'dbar': (1364, 491, 1572, 511)}),
    'cards': dict(box=(1180, 576, 1656, 750), shape='rect', socket=False,
                  text={'n1': (1210, 708, 1300, 738), 'n2': (1356, 708, 1450, 738), 'n3': (1490, 708, 1640, 738)}, smooth=['n1', 'n2', 'n3'],
                  marks={'c1': (1192, 600, 1316, 706), 'c2': (1340, 600, 1464, 706), 'c3': (1490, 592, 1640, 706)}),
    'cur': dict(box=(996, 4, 1672, 74), shape='rect', socket=False,
                text={'coins': (1060, 20, 1134, 56), 'gems': (1250, 20, 1316, 56), 'energy': (1418, 20, 1492, 56)}, smooth=['coins', 'gems', 'energy'],
                clear=[(1574, 0, 1610, 30)],
                marks={'t_coins': (996, 8, 1186, 68), 't_gems': (1190, 8, 1368, 68), 't_energy': (1372, 8, 1540, 68), 't_mail': (1542, 8, 1600, 70), 't_gear': (1604, 8, 1664, 70)}),
    'select': dict(box=(1196, 752, 1664, 884), core=[(1236, 772, 1630, 868)], text={'label': (1318, 778, 1570, 866)}, ring=14, flat=(1590, 1602)),
}
HERO = [(790, 95), (1020, 95), (1100, 260), (1150, 430), (1150, 900), (690, 900), (690, 430), (730, 260)]
PARTS = {'fill_lv': dict(box=(1344, 348, 1460, 366)), 'fill_p': dict(box=(1364, 397, 1520, 416)),
         'fill_s': dict(box=(1364, 444, 1490, 463)), 'fill_d': dict(box=(1364, 491, 1508, 511))}

if __name__ == '__main__':
    v2x.run('fighters', 'fighters.webp', ELEMENTS, parts=PARTS, figures=[dict(poly=HERO, grow=12, fill='lama')],
            no_lights=[(0, 0, 700, 941), (1160, 200, 1672, 941), (990, 0, 1672, 80)],
            extra={'cards': [list(c) for c in CARDS], 'feet': [920, 880], 'fig_h': 760})
