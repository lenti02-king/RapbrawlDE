# Design v3 (S13b): painted-flat textures for the 3D stadium (PIL) - ring canvas, apron print, graffiti banners,
# chain-link mesh, skyline windows, LED wall. Original art only (our own logo text, crown motif, German slogans).
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = os.path.join(ROOT, '.cache', 'ui3', 'tex')
os.makedirs(TEX, exist_ok=True)
FS = os.path.join(ROOT, 'node_modules', '@fontsource')


def font(name, size):
    p = {
        'paint': f'{FS}/rubik-wet-paint/files/rubik-wet-paint-latin-400-normal.woff',
        'marker': f'{FS}/permanent-marker/files/permanent-marker-latin-400-normal.woff',
        'bangers': f'{FS}/bangers/files/bangers-latin-400-normal.woff',
        'lilita': f'{FS}/lilita-one/files/lilita-one-latin-400-normal.woff',
        'anton': os.path.join(ROOT, 'tools', 'arena', 'fonts', 'Anton_400Regular.ttf'),
    }[name]
    return ImageFont.truetype(p, size)


CROWN = [(-0.42, -0.22), (0.42, -0.22), (0.5, 0.28), (0.22, 0.04), (0.0, 0.38), (-0.22, 0.04), (-0.5, 0.28)]


def crown_poly(cx, cy, s):
    return [(cx + x * s, cy - y * s) for x, y in CROWN]


def ring_canvas(path=None):
    path = path or os.path.join(TEX, 'ring_canvas.png')
    W = 2048
    im = Image.new('RGB', (W, W), (28, 14, 52))
    d = ImageDraw.Draw(im)
    # radial vignette
    g = Image.new('L', (W, W), 0)
    gd = ImageDraw.Draw(g)
    for r in range(W // 2, 0, -8):
        gd.ellipse((W / 2 - r * 1.4, W / 2 - r * 1.4, W / 2 + r * 1.4, W / 2 + r * 1.4), fill=int(255 * (1 - r / (W / 2)) ** 0.7))
    lit = Image.new('RGB', (W, W), (70, 34, 120))
    im = Image.composite(lit, im, g)
    d = ImageDraw.Draw(im)
    # gold border bands
    for inset, wdt, col in ((40, 46, (240, 178, 40)), (110, 10, (240, 178, 40)), (24, 8, (20, 8, 30))):
        d.rectangle((inset, inset, W - inset, W - inset), outline=col, width=wdt)
    # centre emblem: ring + crown + lettering
    cx, cy = W / 2, W / 2
    for r, wdt, col in ((520, 26, (240, 178, 40)), (470, 8, (240, 178, 40))):
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=col, width=wdt)
    d.polygon(crown_poly(cx, cy - 60, 520), fill=(240, 178, 40))
    d.polygon(crown_poly(cx, cy - 60, 430), fill=(70, 34, 120))
    f = font('anton', 170)
    t = 'RAP BRAWL'
    w = d.textlength(t, font=f)
    d.text((cx - w / 2, cy + 150), t, font=f, fill=(240, 178, 40))
    # canvas scuffs
    rnd = random.Random(3)
    for _ in range(140):
        x, y = rnd.uniform(0, W), rnd.uniform(0, W)
        r = rnd.uniform(10, 60)
        d.ellipse((x - r, y - r * 0.4, x + r, y + r * 0.4), fill=None, outline=(50, 26, 86), width=2)
    im = im.filter(ImageFilter.GaussianBlur(1.2))
    im.save(path)
    return path


def apron(path=None, color=(16, 10, 28)):
    path = path or os.path.join(TEX, 'apron.png')
    W, H = 4096, 512
    im = Image.new('RGB', (W, H), color)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 26), fill=(240, 178, 40))
    d.rectangle((0, H - 30, W, H), fill=(240, 178, 40))
    f = font('anton', 300)
    x = 60
    i = 0
    while x < W:
        t = 'RAP BRAWL'
        w = d.textlength(t, font=f)
        d.text((x, 70), t, font=f, fill=(255, 196, 48))
        x += w + 90
        d.polygon(crown_poly(x - 45, 260, 150), fill=(255, 64, 120) if i % 2 else (64, 160, 255))
        x += 90
        i += 1
    im.save(path)
    return path


