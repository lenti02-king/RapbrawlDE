"""Design v4 (D47): the PO's five masters as layered, Figma-importable SVG files (design/v4/<screen>.svg).

Figma turns every element of an imported SVG into a layer: <g id> = a named group/frame, <image> = an image layer
(PNG / JPEG embedded), <text> = an editable text layer. Per screen:
  Referenz (Original-Master)   the PO's master, opacity 0 (switch it on to compare)
  Hintergrund                  the plate with ALL UI removed (LaMa) - the scene alone
  UI-Elemente                  every button / panel / tile / capsule cut from the master, at its exact position
  Zustände                     selection frames, lit cells, cursors (the game moves them)
  Texte (live)                 the texts the game writes (amounts, names, room code ...), as text layers
Nothing is drawn new. Run after v4_screens.py: python3 tools/ui-extract/v4_figma.py [screen ...]
"""
import base64
import io
import json
import os
import re
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402
import v4x  # noqa: E402,F401  (sets the v4 paths in v2x)
import v2x  # noqa: E402

ROOT = uix.ROOT
OUT = os.path.join(ROOT, 'design', 'v4')
PUB = os.path.join(ROOT, 'public', 'assets', 'ui4')
W, H = 1672, 941

# pieces that show a state (moved / toggled by the game) - their own group, hidden by default where the master has
# the piece already painted in
STATE = {'ring_sel', 'ring_gold', 'on_label', 'off_label', 'cur_p1', 'cur_p2', 'seg_on', 'xp_fill', 'btn_blue', 'btn_gold', 'tag_p1', 'tag_p2'}
NAMES = {
    'profile': 'Profil', 'plus1': 'Plus Münzen', 'plus2': 'Plus Diamanten', 'mail': 'Postfach', 'friends': 'Freunde-Button',
    'back': 'Zurück', 'gear': 'Einstellungen', 'fighters': 'Kachel KÄMPFER', 'deck': 'Kachel DECK', 'shop': 'Kachel SHOP',
    'events': 'Kachel EVENTS', 'pass': 'Kachel BATTLE PASS', 'missions': 'Kachel MISSIONEN', 'n_home': 'Nav HOME',
    'n_ranked': 'Nav RANKED', 'n_social': 'Nav FREUNDE', 'n_gear': 'Nav Einstellungen', 'fight': 'Button FIGHT',
    't_1v1': 'Modus 1 VS 1', 't_2v2': 'Modus 2 VS 2', 't_friends': 'Modus MIT FREUNDEN', 't_training': 'Modus TRAINING',
    'online': 'Schalter ONLINE', 'offline': 'Schalter OFFLINE', 'weiter': 'Button WEITER', 'equip': 'Button AUSRÜSTEN',
    'tab_skins': 'Tab SKINS', 'tab_walk': 'Tab WALK-IN', 'tab_fx': 'Tab EFFEKTE', 'rot_l': 'Drehen links', 'rot_r': 'Drehen rechts',
    's1': 'Skin STANDARD', 's2': 'Skin STREET', 's3': 'Skin CHAMPION', 's4': 'Skin NACHT', 's5': 'Skin GOLD', 's6': 'Skin EXKLUSIV',
    'copy': 'Code kopieren', 'slot1': 'Lobby-Platz 1', 'slot2': 'Lobby-Platz 2', 'slot3': 'Lobby-Platz 3', 'b_1v1': 'Lobby 1 VS 1',
    'b_2v2': 'Lobby 2 VS 2', 'create': 'Button LOBBY ERSTELLEN', 'inv1': 'Einladen 1', 'inv2': 'Einladen 2', 'inv3': 'Einladen 3',
    'inv4': 'Einladen 4', 'ring_sel': 'Auswahlrahmen (blau)', 'ring_gold': 'Rahmen (gold)', 'on_label': 'Label ONLINE',
    'off_label': 'Label OFFLINE', 'cur_p1': 'Cursor P1 (rot)', 'cur_p2': 'Cursor P2 (blau)', 'seg_on': 'Stat-Zelle (an)',
    'xp_fill': 'XP-Balken', 'btn_blue': 'Button blau (leer)', 'btn_gold': 'Button gold (leer)',
}
# big panels and scene pieces that stay painted into the game's plate but are layers of their own in the design file
# (the PO's artwork for banners / boxes replaces them later): name -> GrabCut box (convex hull)
PANELS = {
    'home': {'Nav-Leiste': (100, 826, 1572, 930), 'FIGHT-Rahmen mit Ketten': (540, 762, 1124, 918), 'Profil-Rahmen': (74, 2, 442, 112)},
    'modes': {'WEITER-Rahmen mit Ketten': (560, 782, 1108, 916), 'ONLINE/OFFLINE-Leiste': (572, 700, 1100, 788)},
    'select': {'Banner rot (P1)': (72, 186, 398, 664), 'Banner blau (P2)': (1286, 186, 1604, 656), 'Titel KÄMPFERAUSWAHL': (566, 372, 1106, 442),
               'Auswahl-Raster': (566, 436, 1104, 708), 'Namensschild P1': (112, 828, 562, 906), 'Namensschild P2': (1100, 828, 1556, 906),
               'WEITER-Rahmen mit Ketten': (582, 788, 1100, 916), 'Podest P1': (40, 660, 560, 790), 'Podest P2': (1104, 656, 1630, 790)},
    'custom': {'Skin-Panel': (852, 236, 1642, 742), 'Stats-Leiste': (36, 796, 872, 898), 'Drehen-Leiste': (310, 712, 642, 796),
               'Namensschild': (120, 22, 476, 98), 'AUSRÜSTEN-Rahmen mit Ketten': (1074, 752, 1622, 912)},
    'lobby': {'Freunde-Panel': (34, 224, 614, 762), 'Lobby-Panel': (1082, 226, 1632, 802), 'LOBBY ERSTELLEN-Rahmen mit Ketten': (546, 786, 1118, 916)},
}
# panel layers that the screens without a master reuse (public/assets/ui4/kit/<name>.webp)
KIT = {'custom': {'Namensschild': 'title'}, 'select': {'Namensschild P1': 'plate_p1', 'Namensschild P2': 'plate_p2'}}
SAMPLE = {'amount': {'coins': '125,430', 'gems': '3,260', 'trophies': '1,420'}, 'name': 'BeatKing', 'level': '32', 'xp': '2,480 / 3,500',
          'code': 'RB-2048', 'label': 'EINLADEN', 'status': 'Online'}


