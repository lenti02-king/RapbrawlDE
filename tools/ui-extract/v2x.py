"""Design v2 (D42): shared extraction for the PO's second master set (tools/ui-extract/ref/v2/*, 1672x941).

Same idea as D38 (uix.py): the PO's pixels are the art. Per screen a declarative spec lists the UI elements (cut as
sprites with the baked English text removed; the game sets German text natively at the same boxes), the areas
removed from the background (UI, placeholder silhouettes, the illustrated hero: the game shows the real 3D fighters
there) and optional foreground pieces (depth layer in front of the fighters).

Output per screen (public/, served as separate files so the Artifact bundle stays small):
  public/assets/ui2/<screen>/plate_l|c|r.webp   clean background, outpainted to ~2.6:1, split in three tiles
                                                 (each <= 2 MP: iOS Safari mis-sizes larger images, D42)
  public/assets/ui2/<screen>/<id>.webp           element sprites (RGBA, glow matted against the plate)
  src/ui/v2/art/<screen>.ts                      generated table: sprite boxes, text boxes, light spots

Element spec keys (reference px of the 1672x941 master):
  box       (x0,y0,x1,y1) region of the element (GrabCut runs inside, with `pad`)
  core      list of rects that are surely part of the element (default: box eroded by `inset`)
  shape     'grab' (default) | 'rect' (the box itself) | 'poly' (+ pts)
  text      {name: zone} baked text removed from the sprite (zone boxes are exported for native text)
  marks     {name: zone} positions exported without removing anything (icons, slots, bars)
  clear     list of zones inpainted inside the sprite (e.g. placeholder silhouettes on cards)
  slot      list of polygons made transparent (a window the game fills from behind)
  bars      list of (track_box, clean_strip) progress tracks rebuilt empty (the fill becomes a part sprite)
  ring      glow ring width for the matte (default 12)
  keep_bg   True: element stays in the plate as well (only exported as a sprite, not removed)
"""
from __future__ import annotations

import json
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402

ROOT = uix.ROOT
REF_DIR = 'tools/ui-extract/ref/v2'
PUB = os.path.join(ROOT, 'public/assets/ui2')
TS_DIR = os.path.join(ROOT, 'src/ui/v2/art')
DBG = os.path.join(ROOT, '.cache/ui2')
SIDE = 400  # outpainted wings: 1672 + 2*400 = 2472 px wide at 941 -> 2.63:1


def ident(s: str) -> str:
    return ''.join(ch if ch.isalnum() else '_' for ch in s)


