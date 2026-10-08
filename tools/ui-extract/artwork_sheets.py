"""Artwork slots for the PO (S15): the game's v4 screens with every place the PO's artwork goes marked, numbered and
listed with file path and size (design/v4/artwork/*.jpg, explained in design/v4/README.md).

  python3 tools/ui-extract/artwork_sheets.py <capture dir>   # needs home/select/fighters/custom-1672x941.png and
                                                             # art/deck.png + art/deck.json (card boxes) in that dir

Sizes are the slot's reference px (the 1672x941 grid) x2 or x3 rounded: sharp on retina phones and in close-ups."""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'design', 'v4', 'artwork')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_R = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
COLORS = [(255, 70, 90), (60, 170, 255), (255, 200, 40), (120, 255, 140), (220, 110, 255), (255, 140, 40)]


def font(size, bold=True):
    return ImageFont.truetype(FONT if bold else FONT_R, size)


def sheet(shot, title, slots, notes, name):
    """slots: (number, [x0, y0, x1, y1] or list of boxes, colour index, label, file, size)"""
    im = Image.open(shot).convert('RGB').resize((1672, 941))
    over = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    # dim everything a little so the marks read
    d.rectangle([0, 0, 1672, 941], fill=(0, 0, 0, 70))
    for n, boxes, ci, *_ in slots:
        c = COLORS[ci % len(COLORS)]
        for b in boxes if isinstance(boxes[0], (list, tuple)) else [boxes]:
            d.rectangle(b, fill=c + (60,), outline=c + (255,), width=4)
            r = 22
            cx, cy = b[0] + r + 4, b[1] + r + 4
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c + (255,), outline=(0, 0, 0, 255), width=3)
            f = font(26)
            tw = d.textlength(str(n), font=f)
            d.text((cx - tw / 2, cy - 16), str(n), fill=(0, 0, 0, 255), font=f)
    im = Image.alpha_composite(im.convert('RGBA'), over).convert('RGB')
    # legend under the screen
    lines = []
    for n, _, ci, label, file, size in slots:
        lines.append((n, ci, label, file, size))
    lh = 64
    H = 941 + 90 + lh * len(lines) + 40 * len(notes) + 40
    out = Image.new('RGB', (1672, H), (14, 16, 30))
    out.paste(im, (0, 90))
    d = ImageDraw.Draw(out)
    d.text((30, 22), title, fill=(255, 210, 87), font=font(40))
    y = 941 + 90 + 20
    for n, ci, label, file, size in lines:
        c = COLORS[ci % len(COLORS)]
        d.ellipse([30, y, 74, y + 44], fill=c, outline=(0, 0, 0), width=3)
        tw = d.textlength(str(n), font=font(24))
        d.text((52 - tw / 2, y + 7), str(n), fill=(0, 0, 0), font=font(24))
        d.text((92, y - 2), label, fill=(255, 255, 255), font=font(26))
        d.text((92, y + 30), f'{file}   ·   {size}', fill=(170, 200, 255), font=font(21, False))
        y += lh
    for nt in notes:
        d.text((30, y + 6), nt, fill=(200, 200, 210), font=font(21, False))
        y += 40
    os.makedirs(OUT, exist_ok=True)
    out.save(os.path.join(OUT, name), quality=86)
    print('->', os.path.join(OUT, name))