def table(screen):
    ts = open(os.path.join(ROOT, 'src', 'ui', 'v4', 'art', f'{screen}.ts')).read()
    name = screen.upper()

    def obj(key):
        m = re.search(rf'export const {name}_{key} = (\{{.*?\n\}}|\{{.*?\}}) as const;', ts, re.S)
        return json.loads(re.sub(r',(\s*\})', r'\1', m.group(1))) if m else {}
    return obj('ART'), obj('TEXT')


def b64(im: Image.Image, fmt='PNG', q=90) -> str:
    buf = io.BytesIO()
    if fmt == 'JPEG':
        im.convert('RGB').save(buf, 'JPEG', quality=q)
    else:
        im.save(buf, 'PNG', optimize=True)
    return f'data:image/{fmt.lower()};base64,' + base64.b64encode(buf.getvalue()).decode()


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def kit_save(name, im, box):
    """A shared v4 piece -> public/assets/ui4/kit/<name>.webp + its master box in kit.json."""
    d = os.path.join(PUB, 'kit')
    os.makedirs(d, exist_ok=True)
    im.save(os.path.join(d, f'{name}.webp'), 'WEBP', quality=92)
    p = os.path.join(d, 'kit.json')
    boxes = json.load(open(p)) if os.path.exists(p) else {}
    boxes[name] = box
    json.dump(boxes, open(p, 'w'), indent=1, sort_keys=True)


