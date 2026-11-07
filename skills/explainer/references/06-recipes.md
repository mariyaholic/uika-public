# 06 — Recipes

Step-by-step builds. Each ends at a beat's steady state, where `beat_guard` runs.

## Intuition opener (no symbols)
1. `dark(self)`; write a one-line `title` that states the *question*, not the topic.
2. Draw the concrete case as geometry (a bar, a length, a shape) in `ACCENT`.
3. Hold; `beat_guard(self, group, name="intuition")`.
4. Voice explains why this case is surprising. No equation yet.

## Equation reveal (by construction)
1. Left-hand side only: `eq_l = equation(r"P(t) =")`; `write`.
2. Build the right-hand side as a picture (a growth factor as a repeated scaling).
3. `morph_into(scene, picture, eq_full)`; the equation is now a *summary* of what just happened.
4. `reveal_line(scene, eq_full, "g", color=WARM)` — the rate is the idea.
5. `beat_guard(self, VGroup(eq_full), name="formalise")`.

## Plot walk
1. `ax, curve = axes_plot(self, fn, x_range=…)`.
2. `point_at(self, ax, fn, x, label)` at the interesting x; voice reads the value.
3. Dim the rest of the curve; keep the marked point bright.
4. `beat_guard(self, VGroup(ax, curve), name="plot")`.

## Payoff + close
1. Re-show the hook's case, now annotated with the explained result (`EV.guard` every number).
2. One line of summary; hold ≥ 2 s; end on the bed's cadence — never the last frame.

## The `Template` scene
`skills/explainer/examples/template_explainer.py` builds all three beats of a minimal explainer; copy it and grow.
