"""Paint a character's high-poly sculpt and render quick Cycles previews (for iterating on the region rules).

Usage: python3 tools/meshy/preview.py jazeek|bonez [outdir] [views]
"""
from __future__ import annotations

import importlib
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
import numpy as np  # noqa: E402

import lib  # noqa: E402

cid = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(lib.ROOT, 'artifacts', 'meshy')
views = tuple(sys.argv[3].split(',')) if len(sys.argv) > 3 else ('front', 'side', 'back', 'face', 'face3q')
os.makedirs(out, exist_ok=True)
mod = importlib.import_module(cid)
lib.reset()
ob = lib.load_src(os.path.join(lib.CACHE, mod.SRC))
g = lib.Geo(ob)
det = g.detail()
col, rough, metal, lab = mod.paint(g, det)
lib.set_point_colors(ob, 'Col', np.c_[col, np.ones(len(col))])
ob.data.materials.clear()
ob.data.materials.append(lib.attr_material('paint', 'Col'))
files = lib.preview(ob, os.path.join(out, f'{cid}_paint'), views=views, samples=10)
sheet = os.path.join(out, f'{cid}_paint_sheet.png')
subprocess.run(['montage', *files, '-tile', f'{len(files)}x', '-geometry', '360x560>+2+2', '-background', '#222', sheet], check=True)
print('sheet', sheet)
