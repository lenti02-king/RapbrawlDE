"""Jazeek Cartoon, modelle-5 (S18): the PO's third Jazeek, a stylized 3D mobile-game character ("wenig toon, wie ein
Clash Royale Character"): close-up head + headless body merged by tools/meshy/merge4.py v5 -> .cache/meshy4/jazeektoon_src.glb.
Landmarks for tools/meshy/skin.py in Blender coordinates of that file (Z up, faces -Y, feet at z=-0.95, crown 0.95),
from cross-section clusters of the merged mesh (neck +-0.08 at 0.58-0.62, shoulders widen below 0.54, the arms leave
the torso at 0.26, the legs split at -0.25, shoes from -0.86) and front/side grids
(python3 tools/meshy/grid.py .cache/meshy4/jazeektoon_src.glb artifacts/meshy5/rig front,side 500).
The modelle-4 cartoon landmarks are in git history before S18."""
JOINTS = dict(
    hips=-0.12, spine=0.06, chest=0.28, neck=0.545, head=0.64,
    sh=(0.20, 0.40), el=(0.30, 0.20), wr=(0.40, 0.00), tip=(0.45, -0.25),
    hip=(0.09, -0.17), kn=(0.17, -0.52), an=(0.24, -0.84), toe=0.11,
)
PALM = {'L': (-1.0, 0.3, 0.0), 'R': (1.0, 0.3, 0.0)}
KNUCKLE, MIDDLE = 0.45, 0.68
THUMB_T, THUMB_LAT = 0.6, 0.02
HEAD_PITCH = 0.0
