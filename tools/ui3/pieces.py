# Design v3 (S13b): render one UI piece to an exact layout box. A piece is a Blender build function working in metres
# (1 m = 100 reference px) centred on the origin; it is rendered with the shared studio light through an ortho camera
# that covers exactly the box, at 2x the reference resolution, then gets the ink outline. Image layers (fighter busts,
# card art, burst backdrops) are composited in PIL under/over the 3D render.
import os
import time

from PIL import Image, ImageChops, ImageDraw, ImageFilter

import kit
import lib

PX = 200  # px per metre = 2x reference
TMP = os.path.join(lib.CACHE, 'pieces')
os.makedirs(TMP, exist_ok=True)
INK = (18, 11, 24)


def render_piece(name, w_px, h_px, build, outline=3, samples=64):
    t = time.time()
    lib.reset(samples)
    kit._mats.clear()
    kit._link_mesh.clear()
    lib.studio_world(0.55)
    lib.ui_lights()
    build(w_px / 100, h_px / 100)
    lib.ortho_camera(w_px / 100, h_px / 100, PX)
    path = os.path.join(TMP, f'{name}.png')
    lib.render(path)
    im = Image.open(path).convert('RGBA')
    if outline:
        im = ink_outline(im, outline)
    im.save(path)
    print('piece', name, f'{time.time() - t:.1f}s', flush=True)
    return im


def ink_outline(im, r):
    """Dark outline around the silhouette (mobile-game look; matches the fighters' ink lines)."""
    a = im.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    grown = a.filter(ImageFilter.MaxFilter(2 * r + 1)).filter(ImageFilter.GaussianBlur(0.8))
    ink = Image.new('RGBA', im.size, (*INK, 0))
    ink.putalpha(grown)
    ink.alpha_composite(im)
    return ink


def rounded_mask(size, box, r):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box, r, fill=255)
    return m


def fit_image(src, w, h, mode='contain', anchor=(0.5, 1.0)):
    """Scale an image into w x h (contain/cover) and place it by anchor (0..1) - returns a w x h RGBA."""
    im = src.convert('RGBA')
    sx, sy = w / im.width, h / im.height
    s = min(sx, sy) if mode == 'contain' else max(sx, sy)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.alpha_composite(im, (round((w - im.width) * anchor[0]), round((h - im.height) * anchor[1])))
    return out


def drop_shadow(im, dx=0, dy=8, blur=10, alpha=0.55):
    a = im.getchannel('A').point(lambda v: int(v * alpha))
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    sh.putalpha(a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.alpha_composite(sh, (dx, dy))
    out.alpha_composite(im)
    return out


def inner_shadow(window_mask, size=18, alpha=150):
    """Shadow just inside a window's edge (art sits *inside* the frame)."""
    inv = ImageChops.invert(window_mask).filter(ImageFilter.GaussianBlur(size))
    sh = Image.new('RGBA', window_mask.size, (0, 0, 0, 0))
    sh.putalpha(ImageChops.multiply(inv, window_mask).point(lambda v: min(255, int(v * alpha / 255 * 1.6))))
    return sh


def save_webp(im, path, w_px, h_px, scale=2):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im = im.resize((w_px * scale, h_px * scale), Image.LANCZOS) if im.size != (w_px * scale, h_px * scale) else im
    im.save(path, 'WEBP', quality=90, method=6)
    return path
