"""presenter: a keynote host from REAL art, converted to the PC-98 look and mapped onto the video's own 16-colour palette.

Owner direction (2026-09-30): procedural faces read as "too unhuman"; source good modern art, then adopt the PC-98 look.
The art is quantised directly onto the palette entries named in `names` (no extra slots), so the presenter always
matches the scene. Mouth and blink are drawn on top, driven by vo.mouth() and kit.blink_at().

    HOST = presenter(PAL, r"...\\bust.png", height=100)          # bust in a framed window (108x108 at height 100)
    HOST.window(cv, 524, 28, vo.mouth(v, t - t0), blink_at(t))
    BODY = full_body(PAL, r"...\\full.webp", height=200)         # alpha-keyed full body for outros
    BODY.draw(cv, 460, 68)

Provenance is the caller's job: keep path, sha256, source and licence in the project's assets/MANIFEST.json.
Art with unverified rights makes the video internal-only (say so in STATUS/RESULTS).
"""
import numpy as np
from pxkit import *
from pc98ify import load_sprite, draw_sprite
from kit import frame2

# the palette entries a presenter is quantised onto (a video palette must define all of them; aliases are fine)
SPRITE_NAMES = ["black", "white", "red", "lamp", "skin", "skin2", "hair", "hair2", "uni", "uni2"]
_cache = {}


def _hexes(pal, names):
    miss = [n for n in names if n not in pal.ix]
    if miss:
        raise KeyError(f"palette lacks presenter colours: {miss}")
    return ["#%02x%02x%02x" % tuple(pal.rgb[pal.ix[n]]) for n in names]


class Presenter:
    def __init__(self, pal, src, height=100, dither=0.5, names=SPRITE_NAMES, mouth_at=(0.49, 0.545),
                 iris="red", lash="hair"):
        self.names, self.iris, self.lash = names, iris, lash
        self.spr = load_sprite(src, height=height, palette_hexes=_hexes(pal, names), dither=dither, outline=False,
                               sat=1.0, contrast=1.05, k=len(names))
        self.remap = [pal.ix[n] for n in names]
        self.pal = pal
        self.w, self.h = self.spr.w, self.spr.h
        self.mouth_at = mouth_at          # fraction of the source image; check once with a zoomed frame
        self.eye_boxes = self._find_eyes()

    def _find_eyes(self):
        """the two eyes, anchored on the iris colour inside the face band (dark blobs merge with the bangs).
        Box = iris +-2 px across, 1 px above (the upper lash) and below. Found per sprite size."""
        idx, h, w = self.spr.idx, self.h, self.w
        y0, y1, x0, x1 = int(h * 0.34), int(h * 0.46), int(w * 0.34), int(w * 0.68)
        ys, xs = np.where(idx[y0:y1, x0:x1] == self.names.index(self.iris))
        if len(xs) < 2:
            raise ValueError("presenter: no iris pixels in the face band (pick iris= a colour the eyes use)")
        mid = (xs.min() + xs.max()) / 2
        boxes = []
        for sel in (xs < mid, xs >= mid):
            if not sel.any():
                raise ValueError("presenter: found only one iris")
            bx, by = xs[sel] + x0, ys[sel] + y0
            boxes.append((bx.min() - 2, by.min() - 1, bx.max() + 2, by.max() + 1))
        return boxes

    def _lid(self, cv, x, y, state):
        """state 1 = half closed, 2 = closed. The lid is the skin just below the eye copied upward (keeps the
        face's own dither), with a lash line where the lid meets and a one-pixel flick at the outer corner."""
        idx = self.spr.idx
        for (ex0, ey0, ex1, ey1) in self.eye_boxes:
            src = min(self.h - 1, ey1 + 2)
            rows = range(ey0 - 1, ey1 + 1) if state == 2 else range(ey0 - 1, (ey0 + ey1) // 2 + 1)
            for yy in rows:
                for xx in range(ex0 - 1, ex1 + 2):
                    cv.px(x + xx, y + yy, self.names[idx[src, xx]])
            ly = ey1 if state == 2 else (ey0 + ey1) // 2 + 1
            cv.line(x + ex0 - 1, y + ly, x + ex1 + 1, y + ly, self.lash)
            cv.px(x + (ex1 + 2 if ex0 > self.w // 2 else ex0 - 2), y + ly - 1, self.lash)

    def draw(self, cv, x, y, mouth=0.0, blink=0):
        """mouth: 0 / 0.5 / 1 from vo.mouth (stepped at 10 fps); blink: 0 open, 1 half, 2 closed (kit.blink_at)"""
        draw_sprite(cv, self.spr, x, y, remap=self.remap)
        state = 2 if blink is True else int(blink or 0)
        if state:
            self._lid(cv, x, y, state)
        m = max(0.0, min(1.0, mouth))
        mx, my = x + int(self.mouth_at[0] * self.w), y + int(self.mouth_at[1] * self.h)
        if m > 0.15:
            hh = 1 + int(m * 4)
            fill = "dred" if "dred" in cv.pal.ix else self.lash
            cv.ellipse(mx - 4, my - hh // 2, mx + 4, my + hh, fill=fill, outline="black")

    def window(self, cv, x, y, mouth, blink, face="dgray"):
        w, h = self.w + 8, self.h + 8
        frame2(cv, x, y, x + w, y + h, fill=face)
        self.draw(cv, x + 4, y + 4, mouth, blink)
        cv._box("portrait", "panel", x, y, x + w, y + h)
        return (x, y, x + w, y + h)


class FullBody:
    """alpha-keyed full-body art mapped onto the palette, with a black outline; for outros and hero shots."""

    def __init__(self, pal, src, height=220, dither=0.5, names=SPRITE_NAMES):
        self.spr = load_sprite(src, height=height, palette_hexes=_hexes(pal, names), dither=dither, outline=True,
                               sat=1.0, contrast=1.05, k=len(names))
        self.remap = [pal.ix[n] for n in names]
        self.w, self.h = self.spr.w, self.spr.h

    def draw(self, cv, x, y, flip=False):
        draw_sprite(cv, self.spr, x, y, remap=self.remap, flip=flip)


def presenter(pal, src, height=100, dither=0.5, **kw):
    key = ("bust", id(pal), src, height, dither)
    if key not in _cache:
        _cache[key] = Presenter(pal, src, height, dither, **kw)
    return _cache[key]


def full_body(pal, src, height=220, dither=0.5, **kw):
    key = ("full", id(pal), src, height, dither)
    if key not in _cache:
        _cache[key] = FullBody(pal, src, height, dither, **kw)
    return _cache[key]
