# 03 — Equations and figures

## Reveal by construction
An equation should arrive in the order it is understood. Build it, don't paste it.
1. Show the quantity as a picture (a length, an area, a rate).
2. Write the left-hand side; say what it names.
3. Let the construction produce the right-hand side (something transforms, extends, or is counted).
4. Colour the one part that carries the insight (`reveal_line(..., color=WARM)`).

`MathTex` built from **several pieces** is easier to reveal piece by piece than one long string; split on
the symbols you intend to introduce, then `morph_into` between forms (discrete → continuous, sum → integral).

## Graphing
- `axes_plot(scene, fn, x_range=…)` returns `(ax, curve)`; `point_at(scene, ax, fn, x, label)` marks a value.
- One curve, one accent colour. A second comparison gets `WARM`, never a third hue.
- Label the axes with `MONO`; keep the reading in the voice.

## Evidence-lock every figure
```python
from explainer import Evidence
EV = Evidence("evidence/population.json")
label = EV.fig("population")     # exact text from the table
EV.guard(label)                  # raises if the string carries a digit the table does not print
```
- The table names ONE source file and the section for each figure (`src`).
- No derived numbers. If you must show a ratio, put the ratio in the table **with the arithmetic in the
  source note**, or compute it on screen as part of the explanation (then it is derived, and shown as such).
- Name the source on screen once, small, in `DIM`.
