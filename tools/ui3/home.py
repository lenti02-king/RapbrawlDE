# Design v3 (S13b): the home screen in the stylized 3D look - every v2 sprite re-made as a 3D piece at the same box
# (src/ui/v2/art/home.ts), plate = Blender stadium (stage.py) + currency pills + logo.
#   python3 tools/ui3/home.py [piece,piece..]   (stage render: python3 tools/ui3/stage.py home 1 64)
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import lib  # noqa: E402
import pieces as P  # noqa: E402
import textures as tx  # noqa: E402
from PIL import Image  # noqa: E402

OUT = os.path.join(lib.ROOT, 'public', 'assets', 'ui3', 'home')
PORT = os.path.join(lib.CACHE, 'portraits')
if not os.path.isdir(PORT):
    PORT = os.path.join(lib.ROOT, '.cache', 'ui3', 'portraits')
only = sys.argv[1].split(',') if len(sys.argv) > 1 else None
ART = {
    'profile': [37, 10, 403, 106], 'mail': [1525, 15, 64, 47], 'gear': [1601, 14, 59, 58],
    'fighters': [25, 206, 268, 196], 'decks': [25, 409, 267, 180], 'shop': [28, 594, 263, 171],
    'events': [1371, 255, 276, 169], 'pass': [1363, 433, 280, 186], 'missions': [1355, 624, 285, 152],
    'fight': [522, 708, 606, 196], 'nav': [0, 803, 1672, 138], 'b_fighters': [256, 196, 39, 41],
    'b_events': [1607, 242, 41, 41], 'b_pass': [1607, 428, 41, 40], 'b_nav_events': [1191, 816, 40, 39],
    'b_mail': [1561, 0, 37, 34], 'xp_fill': [249, 75, 108, 20], 'pass_fill': [1382, 583, 71, 19],
}
# label zones (abs) -> strip tops of the tiles
LABEL_TOP = {'fighters': 350, 'decks': 536, 'shop': 712, 'events': 372, 'pass': 530, 'missions': 720}
TILE = {
    'fighters': ('purple', ('#c46bff', '#4a1290'), 'crown'),
    'decks': ('blue', ('#4fb4ff', '#0f2f80'), 'cards'),
    'shop': ('gold', ('#ffbe3d', '#8a3a00'), 'bag'),
    'events': ('red', ('#ff5f8a', '#6a0a2a'), 'calendar'),
    'pass': ('gold', ('#ffd84a', '#7a4a00'), 'ticket'),
    'missions': ('green', ('#46e08a', '#0a4a28'), 'clipboard'),
}


def want(n):
    return not only or n in only


def at(box, rx, ry):
    """Reference px inside a box -> metres relative to the box centre (y up)."""
    return (rx - box[2] / 2) / 100, (box[3] / 2 - ry) / 100


def out(name, im, box):
    P.save_webp(im, os.path.join(OUT, f'{name}.webp'), box[2], box[3])


# ------------------------------------------------------------------ pieces
def profile():
    b = ART['profile']

    def build(w, h):
        kit.panel(w, h, r=0.26, face=('#2b3aa0', '#0d1448'), inner_line='#5fa8ff')
        ax, ay = at(b, 60, 52)
        av = lib.rounded_rect_pts(1.0, 0.86, 0.16)
        lib.frame('avf', [(x + ax, y + ay) for x, y in av], 0.07, 0.3, kit.candy('avf', '#7fd0ff', '#1f6fe0', 0.9), bevel=0.03)
        lib.slab('avbg', [(x + ax, y + ay) for x, y in lib.inset(av, 0.05)], 0.2, 0.02, kit.candy('avbg', '#3a64d8', '#121c58', 0.8, rough=0.5, coat=0.2))
        tx_, ty_ = at(b, 230 - 37 + 70, 75)
        tr = lib.rounded_rect_pts(1.74, 0.24, 0.12)
        lib.frame('trf', [(x + 0.96, y - 0.22) for x, y in tr], 0.035, 0.24, kit.gold(), bevel=0.012)
        lib.slab('tr', [(x + 0.96, y - 0.22) for x, y in lib.inset(tr, 0.03)], 0.18, 0.02, kit.flat('#07091f', 0.5))
        cx, cy = at(b, 147, 34)
        kit.place(kit.icon_crown(), cx, cy, 0.3, 0.34)

    out('profile', P.render_piece('profile', b[2], b[3], build), b)


def xp_fill():
    b = ART['xp_fill']

    def build(w, h):
        lib.slab('bar', lib.rounded_rect_pts(w - 0.02, h - 0.02, (h - 0.02) / 2), 0.1, 0.03, kit.candy('xp', '#8fe8ff', '#1a8cff', h), seg=4)

    out('xp_fill', P.render_piece('xp_fill', b[2], b[3], build, outline=0), b)


