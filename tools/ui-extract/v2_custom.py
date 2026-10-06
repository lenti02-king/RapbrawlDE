"""Design v2 'customize fighter' (PO master ref/v2/custom.webp): see v2x.py. Run: python3 tools/ui-extract/v2_custom.py
The centre silhouette goes (the fighter stands there in 3D); the presets and the preview window are filled with our
fighters' renders; every label is native German."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import v2x  # noqa: E402

ROWS = [(140, 220), (228, 306), (316, 396), (404, 484), (492, 572), (580, 660), (668, 748), (756, 836)]
ELEMENTS = {
    'back': dict(box=(28, 16, 106, 94), core=[(38, 26, 96, 84)]),
    'title': dict(box=(110, 8, 654, 84), shape='rect', socket=False, text={'label': (130, 16, 574, 80)}, smooth=['label']),
    'cur': dict(box=(1040, 4, 1672, 74), shape='rect', socket=False,
                text={'coins': (1100, 20, 1166, 56), 'gems': (1272, 20, 1336, 56), 'energy': (1420, 20, 1494, 56)}, smooth=['coins', 'gems', 'energy'],
                clear=[(1574, 0, 1606, 30)],
                marks={'t_coins': (1048, 8, 1218, 68), 't_gems': (1222, 8, 1380, 68), 't_energy': (1384, 8, 1540, 68), 't_mail': (1542, 8, 1602, 70), 't_gear': (1604, 8, 1664, 70)}),
    'save': dict(box=(624, 790, 1046, 910), core=[(660, 806, 1010, 896)], text={'label': (680, 806, 990, 892)}, ring=14, flat=(1000, 1010)),
    'dice': dict(box=(484, 808, 570, 894), core=[(494, 818, 560, 884)]),
    'panels': dict(box=(1146, 126, 1656, 846), shape='rect', socket=False,
                   text={'presets': (1236, 146, 1444, 194), 'preview': (1222, 458, 1364, 502)}, smooth=['presets', 'preview'],
                   marks={'p0': (1180, 204, 1290, 408), 'p1': (1300, 204, 1404, 408), 'p2': (1414, 204, 1518, 408), 'p3': (1528, 204, 1630, 408),
                          'win': (1172, 506, 1636, 800), 'arr_l': (1176, 600, 1216, 670), 'arr_r': (1604, 600, 1644, 670)}),
}
for i, (y0, y1) in enumerate(ROWS):
    ELEMENTS[f'm{i}'] = dict(box=(22, y0 - 4, 330, y1 + 4), core=[(34, y0 + 6, 318, y1 - 6)], text={'label': (134, y0 + 18, 316, y1 - 18)},
                            smooth=['label'], marks={'icon': (36, y0 + 6, 118, y1 - 6)})
HERO = [(700, 140), (900, 140), (1000, 300), (1040, 480), (1000, 760), (600, 760), (600, 480), (640, 300)]

if __name__ == '__main__':
    v2x.run('custom', 'custom.webp', ELEMENTS, figures=[dict(poly=HERO, grow=12, fill='lama')],
            no_lights=[(0, 0, 340, 941), (1140, 120, 1672, 860), (1040, 0, 1672, 80), (600, 780, 1060, 941)],
            extra={'feet': [820, 742], 'fig_h': 600})
