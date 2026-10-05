"""Contact sheet of extracted sprites on magenta (alpha check): python3 tools/ui-extract/sheet.py src/ui/img/menu out.png"""
import glob
import os
import sys

from PIL import Image

src, out = sys.argv[1], sys.argv[2]
files = sorted(f for f in glob.glob(os.path.join(src, '*.webp')) if not f.endswith('bg.webp'))
W = 1100
x = y = rowh = 0
pos = []
for f in files:
    im = Image.open(f).convert('RGBA')
    s = min(1, 520 / im.width)
    im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))))
    if x + im.width > W:
        x, y, rowh = 0, y + rowh + 10, 0
    pos.append((im, x, y))
    x += im.width + 10
    rowh = max(rowh, im.height)
sheet = Image.new('RGBA', (W, y + rowh), (255, 0, 255, 255))
for im, x, y in pos:
    sheet.alpha_composite(im, (x, y))
sheet.convert('RGB').save(out)