def element_mask(img, e):
    shape = e.get('shape', 'grab')
    if shape == 'rect':
        return uix.rect_mask(img.shape, e['box'])
    if shape == 'poly':
        return uix.poly_mask(img.shape, e['pts'])
    fg = np.zeros(img.shape[:2], np.uint8)
    for r in e.get('core', [e['box']]):
        fg |= uix.erode(uix.rect_mask(img.shape, r), e.get('inset', 10))
    bgm = None
    for r in e.get('cut', []):  # e.g. a notification badge on the corner: not part of the panel
        bgm = (bgm if bgm is not None else np.zeros(img.shape[:2], np.uint8)) | uix.rect_mask(img.shape, r)
    m = uix.grabcut(img, e['box'], pad=e.get('pad', 14), fg=fg, bg=bgm) | fg
    if bgm is not None:
        m &= ~bgm
    if e.get('hull'):  # convex panels: the hull restores corners hidden under a badge
        cnts, _ = cv2.findContours(uix.largest(m), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        m = np.zeros_like(m)
        cv2.fillPoly(m, [cv2.convexHull(np.vstack(cnts))], 255)
    return m


def fit_zone(img, z, grow=16, thr=34):
    """Grow a hand-placed text zone to the full extent of the glyphs it touches (no letter ends left behind)."""
    H, W = img.shape[:2]
    big = (max(0, z[0] - grow), z[1], min(W, z[2] + grow), z[3])  # rows of the zone only (icons above stay)
    g = uix.text_mask(img, big, thr=thr, dil=1, k=31)
    n, lab, st, _ = cv2.connectedComponentsWithStats(g)
    x0, y0, x1, y1 = z
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a < 6 or x + w < z[0] or x > z[2]:
            continue
        if w > (z[2] - z[0]) * 1.6 + 2 * grow:  # a frame line, not a glyph
            continue
        x0, x1 = min(x0, x), max(x1, x + w)
    return (x0, y0, x1, y1)


def text_mask_of(img, e, emask):
    out = np.zeros(img.shape[:2], np.uint8)
    for z in e.get('text', {}).values():  # whole zone (labels sit on simple bars; a glyph mask leaves ghost letters)
        if e.get('glyph'):
            out |= uix.text_mask(img, z, thr=e.get('thr', 30), dil=e.get('dil', 3), k=31)
        else:
            f = fit_zone(img, z) if e.get('fit', True) else z
            out |= uix.rect_mask(img.shape, (f[0] - 3, f[1] - 3, f[2] + 3, f[3] + 3))
    for z in e.get('clear', []):
        out |= uix.rect_mask(img.shape, z)
    for p in e.get('clear_poly', []):
        out |= uix.poly_mask(img.shape, p)
    for z in e.get('protect', []):
        out[z[1]:z[3], z[0]:z[2]] = 0
    return out & uix.dilate(emask, 2)


def lights(plate, y_max=560, max_n=28, exclude=None):
    """Bright light sources in the plate (stage lamps, neon): centre, radius, colour -> runtime glow/flicker."""
    hsv = cv2.cvtColor(plate, cv2.COLOR_BGR2HSV)
    v = hsv[..., 2].astype(np.float32)
    blur = cv2.GaussianBlur(v, (0, 0), 3)
    m = ((blur > 228) & (np.arange(plate.shape[0])[:, None] < y_max)).astype(np.uint8)
    if exclude is not None:
        m &= (exclude == 0).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(m)
    out = []
    for i in range(1, n):
        a = st[i, cv2.CC_STAT_AREA]
        if a < 12 or a > 2500:
            continue
        cx, cy = cen[i]
        r = float(np.sqrt(a / np.pi))
        ring = plate[max(0, int(cy - 3 * r)):int(cy + 3 * r) + 1, max(0, int(cx - 3 * r)):int(cx + 3 * r) + 1].reshape(-1, 3).astype(np.float32)
        col = ring.mean(axis=0)[::-1]  # BGR -> RGB
        col = col / max(1, col.max()) * 255
        out.append((a, [int(cx), int(cy), round(r, 1), [int(c) for c in col]]))
    out.sort(key=lambda t: -t[0])
    return [o[1] for o in out[:max_n]]


def split_plate(wide, out_dir, side, W):
    """Three tiles (left wing, master, right wing) with a 4 px overlap so no seam shows at fractional positions."""
    H, WW = wide.shape[:2]
    tiles = {'l': (0, side + 4), 'c': (side - 4, side + W + 4), 'r': (side + W - 4, WW)}
    res = {}
    for k, (x0, x1) in tiles.items():
        uix.save_rgba(os.path.join(out_dir, f'plate_{k}.webp'), wide[:, x0:x1], None, quality=86 if k == 'c' else 80)
        res[k] = [x0 - side, 0, x1 - x0, H]
    return res


def wings_lama(screen, plate, bg, masks, elements, side=SIDE, bars=None):
    """Wide-screen wings: the scene outpainted by LaMa from a UI-free copy of the plate (UI near the edges would
    otherwise be continued as smeared panels), darkened toward the outer screen edge. `bars`: (y0, y1) row bands of
    full-width UI (a nav bar) - there the bar's own edge columns are stretched outward instead."""
    H, W = plate.shape[:2]
    cache = os.path.join(DBG, f'{screen}_wings.png')
    ui = np.zeros((H, W), np.uint8)
    for k, m in masks.items():
        ui |= uix.dilate(m, 10)
    edge = np.zeros((H, W), np.uint8)
    edge[:, :side // 2] = 255
    edge[:, W - side // 2:] = 255
    if os.path.exists(cache) and os.environ.get('REUSE_BG'):
        wide = cv2.imread(cache)
    else:
        clean = uix.inpaint(bg, ui & edge, max_side=1024, ctx=0.4) if (ui & edge).any() else bg
        wide = uix.extend_plate(clean, os.path.join(DBG, f'{screen}_wings_raw.png'), side=side, top=0)
        cv2.imwrite(cache, wide)
    out = wide.copy()
    out[:, side:side + W] = plate
    for y0, y1 in bars or []:
        out[y0:y1, :side] = np.repeat(plate[y0:y1, :6].mean(axis=1, keepdims=True), side, axis=1).astype(np.uint8)
        out[y0:y1, side + W:] = np.repeat(plate[y0:y1, W - 6:].mean(axis=1, keepdims=True), side, axis=1).astype(np.uint8)
    t = np.linspace(0.0, 1.0, side, dtype=np.float32)  # 0 at the screen edge -> 1 at the master's edge
    k = (0.35 + 0.65 * t ** 0.8)[None, :, None]
    out[:, :side] = (out[:, :side].astype(np.float32) * k).astype(np.uint8)
    out[:, side + W:] = (out[:, side + W:].astype(np.float32) * k[:, ::-1]).astype(np.uint8)
    return out


def grab_poly(img, poly, grow=6, iters=5):
    """Precise mask of a figure inside a polygon (outside = background), plus a few px of its rim glow."""
    H, W = img.shape[:2]
    m = np.full((H, W), cv2.GC_BGD, np.uint8)
    m[uix.poly_mask(img.shape, poly) > 0] = cv2.GC_PR_FGD
    b = np.zeros((1, 65), np.float64)
    f = np.zeros((1, 65), np.float64)
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    x0, y0, x1, y1 = max(0, min(xs) - 10), max(0, min(ys) - 10), min(W, max(xs) + 10), min(H, max(ys) + 10)
    sub = m[y0:y1, x0:x1].copy()
    cv2.grabCut(img[y0:y1, x0:x1], sub, None, b, f, iters, cv2.GC_INIT_WITH_MASK)
    out = np.zeros((H, W), np.uint8)
    out[y0:y1, x0:x1] = np.where((sub == 1) | (sub == 3), 255, 0)
    out = uix.fill_holes(uix.largest(out))
    return uix.dilate(out, grow)


def run(screen: str, ref: str, elements: dict, remove: list | None = None, remove_poly: list | None = None,
        figures: list | None = None, grabs: list | None = None, parts: dict | None = None, front: dict | None = None, extra: dict | None = None,
        logo: bool = False, light_ymax=560, plate_fix=None, no_lights: list | None = None, wing_bars: list | None = None):
    """Plate = the master with only what changes removed (baked text, badges, bar fills, placeholder figures); UI
    stays glued to the plate, so under every element lie its own pixels (sprites blend perfectly). Buttons get a
    darkened 'socket' under them in the plate (visible only while pressed)."""
    os.makedirs(DBG, exist_ok=True)
    out_dir = os.path.join(PUB, screen)
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        os.remove(os.path.join(out_dir, f))
    img = uix.load(os.path.join(REF_DIR, ref))
    H, W = img.shape[:2]

    masks = {k: element_mask(img, e) for k, e in elements.items()}
    hole = np.zeros((H, W), np.uint8)
    for k, e in elements.items():
        hole |= text_mask_of(img, e, masks[k])
    for r in remove or []:
        hole |= uix.rect_mask(img.shape, r)
    for p in remove_poly or []:
        hole |= uix.poly_mask(img.shape, p)
    for b in grabs or []:  # e.g. the baked logo (the game draws the PO's clean logo file there)
        hole |= uix.dilate(uix.grabcut(img, b, pad=6), 5)
    fig_hole = np.zeros((H, W), np.uint8)
    src = img.copy()
    for fg in figures or []:
        fm = grab_poly(img, fg['poly'], grow=fg.get('grow', 6))
        for (bx0, by0, bx1, by1), cx in fg.get('mirror', []):  # symmetric art (a belt) behind the figure
            sub = fm[by0:by1, bx0:bx1] > 0
            ys, xs = np.nonzero(sub)
            xs2 = 2 * cx - (xs + bx0)
            ok = (xs2 >= 0) & (xs2 < W) & (fm[ys + by0, np.clip(xs2, 0, W - 1)] == 0)
            src[ys[ok] + by0, xs[ok] + bx0] = img[ys[ok] + by0, xs2[ok]]
            done = np.zeros_like(fm)
            done[ys[ok] + by0, xs[ok] + bx0] = 255
            fm &= ~uix.erode(done, 2)  # the mirrored part is final; its border is blended by LaMa below
            hole |= done & ~uix.erode(done, 2)
        if fg.get('exact'):  # low-contrast figures (dark red on a red banner): the polygon itself
            fm = uix.dilate(uix.poly_mask(img.shape, fg['poly']), 2)
        if fg.get('fill') == 'lama':  # non-banded backgrounds (banners): LaMa at full resolution
            hole |= fm
            continue
        for r in fg.get('protect', []):  # e.g. the logo behind the hero's hair: LaMa rebuilds it, no band fill
            pm = uix.rect_mask(img.shape, r)
            hole |= fm & pm
            fm &= ~pm
        fig_hole |= fm
    for k, e in elements.items():  # figures behind UI: the UI stays
        if e.get('over_figure', True):
            fig_hole &= ~uix.dilate(masks[k], 1)
    for k, e in elements.items():
        for outer, strip in e.get('bars', []):
            src = uix.rebuild_bar(src, outer, strip, cap=e.get('cap', 6))
    dbg = img.copy()
    for k, m in masks.items():
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cv2.drawContours(dbg, cnts, -1, (0, 255, 0), 1)
    cnts, _ = cv2.findContours(hole | fig_hole, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(dbg, cnts, -1, (255, 0, 255), 1)
    cv2.imwrite(os.path.join(DBG, f'{screen}_masks.png'), dbg)

    bg_path = os.path.join(DBG, f'{screen}_bg.png')
    if os.path.exists(bg_path) and os.environ.get('REUSE_BG'):
        bg = cv2.imread(bg_path)
    else:
        if fig_hole.any():
            src = band_fill(src, fig_hole, avoid=[a for fg in figures for a in fg.get('avoid', [])])
        flat = np.zeros((H, W), np.uint8)
        for k, e in elements.items():  # smooth faces (a yellow button): each row takes the colour of a clean strip
            if e.get('flat'):
                fm = text_mask_of(img, e, masks[k])
                flat |= fm
                sx0, sx1 = e['flat']
                col = cv2.GaussianBlur(src[:, sx0:sx1].astype(np.float32).mean(axis=1, keepdims=True), (1, 0), sigmaX=0.1, sigmaY=2)
                sm = np.repeat(col, W, axis=1)
                fa = (cv2.GaussianBlur(fm, (0, 0), 2.5).astype(np.float32) / 255.0)[..., None]
                src = (src * (1 - fa) + sm * fa).astype(np.uint8)
        smooth = np.zeros((H, W), np.uint8)
        for k, e in elements.items():  # dark grungy plates: smooth fill + grain (LaMa hallucinates letter ghosts there)
            for n in e.get('smooth', []):
                z = e['text'][n]
                f = fit_zone(img, z) if e.get('fit', True) else z
                smooth |= uix.rect_mask(img.shape, (f[0] - 4, f[1] - 4, f[2] + 4, f[3] + 4)) & uix.dilate(masks[k], 2)
        if smooth.any():
            # base: the plate's dark ground (low percentile of the ring around each hole), then fine grain
            ring = uix.dilate(smooth, 12) & ~uix.dilate(smooth, 3)
            n_, lab_ = cv2.connectedComponents(smooth)
            sm = src.copy()
            for i in range(1, n_):
                comp = (lab_ == i).astype(np.uint8) * 255
                rg = uix.dilate(comp, 12) & ~uix.dilate(comp, 3)
                px = src[rg > 0].reshape(-1, 3).astype(np.float32)
                lum = px.mean(axis=1)
                base = px[lum <= np.percentile(lum, 35)].mean(axis=0)
                sm[comp > 0] = base.astype(np.uint8)
            hp = src.astype(np.float32) - cv2.GaussianBlur(src, (0, 0), 3).astype(np.float32)
            sd = float(np.median(np.abs(hp[ring > 0]))) * 1.4 if ring.any() else 4.0
            rng = np.random.default_rng(3)
            noise = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 0.7)
            noise = noise / max(1e-3, noise.std()) * min(sd, 9.0)
            sm = np.clip(sm.astype(np.float32) + noise[..., None], 0, 255).astype(np.uint8)
            sa = (cv2.GaussianBlur(smooth, (0, 0), 2).astype(np.float32) / 255.0)[..., None]
            src = (src * (1 - sa) + sm * sa).astype(np.uint8)
        scan = np.zeros((H, W), np.uint8)
        for k, e in elements.items():  # text on banded panels (D47): each row interpolated between its clean ends
            for n in e.get('scan', []):
                z = e['text'][n]
                scan |= uix.rect_mask(img.shape, (z[0] - 3, z[1] - 3, z[2] + 3, z[3] + 3))
        if scan.any():
            src = uix.fill_scanlines(src, scan)
        bg = uix.inpaint(src, hole & ~fig_hole & ~flat & ~smooth & ~scan, max_side=1024, ctx=0.45)
        if plate_fix:
            bg = plate_fix(img, bg)
        cv2.imwrite(bg_path, bg)

    sprites = {}
    texts = {}
    plate = bg.copy()
    for k, e in elements.items():
        core = cv2.GaussianBlur(masks[k], (0, 0), 0.8)
        # rect regions only mark text zones (their pixels stay in the plate); buttons/panels become sprites
        if e.get('shape') != 'rect' or e.get('sprite'):
            sp = uix.crop_sprite(k, bg, core, out_dir, '', pad=1)
            sprites[k] = [sp.x, sp.y, sp.w, sp.h]
        if e.get('socket', True):  # pressed button: a dark hole in the plate
            a = (core.astype(np.float32) / 255.0)[..., None] * 0.7
            plate = (plate.astype(np.float32) * (1 - a) + plate.astype(np.float32) * 0.18 * a).astype(np.uint8)
        t = {n: list(z) for n, z in e.get('text', {}).items()}
        t.update({n: list(z) for n, z in e.get('marks', {}).items()})
        if t:
            texts[k] = t
    cv2.imwrite(os.path.join(DBG, f'{screen}_plate.png'), plate)
    wide = wings_lama(screen, plate, bg, masks, elements, bars=wing_bars)
    cv2.imwrite(os.path.join(DBG, f'{screen}_wide.jpg'), wide)
    tiles = split_plate(wide, out_dir, SIDE, W)

    # small dynamic pieces cut from the untouched master (bar fills, badges, icons)
    for k, p in (parts or {}).items():
        x0, y0, x1, y1 = p['box']
        c = img[y0:y1, x0:x1].copy()
        if p.get('key') == 'bright':
            hsv = cv2.cvtColor(c, cv2.COLOR_BGR2HSV)
            a = np.clip((hsv[..., 2].astype(np.float32) - p.get('lo', 70)) * 3.0, 0, 255)
            a = cv2.GaussianBlur(a, (0, 0), 0.6).astype(np.uint8)
        elif p.get('key') in ('grab', 'matte'):  # against the clean plate (glowing badge on the background)
            m = element_mask(img, {'box': p['box'], 'inset': p.get('inset', 4), 'pad': 4})
            rgb, af = uix.matte(img, bg, m, ring=p.get('ring', 6))
            c, a = rgb[y0:y1, x0:x1], af[y0:y1, x0:x1]
        else:
            a = None
        if p.get('text'):
            tm = uix.text_mask(img, p['text'], thr=40, dil=2)[y0:y1, x0:x1]
            c = cv2.inpaint(c, tm, 5, cv2.INPAINT_TELEA)
        uix.save_rgba(os.path.join(out_dir, f'{k}.webp'), c, a, quality=92)
        sprites[k] = [x0, y0, x1 - x0, y1 - y0]

    # foreground pieces (in front of the 3D fighters: depth)
    for k, f in (front or {}).items():
        m = np.zeros((H, W), np.uint8)
        for p in f.get('polys', []):
            m |= uix.poly_mask(img.shape, p)
        for r in f.get('rects', []):
            m |= uix.rect_mask(img.shape, r)
        if f.get('grab'):
            m = uix.grabcut(img, f['grab'], pad=8) & (m if m.any() else 255)
        a = cv2.GaussianBlur(m, (0, 0), f.get('feather', 2.0))
        sp = uix.crop_sprite(k, bg, a, out_dir, '', pad=0)
        sprites[k] = [sp.x, sp.y, sp.w, sp.h]

    if logo:  # the PO's clean logo file (same mark as in every master)
        lg = uix.load('tools/ui-extract/ref/logo.jpg')
        v = lg.max(axis=2)
        sil = uix.fill_holes(uix.largest(cv2.morphologyEx((v > 7).astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))))
        a = cv2.GaussianBlur(uix.erode(sil, 1), (0, 0), 0.9)
        ys, xs = np.nonzero(a > 3)
        lx0, ly0, lx1, ly1 = max(0, xs.min() - 2), max(0, ys.min() - 2), min(lg.shape[1], xs.max() + 3), min(lg.shape[0], ys.max() + 3)
        shared = os.path.join(PUB, 'shared')
        os.makedirs(shared, exist_ok=True)
        crop = lg[ly0:ly1, lx0:lx1]
        al = a[ly0:ly1, lx0:lx1]
        s = 900 / max(crop.shape[:2])  # ~2x the largest on-screen size
        if s < 1:
            crop = cv2.resize(crop, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
            al = cv2.resize(al, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        uix.save_rgba(os.path.join(shared, 'logo.webp'), crop, al, quality=90)

    ex = np.zeros((H, W), np.uint8)
    for m in masks.values():
        ex |= uix.dilate(m, 6)
    for r in no_lights or []:
        ex |= uix.rect_mask(img.shape, r)
    lt = lights(bg, y_max=light_ymax, exclude=ex)
    write_ts(screen, sprites, texts, tiles, lt, extra or {}, (W, H))
    total = sum(os.path.getsize(os.path.join(out_dir, f)) for f in os.listdir(out_dir))
    print(f'{screen}: {len(sprites)} sprites + plate, {total / 1e6:.2f} MB -> {out_dir}; {len(lt)} lights')
    return bg


def write_ts(screen, sprites, texts, tiles, lights_, extra, size):
    os.makedirs(TS_DIR, exist_ok=True)
    name = ident(screen).upper()
    L = [f'// GENERATED by tools/ui-extract/v2_{screen}.py - do not edit by hand (re-run the script instead).',
         '// Boxes are [x, y, w, h] in reference px of the 1672x941 master; files live in public/assets/ui2/.', '',
         f"export const {name}_DIR = 'assets/ui2/{screen}/';",
         f'export const {name}_SIZE = {json.dumps(list(size))} as const;',
         f'export const {name}_PLATE = {json.dumps(tiles)} as const;',
         f'export const {name}_ART = {{']
    for k, v in sprites.items():
        L.append(f'  {json.dumps(k)}: {json.dumps(v)},')
    L.append('} as const;')
    L.append(f'export const {name}_TEXT = {{')
    for k, v in texts.items():
        L.append(f'  {json.dumps(k)}: {json.dumps(v)},')
    L.append('} as const;')
    L.append(f'export const {name}_LIGHTS: [number, number, number, [number, number, number]][] = {json.dumps(lights_)};')
    for k, v in extra.items():
        L.append(f'export const {name}_{k.upper()} = {json.dumps(v)} as const;')
    L.append('')
    with open(os.path.join(TS_DIR, f'{screen}.ts'), 'w') as f:
        f.write('\n'.join(L))


def band_fill(img, hole, period=110, smooth=25, seam=10, avoid=None):
    """Fill a large figure-shaped hole in a horizontally banded scene (crowd stands, ring ropes, fence, floor): each
    row is continued from its own left and right neighbourhood by reflect-repeat (ropes and horizons stay straight),
    the two sides cross-fade in the middle; boundaries are smoothed over rows so the texture does not jitter. A thin
    LaMa pass then blends the seam along the silhouette. LaMa alone turns holes this big into mush."""
    H, W = img.shape[:2]
    out = img.astype(np.float32).copy()
    m = hole > 0
    rows = np.nonzero(m.any(axis=1))[0]
    if not len(rows):
        return img
    a = np.full(H, -1.0)
    b = np.full(H, -1.0)
    for y in rows:
        xs = np.nonzero(m[y])[0]
        a[y], b[y] = xs.min(), xs.max()
    # smoothed, outward-biased boundaries (sources must lie outside the hole)
    ar = a[rows].copy()
    br = b[rows].copy()
    k = max(1, smooth)
    for i in range(len(rows)):
        lo, hi = max(0, i - k), min(len(rows), i + k + 1)
        ar[i] = ar[lo:hi].min()
        br[i] = br[lo:hi].max()
    av = np.zeros((H, W), bool)
    for r in avoid or []:  # banners, posts, UI: never copied into the hole
        av[r[1]:r[3], r[0]:r[2]] = True
    for i, y in enumerate(rows):
        x0, x1 = int(ar[i]), int(br[i])
        lft = np.nonzero(av[y, :x0])[0]
        rgt = np.nonzero(av[y, x1 + 1:])[0]
        PL = max(12, min(period, x0 - 1, x0 - 1 - (lft.max() if len(lft) else -1)))
        PR = max(12, min(period, W - 2 - x1, (rgt.min() if len(rgt) else W) - 1))
        P = PL
        mid = (x0 + x1) / 2
        xs = np.arange(x0, x1 + 1)
        d = xs - x0
        kk = d % (2 * P)
        srcL = np.where(kk < P, x0 - 1 - kk, x0 - 2 * P + kk)
        d2 = x1 - xs
        kk2 = d2 % (2 * PR)
        srcR = np.where(kk2 < PR, x1 + 1 + kk2, x1 + 2 * PR - kk2)
        srcL = np.clip(srcL, 0, W - 1)
        srcR = np.clip(srcR, 0, W - 1)
        t = np.clip((xs - (mid - 30)) / 60.0, 0, 1)[:, None]
        row = img[y].astype(np.float32)
        fill = row[srcL] * (1 - t) + row[srcR] * t
        sel = m[y, x0:x1 + 1]
        out[y, x0:x1 + 1][sel] = fill[sel]
    out = out.astype(np.uint8)
    # a little vertical blur inside the hole hides row-to-row differences
    vb = cv2.GaussianBlur(out, (1, 0), sigmaX=0.1, sigmaY=1.6)
    mm = (cv2.GaussianBlur(hole, (0, 0), 2).astype(np.float32) / 255.0)[..., None]
    out = (out * (1 - mm) + vb * mm).astype(np.uint8)
    edge = uix.dilate(hole, seam) & ~uix.erode(hole, seam)
    return uix.inpaint(out, edge, max_side=1024, ctx=0.25)


def match_logo(img, region, scales=None):
    """Where the PO's clean logo sits in a master: multi-scale template match (edges) inside `region`.
    Returns (x, y, w, h) of the logo file's crop in reference px."""
    lg = uix.load('tools/ui-extract/ref/logo.jpg')
    v = lg.max(axis=2)
    sil = uix.fill_holes(uix.largest(cv2.morphologyEx((v > 7).astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))))
    ys, xs = np.nonzero(sil)
    lg = lg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    x0, y0, x1, y1 = region
    roi = img[y0:y1, x0:x1]
    eg = lambda a: cv2.Canny(cv2.GaussianBlur(cv2.cvtColor(a, cv2.COLOR_BGR2GRAY), (3, 3), 0), 40, 120)
    er = cv2.GaussianBlur(eg(roi).astype(np.float32), (0, 0), 1.2)
    best = (-1, None)
    for s in scales or np.linspace(0.3, 1.2, 46):
        w = int(lg.shape[1] * s * (x1 - x0) / lg.shape[1])
        h = int(w * lg.shape[0] / lg.shape[1])
        if w > roi.shape[1] or h > roi.shape[0] or w < 40:
            continue
        t = cv2.GaussianBlur(eg(cv2.resize(lg, (w, h), interpolation=cv2.INTER_AREA)).astype(np.float32), (0, 0), 1.2)
        r = cv2.matchTemplate(er, t, cv2.TM_CCORR_NORMED)
        _, mv, _, ml = cv2.minMaxLoc(r)
        if mv > best[0]:
            best = (mv, (x0 + ml[0], y0 + ml[1], w, h))
    print('logo match', round(best[0], 3), best[1])
    return best[1]
