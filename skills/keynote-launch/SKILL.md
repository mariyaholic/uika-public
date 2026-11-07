---
name: keynote-launch
description: "Use when a video, keynote, launch film, investor update or animated slide must look like a modern product launch (Apple/Google/Samsung/Rivian/Nothing/Stripe-style stage keynote or produced launch film): measured pacing, stage-and-screen layouts, kinetic type, statistics showcases (count-ups, KPI rows on b-roll, Rosling bubble clocks, Gore wedges, rank tables, radar, spec callouts, price reveals) and studied transitions (light slit, capsule, icon portal, mosaic, push, whip, shape expand). Theme pack with a Pillow/numpy kit, named structural genotypes, a 54 s API-demo template that is explicitly not a structure to copy, and a 46-video reference library with stills, transition clips and pacing data. Use with skills/video-pipeline."
---

# Keynote / product-launch theme pack (ADR-0031)

The look is **restraint plus one idea per beat**: one claim, one graphic, one transition, a clean grid, type
large enough to read from the back row, numbers that land first and are read after. It comes from 46 real
launches and keynotes (stage and produced), measured shot by shot. It is not "corporate template slop":
no stock gradients behind bullet lists, no spinning 3D logos, no crossfade between every slide.

Restraint is a **design position with a documented history**, not a law: the corpus supports this look for this kind of
film, and there is at least one measured counterexample to "more whitespace reads as more premium" (ADR-0040, GA-11).
When you choose restraint, give the reason for the piece; do not cite tradition as evidence.

Library: `uika ref show keynote-launch-reference` → `<REFERENCE_LIBRARY>/...` (register your own study library in `references/library.json`; `uika ref ls` lists it)
(`uika where keynote`). Gallery
`index.html`, viewing notes
`_plan/notes.md`, per-video pacing `analysis/<id>.json`, filmstrips `strips/<id>.jpg`. Personal research cache:
study, never reuse frames (rights in its README).

## Quick path — API demonstration, not a story to copy
`skills/keynote-launch/examples/template_launch.py` demonstrates **the kit's API and its five-beat shape**. It is not the estate's launch-film
structure, and copying it is how six films ended up identical (ADR-0040; `labs/eval/creative-pipeline`). Use it to learn
calls; write your own beat table before you open it.
```
# to learn the API (never as the starting structure for a real film)
python skills/keynote-launch/examples/template_launch.py frames 3 12 20   # -> out/f_*.png (look at them)
python skills/keynote-launch/examples/template_launch.py dryrun           # every frame, every digit guarded
python skills/keynote-launch/examples/template_launch.py render           # -> out/launch_demo.mp4 (+ silent preview, .wav)
uika video qa out/launch_demo.mp4 --expect-duration 54 --against out/launch_demo_preview_silent.mp4

# for a real film
copy skills/keynote-launch/kit/launchkit.py + evidence_template.json into <project>/<video>/
# write <project>/<video>/concepts/<variant>.md (genotype + beat table) FIRST, then <script>.py against the kit
```
Needs Python 3.11+ with numpy, Pillow and scipy, plus ffmpeg. Fonts are Windows Bahnschrift, Segoe UI, Georgia,
Microsoft YaHei and Yu Gothic. Audio uses `skills/retro-pixel/kit/sfx.py`: set `RETRO_KIT` or keep the sibling
default.

## The kit (`kit/launchkit.py`, one module)
| Layer | Functions |
|---|---|
| tokens, type | `THEMES` (studio / stage / field), `SERIES`, `font(role,size)`, `text()` with tracking + alpha, `measure()` |
| timing | `seg`, `ease_out/in/io/expo/back`, `count()` (expo count-up) |
| masks | `aa_mask`, `capsule`, `squircle` |
| transitions | `t_slit`, `t_capsule`, `t_portal`, `t_mosaic`, `t_push`, `t_whip`, `t_shape`; `value_ramp` (end cards only) |
| graphics | `kinetic_words`, `kpi_row`, `scrim`, `type_wall`, `capsule_photo`, `spec_callouts`, `price_split`, `lower_caption`, `bug`, `bubble_chart`, `wedge_chart`, `radar`, `rank_table` |
| evidence | `Evidence(path)`: `fig`, `num` (splits "$45,000" for count-ups), `guard` (rejects digits not in the table), `unused` |
| output | `Writer` (frames to h264), `still` |

