"""Design v2 VS screen (PO master ref/v2/vs.webp): see v2x.py. Run: python3 tools/ui-extract/v2_vs.py
The two neon silhouettes and the English graffiti (YOU / OPPONENT) are removed: the game shows both fighters in 3D
there and sets DU / GEGNER natively; deck card art, names, the arena picture and READY are native too."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import v2x  # noqa: E402

ELEMENTS = {
    'p1': dict(box=(78, 28, 434, 124), shape='rect', socket=False, text={'name': (206, 44, 346, 80), 'level': (204, 84, 264, 112)},
               marks={'avatar': (84, 34, 184, 120)}),
    'p2': dict(box=(1296, 32, 1608, 124), shape='rect', socket=False, text={'name': (1446, 44, 1522, 80), 'level': (1410, 84, 1472, 112)},
               marks={'avatar': (1302, 38, 1388, 118)}),
    'deck1': dict(box=(20, 244, 334, 694), shape='rect', socket=False,
                  text={'title': (116, 256, 286, 306), 'n1': (88, 444, 132, 470), 'l1': (94, 470, 126, 494), 'n2': (208, 444, 298, 470),
                        'l2': (224, 470, 264, 494), 'n3': (110, 630, 242, 660), 'l3': (150, 660, 198, 686)},
                  smooth=['title', 'n1', 'l1', 'n2', 'l2', 'n3', 'l3'],
                  marks={'c1': (46, 322, 168, 442), 'c2': (188, 322, 310, 442), 'c3': (46, 508, 308, 628)}),
    'deck2': dict(box=(1338, 244, 1654, 694), shape='rect', socket=False,
                  text={'title': (1428, 256, 1630, 306), 'n1': (1398, 444, 1450, 470), 'l1': (1402, 470, 1440, 494), 'n2': (1508, 444, 1624, 470),
                        'l2': (1544, 470, 1584, 494), 'n3': (1444, 630, 1548, 660), 'l3': (1476, 660, 1520, 686)},
                  smooth=['title', 'n1', 'l1', 'n2', 'l2', 'n3', 'l3'],
                  marks={'c1': (1358, 322, 1482, 442), 'c2': (1504, 322, 1630, 442), 'c3': (1362, 508, 1630, 628)}),
    'stage': dict(box=(512, 500, 1160, 772), shape='rect', socket=False, text={'label': (732, 706, 970, 742)}, smooth=['label'],
                  clear=[(780, 750, 890, 772)], marks={'win': (528, 516, 1140, 702)}),
    'arrow_l': dict(box=(432, 548, 504, 664), core=[(446, 566, 494, 646)], inset=3),
    'arrow_r': dict(box=(1166, 548, 1240, 664), core=[(1176, 566, 1226, 646)], inset=3),
    'ready': dict(box=(560, 772, 1130, 930), core=[(620, 800, 1060, 900)], text={'label': (700, 790, 1012, 900)}, ring=14, flat=(1030, 1046)),
}
LEFT = [(330, 175), (470, 150), (600, 160), (690, 230), (716, 330), (704, 430), (694, 512), (520, 512), (334, 556), (318, 300)]
RIGHT = [(1000, 228), (1180, 212), (1300, 258), (1348, 340), (1348, 556), (1160, 556), (958, 512), (934, 430), (944, 300)]
VS = (712, 288, 968, 520)

if __name__ == '__main__':
    v2x.run('vs', 'vs.webp', ELEMENTS, remove=[(330, 88, 524, 234), (1098, 132, 1314, 254)],
            figures=[dict(poly=LEFT, grow=10, fill='lama'), dict(poly=RIGHT, grow=10, fill='lama')],
            no_lights=[(560, 0, 1110, 300), VS, (0, 230, 340, 700), (1330, 230, 1672, 700), (500, 490, 1180, 941)],
            extra={'feet': [[520, 1150], [1140, 1150]], 'fig_h': 980, 'you': [334, 96, 520, 228], 'opp': [1100, 140, 1312, 250]})
