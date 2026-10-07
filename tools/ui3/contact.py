# contact sheet of rendered pieces over a dark violet ground: python3 tools/ui3/contact.py out.jpg a.png b.png ...
import sys
from PIL import Image
out, *paths = sys.argv[1:]
ims = [Image.open(p).convert('RGBA') for p in paths]
pad = 16
rows, row, w = [], [], 0
for im in ims:
    if row and w + im.width > 2400:
        rows.append(row); row, w = [], 0
    row.append(im); w += im.width + pad
rows.append(row)
W = max(sum(i.width + pad for i in r) for r in rows) + pad
H = sum(max(i.height for i in r) + pad for r in rows) + pad
bg = Image.new('RGBA', (W, H), (34, 24, 64, 255))
y = pad
for r in rows:
    x = pad
    for im in r:
        bg.alpha_composite(im, (x, y)); x += im.width + pad
    y += max(i.height for i in r) + pad
bg.convert('RGB').save(out, quality=88)
print(out, bg.size)
