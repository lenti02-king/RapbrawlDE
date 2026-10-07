# Design v3 (S13b): lobby - profile, pills, friends panel, room code, team ribbons + four slots around the VS emblem,
# game mode + match settings panels, arena strip; sprites invite / start / back at the v2 boxes (art/lobby.ts).
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402
import compose  # noqa: E402
import kit  # noqa: E402
import lib  # noqa: E402
import pieces as P  # noqa: E402

OUT = os.path.join(lib.ROOT, 'public', 'assets', 'ui3', 'lobby')
only = sys.argv[1].split(',') if len(sys.argv) > 1 else None
ART = {'invite': [996, 242, 233, 60], 'start': [587, 793, 521, 122], 'back': [17, 853, 220, 71]}
PROFILE = [18, 6, 380, 104]
FRIENDS = [16, 160, 352, 692]
ROOM = [650, 212, 330, 100]
TEAMS = [430, 314, 842, 310]
MODE = [1338, 212, 320, 176]
SETTINGS = [1338, 396, 320, 236]
ARENAS = [424, 634, 972, 150]


def want(n):
    return not only or n in only


def win(box, a, b, c, d, gold=False, fill=True):
    cx, cy = C.rel(box, (a + c) / 2, (b + d) / 2)
    if fill:
        lib.slab('w', [(x + cx, y + cy) for x, y in lib.rounded_rect_pts((c - a) / 100, (d - b) / 100, 0.1)], 0.2, 0.02, kit.candy('wf', '#141a44', '#070a22', 1.0, rough=0.4, coat=0.4), seg=3)
    C.card_slot(cx, cy, (c - a) / 100 + 0.06, (d - b) / 100 + 0.06, gold=gold)


def profile():
    def build(w, h):
        kit.panel(w - 0.04, h - 0.04, r=0.26, face=('#2b3aa0', '#0d1448'), inner_line='#5fa8ff')
        ax, ay = C.rel(PROFILE, 79, 59)
        av = lib.rounded_rect_pts(1.04, 0.96, 0.16)
        lib.frame('avf', [(x + ax, y + ay) for x, y in av], 0.07, 0.3, kit.candy('avf', '#7fd0ff', '#1f6fe0', 0.9), bevel=0.03)
        C.trough(*C.rel(PROFILE, 302, 78), 1.62, 0.22)
        kit.place(kit.icon_crown(), *C.rel(PROFILE, 168, 26), 0.3, 0.3)
    return P.render_piece('lo_profile', PROFILE[2], PROFILE[3], build)


def friends():
    def build(w, h):
        kit.panel(w - 0.06, h - 0.06, r=0.3, face=('#232c78', '#0a0d30'), rim='gold', rim_w=0.09, inner_line='#5fa8ff')
        bx, by = C.rel(FRIENDS, 304, 195)
        C.moved(lambda: kit.candy_button(0.66, 0.5, 'blue', r=0.14, depth=0.2), bx, by, 0.1)
        kit.place(kit.icon_person_plus(), bx, by, 0.5, 0.42)
        lx, ly = C.rel(FRIENDS, 193, 536)
        lib.slab('list', [(x + lx, y + ly) for x, y in lib.rounded_rect_pts(3.3, 6.2, 0.18)], 0.2, 0.03, kit.candy('lst', '#141a44', '#070a22', 6.0, rough=0.4, coat=0.3), seg=3)
    return P.render_piece('lo_friends', FRIENDS[2], FRIENDS[3], build)


def room():
    def build(w, h):
        kit.panel(w - 0.06, h - 0.06, r=0.24, face=('#232c78', '#0a0d30'), rim='gold', rim_w=0.08)
        win(ROOM, 712, 252, 860, 300, gold=True)
        bx, by = C.rel(ROOM, 910, 275)
        C.moved(lambda: kit.candy_button(0.56, 0.5, 'blue', r=0.14, depth=0.2), bx, by, 0.1)
        kit.place(kit.icon_copy(), bx, by, 0.5, 0.36)
    return P.render_piece('lo_room', ROOM[2], ROOM[3], build)


def teams():
    def build(w, h):
        for (a, b, c, d), col in (((470, 320, 770, 374), 'blue'), ((935, 320, 1235, 374), 'red')):
            cx, cy = C.rel(TEAMS, (a + c) / 2, (b + d) / 2)
            lib.slab('rib', [(x + cx, y + cy) for x, y in lib.rounded_rect_pts((c - a) / 100, (d - b) / 100, 0.12)], 0.22, 0.04, kit.candy('rib' + col, kit.CANDY[col][0], kit.CANDY[col][1], 0.5), seg=3)
            kit.place(kit.icon_crown(), cx - (c - a) / 200 + 0.4, cy, 0.4, 0.44)
        for k, ((a, b, c, d), col) in enumerate((((448, 378, 612, 612), 'blue'), ((622, 380, 772, 600), 'blue'), ((938, 380, 1092, 600), 'red'), ((1100, 380, 1256, 600), 'red'))):
            cx, cy = C.rel(TEAMS, (a + c) / 2, (b + d) / 2)
            pts = lib.rounded_rect_pts((c - a) / 100, (d - b) / 100, 0.16)
            lib.frame(f'sf{k}', [(x + cx, y + cy) for x, y in pts], 0.08, 0.3, kit.gold() if k == 0 else kit.candy('sfr' + col, kit.CANDY[col][2], kit.CANDY[col][1], 2.2), bevel=0.03)
            lib.slab(f'sw{k}', [(x + cx, y + cy) for x, y in lib.inset(pts, 0.07)], 0.2, 0.03, kit.candy('sw' + col, kit.CANDY[col][1], '#070a22', 2.2, rough=0.4, coat=0.4), seg=3)
            if k:
                kit.place(kit.icon_person(color='white' if False else col), cx, cy + 0.25, 0.3, 0.8)
        V_emblem(w, h)

    def V_emblem(w, h):
        m = kit.candy('vsgold', '#ffe14d', '#ff9500', 1.6, rough=0.22, coat=1.0)
        cx, cy = C.rel(TEAMS, 855, 490)
        kit.text3d('vs', 'VS', 1.3, m, depth=0.16, bevel=0.04, loc=(cx, cy, 0.3)).rotation_euler = (0.12, -0.18, 0.06)
    return P.render_piece('lo_teams', TEAMS[2], TEAMS[3], build)


