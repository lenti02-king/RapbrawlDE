"""Jazeek, textured Clash-Royale-style Meshy model (PO, Oct 2026): landmarks for tools/meshy/skin.py.
Blender coordinates of the untouched source (Z up, faces -Y, feet at z=-0.946), measured from front/side grids."""
JOINTS = dict(
    hips=-0.17, spine=-0.05, chest=0.15, neck=0.43, head=0.53,
    sh=(0.24, 0.33), el=(0.42, 0.06), wr=(0.555, -0.12), tip=(0.64, -0.33),
    hip=(0.10, -0.20), kn=(0.15, -0.53), an=(0.20, -0.86), toe=0.12,
)
PALM = {'L': (-1.0, 0.3, 0.0), 'R': (1.0, 0.3, 0.0)}  # palm-normal hints (relaxed hands, palms toward the thighs)
KNUCKLE, MIDDLE = 0.45, 0.68  # along wrist -> fingertip
THUMB_T, THUMB_LAT = 0.6, 0.025
HEAD_PITCH = 0.0
