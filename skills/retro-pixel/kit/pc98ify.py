"""pc98ify: turn modern source art into a PC-98 style sprite.

Workflow (owner direction 2026-09-30): find good modern art first, then adopt the PC-98 look by processing
(downscale, edge emphasis, a small palette, Bayer ordered dither, black outline), instead of hand-drawing crude art.

    spr = load_sprite(path, height=120, k=8)      # palette hexes + index array + mask
    pal = Pal(scene_entries + spr.entries('ch'))  # character colours become part of the 16-colour palette
    draw_sprite(cv, spr, x, y, base=pal.ix['ch0'])

Licence and provenance are the caller's job: record them in assets/MANIFEST.json (path, sha256, source, licence).
"""
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from scipy import ndimage

BAYER8 = np.array([
    [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]]) / 64.0 - 0.5


class Sprite:
    def __init__(self, idx, mask, hexes):
        self.idx, self.mask, self.hexes = idx, mask, hexes
        self.h, self.w = idx.shape

    def entries(self, prefix="ch"):
        return [(f"{prefix}{i}", h) for i, h in enumerate(self.hexes)]


def _bg_mask(im):
    """alpha if present; else flood-fill the border colour (near-uniform backgrounds)."""
    if im.mode in ("RGBA", "LA"):
        a = np.array(im.getchannel("A"))
        return a > 128
    rgb = np.array(im.convert("RGB")).astype(int)
    h, w, _ = rgb.shape
    corners = np.array([rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]])
    if np.abs(corners - corners[0]).max() > 24:
        return np.ones((h, w), bool)        # busy background: keep everything
    dist = np.abs(rgb - corners[0]).sum(axis=2)
    cand = dist < 36
    lab, n = ndimage.label(cand)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    border.discard(0)
    bg = np.isin(lab, list(border))
    return ~bg


def load_sprite(path, height=120, k=8, dither=0.55, outline=True, sat=1.25, contrast=1.15, crop=None,
                key_bg=True, palette_hexes=None):
    im = Image.open(path)
    if crop:
        im = im.crop(crop)
    mask = _bg_mask(im) if key_bg else np.ones((im.height, im.width), bool)
    rgb = im.convert("RGB")
    scale = height / rgb.height
    size = (max(1, int(rgb.width * scale)), height)
    rgb = rgb.resize(size, Image.LANCZOS)
    m = Image.fromarray((mask * 255).astype(np.uint8)).resize(size, Image.LANCZOS)
    mask = np.array(m) > 127
    rgb = ImageEnhance.Color(rgb).enhance(sat)
    rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.2, percent=140, threshold=2))
    arr = np.array(rgb).astype(np.float32)
    # palette: median cut on the visible pixels only
    if palette_hexes is None:
        pix = arr[mask].astype(np.uint8)
        vis = Image.fromarray(pix.reshape(-1, 1, 3))      # visible pixels only: the background must not take palette slots
        q = vis.quantize(colors=k, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        pal = np.array(q.getpalette()[: 3 * k]).reshape(-1, 3).astype(np.float32)
        # order dark -> light so index 0 is the darkest (outline colour)
        order = np.argsort(pal.sum(axis=1))
        pal = pal[order]
    else:
        pal = np.array([[int(h.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)] for h in palette_hexes], np.float32)
    H, W, _ = arr.shape
    yy, xx = np.mgrid[0:H, 0:W]
    off = BAYER8[yy % 8, xx % 8][..., None] * (255.0 / max(len(pal) ** 0.5, 1)) * dither
    a2 = np.clip(arr + off, 0, 255)
    d = ((a2[:, :, None, :] - pal[None, None, :, :]) ** 2 * np.array([0.30, 0.59, 0.11])).sum(axis=3)
    idx = d.argmin(axis=2).astype(np.uint8)
    if outline:
        edge = mask & ~ndimage.binary_erosion(mask, iterations=1)
        idx[edge] = 0
    hexes = ["#%02x%02x%02x" % tuple(int(v) for v in p) for p in pal]
    return Sprite(idx, mask, hexes)


def draw_sprite(cv, spr, x, y, base=0, flip=False, scale=1, remap=None):
    idx = (np.array(remap, np.uint8)[spr.idx]) if remap is not None else spr.idx + base
    mask = spr.mask
    if flip:
        idx = idx[:, ::-1]
        mask = mask[:, ::-1]
    img = Image.fromarray(idx.astype(np.uint8), "P")
    img.putpalette(cv.pal.flat)
    mk = Image.fromarray((mask * 255).astype(np.uint8), "L")
    if scale != 1:
        img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
        mk = mk.resize(img.size, Image.NEAREST)
    cv.im.paste(img, (int(x), int(y)), mk)
    cv._box("portrait", "panel", x, y, x + img.width, y + img.height)
