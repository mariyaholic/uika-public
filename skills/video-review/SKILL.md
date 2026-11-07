---
name: video-review
description: Use when asked to review, audit, postmortem or QA a generated video, animation or motion piece, when an agent is about to call a video "done", or when you must actually watch a video file. Gives the mechanical gate (uika video qa), the way to look at frames without fooling yourself, the defect taxonomy and the postmortem template.
---

# Video review (ADR-0025)

You cannot watch a file by reading its metadata. Do the mechanical gate first, then look at frames, then write down findings with a root cause each.

## 1. Find the videos (fast)
```
uika video ls <dir> --since 3d        # breadth-first, ~2 s; media/ scratch pruned
```
Do not use `find`/`ls -R` on the artifacts drive: it is slow (a recursive scan took minutes). Deliverables live shallow (`project/out/x.mp4`). Add `--deep` only to include `media/` scene masters.

## 2. Mechanical gate (always, before looking)
```
uika video qa <file> [--expect-duration <spec seconds>] [--against <preview-or-twin>]
```
Checks: streams/size/fps, **decoder errors and decoded-frame count** (a file can play and still lose seconds), spec duration, loudness (-14 LUFS ±2), true peak (≤ -1.0 dBFS), flat dynamics (LRA < 1 = no audio arc), silent stretches, and twin comparison (byte-identical, or one of a pair is damaged). FAIL exits non-zero. A clean pass means "not broken", never "good".
The loudness target is a **delivery** fact, not a standard: -14 LUFS is the streaming-player convention and -23 LUFS is
EBU R 128 broadcast. Report which one the file was mastered for; a file at -23 in a player sequence will sound quiet, and a
broadcast delivery at -14 is out of spec.

## 3. Look (you must see frames, not infer them)
```
uika video sheet <file> --apply              # 12 evenly spaced frames, 4x3 sheet -> read the PNG
uika video sheet <file> --at 5,20,end-3 --apply  # chosen moments (end-N = N s before the end)
uika video frame <file> <t|end-N> [--crop w:h:x:y] [--width 960] --apply   # one full-resolution frame
```
Read the PNG with the Read tool. Then, **for every suspect, confirm at the scene's final hold** with `frame` before calling it a defect. Evenly spaced frames land mid-animation: half-drawn formulas, cards mid-slide and fades look broken and are not (two such false positives happened in the first postmortem). Conversely a static frame cannot prove motion quality; say so when you did not play it.

Zoom-check list (each is a separate glance, at full resolution): text collisions; anything clipped at the frame edge; decoration crossing numbers; labels matching their data; smallest text legible; empty half-cards; what the first and last 2 seconds show.

## 4. Audio: measure, and say you did not listen
You cannot hear audio. Report measurements (loudness, LRA, peak, silence) and correlate two soundtracks with numpy if you suspect a shared bed or missing SFX (`ffmpeg -ac 1 -ar 8000 -f f32le` then correlation). Check the pipeline that built it: lookup tables that drive SFX or beds must have an entry per project; an empty cue list silently produces digital silence (a -91 dB SFX track passes an "audio stream present" gate).

Audio profile (ADR-0029): half-second RMS across the file — holes (< -40 dB mid-programme) are bugs, spikes (> median + 8 dB) must be planned impacts, and the last 4 s must decay rather than stop. Snippet: skills/video-pipeline/references/checklists.md.

**Frame-count WARN is a FILE defect until explained**: a render that dies mid-stream still produces a playable, shorter file. **Presenter check**: crop the presenter at 3x (`uika video frame --crop`) inside a blink and during speech; judge the cadence against the rest of the picture (lips at 10 fps in a stepped look).

## 5. Structural audit (a sibling with new content is a defect)
Quality gates cannot see sameness. Every review therefore includes a **structure census** of the delivered file, next to
the picture and audio checks:
- scene/shot count; shot-duration **median and IQR** (not the mean — shot lengths are positively skewed);
- log-duration histogram and its entropy;
- transition-family census (which family dominates, and whether the film is a sampler);
- per-scene dwell against the declared beat table.
Then compare with the class archive and with the film's own `structure.json` from Stage 1. A delivered profile that matches
a sibling on every axis is **the same film with different content**, however good each frame looks. Report it as CONCEPT,
not as taste. Run `uika video structure <file> --out profile.json --apply` (ffmpeg scene scores, zero dependency) and compare it with the
archive or the declared profile: `uika video diff a.json b.json` (exits 1 when fewer than two axes differ). Transition *family* is marked deferred by the
profile — judge it from the sheet, do not infer it from the number.

## 6. Root-cause every finding
For each defect: symptom, where it shows (timestamp), **root cause in the source** (open the scene code / assemble script), why no gate caught it, and the guard that would. A finding without a root cause gets fixed once and returns next render.

Defect taxonomy (use these labels):
| Label | Example | Guard |
|---|---|---|
| DATA | wrong/duplicated labels, stale numbers | `manim_guards.assert_texts`, `assert_unique`; spec evidence table |
| LAYOUT | overflow, collision, empty half-cards | `assert_in_frame`, `assert_no_overlap` |
| LEGIBILITY | sub-12px source lines, dim text | `assert_min_text_height` |
| FILE | damaged final, twin identical, wrong length | `uika video qa --against --expect-duration` |
| AUDIO | silent SFX, wrong bed, hot peak, no arc | `uika video qa`, cue-table raises on missing key |
| PACING | scenes mostly empty while building | count fraction of sheet frames that are half-built |
| CONCEPT | generic visuals, cards instead of a claim-carrying graphic | skills/creative-gates |
| TEMPLATE | the film's structure is a sibling's structure | structural census above; `skills/creative-gates` Gate A/B |

## 7. Postmortem template (write it down; chat alone is not a record)
```
# Postmortem: <set> (<date>)
Files reviewed (path, length, audio, verdict) · What I could not check (audio not heard, motion not played, ...)
Defects worst-first: label · symptom @ time · root cause (file:line) · missed by · guard
Craft observations (concept, hierarchy, density, pacing, audio arc)
Rules to carry forward (each testable)
```
Save to `register/postmortems/<date>-<slug>.md`, add a `## Findings` line in the relevant lab README, and if a rule is new, an ADR.

## 8. Honesty rules
Say what you sampled (N frames, which zooms). Say when a claim rests on source reading rather than pixels. Do not report a suspect you did not confirm at steady state. Do not say "good" from a passing gate. Do not say "different" from a different subject, palette or soundtrack: name the axis that actually differs.

## Toolchain
`ffmpeg`/`ffprobe` (installed) do all the work; `uika video` wraps them. numpy for audio correlation; Pillow for frame diffs. See skills/toolchains.
