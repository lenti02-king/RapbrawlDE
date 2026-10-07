# Design v3 (S13b): VS screen in the stylized 3D look - the master's layout (player plates in the corners, both decks
# with card slots, the arena window with arrows, BEREIT with chains, the gold VS emblem under the logo), sprites at
# the v2 boxes (src/ui/v2/art/vs.ts).   python3 tools/ui3/vs.py [piece,..]   (stage: stage.py vs)
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compose  # noqa: E402
import kit  # noqa: E402
import lib  # noqa: E402
import pieces as P  # noqa: E402

OUT = os.path.join(lib.ROOT, 'public', 'assets', 'ui3', 'vs')
only = sys.argv[1].split(',') if len(sys.argv) > 1 else None
ART = {'p1': [75, 25, 362, 102], 'p2': [1293, 29, 318, 98], 'deck1': [17, 241, 320, 456], 'deck2': [1335, 241, 322, 456],
       'stage': [509, 497, 654, 278], 'arrow_l': [430, 549, 73, 111], 'arrow_r': [1164, 548, 77, 113], 'ready': [592, 772, 487, 133]}
TEXT = {
    'p1': {'avatar': [84, 34, 184, 120]}, 'p2': {'avatar': [1302, 38, 1388, 118]},
    'deck1': {'title': [116, 256, 286, 306], 'c1': [46, 322, 168, 442], 'c2': [188, 322, 310, 442], 'c3': [46, 508, 308, 628], 'n1': 444, 'n3': 630},
    'deck2': {'title': [1428, 256, 1630, 306], 'c1': [1358, 322, 1482, 442], 'c2': [1504, 322, 1630, 442], 'c3': [1362, 508, 1630, 628], 'n1': 444, 'n3': 630},
    'stage': {'win': [528, 516, 1140, 702], 'label': [732, 706, 970, 742]},
}
EMBLEM = [716, 290, 240, 200]


def want(n):
    return not only or n in only


def rel(box, x, y):
    return (x - box[0] - box[2] / 2) / 100, (box[1] + box[3] / 2 - y) / 100


def save(name, im):
    b = ART[name]
    P.save_webp(im, os.path.join(OUT, f'{name}.webp'), b[2], b[3])


def player(name, col):
    b = ART[name]

    def build(w, h):
        kit.panel(w - 0.04, h - 0.04, r=0.24, face=(kit.CANDY[col][0], kit.CANDY[col][1]) if False else ('#2b3aa0', '#0d1448') if col == 'blue' else ('#a0283e', '#480a18'), rim='gold', inner_line=kit.CANDY[col][0])
        a = TEXT[name]['avatar']
        ax, ay = rel(b, (a[0] + a[2]) / 2, (a[1] + a[3]) / 2)
        av = lib.rounded_rect_pts((a[2] - a[0]) / 100 + 0.06, (a[3] - a[1]) / 100 + 0.06, 0.16)
        lib.frame('avf', [(x + ax, y + ay) for x, y in av], 0.07, 0.3, kit.candy('avf' + col, kit.CANDY[col][2], kit.CANDY[col][1], 0.9), bevel=0.03)
        lib.slab('avbg', [(x + ax, y + ay) for x, y in lib.inset(av, 0.05)], 0.2, 0.02, kit.candy('avbg', '#2a2f6a', '#0b0e30', 0.8, rough=0.5, coat=0.2))

    save(name, P.render_piece(f'vs_{name}', b[2], b[3], build))


def deck(name, col):
    b = ART[name]
    T = TEXT[name]

    def build(w, h):
        face = ('#2a52c8', '#0c1a58') if col == 'blue' else ('#c02848', '#4a0816')
        kit.panel(w - 0.06, h - 0.06, r=0.3, face=face, rim='gold', rim_w=0.09, inner_line=kit.CANDY[col][0])
        tx0, ty0, tx1, ty1 = T['title']
        cx, cy = rel(b, tx0 - 40, (ty0 + ty1) / 2)
        kit.place(kit.icon_crown(), cx, cy, 0.35, 0.5)
        for k in ('c1', 'c2', 'c3'):
            x0, y0, x1, y1 = T[k]
            cx, cy = rel(b, (x0 + x1) / 2, (y0 + y1) / 2)
            cw, ch = (x1 - x0) / 100 + 0.08, (y1 - y0) / 100 + 0.08
            pts = lib.rounded_rect_pts(cw, ch, 0.12)
            sig = k == 'c3'
            lib.frame(f'cf{k}', [(x + cx, y + cy) for x, y in pts], 0.07 if not sig else 0.09, 0.3, kit.gold() if sig else kit.steel('#c9d2e6', 0.25), bevel=0.03)
            # dark name strip under the card
            ny = T['n3'] if sig else T['n1']
            sx, sy = rel(b, (x0 + x1) / 2, ny + 24)
            strip = lib.rounded_rect_pts(cw, 0.5, 0.12)
            lib.slab(f'ns{k}', [(x + sx, y + sy) for x, y in strip], 0.2, 0.03, kit.candy('ns', '#141a44', '#070a22', 0.5, rough=0.4, coat=0.4), seg=3)
            if sig:
                kit.place(kit.icon_crown(), cx, cy + ch / 2 + 0.05, 0.4, 0.42)

    im = P.render_piece(f'vs_{name}', b[2], b[3], build)
    # card windows transparent (the code draws the art into them)
    save(name, im)


