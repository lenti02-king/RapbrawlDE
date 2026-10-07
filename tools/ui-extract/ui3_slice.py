# Design v3 (S13): slice a rendered arena plate (2472x941 reference px at any scale) like the v2 plates: l / c / r around
# the 1672x941 layout (x -400..4, -4..1676, 1668..2072), plus the half-size depth map and its x range.
# Usage: python3 tools/ui-extract/ui3_slice.py color.png depth.png out_dir
import json
import os
import sys

from PIL import Image

color_p, depth_p, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
img = Image.open(color_p).convert('RGB').resize((2472, 941), Image.LANCZOS)
for k, (x0, x1) in {'l': (0, 404), 'c': (396, 2076), 'r': (2068, 2472)}.items():
    img.crop((x0, 0, x1, 941)).save(f'{out}/plate_{k}.webp', quality=90, method=6)
dep = Image.open(depth_p).convert('L').resize((1236, 470), Image.LANCZOS)
dep.save(f'{out}/depth.webp', quality=92)
with open(f'{out}/depth.json', 'w') as f:
    json.dump({'x0': -400, 'x1': 2072}, f)
img.resize((1236, 470), Image.LANCZOS).save(os.environ.get('PREVIEW', '/tmp/ui3_preview.jpg'), quality=85)
