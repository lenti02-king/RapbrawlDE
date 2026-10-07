"""Lacazette, stylized mobile-game Meshy model (PO, release modelle-3, Oct 2026): landmarks for tools/meshy/skin.py.
Blender coordinates of the untouched source (Z up, faces -Y, feet at z=-0.952), measured from front/side grids."""
JOINTS = dict(
    hips=0.07, spine=0.22, chest=0.42, neck=0.64, head=0.73,
    sh=(0.19, 0.55), el=(0.33, 0.27), wr=(0.40, 0.03), tip=(0.42, -0.12),
    hip=(0.09, 0.03), kn=(0.11, -0.42), an=(0.17, -0.85), toe=0.13,
)
PALM = {'L': (-1.0, 0.3, 0.0), 'R': (1.0, 0.3, 0.0)}
KNUCKLE, MIDDLE = 0.45, 0.68
THUMB_T, THUMB_LAT = 0.6, 0.02
HEAD_PITCH = 0.0
