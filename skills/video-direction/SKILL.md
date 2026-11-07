---
name: video-direction
description: Use when planning, prompting, or reviewing AI-generated video, motion graphics, or storyboards — supplies the treatment, style bible, shot-list and review steps that give shots thematic intent instead of crude generic looks. Lets weaker models fill in taste via forms. Also holds the mandatory QA gates and keynote house rules; run before calling any video done.
---

> **uika-oss note:** `uika video`, `uika figure`, `uika ref` and `uika eval` ship with uika-oss (ffmpeg and Playwright are separate installs). The `uika creative ledger|deck|diverge|pick` commands named below are not in uika-oss yet: draw a hand from `skills/creative-gates/deck.json` yourself and note the seed, keep the picks ledger as a plain file, and check wording divergence by reading the candidates side by side.

# Video direction (ADR-0015)

Generators produce generic looks when the prompt is generic. Direction = *decisions written down before generating*. Encode taste as forms the model fills in, so it need not invent taste.

## 1. Treatment (one page)
Logline · theme sentence · emotional arc in 3–5 beats · **why this look** (tie every visual rule to the theme) · length and aspect.

## 2. Style bible (pasted verbatim into every shot prompt)
Palette (named colors) · lens/aspect/grain · lighting logic (source, direction, time of day) · motion language (handheld / locked / slow push) · texture/material · **forbidden list** (e.g. "no glossy 3D, no lens-flare, no stock 'cinematic 4k hyperrealistic' filler").

## 3. Lock characters and world
Reference stills or a fixed descriptor block per character/location, reused word-for-word. Drift comes from re-describing.

## 4. Shot list (table, not prose)
`id | beat | duration s | framing | camera move | lighting | action | transition | audio | prompt`
Rules: every shot serves a beat; camera movement is motivated; one lighting logic per scene; durations vary with pacing; concrete nouns and light direction beat adjectives.
Acceptance on the table itself, before a single frame exists:
- **Durations are not uniform.** All-6-second shots mean no rhythm. Report median and IQR; a flat histogram is a redraw.
- **One transition family** dominates, chosen for what boundaries mean. A sampler of every transition in the kit reads as a
  showreel, not a film.
- **The structure could not serve another subject.** Hand the shot list to a sibling product; if it still works, the piece
  is a template (`skills/creative-gates` Gate B, structure swap test).

## 5. Generate act by act
Style bible prepended each time; route shots to the generator best for the intent (continuous follow vs. insert vs. stylised); generate 2–3 takes, keep the one that fits the *theme*, not the shiniest.

## 6. Notes pass
Assemble a rough cut, then review: does each shot trace to a beat? does the look hold across cuts? does audio carry the arc? Fix worst three, re-cut once.

## Producer-agent pattern
One agent (`*.tower`) holds the treatment and style bible; scouts/impls handle storyboard, cinematography, art direction per shot. Hand back via the handoff block (skills/handoff-protocol).

Sources: multi-agent AI film workflows (invideo storyboard-to-video, smixs/visual-skills), Google Research coherent long-form video work.

## Before the treatment: creativity gates (ADR-0026, ADR-0040)
Do not write a treatment straight from the brief. Run `skills/creative-gates` first: `uika creative ledger` (owner's past picks), draw a hand per candidate with `uika creative deck`, write three divergent candidates, pass `uika creative diverge`, select blind with its RUBRIC. The treatment in step 1 is the winner's expansion, not a first draft.
**Example exposure (Gate E).** Do not open a finished sibling film's shot list or beat table before your own skeleton
exists. Showing an example raises fixation and lowers divergent thinking, measured in designers and in AI-supported
participants (doi:10.1016/0142-694X(91)90003-F; arXiv:2403.11164). Read the kit's API, read the *field list*, write yours,
then compare. Watching a reference film for *tone* is fine; inheriting its structure is the defect.

## QA gates (ADR-0025; mandatory before "done")
1. **Render-side**: call the guards in `scripts/manim_guards.py` at each beat's steady state: `assert_in_frame`, `assert_no_overlap` (decoration vs data), `assert_texts` / `assert_unique` (labels match their data, no duplicates), `assert_min_text_height`. Lookup tables that drive output (SFX cues, beds, labels) must raise on a missing key; never `.get(key, [])`.
2. **Output-side**: `uika video qa <file> --expect-duration <spec s> --against <preview>`; zero FAIL. Keep the clean preview until the final passes; a final byte-identical to its preview is not a separate pass.
3. **Watch it**: `uika video sheet`, then confirm suspects at steady state with `uika video frame` (skills/video-review). Report what you sampled and what you could not check (audio not heard).
4. **Spec vs output**: filename, runtime and beat table are checked against ffprobe; if the spec contradicts itself, fix the spec.

## Keynote house rules (from the launch-keynotes postmortem)
- **Evidence-lock every number**: a table of figure, exact value and source file, and the source named on screen. Nothing on screen that is not in the table.
- **One honest negative per video**: a caveat, a failed market, a not-recommended verdict, designed as a real beat with its source.
- **One graphic carries each claim; cards support it.** The memorable beats were a clock, candles, an equity line and census bars; the forgettable ones were titled boxes of numbers.
- **Decoration never overlaps data.** Title-bar ticks, shines and bevels sit outside the numeral region (`assert_no_overlap`).
- **Size windows to their content**; no half-empty cards. Content is not top-anchored in a tall box.
- **Type floor**: nothing below ~14 px tall at 1080p (`assert_min_text_height`); source lines are dim but readable.
- **Budget build against dwell**: if a quarter of sampled frames show a half-built scene, the reveals are too slow.
- **Audio has an arc and a ceiling**: the bed changes across beats (LRA ≥ 1 LU), SFX cues exist per project, true peak ≤ -1.5 dBTP, and the per-project bed is the one the spec names.
- **The spec is checked against the output**, not the other way round.

## Programmatic keynotes (ADR-0029)
For code-rendered keynotes follow `skills/video-pipeline` (stages, checklists, the reference case study) and a theme pack (`skills/retro-pixel` has a kit and a template). Rules learned there:
- **Number-first**: a figure is on screen at or before the moment it is spoken.
- **Bar-locked**: scenes are whole bars of the score; cuts land on bar lines; no scene over 20 s.
- **SFX by class** under the voice (impact -2, accent -9, texture -14 dB vs speaking RMS); **impacts never on speech**; verdict stamps land after the line.
- **Music is arranged and present**: levelled 3.5 dB under the voice, ducked 5.5 dB while she speaks; it resolves and rings out — the ending is a cadence, never the last frame.
- **One cadence**: characters move in held steps (lips 10 fps, blinks held 2-3 frames) when the look is stepped.
- **Speech language vs caption language** is an explicit decision (e.g. Japanese voice, English on screen).
- **Dry-run every frame** through the guards before encoding; compare decoded frames with the plan after.

## Toolchain
Use `ffmpeg`/`ffprobe` (installed) for assembly and inspection, Pillow and numpy for frame work, and Remotion or Manim for programmatic motion. Inspect outputs with `ffprobe -show_streams` before claiming a render is right. See skills/toolchains.
