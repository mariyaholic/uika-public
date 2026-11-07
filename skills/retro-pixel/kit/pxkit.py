"""pxkit: indexed-colour (16-entry) 640x360 canvas, PC-98 look, guards, transitions, renderer.

Design rules (ADR-0025):
- every digit-bearing string drawn must resolve to the family evidence table (Evidence.check_text)
- lookups that drive output raise (KeyError / GuardError), never silently default
- frames are guarded in-frame every frame; overlap and label-uniqueness on audit frames
"""
import math, os, re, subprocess, sys, json, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 640, 360, 30
MAX_SCENE_S = 20.0
FONT_PATH = r"C:\Windows\Fonts\msgothic.ttc"


class GuardError(AssertionError):
    pass


# ------------------------------------------------------------------ evidence
class Evidence:
    """Family evidence table. fig(id) raises on unknown ids. Digit tokens on screen must be known."""

    def __init__(self, path):
        with open(path, encoding="utf8") as f:
            self.rows = json.load(f)
        self.used = set()
        toks = set()
        for k, r in self.rows.items():
            if k.startswith("_"):
                continue
            for t in re.findall(r"\d[\d,]*(?:\.\d+)?", r["v"]):
                toks.add(t.rstrip(","))
        for t in self.rows.get("_extra_tokens", {}).get("v", "").split():
            toks.add(t)
        self.tokens = toks

    def fig(self, k):
        if k not in self.rows:
            raise KeyError(f"evidence id not in table: {k}")
        self.used.add(k)
        return self.rows[k]["v"]

    def src(self, k):
        return self.rows[k]["src"]

    def check_text(self, s):
        for t in re.findall(r"\d[\d,]*(?:\.\d+)?", s):
            t = t.rstrip(",")
            if len(t) == 1:
                continue  # ordinals / single digits
            if t not in self.tokens:
                raise GuardError(f"number '{t}' in text {s!r} is not in the evidence table")


EV = None


def use_evidence(path):
    global EV
    EV = Evidence(path)
    return EV


def fig(k):
    return EV.fig(k)


# ------------------------------------------------------------------ palette
def _hex(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Pal:
    """Ordered dict of name -> hex. Max 16 entries (PC-98 digital mode)."""

    def __init__(self, entries, alias=None):
        if len(entries) > 16:
            raise GuardError("PC-98 palette is at most 16 colours")
        self.names = [n for n, _ in entries]
        self.rgb = np.zeros((256, 3), np.uint8)
        for i, (_, h) in enumerate(entries):
            self.rgb[i] = _hex(h)
        self.flat = list(self.rgb.reshape(-1))
        self.ix = {n: i for i, n in enumerate(self.names)}
        for a, b in (alias or {}).items():   # a colour name that reuses another entry (16-slot budget)
            self.ix[a] = self.ix[b]

    def c(self, x):
        if isinstance(x, int):
            return x
        if x not in self.ix:
            raise KeyError(f"colour not in palette: {x}")
        return self.ix[x]


# ------------------------------------------------------------------ fonts
_F = {}


def font(size=16, prop=True):
    key = (size, prop)
    if key not in _F:
        _F[key] = ImageFont.truetype(FONT_PATH, size, index=1 if prop else 0,
                                     layout_engine=ImageFont.Layout.BASIC)
    return _F[key]


BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]])
_BM = {}


def bayer_mask(level):
    """full-frame 1-bit mask, level 0..16 of 16 pixels lit (aligned to the global grid)."""
    level = max(0, min(16, int(round(level))))
    if level not in _BM:
        yy, xx = np.mgrid[0:H, 0:W]
        m = (BAYER4[yy % 4, xx % 4] < level)
        _BM[level] = Image.fromarray((m * 255).astype(np.uint8), "L").convert("1")
    return _BM[level]