def pass_fill():
    b = ART['pass_fill']

    def build(w, h):
        lib.slab('bar', lib.rounded_rect_pts(w - 0.02, h - 0.02, (h - 0.02) / 2), 0.1, 0.03, kit.candy('pf', '#ffe36b', '#ff8a00', h), seg=4)

    out('pass_fill', P.render_piece('pass_fill', b[2], b[3], build, outline=0), b)


def mail():
    b = ART['mail']
    out('mail', P.render_piece('mail', b[2], b[3], lambda w, h: kit.place(kit.icon_mail(), 0, 0, 0.2, 0.66)), b)


def gear():
    b = ART['gear']

    def build(w, h):
        kit.candy_button(w - 0.04, h - 0.04, 'navy', r=0.16, depth=0.2)
        kit.place(kit.icon_gear(), 0, 0.01, 0.35, 0.42)

    out('gear', P.render_piece('gear', b[2], b[3], build), b)


def badges():
    for k in ('b_fighters', 'b_events', 'b_pass', 'b_nav_events', 'b_mail'):
        if not want(k):
            continue
        b = ART[k]
        out(k, P.render_piece(k, b[2], b[3], lambda w, h: kit.badge(min(w, h) / 2 - 0.04), outline=2), b)


def tile(name):
    b = ART[name]
    color, burst, icon = TILE[name]
    strip_top = LABEL_TOP[name] - b[1] - 10  # rel px
    fw = 0.1

    def build(w, h):
        outer = lib.rounded_rect_pts(w - 0.04, h - 0.04, 0.22)
        rim = kit.gold() if color == 'gold' else kit.candy('tr' + color, kit.CANDY[color][2], kit.CANDY[color][1], h)
        lib.frame('rim', outer, fw, 0.3, rim, bevel=0.045)
        # dark label strip across the bottom, with its icon
        sy0 = h / 2 - strip_top / 100
        sh = sy0 - (-h / 2 + 0.02 + fw * 0.8)
        strip = lib.rounded_rect_pts(w - 0.04 - 2 * fw * 0.8, sh, 0.12)
        lib.slab('strip', [(x, y + sy0 - sh / 2) for x, y in strip], 0.22, 0.03, kit.candy('strip', '#1e2560', '#090c2a', sh, rough=0.4, coat=0.5), seg=3)
        lib.frame('line', [(x, y + sy0 - sh / 2) for x, y in strip], 0.022, 0.25, kit.gold(), bevel=0.008, seg=2)
        ix = -w / 2 + 0.5
        kit.place(kit.ICONS[icon](), ix, sy0 - sh / 2 + 0.02, 0.42, min(0.5, sh * 0.95) * (0.78 if icon == 'crown' else 1.0))
        if name == 'pass':
            # progress trough + tier shield
            tr = lib.rounded_rect_pts(1.6, 0.22, 0.11)
            cx, cy = at(b, 98, 160)
            lib.frame('trf', [(x + cx, y + cy) for x, y in tr], 0.03, 0.28, kit.gold(), bevel=0.01)
            lib.slab('tr', [(x + cx, y + cy) for x, y in lib.inset(tr, 0.025)], 0.24, 0.015, kit.flat('#06081a', 0.5))
            sx, sy = at(b, 241, 160)
            shield = [(-0.22, 0.24), (0.22, 0.24), (0.22, 0.0), (0.0, -0.26), (-0.22, 0.0)]
            lib.slab('shield', lib.round_corners([(x + sx, y + sy) for x, y in shield], 0.04, 3), 0.12, 0.03, kit.candy('sh', '#ffe36b', '#e08a00', 0.5), z0=0.24)
        # thin dark lip around the art window (the art sits inside)
        win = window_pts(w, h, sy0)
        lib.frame('lip', win, 0.03, 0.26, kit.flat('#120b18', 0.5), bevel=0.01, seg=2)

    def window_pts(w, h, sy0):
        top = h / 2 - 0.02 - fw * 0.85
        bot = sy0
        ww = w - 0.04 - 2 * fw * 0.85
        pts = lib.rounded_rect_pts(ww, top - bot, 0.14)
        return [(x, y + (top + bot) / 2) for x, y in pts]

    frame = P.render_piece(f'tile_{name}', b[2], b[3], build)
    S = 2
    W, H = b[2] * S, b[3] * S
    top_px = (0.02 + fw * 0.85) * 100 * S
    side_px = (0.02 + fw * 0.85) * 100 * S
    bot_px = strip_top * S
    mask = P.rounded_mask((W, H), (side_px, top_px, W - side_px, bot_px + 6), 14 * S)
    bg = Image.open(tx.burst(os.path.join(tx.TEX, f'burst_{name}.png'), tuple(int(burst[0][i:i + 2], 16) for i in (1, 3, 5)), tuple(int(burst[1][i:i + 2], 16) for i in (1, 3, 5)), W, int(bot_px + 10))).convert('RGBA')
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    layer.alpha_composite(bg, (0, 0))
    art = tile_art(name, int(W - 2 * side_px), int(bot_px - top_px + 6))
    layer.alpha_composite(art, (int(side_px), int(top_px)))
    clipped = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    clipped.paste(layer, (0, 0), mask)
    clipped.alpha_composite(P.inner_shadow(mask, 10, 170))
    clipped.alpha_composite(frame)
    out(name, clipped, b)


