"""Bonez MC, stylized mobile-game Meshy model (PO, release modelle-3, Oct 2026): landmarks for tools/meshy/skin.py.
Blender coordinates of the untouched source (Z up, faces -Y, feet at z=-0.952), measured from front/side grids."""
JOINTS = dict(
    hips=-0.06, spine=0.10, chest=0.32, neck=0.60, head=0.69,
    sh=(0.20, 0.50), el=(0.33, 0.24), wr=(0.42, 0.04), tip=(0.45, -0.13),
    hip=(0.10, -0.10), kn=(0.12, -0.47), an=(0.16, -0.85), toe=0.12,
)
PALM = {'L': (-1.0, 0.3, 0.0), 'R': (1.0, 0.3, 0.0)}
KNUCKLE, MIDDLE = 0.45, 0.68
THUMB_T, THUMB_LAT = 0.6, 0.02
HEAD_PITCH = 0.0
