"""Depth maps for the design-v2 plates (D43 'living plates'): MiDaS DPT-Hybrid (MIT licence, weights from the MiDaS
GitHub release) estimates relative depth of each PO master plate; the menus use it for a slow 2.5D parallax of the
painting, depth fog and to tell the crowd/background from the stage. Output: public/assets/ui2/<screen>/depth.webp
(grayscale, 255 = near), covering the whole extended plate (wings included).

Setup (once): git clone --depth 1 https://github.com/isl-org/MiDaS .cache/depth/MiDaS; pip install timm==0.6.13;
curl -L -o .cache/depth/dpt_hybrid_384.pt https://github.com/isl-org/MiDaS/releases/download/v3/dpt_hybrid_384.pt
Usage: python3 tools/ui-extract/depth.py [screen ...]"""
import json
import os
import re
import sys

import numpy as np
import torch
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
D = os.path.join(ROOT, '.cache', 'depth')
sys.path.insert(0, os.path.join(D, 'MiDaS'))
from midas.dpt_depth import DPTDepthModel  # noqa: E402

SCREENS = sys.argv[1:] or ['home', 'select', 'arena', 'vs', 'loading', 'fighters', 'custom', 'lobby']
model = DPTDepthModel(path=os.path.join(D, 'dpt_hybrid_384.pt'), backbone='vitb_rn50_384', non_negative=True)
model.eval()
torch.set_num_threads(4)
MEAN, STD = np.array([0.5, 0.5, 0.5]), np.array([0.5, 0.5, 0.5])


def plate_of(screen):
    ts = open(os.path.join(ROOT, 'src', 'ui', 'v2', 'art', f'{screen}.ts')).read()
    m = re.search(r'_PLATE = (\{.*?\}) as const', ts)
    if not m:
        return None, None
    plate = json.loads(m.group(1))
    x0 = min(v[0] for v in plate.values())
    x1 = max(v[0] + v[2] for v in plate.values())
    if x1 - x0 <= 0:  # screens without a painted plate (arenas: full-screen arena renders)
        return None, None
    canvas = Image.new('RGB', (x1 - x0, 941))
    for k, (x, y, w, h) in sorted(plate.items(), key=lambda kv: kv[0] != 'c'):  # wings first, centre on top
        p = os.path.join(ROOT, 'public', 'assets', 'ui2', screen, f'plate_{k}.webp')
        if os.path.exists(p):
            canvas.paste(Image.open(p).convert('RGB').resize((w, h)), (x - x0, y))
    return canvas, (x0, x1)


for screen in SCREENS:
    img, ext = plate_of(screen)
    if img is None:
        print('skip', screen)
        continue
    W, H = img.size
    h = 384
    w = int(round(W * h / H / 32)) * 32
    a = (np.asarray(img.resize((w, h), Image.BICUBIC)).astype(np.float32) / 255.0 - MEAN) / STD
    with torch.no_grad():
        pred = model(torch.from_numpy(a.transpose(2, 0, 1)).float()[None])[0].numpy()
    lo, hi = np.percentile(pred, 1), np.percentile(pred, 99.5)
    dep = np.clip((pred - lo) / max(1e-6, hi - lo), 0, 1)
    out = Image.fromarray((dep * 255).astype(np.uint8)).resize((min(1280, W // 2), int(min(1280, W // 2) * H / W)), Image.BICUBIC)
    path = os.path.join(ROOT, 'public', 'assets', 'ui2', screen, 'depth.webp')
    out.save(path, 'WEBP', quality=90)
    json.dump({'x0': ext[0], 'x1': ext[1]}, open(path[:-5] + '.json', 'w'))
    print(screen, 'depth', out.size, 'extent', ext, flush=True)
