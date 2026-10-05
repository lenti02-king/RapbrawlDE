"""Shared helpers for cutting the PO's UI reference screenshots into game assets.

The reference screens are the visual master (D38). Everything here works on their pixels:
GrabCut masks for the panels, LaMa inpainting for the background behind them and for baked text,
background-aware matting for soft glows, and WebP export plus a generated TypeScript sprite table.

LaMa (Apache-2.0, https://github.com/advimman/lama) runs on CPU from the TorchScript export at
.cache/lama/big-lama.pt (download: see README.md). Without torch/the model the code falls back to OpenCV
inpainting, which is fine for small holes but smears large ones.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LAMA_PATH = os.path.join(ROOT, '.cache', 'lama', 'big-lama.pt')

# ---------------------------------------------------------------------------------------------- masks


def load(path: str) -> np.ndarray:
    img = cv2.imread(os.path.join(ROOT, path) if not os.path.isabs(path) else path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(path)
    return img


def largest(m: np.ndarray) -> np.ndarray:
    n, lab, st, _ = cv2.connectedComponentsWithStats((m > 0).astype(np.uint8))
    if n <= 1:
        return m
    big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    return np.where(lab == big, 255, 0).astype(np.uint8)


def fill_holes(m: np.ndarray) -> np.ndarray:
    ff = m.copy()
    h, w = m.shape
    fm = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(ff, fm, (0, 0), 255)
    return m | cv2.bitwise_not(ff)


def poly_mask(shape, pts, value=255) -> np.ndarray:
    m = np.zeros(shape[:2], np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], value)
    return m


def rect_mask(shape, r, value=255) -> np.ndarray:
    m = np.zeros(shape[:2], np.uint8)
    x0, y0, x1, y1 = r
    m[max(0, y0):y1, max(0, x0):x1] = value
    return m


def grabcut(img: np.ndarray, box, pad=40, iters=6, fg=None, bg=None) -> np.ndarray:
    """Foreground mask (full image size) of the object inside `box` (x0,y0,x1,y1).
    `fg`/`bg`: optional full-size masks of pixels that are definitely foreground/background."""
    H, W = img.shape[:2]
    x0, y0, x1, y1 = box
    cx0, cy0, cx1, cy1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
    crop = img[cy0:cy1, cx0:cx1]
    mask = np.zeros(crop.shape[:2], np.uint8)
    rect = (max(0, x0 - cx0), max(0, y0 - cy0), min(x1, W) - max(x0, 0), min(y1, H) - max(y0, 0))
    b = np.zeros((1, 65), np.float64)
    f = np.zeros((1, 65), np.float64)
    cv2.grabCut(crop, mask, rect, b, f, iters, cv2.GC_INIT_WITH_RECT)
    if fg is not None or bg is not None:
        if fg is not None:
            mask[fg[cy0:cy1, cx0:cx1] > 0] = cv2.GC_FGD
        if bg is not None:
            mask[bg[cy0:cy1, cx0:cx1] > 0] = cv2.GC_BGD
        cv2.grabCut(crop, mask, None, b, f, iters, cv2.GC_INIT_WITH_MASK)
    m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    m = fill_holes(largest(m))
    out = np.zeros((H, W), np.uint8)
    out[cy0:cy1, cx0:cx1] = m
    return out


def text_mask(img: np.ndarray, zone, thr=38, dil=2, k=21, bright=True) -> np.ndarray:
    """Glyph pixels inside `zone`: strong local contrast against a median-blurred surface (catches light fills,
    dark outlines and drop shadows alike) plus near-white pixels (the inside of thick letters), dilated a little."""
    x0, y0, x1, y1 = zone
    H, W = img.shape[:2]
    pad = k
    cx0, cy0, cx1, cy1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
    c = img[cy0:cy1, cx0:cx1].astype(np.int16)
    med = cv2.medianBlur(img[cy0:cy1, cx0:cx1], k).astype(np.int16)
    d = np.abs(c - med).max(axis=2)
    m = (d > thr).astype(np.uint8) * 255
    if bright:
        hsv = cv2.cvtColor(img[cy0:cy1, cx0:cx1], cv2.COLOR_BGR2HSV)
        m |= ((hsv[..., 2] > 165) & (hsv[..., 1] < 80)).astype(np.uint8) * 255
    z = np.zeros_like(m)
    z[y0 - cy0:y1 - cy0, x0 - cx0:x1 - cx0] = 255
    m &= z
    if dil:
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * dil + 1, 2 * dil + 1)))
    out = np.zeros((H, W), np.uint8)
    out[cy0:cy1, cx0:cx1] = m
    return out


def dilate(m, r):
    return cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))


def erode(m, r):
    return cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))


def rebuild_bar(img: np.ndarray, outer, strip, cap=8) -> np.ndarray:
    """Empty progress-bar track: every column becomes the mean column of a clean `strip` (x0, x1) of the track; the
    left end cap (usually hidden under the fill) is the mirrored right end cap."""
    out = img.copy()
    x0, y0, x1, y1 = outer
    col = img[y0:y1, strip[0]:strip[1]].astype(np.float32).mean(axis=1)
    out[y0:y1, x0 + cap:x1 - cap] = col[:, None, :].astype(np.uint8)
    out[y0:y1, x0:x0 + cap] = img[y0:y1, x1 - cap:x1][:, ::-1]
    return out


def fill_gradient(img: np.ndarray, poly, top_box, bottom_box, feather=1.5) -> np.ndarray:
    """Fill a small flat area (e.g. a badge interior behind a number) with a vertical gradient between two sampled
    colours instead of inventing texture."""
    out = img.copy()
    m = poly_mask(img.shape, poly)
    ys = [p[1] for p in poly]
    y0, y1 = min(ys), max(ys)

    def mean(b):
        return img[b[1]:b[3], b[0]:b[2]].reshape(-1, 3).astype(np.float32).mean(axis=0)

    ct, cb = mean(top_box), mean(bottom_box)
    t = np.clip((np.arange(img.shape[0], dtype=np.float32) - y0) / max(1, y1 - y0), 0, 1)[:, None, None]
    grad = (ct[None, None, :] * (1 - t) + cb[None, None, :] * t) * np.ones((1, img.shape[1], 1), np.float32)
    a = cv2.GaussianBlur(m, (0, 0), feather).astype(np.float32)[..., None] / 255.0
    out = (img.astype(np.float32) * (1 - a) + grad * a).astype(np.uint8)
    return out


# ---------------------------------------------------------------------------------------------- inpainting

_lama = None


def _load_lama():
    global _lama
    if _lama is None:
        try:
            import torch  # noqa: F401

            if not os.path.exists(LAMA_PATH):
                raise FileNotFoundError(LAMA_PATH)
            import torch as T

            T.set_num_threads(max(1, os.cpu_count() or 1))
            _lama = T.jit.load(LAMA_PATH, map_location='cpu').eval()
        except Exception as e:  # pragma: no cover - fallback path
            print('LaMa unavailable, falling back to OpenCV inpainting:', e)
            _lama = False
    return _lama


def _lama_run(img: np.ndarray, mask: np.ndarray) -> np.ndarray:
    import torch as T

    model = _load_lama()
    h, w = img.shape[:2]
    ph, pw = (8 - h % 8) % 8, (8 - w % 8) % 8
    im = cv2.copyMakeBorder(img, 0, ph, 0, pw, cv2.BORDER_REFLECT)
    mk = cv2.copyMakeBorder(mask, 0, ph, 0, pw, cv2.BORDER_REFLECT)
    rgb = cv2.cvtColor(im, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    t_im = T.from_numpy(rgb).permute(2, 0, 1)[None]
    t_mk = T.from_numpy((mk > 0).astype(np.float32))[None, None]
    with T.no_grad():
        out = model(t_im, t_mk)
    res = out[0].permute(1, 2, 0).numpy()
    res = np.clip(res * 255 if res.max() <= 1.5 else res, 0, 255).astype(np.uint8)
    return cv2.cvtColor(res, cv2.COLOR_RGB2BGR)[:h, :w]


def inpaint(img: np.ndarray, mask: np.ndarray, max_side=1024, ctx=0.6, min_ctx=48, feather=3, whole=False) -> np.ndarray:
    """Fill `mask` (255 = hole). Each connected hole is processed on a crop with surrounding context; crops larger than
    `max_side` are downscaled for the fill (LaMa works best around 512-1024 px) and the result is pasted back into the
    hole only, with a soft seam."""
    out = img.copy()
    m = (mask > 0).astype(np.uint8)
    if not m.any():
        return out
    use_lama = _load_lama() is not False
    H, W = img.shape[:2]
    if whole:  # one run over the whole image (e.g. all text of one panel: the model sees the full panel as context)
        n, lab = 2, m.astype(np.int32)
        ys, xs = np.nonzero(m)
        st = np.array([[0, 0, W, H, 0], [0, 0, W, H, int(m.sum())]])
        ctx, min_ctx = 0, 0
    else:
        n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    for i in range(1, n):
        x, y, w, h = st[i, :4]
        c = int(max(min_ctx, ctx * max(w, h)))
        x0, y0, x1, y1 = max(0, x - c), max(0, y - c), min(W, x + w + c), min(H, y + h + c)
        crop = out[y0:y1, x0:x1]
        hole = np.where(lab[y0:y1, x0:x1] == i, 255, 0).astype(np.uint8)
        hole_all = (m[y0:y1, x0:x1] * 255).astype(np.uint8)  # neighbouring holes stay holes (no leaking of UI pixels)
        ch, cw = crop.shape[:2]
        s = min(1.0, max_side / max(ch, cw))
        if s < 1:
            sc = cv2.resize(crop, (int(cw * s), int(ch * s)), interpolation=cv2.INTER_AREA)
            sm = cv2.resize(hole_all, (int(cw * s), int(ch * s)), interpolation=cv2.INTER_NEAREST)
            sm = dilate(sm, 1)
        else:
            sc, sm = crop, hole_all
        if use_lama:
            fill = _lama_run(sc, sm)
        else:
            fill = cv2.inpaint(sc, sm, 7, cv2.INPAINT_TELEA)
        if s < 1:
            fill = cv2.resize(fill, (cw, ch), interpolation=cv2.INTER_CUBIC)
        a = cv2.GaussianBlur(dilate(hole, feather), (0, 0), feather * 0.6).astype(np.float32)[..., None] / 255.0
        a = np.maximum(a, (hole > 0).astype(np.float32)[..., None])
        out[y0:y1, x0:x1] = (crop * (1 - a) + fill * a).astype(np.uint8)
    return out


PLATE_SIDE = 420  # outpainted margin left/right: covers phones up to ~2.6:1 (19.5:9 + browser/app bars)
PLATE_TOP = 90  # outpainted margin top/bottom: covers 16:10 and 4:3 tablets


def center_crop_w(img: np.ndarray, w: int) -> np.ndarray:
    """A cached plate may be wider than the master (older outpaint): back to the master's width."""
    x0 = (img.shape[1] - w) // 2
    return img[:, x0:x0 + w]


