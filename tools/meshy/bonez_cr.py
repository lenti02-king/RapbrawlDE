"""Bonez MC, textured Clash-Royale-style Meshy model (PO, Oct 2026): landmarks for tools/meshy/skin.py.
Blender coordinates of the untouched source (Z up, faces -Y, feet at z=-0.953), measured from front/side grids."""
JOINTS = dict(
    hips=-0.22, spine=-0.08, chest=0.12, neck=0.40, head=0.50,
    sh=(0.27, 0.34), el=(0.53, 0.12), wr=(0.66, -0.12), tip=(0.75, -0.33),
    hip=(0.12, -0.25), kn=(0.23, -0.52), an=(0.30, -0.82), toe=0.13,
)
PALM = {'L': (-0.7, 0.7, 0.0), 'R': (0.7, 0.7, 0.0)}  # backs of the hands (tattoos) face forward/out
KNUCKLE, MIDDLE = 0.45, 0.68
THUMB_T, THUMB_LAT = 0.6, 0.025
HEAD_PITCH = 0.0
