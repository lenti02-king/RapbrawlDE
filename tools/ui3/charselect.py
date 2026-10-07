# Design v3 (S13b): character select in the stylized 3D look - the master's layout (team banners + pedestals in the
# stadium render, the octagon roster hanging on chains, team name plates chained to the VS disc, the bottom bar),
# sprites title / sel_p1 / sel_p2 at the v2 boxes (src/ui/v2/art/select.ts).
#   python3 tools/ui3/charselect.py [piece,..]   (stage: python3 tools/ui3/stage.py select 1 48)
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compose  # noqa: E402
import kit  # noqa: E402
import lib  # noqa: E402
import pieces as P  # noqa: E402
from PIL import Image  # noqa: E402

OUT = os.path.join(lib.ROOT, 'public', 'assets', 'ui3', 'select')
only = sys.argv[1].split(',') if len(sys.argv) > 1 else None
TILES = [[780, 117, 890, 217], [670, 224, 773, 318], [780, 224, 890, 318], [897, 224, 1000, 318], [550, 322, 659, 424], [667, 322, 773, 424], [778, 322, 890, 424], [897, 322, 1007, 424], [1013, 322, 1120, 424], [660, 424, 777, 528], [780, 424, 890, 528], [897, 424, 1003, 528], [780, 528, 890, 625]]
CROWN = 6
GRID = [520, 0, 640, 640]
NAMES = [397, 627, 886, 206]
BAR = [533, 869, 608, 72]
ART = {'title': [629, 16, 412, 77], 'sel_p1': [646, 410, 145, 132], 'sel_p2': [883, 308, 138, 130]}


def want(n):
    return not only or n in only


def rel(box, x, y):
    """Layout px -> metres relative to the centre of `box` (y up)."""
    return (x - box[0] - box[2] / 2) / 100, (box[1] + box[3] / 2 - y) / 100


