# Design v3 (S13b): loading screen - the stadium seen wide, the logo big in the middle, the progress bar plate and the
# tip plate in the master's places (src/ui/v2/art/loading.ts); sprite: fill.   python3 tools/ui3/loading.py
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compose  # noqa: E402
import kit  # noqa: E402
import lib  # noqa: E402
import pieces as P  # noqa: E402

OUT = os.path.join(lib.ROOT, 'public', 'assets', 'ui3', 'loading')
only = sys.argv[1].split(',') if len(sys.argv) > 1 else None
BAR = [459, 669, 760, 124]
TIP = [477, 799, 726, 102]
FILL = [488, 706, 358, 34]
TRACK = [488, 706, 1190, 740]


def want(n):
    return not only or n in only


def rel(box, x, y):
    return (x - box[0] - box[2] / 2) / 100, (box[1] + box[3] / 2 - y) / 100


def bar():
    def build(w, h):
        kit.panel(w - 0.06, h - 0.1, r=0.3, face=('#26307f', '#0d1240'), rim='gold', rim_w=0.09, inner_line='#5fa8ff')
        cx, cy = rel(BAR, (TRACK[0] + TRACK[2]) / 2, (TRACK[1] + TRACK[3]) / 2)
        tr = lib.rounded_rect_pts((TRACK[2] - TRACK[0]) / 100 + 0.08, (TRACK[3] - TRACK[1]) / 100 + 0.08, 0.2)
        lib.frame('tf', [(x + cx, y + cy) for x, y in tr], 0.045, 0.24, kit.gold(), bevel=0.016)
        lib.slab('tt', [(x + cx, y + cy) for x, y in lib.inset(tr, 0.04)], 0.18, 0.02, kit.flat('#05071a', 0.5))
    return P.render_piece('ld_bar', BAR[2], BAR[3], build)


def tip():
    def build(w, h):
        kit.panel(w - 0.06, h - 0.1, r=0.3, face=('#1f2766', '#0a0d30'), rim='gold', rim_w=0.08)
        bx, by = rel(TIP, 540, 845)
        kit.place(kit.icon_bulb(), bx, by, 0.3, 0.6)
    return P.render_piece('ld_tip', TIP[2], TIP[3], build)


def fill():
    def build(w, h):
        lib.slab('bar', lib.rounded_rect_pts(w - 0.02, h - 0.04, (h - 0.04) / 2), 0.12, 0.04, kit.candy('ldf', '#ffe36b', '#ff8a00', h, emission=0.3), seg=4)
    P.save_webp(P.render_piece('ld_fill', FILL[2], FILL[3], build, outline=0), os.path.join(OUT, 'fill.webp'), FILL[2], FILL[3])


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if want('fill'):
        fill()
    if want('plate'):
        print(compose.plate('loading', [(bar(), BAR), (tip(), TIP)], OUT, logo_box=[500, 10, 1172, 440]))
