"""Draw the skeleton from tools/meshy/skin.py (.cache/<dir>/work/<id>/joints.json) over grid renders (tools/meshy/grid.py).
Usage: python3 tools/meshy/jointshot.py <id> artifacts/meshy3/<id>_std [dir=meshy3]  ->  <prefix>_<view>_joints.png"""
import json
import os
import sys

from PIL import Image, ImageDraw

cid, prefix = sys.argv[1], sys.argv[2]
d = sys.argv[3] if len(sys.argv) > 3 else 'meshy3'
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
P = json.load(open(os.path.join(ROOT, '.cache', d, 'work', cid, 'joints.json')))
BONES = [('hips', 'spine'), ('spine', 'chest'), ('chest', 'neck'), ('neck', 'head'), ('head', 'head_top')]
for s in 'LR':
    BONES += [('clav' + s, 'sh' + s), ('sh' + s, 'el' + s), ('el' + s, 'wr' + s), ('wr' + s, 'tip' + s), ('hips', 'hip' + s),
              ('hip' + s, 'kn' + s), ('kn' + s, 'an' + s), ('an' + s, 'toe' + s), ('toe' + s, 'toeEnd' + s)]
for view in ('front', 'side'):
    img = f'{prefix}_{view}.png'
    if not os.path.exists(img):
        continue
    m = json.load(open(img[:-4] + '.json'))
    im = Image.open(img).convert('RGB')
    dr = ImageDraw.Draw(im)

    def px(p):
        u = p[0] if view == 'front' else p[1]
        return ((u - m['x0']) / (m['x1'] - m['x0']) * m['W'], (m['z1'] - p[2]) / (m['z1'] - m['z0']) * m['H'])
    for a, b in BONES:
        if a in P and b in P:
            dr.line([px(P[a]), px(P[b])], fill=(255, 230, 0), width=3)
    for k, p in P.items():
        x, y = px(p)
        dr.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(255, 40, 40), outline=(0, 0, 0))
    out = f'{prefix}_{view}_joints.png'
    im.save(out)
    print('wrote', out)