def grid():
    def build(w, h):
        frame_m = kit.steel('#3b4160', 0.3)
        for i, (x0, y0, x1, y1) in enumerate(TILES):
            tw, th = (x1 - x0) / 100, (y1 - y0) / 100
            cx, cy = rel(GRID, (x0 + x1) / 2, (y0 + y1) / 2)
            outer = [(x + cx, y + cy) for x, y in kit.octagon_pts(tw - 0.02, th - 0.02, 0.2, 0.015)]
            win = [(x + cx, y + cy) for x, y in kit.octagon_pts(tw * 0.84, th * 0.84, 0.19, 0.01)]
            lib.frame(f'oct{i}', outer, tw * 0.075, 0.22, frame_m, bevel=0.025)
            lib.frame(f'octg{i}', [(x + cx, y + cy) for x, y in kit.octagon_pts(tw * 0.86, th * 0.86, 0.19, 0.01)], 0.018, 0.24, kit.gold(), bevel=0.006, seg=2)
            if i == CROWN:
                lib.slab(f'win{i}', win, 0.16, 0.02, kit.candy('crownwin', '#ffe14d', '#ff9a00', th), seg=3)
                kit.place(kit.icon_crown(), cx, cy + 0.02, 0.3, tw * 0.62)
            else:
                lib.slab(f'win{i}', win, 0.16, 0.02, kit.candy('lockwin', '#26306e', '#0b0f30', th, rough=0.45, coat=0.3), seg=3)
                kit.place(kit.icon_lock(), cx, cy, 0.25, tw * 0.36)
        # gold studs where tiles touch
        for a in range(len(TILES)):
            for b in range(a + 1, len(TILES)):
                A, B = TILES[a], TILES[b]
                ca = ((A[0] + A[2]) / 2, (A[1] + A[3]) / 2)
                cb = ((B[0] + B[2]) / 2, (B[1] + B[3]) / 2)
                d = ((ca[0] - cb[0]) ** 2 + (ca[1] - cb[1]) ** 2) ** 0.5
                if d < 130:
                    mx, my = rel(GRID, (ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2)
                    lib.sphere('stud', (mx, my, 0.24), 0.06, kit.gold('#ffd75a', 0.18), scale=(1, 1, 0.6), seg=16)
        # chains up to the top of the screen and to the title plaque
        for (x, y_top, y_bot) in ((835, 92, 119), (721, -10, 226), (948, -10, 226), (604, -10, 324), (1066, -10, 324)):
            kit.chain(f'c{x}', [(*rel(GRID, x, y_top), 0.1), (*rel(GRID, x, y_bot), 0.1)], 0.3, 0.042)

    return P.render_piece('sel_grid', GRID[2], GRID[3], build)


def names():
    def build(w, h):
        for side, (x0, col, cx_icon) in enumerate(((410, 'blue', 456), (912, 'red', 1216))):
            bw, bh = 3.5, 1.38
            cx, cy = rel(NAMES, x0 + 175, 700)
            pts = lib.rounded_rect_pts(bw, bh, 0.26)
            lib.frame(f'nrim{side}', [(x + cx, y + cy) for x, y in pts], 0.09, 0.3, kit.gold(), bevel=0.04)
            lib.slab(f'nface{side}', [(x + cx, y + cy) for x, y in lib.inset(pts, 0.07)], 0.22, 0.04, kit.candy('nf' + col, kit.CANDY[col][0], kit.CANDY[col][1], bh, rough=0.35, coat=0.6), seg=4)
            # darker name window
            win = lib.rounded_rect_pts(2.5, 0.78, 0.16)
            wx = cx + (0.42 if side == 0 else -0.42)
            lib.slab(f'nwin{side}', [(x + wx, y + cy - 0.2) for x, y in win], 0.25, 0.03, kit.candy('nw', '#141a44', '#070a22', 0.8, rough=0.4, coat=0.4), seg=3)
            ix, iy = rel(NAMES, cx_icon, 700)
            kit.place(kit.icon_crown(), ix, iy, 0.35, 0.62)
            for sy in (-1, 1):
                for sx in (-1, 1):
                    lib.sphere('rv', (cx + sx * (bw / 2 - 0.12), cy + sy * (bh / 2 - 0.12), 0.32), 0.035, kit.steel('#f2ecd8', 0.2), scale=(1, 1, 0.6), seg=12)
        # VS disc with chains to both plates, status pill under it
        dx, dy = rel(NAMES, 836, 713)
        root_objs = set(lib.bpy.data.objects)
        kit.disc(0.5, 'navy', 0.18)
        for o in set(lib.bpy.data.objects) - root_objs:
            if o.parent is None:
                o.location.x += dx
                o.location.y += dy
                o.location.z += 0.12
        for a, b in (((760, 700), (788, 713)), ((884, 713), (912, 700))):
            kit.chain('vc', [(*rel(NAMES, *a), 0.2), (*rel(NAMES, *b), 0.2)], 0.22, 0.03)
        sx_, sy_ = rel(NAMES, 836, 784)
        st = lib.rounded_rect_pts(2.3, 0.44, 0.22)
        lib.frame('srim', [(x + sx_, y + sy_) for x, y in st], 0.04, 0.16, kit.gold(), bevel=0.016)
        lib.slab('sface', [(x + sx_, y + sy_) for x, y in lib.inset(st, 0.03)], 0.12, 0.03, kit.candy('sf', '#262a5a', '#0b0d26', 0.46, rough=0.3, coat=0.7), seg=4)

    return P.render_piece('sel_names', NAMES[2], NAMES[3], build)


def bar():
    def build(w, h):
        kit.panel(w + 0.1, h + 0.5, r=0.3, face=('#1f2766', '#0a0d30'), rim='gold', rim_w=0.08, rivet=False)
        for o in lib.bpy.data.objects:
            if o.parent is None and o.type == 'MESH':
                o.location.y -= 0.25
        for (x0, x1, col) in ((549, 701, 'navy'), (968, 1126, 'gold')):
            cx, cy = rel(BAR, (x0 + x1) / 2, 906)
            before = set(lib.bpy.data.objects)
            kit.candy_button((x1 - x0) / 100, 0.56, col, r=0.2, depth=0.2, gloss=True)
            for o in set(lib.bpy.data.objects) - before:
                if o.parent is None:
                    o.location.x += cx
                    o.location.y += cy
                    o.location.z += 0.12
        mx, my = rel(BAR, 835, 906)
        lib.slab('mid', [(x + mx, y + my) for x, y in lib.rounded_rect_pts(2.4, 0.48, 0.2)], 0.2, 0.03, kit.candy('mid', '#0d1236', '#05071a', 0.5, rough=0.45, coat=0.3), seg=3)

    return P.render_piece('sel_bar', BAR[2], BAR[3], build)


def title_build(w, h):
    kit.panel(w - 0.06, h - 0.08, r=0.24, face=('#2b2f8a', '#0d1040'), rim='gold', rim_w=0.08, inner_line='#ffd23f')
    kit.place(kit.icon_crown(), w / 2 - 0.42, 0.04, 0.3, 0.46)


def title():
    b = ART['title']
    P.save_webp(P.render_piece('sel_title', b[2], b[3], title_build), os.path.join(OUT, 'title.webp'), b[2], b[3])


def ring(name, color):
    b = ART[name]

    def build(w, h):
        pts = kit.octagon_pts(w - 0.16, h - 0.16, 0.2, 0.03)
        lib.tube_path('ring', [(x, y, 0.1) for x, y in pts], 0.06, kit.candy('ring' + color, color, color, h, emission=1.2), closed=True)
        lib.tube_path('ringc', [(x, y, 0.16) for x, y in pts], 0.022, kit.glow('#ffffff', 1.6), closed=True)

    im = P.render_piece(name, b[2], b[3], build, outline=2)
    # soft neon glow around the tube
    from PIL import ImageFilter
    g = im.filter(ImageFilter.GaussianBlur(10))
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.alpha_composite(g)
    out.alpha_composite(g)
    out.alpha_composite(im)
    P.save_webp(out, os.path.join(OUT, f'{name}.webp'), b[2], b[3])


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if want('title'):
        title()
    if want('sel_p1'):
        ring('sel_p1', '#3d8dff')
    if want('sel_p2'):
        ring('sel_p2', '#ff3355')
    if want('plate'):
        title_im = P.render_piece('sel_title', ART['title'][2], ART['title'][3], title_build)
        decor = [(grid(), GRID), (names(), NAMES), (bar(), BAR), (title_im, ART['title'])]
        print(compose.plate('select', decor, OUT))