def kit_sprites():
    """Sprites of the masters the other screens reuse as they are (back button, the blank gold / blue buttons)."""
    for name, (screen, sid) in {'back': ('select', 'back'), 'gold': ('lobby', 'btn_gold'), 'blue': ('lobby', 'btn_blue'), 'fill': ('home', 'xp_fill')}.items():
        art, _ = table(screen)
        kit_save(name, Image.open(os.path.join(PUB, screen, f'{sid}.webp')), art[sid])
    # the profile's XP track (empty: rebuilt by the run) as a bar track for progress (loading screen)
    bg = Image.open(os.path.join(ROOT, '.cache', 'ui4', 'home_bg.png')).convert('RGB')
    kit_save('track', bg.crop((214, 63, 419, 85)), [214, 63, 205, 22])


def clean_plate(screen, clean):
    """The scene without UI as a game plate of its own (<screen>_clean): the screens without a master stand in it
    (D47: nothing new, only the PO's scenes). Wings: the screen's outpainted wings, darkened like v2x."""
    side = v2x.SIDE
    wings = cv2.imread(os.path.join(ROOT, '.cache', 'ui4', f'{screen}_wings.png'))
    wide = wings.copy()
    wide[:, side:side + W] = clean
    t = np.linspace(0.0, 1.0, side, dtype=np.float32)
    k = (0.35 + 0.65 * t ** 0.8)[None, :, None]
    wide[:, :side] = (wide[:, :side].astype(np.float32) * k).astype(np.uint8)
    wide[:, side + W:] = (wide[:, side + W:].astype(np.float32) * k[:, ::-1]).astype(np.uint8)
    name = f'{screen}_clean'
    out_dir = os.path.join(PUB, name)
    os.makedirs(out_dir, exist_ok=True)
    tiles = v2x.split_plate(wide, out_dir, side, W)
    lt = v2x.lights(clean, y_max=780)
    v2x.write_ts(name, {}, {}, tiles, lt, {}, (W, H))


