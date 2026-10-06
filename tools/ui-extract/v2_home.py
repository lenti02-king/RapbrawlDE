"""Design v2 home screen (PO master ref/v2/home.webp): see v2x.py. Run: python3 tools/ui-extract/v2_home.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import v2x  # noqa: E402

BADGES = {'b_fighters': (256, 196, 295, 237), 'b_events': (1607, 242, 1648, 283), 'b_pass': (1607, 428, 1648, 468),
          'b_nav_events': (1191, 816, 1231, 855), 'b_mail': (1561, 0, 1598, 34)}
ELEMENTS = {
    'profile': dict(box=(36, 8, 440, 114), core=[(46, 18, 148, 106), (160, 26, 430, 100)],
                    text={'name': (204, 28, 312, 62), 'level': (170, 68, 242, 98)},
                    bars=[((248, 74, 424, 96), (372, 418))], marks={'xp': (250, 76, 420, 94), 'avatar': (46, 18, 148, 106)}),
    'coins': dict(box=(980, 12, 1160, 64), core=[(1040, 26, 1110, 52)], inset=2, text={'amount': (1040, 24, 1110, 54)}, socket=False),
    'gems': dict(box=(1166, 12, 1342, 64), core=[(1228, 26, 1292, 52)], inset=2, text={'amount': (1226, 24, 1294, 54)}, socket=False),
    'energy': dict(box=(1348, 12, 1518, 64), core=[(1398, 26, 1466, 52)], inset=2, text={'amount': (1396, 24, 1468, 54)}, socket=False),
    'mail': dict(box=(1522, 10, 1600, 70), core=[(1530, 18, 1590, 62)], inset=4, cut=[BADGES['b_mail']]),
    'gear': dict(box=(1600, 10, 1664, 72), core=[(1608, 18, 1656, 64)], inset=4),
    'fighters': dict(box=(28, 200, 292, 400), core=[(40, 214, 280, 390)], hull=True, cut=[BADGES['b_fighters']],
                     text={'label': (106, 350, 248, 390)}),
    'decks': dict(box=(26, 412, 292, 588), core=[(38, 424, 280, 578)], hull=True, text={'label': (110, 536, 206, 572)}),
    'shop': dict(box=(26, 596, 292, 766), core=[(38, 608, 280, 756)], hull=True, text={'label': (106, 712, 186, 748)}),
    'events': dict(box=(1374, 254, 1648, 422), core=[(1390, 268, 1630, 412)], hull=True, cut=[BADGES['b_events']],
                   text={'label': (1450, 372, 1556, 408)}),
    'pass': dict(box=(1366, 432, 1648, 618), core=[(1384, 450, 1630, 608)], hull=True, cut=[BADGES['b_pass']],
                 text={'label': (1440, 538, 1594, 572), 'progress': (1474, 578, 1544, 606), 'tier': (1594, 582, 1615, 606)},
                 bars=[((1380, 582, 1546, 604), (1500, 1540))], marks={'bar': (1383, 584, 1540, 601), 'shield': (1584, 572, 1624, 614)}),
    'missions': dict(box=(1356, 622, 1640, 776), core=[(1372, 636, 1624, 766)], hull=True, text={'label': (1432, 720, 1558, 758)}),
    'fight': dict(box=(538, 710, 1114, 900), core=[(626, 742, 1044, 868)], text={'label': (762, 746, 1002, 864)}, ring=14, flat=(1026, 1040),
                  marks={'face': (626, 742, 1044, 868)}),
    'nav': dict(box=(0, 806, 1672, 941), shape='rect', sprite=True, cut=[BADGES['b_nav_events']],
                text={'home': (116, 884, 192, 914), 'fighters': (280, 884, 374, 914), 'decks': (452, 884, 516, 914),
                      'events': (1130, 884, 1206, 914), 'shop': (1302, 884, 1360, 914), 'social': (1470, 884, 1542, 914)},
                clear=[BADGES['b_nav_events']],
                marks={'t_home': (40, 818, 246, 926), 't_fighters': (250, 818, 410, 926), 't_decks': (414, 818, 560, 926),
                       't_events': (1100, 818, 1252, 926), 't_shop': (1254, 818, 1414, 926), 't_social': (1416, 818, 1600, 926)}),
}
# the illustrated hero (the game shows the player's favourite fighter in 3D there) and the baked logo (clean file)
HERO = [(846, 182), (1012, 182), (1072, 330), (1166, 600), (1176, 800), (464, 806), (466, 560), (536, 380), (600, 296), (700, 276), (840, 268)]
LOGO = (588, 0, 1014, 268)
PARTS = {k: dict(box=b, key='matte', ring=5) for k, b in BADGES.items()}
PARTS['xp_fill'] = dict(box=(249, 75, 357, 95), key='bright')
PARTS['pass_fill'] = dict(box=(1382, 583, 1453, 602), key='bright')

if __name__ == '__main__':
    v2x.run('home', 'home.webp', ELEMENTS, remove=list(BADGES.values()), figures=[dict(poly=HERO, grow=12, mirror=[((800, 150, 1016, 300), 790)], protect=[LOGO], avoid=[(380, 130, 562, 482), (1098, 135, 1305, 505), (330, 395, 432, 760), (1240, 420, 1335, 760)])], parts=PARTS,
            wing_bars=[(812, 941)], no_lights=[LOGO, (960, 0, 1672, 76), (30, 0, 440, 116)], extra={'hero': {'feet': [832, 772], 'h': 560}, 'logo': list(LOGO)})
