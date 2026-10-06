"""Design v2 friends lobby (PO master ref/v2/lobby.webp): see v2x.py. Run: python3 tools/ui-extract/v2_lobby.py
No server, no friend list yet: the master's eight example friends are removed (an empty list with the join-by-code
field takes their place); team slots, room code, mode, settings, arena strip and START are native."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import v2x  # noqa: E402

ELEMENTS = {
    'profile': dict(box=(22, 8, 398, 112), shape='rect', socket=False, text={'name': (146, 24, 300, 58), 'level': (146, 62, 218, 94)},
                    bars=[((220, 64, 384, 92), (330, 378))], marks={'avatar': (30, 14, 128, 104), 'xp': (224, 68, 380, 88)}),
    'cur': dict(box=(1050, 4, 1672, 74), shape='rect', socket=False,
                text={'coins': (1104, 18, 1176, 54), 'gems': (1276, 18, 1344, 54), 'energy': (1428, 18, 1502, 54)}, smooth=['coins', 'gems', 'energy'],
                clear=[(1574, 0, 1606, 30)],
                marks={'t_coins': (1052, 8, 1222, 68), 't_gems': (1226, 8, 1384, 68), 't_energy': (1388, 8, 1540, 68), 't_mail': (1542, 8, 1602, 70), 't_gear': (1604, 8, 1664, 70)}),
    'friends': dict(box=(16, 156, 370, 852), shape='rect', socket=False, text={'title': (40, 176, 182, 214)}, smooth=['title'],
                    clear=[(30, 226, 356, 846)], marks={'add': (270, 170, 338, 220), 'list': (30, 226, 356, 846)}),
    'room': dict(box=(650, 212, 980, 318), shape='rect', socket=False, text={'label': (756, 220, 880, 248), 'code': (712, 250, 860, 300)},
                 smooth=['label', 'code'], marks={'copy': (882, 250, 938, 300)}),
    'invite': dict(box=(996, 240, 1230, 304), core=[(1004, 248, 1222, 296)], inset=4, text={'label': (1060, 256, 1212, 290)}, smooth=['label']),
    'teams': dict(box=(440, 312, 1262, 618), shape='rect', socket=False,
                  text={'t1': (590, 324, 744, 372), 't2': (1052, 324, 1192, 372), 'host_name': (470, 552, 590, 584), 'host_tag': (478, 588, 580, 612),
                        'i1': (660, 552, 732, 584), 'i2': (980, 552, 1052, 584), 'i3': (1142, 552, 1214, 584)},
                  smooth=['host_name', 'host_tag', 'i1', 'i2', 'i3'], glyph=False,
                  clear=[(452, 384, 608, 548), (628, 390, 766, 548), (944, 390, 1086, 548), (1106, 390, 1250, 548)],
                  marks={'s0': (448, 378, 612, 612), 's1': (622, 380, 772, 600), 's2': (938, 380, 1092, 600), 's3': (1100, 380, 1256, 600)}),
    'mode': dict(box=(1332, 210, 1660, 390), shape='rect', socket=False, text={'title': (1366, 226, 1500, 260), 'v1': (1396, 334, 1460, 364), 'v2': (1546, 334, 1610, 364)},
                 smooth=['title', 'v1', 'v2'], marks={'b1': (1354, 270, 1498, 374), 'b2': (1506, 270, 1646, 374)}),
    'settings': dict(box=(1340, 396, 1660, 640), shape='rect', socket=False,
                     text={'title': (1362, 408, 1540, 440), 'r_l': (1368, 458, 1446, 490), 'r_v': (1530, 456, 1592, 492), 't_l': (1368, 518, 1460, 550),
                           't_v': (1528, 516, 1596, 552), 'd_l': (1368, 578, 1470, 610), 'd_v': (1518, 576, 1610, 612)},
                     smooth=['title', 'r_l', 'r_v', 't_l', 't_v', 'd_l', 'd_v']),
    'arenas': dict(box=(420, 630, 1400, 794), shape='rect', socket=False, text={'title': (448, 642, 516, 670)}, smooth=['title'],
                   clear=[(504, 676, 700, 770), (722, 676, 904, 770), (928, 676, 1110, 770), (1132, 676, 1318, 770)],
                   marks={'a0': (502, 674, 702, 772), 'a1': (720, 674, 906, 772), 'a2': (926, 674, 1112, 772), 'a3': (1130, 674, 1320, 772),
                          'prev': (440, 690, 492, 760), 'next': (1326, 690, 1380, 760)}),
    'start': dict(box=(586, 784, 1116, 934), core=[(640, 806, 1068, 914)], text={'label': (730, 810, 1060, 900)}, ring=14, flat=(1062, 1072)),
    'back': dict(box=(16, 850, 240, 924), core=[(28, 860, 228, 914)], text={'label': (110, 866, 180, 906)}, smooth=['label']),
}

if __name__ == '__main__':
    v2x.run('lobby', 'lobby.webp', ELEMENTS,
            no_lights=[(0, 0, 400, 941), (420, 200, 1672, 941), (1040, 0, 1672, 80), (640, 0, 1010, 220)])