def tile_art(name, w, h):
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    if name == 'fighters':
        for i, (fid, dx, s) in enumerate((('manuellsen', 0.72, 0.9), ('bonez', 0.28, 0.92), ('jazeek', 0.5, 1.0))):
            p = os.path.join(PORT, f'{fid}_bust.png')
            if not os.path.exists(p):
                continue
            bust = P.fit_image(Image.open(p), int(h * 1.05 * s), int(h * 1.05 * s), 'contain', (0.5, 1.0))
            bust = P.drop_shadow(bust, 0, 6, 8, 0.6)
            img.alpha_composite(bust, (int(w * dx - bust.width / 2), h - bust.height + 4))
    elif name == 'decks':
        card = card_frame()
        for i, (fid, cid, rot, dx) in enumerate((('manuellsen', 'manu_sofa', -16, 0.74), ('bonez', 'bon_team', 16, 0.26), ('jazeek', 'jaz_99', 0, 0.5))):
            p = os.path.join(PORT, f'{fid}_art-{cid}.png')
            ch = int(h * 0.82)
            cw = int(ch * 0.72)
            c = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
            if os.path.exists(p):
                a = P.fit_image(Image.open(p), cw, ch, 'cover', (0.5, 0.3))
                c.paste(a, (0, 0), P.rounded_mask((cw, ch), (4, 4, cw - 4, ch - 4), 14))
            c.alpha_composite(card.resize((cw, ch), Image.LANCZOS))
            c = c.rotate(rot, Image.BICUBIC, expand=True)
            c = P.drop_shadow(c, 0, 6, 8, 0.6)
            img.alpha_composite(c, (int(w * dx - c.width / 2), int(h - c.height + 6 - (0 if i == 2 else -8))))
    else:
        art = os.path.join(P.TMP, f'art_{name}.png')
        if os.path.exists(art):
            a = P.fit_image(Image.open(art), w, h, 'contain', (0.5, 0.75))
            img.alpha_composite(P.drop_shadow(a, 0, 6, 8, 0.6))
    return img


_card = None


def card_frame():
    global _card
    if _card is None:
        p = os.path.join(P.TMP, 'cardframe.png')
        if not os.path.exists(p) or want('cardframe'):
            def build(w, h):
                pts = lib.rounded_rect_pts(w - 0.04, h - 0.04, 0.14)
                lib.frame('cf', pts, 0.09, 0.14, kit.gold(), bevel=0.04)
            P.render_piece('cardframe', 180, 250, build, outline=2)
        _card = Image.open(p).convert('RGBA')
    return _card


def art_pieces():
    defs = {
        'shop': lambda: (kit.place(kit.icon_chest(), 0.1, -0.05, 0, 1.55), kit.place(kit.icon_coin(), -0.85, -0.35, 0.3, 0.55), kit.place(kit.icon_gem(), 0.95, -0.38, 0.4, 0.5)),
        'events': lambda: (kit.place(kit.icon_crown(), -0.35, 0.05, 0, 1.25), kit.place(kit.icon_mic(), 0.6, -0.05, 0.4, 1.2)),
        'pass': lambda: (kit.place(kit.icon_ticket(), 0.0, 0.0, 0, 1.6),),
        'missions': lambda: (kit.place(kit.icon_clipboard(), -0.2, -0.04, 0, 1.0), kit.place(kit.icon_crown(), 0.55, 0.2, 0.3, 0.55)),
    }
    for k, fn in defs.items():
        if want(f'art_{k}') or want(k):
            P.render_piece(f'art_{k}', 260, 120, lambda w, h, fn=fn: fn(), outline=3)