def build(screen):
    art, text = table(screen)
    master = Image.open(os.path.join(ROOT, 'tools', 'ui-extract', 'ref', 'v4', f'{screen}.png')).convert('RGB')
    bg = cv2.imread(os.path.join(ROOT, '.cache', 'ui4', f'{screen}_bg.png'))
    # background without UI: every sprite's alpha at its place, grown a little, filled by LaMa
    hole = np.zeros((H, W), np.uint8)
    sprites = {}
    for k, (x, y, w, h) in art.items():
        p = os.path.join(PUB, screen, f'{k}.webp')
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('RGBA')
        sprites[k] = (im, x, y)
        if k in STATE:
            continue
        a = np.asarray(im.split()[-1].resize((w, h)))
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(W, x + w), min(H, y + h)
        hole[y0:y1, x0:x1] |= (a[y0 - y:y1 - y, x0 - x:x1 - x] > 8).astype(np.uint8) * 255
    img = cv2.imread(os.path.join(ROOT, 'tools', 'ui-extract', 'ref', 'v4', f'{screen}.png'))
    panels = {}
    for pn, (x0, y0, x1, y1) in PANELS.get(screen, {}).items():
        inset = max(6, min(x1 - x0, y1 - y0) // 6)
        m = v2x.element_mask(img, dict(box=(x0, y0, x1, y1), core=[(x0 + inset, y0 + inset, x1 - inset, y1 - inset)], inset=2, pad=10, hull=True))
        a = cv2.GaussianBlur(m, (0, 0), 0.8)
        ys, xs = np.nonzero(a > 2)
        bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        rgba = np.dstack([cv2.cvtColor(bg[by0:by1, bx0:bx1], cv2.COLOR_BGR2RGB), a[by0:by1, bx0:bx1]])
        panels[pn] = (Image.fromarray(rgba, 'RGBA'), bx0, by0)
        hole |= (m > 0).astype(np.uint8) * 255
    for pn, out in KIT.get(screen, {}).items():  # shared v4 pieces for the screens without a master
        im, kx, ky = panels[pn]
        kit_save(out, im, [int(kx), int(ky), im.width, im.height])
    hole = uix.dilate(hole, 6)
    clean = uix.inpaint(bg, hole, max_side=1024, ctx=0.5)
    cv2.imwrite(os.path.join(ROOT, '.cache', 'ui4', f'{screen}_clean.png'), clean)
    clean_plate(screen, clean)
    clean_im = Image.fromarray(cv2.cvtColor(clean, cv2.COLOR_BGR2RGB))

    L = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         f'<g id="{esc(screen.upper())} – RAPBRAWL v4">',
         f'<image id="Referenz (Original-Master)" x="0" y="0" width="{W}" height="{H}" opacity="0" xlink:href="{b64(master, "JPEG", 88)}"/>',
         f'<image id="Hintergrund" x="0" y="0" width="{W}" height="{H}" xlink:href="{b64(clean_im, "JPEG", 90)}"/>',
         '<g id="Panels und Banner">']
    for pn, (im, x, y) in panels.items():
        L.append(f'<image id="{esc(pn)}" x="{x}" y="{y}" width="{im.width}" height="{im.height}" xlink:href="{b64(im)}"/>')
    L.append('</g><g id="UI-Elemente">')
    for k, (im, x, y) in sprites.items():
        if k in STATE:
            continue
        w, h = art[k][2], art[k][3]
        L.append(f'<image id="{esc(NAMES.get(k, k))}" x="{x}" y="{y}" width="{w}" height="{h}" xlink:href="{b64(im.resize((w, h), Image.LANCZOS))}"/>')
    L.append('</g><g id="Zustände">')
    for k, (im, x, y) in sprites.items():
        if k not in STATE:
            continue
        w, h = art[k][2], art[k][3]
        L.append(f'<image id="{esc(NAMES.get(k, k))}" x="{x}" y="{y}" width="{w}" height="{h}" opacity="0" xlink:href="{b64(im.resize((w, h), Image.LANCZOS))}"/>')
    L.append('</g><g id="Texte (live)">')
    for el, zones in text.items():
        for zn, z in zones.items():
            if zn in ('avatar', 'xpbar', 'bar', 'c'):
                continue
            x0, y0, x1, y1 = z
            h = y1 - y0
            s = SAMPLE.get(zn)
            if isinstance(s, dict):
                s = s.get(el, '0')
            s = s or zn.upper()
            fs = round(h * 0.86)
            L.append(f'<text id="{esc(el + " · " + zn)}" x="{x0}" y="{y1 - round(h * 0.16)}" font-family="Barlow Condensed" font-weight="700" font-size="{fs}" fill="#ffffff" stroke="#05070f" stroke-width="{max(1, round(fs * 0.08))}" paint-order="stroke">{esc(s)}</text>')
    L.append('</g></g></svg>')
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'{screen}.svg')
    with open(path, 'w') as f:
        f.write('\n'.join(L))
    # flattened preview of the layers (check that nothing is missing)
    prev = clean_im.convert('RGBA')
    for pn, (im, x, y) in panels.items():
        prev.alpha_composite(im, (x, y))
    for k, (im, x, y) in sprites.items():
        if k not in STATE:
            prev.alpha_composite(im.resize((art[k][2], art[k][3])), (max(0, x), max(0, y)))
    prev.convert('RGB').save(os.path.join(OUT, f'{screen}_preview.jpg'), quality=85)
    print(screen, f'{os.path.getsize(path) / 1e6:.1f} MB', len(sprites) + len(panels) + 2, 'image layers')


if __name__ == '__main__':
    for s in sys.argv[1:] or ['home', 'modes', 'select', 'custom', 'lobby']:
        build(s)
    kit_sprites()