def extend_plate(img: np.ndarray, cache: str, side=PLATE_SIDE, top=PLATE_TOP) -> np.ndarray:
    """Outpaint a clean plate by `side` px left/right and `top` px top/bottom (LaMa continues the scene), so screens
    fill wide phones and tablets without bars. Cached in `cache` (reused when REUSE_BG is set and the size matches)."""
    H, W = img.shape[:2]
    if os.path.exists(cache) and os.environ.get('REUSE_BG'):
        c = cv2.imread(cache)
        if c is not None and c.shape[:2] == (H + 2 * top, W + 2 * side):
            return c
    wide = cv2.copyMakeBorder(img, 0, 0, side, side, cv2.BORDER_REFLECT)
    om = np.zeros(wide.shape[:2], np.uint8)
    om[:, :side] = 255
    om[:, -side:] = 255
    wide = inpaint(wide, om, max_side=1024, ctx=0.45, feather=6)
    if top:
        tall = cv2.copyMakeBorder(wide, top, top, 0, 0, cv2.BORDER_REFLECT)
        om = np.zeros(tall.shape[:2], np.uint8)
        om[:top] = 255
        om[-top:] = 255
        wide = inpaint(tall, om, max_side=1400, ctx=0.12, min_ctx=120, feather=6)
    cv2.imwrite(cache, wide)
    return wide


