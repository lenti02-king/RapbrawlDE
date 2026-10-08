"""How close is a model render's face to the photos? Mean landmark distance (eyes, brows, nose, lips, jaw) after a
similarity fit on the stable points, in % of the eye-corner span - per region and overall (S17).
  python3 tools/meshy/facefit.py fm.json <render> <photo,photo>"""
import json
import sys

import numpy as np

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from facewarp import BROWS, EYE_L, EYE_R, JAW, LIPS, NOSE, STABLE, WARP, similarity  # noqa: E402

fm = json.load(open(sys.argv[1]))
M = np.array(fm[sys.argv[2]]['frontal'])[:, :2]
span = np.linalg.norm(M[33] - M[263])
res = []
for p in sys.argv[3].split(','):
    F = np.array(fm[p]['frontal'])[:, :2]
    T = similarity(F[STABLE], M[STABLE])
    res.append(T(F) - M)
r = np.mean(res, 0)
out = {}
for name, ids in (('eyes', EYE_R + EYE_L), ('brows', BROWS), ('nose', NOSE), ('lips', LIPS), ('jaw', JAW), ('all', WARP)):
    out[name] = round(float(np.linalg.norm(r[ids], axis=1).mean() / span * 100), 2)
print(sys.argv[2].rsplit('/', 1)[-1], json.dumps(out))
