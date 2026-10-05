"""In-game HUD: cut the PO master (ref/hud.webp, 2000x1125) into sprites.

The master was delivered on a FAKE transparency checkerboard (baked grey/white squares). UI pixels are saturated or
dark, the checkerboard is light grey: elements are keyed by that (holes filled, 1 px eroded, feathered). The soft outer
glows blended into the checkerboard cannot be recovered; the game adds them back natively (CSS drop-shadow in the
sampled colour).

Output: src/ui/img/hud/*.webp + src/ui/menu/hudArt.ts. Run: python3 tools/ui-extract/hud.py
Dynamic parts become separate sprites: health/pill/hype fills (the game clips them to the value), empty tracks are
rebuilt from the dark channel; names, numbers, timer, costs, keys, labels are removed and set natively.
"""
from __future__ import annotations

import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import uix  # noqa: E402

REF = 'tools/ui-extract/ref/hud.webp'
OUT = os.path.join(uix.ROOT, 'src/ui/img/hud')
TS = os.path.join(uix.ROOT, 'src/ui/menu/hudArt.ts')
DBG = os.path.join(uix.ROOT, '.cache/ui')

SIDES = {
    'p1': dict(box=(22, 32, 882, 250), name=(206, 56, 432, 106), num=(212, 118, 318, 168), chan=(346, 118, 872, 170),
               portrait=(40, 58, 200, 214), pills=[(196, 190, 396, 242), (400, 190, 602, 242), (616, 190, 826, 242)]),
    'p2': dict(box=(1118, 32, 1978, 250), name=(1560, 56, 1792, 106), num=(1676, 118, 1790, 168), chan=(1198, 118, 1668, 170), chan_start=1136,
               portrait=(1800, 58, 1962, 214), pills=[(1170, 190, 1378, 242), (1384, 190, 1598, 242), (1604, 190, 1806, 242)]),
}
TIMER = (884, 48, 1118, 238)
TIMER_TEXT = (948, 128, 1054, 196)
PAUSE = (948, 226, 1052, 302)
CARDS = [(608, 696, 866, 990), (868, 696, 1126, 990), (1128, 696, 1398, 990)]
HYPE = (580, 984, 1420, 1094)
HYPE_LABEL = (1268, 1004, 1392, 1066)
INFO = (28, 272, 566, 550)
INFO_TEXT = [(60, 296, 268, 520), (296, 296, 540, 520)]


def ui_mask(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m = ((hsv[..., 1] > 55) | (hsv[..., 2] < 165)).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))


def element(ui, box, erode=1):
    m = ui & uix.rect_mask(ui.shape, box)
    n, lb, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 150:
            keep[lb == i] = 255
    keep = uix.fill_holes(keep)
    return uix.erode(keep, erode) if erode else keep


def alpha_of(m):
    return cv2.GaussianBlur(m, (0, 0), 0.8)


def channel(img, box):
    """Fill pixels (bright + saturated) and the dark track profile inside a bar channel."""
    x0, y0, x1, y1 = box
    hsv = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2HSV)
    bright = (hsv[..., 1] > 90) & (hsv[..., 2] > 140)
    cols = bright.mean(axis=0) > 0.35
    xs = np.nonzero(cols)[0]
    fx0, fx1 = (int(xs.min()), int(xs.max()) + 1) if len(xs) else (0, 0)
    dark = hsv[..., 2].mean(axis=0) < 95
    dcols = np.nonzero(dark & ~cols)[0]
    return bright, (x0 + fx0, x0 + fx1), (x0 + dcols if len(dcols) else None)


def rebuild_track(img, box, dark_ref=None):
    """Replace the fill inside a channel with the dark empty track (mean dark column, per row)."""
    x0, y0, x1, y1 = box
    bright, (fx0, fx1), dcols = channel(img, box)
    out = img.copy()
    if dcols is not None and len(dcols) >= 3:
        prof = img[y0:y1, dcols].astype(np.float32).mean(axis=1)
    elif dark_ref is not None:
        prof = cv2.resize(dark_ref[:, None, :].astype(np.float32), (1, y1 - y0))[:, 0, :]
    else:
        prof = np.tile(np.array([40, 26, 18], np.float32), (y1 - y0, 1))
    m = np.zeros(img.shape[:2], np.uint8)
    b = np.zeros((y1 - y0, x1 - x0), np.uint8)
    b[:, fx0 - x0:fx1 - x0] = 255
    b &= uix.dilate(bright.astype(np.uint8) * 255, 3) | b
    m[y0:y1, x0:x1] = b
    # keep the channel's rounded border: only replace where the column is inside the bright rows' extent
    rows = np.nonzero(bright.any(axis=1))[0]
    if len(rows):
        m[:y0 + rows.min() - 1] = 0
        m[y0 + rows.max() + 2:] = 0
    fill = np.repeat(prof[:, None, :], img.shape[1], axis=1).astype(np.uint8)
    full = img.copy()
    full[y0:y1] = fill
    a = cv2.GaussianBlur(m, (0, 0), 0.7).astype(np.float32)[..., None] / 255.0
    out = (img * (1 - a) + full * a).astype(np.uint8)
    return out, (fx0, fx1), prof