def inpaint_local(img: np.ndarray, mask: np.ndarray, region=None, **kw) -> np.ndarray:
    """Inpaint only inside `region` (x0,y0,x1,y1) of `img` (context = that region only, e.g. one panel)."""
    if region is None:
        return inpaint(img, mask, **kw)
    x0, y0, x1, y1 = region
    out = img.copy()
    out[y0:y1, x0:x1] = inpaint(img[y0:y1, x0:x1].copy(), mask[y0:y1, x0:x1], **kw)
    return out


# ---------------------------------------------------------------------------------------------- matting


def matte(img: np.ndarray, bg: np.ndarray, core: np.ndarray, ring=10, gain=1 / 55.0):
    """RGBA for an element: alpha 1 on the (anti-aliased) core mask; outside, a soft ring whose alpha is how much the
    pixel differs from the clean background (glow/shadow), fading out over `ring` px. Colours are un-premultiplied
    against the background so the glow composites correctly over any backdrop."""
    core_f = cv2.GaussianBlur(core, (0, 0), 0.7).astype(np.float32) / 255.0
    dist = cv2.distanceTransform((core == 0).astype(np.uint8), cv2.DIST_L2, 5)
    fall = np.clip(1.0 - dist / max(1, ring), 0, 1) ** 1.5
    diff = np.abs(img.astype(np.float32) - bg.astype(np.float32)).max(axis=2)
    a_ring = np.clip(diff * gain, 0, 1) * fall
    a = np.maximum(core_f, a_ring)
    a = np.where(dist > ring, 0, a)
    # un-premultiply: img = a*F + (1-a)*B  =>  F = (img - (1-a)B)/a
    af = a[..., None]
    F = np.where(af > 0.02, (img.astype(np.float32) - (1 - af) * bg.astype(np.float32)) / np.maximum(af, 1e-3), img)
    F = np.where(core_f[..., None] > 0.99, img.astype(np.float32), F)
    return np.clip(F, 0, 255).astype(np.uint8), (a * 255).astype(np.uint8)


