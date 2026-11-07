# 07 — Pitfalls

The idiom's failure modes, and the guard or habit that catches each.

| Defect | Symptom | Fix / guard |
|---|---|---|
| Symbol before intuition | an equation appears and the voice defines it | reorder: picture → name → symbol (02) |
| Two ideas per beat | the viewer cannot say what one beat claimed | split the beat (02) |
| Pasted equation | the maths is read aloud, not explained | reveal by construction (03, `morph_into`) |
| Derived number on screen | a percentage nobody's source prints | put it in the evidence table with its arithmetic, or compute on screen (03, `Evidence.guard`) |
| Overflow | a long label or equation leaves the frame | `assert_in_frame` at the beat steady state (`beat_guard`) |
| Tiny type | labels unreadable at 1080p | `assert_min_text_height` (type floor 24 px) |
| Decoration on data | glow/grid intersects a mark or label | `assert_no_overlap`; keep decoration clear |
| Accents everywhere | sound fatigues; ahas do not land | accent only the 2–3 aha beats (05) |
| Motion for its own sake | spins, swooshes, loops | cut anything that does not teach (04) |
| Stale render | QA warns frame counts differ | re-render; a byte-identical preview is not a separate pass (video-pipeline stage 7) |

## The two questions before "done"
1. **Did the intuition land?** Show it to someone: can they restate the idea before the equation appears?
2. **Did the render pass?** `manim_guards` at every beat steady state, `uika video qa` zero FAIL, and a watch
   via `skills/video-review`. Nothing is "good" from a passing gate — look at it.
