"""launchkit: modern keynote / product-launch look (ADR-0031). Pillow + numpy, 1920x1080 by default.

Everything here was rebuilt from the reference collection (a private study library of launch films); the names
in the comments point at the video and timestamp the technique was studied from. No frame of any reference is used.

Layers:
  tokens + fonts       THEMES, font(role, size), text(), measure()
  timing               ease_*, seg(), count()
  masks                aa_mask(), capsule(), squircle()
  transitions (a,b,t)  t_mosaic, t_slit, t_capsule, t_portal, t_push, t_whip, t_shape, value_ramp
  graphics             kinetic_words, kpi_row, type_wall, capsule_photo, spec_callouts, price_split,
                       bubble_chart, wedge_chart, radar, rank_table, lower_caption, bug
  evidence             Evidence (every on-screen figure comes from the evidence file; unknown keys raise)
  output               Writer (frames -> ffmpeg h264), still()
Audio is not here: use skills/retro-pixel/kit/sfx.py (Mix, duck, master, mux), see references/05-sound.md.
"""
from __future__ import annotations
import json, math, os, pathlib, re, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1920, 1080, 30

# ------------------------------------------------------------------ tokens
THEMES = {
    # warm grey LED wall + graphite type (Rivian R2 82IiXIKkRIA, Apple seamless white)
    "studio": {"bg": (232, 230, 226), "ink": (24, 24, 26), "sub": (128, 126, 122), "accent": (226, 84, 46),
               "accent2": (40, 120, 220), "panel": (210, 207, 201), "line": (160, 157, 152)},
    # dark stage, light type (Jobs 2007 VQKMoT-6XSg, Nothing Muen4f4L_6M)
    "stage": {"bg": (10, 11, 14), "ink": (244, 244, 246), "sub": (138, 142, 150), "accent": (255, 196, 0),
              "accent2": (90, 170, 255), "panel": (28, 30, 36), "line": (70, 74, 82)},
    # saturated LED field (Stripe ONIexChUpuw purple, Xiaomi chapter colours)
    "field": {"bg": (118, 24, 196), "ink": (255, 255, 255), "sub": (220, 200, 245), "accent": (255, 214, 90),
              "accent2": (120, 230, 255), "panel": (96, 16, 168), "line": (190, 150, 240)},
}
SERIES = [(66, 133, 244), (234, 67, 53), (251, 188, 5), (52, 168, 83), (171, 71, 188), (0, 172, 193)]

_FONTS = {
    "display": ("bahnschrift.ttf", "Bold SemiCondensed"), "display_c": ("bahnschrift.ttf", "Bold Condensed"),
    "num": ("bahnschrift.ttf", "SemiBold"), "num_light": ("bahnschrift.ttf", "Light"),
    "text": ("segoeui.ttf", None), "text_b": ("segoeuib.ttf", None), "light": ("segoeuil.ttf", None),
    "serif": ("georgia.ttf", None), "serif_i": ("georgiai.ttf", None),
    "cjk": ("msyh.ttc", None), "cjk_b": ("msyhbd.ttc", None), "jp": ("YuGothM.ttc", None),
}
_FDIR = pathlib.Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
_fcache: dict = {}


def font(role="text", size=48):
    key = (role, int(size))
    if key not in _fcache:
        name, var = _FONTS[role]
        f = ImageFont.truetype(str(_FDIR / name), int(size))
        if var:
            f.set_variation_by_name(var)
        _fcache[key] = f
    return _fcache[key]


def measure(s, role="text", size=48, tracking=0):
    f = font(role, size)
    l, t, r, b = f.getbbox(s)
    return (r - l) + tracking * max(len(s) - 1, 0), b - t


def text(img, xy, s, role="text", size=48, fill=(0, 0, 0), anchor="la", tracking=0, alpha=1.0):
    """draw text; tracking (px) spaces glyphs manually; alpha < 1 composites through a layer"""
    if alpha <= 0 or not s:
        return
    f = font(role, size)
    if alpha < 1:
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        text(layer, xy, s, role, size, fill, anchor, tracking)
        a = np.asarray(layer).copy(); a[..., 3] = (a[..., 3] * alpha).astype(np.uint8)
        img.paste(Image.fromarray(a), (0, 0), Image.fromarray(a))
        return
    d = ImageDraw.Draw(img)
    if not tracking:
        d.text(xy, s, font=f, fill=fill, anchor=anchor)
        return
    w, _ = measure(s, role, size, tracking)
    x, y = xy
    if anchor[0] == "m": x -= w / 2
    elif anchor[0] == "r": x -= w
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill, anchor="l" + anchor[1])
        x += f.getlength(ch) + tracking