def main(cap):
    P = lambda f: os.path.join(cap, f)  # noqa: E731
    A = 'public/assets/ui4/art/'
    # 1 main menu: the six tiles (whole tile incl. lettering) + the avatar window
    tiles = [('KÄMPFER', [58, 277, 444, 461], 'kaempfer', '772 x 368'), ('DECK', [43, 444, 438, 593], 'deck', '790 x 298'),
             ('SHOP', [34, 583, 433, 726], 'shop', '798 x 286'), ('EVENTS', [1227, 279, 1620, 447], 'events', '786 x 336'),
             ('BATTLE PASS', [1233, 439, 1634, 594], 'battlepass', '802 x 310'), ('ANPASSEN', [1239, 577, 1643, 727], 'anpassen', '808 x 300')]
    slots = [(i + 1, b, i, f'Kachel {n} (ganze Kachel mit Rahmen + Schrift, transparenter Rand)', f'{A}home/{f}.webp', f'{s} px')
             for i, (n, b, f, s) in enumerate(tiles)]
    slots.append((7, [92, 18, 172, 94], 6, 'Avatar-Fenster (zeigt den Auswahlkasten des Lieblingskämpfers, siehe Kämpferauswahl Nr. 3)',
                  f'{A}select/<kämpfer>.webp', 'wie Nr. 3'))
    sheet(P('home-1672x941.png'), '1  HAUPTMENÜ – Artwork-Plätze', slots,
          ['Der Kämpfer auf dem Podest ist das 3D-Modell (kein Bild nötig). Hintergrund, Logo, Leisten bleiben wie in deinem Master.'],
          '01_hauptmenue.jpg')
    # 2 character select: banners + roster boxes
    grid = [[578, 443, 682, 529], [688, 443, 781, 529], [788, 443, 882, 529], [891, 443, 985, 529], [992, 443, 1089, 529],
            [578, 531, 682, 613], [688, 531, 781, 613], [891, 531, 985, 613], [992, 531, 1089, 613],
            [578, 615, 682, 697], [688, 615, 781, 697], [788, 615, 882, 697], [891, 615, 985, 697], [992, 615, 1089, 697]]
    sheet(P('select-1672x941.png'), '2  KÄMPFERAUSWAHL – Banner und Auswahlkästen', [
        (1, [72, 186, 398, 664], 0, 'Banner Spieler 1 (rot, hinter dem Kämpfer)', f'{A}banner_p1.webp', '652 x 956 px'),
        (2, [1286, 186, 1604, 656], 1, 'Banner Spieler 2 (blau, hinter dem Kämpfer)', f'{A}banner_p2.webp', '652 x 956 px'),
        (3, grid, 2, 'Auswahlkästen mit Gesicht (ein Bild pro Kämpfer, wird achteckig beschnitten, Gesicht mittig)',
         f'{A}select/<kämpfer>.webp  (jazeek, bonez, manuellsen, lacazette)', '270 x 216 px'),
    ], ['Die Mitte (RB-Emblem) ist "Zufällig" und bleibt. Freie Kästen sind Platz für neue Kämpfer.',
        'Name und Heimatstadt setzt das Spiel selbst unter die Namensschilder.'], '02_kaempferauswahl.jpg')
    # 3 KÄMPFER cards
    x0 = (1672 - (4 * 292 + 3 * 36)) / 2
    cards = [[x0 + i * 328 + 10, 372, x0 + i * 328 + 282, 706] for i in range(4)]
    sheet(P('fighters-1672x941.png'), '3  KÄMPFER – Kämpferkarten', [
        (1, cards, 4, 'Kartenbild pro Kämpfer (Hochformat 4:5, ohne Namen – Name + Heimatstadt setzt das Spiel darunter)',
         f'{A}fighters/<kämpfer>.webp', '816 x 1002 px'),
    ], ['Bis dein Artwork da ist, zeigt die Karte ein Render des 3D-Modells.'], '03_kaempfer_karten.jpg')
    # 4 customise: skin tiles
    # CUSTOM_ART s1..s6 (src/ui/v4/art/custom.ts); the picture window as in src/ui/v4/custom.ts
    sk = []
    for x, y, w, h in ([881, 351, 233, 179], [1115, 346, 241, 188], [1359, 348, 246, 186], [880, 533, 233, 188], [1115, 533, 242, 188], [1359, 533, 245, 188]):
        sk.append([x + 14, y + 14, x + w - 14, y + 14 + round(h * 0.62)])
    sheet(P('custom-1672x941.png'), '4  ANPASSEN – Skins (Items)', [
        (1, sk, 3, 'Skin-Bild pro Kämpfer und Feld 1–6 (STANDARD, STREET, CHAMPION, NACHT, GOLD, EXKLUSIV)',
         f'{A}skins/<kämpfer>_<1-6>.webp', '616 x 333 px'),
    ], ['WALK-IN und EFFEKTE folgen später mit eigenen Feldern (gleiches Format).'], '04_anpassen_skins.jpg')
    # 5 deck / cards
    rects = json.load(open(P('art/deck.json')))
    big = [[r[0], r[1], r[0] + r[2], r[1] + r[3]] for r in rects if r[4] == 'big']
    coll = [[r[0], r[1], r[0] + r[2], r[1] + r[3]] for r in rects if r[4] != 'big']
    sheet(P('art/deck.png'), '5  KARTEN / DECK – Kartenbilder', [
        (1, big, 5, 'Kartenbild (Hochformat 3:4) – dasselbe Bild für Deck, Sammlung und die Karten im Kampf',
         'public/assets/cards/<karten-id>.webp', '768 x 1024 px'),
        (2, coll, 5, 'Sammlung: dieselben Bilder klein', 'public/assets/cards/<karten-id>.webp', '(wie Nr. 1)'),
    ], ['Karten-IDs: siehe design/v4/README.md (pro Kämpfer 6–7 Karten).', 'Kosten, Name und Signature-Krone setzt das Spiel darüber.'],
          '05_karten_deck.jpg')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/s15')
