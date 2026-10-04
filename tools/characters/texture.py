"""Texture helpers for the character build: UV-space rasterising, skin detail, recolouring. Pure numpy + Pillow."""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageFilter


def triangles(faces, face_uvs):
    """Split polygons into triangles: returns (vertex index triples, uv index triples)."""
    tv, tu = [], []
    for f, uv in zip(faces, face_uvs):
        if uv is None:
            continue
        for k in range(1, len(f) - 1):
            tv.append((f[0], f[k], f[k + 1]))
            tu.append((uv[0], uv[k], uv[k + 1]))
    return np.array(tv, dtype=np.int64), np.array(tu, dtype=np.int64)


def raster(size: int, tri_v, tri_uv, uvs, values: np.ndarray, pad: int = 2) -> np.ndarray:
    """Interpolate per-vertex values (n, c) over UV triangles into a (size, size, c) image (v up -> row 0 at top).
    Pixels not covered keep NaN. Triangles are dilated by `pad` px to hide seams."""
    c = values.shape[1]
    img = np.full((size, size, c), np.nan, dtype=np.float32)
    P = uvs[tri_uv] * (size - 1)
    P[:, :, 1] = (size - 1) - P[:, :, 1]
    V = values[tri_v]
    for t in range(len(tri_v)):
        p = P[t]
        x0, y0 = np.floor(p.min(0)).astype(int) - pad
        x1, y1 = np.ceil(p.max(0)).astype(int) + pad
        x0, y0 = max(x0, 0), max(y0, 0)
        x1, y1 = min(x1, size - 1), min(y1, size - 1)
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        a, b, cc = p
        d = (b[1] - cc[1]) * (a[0] - cc[0]) + (cc[0] - b[0]) * (a[1] - cc[1])
        if abs(d) < 1e-9:
            continue
        l1 = ((b[1] - cc[1]) * (xs - cc[0]) + (cc[0] - b[0]) * (ys - cc[1])) / d
        l2 = ((cc[1] - a[1]) * (xs - cc[0]) + (a[0] - cc[0]) * (ys - cc[1])) / d
        l3 = 1 - l1 - l2
        # tolerance in barycentric units ~ pad pixels
        span = max(1.0, np.abs(p.max(0) - p.min(0)).max())
        tol = -pad / span
        m = (l1 >= tol) & (l2 >= tol) & (l3 >= tol)
        if not m.any():
            continue
        l1c, l2c, l3c = np.clip(l1, 0, 1), np.clip(l2, 0, 1), np.clip(l3, 0, 1)
        s = l1c + l2c + l3c
        val = (l1c[..., None] * V[t, 0] + l2c[..., None] * V[t, 1] + l3c[..., None] * V[t, 2]) / s[..., None]
        sub = img[y0:y1 + 1, x0:x1 + 1]
        inside = (l1 >= 0) & (l2 >= 0) & (l3 >= 0)
        # exact interior always wins; dilation only fills empty pixels
        fill = m & (np.isnan(sub[..., 0]) | inside)
        sub[fill] = val[fill]
    return img


def fbm(size: int, seed: int, octaves=5, base=8) -> np.ndarray:
    """Tileable-ish value-noise fbm in [0,1]."""
    rng = np.random.default_rng(seed)
    out = np.zeros((size, size), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        n = base * (2 ** o)
        g = rng.random((n, n)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC)
        out += amp * (np.asarray(im, np.float32) / 255)
        tot += amp
        amp *= 0.55
    return out / tot


def load_rgb(path: str, size: int) -> np.ndarray:
    return np.asarray(Image.open(path).convert('RGB').resize((size, size), Image.LANCZOS), np.float32) / 255


def load_rgba(path: str, size: int) -> np.ndarray:
    return np.asarray(Image.open(path).convert('RGBA').resize((size, size), Image.LANCZOS), np.float32) / 255


def save(arr: np.ndarray, path: str, quality=90):
    a = np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8)
    im = Image.fromarray(a)
    if path.endswith('.jpg'):
        im.convert('RGB').save(path, quality=quality)
    else:
        im.save(path)


def luminance(a: np.ndarray) -> np.ndarray:
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def recolor(a: np.ndarray, color, contrast=1.0, keep=0.0, mask: np.ndarray | None = None) -> np.ndarray:
    """Tint by luminance: keeps shading/fabric detail, replaces hue. `keep` blends some original colour back.
    `mask` selects the pixels that define the reference brightness (e.g. alpha > 0.5 for hair cards)."""
    lum = luminance(a)
    ref = lum[mask] if mask is not None and mask.any() else lum
    mean, med = float(ref.mean()), float(np.median(ref))
    lum = (lum - mean) * contrast + mean
    norm = lum / max(1e-4, med)
    out = np.clip(norm[..., None] * np.array(color, np.float32)[None, None, :], 0, 1)
    return out * (1 - keep) + a[..., :3] * keep


def blur(a: np.ndarray, r: float) -> np.ndarray:
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) / 255


def median(a: np.ndarray, k: int) -> np.ndarray:
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.MedianFilter(k)), np.float32) / 255


def normal_from_height(h: np.ndarray, strength: float) -> np.ndarray:
    """Tangent-space normal map (OpenGL convention, +Y up) from a height field in [0,1]."""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.stack([-dx, dy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5
