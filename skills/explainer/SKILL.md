---
name: explainer
description: Use when a topic must be taught rather than announced — a 3Blue1Brown-adjacent explainer video (dark canvas, intuition before formalism, one idea per beat, equations revealed by construction, narration synced to beats). A theme pack with a Manim scene library (kit/), a runnable template, and a reference library for the idiom. Needs Manim. Use with skills/video-pipeline for the workflow and skills/video-direction for the beat table.
---

# Explainer theme pack (ADR-0035)

The look is **one idea per beat, intuition before formalism**: show the shape, then name it, then write the
symbol. Equations are *revealed by construction* (something moves to make them true), never pasted whole.
Text is sparse; the picture carries the idea and the voice carries the argument.

This is a **Manim-native** pack. The other two packs (`retro-pixel`, `keynote-launch`) render Pillow frames;
here scenes are Manim `Scene` classes. It reuses `skills/video-direction/scripts/manim_guards.py` for
render-side guards and `skills/retro-pixel/kit/vo.py` for narration.

Library: `uika ref show explainer-reference` → `<ARTIFACTS_ROOT>/media/references/video/explainer`. This
collection is **planned, not gathered yet** (ADR-0035 reserved its home); no study sources exist. Study only;
frames are never redistributed.

## Quick path
```
copy skills/explainer/examples/template_explainer.py + evidence_template.json into <project>/<video>/
manim -ql template_explainer.py ExplainerTemplate    # fast preview; LOOK at it
manim -qh template_explainer.py ExplainerTemplate    # 1080p render (guards run per beat)
uika video qa <project>/media/videos/template_explainer/1080p60/ExplainerTemplate.mp4 --expect-duration <s>
```
Needs: Python 3.11+ and **manim**, ffmpeg/ffprobe on PATH, and Kokoro (`KOKORO_DIR`) for
the voice. The guards run inside the scene, so a render that finishes has passed them. If manim is absent,
the pack can be authored but not rendered — a video is not "done" until it renders and passes `uika video qa`
(ADR-0035).

## The kit (`kit/explainer.py`)
| Layer | Provides |
|---|---|
| tokens | `TOKENS` (bg, ink, dim, accent, warm, neg), `SERIF`, `MONO` |
| text | `title`, `caption`, `equation` |
| build | `write`, `reveal_line`, `morph_into`, `axes_plot`, `point_at` |
| sync | `hold_for`, `beat_guard` (calls `manim_guards` at a beat's steady state) |
| evidence | `Evidence(path)`: `fig`, `num`, `guard` (rejects digits not in the table) |

## References (read in order the first time)
1. `references/01-look.md` — canvas, palette budget, type, the "one idea per beat" law
2. `references/02-beats.md` — the beat table for teaching: hook → intuition → name → formalise → payoff → close
3. `references/03-equations-and-figures.md` — reveal-by-construction, graphing, evidence-locking figures
4. `references/04-motion.md` — pacing, what to animate, transforms as argument, what never to animate
5. `references/05-sound.md` — narration-led timing, the bed, when silence is the accent
6. `references/06-recipes.md` — step-by-step builds (intuition opener, equation reveal, plot walk, summary card)
7. `references/07-pitfalls.md` — the idiom's failure modes and the guard for each

## Non-negotiables
- **Intuition precedes formalism.** A symbol appears only after the picture has made it inevitable.
- **One idea per beat.** The screen holds one claim; everything else is dimmed or gone.
- **Reveal, don't paste.** Build an equation or graphic by construction; the motion is the explanation.
- **Evidence-lock figures.** Every number comes from `evidence/<family>.json`; `EV.guard` rejects the rest.
- **Guard at steady state.** Call `beat_guard` after the last build animation of every beat, before the hold.
- **Quiet sound.** Narration leads; the bed sits under it and resolves; accents land on the 2–3 aha beats only.
