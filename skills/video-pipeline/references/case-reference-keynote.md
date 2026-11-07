# Case: "Keeper" Reference Keynote (2026-09-30) — how the pipeline came to be

The first keynote the owner accepted. Four renders, each answering the owner's notes. Project folder:
`<ARTIFACTS_ROOT>/<keynote-project>/` (the original script is private and not
published; `skills/retro-pixel/examples/template_keynote.py` shows the same API). Read this to see why each rule exists.

## Brief (raw, from the owner)
Launch-day keynotes for three system families. Convince the viewer with sustainability numbers; technical
impressiveness (Godot Movie Maker, Manim + MiKTeX) only where it carries the message; sound (Python synthesis or
copyright-free); >= 60 s, no scene > 20 s, no dead space, quick transitions, **no simple fades**; PC-98 look from
the reference folder; 3 variants per family, one video at a time; apps headless; don't nitpick at the expense of
what matters. Mid-run the owner added: Japanese theme, expressive female voice, arranged music; then
"portraits are too unhuman — source newer anime art and adopt the PC-98 look"; then selected a consistent presenter character.
Later the goal narrowed: perfect this one video to find the sweet spot for video direction.

## Direction
Creative gates drew a hand per variant (world, constraint, signature, two forbids). Variant 1 ("Keeper"): world = a lighthouse
keeper ("only what the beam touches is real"); constraint = number-last; signature = the caveat is the loudest
beat; forbids = fade-hold-fade, orbit primitives. The metaphor carries the evidence story: the beam reveals
rejected ideas (rocks), the caveat has no light (no live curve), the lamp turns to the viewer for the number.

## v1 — built, gated, rejected
What it had: 16-colour 640x360 canvas, Bayer dither, index-array transitions, evidence-locked digits, FM chiptune,
SAPI voice pitched up, presenter bust converted to PC-98, 5 scenes, 74.7 s. `uika video qa`: PASS (1 warn, peak).
Owner's verdict: "the ending is abrupt, no music is awkward, the voice should be a genuine TTS model, the final
scene had weird audio engineering and was very scuffed, not much impressive statistical showcase."

Causes found by measuring (not guessing):
| Note | Measured cause |
|---|---|
| abrupt ending | last 0.3 s at -14 dB RMS: drums running into a hard cut; no outro |
| "no music" | pad/arp gains 0.05 vs voice 0.9: music ~12 dB under the voice; thin C-G-Am-F loop |
| robotic voice | SAPI Zira pitched with asetrate: chipmunk, not natural |
| scuffed finale | voice said the hero number at 3.6 s, number appeared at 5.0 s; hit + bell + whoosh + full drum entry landed mid-sentence; mix peak 2.0 through tanh -> audible saturation |
| weak statistics | one hero number; the fact sheet had a matched pair, concentration, a scaling law, a pre-declared screen |
| (not noticed by owner) | -92 dB hole at 61.0 s: pads only started on a bar that began inside a section; a mid-bar section start left silence |

## v2 — structural fixes
- Neural voice (Kokoro-82M; owner approved the download), sample reel sent for the owner to pick by ear.
- `score.py`: arranged cue, royal-road progression, written hook, bar-locked sections, resolving ending.
- Mastering: music levelled against the voice and ducked; lookahead limiter + iterative master; no tanh.
- Timing: scene starts on 2 s bar lines; impacts guarded off voice lines; number before voice.
- Four evidence scenes: control-vs-flip duel, N-cell concentration grid (honest negative), MiKTeX scaling law
  plotted, pre-declared screen (metric above a pre-set bar, sample above a pre-set minimum) cleared. Outro with full-body presenter + disclosure.
- Two renders died: a typed caption prefix (a partial number) tripped the digit guard; a 0-width bar crashed PIL at
  90%. Fixes: captions of pre-checked lines skip the guard; empty rects are skipped; **dry run before render**.
Result: QA PASS 0/0, 103.5 s. Owner: "prefer jp voice with english on screen, also some sfx are still
overwhelming", then "a closing card for `<YOUR_ORG>` as a whole".

## v3 — voice language, SFX classes, closing card
- Japanese voice: custom neural TTS model on a remote runner (owner's choice).
  Japanese lines written by hand with numbers as kana
  readings; English stays on screen. Japanese ran ~1.4x longer: two lines were shortened, scenes re-barred.
- SFX: gains replaced by classes relative to the voice (impact -2, accent -9, texture -14 dB); the v2 caveat
  spike (-6 dB half-second) disappeared; loudest half-second is voice over music (-9.8 dB).
- Stamps after a line are timed from the line's end and asserted to fit.
- Closing card: emblem drawn edge by edge, wordmark, tagline, the three product families, disclosure held, palette swapped
  to the brand's gold/green via the per-frame LUT.
Owner: "small nitpick on the blinking eyes animation", then "fix the mouth sync as well, eerily higher fps than
the rest of the video".

## v4 — accepted
- Blink: eyes found from the red iris (dark blobs merged with the bangs), lid = skin copied from below the eye
  (keeps the dither) + lash line; irregular timing with doubles; states held 2-3 frames.
- Mouth: three shapes changed at 10 fps from the mean level of each step (~4 changes/s, min hold 3 frames).
- One render died silently at frame 2977; the QA twin check flagged the frame-count mismatch. Re-run clean.
Owner: "This suffices."

## What generalised
1. Measure the owner's words into causes before touching code.
2. Relations, not absolute levels (music vs voice, SFX classes vs voice).
3. Time things from musical and verbal anchors (bar lines, line ends), never from hand-typed seconds alone.
4. Picture cadence and presenter cadence must match (PC-98 = stepped motion; 30 fps lips look wrong).
5. Every crash class gets a guard or a dry-run; every silent failure gets a check (frame count, holes).
6. The owner is the ears: send reels for voice choice; ask for the worst thing.