# ------------------------------------------------------------------ canvas
class Cv:
    def __init__(self, pal, bg="black"):
        self.pal = pal
        self.im = Image.new("P", (W, H), pal.c(bg))
        self.im.putpalette(pal.flat)
        self.d = ImageDraw.Draw(self.im)
        self.boxes = []          # (kind, tag, x0, y0, x1, y1, text)
        self.free_scroll = False  # boxes may leave the frame (camera scenes)

    # -- shapes
    def _box(self, kind, tag, x0, y0, x1, y1, text=""):
        self.boxes.append((kind, tag, int(x0), int(y0), int(x1), int(y1), text))

    def rect(self, x0, y0, x1, y1, fill=None, outline=None, tag="panel", track=True):
        if int(x1) <= int(x0) or int(y1) <= int(y0):
            return                      # empty (e.g. a bar at 0% of its growth): nothing to draw or track
        f = None if fill is None else self.pal.c(fill)
        o = None if outline is None else self.pal.c(outline)
        self.d.rectangle([int(x0), int(y0), int(x1) - 1, int(y1) - 1], fill=f, outline=o)
        if track:
            self._box("rect", tag, x0, y0, x1, y1)

    def line(self, x0, y0, x1, y1, c, w=1, tag="decor", track=False):
        self.d.line([int(x0), int(y0), int(x1), int(y1)], fill=self.pal.c(c), width=w)
        if track:
            self._box("line", tag, min(x0, x1), min(y0, y1), max(x0, x1) + 1, max(y0, y1) + 1)

    def poly(self, pts, fill=None, outline=None):
        self.d.polygon([(int(x), int(y)) for x, y in pts],
                       fill=None if fill is None else self.pal.c(fill),
                       outline=None if outline is None else self.pal.c(outline))

    def ellipse(self, x0, y0, x1, y1, fill=None, outline=None):
        self.d.ellipse([int(x0), int(y0), int(x1), int(y1)],
                       fill=None if fill is None else self.pal.c(fill),
                       outline=None if outline is None else self.pal.c(outline))

    def px(self, x, y, c):
        if 0 <= x < W and 0 <= y < H:
            self.im.putpixel((int(x), int(y)), self.pal.c(c))

    def dither(self, x0, y0, x1, y1, c, level):
        """ordered-dither fill: level 0..16 pixels of every 4x4 tile lit with colour c."""
        box = (max(0, int(x0)), max(0, int(y0)), min(W, int(x1)), min(H, int(y1)))
        if box[2] <= box[0] or box[3] <= box[1]:
            return
        self.im.paste(self.pal.c(c), box, bayer_mask(level).crop(box))

    def grad_v(self, x0, y0, x1, y1, c_top, c_bot, steps=16):
        """vertical dithered gradient c_top -> c_bot."""
        hgt = y1 - y0
        self.rect(x0, y0, x1, y1, fill=c_top, track=False)
        for i in range(steps):
            ya = y0 + hgt * i // steps
            yb = y0 + hgt * (i + 1) // steps
            self.dither(x0, ya, x1, yb, c_bot, 16 * (i + 0.5) / steps)

    # -- text
    def text(self, x, y, s, c="white", size=16, prop=True, scale=1, anchor="l", tag="data",
             shadow=None, guard=True, clip_ok=None, bold=False):
        if guard and EV is not None:
            EV.check_text(s)
        f = font(size, prop)
        l, t, r, b = f.getbbox(s)
        w, h = max(1, r), max(1, b)
        m = Image.new("1", (w, h), 0)
        ImageDraw.Draw(m).text((0, 0), s, font=f, fill=1)
        if scale != 1:
            m = m.resize((w * scale, h * scale), Image.NEAREST)
            w, h = w * scale, h * scale
        if anchor == "c":
            x = x - w // 2
        elif anchor == "r":
            x = x - w
        x, y = int(x), int(y)
        if shadow is not None:
            self.im.paste(self.pal.c(shadow), (x + scale, y + scale), m)
        if bold:
            self.im.paste(self.pal.c(c), (x + 1, y), m)
        self.im.paste(self.pal.c(c), (x, y), m)
        eff = h  # rendered height in native px; guard: no glyph rows below 8 px
        if size * scale < 8:
            raise GuardError(f"text too small ({size * scale}px): {s!r}")
        self._box("text", tag, x, y, x + w, y + h, s)
        return (x, y, x + w, y + h)

    def text_w(self, s, size=16, prop=True, scale=1):
        return font(size, prop).getbbox(s)[2] * scale

    # -- composite helpers
    def paste_arr(self, arr, x, y, key=None):
        src = Image.fromarray(arr, "P")
        src.putpalette(self.pal.flat)
        mask = None if key is None else Image.fromarray(((arr != self.pal.c(key)) * 255).astype(np.uint8), "L")
        self.im.paste(src, (int(x), int(y)), mask)

    def arr(self):
        return np.array(self.im, dtype=np.uint8)

    # -- guards
    def check_frame(self, where=""):
        if self.free_scroll:
            return
        for kind, tag, x0, y0, x1, y1, s in self.boxes:
            if tag in ("scroll", "bg", "fx"):
                continue
            if x0 < 0 or y0 < 0 or x1 > W or y1 > H:
                raise GuardError(f"{where}: {kind}[{tag}] out of frame ({x0},{y0},{x1},{y1}) {s!r}")

    def check_overlap(self, tag_a="decor", tag_b="data", where=""):
        A = [b for b in self.boxes if b[1] == tag_a]
        B = [b for b in self.boxes if b[1] == tag_b]
        for a in A:
            for b in B:
                if a[2] < b[4] and b[2] < a[4] and a[3] < b[5] and b[3] < a[5]:
                    raise GuardError(f"{where}: {tag_a} {a[2:6]} overlaps {tag_b} {b[2:6]} {b[6]!r}")

    def check_unique(self, tag="label", where=""):
        seen = {}
        for b in self.boxes:
            if b[1] == tag and b[0] == "text":
                seen[b[6]] = seen.get(b[6], 0) + 1
        dup = [k for k, v in seen.items() if v > 1]
        if dup:
            raise GuardError(f"{where}: duplicate {tag} texts {dup}")

    def check_text_overlap(self, where=""):
        """no two text boxes may overlap (data collisions)."""
        T = [b for b in self.boxes if b[0] == "text" and b[1] in ("data", "label", "caption")]
        for i in range(len(T)):
            for j in range(i + 1, len(T)):
                a, b = T[i], T[j]
                if a[2] < b[4] and b[2] < a[4] and a[3] < b[5] and b[3] < a[5]:
                    raise GuardError(f"{where}: text collision {a[6]!r} x {b[6]!r}")


