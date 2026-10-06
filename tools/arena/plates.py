"""Backdrop plates for the PO's arena images (D40): Festival (open air at the excavators) and Bahnhofsviertel.

The PO's paintings (tools/arena/ref/<id>.webp, git-ignored: they show real brands) become
  public/assets/arena/<id>/backdrop.jpg   the scenery above the ground line, real names replaced (no outpainting: the
                                          runtime puts it on a big plane far behind the fighters, edges mirrored)
  public/assets/arena/<id>/floor.jpg      a tile of the ground (sand / wet asphalt) for the 3D floor
  public/assets/arena/<id>/meta.json      ground row, size, sign glow rectangles (uv) for the runtime
Real businesses and brands in the paintings are replaced by fictional ones (third-party marks rule): the "splash!"
festival logo -> RAPBRAWL badge, "PIK DAME" -> "PIK ASS", "YOK YOK" -> "KIOSK 069", "MOSELECK" -> "WEINECK".

Run: python3 tools/arena/plates.py [festival|bahnhof]   (LaMa on CPU, ~2 min per arena; REUSE_BG=1 reuses outpainting)
"""
from __future__ import annotations

import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'ui-extract'))
import uix  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FONT = os.path.join(ROOT, '.cache', 'fonts', 'package', '400Regular', 'Anton_400Regular.ttf')
DBG = os.path.join(ROOT, '.cache', 'arena')

SPECS = {
    'festival': dict(
        ref='splash.webp',
        ground=640,
        # the festival logo badge on the stage banner (a real festival brand)
        holes=[dict(poly=[(872, 176), (1138, 150), (1146, 246), (880, 276)])],
        badges=[dict(text='RAPBRAWL', center=(1008, 214), size=(262, 96), rot=5.5, font=74)],
        signs=[],
        floor=(0, 860, 2000, 1125),
    ),
    'bahnhof': dict(
        ref='bahnhof.webp',
        ground=662,
        # neon names of real businesses: glowing letters masked by brightness inside these zones
        holes=[dict(zone=(410, 246, 758, 318)), dict(zone=(954, 300, 1146, 366)), dict(zone=(1268, 364, 1418, 412), dark=True)],
        badges=[],
        signs=[
            dict(text='PIK ASS', box=(420, 252, 748, 312), color=(255, 74, 92), glow=(255, 30, 60)),
            dict(text='KIOSK 069', box=(962, 306, 1140, 360), color=(150, 245, 255), glow=(40, 190, 255)),
            dict(text='WEINECK', box=(1278, 370, 1410, 406), color=(255, 205, 140), glow=(255, 150, 50), dim=True),
        ],
        floor=(0, 880, 2000, 1125),
    ),
}

SIDE = 0
TOP = 0


def text_layer(size, text, font_px, color):
    font = ImageFont.truetype(FONT, font_px)
    w, h = size
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    tb = d.textbbox((0, 0), text, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    d.text(((w - tw) / 2 - tb[0], (h - th) / 2 - tb[1]), text, font=font, fill=color)
    return im


def fit_font(text, box_w, box_h):
    for px in range(int(box_h * 1.2), 8, -1):
        f = ImageFont.truetype(FONT, px)
        tb = ImageDraw.Draw(Image.new('L', (1, 1))).textbbox((0, 0), text, font=f)
        if tb[2] - tb[0] <= box_w and tb[3] - tb[1] <= box_h:
            return px
    return 10


def neon(base: Image.Image, sign: dict) -> Image.Image:
    """Native neon lettering: a soft glow halo, a coloured tube and a hot white core."""
    x0, y0, x1, y1 = sign['box']
    w, h = x1 - x0, y1 - y0
    pad = 30
    px = fit_font(sign['text'], w - 6, h - 6)
    big = (w + 2 * pad, h + 2 * pad)
    tube = text_layer(big, sign['text'], px, sign['color'] + (255,))
    halo = text_layer(big, sign['text'], px, sign['glow'] + (255,)).filter(ImageFilter.GaussianBlur(9))
    core = text_layer(big, sign['text'], px, (255, 255, 255, 255)).filter(ImageFilter.GaussianBlur(0.6))
    out = base.convert('RGBA')
    k = 0.55 if sign.get('dim') else 1.0
    # additive-ish: halo screened, then tube, then a faint core
    region = out.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))
    halo_np = np.asarray(halo).astype(np.float32)
    reg_np = np.asarray(region).astype(np.float32)
    a = halo_np[..., 3:4] / 255.0 * 0.85 * k
    reg_np[..., :3] = 255 - (255 - reg_np[..., :3]) * (1 - a * halo_np[..., :3] / 255.0)
    region = Image.fromarray(np.clip(reg_np, 0, 255).astype(np.uint8))
    region.alpha_composite(tube)
    if not sign.get('dim'):
        core.putalpha(core.getchannel('A').point(lambda v: int(v * 0.45)))
        region.alpha_composite(core)
    out.paste(region, (x0 - pad, y0 - pad))
    return out.convert('RGB')


