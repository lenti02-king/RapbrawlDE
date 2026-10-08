"""Face landmarks + proportions (S17, PO: compare the models with Jazeek's REAL photos, not with another model).

Runs MediaPipe FaceLandmarker (478 points incl. irises, head pose) on photos and on renders of the 3D heads, turns
each face frontal (inverse head rotation of the 3D landmarks) and measures proportions in units of the eye distance,
so a photo with its own lens, distance and pose compares with a render.

  .cache/mpvenv/bin/python tools/meshy/facemarks.py out.json img1 [img2 ..]      (venv: pip install mediapipe;
  model: .cache/mp/face_landmarker.task from storage.googleapis.com/mediapipe-models/face_landmarker/...)
Writes out.json (landmarks per image: image px, frontalised 3D, metrics) and <out>_<n>.png overlays.
"""
from __future__ import annotations

import json
import os
import sys

import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MODEL = os.path.join(ROOT, '.cache', 'mp', 'face_landmarker.task')

# MediaPipe face-mesh indices (subject's right = image left on a frontal photo)
IDX = dict(
    eyeR_out=33, eyeR_in=133, eyeR_top=159, eyeR_bot=145, irisR=468,
    eyeL_out=263, eyeL_in=362, eyeL_top=386, eyeL_bot=374, irisL=473,
    browR_in=55, browR_mid=105, browR_out=70, browL_in=285, browL_mid=334, browL_out=300,
    nasion=168, nose_tip=1, subnasale=2, alarR=64, alarL=294, nose_r=129, nose_l=358,
    mouthR=61, mouthL=291, lip_top=0, lip_upin=13, lip_loin=14, lip_bot=17,
    chin=152, jawR=172, jawL=397, cheekR=234, cheekL=454, forehead=10,
)


def detect(path):
    opts = vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=MODEL), num_faces=1,
                                        output_facial_transformation_matrixes=True, min_face_detection_confidence=0.2,
                                        min_face_presence_confidence=0.2)
    with vision.FaceLandmarker.create_from_options(opts) as lm:
        img = mp.Image.create_from_file(path)
        r = lm.detect(img)
    if not r.face_landmarks:
        return None
    W, H = img.width, img.height
    pts = np.array([[p.x * W, p.y * H, p.z * W] for p in r.face_landmarks[0]])
    M = np.array(r.facial_transformation_matrixes[0]) if r.facial_transformation_matrixes else np.eye(4)
    return pts, M, (W, H)


def frontal(pts, M):
    """Remove the head rotation: rotate the landmark cloud (image px, y down, z toward the camera) by the inverse of
    the pose rotation around its centroid."""
    R = M[:3, :3] / np.linalg.norm(M[:3, 0])
    # MediaPipe's canonical space is y-up, z toward the viewer; image space is y-down
    P = pts.copy()
    P[:, 1] *= -1
    P[:, 2] *= -1
    c = P.mean(0)
    Q = (P - c) @ R  # R^T applied as row vectors: inverse rotation
    Q[:, 1] *= -1
    Q[:, 2] *= -1
    return Q


def metrics(F):
    g = lambda k: F[IDX[k], :2]  # noqa: E731
    d = lambda a, b: float(np.linalg.norm(g(a) - g(b)))  # noqa: E731
    iod = d('irisR', 'irisL')
    m = dict(
        eye_width=0.5 * (d('eyeR_out', 'eyeR_in') + d('eyeL_out', 'eyeL_in')) / iod,
        eye_open=0.5 * (d('eyeR_top', 'eyeR_bot') + d('eyeL_top', 'eyeL_bot')) / iod,
        inner_canthi=d('eyeR_in', 'eyeL_in') / iod,
        brow_height=0.5 * (abs(g('browR_mid')[1] - g('irisR')[1]) + abs(g('browL_mid')[1] - g('irisL')[1])) / iod,
        nose_width=d('alarR', 'alarL') / iod,
        nose_length=abs(g('subnasale')[1] - g('nasion')[1]) / iod,
        mouth_width=d('mouthR', 'mouthL') / iod,
        upper_lip=abs(g('lip_upin')[1] - g('lip_top')[1]) / iod,
        lower_lip=abs(g('lip_bot')[1] - g('lip_loin')[1]) / iod,
        nose_to_mouth=abs(g('lip_top')[1] - g('subnasale')[1]) / iod,
        mouth_to_chin=abs(g('chin')[1] - g('lip_bot')[1]) / iod,
        eyes_to_mouth=abs(g('lip_top')[1] - 0.5 * (g('irisR')[1] + g('irisL')[1])) / iod,
        face_width=d('cheekR', 'cheekL') / iod,
        jaw_width=d('jawR', 'jawL') / iod,
        face_height=abs(g('chin')[1] - g('forehead')[1]) / iod,
    )
    return {k: round(v, 3) for k, v in m.items()}


def overlay(path, pts, out):
    im = Image.open(path).convert('RGB')
    dr = ImageDraw.Draw(im)
    r = max(1, im.width // 400)
    for i, (x, y, _) in enumerate(pts):
        col = (255, 60, 60) if i in IDX.values() else (60, 255, 120)
        dr.ellipse([x - r, y - r, x + r, y + r], fill=col)
    im.save(out)


def main():
    out = sys.argv[1]
    res = {}
    for n, p in enumerate(sys.argv[2:]):
        r = detect(p)
        if r is None:
            print('no face:', p)
            res[p] = None
            continue
        pts, M, wh = r
        F = frontal(pts, M)
        res[p] = dict(size=wh, image=pts.round(2).tolist(), frontal=F.round(3).tolist(), pose=M.round(4).tolist(), metrics=metrics(F))
        overlay(p, pts, f'{os.path.splitext(out)[0]}_{n}.png')
        print(os.path.basename(p), json.dumps(res[p]['metrics']))
    json.dump(res, open(out, 'w'))


if __name__ == '__main__':
    main()