# ------------------------------------------------------------------ easing
def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in(t):
    t = clamp(t)
    return t ** 3


def ease_io(t):
    t = clamp(t)
    return 3 * t * t - 2 * t ** 3


def lerp(a, b, t):
    return a + (b - a) * t


def seg(t, a, b):
    """progress of t inside [a,b] clamped 0..1"""
    return clamp((t - a) / (b - a)) if b > a else (1.0 if t >= b else 0.0)


def typed(s, t, t0, cps=28):
    n = int(max(0, (t - t0)) * cps)
    return s[:n]


# ------------------------------------------------------------------ PC-98 furniture
def window(cv, x, y, w, h, title=None, face="gray", hi="white", lo="dgray", edge="black", tbar="blue",
           tcol="white", tag="panel"):
    """beveled PC-98 style window; title bar sits above content, content area returned."""
    cv.rect(x, y, x + w, y + h, fill=face, outline=edge, tag=tag)
    cv.line(x + 1, y + 1, x + w - 2, y + 1, hi)
    cv.line(x + 1, y + 1, x + 1, y + h - 2, hi)
    cv.line(x + 1, y + h - 2, x + w - 2, y + h - 2, lo)
    cv.line(x + w - 2, y + 1, x + w - 2, y + h - 2, lo)
    top = y + 3
    if title:
        cv.rect(x + 3, y + 3, x + w - 3, y + 17, fill=tbar, track=False)
        cv.text(x + 7, y + 3, title, tcol, size=12, tag="label", guard=False)
        top = y + 19
    return (x + 4, top, x + w - 4, y + h - 4)


