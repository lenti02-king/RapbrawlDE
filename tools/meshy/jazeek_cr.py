"""Jazeek, stylized mobile-game Meshy model (PO, release modelle-3, Oct 2026): landmarks for tools/meshy/skin.py.
Blender coordinates of the untouched source (Z up, faces -Y, feet at z=-0.952), measured from front/side grids
(python3 tools/meshy/grid.py .cache/meshy3/jazeek_std_src.glb artifacts/meshy3/jazeek front,side 420)."""
JOINTS = dict(
    hips=-0.02, spine=0.12, chest=0.30, neck=0.56, head=0.65,
    sh=(0.19, 0.47), el=(0.33, 0.20), wr=(0.44, 0.03), tip=(0.49, -0.12),
    hip=(0.09, -0.06), kn=(0.12, -0.46), an=(0.15, -0.86), toe=0.10,
)
PALM = {'L': (-1.0, 0.3, 0.0), 'R': (1.0, 0.3, 0.0)}
KNUCKLE, MIDDLE = 0.45, 0.68
THUMB_T, THUMB_LAT = 0.6, 0.02
HEAD_PITCH = 0.0
# the generated trousers carry a third-party monogram print: smoothed to plain fabric (base colour + normal map)
RETOUCH = [dict(z=(-0.85, 0.10), x=0.33)]
