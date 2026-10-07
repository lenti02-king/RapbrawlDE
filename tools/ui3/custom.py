# Design v3 (S13b): KÄMPFER ANPASSEN - menu buttons with 3D icons (m0..m7), presets + preview panels, pills, title
# plaque, the fighter on the gold pedestal; sprites at the v2 boxes (src/ui/v2/art/custom.ts).
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402
import compose  # noqa: E402
import kit  # noqa: E402
import lib  # noqa: E402
import pieces as P  # noqa: E402

OUT = os.path.join(lib.ROOT, 'public', 'assets', 'ui3', 'custom')
only = sys.argv[1].split(',') if len(sys.argv) > 1 else None
ART = {'back': [28, 18, 79, 73], 'save': [635, 797, 405, 99], 'dice': [488, 815, 79, 76], 'm0': [24, 137, 304, 86], 'm1': [27, 226, 298, 82], 'm2': [26, 312, 302, 87],
       'm3': [27, 403, 298, 83], 'm4': [27, 492, 300, 85], 'm5': [26, 581, 301, 83], 'm6': [27, 669, 301, 85], 'm7': [27, 757, 301, 84]}
ICON = ['jacket', 'glove', 'sneaker', 'person', 'mic', 'burst', 'palette', 'crown']
PRESETS = [1160, 132, 496, 296]
PREVIEW = [1160, 442, 496, 380]
TITLE = [112, 14, 500, 72]


def want(n):
    return not only or n in only


def menu(i):
    b = ART[f'm{i}']

    def build(w, h):
        kit.candy_button(w - 0.06, h - 0.08, 'blue', r=0.22, depth=0.24)
        ix = -w / 2 + 0.5
        disc = lib.slab('icbg', lib.rounded_rect_pts(0.78, h - 0.26, 0.16), 0.22, 0.03, kit.candy('icbg', '#1b2a7a', '#0a1240', h, rough=0.4, coat=0.4), seg=3, z0=0.06)
        disc.location.x = ix
        kit.place(kit.ICONS[ICON[i]](), ix, 0.0, 0.42, min(0.66, h - 0.2))

    P.save_webp(P.render_piece(f'cu_m{i}', b[2], b[3], build), os.path.join(OUT, f'm{i}.webp'), b[2], b[3])


def presets():
    def build(w, h):
        kit.panel(w - 0.06, h - 0.06, r=0.3, face=('#232c78', '#0a0d30'), rim='gold', rim_w=0.09, inner_line='#5fa8ff')
        kit.place(kit.icon_crown(), *C.rel(PRESETS, 1206, 170), 0.35, 0.46)
        for a, b, c, d in ([1180, 204, 1290, 408], [1300, 204, 1404, 408], [1414, 204, 1518, 408], [1528, 204, 1630, 408]):
            cx, cy = C.rel(PRESETS, (a + c) / 2, (b + d) / 2)
            lib.slab('pw', [(x + cx, y + cy) for x, y in lib.rounded_rect_pts((c - a) / 100, (d - b) / 100, 0.1)], 0.2, 0.02, kit.candy('pw', '#26306e', '#0b0f30', 2.0, rough=0.45, coat=0.3), seg=3)
            C.card_slot(cx, cy, (c - a) / 100 + 0.06, (d - b) / 100 + 0.06)
    return P.render_piece('cu_presets', PRESETS[2], PRESETS[3], build)


def preview():
    def build(w, h):
        kit.panel(w - 0.06, h - 0.06, r=0.3, face=('#232c78', '#0a0d30'), rim='gold', rim_w=0.09, inner_line='#5fa8ff')
        kit.place(kit.icon_crown(), *C.rel(PREVIEW, 1196, 480), 0.35, 0.46)
        a, b, c, d = 1172, 506, 1636, 800
        cx, cy = C.rel(PREVIEW, (a + c) / 2, (b + d) / 2)
        C.card_slot(cx, cy, (c - a) / 100 + 0.08, (d - b) / 100 + 0.08, gold=True)
        for x, left in ((1196, True), (1624, False)):
            ax, ay = C.rel(PREVIEW, x, 635)
            C.moved(lambda left=left: kit.arrow(0.36, 0.62, 'gold', left), ax, ay, 0.4)
    return P.render_piece('cu_preview', PREVIEW[2], PREVIEW[3], build)


def title():
    def build(w, h):
        kit.panel(w - 0.06, h - 0.08, r=0.26, face=('#2b2f8a', '#0d1040'), rim='gold', rim_w=0.08, inner_line='#ffd23f')
        kit.place(kit.icon_crown(), w / 2 - 0.42, 0.04, 0.3, 0.46)
    return P.render_piece('cu_title', TITLE[2], TITLE[3], build)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for i in range(8):
        if want(f'm{i}'):
            menu(i)
    if want('save'):
        b = ART['save']
        P.save_webp(C.cta('cu_save', b, 'crown', plate_inset=(0.4, 0.1)), os.path.join(OUT, 'save.webp'), b[2], b[3])
    if want('dice'):
        b = ART['dice']
        P.save_webp(C.icon_button('cu_dice', b, 'dice', 'navy', 0.66), os.path.join(OUT, 'dice.webp'), b[2], b[3])
    if want('back'):
        b = ART['back']
        P.save_webp(C.icon_button('cu_back', b, 'back', 'navy', 0.6), os.path.join(OUT, 'back.webp'), b[2], b[3])
    if want('plate'):
        decor = [(title(), TITLE), (presets(), PRESETS), (preview(), PREVIEW),
                 (C.pill('cu_coins', [1048, 8, 170, 60], 'coin'), [1048, 8, 170, 60]),
                 (C.pill('cu_gems', [1222, 8, 158, 60], 'gem'), [1222, 8, 158, 60]),
                 (C.pill('cu_energy', [1384, 8, 156, 60], 'bolt'), [1384, 8, 156, 60]),
                 (C.icon_only('cu_mail', [1542, 10, 60, 58], 'mail'), [1542, 10, 60, 58]),
                 (C.icon_button('cu_gear', [1604, 8, 60, 62], 'gear'), [1604, 8, 60, 62])]
        print(compose.plate('custom', decor, OUT, logo_box=[700, 2, 1000, 200]))