def stage_win():
    b = ART['stage']

    def build(w, h):
        x0, y0, x1, y1 = TEXT['stage']['win']
        cx, cy = rel(b, (x0 + x1) / 2, (y0 + y1) / 2)
        pts = lib.rounded_rect_pts((x1 - x0) / 100 + 0.12, (y1 - y0) / 100 + 0.12, 0.2)
        lib.frame('sw', [(x + cx, y + cy) for x, y in pts], 0.12, 0.3, kit.gold(), bevel=0.05)
        for sx in (-1, 1):
            for sy in (-1, 1):
                lib.sphere('rv', (cx + sx * ((x1 - x0) / 200 + 0.0), cy + sy * ((y1 - y0) / 200 + 0.0), 0.32), 0.05, kit.steel('#f2ecd8', 0.2), scale=(1, 1, 0.6), seg=12)
        lx0, ly0, lx1, ly1 = TEXT['stage']['label']
        lx, ly = rel(b, (lx0 + lx1) / 2, (ly0 + ly1) / 2 + 4)
        lab = lib.rounded_rect_pts(3.4, 0.5, 0.25)
        lib.frame('lr', [(x + lx, y + ly) for x, y in lab], 0.045, 0.36, kit.gold(), bevel=0.018)
        lib.slab('lf', [(x + lx, y + ly) for x, y in lib.inset(lab, 0.035)], 0.32, 0.03, kit.candy('lf', '#262a5a', '#0b0d26', 0.5, rough=0.3, coat=0.7), seg=4)
        kit.place(kit.icon_crown() if False else kit.ICONS['lock']() if False else pin(), lx - 1.38, ly, 0.5, 0.36)

    save('stage', P.render_piece('vs_stage', b[2], b[3], build))


def pin():
    def f():
        pts = [(0.0, -0.5)] + [(0.3 * __import__('math').cos(a), 0.12 + 0.3 * __import__('math').sin(a)) for a in [__import__('math').radians(-30 + 240 * i / 24) for i in range(25)]]
        lib.slab('pin', lib.round_corners(pts, 0.03, 2), 0.18, 0.05, kit.candy('pin', '#ff6070', '#c4122e', 1.0), seg=4)
        lib.sphere('pinh', (0, 0.12, 0.19), 0.11, kit.flat('#ffffff', 0.3, 0.5), scale=(1, 1, 0.4))
    return kit.tilt(kit.new_objs(f), 6, -10)


def arrows():
    for name, left in (('arrow_l', True), ('arrow_r', False)):
        b = ART[name]
        save(name, P.render_piece(f'vs_{name}', b[2], b[3], lambda w, h, left=left: kit.arrow(w * 0.9, h * 0.82, 'gold', left)))


def ready():
    b = ART['ready']

    def build(w, h):
        bw, bh = w - 0.9, h - 0.24
        before = set(lib.bpy.data.objects)
        kit.candy_button(bw, bh, 'gold', r=0.36, depth=0.34)
        for sx in (-1, 1):
            kit.chain(f'ch{sx}', kit.hang((sx * (bw / 2 - 0.02), 0.3, 0.18), (sx * (w / 2 - 0.08), -h / 2 + 0.14, 0.18), 0.12), 0.32, 0.045)
        cx, cy = rel(b, 668, 838)
        kit.place(kit.icon_crown(), cx, cy, 0.5, 0.95)

    im = P.render_piece('vs_ready', b[2], b[3], build)
    save('ready', im)


def emblem():
    def build(w, h):
        m = kit.candy('vsgold', '#ffe14d', '#ff9500', 1.6, rough=0.22, coat=1.0)
        o = kit.text3d('vs', 'VS', 1.9, m, depth=0.2, bevel=0.05, loc=(0, -0.1, 0))
        o.rotation_euler = (0.12, -0.18, 0.06)
        # red-hot inner glow line behind
        kit.text3d('vsb', 'VS', 1.9, kit.glow('#ff4a2a', 3.0), depth=0.05, bevel=0.0, loc=(0.06, -0.18, -0.25)).rotation_euler = (0.12, -0.18, 0.06)

    return P.render_piece('vs_emblem', EMBLEM[2], EMBLEM[3], build, outline=4)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if want('p1'):
        player('p1', 'blue')
    if want('p2'):
        player('p2', 'red')
    if want('deck1'):
        deck('deck1', 'blue')
    if want('deck2'):
        deck('deck2', 'red')
    if want('stage'):
        stage_win()
    if want('arrows'):
        arrows()
    if want('ready'):
        ready()
    if want('emblem'):
        emblem()
    if want('plate'):
        # v2 had the player plates, both decks and the arena frame painted into the plate: the code only draws
        # their contents (avatars, card art, names, the arena picture), so they are plate decor here too
        import pieces as PP
        from PIL import Image as _I
        load = lambda n: _I.open(os.path.join(PP.TMP, f'vs_{n}.png')).convert('RGBA')
        decor = [(load(n), ART[n]) for n in ('deck1', 'deck2', 'p1', 'p2', 'stage')] + [(emblem(), EMBLEM)]
        print(compose.plate('vs', decor, OUT, logo_box=[640, 10, 1032, 280]))
