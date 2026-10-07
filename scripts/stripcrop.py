# Crop + tile the per-frame images of an animprobe strip: python3 scripts/stripcrop.py dir shotFrame out.jpg [x0 y0 x1 y1] [cols]
import sys, glob
from PIL import Image
d, s0, out = sys.argv[1], sys.argv[2], sys.argv[3]
box = tuple(int(v) for v in sys.argv[4:8]) if len(sys.argv) >= 8 else (180, 90, 780, 520)
cols = int(sys.argv[8]) if len(sys.argv) >= 9 else 7
fs = sorted(glob.glob(f'{d}/s{s0}_*.png'))
import os
sc = float(os.environ.get('SCALE', '1'))
ims = [Image.open(f).convert('RGB').crop(box) for f in fs]
if sc != 1: ims = [im.resize((int(im.width * sc), int(im.height * sc))) for im in ims]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows), (0, 0, 0))
from PIL import ImageDraw
for i, im in enumerate(ims):
    ImageDraw.Draw(im).text((6, 4), fs[i].split('_')[-1][:-4], fill=(255, 255, 0))
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out, quality=82)
print(out, len(ims))
