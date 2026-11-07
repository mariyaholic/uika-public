---
name: retro-pixel
description: Use when a video, keynote, card or animation must look like a 1990s NEC PC-98 game/visual novel (16-colour palette, ordered dither, bitmap Japanese type, VN message window, stepped motion, FM chiptune) — the theme pack with a proven Python kit (canvas, guards, transitions, presenter from real art, MiKTeX formulas, arranged FM score, class-levelled SFX, neural voice, mastering, render) and bit-by-bit recipes. Use with skills/video-pipeline for the workflow.
---

# PC-98 retro theme pack (ADR-0029)

The look is a **constraint system**, not a filter: 16 colours chosen per video, everything drawn on a 640x360
index canvas, shading only by ordered dither, type from a bitmap font, motion in held steps, transitions that
move pixels (never cross-fade), sound from FM operators. Applying a CRT filter to a modern render is NOT this look.
Proven on a private launch keynote (accepted 2026-09-30); that script is not published — `skills/retro-pixel/examples/template_keynote.py` shows the same API.
Library: `uika ref show retro-aesthetic-reference` → `<REFERENCE_LIBRARY>/...` (register your own study library in `references/library.json`; `uika ref ls` lists it)
(theme-pack view: `uika ref show retro-pixel`). Study only; frames are never redistributed.

## Quick path (copy, run, grow)
```
copy skills/retro-pixel/examples/template_keynote.py + evidence_template.json into <project>/<video>/
set RETRO_KIT=<UIKA_ROOT>/skills/retro-pixel/kit                  (or keep the relative default)
python template_keynote.py frames 3 10 20    -> out/f_*.png (look at them)
python template_keynote.py dryrun            -> every frame through the guards
python template_keynote.py render            -> out/<name>.mp4 (+ preview, wav, meta.json)
uika video qa out/<name>.mp4 --expect-duration <s> --against out/<name>_preview_silent.mp4
```
Needs: Python 3.11+ with numpy, Pillow, scipy; ffmpeg/ffprobe; Windows MS Gothic (`msgothic.ttc`); optional
kokoro-onnx + model (`KOKORO_DIR`), MiKTeX (`TEX_BIN`). Caches go to `%LOCALAPPDATA%\keynote-cache` (`KEYNOTE_CACHE`),
never into the skill folder.

## The kit (skills/retro-pixel/kit)
| Module | Owns |
|---|---|
| `pxkit.py` | `Pal` (16 slots + aliases), `Cv` canvas (rect/line/poly/ellipse/px/dither/grad_v/text), Bayer masks, evidence lock, guards, `transition()`, `Scene`/`Video`, CRT export `render_silent`, `dump_frame`, easing |
| `kit.py` | `frame2` double frame, `msgbox` VN window, `blink_at`, `stripes`, `stamp_text`, `shake`, `wrap_px` |
| `pc98ify.py` | real art -> PC-98 sprite (downscale, sharpen, palette map, Bayer dither, outline, background key) |
| `presenter.py` | `Presenter` bust window with iris-anchored blink and stepped lip flaps; `FullBody` |
| `texsprite.py` | MiKTeX formula -> 1-bit mask -> `draw_mask` with left-to-right reveal |
| `sfx.py` | FM/noise SFX library, `Mix`, reverb, SFX classes, `envelope`/`duck`/`limit`/`master`/`mux` |
| `score.py` | arranged cue: sections per scene, 7th-chord voicings, written hook, resolving ending |
| `vo.py` | voice lines (Kokoro / optional private voice clone / SAPI fallback), cache, `mouth()` at 10 fps |
| `keynote.py` | the pipeline: lines, bar-locked scenes, `say`/`face`/`after_line`, audio buses, dry run, render, frame-count check |

## References (read in order the first time; each has code)
1. `references/01-look.md` — canvas, CRT export, palette design and slot budget, dither, gradients, glow, palette cycling
2. `references/02-type-and-layout.md` — bitmap type, stamps, VN window, HUD, the 640x360 layout grid, guards and tags
3. `references/03-art-and-presenter.md` — sourcing real art, pc98ify parameters, presenter mapping, blink, lip flaps
4. `references/04-motion-and-transitions.md` — stepped cadence, easing, reveals, shake, the transition set, pacing
5. `references/05-sound.md` — FM instruments, arranging a cue, SFX classes, voice options, ducking, mastering
6. `references/06-recipes.md` — bit-by-bit builds of the the reference film scenes (beam reveal, duel bars, N-cell grid, formula plot, gauges, estate card)
7. `references/07-pitfalls.md` — every bug already paid for: symptom, cause, fix, guard

## Non-negotiables of the theme
- <= 16 palette entries per video, named by role; presenters map onto named entries (no extra slots).
- No anti-aliasing anywhere: 1-bit text masks, nearest-neighbour scaling, polygon fills without AA.
- No cross-fades or opacity. Transitions and "fades" are dither levels, wipes, mosaics, shutters, irises, pushes, flashes.
- Motion in held steps: presenter lips at 10 fps, blinks held 2-3 frames; stamps land with a short shake.
- Type floor: 12 px native (36 px at 1080p); body 16 px; heroes are 16 px glyphs scaled x3..x8 nearest.
- One graphic carries each claim; numbers come from the evidence table only.
- Sound: FM/chip voices + a neural narrator; SFX by class under the voice; music ducked under the voice; the
  ending resolves on a held tonic and rings out.
