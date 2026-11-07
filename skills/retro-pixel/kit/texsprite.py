"""texsprite: typeset a formula with MiKTeX (latex -> dvipng), keep it as a 1-bit mask, draw it in a palette colour.

Headless: latex runs nonstopmode with no installer (only base packages: amsmath), dvipng writes a PNG. Cached by hash.
    m = tex_mask(r"\\left(\\frac{bal}{20000}\\right)^{0.35}", dpi=220)   # PIL "L" mask
    draw_mask(cv, m, x, y, "white", reveal=0.6)                         # left-to-right reveal 0..1
"""
import hashlib, os, subprocess, tempfile
import numpy as np
from PIL import Image

TEX_BIN = os.environ.get("TEX_BIN", "")  # MiKTeX/TeX Live bin dir; empty = use PATH
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(os.environ.get("KEYNOTE_CACHE", os.path.join(os.environ.get("LOCALAPPDATA", HERE), "keynote-cache")),
                     "tex")
os.makedirs(CACHE, exist_ok=True)
DOC = r"""\documentclass[12pt]{article}
\usepackage{amsmath}
\pagestyle{empty}
\begin{document}
$\displaystyle %s$
\end{document}
"""


def tex_mask(expr, dpi=200, thresh=110):
    key = hashlib.sha1(f"{expr}|{dpi}".encode()).hexdigest()[:12]
    png = os.path.join(CACHE, key + ".png")
    if not os.path.exists(png):
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "f.tex"), "w", encoding="utf8") as f:
                f.write(DOC % expr)
            env = dict(os.environ, MIKTEX_AUTOINSTALL="0")
            r = subprocess.run([os.path.join(TEX_BIN, "latex.exe") if TEX_BIN else "latex", "-interaction=nonstopmode", "-halt-on-error",
                                "--disable-installer", "f.tex"], cwd=d, capture_output=True, text=True, env=env,
                               creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            if r.returncode != 0:
                raise RuntimeError("latex failed: " + r.stdout[-800:])
            r = subprocess.run([os.path.join(TEX_BIN, "dvipng.exe") if TEX_BIN else "dvipng", "-D", str(dpi), "-T", "tight", "-bg", "White",
                                "-fg", "Black", "-o", png, "f.dvi"], cwd=d, capture_output=True, text=True,
                               creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            if r.returncode != 0:
                raise RuntimeError("dvipng failed: " + r.stderr)
    g = np.array(Image.open(png).convert("L"))
    return Image.fromarray(((g < thresh) * 255).astype(np.uint8), "L")


def draw_mask(cv, m, x, y, colour, reveal=1.0, shadow=None):
    """paste a 1-bit mask in a palette colour; reveal clips from the left (0..1). Tracks a 'data' box for the guards."""
    w = int(m.width * max(0.0, min(1.0, reveal)))
    if w <= 0:
        return
    mm = m.crop((0, 0, w, m.height))
    if shadow is not None:
        cv.im.paste(cv.pal.c(shadow), (int(x) + 1, int(y) + 1), mm)
    cv.im.paste(cv.pal.c(colour), (int(x), int(y)), mm)
    cv._box("text", "data", x, y, x + m.width, y + m.height, "<tex>")
