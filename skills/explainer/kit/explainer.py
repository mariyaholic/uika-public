"""explainer.py — the Manim scene library for the explainer theme pack (ADR-0035).

The look is 3Blue1Brown-adjacent: a dark canvas, one idea per beat, intuition before
formalism, and equations revealed by construction rather than pasted. This module is the
kit; `examples/template_explainer.py` is a runnable scene.

Requires manim. Render-side guards live in
`skills/video-direction/scripts/manim_guards.py`; call `beat_guard(...)` at each beat's
steady state (after the last build animation, before the hold). Narration reuses
`skills/retro-pixel/kit/vo.py`.
"""
from __future__ import annotations

import json
from pathlib import Path

# --- palette: one dominant (accent) + one second idea (warm); <=6 inks on screen ---
BG = "#0E1116"
INK = "#E6E6E6"
DIM = "#8A94A6"
ACCENT = "#58C4DD"
WARM = "#D8A657"
NEG = "#C75450"
TOKENS = {"bg": BG, "ink": INK, "dim": DIM, "accent": ACCENT, "warm": WARM, "neg": NEG}

SERIF = "Georgia"   # prose / narration on screen
MONO = "Consolas"   # math, coordinates, labels

# Type floor (px at 1080p); the guard asserts it too.
TYPE_FLOOR_PX = 24
OUT_HEIGHT_PX = 1080


def _m():
    """Import manim lazily so the module can be byte-compiled without it installed."""
    import manim
    return manim


def dark(scene):
    """Set the canvas to the pack background."""
    scene.camera.background_color = BG
    return scene


# ------------------------------------------------------------------- text --
def title(text: str, sub: str = ""):
    m = _m()
    t = m.Text(text, font=SERIF, color=INK).scale(1.05)
    if not sub:
        return t
    s = m.Text(sub, font=SERIF, color=DIM).scale(0.55).next_to(t, m.DOWN, buff=0.35)
    return m.VGroup(t, s)


def caption(text: str):
    m = _m()
    return m.Text(text, font=SERIF, color=DIM).scale(0.5).to_corner(m.DR, buff=0.5)


def equation(tex: str, color: str = INK, scale: float = 1.0):
    m = _m()
    return m.MathTex(tex, color=color).scale(scale)


# ------------------------------------------------------------------ build --
def write(scene, mob, run_time: float = 1.0):
    m = _m()
    scene.play(m.Write(mob), run_time=run_time)
    return mob


def reveal_line(scene, eq, part: str, color: str = WARM, run_time: float = 1.2):
    """Colour one substring of an equation after it is on screen — the 'name it' step."""
    piece = eq.get_part_by_tex(part) if hasattr(eq, "get_part_by_tex") else eq
    scene.play(piece.animate.set_color(color), run_time=run_time)
    return eq


def morph_into(scene, old, new, run_time: float = 1.2):
    m = _m()
    scene.play(m.ReplacementTransform(old, new), run_time=run_time)
    return new


def axes_plot(scene, fn, x_range=(-3, 3, 0.05), color: str = ACCENT, at=None):
    m = _m()
    ax = m.Axes(x_range=list(x_range), y_range=(-1, 4, 1), x_length=8, y_length=4).to_edge(m.DOWN, buff=0.8)
    if at is not None:
        ax.move_to(at)
    curve = ax.plot(fn, color=color)
    scene.play(m.Create(ax), run_time=0.6)
    scene.play(m.Create(curve), run_time=1.2)
    return ax, curve


def point_at(scene, ax, fn, x: float, lab: str = "", color: str = WARM):
    m = _m()
    p = ax.coords_to_point(x, fn(x))
    dot = m.Dot(p, color=color)
    scene.play(m.FadeIn(dot, scale=0.5), run_time=0.4)
    if lab:
        scene.play(m.Write(m.Text(lab, font=MONO, color=color).scale(0.5).next_to(dot, m.UR, buff=0.12)))
    return dot


# -------------------------------------------------------------------- sync --
def hold_for(scene, seconds: float):
    scene.wait(max(0.1, seconds))


def beat_guard(scene, *mobjects, name: str = "beat"):
    """Call at a beat's steady state. Imports the guards and fails the RENDER."""
    import sys
    guards_dir = Path(__file__).resolve().parents[2] / "video-direction" / "scripts"
    if str(guards_dir) not in sys.path:
        sys.path.insert(0, str(guards_dir))
    from manim_guards import assert_in_frame, assert_min_text_height  # noqa: E402
    if mobjects:
        assert_in_frame(*mobjects, name=name)
        assert_min_text_height(*mobjects, min_px=TYPE_FLOOR_PX, out_height_px=OUT_HEIGHT_PX, name=name)


# ---------------------------------------------------------------- evidence --
class Evidence:
    """An evidence lock: every figure a scene shows or says must be in the table.

    Table shape: {"figures": {"<id>": {"v": "<exact text>", "src": "<file §section>"}}, "disclosure": "..."}
    """

    def __init__(self, path):
        self.path = Path(path)
        self.data = json.loads(self.path.read_text(encoding="utf-8"))
        self.figures = self.data.get("figures", {})
        self.disclosure = self.data.get("disclosure", "")

    def fig(self, key: str) -> str:
        if key not in self.figures:
            raise KeyError(f"evidence: no figure '{key}' in {self.path.name}")
        return self.figures[key]["v"]

    def src(self, key: str) -> str:
        return self.figures[key]["src"]

    def guard(self, text: str, label: str = "figure") -> str:
        """Refuse to render a digit string that is not printed by the table."""
        allowed = set()
        for f in self.figures.values():
            allowed.add(f["v"])
            allowed.update(str(f["v"]).replace(",", "").split())
        for token in str(text).replace(",", "").split():
            if any(ch.isdigit() for ch in token) and token not in allowed and str(text) not in allowed:
                raise ValueError(f"{label}: '{token}' in '{text}' is not in the evidence table")
        return str(text)
