"""Jazeek, modelle-4 stylized 3D (PO, Oct 2026, S16): the close-up head merged onto the full body by
tools/meshy/merge4.py styl -> .cache/meshy4/jazeek_src.glb. Landmarks for tools/meshy/skin.py in Blender coordinates
of that file (Z up, faces -Y, feet at z=-0.951, realistic proportions), measured from front/side grids
(python3 tools/meshy/grid.py .cache/meshy4/jazeek_src.glb artifacts/meshy4/jaz4 front,side 420).
The modelle-3 landmarks (and the GG-print RETOUCH of that model's trousers) are in git history before S16; the
modelle-4 trousers carry the PO's own "99" monogram, nothing to retouch."""
JOINTS = dict(
    hips=0.10, spine=0.25, chest=0.42, neck=0.62, head=0.70,
    sh=(0.18, 0.57), el=(0.33, 0.30), wr=(0.49, 0.10), tip=(0.53, -0.085),
    hip=(0.09, 0.07), kn=(0.11, -0.41), an=(0.12, -0.86), toe=0.11,
)
PALM = {'L': (-1.0, 0.3, 0.0), 'R': (1.0, 0.3, 0.0)}
KNUCKLE, MIDDLE = 0.45, 0.68
THUMB_T, THUMB_LAT = 0.6, 0.02
# the open sculpted hands hold the fingers spread to the side the vote reads as the thumb: force the thumb side
THUMB_SIDE = {'L': -1.0, 'R': 1.0}
HEAD_PITCH = 0.0
