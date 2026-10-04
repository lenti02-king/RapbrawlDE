"""Builds the cartoon fighters with Blender (bpy):  python3 tools/cartoon/build.py jazeek|bonez [--out x.glb] [--fast]"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
import bpy  # noqa: E402

from characters import BUILDERS  # noqa: E402
from kit import export  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

if __name__ == '__main__':
    char = sys.argv[1]
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else os.path.join(ROOT, 'public', 'assets', 'characters', f'{char}.glb')
    t0 = time.time()
    k, fams, rigids = BUILDERS[char]()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tris = export(bpy, out, k.bones(), fams, rigids, ao_samples=0 if '--fast' in sys.argv else 48)
    print(f'[cartoon] {char}: {out} ({os.path.getsize(out) / 1e6:.2f} MB, {tris} triangles) in {time.time() - t0:.0f} s')
