# Design v3 (S13b): arena pick / showcase screen + the shared sub-screen top bar (back, title plaque, currency icons,
# capsules, plus buttons, mail, gear, badge), trait tiles, the gold CTA, card frames and arrows at the v2 boxes
# (src/ui/v2/art/arena.ts). The background is the selected arena's own big render.   python3 tools/ui3/arena.py
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402
import kit  # noqa: E402
import lib  # noqa: E402
import pieces as P  # noqa: E402

OUT = os.path.join(lib.ROOT, 'public', 'assets', 'ui3', 'arena')
only = sys.argv[1].split(',') if len(sys.argv) > 1 else None
ART = {'back': [9, 7, 103, 93], 'title': [100, 0, 500, 110], 'coin': [952, 7, 62, 62], 'gem': [1139, 9, 65, 62], 'bolt': [1323, 10, 50, 64],
       'plus1': [1082, 9, 54, 58], 'plus2': [1267, 11, 53, 54], 'plus3': [1443, 11, 54, 55], 'mail': [1507, 16, 60, 53], 'gear': [1587, 8, 69, 69],
       'trait1': [1219, 368, 139, 126], 'trait2': [1367, 368, 139, 122], 'trait3': [1514, 368, 139, 122], 'button': [1203, 498, 459, 129],
       'arrow_l': [0, 707, 51, 98], 'arrow_r': [1621, 714, 51, 85], 'card_sel': [45, 615, 342, 312], 'card': [366, 617, 329, 307], 'badge': [1540, 2, 40, 36],
       # v3 only: capsule bodies under the amounts (the v2 master had them painted)
       'cap1': [980, 14, 160, 50], 'cap2': [1166, 14, 156, 50], 'cap3': [1346, 14, 152, 50]}


def want(n):
    return not only or n in only


def save(name, im):
    b = ART[name]
    P.save_webp(im, os.path.join(OUT, f'{name}.webp'), b[2], b[3])


def build_all():
    if want('back'):
        save('back', C.icon_button('ar_back', ART['back'], 'back', 'navy', 0.56))
    if want('title'):
        def tb(w, h):
            kit.panel(w - 0.1, h - 0.24, r=0.3, face=('#2b2f8a', '#0d1040'), rim='gold', rim_w=0.09, inner_line='#ffd23f')
            kit.place(kit.icon_crown(), w / 2 - 0.5, 0.04, 0.3, 0.56)
        save('title', P.render_piece('ar_title', *ART['title'][2:], tb))
    for k, icon, s in (('coin', 'coin', 0.95), ('gem', 'gem', 1.0), ('bolt', 'bolt', 1.0)):
        if want(k):
            save(k, C.icon_only(f'ar_{k}', ART[k], icon, s))
    for k in ('plus1', 'plus2', 'plus3'):
        if want(k):
            save(k, C.icon_only(f'ar_{k}', ART[k], 'plus', 0.86))
    for k in ('cap1', 'cap2', 'cap3'):
        if want(k):
            def cb(w, h):
                body = lib.rounded_rect_pts(w - 0.06, h - 0.1, (h - 0.1) / 2 - 0.001, seg=14)
                lib.frame('rim', body, 0.04, 0.14, kit.gold(), bevel=0.016)
                lib.slab('face', lib.inset(body, 0.03), 0.1, 0.03, kit.candy('pillf', '#262a5a', '#0b0d26', 0.42, rough=0.3, coat=0.7), seg=4)
            save(k, P.render_piece(f'ar_{k}', *ART[k][2:], cb))
    if want('mail'):
        save('mail', C.icon_only('ar_mail', ART['mail'], 'mail', 1.0))
    if want('gear'):
        save('gear', C.icon_button('ar_gear', ART['gear'], 'gear'))
    if want('badge'):
        save('badge', P.render_piece('ar_badge', *ART['badge'][2:], lambda w, h: kit.badge(min(w, h) / 2 - 0.03), outline=2))
    for k in ('trait1', 'trait2', 'trait3'):
        if want(k):
            def tr(w, h):
                kit.panel(w - 0.06, h - 0.06, r=0.2, face=('#232c78', '#0a0d30'), rim='gold', rim_w=0.07)
            save(k, P.render_piece(f'ar_{k}', *ART[k][2:], tr))
    if want('button'):
        save('button', C.cta('ar_button', ART['button'], 'crown', plate_inset=(0.45, 0.12)))
    for k, left in (('arrow_l', True), ('arrow_r', False)):
        if want(k):
            save(k, P.render_piece(f'ar_{k}', *ART[k][2:], lambda w, h, left=left: kit.arrow(w * 0.85, h * 0.7, 'gold', left)))
    if want('card_sel') or want('card'):
        for k, gold in (('card_sel', True), ('card', False)):
            b = ART[k]
            inner = [61, 631, 371, 911] if gold else [382, 633, 679, 908]

            def cf(w, h, gold=gold, inner=inner, b=b):
                cx, cy = C.rel(b, (inner[0] + inner[2]) / 2, (inner[1] + inner[3]) / 2)
                pts = lib.rounded_rect_pts((inner[2] - inner[0]) / 100 + 0.12, (inner[3] - inner[1]) / 100 + 0.12, 0.22)
                if gold:
                    lib.frame('cf', [(x + cx, y + cy) for x, y in pts], 0.12, 0.3, kit.candy('cfg', '#ffe14d', '#ff9a00', 3.0, emission=0.25), bevel=0.05)
                else:
                    lib.frame('cf', [(x + cx, y + cy) for x, y in pts], 0.08, 0.3, kit.candy('cfb', '#7fd0ff', '#1f5fd0', 3.0), bevel=0.035)
            im = P.render_piece(f'ar_{k}', b[2], b[3], cf)
            if gold:
                from PIL import Image, ImageFilter
                g = im.filter(ImageFilter.GaussianBlur(14))
                o = Image.new('RGBA', im.size, (0, 0, 0, 0))
                o.alpha_composite(g)
                o.alpha_composite(im)
                im = o
            save(k, im)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    build_all()
