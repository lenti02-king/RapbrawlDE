# Design v3 (S13b): KÄMPFER screen - roster panel with tabs and 12 card frames, info panel (crown, class ribbon, level
# and stat troughs with icons, ability frames), currency pills, logo top left, the fighter big in the middle; sprites
# select + fills at the v2 boxes (src/ui/v2/art/fighters.ts).   python3 tools/ui3/fighters.py [piece,..]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402
import compose  # noqa: E402
import kit  # noqa: E402
import lib  # noqa: E402
import pieces as P  # noqa: E402

OUT = os.path.join(lib.ROOT, 'public', 'assets', 'ui3', 'fighters')
only = sys.argv[1].split(',') if len(sys.argv) > 1 else None
CARDS = [[28, 325, 182, 502], [190, 325, 338, 502], [350, 325, 496, 502], [508, 325, 656, 502], [28, 516, 182, 692], [190, 516, 338, 692], [350, 516, 496, 692], [508, 516, 656, 692], [28, 706, 182, 885], [190, 706, 338, 885], [350, 706, 496, 885], [508, 706, 656, 885]]
TINT = ['gold', 'purple', 'blue', 'red', 'green', 'purple', 'gold', 'blue', 'red', 'green', 'purple', 'gold']
TABS = [[32, 244, 146, 310], [150, 244, 272, 310], [276, 244, 396, 310], [400, 244, 506, 310], [510, 244, 640, 310]]
ROSTER = [10, 212, 682, 696]
INFO = [1170, 205, 495, 560]
ART = {'select': [1200, 772, 443, 113], 'fill_lv': [1344, 348, 116, 18], 'fill_p': [1364, 397, 156, 19], 'fill_s': [1364, 444, 126, 19], 'fill_d': [1364, 491, 144, 20]}


def want(n):
    return not only or n in only


def roster():
    def build(w, h):
        kit.panel(w - 0.06, h - 0.06, r=0.32, face=('#232c78', '#0a0d30'), rim='gold', rim_w=0.1, inner_line='#5fa8ff')
        # tab strip
        x0, y0 = TABS[0][0], TABS[0][1]
        x1, y1 = TABS[-1][2], TABS[-1][3]
        cx, cy = C.rel(ROSTER, (x0 + x1) / 2, (y0 + y1) / 2)
        lib.slab('tabs', [(x + cx, y + cy) for x, y in lib.rounded_rect_pts((x1 - x0) / 100 + 0.06, (y1 - y0) / 100, 0.18)], 0.22, 0.03, kit.candy('tabs', '#141a44', '#070a22', 0.7, rough=0.4, coat=0.4), seg=3)
        for t in TABS[1:]:
            dx, dy = C.rel(ROSTER, t[0] - 2, (y0 + y1) / 2)
            lib.slab('div', lib.rounded_rect_pts(0.04, 0.5, 0.02), 0.04, 0.01, kit.gold(), z0=0.24).location = (dx, dy, 0)
        for i, (a, b, c, d) in enumerate(CARDS):
            cw, ch = (c - a) / 100, (d - b) / 100
            cx, cy = C.rel(ROSTER, (a + c) / 2, (b + d) / 2)
            col = TINT[i]
            pts = lib.rounded_rect_pts(cw, ch, 0.14)
            lib.frame(f'cf{i}', [(x + cx, y + cy) for x, y in pts], 0.07, 0.32, kit.gold() if col == 'gold' else kit.candy('cr' + col, kit.CANDY[col][2], kit.CANDY[col][1], ch), bevel=0.03)
            # dark window fill + lock (covered by the portrait when the slot is used), name strip
            wh = ch * 0.67
            win = lib.rounded_rect_pts(cw - 0.12, wh - 0.06, 0.1)
            lib.slab(f'cw{i}', [(x + cx, y + cy + ch / 2 - wh / 2 - 0.03) for x, y in win], 0.2, 0.02, kit.candy('cwin', '#26306e', '#0b0f30', wh, rough=0.45, coat=0.3), seg=3)
            kit.place(kit.icon_lock(), cx, cy + ch / 2 - wh / 2, 0.3, cw * 0.32)
            st = lib.rounded_rect_pts(cw - 0.12, ch * 0.28, 0.08)
            lib.slab(f'cs{i}', [(x + cx, y + cy - ch / 2 + ch * 0.17) for x, y in st], 0.22, 0.02, kit.candy('cstrip', '#141a44', '#070a22', 0.5, rough=0.4, coat=0.4), seg=3)
        # chain along the top edge
        kit.chain('topchain', [(*C.rel(ROSTER, 40, 214), 0.4), (*C.rel(ROSTER, 660, 214), 0.4)], 0.3, 0.04)
    return P.render_piece('fi_roster', ROSTER[2], ROSTER[3], build)


