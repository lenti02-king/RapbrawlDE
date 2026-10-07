"""KÄMPFEN button (design v2 home, D43): cut again from the PO master WITH its chains, the baked "FIGHT" lettering
removed by LaMa (the old row-colour fill smeared the yellow face). The sprite is the master region itself with a soft
edge (the plate around it is the same master), plus a face mask for the shine sweep. Run after v2_home.py.

Usage: python3 tools/ui-extract/v2_fight_btn.py"""
import json
import os
import re
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
REF = os.path.join(os.path.dirname(__file__), 'ref', 'v2', 'home.webp')
OUT = os.path.join(ROOT, 'public', 'assets', 'ui2', 'home')
BOX = (522, 708, 1128, 904)  # button + chains + bolts
LABEL = (756, 742, 1016, 870)  # the baked FIGHT lettering incl. drips

img = uix.load(REF)
if img.shape[1] != 1672:
    img = cv2.resize(img, (1672, 941), interpolation=cv2.INTER_AREA)
x0, y0, x1, y1 = BOX
# lettering = dark pixels inside the label zone (black brush + drips), grown a little for the anti-aliased edge
lab = img[LABEL[1]:LABEL[3], LABEL[0]:LABEL[2]]
lum = cv2.cvtColor(lab, cv2.COLOR_BGR2GRAY)
dark = (lum < 110).astype(np.uint8) * 255
mask = np.zeros(img.shape[:2], np.uint8)
mask[LABEL[1]:LABEL[3], LABEL[0]:LABEL[2]] = dark
mask = uix.dilate(mask, 4)
clean = uix.inpaint_local(img, mask, region=(x0 - 40, y0 - 10, x1 + 40, y1 + 10), max_side=1024, ctx=0.8)
crop = clean[y0:y1, x0:x1].copy()
H, W = crop.shape[:2]
# soft rectangular edge (the plate under it is the same master); corners above the frame stay mostly transparent
a = np.full((H, W), 255, np.float32)
fe = 10.0
for i in range(int(fe)):
    v = 255 * (i + 1) / fe
    a[i, :] = np.minimum(a[i, :], v)
    a[H - 1 - i, :] = np.minimum(a[H - 1 - i, :], v)
    a[:, i] = np.minimum(a[:, i], v)
    a[:, W - 1 - i] = np.minimum(a[:, W - 1 - i], v)
uix.save_rgba(os.path.join(OUT, 'fight.webp'), crop, a.astype(np.uint8), quality=94)
# shine mask: the yellow face only
hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
face = ((hsv[..., 0] > 12) & (hsv[..., 0] < 38) & (hsv[..., 1] > 120) & (hsv[..., 2] > 150)).astype(np.uint8) * 255
face = uix.fill_holes(uix.largest(cv2.morphologyEx(face, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))))
face = cv2.GaussianBlur(face, (0, 0), 2)
uix.save_rgba(os.path.join(OUT, 'fight_mask.webp'), np.zeros_like(crop), face, quality=90)
# art table: the sprite's new box
ts = os.path.join(ROOT, 'src', 'ui', 'v2', 'art', 'home.ts')
s = open(ts).read()
s = re.sub(r'"fight": \[[^\]]*\]', f'"fight": [{x0}, {y0}, {W}, {H}]', s)
open(ts, 'w').write(s)
print('fight sprite', (x0, y0, W, H), 'lettering px', int((mask > 0).sum()))