def banner(lines, path, colors=((255, 255, 255), (255, 60, 90), (255, 255, 255)), bg=(18, 14, 30), crown=(255, 200, 50), W=900, H=1800):
    """Hanging graffiti banner: dark cloth, sprayed lettering (Rubik Wet Paint), a crown tag."""
    im = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(im)
    rnd = random.Random(len(path))
    # cloth grime and spray dust
    for _ in range(900):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        r = rnd.uniform(1, 5)
        c = rnd.choice([(40, 34, 60), (28, 22, 44), (60, 40, 90)])
        d.ellipse((x - r, y - r, x + r, y + r), fill=c)
    d.rectangle((0, 0, W - 1, H - 1), outline=(240, 178, 40), width=18)
    d.polygon(crown_poly(W / 2, 230, 330), fill=crown)
    d.polygon(crown_poly(W / 2, 230, 250), fill=bg)
    y = 470
    for i, ln in enumerate(lines):
        size = 330
        f = font('paint', size)
        w = d.textlength(ln, font=f)
        if w > W * 0.84:
            size = int(size * W * 0.84 / w)
            f = font('paint', size)
            w = d.textlength(ln, font=f)
        sh = Image.new('L', (W, H), 0)
        ImageDraw.Draw(sh).text(((W - w) / 2 + 10, y + 12), ln, font=f, fill=200)
        im.paste((0, 0, 0), mask=sh.filter(ImageFilter.GaussianBlur(4)))
        d.text(((W - w) / 2, y), ln, font=f, fill=colors[i % len(colors)])
        y += size * 1.02
    im.save(path)
    return path


def chainlink(path=None, W=512, cell=64, wire=5):
    path = path or os.path.join(TEX, 'chainlink.png')
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for k in range(-W, 2 * W, cell):
        d.line((k, 0, k + W, W), fill=(200, 205, 220, 255), width=wire)
        d.line((k, W, k + W, 0), fill=(200, 205, 220, 255), width=wire)
    im.save(path)
    return path


def windows(path=None, W=1024, H=2048, seed=1):
    """Skyscraper facade: dark glass with lit windows (warm/cool), some floors off."""
    path = path or os.path.join(TEX, f'windows{seed}.png')
    W, H = W, H
    rnd = random.Random(seed)
    im = Image.new('RGB', (W, H), (10, 10, 24))
    d = ImageDraw.Draw(im)
    cw, ch = 40, 56
    for y in range(20, H - 20, ch):
        off = rnd.random() < 0.15
        for x in range(16, W - 16, cw):
            if off or rnd.random() < 0.62:
                c = (22, 22, 46)
            else:
                c = rnd.choice([(255, 210, 140), (255, 190, 110), (150, 200, 255), (255, 240, 200), (190, 140, 255)])
            d.rectangle((x, y, x + cw - 14, y + ch - 20), fill=c)
    im.save(path)
    return path


def led_wall(path=None, W=2048, H=900):
    path = path or os.path.join(TEX, 'led.png')
    im = Image.new('RGB', (W, H), (24, 6, 46))
    d = ImageDraw.Draw(im)
    for i in range(0, W, 6):
        d.line((i, 0, i, H), fill=(18, 4, 34))
    for j in range(0, H, 6):
        d.line((0, j, W, j), fill=(18, 4, 34))
    # big crown burst
    cx, cy = W / 2, H / 2 + 40
    for k in range(24):
        a = 2 * math.pi * k / 24
        d.polygon([(cx, cy), (cx + 1400 * math.cos(a - 0.06), cy + 1400 * math.sin(a - 0.06)), (cx + 1400 * math.cos(a + 0.06), cy + 1400 * math.sin(a + 0.06))], fill=(70, 14, 110) if k % 2 else (48, 10, 84))
    d.polygon(crown_poly(cx, cy, 560), fill=(255, 196, 48))
    d.polygon(crown_poly(cx, cy, 470), fill=(48, 10, 84))
    im.save(path)
    return path


def burst(path, c1, c2, W=512, H=512, rays=18):
    """Radial burst card backdrop (tile art windows)."""
    im = Image.new('RGB', (W, H), c2)
    d = ImageDraw.Draw(im)
    cx, cy = W / 2, H * 0.62
    for k in range(rays):
        a = 2 * math.pi * k / rays
        d.polygon([(cx, cy), (cx + 2 * W * math.cos(a - 0.09), cy + 2 * W * math.sin(a - 0.09)), (cx + 2 * W * math.cos(a + 0.09), cy + 2 * W * math.sin(a + 0.09))], fill=c1)
    g = Image.new('L', (W, H), 0)
    ImageDraw.Draw(g).ellipse((cx - W * 0.5, cy - W * 0.5, cx + W * 0.5, cy + W * 0.5), fill=255)
    g = g.filter(ImageFilter.GaussianBlur(W * 0.18))
    hi = Image.new('RGB', (W, H), tuple(min(255, int(v * 1.25 + 30)) for v in c1))
    im = Image.composite(hi, im, g)
    im.save(path)
    return path


if __name__ == '__main__':
    print(ring_canvas(), apron(), chainlink(), windows(), led_wall())
    print(banner(['WORTE', 'WIE', 'FÄUSTE'], os.path.join(TEX, 'banner_l.png')))
    print(banner(['BARS', 'TREFFEN', 'HÄRTER'], os.path.join(TEX, 'banner_r.png'), colors=((255, 255, 255), (255, 60, 90), (255, 60, 90))))
