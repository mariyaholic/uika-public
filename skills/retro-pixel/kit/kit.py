"""kit: shared PC-98 furniture (double frame, VN message window, blink cadence, hazard stripes, rubber stamps, shake).
The presenter window lives in presenter.py (real art converted to PC-98, not procedural faces)."""
import math
from PIL import Image, ImageDraw
from pxkit import *


def wrap_px(s, px_w, size=16, prop=True):
    words = s.split(" ")
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w) if cur else w
        if font(size, prop).getbbox(t)[2] <= px_w or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def frame2(cv, x0, y0, x1, y1, outer="black", mid="gray", inner="white", fill=None):
    """PC-98 double-line frame (drawn as a panel)"""
    cv.rect(x0, y0, x1, y1, fill=fill if fill is not None else None, outline=outer, tag="panel")
    cv.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, outline=mid, tag="panel", track=False)
    cv.rect(x0 + 3, y0 + 3, x1 - 3, y1 - 3, outline=inner, tag="panel", track=False)


def msgbox(cv, x0, y0, x1, y1, speaker, text, frac, face="navy", ink="white", name_bg="red", size=16, guard=True):
    """VN message window with a name tab. frac = how much of `text` is typed (0..1).
    guard=False only for text already checked whole (a typed prefix of 544 reads 54)."""
    frame2(cv, x0, y0, x1, y1, fill=face)
    tw = cv.text_w(speaker, 12) + 14
    cv.rect(x0 + 8, y0 - 9, x0 + 8 + tw, y0 + 7, fill=name_bg, outline="black", tag="panel")
    cv.text(x0 + 15, y0 - 9, speaker, "white", size=12, tag="label", guard=False)
    lines = wrap_px(text, x1 - x0 - 24, size)
    n = int(len(text) * clamp(frac))
    shown = 0
    for i, ln in enumerate(lines):
        part = ln[: max(0, n - shown)]
        shown += len(ln) + 1
        if part:
            cv.text(x0 + 12, y0 + 10 + i * (size + 3), part, ink, size=size, tag="caption", guard=guard)


def _blink_times(seed=5, until=600.0):
    import random as _r
    r, out, t = _r.Random(seed), [], 1.3
    while t < until:
        out.append(t)
        if r.random() < 0.18:                 # an occasional double blink
            out.append(t + 0.32)
        t += r.uniform(2.3, 5.2)              # people do not blink on a metronome
    return out


_BLINKS = _blink_times()
_BLINK_SEQ = [1, 1, 2, 2, 2, 1, 1]            # half, closed, half held 2-3 frames: PC-98 cadence, not 30 fps


def blink_at(t, period=None):
    """eyelid state at time t: 0 open, 1 half, 2 closed. Irregular timing, 7-frame lid motion."""
    import bisect
    i = bisect.bisect_right(_BLINKS, t) - 1
    if i < 0:
        return 0
    k = int((t - _BLINKS[i]) * 30)
    return _BLINK_SEQ[k] if k < len(_BLINK_SEQ) else 0


def stripes(cv, x0, y0, x1, y1, c1, c2, w=8, phase=0.0):
    """diagonal hazard stripes (decor), clipped to the box"""
    cv.rect(x0, y0, x1, y1, fill=c2, tag="decor", track=False)
    span = (x1 - x0) + (y1 - y0)
    k = -int(phase) % (2 * w)
    a = -span + k
    box = Image.new("L", (int(x1 - x0), int(y1 - y0)), 0)
    d = ImageDraw.Draw(box)
    while a < span:
        d.polygon([(a, 0), (a + w, 0), (a + w + (y1 - y0), y1 - y0), (a + (y1 - y0), y1 - y0)], fill=255)
        a += 2 * w
    cv.im.paste(cv.pal.c(c1), (int(x0), int(y0)), box)
    cv._box("stripes", "decor", x0, y0, x1, y1)


def stamp_text(cv, x, y, s, c, size=16, scale=4, angle=-6, frame=True, bg=None, anchor="c"):
    """rotated (nearest) text stamp with optional frame; returns bbox"""
    f = font(size, True)
    l, t, r, b = f.getbbox(s)
    w, h = r + 4, b + 2
    m = Image.new("1", (w, h), 0)
    ImageDraw.Draw(m).text((2, 0), s, font=f, fill=1)
    if frame:
        ImageDraw.Draw(m).rectangle([0, 0, w - 1, h - 1], outline=1)
    m = m.resize((w * scale, h * scale), Image.NEAREST).rotate(angle, expand=True, resample=Image.NEAREST)
    if anchor == "c":
        x, y = x - m.width // 2, y - m.height // 2
    if bg is not None:
        cv.im.paste(cv.pal.c(bg), (int(x), int(y)), m.point(lambda v: 255 if v else 0).filter(
            __import__("PIL.ImageFilter", fromlist=["MaxFilter"]).MaxFilter(5)))
    cv.im.paste(cv.pal.c(c), (int(x), int(y)), m)
    cv._box("text", "data", x, y, x + m.width, y + m.height, s)
    return (x, y, x + m.width, y + m.height)


def shake(t, amp=2, hz=18, decay=0.6):
    """small screen-shake offset after an impact at t=0 (returns dx,dy)"""
    if t < 0 or t > decay:
        return 0, 0
    k = (1 - t / decay) * amp
    return int(round(math.sin(t * hz * 2 * math.pi) * k)), int(round(math.cos(t * hz * 1.7 * 2 * math.pi) * k))
