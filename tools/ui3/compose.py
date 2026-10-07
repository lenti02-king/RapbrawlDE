# Design v3 (S13b): plate composition - the Blender stadium render of a screen (stage.py) + the decor pieces that the
# v2 plate had painted in (pills, roster frames, name plates, bars...) + the logo, graded and sliced like the v2 plates
# (l / c / r around the 1672x941 layout) with the Blender depth for the living plate.
import json
import os

from PIL import Image, ImageEnhance

import lib
import pieces as P

STAGE = os.path.join(lib.CACHE, 'stage')
LOGO = os.path.join(lib.ROOT, 'public', 'assets', 'ui2', 'shared', 'logo.webp')


def plate(screen, decor, out_dir, stage_shot=None, logo_box=None, sat=1.22, contrast=1.06):
    """decor: list of (RGBA image, [x, y, w, h] layout box, shadow?) composited in order."""
    shot = stage_shot or screen
    bg = Image.open(os.path.join(STAGE, f'{shot}_color.png')).convert('RGB').resize((2472, 941), Image.LANCZOS)
    bg = ImageEnhance.Contrast(ImageEnhance.Color(bg).enhance(sat)).enhance(contrast).convert('RGBA')
    if logo_box:
        x0, y0, x1, y1 = logo_box
        lg = P.fit_image(Image.open(LOGO), x1 - x0, y1 - y0, 'contain', (0.5, 0.0))
        bg.alpha_composite(P.drop_shadow(lg, 0, 8, 12, 0.6), (x0 + 400, y0))
    for item in decor:
        im, box = item[0], item[1]
        shadow = item[2] if len(item) > 2 else True
        pi = im.resize((box[2], box[3]), Image.LANCZOS)
        if shadow:
            pi = P.drop_shadow(pi, 0, 4, 5, 0.55)
        bg.alpha_composite(pi, (box[0] + 400, box[1]))
    os.makedirs(out_dir, exist_ok=True)
    rgb = bg.convert('RGB')
    for k, (x0, x1) in {'l': (0, 404), 'c': (396, 2076), 'r': (2068, 2472)}.items():
        rgb.crop((x0, 0, x1, 941)).save(os.path.join(out_dir, f'plate_{k}.webp'), quality=90, method=6)
    d = Image.open(os.path.join(STAGE, f'{shot}_depth.png')).convert('I').point(lambda v: v / 256).convert('L').resize((1236, 470), Image.LANCZOS)
    d.save(os.path.join(out_dir, 'depth.webp'), quality=92)
    with open(os.path.join(out_dir, 'depth.json'), 'w') as f:
        json.dump({'x0': -400, 'x1': 2072}, f)
    prev = os.path.join(lib.ROOT, 'artifacts', 'ui3', f'{screen}_plate.jpg')
    os.makedirs(os.path.dirname(prev), exist_ok=True)
    rgb.resize((1236, 470), Image.LANCZOS).save(prev, quality=88)
    return prev