# ---------------------------------------------------------------------------------------------- export


@dataclass
class Sprite:
    id: str
    x: int
    y: int
    w: int
    h: int
    file: str
    extra: dict = field(default_factory=dict)


def save_rgba(path: str, bgr: np.ndarray, alpha: np.ndarray | None, quality=92) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    if alpha is None:
        Image.fromarray(rgb).save(path, 'WEBP', quality=quality, method=6)
    else:
        rgba = np.dstack([rgb, alpha])
        Image.fromarray(rgba, 'RGBA').save(path, 'WEBP', quality=quality, method=6, alpha_quality=100)


def crop_sprite(sid: str, rgb: np.ndarray, alpha: np.ndarray, out_dir: str, rel_dir: str, pad=0, quality=92, box=None) -> Sprite:
    """Crop to the alpha bbox (or `box`) and save. Returns position in reference coordinates."""
    if box is None:
        ys, xs = np.nonzero(alpha > 3)
        x0, y0, x1, y1 = xs.min() - pad, ys.min() - pad, xs.max() + 1 + pad, ys.max() + 1 + pad
    else:
        x0, y0, x1, y1 = box
    H, W = rgb.shape[:2]
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    name = f'{sid}.webp'
    save_rgba(os.path.join(out_dir, name), rgb[y0:y1, x0:x1], None if alpha is None else alpha[y0:y1, x0:x1], quality)
    return Sprite(sid, int(x0), int(y0), int(x1 - x0), int(y1 - y0), f'{rel_dir}/{name}')


def write_ts(path: str, name: str, sprites: list[Sprite], header: str, extra: dict | None = None) -> None:
    """Generated TypeScript table: image imports + reference-space boxes."""
    lines = [f'// GENERATED by {header} - do not edit by hand (re-run the script instead).', '']
    def ident(s: str) -> str:
        return 'I_' + ''.join(ch if ch.isalnum() else '_' for ch in s)
    for s in sprites:
        lines.append(f"import {ident(s.id)} from '{s.file}';")
    lines.append('')
    lines.append('export interface RefSprite {\n  src: string;\n  x: number;\n  y: number;\n  w: number;\n  h: number;\n}')
    lines.append('')
    lines.append(f'export const {name} = {{')
    for s in sprites:
        lines.append(f"  {json.dumps(s.id)}: {{ src: {ident(s.id)}, x: {s.x}, y: {s.y}, w: {s.w}, h: {s.h} }},")
    lines.append('} satisfies Record<string, RefSprite>;')
    if extra:
        for k, v in extra.items():
            lines.append('')
            body = ',\n'.join(f'  {json.dumps(kk)}: {json.dumps(vv)}' for kk, vv in v.items())
            lines.append(f'export const {k} = {{\n{body},\n}} as const;')
    lines.append('')
    with open(path, 'w') as f:
        f.write('\n'.join(lines))
