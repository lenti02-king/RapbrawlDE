"""Skin backdrop without the logo (D41): the leaderboard stadium plate (src/ui/img/board/backdrop.webp) is the
backdrop of every classic screen (Kämpfer, Karten, Profil, Einstellungen, Steuerung, Ergebnis, Online). Its baked
RAP BRAWL logo sits right behind those screens' titles and panels, so they get a copy with the logo filled in (LaMa).

Run: python3 tools/ui-extract/skin_backdrop.py   ->  src/ui/img/board/backdrop_clean.webp
"""
from __future__ import annotations

import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'src', 'ui', 'img', 'board', 'backdrop.webp')
OUT = os.path.join(ROOT, 'src', 'ui', 'img', 'board', 'backdrop_clean.webp')

# logo (mic, fist, lettering, belt) in plate pixels (the plate is 2840x1305: master x+420, y+90)
LOGO = [(1168, 96), (1250, 84), (1560, 84), (1640, 150), (1640, 330), (1580, 392), (1190, 392), (1160, 330)]


def main() -> None:
    img = uix.load(SRC)
    mask = uix.dilate(uix.poly_mask(img.shape, LOGO), 8)
    out = uix.inpaint(img, mask, max_side=1024, ctx=0.9, feather=4)
    cv2.imwrite(os.path.join(ROOT, '.cache', 'skin_backdrop_check.png'), out)
    uix.save_rgba(OUT, out, None, quality=86)
    print('[skin] ->', OUT, os.path.getsize(OUT) // 1024, 'KB', flush=True)


if __name__ == '__main__':
    main()
