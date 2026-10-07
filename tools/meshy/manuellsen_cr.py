"""Manuellsen, stylized mobile-game Meshy model (PO, release modelle-3, Oct 2026): landmarks for tools/meshy/skin.py.
Blender coordinates of the untouched source (Z up, faces -Y, feet at z=-0.952), measured from front/side grids.
A heavyweight boxer: broad shoulders, arms hanging almost straight, wrapped fists (already closed: no finger curl)."""
JOINTS = dict(
    hips=0.04, spine=0.20, chest=0.42, neck=0.66, head=0.74,
    sh=(0.24, 0.55), el=(0.34, 0.25), wr=(0.35, 0.07), tip=(0.33, -0.12),
    hip=(0.11, 0.00), kn=(0.13, -0.40), an=(0.17, -0.82), toe=0.12,
)
PALM = {'L': (-1.0, 0.3, 0.0), 'R': (1.0, 0.3, 0.0)}
KNUCKLE, MIDDLE = 0.45, 0.68
THUMB_T, THUMB_LAT = 0.6, 0.02
HEAD_PITCH = 0.0
FIST = False
