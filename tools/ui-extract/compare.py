"""Reference vs implementation: side by side + difference heatmap + per-element PSNR on the art (text boxes masked
out, since the text is native German by design).
python3 tools/ui-extract/compare.py tools/ui-extract/ref/main_menu.webp artifacts/menu/ref.png artifacts/menu/compare.png"""
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from main_menu import ELEMENTS  # noqa: E402

ref = cv2.imread(sys.argv[1])
got = cv2.imread(sys.argv[2])
got = cv2.resize(got, (ref.shape[1], ref.shape[0]), interpolation=cv2.INTER_AREA)
diff = np.abs(ref.astype(np.int16) - got.astype(np.int16)).max(axis=2).astype(np.uint8)
heat = cv2.applyColorMap(np.clip(diff.astype(np.int16) * 3, 0, 255).astype(np.uint8), cv2.COLORMAP_INFERNO)
top = np.hstack([ref, got])
bot = np.hstack([heat, cv2.addWeighted(ref, 0.5, got, 0.5, 0)])
sheet = np.vstack([top, bot])
cv2.imwrite(sys.argv[3], cv2.resize(sheet, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA))
print(f'{"element":<12} {"PSNR art (dB)":>14}')
for k, e in ELEMENTS.items():
    x0, y0, x1, y1 = e['box']
    m = np.ones((y1 - y0, x1 - x0), bool)
    for z in list(e.get('text', {}).values()) + list(e.get('remove', [])):
        zx0, zy0, zx1, zy1 = z
        m[max(0, zy0 - y0):max(0, zy1 - y0), max(0, zx0 - x0):max(0, zx1 - x0)] = False
    for outer, _ in e.get('bars', []):
        zx0, zy0, zx1, zy1 = outer
        m[max(0, zy0 - y0):max(0, zy1 - y0), max(0, zx0 - x0):max(0, zx1 - x0)] = False
    for poly in e.get('remove_poly', []):
        pm = np.zeros(ref.shape[:2], np.uint8)
        cv2.fillPoly(pm, [np.array(poly)], 1)
        m &= pm[y0:y1, x0:x1] == 0
    a = ref[y0:y1, x0:x1][m].astype(np.float64)
    b = got[y0:y1, x0:x1][m].astype(np.float64)
    mse = ((a - b) ** 2).mean()
    print(f'{k:<12} {10 * np.log10(255 ** 2 / max(mse, 1e-6)):>14.1f}')
