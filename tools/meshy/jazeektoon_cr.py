"""Jazeek Cartoon, modelle-4 anime / cel-shaded 3D (PO, Oct 2026, S16): the close-up head merged onto the full body by
tools/meshy/merge4.py anime -> .cache/meshy4/jazeektoon_src.glb. Landmarks for tools/meshy/skin.py in Blender
coordinates of that file (Z up, faces -Y, feet at z=-0.953), measured from front/side grids of the body
(python3 tools/meshy/grid.py .cache/meshy4/anime_body_src.glb artifacts/meshy4/toon4 front,side 420)."""
JOINTS = dict(
    hips=0.10, spine=0.25, chest=0.42, neck=0.62, head=0.69,
    sh=(0.17, 0.58), el=(0.31, 0.32), wr=(0.43, 0.08), tip=(0.47, -0.06),
    hip=(0.09, 0.07), kn=(0.11, -0.40), an=(0.12, -0.86), toe=0.11,
)
PALM = {'L': (-1.0, 0.3, 0.0), 'R': (1.0, 0.3, 0.0)}
KNUCKLE, MIDDLE = 0.45, 0.68
THUMB_T, THUMB_LAT = 0.6, 0.02
HEAD_PITCH = 0.0