## References (read in order the first time)
1. `references/01-look.md`: themes, colour roles, stage vs produced, what the 46 videos share
2. `references/02-type-and-layout.md`: type scale, roles, kinetic type, the 1920x1080 grid, stage-screen layouts
3. `references/03-art-and-presenter.md`: footage, product shots, presenters (stage, keyed, PiP), b-roll stand-ins
4. `references/04-motion-and-transitions.md`: measured pacing by format, transition catalogue with library pointers
5. `references/05-sound.md`: measured loudness, how rarely transitions carry a hit, bed and arc, accents, mastering
6. `references/06-recipes.md`: scene builds step by step (cold open, KPI over b-roll, spec constellation, price reveal, end card)
7. `references/07-pitfalls.md`: defects already paid for and the guard for each
8. `references/08-data-showcase.md`: the statistics playbook (the reason this pack exists): ten chart forms, when to use each

## Genotypes (choose one, in writing, before the beat table)
A **genotype** is the film's skeleton, independent of its subject. The kit does not supply one; the brief must name one and
say why it fits this product. Three that have been argued for real launches, plus whatever you can defend:
| Genotype | Skeleton | Fits |
|---|---|---|
| **Proof-first** | cold open → the number that matters → mechanism → honest caveat → resolve | a product whose claim is measurable |
| **Question** | the reader's objection → counter-example → mechanism → what changes for them → resolve | a product that must displace a habit |
| **Single object** | one object, one continuous move, the claims arriving as annotations → resolve | a hardware or a form-factor reveal |
Two films in one class may share a genotype only if they differ on **two declared axes** (scene count, shot-duration
median/IQR, entropy, transition family, music character — `skills/creative-gates` Gate A).

## Non-negotiables
- One claim per beat. Show the number first and say it after. Every digit comes from the evidence table
  (`EV.guard`).
- **Pacing figures are this pack's own measurement, not a law.** "Produced launch films median shot ~3–4 s; stage keynotes
  5–15 s" comes from the 46-video reference corpus at 720p (04) — a C-level internal measurement. No peer-reviewed
  shot-length benchmark exists for launch films (ADR-0040, VI-5). Use the numbers to avoid the obvious error (a 30 s
  scene, a 0.2 s flash), not to justify a target; and no scene runs over 20 s.
- **One transition family per film.** The catalogue has seven; the corpus uses few repeatedly. Pick by what the boundary
  means, not by what would look good in a showreel.
- Never cross-fade between scenes. Every boundary is a designed transition chosen for its meaning (04).
  `value_ramp` is only for the brand end card.
- Type is large and sparse. The display line is ≥ 84 px at 1080p and a caption is ≥ 24 px. Keep ≤ 12 words on
  screen outside charts.
- Sound is quiet under the image. Transitions rarely carry a hit (measured: 2–10 % by format), so put accents on 2–3 hero
  beats only. The bed has an arc and resolves; master to −14 LUFS integrated with true peak ≤ −1 dBTP.
- **Say which delivery the loudness serves.** −14 LUFS is the streaming-player convention (Spotify normalises to −14 LUFS
  per ITU 1770 and asks for ≤ −1 dBTP); broadcast is EBU R 128's **−23 LUFS**. The estate ships to players, so −14 is
  right here — it is not a universal standard, and a broadcast delivery would be wrong at this level.
- **Audio assets: licence before use.** CC0 clears only the rights the affirmer holds — not the composition/recording split,
  not third-party samples, and it carries no warranty. Prefer a bed generated by `skills/retro-pixel/kit` or an arranged
  cue the estate owns; if an external asset is used, record its licence and source beside the film and treat
  "CC0" as a claim about one layer, not a clearance.
- Data graphics move with meaning: the clock drives the bubbles, a wedge arrives on its beat, a KPI counts up
  once. No chart animates just to decorate.