def badge(base: Image.Image, b: dict) -> Image.Image:
    """Our own logo badge (dark rounded plate, white lettering, a pink drop shadow), slightly tilted."""
    w, h = b['size']
    im = Image.new('RGBA', (w + 60, h + 60), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((34, 36, 34 + w, 36 + h), radius=h // 3, fill=(255, 60, 160, 200))
    d.rounded_rectangle((30, 30, 30 + w, 30 + h), radius=h // 3, fill=(36, 34, 52, 255), outline=(255, 255, 255, 255), width=4)
    t = text_layer((w, h), b['text'], min(b['font'], fit_font(b['text'], w - 40, h - 28)), (255, 255, 255, 255))
    im.alpha_composite(t, (30, 30))
    im = im.rotate(b['rot'], resample=Image.BICUBIC, expand=True)
    out = base.convert('RGBA')
    cx, cy = b['center']
    out.alpha_composite(im, (cx - im.width // 2, cy - im.height // 2))
    return out.convert('RGB')


def build(aid: str) -> None:
    spec = SPECS[aid]
    out_dir = os.path.join(ROOT, 'public', 'assets', 'arena', aid)
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(DBG, exist_ok=True)
    img = uix.load(os.path.join(os.path.dirname(__file__), 'ref', spec['ref']))
    H, W = img.shape[:2]
    # 1) remove the real names
    mask = np.zeros((H, W), np.uint8)
    for hole in spec['holes']:
        if 'poly' in hole:
            mask |= uix.dilate(uix.poly_mask(img.shape, hole['poly']), 6)
        else:
            z = hole['zone']
            tm = uix.text_mask(img, z, thr=30, dil=5, k=31, bright=not hole.get('dark'))
            if hole.get('dark'):
                tm |= uix.text_mask(img, z, thr=30, dil=5, k=31, bright=True)
            mask |= tm
    clean = uix.inpaint(img, mask, max_side=1024, ctx=0.8, feather=3)
    cv2.imwrite(os.path.join(DBG, f'{aid}_clean.png'), clean)
    # 2) our own signs
    pil = Image.fromarray(cv2.cvtColor(clean, cv2.COLOR_BGR2RGB))
    for s in spec['signs']:
        pil = neon(pil, s)
    for b in spec['badges']:
        pil = badge(pil, b)
    signed = cv2.cvtColor(np.asarray(pil), cv2.COLOR_RGB2BGR)
    cv2.imwrite(os.path.join(DBG, f'{aid}_signed.png'), signed)
    # 3) the scenery above the ground line (+ a few rows the runtime fades into the 3D floor)
    wide = signed
    g = spec['ground'] + TOP
    back = wide[: g + 24]
    Image.fromarray(cv2.cvtColor(back, cv2.COLOR_BGR2RGB)).save(os.path.join(out_dir, 'backdrop.jpg'), quality=86, optimize=True, progressive=True)
    small = cv2.resize(back, (back.shape[1] // 2, back.shape[0] // 2), interpolation=cv2.INTER_AREA)
    Image.fromarray(cv2.cvtColor(small, cv2.COLOR_BGR2RGB)).save(os.path.join(out_dir, 'backdrop_low.jpg'), quality=84, optimize=True)
    # 4) floor tile from the near ground (perspective-squashed rows stretched back a little)
    x0, y0, x1, y1 = spec['floor']
    fl = cv2.resize(img[y0:y1, x0:x1], (2048, 640), interpolation=cv2.INTER_CUBIC)
    Image.fromarray(cv2.cvtColor(fl, cv2.COLOR_BGR2RGB)).save(os.path.join(out_dir, 'floor.jpg'), quality=86, optimize=True)
    meta = {
        'width_px': int(back.shape[1]),
        'height_px': int(back.shape[0]),
        'ground_px': int(g),
        # sign rectangles in backdrop uv (0..1, v from the top) for the runtime flicker glow
        'signs': [
            {'uv': [(s['box'][0] + SIDE) / back.shape[1], (s['box'][1] + TOP) / back.shape[0], (s['box'][2] + SIDE) / back.shape[1], (s['box'][3] + TOP) / back.shape[0]],
             'color': '#%02x%02x%02x' % s['glow']}
            for s in spec['signs']
        ],
    }
    json.dump(meta, open(os.path.join(out_dir, 'meta.json'), 'w'), indent=1)
    print(f'[arena] {aid}: backdrop {back.shape[1]}x{back.shape[0]}, ground row {g}, '
          f'{os.path.getsize(os.path.join(out_dir, "backdrop.jpg")) / 1e6:.2f} MB', flush=True)


if __name__ == '__main__':
    for aid in (sys.argv[1:] or list(SPECS)):
        build(aid)
