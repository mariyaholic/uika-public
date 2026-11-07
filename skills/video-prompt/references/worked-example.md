# Worked example: the first pack (latch, 2026-10-18/19)

The first use of this format was an experiment, not a deliverable. It is documented because the *gaps* are
the skill's justification: they are the class of defect prose prompts produce and typed packs can catch.

## Setup

- Pack: `<YOUR_REPO>/vprompt-test/pack/latch.vprompt.md` (frozen; sha256 `D5C2456C…D83407`).
- Inputs, copied hermetic: the 20 s bed, `latch.timing.json` (spectrogram analysis), `latch_evidence.json`.
- Renderer: a fresh subagent, four-section brief, forbidden from `promo-v4/`, any prior film, posters,
  sheets, and `uika find`. It saw the pack, the `skills/retro-pixel` kit, and the three inputs.
- Reference: the v4 film, measured only after the blind build finished.

## Result

The blind film is a valid sibling of the v4 film:

| measurement | v4 | blind |
|---|---|---|
| `uika video qa` | PASS 0 fail | PASS 0 fail, 600 frames, 20.0 s, 1920×1080 |
| scenes / cuts | 6 / 5 at 5.000, 9.767, 12.500, 15.000, 17.500 | identical |
| median share · entropy | 0.1308 · 0.9712 | identical |
| axes vs 2026-10-17 archive | 6 differ | 6 differ, distance 0.567 |
| strings, palette, chrome, reveals | — | every fixed item matched |
| loudness / peak | −13.5 LUFS / −2 dBFS | −13.5 LUFS / −2 dBFS |

The free list did its job: trace shape, dial ticks, wobble phase, waterfall tiling and blink cadence all
varied sensibly without touching the film's intent. A pack that fixes everything produces a template; one
that fixes the meaning and frees the craft produces a sibling.

## The thirteen gaps (each became a rule)

| # | gap in the pack | rule | what the blind renderer chose |
|---|---|---|---|
| 1 | `240 Hz OFF` placed inside the window title bar, on top of `LIVE` | L6 | moved it down one row |
| 2 | scene label "at plate +(0,0)" lands on the frame border | L6 | first free row under the bar |
| 3 | 32 spectrum bars indexed `max(band[2i], band[2i+1])` overruns a 48-band vector | L7 | re-indexed `int(i*48/32)` |
| 4 | 48 bands × 3 px cannot fit the fixed 34 px waterfall well | L7 | max-pooled to 11 rows |
| 5 | waterfall content underspecified: which audio, from which frame, swept or not | L2, L10 | bed to date, swept in over 8 frames |
| 6 | the acceptance gate is invisible: a >~4 % one-frame area pop counts as a cut | L8 | stepped the logotype, hero and plate so the detector stays quiet |
| 7 | caveat lines "appearing" at 0.55/0.85 — instant or typed? | L2 | typewritten at 38 cps |
| 8 | §4 colour law (red = fault until frame 293, never again) vs §5 "name tab: red" | precedence, L5 | pin tab `dgreen`; v4's red tab broke the law |
| 9 | the hero numeral has no reveal time | L2 | first beat (0.105 s) — 0.7 s earlier than v4 |
| 10 | `PINNED` box fixed at 30 px, the ×2 glyph is 28–32 px | L6, L7 | box at 30, glyph centred and overhanging 1 px |
| 11 | "3 px shadow" at scale ×5: 3 native px or 3 glyph px? | L2, L6 | scaled interpretation |
| 12 | §3 "on the beat grid" vs §7's explicit non-beat times | L3 | §7 won; the one free element went on the beat |
| 13 | review stills 5.20 / 10.00 / 13.00 / 15.20 fall inside the pack's own staggers | L9 | kept the times, reported the stills honestly |

Separately, the pack's own "beat 1 (t ≥ 0.045)" was a typo — beat *index* 1 is 0.673 s. The authoring
audit caught it; L3 catches it mechanically.

The renderer's 26-entry decision log split into **11 true gaps, 3 contradictions/tensions, 11 genuinely
free choices, 1 measured fact** — no noise. The free choices are the healthy kind: they are exactly what
the pack's §10 listed.

## What the exercise found in the shipped v4

1. **Spectrum clamp bug.** v4 wrote `bands[min(47, 2*i)]`, so bars 24–31 of every v4 film are the top band
   repeated — a flat tail whenever the high band has energy. The blind film is correct.
2. **Colour-law violation.** v4 keeps the red VN name tab after the red→green turning point, breaking the
   hand CONSTRAINT it claims to obey. The blind film obeys it.
3. **Review stills inside staggers.** v4's 15.2 s caveat still is an empty amber card (the triangle lands
   at 15.3 s). Stills must be generated at reveal + hold.

None of these were caught by v4's mechanical QA; all three are caught by a pack + sufficiency test.

## What this means for the author

- Write the pack **before** the renderer writes code. The v4 pass had no written prompt: its `PLAN.md` was
  written *after* the films, which makes it a review record, not a prompt.
- If a check is mechanical, put it in the pack as a check. Adjectives ("centred", "appearing", "roughly")
  are where the renderer starts guessing.
- The author may dump stills from the theme kit to test feasibility; that is not making the film. The
  renderer may not read a prior film; that is not writing from the pack.
- Budget: the blind build was one agent, one film, no repo context. The cost is one render and one log;
  the return is a defect list that would otherwise surface as an owner rejection.

Reproduce: `<YOUR_REPO>/vprompt-test/{pack,blind,measure}`; the film is `blind/out/latch_blind.mp4`, the
fidelity record `measure/FINDINGS.md`, the pairs `measure/pairs_1.png` and `pairs_2.png`.