def mode():
    def build(w, h):
        kit.panel(w - 0.06, h - 0.06, r=0.26, face=('#232c78', '#0a0d30'), rim='gold', rim_w=0.08)
        for (a, b, c, d), col, n in (((1354, 270, 1498, 374), 'gold', 2), ((1506, 270, 1646, 374), 'navy', 4)):
            cx, cy = C.rel(MODE, (a + c) / 2, (b + d) / 2)
            C.moved(lambda col=col, a=a, c=c, b=b, d=d: kit.candy_button((c - a) / 100, (d - b) / 100, col, r=0.18, depth=0.22, gloss=col != 'navy'), cx, cy, 0.1)
            kit.place(kit.icon_people(color='blue' if col == 'gold' else 'purple'), cx, cy + 0.2, 0.5, 0.5 if n == 2 else 0.56)
    return P.render_piece('lo_mode', MODE[2], MODE[3], build)


def settings():
    def build(w, h):
        kit.panel(w - 0.06, h - 0.06, r=0.26, face=('#232c78', '#0a0d30'), rim='gold', rim_w=0.08)
        for y in (474, 534, 594):
            cx, cy = C.rel(SETTINGS, 1500, y)
            lib.slab('row', [(x + cx, y_ + cy) for x, y_ in lib.rounded_rect_pts(2.86, 0.48, 0.14)], 0.2, 0.02, kit.candy('row', '#141a44', '#070a22', 0.5, rough=0.4, coat=0.3), seg=3)
            vx, vy = C.rel(SETTINGS, 1562, y)
            lib.frame('vf', [(x + vx, y_ + vy) for x, y_ in lib.rounded_rect_pts(1.3, 0.4, 0.12)], 0.03, 0.26, kit.gold(), bevel=0.01)
    return P.render_piece('lo_settings', SETTINGS[2], SETTINGS[3], build)


def arenas():
    def build(w, h):
        kit.panel(w - 0.06, h - 0.06, r=0.28, face=('#232c78', '#0a0d30'), rim='gold', rim_w=0.08)
        for a, b, c, d in ([502, 674, 702, 772], [720, 674, 906, 772], [926, 674, 1112, 772], [1130, 674, 1320, 772]):
            cx, cy = C.rel(ARENAS, (a + c) / 2, (b + d) / 2)
            C.card_slot(cx, cy, (c - a) / 100 + 0.06, (d - b) / 100 + 0.06)
        for x, left in ((466, True), (1353, False)):
            ax, ay = C.rel(ARENAS, x, 725)
            C.moved(lambda left=left: kit.arrow(0.4, 0.62, 'gold', left), ax, ay, 0.3)
    return P.render_piece('lo_arenas', ARENAS[2], ARENAS[3], build)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if want('invite'):
        b = ART['invite']

        def build(w, h):
            kit.candy_button(w - 0.06, h - 0.08, 'blue', r=0.2, depth=0.22)
            kit.place(kit.icon_person_plus(), -w / 2 + 0.42, 0, 0.42, h * 0.72)
        P.save_webp(P.render_piece('lo_invite', b[2], b[3], build), os.path.join(OUT, 'invite.webp'), b[2], b[3])
    if want('start'):
        b = ART['start']
        P.save_webp(C.cta('lo_start', b, 'glove', plate_inset=(0.45, 0.1)), os.path.join(OUT, 'start.webp'), b[2], b[3])
    if want('back'):
        b = ART['back']

        def build(w, h):
            kit.candy_button(w - 0.06, h - 0.08, 'navy', r=0.22, depth=0.22)
            kit.place(kit.icon_back(), -w / 2 + 0.5, 0, 0.42, h * 0.62)
        P.save_webp(P.render_piece('lo_back', b[2], b[3], build), os.path.join(OUT, 'back.webp'), b[2], b[3])
    if want('plate'):
        decor = [(profile(), PROFILE), (friends(), FRIENDS), (room(), ROOM), (teams(), TEAMS), (mode(), MODE), (settings(), SETTINGS), (arenas(), ARENAS),
                 (C.pill('lo_coins', [1052, 8, 170, 60], 'coin'), [1052, 8, 170, 60]),
                 (C.pill('lo_gems', [1226, 8, 158, 60], 'gem'), [1226, 8, 158, 60]),
                 (C.pill('lo_energy', [1388, 8, 152, 60], 'bolt'), [1388, 8, 152, 60]),
                 (C.icon_only('lo_mail', [1542, 10, 60, 58], 'mail'), [1542, 10, 60, 58]),
                 (C.icon_button('lo_gear', [1604, 8, 60, 62], 'gear'), [1604, 8, 60, 62])]
        print(compose.plate('lobby', decor, OUT, logo_box=[700, 0, 990, 205]))