# ------------------------------------------------------------------ timing
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def seg(t, a, b):
    """0..1 progress of t across [a, b]"""
    return clamp((t - a) / max(b - a, 1e-9))


def ease_out(t):     return 1 - (1 - t) ** 3
def ease_in(t):      return t ** 3
def ease_io(t):      return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2
def ease_expo(t):    return 1.0 if t >= 1 else 1 - 2 ** (-10 * t)
def ease_back(t, s=1.4):
    return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2


def lerp(a, b, t):
    return a + (b - a) * t


def mix_rgb(c1, c2, t):
    return tuple(int(round(lerp(x, y, t))) for x, y in zip(c1, c2))


def count(value, t, decimals=0, prefix="", suffix="", thousands=True):
    """count-up string: eased expo so the last digits settle slowly (Apple/Xiaomi numerals)"""
    v = value * ease_expo(clamp(t))
    s = f"{v:,.{decimals}f}" if thousands else f"{v:.{decimals}f}"
    return f"{prefix}{s}{suffix}"


# ------------------------------------------------------------------ masks
def aa_mask(size, draw, ss=2):
    """antialiased L mask: draw(ImageDraw, scale) at ss x size, then downsample"""
    w, h = size
    m = Image.new("L", (w * ss, h * ss), 0)
    draw(ImageDraw.Draw(m), ss)
    return m.resize((w, h), Image.LANCZOS)


def capsule(size, rect, radius=None):
    """stadium / rounded-rect mask; radius None = full capsule (Rivian 82IiXIKkRIA photo windows)"""
    x0, y0, x1, y1 = rect
    r = radius if radius is not None else min(x1 - x0, y1 - y0) / 2
    return aa_mask(size, lambda d, s: d.rounded_rectangle([x0 * s, y0 * s, x1 * s, y1 * s], radius=r * s, fill=255))


def squircle(size, rect, k=0.225):
    """app-icon squircle approximated by a rounded rect with radius k*side (Apple WWDC25 icon portal)"""
    x0, y0, x1, y1 = rect
    return capsule(size, rect, radius=k * min(x1 - x0, y1 - y0))


def _comp(a, b, mask):
    return Image.composite(b, a, mask)


# ------------------------------------------------------------------ transitions: f(a, b, t) -> Image
def t_mosaic(a, b, t, block=60, seed=7):
    """square-block dissolve: blocks flip in random order, each passing through a pixelated mean-colour state.
    Studied: OpenAI DevDay U9mJuUkhUzk 0:20 (wordmark dissolves into LED blocks). PC-98 compatible."""
    w, h = a.size
    gw, gh = math.ceil(w / block), math.ceil(h / block)
    rng = np.random.default_rng(seed)
    order = rng.random((gh, gw)) * 0.8                       # each block starts flipping at order, lasts 0.2
    p = np.clip((t - order) / 0.2, 0, 1)
    small_a = np.asarray(a.resize((gw, gh), Image.BOX), np.float32)
    small_b = np.asarray(b.resize((gw, gh), Image.BOX), np.float32)
    A, B = np.asarray(a, np.float32), np.asarray(b, np.float32)
    flat = np.where((p < 0.5)[..., None], small_a, small_b)
    up = lambda x: np.repeat(np.repeat(x, block, 0), block, 1)[:h, :w]
    P = up(p)[..., None]
    mid = (P > 0) & (P < 1)
    out = np.where(P >= 1, B, A)
    out = np.where(mid, up(flat), out)
    return Image.fromarray(out.astype(np.uint8))


