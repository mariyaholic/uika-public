"""template_explainer.py — a runnable three-beat explainer scene (ADR-0035).

Copy this beside `evidence_template.json` into <project>/<video>/ and run:
    manim -ql template_explainer.py ExplainerTemplate     # fast preview; LOOK at it
    manim -qh template_explainer.py ExplainerTemplate     # 1080p render (guards run per beat)
    uika video qa <project>/media/videos/template_explainer/1080p60/ExplainerTemplate.mp4 --expect-duration <s>

Requires manim. The guards run *inside* the scene, so a render that
finishes is a render that passed them.
"""
from __future__ import annotations

import sys
from pathlib import Path

from manim import Scene, FadeOut, VGroup, UP

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "kit"))
import explainer as X  # noqa: E402


class ExplainerTemplate(Scene):
    def construct(self):
        X.dark(self)

        # Beat 1 — intuition: the shape before the name. One idea on screen.
        head = X.title("Why small growth looks flat", "an intuition, then the maths")
        X.write(self, head, 0.9)
        X.beat_guard(self, head, name="title")
        X.hold_for(self, 2.0)
        self.play(FadeOut(head))

        # Beat 2 — formalise: the equation is revealed by construction, then the curve follows.
        eq = X.equation(r"P(t) = P_0\,(1+g)^t").to_edge(UP, buff=1.0)
        X.write(self, eq, 1.0)
        ax, curve = X.axes_plot(self, lambda x: 1.1 ** max(0.0, x), x_range=(0, 6, 0.1))
        dot = X.point_at(self, ax, lambda x: 1.1 ** max(0.0, x), 3, "now", X.WARM)
        X.beat_guard(self, VGroup(eq, ax, curve, dot), name="equation+plot")
        X.hold_for(self, 3.0)

        # Beat 3 — payoff: one evidence-locked number, then close.
        note = X.caption("8.1 / 1.1 a year")
        X.write(self, note, 0.6)
        X.beat_guard(self, note, name="payoff")
        X.hold_for(self, 1.5)