def fight():
    b = ART['fight']

    def build(w, h):
        bw, bh = 4.86, 1.5
        root = lib.bpy.data.objects.new('btn', None)
        lib.link(root)
        before = set(lib.bpy.data.objects)
        kit.candy_button(bw, bh, 'gold', r=0.4, depth=0.34)
        for o in set(lib.bpy.data.objects) - before:
            if o.parent is None:
                o.parent = root
        root.location = (0, 0.02, 0)
        for sx in (-1, 1):
            kit.chain(f'ch{sx}', kit.hang((sx * (bw / 2 - 0.02), 0.32, 0.18), (sx * (w / 2 - 0.12), -h / 2 + 0.16, 0.18), 0.15), 0.34, 0.048)
        gx, gy = at(b, 137, 96)
        kit.place(kit.icon_glove(), gx, gy, 0.55, 1.25)

    im = P.render_piece('fight', b[2], b[3], build)
    out('fight', im, b)
    m = im.getchannel('A')
    mask = Image.new('RGBA', im.size, (255, 255, 255, 0))
    mask.putalpha(m)
    P.save_webp(mask, os.path.join(OUT, 'fight_mask.webp'), b[2], b[3])


def nav():
    b = ART['nav']

    def build(w, h):
        kit.panel(w + 0.8, h + 0.6, r=0.34, face=('#232c78', '#0a0d30'), rim='gold', rim_w=0.1, rivet=False)
        for o in lib.bpy.data.objects:
            if o.parent is None and o.type == 'MESH':
                o.location.y -= 0.3
        tx0 = {'home': (40, 246), 'fighters': (250, 410), 'decks': (414, 560), 'events': (1100, 1252), 'shop': (1254, 1414), 'social': (1416, 1600)}
        ic = {'home': 'home', 'fighters': 'glove', 'decks': 'cards', 'events': 'trophy', 'shop': 'bag', 'social': 'people'}
        x0, x1 = tx0['home']
        hx, hy = at(b, (x0 + x1) / 2, 69)
        before = set(lib.bpy.data.objects)
        kit.candy_button((x1 - x0) / 100 - 0.06, 1.04, 'blue', r=0.22, depth=0.22)
        for o in set(lib.bpy.data.objects) - before:
            if o.parent is None:
                o.location.x += hx
                o.location.y += hy
                o.location.z += 0.2
        for k, (a, c) in tx0.items():
            cx, cy = at(b, (a + c) / 2, 46)
            kit.place(kit.ICONS[ic[k]](), cx, cy, 0.62, 0.62 if k != 'home' else 0.66)
        for xr in (248, 412, 1253, 1415):
            dx, dy = at(b, xr, 70)
            lib.slab('div', lib.rounded_rect_pts(0.05, 0.86, 0.025), 0.06, 0.01, kit.gold(), z0=0.2).location = (dx, dy, 0)

    out('nav', P.render_piece('nav', b[2], b[3], build, outline=0), b)


def pills():
    """Currency pills for the plate (no sprites in v2: hit areas over the painting)."""
    res = {}
    for k, box, icon in (('coins', [980, 12, 180, 52], 'coin'), ('gems', [1166, 12, 176, 52], 'gem'), ('energy', [1348, 12, 170, 52], 'bolt')):
        def build(w, h, icon=icon):
            body = lib.rounded_rect_pts(w - 0.3, 0.42, 0.2, seg=14)
            lib.frame('rim', [(x + 0.13, y) for x, y in body], 0.04, 0.14, kit.gold(), bevel=0.016)
            lib.slab('face', [(x + 0.13, y) for x, y in lib.inset(body, 0.03)], 0.1, 0.03, kit.candy('pillf', '#262a5a', '#0b0d26', 0.42, rough=0.3, coat=0.7), seg=4)
            kit.place(kit.ICONS[icon](), -w / 2 + 0.28, 0, 0.3, 0.58 if icon != 'gem' else 0.62)
            kit.place(kit.icon_plus(), w / 2 - 0.22, 0, 0.3, 0.42)
        res[k] = (P.render_piece(f'pill_{k}', box[2], box[3], build), box)
    return res


# ------------------------------------------------------------------ plate
def plate(pill_imgs):
    import compose
    print(compose.plate('home', [(im, box) for im, box in pill_imgs.values()], OUT, logo_box=[588, 0, 1014, 268]))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if want('profile'):
        profile()
    if want('xp_fill'):
        xp_fill()
    if want('pass_fill'):
        pass_fill()
    if want('mail'):
        mail()
    if want('gear'):
        gear()
    badges()
    art_pieces()
    for k in TILE:
        if want(k):
            tile(k)
    if want('fight'):
        fight()
    if want('nav'):
        nav()
    if want('plate'):
        plate(pills())
