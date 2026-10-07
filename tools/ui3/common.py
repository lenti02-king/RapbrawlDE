# Design v3 (S13b): pieces shared by several screens (currency pills, square icon buttons, big gold CTA with chains,
# bar fills, card frames), all built from kit.py and rendered with pieces.render_piece.
import lib
import kit
import pieces as P


def rel(box, x, y):
    """Layout px -> metres relative to the centre of `box` (y up)."""
    return (x - box[0] - box[2] / 2) / 100, (box[1] + box[3] / 2 - y) / 100


def moved(fn, dx, dy, dz=0.0):
    """Run a builder and shift everything it created (top-level objects) by (dx, dy, dz)."""
    before = set(lib.bpy.data.objects)
    fn()
    for o in set(lib.bpy.data.objects) - before:
        if o.parent is None:
            o.location.x += dx
            o.location.y += dy
            o.location.z += dz


def pill(name, box, icon):
    """Currency capsule: icon over the left end, amount area, green plus at the right end."""
    def build(w, h):
        body = lib.rounded_rect_pts(w - 0.3, min(0.42, h - 0.1), min(0.21, (h - 0.1) / 2), seg=14)
        lib.frame('rim', [(x + 0.13, y) for x, y in body], 0.04, 0.14, kit.gold(), bevel=0.016)
        lib.slab('face', [(x + 0.13, y) for x, y in lib.inset(body, 0.03)], 0.1, 0.03, kit.candy('pillf', '#262a5a', '#0b0d26', 0.42, rough=0.3, coat=0.7), seg=4)
        kit.place(kit.ICONS[icon](), -w / 2 + 0.28, 0, 0.3, 0.58 if icon != 'gem' else 0.62)
        kit.place(kit.icon_plus(), w / 2 - 0.22, 0, 0.3, min(0.42, h - 0.1))
    return P.render_piece(name, box[2], box[3], build)


def icon_button(name, box, icon, color='navy', size=0.62):
    def build(w, h):
        kit.candy_button(w - 0.04, h - 0.04, color, r=min(0.16, h * 0.3), depth=0.2)
        kit.place(kit.ICONS[icon](), 0, 0.01, 0.35, min(w, h) * size)
    return P.render_piece(name, box[2], box[3], build)


def icon_only(name, box, icon, size=0.9):
    return P.render_piece(name, box[2], box[3], lambda w, h: kit.place(kit.ICONS[icon](), 0, 0, 0.2, min(w, h) * size))


def cta(name, box, icon='crown', icon_at=None, plate_inset=(0.45, 0.12)):
    """The big gold call-to-action with chains to both sides (KÄMPFEN / BEREIT / AUSWÄHLEN / SPEICHERN)."""
    def build(w, h):
        bw, bh = w - 2 * plate_inset[0], h - 2 * plate_inset[1]
        kit.candy_button(bw, bh, 'gold', r=min(0.4, bh * 0.3), depth=0.34)
        for sx in (-1, 1):
            kit.chain(f'ch{sx}', kit.hang((sx * (bw / 2 - 0.02), bh * 0.22, 0.18), (sx * (w / 2 - 0.08), -h / 2 + 0.14, 0.18), 0.12), 0.32, 0.045)
        if icon:
            ix, iy = icon_at if icon_at else (-bw / 2 + bh * 0.55, 0.0)
            kit.place(kit.ICONS[icon](), ix, iy, 0.5, bh * 0.82)
    im = P.render_piece(name, box[2], box[3], build)
    return im


def fill(name, box, top, bot, glow=0.0):
    def build(w, h):
        lib.slab('bar', lib.rounded_rect_pts(w - 0.02, h - 0.03, (h - 0.03) / 2), 0.1, min(0.04, h * 0.2), kit.candy('f' + top, top, bot, h, emission=glow), seg=4)
    return P.render_piece(name, box[2], box[3], build, outline=0)


def trough(cx, cy, w, h, depth=0.24):
    tr = lib.rounded_rect_pts(w, h, h / 2 - 0.001)
    lib.frame('trf', [(x + cx, y + cy) for x, y in tr], 0.03, depth, kit.gold(), bevel=0.01)
    lib.slab('tr', [(x + cx, y + cy) for x, y in lib.inset(tr, 0.025)], depth - 0.04, 0.015, kit.flat('#05071a', 0.5))


def card_slot(cx, cy, w, h, gold=False, strip=0.0, z=0.0):
    """Frame around a picture window (transparent), optional dark name strip under it."""
    pts = lib.rounded_rect_pts(w, h, 0.12)
    lib.frame('cf', [(x + cx, y + cy) for x, y in pts], 0.08 if gold else 0.065, 0.3 + z, kit.gold() if gold else kit.steel('#c9d2e6', 0.25), bevel=0.03)
    if strip:
        st = lib.rounded_rect_pts(w, strip, 0.1)
        lib.slab('ns', [(x + cx, y + cy - h / 2 - strip / 2 + 0.02) for x, y in st], 0.2 + z, 0.03, kit.candy('ns', '#141a44', '#070a22', strip, rough=0.4, coat=0.4), seg=3)