def info():
    def build(w, h):
        kit.panel(w - 0.06, h - 0.06, r=0.32, face=('#232c78', '#0a0d30'), rim='gold', rim_w=0.1, inner_line='#5fa8ff')
        kit.place(kit.icon_crown(), *C.rel(INFO, 1226, 256), 0.35, 0.72)
        rx, ry = C.rel(INFO, 1354, 308)
        lib.slab('ribbon', [(x + rx, y + ry) for x, y in lib.rounded_rect_pts(1.96, 0.36, 0.08)], 0.2, 0.03, kit.candy('rib', '#ffe14d', '#ff9a00', 0.36), seg=3)
        C.trough(*C.rel(INFO, 1488, 357), 2.94, 0.24)
        for y, icon, col in ((406, 'glove', 'red'), (453, 'wing', 'blue'), (500, 'shield', 'green')):
            kit.place(kit.ICONS[icon](), *C.rel(INFO, 1222, y), 0.35, 0.42)
            C.trough(*C.rel(INFO, 1468, y + 0), 2.14, 0.23)
        for (a, b, c, d), gold in (((1192, 600, 1316, 706), False), ((1340, 600, 1464, 706), False), ((1490, 592, 1640, 706), True)):
            cx, cy = C.rel(INFO, (a + c) / 2, (b + d) / 2)
            C.card_slot(cx, cy, (c - a) / 100 + 0.08, (d - b) / 100 + 0.08, gold=gold, strip=0.36)
        # header rule under FÄHIGKEITEN
        hx, hy = C.rel(INFO, 1410, 586)
        lib.slab('rule', [(x + hx, y + hy) for x, y in lib.rounded_rect_pts(4.4, 0.04, 0.02)], 0.22, 0.01, kit.gold())
    return P.render_piece('fi_info', INFO[2], INFO[3], build)


def sprites():
    if want('select'):
        b = ART['select']
        P.save_webp(C.cta('fi_select', b, 'glove'), os.path.join(OUT, 'select.webp'), b[2], b[3])
    for k, (t, bo) in {'fill_lv': ('#8fe8ff', '#1a8cff'), 'fill_p': ('#ff8a8a', '#e3122b'), 'fill_s': ('#8fe8ff', '#1a8cff'), 'fill_d': ('#9dff7a', '#21b62a')}.items():
        if want(k):
            b = ART[k]
            P.save_webp(C.fill(f'fi_{k}', b, t, bo), os.path.join(OUT, f'{k}.webp'), b[2], b[3])


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    sprites()
    if want('plate'):
        decor = [(roster(), ROSTER), (info(), INFO),
                 (C.pill('fi_coins', [996, 8, 190, 60], 'coin'), [996, 8, 190, 60]),
                 (C.pill('fi_gems', [1190, 8, 178, 60], 'gem'), [1190, 8, 178, 60]),
                 (C.pill('fi_energy', [1372, 8, 168, 60], 'bolt'), [1372, 8, 168, 60]),
                 (C.icon_only('fi_mail', [1542, 10, 58, 58], 'mail'), [1542, 10, 58, 58]),
                 (C.icon_button('fi_gear', [1604, 8, 60, 62], 'gear'), [1604, 8, 60, 62])]
        print(compose.plate('fighters', decor, OUT, logo_box=[120, 2, 470, 222]))