def brick(cv, x0, y0, x1, y1, c1, c2, bw=16, bh=8):
    """PC-98 brick fill"""
    cv.rect(x0, y0, x1, y1, fill=c1, track=False)
    for r, yy in enumerate(range(int(y0), int(y1), bh)):
        cv.line(x0, yy, x1 - 1, yy, c2)
        off = (bw // 2) if r % 2 else 0
        for xx in range(int(x0) - off, int(x1), bw):
            if x0 <= xx < x1:
                cv.line(xx, yy, xx, min(yy + bh, y1) - 1, c2)


def wrap(s, n):
    out, cur = [], ""
    for wd in s.split():
        if len(cur) + len(wd) + (1 if cur else 0) > n:
            out.append(cur)
            cur = wd
        else:
            cur = (cur + " " + wd) if cur else wd
    if cur:
        out.append(cur)
    return out


# ------------------------------------------------------------------ transitions (on index arrays)
def _blocks(seed=11, bs=16):
    rng = random.Random(seed)
    gx, gy = W // bs, math.ceil(H / bs)
    order = list(range(gx * gy))
    rng.shuffle(order)
    rank = np.zeros((gy, gx))
    for r, i in enumerate(order):
        rank[i // gx, i % gx] = r / len(order)
    return np.kron(rank, np.ones((bs, bs)))[:H, :W]


_BLK = {}


def transition(kind, a, b, p, pal=None):
    """a,b: uint8 index arrays; p: 0..1 progress; returns array. No cross-fades."""
    p = clamp(p)
    if kind == "cut":
        return b if p >= 0.0 else a
    yy, xx = np.mgrid[0:H, 0:W]
    if kind == "wipe_r":       # B enters from the right with a dithered edge
        edge = W * (1 - p)
        m = xx > edge - 8 * (BAYER4[yy % 4, xx % 4] / 16.0)
        return np.where(m, b, a)
    if kind == "wipe_l":
        edge = W * p
        m = xx < edge + 8 * (BAYER4[yy % 4, xx % 4] / 16.0)
        return np.where(m, b, a)
    if kind == "wipe_u":
        edge = H * (1 - p)
        m = yy > edge - 6 * (BAYER4[yy % 4, xx % 4] / 16.0)
        return np.where(m, b, a)
    if kind == "mosaic":
        key = 16
        if key not in _BLK:
            _BLK[key] = _blocks(11, 16)
        return np.where(_BLK[key] < p, b, a)
    if kind == "shutter":      # venetian blinds, 12 px bands
        band = (yy % 24)
        m = band < 24 * p
        return np.where(m, b, a)
    if kind == "scan":         # a scanline sweeps down; B is above it, a bright line at the edge
        edge = int(H * p)
        out = np.where(yy < edge, b, a)
        out[np.clip(edge - 1, 0, H - 1):np.clip(edge + 2, 0, H), :] = 15 if pal is None else pal.c("white")
        return out
    if kind == "iris":
        r = p * math.hypot(W, H) / 2
        m = (xx - W / 2) ** 2 + (yy - H / 2) ** 2 < r * r
        return np.where(m, b, a)
    if kind == "push_l":       # A slides out left, B follows: hard push, no fade
        s = int(W * p)
        out = np.empty_like(a)
        out[:, :W - s] = a[:, s:]
        out[:, W - s:] = b[:, :s]
        return out
    if kind == "push_u":
        s = int(H * p)
        out = np.empty_like(a)
        out[:H - s, :] = a[s:, :]
        out[H - s:, :] = b[:s, :]
        return out
    if kind == "flash":        # 2-frame palette flash: white, then B
        if p < 0.5:
            return np.full_like(a, 15 if pal is None else pal.c("white"))
        return b
    raise KeyError(f"unknown transition {kind}")


# ------------------------------------------------------------------ video
class Scene:
    def __init__(self, name, dur, fn, out=("cut", 0)):
        if dur > MAX_SCENE_S:
            raise GuardError(f"scene {name} lasts {dur}s > {MAX_SCENE_S}s")
        self.name, self.dur, self.fn, self.out = name, dur, fn, out


class Video:
    def __init__(self, name, pal, scenes, bg="black"):
        self.name, self.pal, self.scenes, self.bg = name, pal, scenes, bg
        self.lut_fn = None   # optional f(frame)->(256,3) uint8 palette (PC-98 palette cycling)
        t = 0.0
        self.starts = []
        for i, s in enumerate(scenes):
            self.starts.append(t)
            d = s.out[1] / FPS if i < len(scenes) - 1 else 0.0
            t += s.dur - d
        self.total = t
        # timeline for the beat table
        self.table = [(s.name, self.starts[i], self.starts[i] + s.dur) for i, s in enumerate(scenes)]

    def frame(self, f, audit=False):
        t = f / FPS
        idx = 0
        for i, st in enumerate(self.starts):
            if t >= st - 1e-9:
                idx = i
        s = self.scenes[idx]
        tl = t - self.starts[idx]

        def draw(scene, tloc, where):
            cv = Cv(self.pal, self.bg)
            scene.fn(cv, tloc, tloc + 0.0)
            cv.check_frame(where)
            if audit:
                cv.check_overlap("decor", "data", where)
                cv.check_unique("label", where)
                cv.check_text_overlap(where)
            return cv

        cv = draw(s, tl, f"{s.name}@{t:.2f}")
        arr = cv.arr()
        # the transition out of the previous scene overlaps the first d frames of this one
        if idx > 0:
            prev = self.scenes[idx - 1]
            kind, d = prev.out
            if d > 0 and tl < d / FPS:
                p = tl / (d / FPS)
                cva = draw(prev, t - self.starts[idx - 1], f"{prev.name}@out")
                arr = transition(kind, cva.arr(), arr, p, self.pal)
        return arr

    def n_frames(self):
        return int(round(self.total * FPS))


def _crt_filter():
    # nearest x3, scanlines (dark third row), tiny bloom, faint vignette
    return ("scale=1920:1080:flags=neighbor,"
            "drawgrid=w=0:h=3:x=0:y=2:t=1:c=black@0.28,"
            "split[a][b];[b]gblur=sigma=2.5[c];[a][c]blend=all_mode=screen:all_opacity=0.07,"
            "vignette=angle=0.3,format=yuv420p")


def render_silent(video, out_mp4, audit_every=15, crf=17, limit=None, progress=True):
    """pipe indexed frames through the palette to ffmpeg; returns frame count"""
    n = video.n_frames() if limit is None else limit
    lut0 = video.pal.rgb
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-vf", _crt_filter(), "-c:v", "libx264", "-preset", "medium",
           "-crf", str(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", out_mp4]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for f in range(n):
            arr = video.frame(f, audit=(f % audit_every == 0))
            lut = video.lut_fn(f) if video.lut_fn else lut0
            p.stdin.write(lut[arr].tobytes())
            if progress and f % 300 == 0:
                print(f"  frame {f}/{n}", flush=True)
    finally:
        p.stdin.close()
        p.wait()
    if p.returncode != 0:
        raise RuntimeError("ffmpeg failed")
    return n


def dump_frame(video, t, path, audit=True):
    f = int(round(t * FPS))
    arr = video.frame(f, audit=audit)
    lut = video.lut_fn(f) if video.lut_fn else video.pal.rgb
    im = Image.fromarray(lut[arr]).resize((W * 2, H * 2), Image.NEAREST)
    im.save(path)