def fill_strip(img, box, span, length, anchor_right=False):
    """The bright fill of a channel as a strip `length` px long (periodic middle part repeated), alpha from brightness."""
    x0, y0, x1, y1 = box
    fx0, fx1 = span
    strip = img[y0:y1, fx0:fx1].copy()
    hsv = cv2.cvtColor(strip, cv2.COLOR_BGR2HSV)
    a = np.clip((hsv[..., 2].astype(np.float32) - 60) * 3, 0, 255)
    a = np.where(hsv[..., 1] > 50, a, a * 0.6)
    w = strip.shape[1]
    if length > w:
        # repeat the middle third (contains whole segments) until the strip is long enough
        m0, m1 = w // 3, 2 * w // 3
        tile, ta = strip[:, m0:m1], a[:, m0:m1]
        parts, aparts = [strip[:, :m1]], [a[:, :m1]]
        cur = m1
        while cur + (w - m1) < length:
            parts.append(tile)
            aparts.append(ta)
            cur += m1 - m0
        parts.append(strip[:, m1:])
        aparts.append(a[:, m1:])
        strip = np.concatenate(parts, axis=1)
        a = np.concatenate(aparts, axis=1)
        if anchor_right:
            pass
    return strip, a.astype(np.uint8)


def main():
    os.makedirs(OUT, exist_ok=True)
    img = uix.load(REF)
    ui = ui_mask(img)
    sprites = []
    extra = {}
    dbg = img.copy()

    def save(sid, rgb, a, box=None):
        sp = uix.crop_sprite(sid, rgb, a, OUT, '../img/hud', pad=1, box=box)
        sprites.append(sp)
        return sp

    # dark track reference (shield pill has a visible empty end)
    _, _, d = channel(img, (412, 196, 590, 228))
    dark_pill = img[196:228, d].astype(np.float32).mean(axis=1) if d is not None and len(d) else None

    for side, s in SIDES.items():
        m = element(ui, s['box'])
        work = img.copy()
        # portrait window: the grey placeholder (low saturation) inside the frame -> transparent slot
        px0, py0, px1, py1 = s['portrait']
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        win = ((hsv[..., 1] < 70) & (hsv[..., 2] > 40)).astype(np.uint8) * 255 & uix.rect_mask(img.shape, s['portrait'])
        win = uix.fill_holes(uix.largest(cv2.morphologyEx(win, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))))
        win = cv2.morphologyEx(win, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
        # texts out
        tm = uix.text_mask(img, s['name'], thr=30, dil=3, k=31) | uix.text_mask(img, s['num'], thr=30, dil=3, k=31)
        work = uix.inpaint_local(work, tm & m, region=(s['box'][0], s['box'][1], s['box'][2], s['box'][3]), max_side=1024, feather=1, whole=True)
        # health bar: empty track + fill strip
        work, span, _ = rebuild_track(work, s['chan'])
        cx0, cy0, cx1, cy1 = s['chan']
        L = cx1 - s.get('chan_start', cx0)
        if side == 'p2':  # anchored at the right (outer) end: extend to the left = mirror, extend, mirror back
            fl = img[:, ::-1].copy()
            W = img.shape[1]
            strip, sa = fill_strip(fl, (W - cx1, cy0, W - cx0, cy1), (W - span[1], W - span[0]), L)
            strip, sa = strip[:, :L][:, ::-1].copy(), sa[:, :L][:, ::-1].copy()
        else:
            strip, sa = fill_strip(img, s['chan'], span, L)
            strip, sa = strip[:, :L], sa[:, :L]
        sid = f'{side}_hp'
        uix.save_rgba(os.path.join(OUT, f'{sid}.webp'), strip, sa)
        sprites.append(uix.Sprite(sid, span[0] if side == 'p1' else span[1] - strip.shape[1], cy0, strip.shape[1], strip.shape[0], f'../img/hud/{sid}.webp'))
        extra[f'{side}_hpSpan'] = [int(span[0]), int(span[0] + strip.shape[1])] if side == 'p1' else [int(span[1] - strip.shape[1]), int(span[1])]
        # pills
        for k, pb in enumerate(s['pills']):
            px0, py0, px1, py1 = pb
            pch = (px0 + 62, py0 + 6, px1 - 8, py1 - 14)
            work, pspan, _ = rebuild_track(work, pch, dark_pill)
            pl = pch[2] - pch[0]
            ps, pa = fill_strip(img, pch, pspan, pl)
            sid = f'{side}_pill{k}'
            uix.save_rgba(os.path.join(OUT, f'{sid}.webp'), ps, pa)
            sprites.append(uix.Sprite(sid, pspan[0], pch[1], ps.shape[1], ps.shape[0], f'../img/hud/{sid}.webp'))
            extra[f'{side}_pill{k}Span'] = [int(pspan[0]), int(pspan[0] + min(pl, ps.shape[1]))]
        a = alpha_of(m)
        a = np.where(uix.erode(win, 1) > 0, 0, a).astype(np.uint8)
        save(side, work, a)
        ys, xs = np.nonzero(win)
        extra[f'{side}_portrait'] = [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]
        extra[f'{side}_name'] = list(s['name'])
        extra[f'{side}_num'] = list(s['num'])
        cv2.drawContours(dbg, cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], -1, (0, 255, 0), 1)

    # timer (centre symbol out) + pause button
    tm_ = element(ui, (TIMER[0], TIMER[1], TIMER[2], PAUSE[1] + 4))
    clean = uix.inpaint_local(img, uix.dilate(uix.rect_mask(img.shape, TIMER_TEXT) & (cv2.cvtColor(img, cv2.COLOR_BGR2HSV)[..., 1] > 60).astype(np.uint8) * 255 | uix.text_mask(img, TIMER_TEXT, thr=30, dil=3), 3),
                              region=TIMER, max_side=1024, feather=1, whole=True)
    save('timer', clean, alpha_of(tm_))
    pm = element(ui, PAUSE)
    save('pause', img, alpha_of(pm))
    extra['timerText'] = list(TIMER_TEXT)

    # cards: frame with cost/name/key out; art window transparent
    for k, b in enumerate(CARDS):
        m = element(ui, b)
        x0, y0, x1, y1 = b
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        cost = (x0, y0, x0 + 64, y0 + 64)
        name = (x0 + 14, y1 - 74, x1 - 84, y1 - 22)
        key = (x1 - 80, y1 - 82, x1 - 20, y1 - 16)
        tm = (uix.text_mask(img, (x0 + 20, y0 + 16, x0 + 76, y0 + 80), thr=34, dil=3, k=71) & uix.poly_mask(img.shape, [(x0 + dx, y0 + dy) for dx, dy in ((30, 14), (66, 14), (84, 46), (60, 80), (36, 80), (12, 50))])) | uix.text_mask(img, name, thr=30, dil=3, k=31) | uix.text_mask(img, (key[0] + 10, key[1] + 10, key[2] - 10, key[3] - 10), thr=30, dil=3, k=21)
        work = uix.inpaint_local(img, tm & m, region=b, max_side=1024, feather=1, whole=True)
        # art window: the illustration area (inside the coloured border, above the name plate)
        aw = (x0 + 22, y0 + 30, x1 - 22, y1 - 88)
        a = alpha_of(m)
        gem = uix.dilate(uix.poly_mask(img.shape, [(x0 + dx, y0 + dy) for dx, dy in ((28, 10), (68, 10), (90, 46), (62, 86), (34, 86), (6, 52))]), 3)
        win = uix.rect_mask(img.shape, aw) & ~gem
        a = np.where(win > 0, 0, a).astype(np.uint8)
        save(f'card{k}', work, a)
        extra[f'card{k}'] = {'art': list(aw), 'cost': list(cost), 'name': list(name), 'key': list(key)}

    # hype bar
    m = element(ui, HYPE)
    work = uix.inpaint_local(img, uix.text_mask(img, HYPE_LABEL, thr=30, dil=3, k=31) & m, region=HYPE, max_side=1024, feather=1, whole=True)
    hch = (HYPE[0] + 116, HYPE[1] + 26, HYPE_LABEL[0] - 4, HYPE[3] - 24)
    work, hspan, _ = rebuild_track(work, hch)
    hl = hch[2] - hch[0]
    hs, ha = fill_strip(img, hch, hspan, hl)
    uix.save_rgba(os.path.join(OUT, 'hype_fill.webp'), hs[:, :hl], ha[:, :hl])
    sprites.append(uix.Sprite('hype_fill', hspan[0], hch[1], min(hl, hs.shape[1]), hs.shape[0], '../img/hud/hype_fill.webp'))
    extra['hypeSpan'] = [int(hspan[0]), int(hch[2])]
    extra['hypeLabel'] = list(HYPE_LABEL)
    save('hype', work, alpha_of(m))

    # training info panel
    m = element(ui, INFO)
    tm = np.zeros(img.shape[:2], np.uint8)
    for z in INFO_TEXT:
        tm |= uix.text_mask(img, z, thr=26, dil=3, k=31)
    work = uix.inpaint_local(img, tm & m, region=INFO, max_side=1024, feather=1, whole=True)
    save('info', work, alpha_of(m))
    extra['infoText'] = [list(z) for z in INFO_TEXT]

    cv2.imwrite(os.path.join(DBG, 'hud_dbg.png'), dbg)
    uix.write_ts(TS, 'HUD_ART', sprites, 'tools/ui-extract/hud.py', extra={'HUD_BOXES': extra})
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f'{len(sprites)} sprites, {total / 1e6:.2f} MB ->', OUT)


if __name__ == '__main__':
    main()