def t_slit(a, b, t, color=(255, 255, 255), y=None):
    """light slit: a thin horizontal line of light grows from the centre (0..0.35), then opens as a wedge
    whose apex sits off the left edge, exposing b (0.35..1). Studied: Samsung Unpacked Nul7mPL7Nt4 12:24."""
    w, h = a.size
    y = h / 2 if y is None else y
    out = a.copy()
    if t < 0.35:
        k = ease_out(t / 0.35)
        half = k * w / 2
        d = ImageDraw.Draw(out)
        d.rectangle([w / 2 - half, y - 2, w / 2 + half, y + 2], fill=color)
        glow = Image.new("L", a.size, 0)
        ImageDraw.Draw(glow).rectangle([w / 2 - half, y - 10, w / 2 + half, y + 10], fill=int(140 * k))
        glow = glow.filter(ImageFilter.GaussianBlur(14))
        return Image.composite(Image.new("RGB", a.size, color), out, glow)
    k = ease_io((t - 0.35) / 0.65)
    apex = (-w * 0.6, y)
    spread = lerp(3, h * 1.6, k)
    poly = [apex, (w + 40, y - spread), (w + 40, y + spread)]
    m = Image.new("L", (w // 2, h // 2), 0)
    ImageDraw.Draw(m).polygon([(x / 2, yy / 2) for x, yy in poly], fill=255)
    m = m.resize(a.size, Image.BILINEAR)                      # half-res mask: soft edge for free, 4x cheaper
    out = _comp(a, b, m)
    rim = Image.new("L", (w // 2, h // 2), 0)                 # light rim along the wedge edges, fading as it opens
    ImageDraw.Draw(rim).line([(poly[1][0] / 2, poly[1][1] / 2), (apex[0] / 2, apex[1] / 2),
                              (poly[2][0] / 2, poly[2][1] / 2)], fill=int(255 * (1 - k)), width=3)
    rim = rim.resize(a.size, Image.BILINEAR).filter(ImageFilter.BoxBlur(2))
    return Image.composite(Image.new("RGB", a.size, color), out, rim)


def t_capsule(a, b, t, start=None):
    """b grows inside a capsule from a small pill to full frame; radius relaxes to 0 at the end.
    Studied: Rivian 82IiXIKkRIA (capsule photo windows on the LED)."""
    w, h = a.size
    sx0, sy0, sx1, sy1 = start or (w * 0.42, h * 0.44, w * 0.58, h * 0.56)
    k = ease_io(t)
    rect = (lerp(sx0, -2, k), lerp(sy0, -2, k), lerp(sx1, w + 2, k), lerp(sy1, h + 2, k))
    r = (1 - k) * min(rect[2] - rect[0], rect[3] - rect[1]) / 2
    return _comp(a, b, capsule(a.size, rect, radius=r))


def t_portal(a, b, t, rect=None):
    """icon portal: b sits inside a squircle on a (rect) and scales up to fill the frame; corners straighten.
    Studied: Apple WWDC25 0_DjDdfqtUE 41:42 (presenter inside an app icon becomes the next scene)."""
    w, h = a.size
    x0, y0, x1, y1 = rect or (w / 2 - 110, h / 2 - 110, w / 2 + 110, h / 2 + 110)
    k = ease_io(t)
    r = (lerp(x0, 0, k), lerp(y0, 0, k), lerp(x1, w, k), lerp(y1, h, k))
    bw, bh = max(1, int(r[2] - r[0])), max(1, int(r[3] - r[1]))
    scale = max(bw / w, bh / h)
    bb = b.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.BILINEAR)
    ox, oy = (bb.width - bw) // 2, (bb.height - bh) // 2
    layer = Image.new("RGB", a.size); layer.paste(bb.crop((ox, oy, ox + bw, oy + bh)), (int(r[0]), int(r[1])))
    rad = (1 - k) * 0.225 * min(bw, bh)
    shadow = capsule(a.size, (r[0] + 6, r[1] + 14, r[2] + 6, r[3] + 14), rad).filter(ImageFilter.GaussianBlur(18))
    base = Image.composite(Image.new("RGB", a.size, (0, 0, 0)), a, shadow.point(lambda v: int(v * 0.35 * (1 - k))))
    return _comp(base, layer, capsule(a.size, r, rad))


def _hblur(img, px):
    px = int(px)
    if px < 2:
        return img
    arr = np.asarray(img, np.float32)
    c = np.cumsum(np.pad(arr, ((0, 0), (px, px), (0, 0)), mode="edge"), axis=1)
    out = (c[:, 2 * px:] - c[:, :-2 * px]) / (2 * px)
    return Image.fromarray(np.clip(out[:, :arr.shape[1]], 0, 255).astype(np.uint8))


def t_push(a, b, t, direction=-1, blur=60):
    """push: a leaves, b enters horizontally; motion blur proportional to speed (eased io)"""
    w, h = a.size
    k = ease_io(t)
    v = abs(math.sin(math.pi * t))                           # speed proxy for blur
    out = Image.new("RGB", a.size)
    dx = int(direction * k * w)
    out.paste(_hblur(a, blur * v), (dx, 0))
    out.paste(_hblur(b, blur * v), (dx - direction * w, 0))
    return out


def t_whip(a, b, t, blur=180):
    """whip pan: blur ramps up on a, switch at the midpoint, ramps down on b (Apple M5 film GriXfu4tL30 1:09)"""
    v = math.sin(math.pi * t) ** 2
    src = a if t < 0.5 else b
    shift = int((t - 0.5) * 2 * 120)
    img = _hblur(src, blur * v)
    return img.transform(img.size, Image.AFFINE, (1, 0, shift, 0, 1, 0), resample=Image.BILINEAR) if shift else img


def t_shape(a, b, t, shape_mask, anchor=None):
    """silhouette expand: a shape (L mask, same size) scales up about anchor until it covers the frame, revealing b.
    Studied: Samsung Nul7mPL7Nt4 52:37 (illustrated peak grows into the partner logo card)."""
    w, h = a.size
    ax, ay = anchor or (w / 2, h / 2)
    s = lerp(1.0, 14.0, ease_in(t))
    m = shape_mask.transform(a.size, Image.AFFINE, (1 / s, 0, ax - ax / s, 0, 1 / s, ay - ay / s), resample=Image.BILINEAR)
    return _comp(a, b, m)


def value_ramp(img, t, to=(0, 0, 0)):
    """background value ramp for brand end cards only (Google I/O o8NiE3XMPrM 115:00, Linear 3:59).
    It is NOT a shot-to-shot crossfade; never use it between scenes."""
    return Image.blend(img, Image.new("RGB", img.size, to), clamp(t))


TRANSITIONS = {"mosaic": t_mosaic, "slit": t_slit, "capsule": t_capsule, "portal": t_portal,
               "push": t_push, "whip": t_whip}


# ------------------------------------------------------------------ graphics
def kinetic_words(img, words, xy, t, role="display", size=96, fill=(0, 0, 0), stagger=0.12, rise=24,
                  anchor="ls", gap=None, accent=None, accent_fill=None):
    """words land one by one with a short rise (Apple M5 'Up to / 5x / faster', Rivian 'This is adventurous').
    accent: index of the word drawn in accent_fill. t in seconds since the line started."""
    f = font(role, size)
    gap = gap if gap is not None else f.getlength(" ")
    total = sum(f.getlength(w_) for w_ in words) + gap * (len(words) - 1)
    x, y = xy
    if anchor[0] == "m": x -= total / 2
    elif anchor[0] == "r": x -= total
    for i, w_ in enumerate(words):
        k = ease_out(seg(t, i * stagger, i * stagger + 0.35))
        if k > 0:
            col = accent_fill if (accent is not None and i == accent and accent_fill) else fill
            text(img, (x, y + (1 - k) * rise), w_, role, size, col, anchor="l" + anchor[1], alpha=k)
        x += f.getlength(w_) + gap


def scrim(img, y0, y1, color=(0, 0, 0), strength=0.7):
    """vertical gradient scrim so type reads over footage"""
    w, h = img.size
    g = np.zeros((h, 1), np.float32)
    g[int(y0):int(y1), 0] = np.linspace(0, strength, int(y1) - int(y0))
    g[int(y1):, 0] = strength
    m = Image.fromarray((np.repeat(g, w, 1) * 255).astype(np.uint8))
    return Image.composite(Image.new("RGB", img.size, color), img, m)


def kpi_row(img, items, t, y=None, ink=(255, 255, 255), sub=(200, 200, 200), size=120, stagger=0.25):
    """three-ish KPIs riding on b-roll: value counts up, caption under (Tesla Investor Day qUQLTciXCBE
    'Holistic Charging Experience' 99% / 1.5M / 99.9%). items: [(value, decimals, prefix, suffix, caption)]."""
    w, h = img.size
    y = y if y is not None else h - 230
    n = len(items)
    for i, (val, dec, pre, suf, cap) in enumerate(items):
        k = seg(t, i * stagger, i * stagger + 1.2)
        if k <= 0:
            continue
        cx = w * (i + 0.5) / n
        text(img, (cx, y), count(val, k, dec, pre, suf), "num", size, ink, anchor="ms", alpha=min(1, k * 3))
        text(img, (cx, y + 52), cap, "text", 34, sub, anchor="ms", alpha=min(1, k * 2))


def type_wall(img, word, t, color, size=520, speed=60, y=None, role="display_c", alpha=1.0):
    """giant word behind the subject sliding slowly (Microsoft Build ceV3RsG946s, Xiaomi 'VLOG', Pixel '10')"""
    w, h = img.size
    tw, th = measure(word, role, size)
    x = w / 2 - tw / 2 + 200 - speed * t
    text(img, (x, y if y is not None else h / 2), word, role, size, color, anchor="lm", alpha=alpha)


def capsule_photo(img, photo, rect, radius=None):
    """place photo cover-cropped into a capsule (Rivian 82IiXIKkRIA)"""
    x0, y0, x1, y1 = [int(v) for v in rect]
    bw, bh = x1 - x0, y1 - y0
    s = max(bw / photo.width, bh / photo.height)
    p = photo.resize((max(1, int(photo.width * s)), max(1, int(photo.height * s))), Image.LANCZOS)
    ox, oy = (p.width - bw) // 2, (p.height - bh) // 2
    layer = Image.new("RGB", img.size); layer.paste(p.crop((ox, oy, ox + bw, oy + bh)), (x0, y0))
    img.paste(_comp(img, layer, capsule(img.size, rect, radius)))


def spec_callouts(img, items, t, color=(30, 30, 30), sub=(120, 120, 120), stagger=0.2):
    """leader lines from points on the product to labels; line draws, then value + caption appear
    (Samsung spec constellation Nul7mPL7Nt4 32:22, Rivian dimensions). items: [((px,py),(lx,ly),value,caption)]"""
    d = ImageDraw.Draw(img)
    for i, ((px, py), (lx, ly), val, cap) in enumerate(items):
        k = ease_out(seg(t, i * stagger, i * stagger + 0.5))
        if k <= 0:
            continue
        ex, ey = lerp(px, lx, k), lerp(py, ly, k)
        d.ellipse([px - 7, py - 7, px + 7, py + 7], outline=color, width=3)
        d.line([(px, py), (ex, ey)], fill=color, width=3)
        if k >= 1:
            k2 = seg(t, i * stagger + 0.5, i * stagger + 0.9)
            right = lx >= px
            anc = "ls" if right else "rs"
            x = lx + (14 if right else -14)
            text(img, (x, ly + 8), val, "num", 64, color, anchor=anc, alpha=k2)
            text(img, (x, ly + 52), cap, "text", 30, sub, anchor=anc, alpha=k2)


def price_split(img, left, right, kicker, price, t, ink=(20, 20, 20), sub=(110, 110, 110), size=700):
    """giant split letterforms part to make room for the price (Rivian 82IiXIKkRIA 'R ... $45,000 ... 2')"""
    w, h = img.size
    k = ease_expo(seg(t, 0.0, 0.9))
    gap = lerp(0, 760, k)
    text(img, (w / 2 - gap / 2, h / 2 + size * 0.36), left, "display", size, ink, anchor="rs")
    text(img, (w / 2 + gap / 2, h / 2 + size * 0.36), right, "display", size, ink, anchor="ls")
    k2 = seg(t, 0.55, 1.1)
    text(img, (w / 2, h / 2 - 70), kicker, "text_b", 34, sub, anchor="ms", tracking=4, alpha=k2)
    text(img, (w / 2, h / 2 + 40), price, "num", 120, ink, anchor="ms", alpha=k2)


def lower_caption(img, title, spec, t, ink=(255, 255, 255), sub=(210, 210, 210), margin=96):
    """DJI-style feature caption bottom-left: CAPS feature name + one spec line (BNEmDcQr6hk)"""
    k = seg(t, 0, 0.4)
    h = img.size[1]
    text(img, (margin, h - margin - 44), title.upper(), "text_b", 30, ink, tracking=3, alpha=k)
    text(img, (margin, h - margin), spec, "text", 28, sub, alpha=k)


def bug(img, label, ink=(255, 255, 255), margin=72):
    """persistent product bug top-left (DJI, Google Pixel)"""
    text(img, (margin, margin), label, "text_b", 26, ink, tracking=2, alpha=0.85)


def bubble_chart(img, rect, data, year, t_in=1.0, colors=None, trail=None, axis=("x", "y"), year_color=None,
                 ink=(40, 40, 40), sub=(150, 150, 150), xlim=(0, 1), ylim=(0, 1), log_x=False):
    """Rosling-style moving bubbles with the year as a giant translucent clock behind the data
    (TED hVimVzgtD6w, BBC jbkSRLYSojo). data: {name: {"x":f(year),"y":f(year),"r":f(year),"g":group}};
    trail: (name, [years]) draws a dotted path of one entity."""
    x0, y0, x1, y1 = rect
    colors = colors or SERIES
    d = ImageDraw.Draw(img, "RGBA")
    text(img, ((x0 + x1) / 2, (y0 + y1) / 2), f"{int(year)}", "num_light", int((y1 - y0) * 0.55),
         year_color or sub, anchor="mm", alpha=0.18)
    d.line([(x0, y1), (x1, y1)], fill=ink, width=2); d.line([(x0, y0), (x0, y1)], fill=ink, width=2)
    text(img, (x1, y1 + 44), axis[0], "text", 28, sub, anchor="rs")
    text(img, (x0 - 20, y0), axis[1], "text", 28, sub, anchor="rs")

    def px(xv, yv):
        if log_x:
            xv = (math.log10(max(xv, 1e-9)) - math.log10(xlim[0])) / (math.log10(xlim[1]) - math.log10(xlim[0]))
        else:
            xv = (xv - xlim[0]) / (xlim[1] - xlim[0])
        yv = (yv - ylim[0]) / (ylim[1] - ylim[0])
        return x0 + xv * (x1 - x0), y1 - yv * (y1 - y0)

    if trail:
        name, years = trail
        e = data[name]
        for yr in years:
            if yr > year:
                break
            cx, cy = px(e["x"](yr), e["y"](yr))
            d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=colors[e["g"]] + (200,))
    for name, e in sorted(data.items(), key=lambda kv: -kv[1]["r"](year)):
        cx, cy = px(e["x"](year), e["y"](year))
        r = e["r"](year) * ease_back(clamp(t_in))
        c = colors[e["g"] % len(colors)]
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c + (190,), outline=(255, 255, 255, 220), width=2)
    if trail:
        e = data[trail[0]]; cx, cy = px(e["x"](year), e["y"](year))
        text(img, (cx + e["r"](year) + 12, cy), trail[0], "text_b", 30, ink, anchor="lm")


def wedge_chart(img, rect, years, base, wedges, k, ink=(30, 30, 30), sub=(130, 130, 130), colors=None,
                ymax=None, labels=True, unit="", fmt="{:.1f}", guard=None):
    """Al Gore stabilisation wedges (TED rDiGYuQicpA): the baseline area, then each reduction wedge is cut out of
    it one beat at a time. base: values per year; wedges: [(name, values per year)] each subtracted from the top.
    k: float number of wedges shown (fractional = the newest wedge sweeping left to right).
    Labels are formatted with fmt and passed through guard (e.g. Evidence.guard) so every printed value is in the
    evidence table; the running end value is shown only between beats, never mid-sweep (2.05556 bug, 07 #12)."""
    g = guard or (lambda s_: s_)
    x0, y0, x1, y1 = rect
    colors = colors or [(242, 140, 40)] + SERIES
    ymax = ymax or max(base) * 1.1
    n = len(years)
    X = [x0 + i * (x1 - x0) / (n - 1) for i in range(n)]
    Y = lambda v: y1 - v / ymax * (y1 - y0)
    d = ImageDraw.Draw(img, "RGBA")
    top = list(base)
    layers = []
    for wi, (name, vals) in enumerate(wedges):
        frac = clamp(k - wi)
        if frac <= 0:
            break
        cut = [v * clamp(frac * (n - 1) - i + 1) for i, v in enumerate(vals)]   # sweep ramps over one segment
        new_top = [a - b for a, b in zip(top, cut)]
        layers.append((name, list(top), new_top, colors[(wi + 1) % len(colors)], frac))
        top = new_top
    d.polygon([(X[0], y1)] + [(X[i], Y(top[i])) for i in range(n)] + [(X[-1], y1)], fill=colors[0] + (255,))
    for i in range(n - 1):                                    # dashed business-as-usual line stays visible
        for j in range(10):
            if j % 2 == 0:
                a_, b_ = j / 10, (j + 1) / 10
                d.line([(lerp(X[i], X[i + 1], a_), Y(lerp(base[i], base[i + 1], a_))),
                        (lerp(X[i], X[i + 1], b_), Y(lerp(base[i], base[i + 1], b_)))], fill=sub, width=3)
    if layers:
        text(img, (X[-1] + 14, Y(base[-1])), g(fmt.format(base[-1]) + unit), "num", 36, sub, anchor="lm")
    for name, hi, lo, c, frac in layers:
        poly = [(X[i], Y(hi[i])) for i in range(n)] + [(X[i], Y(lo[i])) for i in reversed(range(n))]
        d.polygon(poly, fill=c + (235,))
        if labels and frac >= 1:
            mid = n - 1
            text(img, (x1 + 18, (Y(hi[mid]) + Y(lo[mid])) / 2 + 30), name, "text_b", 28, c, anchor="lm")
    d.line([(x0, y1), (x1, y1)], fill=ink, width=2)
    for i in (0, n - 1):
        text(img, (X[i], y1 + 44), str(years[i]), "num", 30, sub, anchor="ms")
    text(img, (X[0] - 14, Y(base[0])), g(fmt.format(base[0]) + unit), "num", 40, ink, anchor="rm")
    if all(frac >= 1 for *_, frac in layers):
        text(img, (X[-1] - 14, Y(top[-1]) - 26), g(fmt.format(top[-1]) + unit), "num", 48, ink, anchor="rs")


def radar(img, center, radius, values, labels, t, color=(52, 168, 83), ink=(40, 40, 40), sub=(140, 140, 140)):
    """pentagon/hexagon radar that grows from the centre (Samsung Unpacked Nul7mPL7Nt4 51:35). values 0..1"""
    cx, cy = center
    n = len(values)
    d = ImageDraw.Draw(img, "RGBA")
    ang = [-math.pi / 2 + 2 * math.pi * i / n for i in range(n)]
    for ring in (0.25, 0.5, 0.75, 1.0):
        d.polygon([(cx + radius * ring * math.cos(a), cy + radius * ring * math.sin(a)) for a in ang],
                  outline=sub + (120,))
    k = ease_back(clamp(t / 0.8))
    pts = [(cx + radius * v * k * math.cos(a), cy + radius * v * k * math.sin(a)) for v, a in zip(values, ang)]
    d.polygon(pts, fill=color + (150,), outline=color + (255,))
    for v, a, lab in zip(values, ang, labels):
        lx, ly = cx + (radius + 60) * math.cos(a), cy + (radius + 60) * math.sin(a)
        text(img, (lx, ly - 12), lab, "text", 28, sub, anchor="mm", alpha=clamp(t * 2))
        text(img, (lx, ly + 24), f"{int(round(v * 100))}", "num", 40, ink, anchor="mm", alpha=clamp(t * 2 - 0.5))


def rank_table(img, rect, columns, headers, focus, t, ink=(30, 30, 30), sub=(150, 150, 150), hi=(226, 84, 46)):
    """rank table, one column per period, the focus entity highlighted in every column
    (Apple WWDC25 0_DjDdfqtUE 'Highest-rated original programs'). columns: [[name,...] best first]"""
    x0, y0, x1, y1 = rect
    nc, nr = len(columns), max(len(c) for c in columns)
    cw, rh = (x1 - x0) / nc, (y1 - y0) / (nr + 1)
    d = ImageDraw.Draw(img)
    for r in range(nr):
        text(img, (x0 - 30, y0 + rh * (r + 1.5)), str(r + 1), "num", 30, sub, anchor="rm")
    for c, col in enumerate(columns):
        k = seg(t, c * 0.15, c * 0.15 + 0.5)
        cx = x0 + cw * (c + 0.5)
        text(img, (cx, y0 + rh * 0.5), headers[c], "num", 32, sub, anchor="mm", alpha=k)
        for r, name in enumerate(col):
            is_f = name == focus
            if is_f and k > 0:
                yy = y0 + rh * (r + 1.5)
                d.rounded_rectangle([cx - cw * 0.44, yy - rh * 0.42, cx + cw * 0.44, yy + rh * 0.42], radius=rh * 0.42,
                                    fill=hi)
            text(img, (cx, y0 + rh * (r + 1.5)), name, "text_b" if is_f else "text", 30,
                 (255, 255, 255) if is_f else ink, anchor="mm", alpha=k)


# ------------------------------------------------------------------ evidence
class Evidence:
    """Every figure on screen comes from an evidence file, in the same format as the PC-98 pack:
    {"key": {"v": "1.5M", "src": "FACT_SHEET section"}, "_extra_tokens": {"v": "2020 2050", "src": ".."}}.
    fig(key) returns the exact text; num(key) splits it for count-ups; guard(s) raises if s holds a digit run
    that is not in any 'v' (so a typo or an invented number cannot ship). Unknown keys raise."""
    _NUM = re.compile(r"^(?P<pre>[^\d\-]*)(?P<num>-?[\d,]*\.?\d+)(?P<suf>.*)$")

    def __init__(self, path):
        self.path = pathlib.Path(path)
        self.data = json.loads(self.path.read_text(encoding="utf-8"))
        self.used = set()
        self.tokens = set()
        for k, row in self.data.items():
            if isinstance(row, dict) and "v" in row:
                self.tokens |= set(re.findall(r"\d[\d,.]*", str(row["v"])))

    def fig(self, key):
        if key not in self.data or key.startswith("_"):
            raise KeyError(f"figure '{key}' not in evidence {self.path.name}")
        self.used.add(key)
        return str(self.data[key]["v"])

    def num(self, key):
        """'$45,000' -> (45000.0, 0, '$', '') ; '99.9%' -> (99.9, 1, '', '%') ; '1.5M' -> (1.5, 1, '', 'M')"""
        m = self._NUM.match(self.fig(key).strip())
        if not m:
            raise ValueError(f"figure '{key}' has no leading number: {self.fig(key)!r}")
        n = m.group("num").replace(",", "")
        dec = len(n.split(".")[1]) if "." in n else 0
        return float(n), dec, m.group("pre"), m.group("suf")

    def guard(self, s):
        for tok in re.findall(r"\d[\d,.]*", s):
            tok = tok.rstrip(".,")
            if tok and tok not in self.tokens and not any(tok in t for t in self.tokens):
                raise ValueError(f"'{tok}' in {s!r} is not in evidence {self.path.name}")
        return s

    def unused(self):
        return sorted(k for k in self.data if not k.startswith("_") and k not in self.used)


# ------------------------------------------------------------------ output
class Writer:
    """frames -> ffmpeg h264 (yuv420p, crf 18). with Writer(path) as wr: wr.add(img)"""
    def __init__(self, path, fps=FPS, size=(W, H), crf=18):
        self.path, self.size, self.n = str(path), size, 0
        self.p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                                   "-s", f"{size[0]}x{size[1]}", "-r", str(fps), "-i", "-", "-c:v", "libx264",
                                   "-preset", "medium", "-crf", str(crf), "-pix_fmt", "yuv420p",
                                   "-movflags", "+faststart", self.path], stdin=subprocess.PIPE)

    def add(self, img):
        if img.size != self.size:
            raise ValueError(f"frame {self.n} is {img.size}, writer expects {self.size}")
        self.p.stdin.write(img.convert("RGB").tobytes()); self.n += 1

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.p.stdin.close(); self.p.wait()
        if self.p.returncode:
            raise RuntimeError(f"ffmpeg exited {self.p.returncode} for {self.path}")


def still(img, path):
    pathlib.Path(path).parent.mkdir(parents=True, exist_ok=True)
    img.save(path)
