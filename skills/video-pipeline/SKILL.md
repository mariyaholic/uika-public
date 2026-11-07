---
name: video-pipeline
description: Use when producing any programmatic video end to end (keynote, promo, explainer, data story) — the stage-by-stage workflow from brief to accepted file, with the exit check of every stage, how to test, debug, and verify picture and sound without being able to hear, and how to run the owner-review loop. Theme-agnostic; pair it with a theme pack (skills/retro-pixel, or skills/keynote-launch for a modern launch look with data showcases) and skills/video-direction + skills/video-review.
---

> **uika-oss note:** `uika video`, `uika figure`, `uika ref` and `uika eval` ship with uika-oss (ffmpeg and Playwright are separate installs). The `uika creative ledger|deck|diverge|pick` commands named below are not in uika-oss yet: draw a hand from `skills/creative-gates/deck.json` yourself and note the seed, keep the picks ledger as a plain file, and check wording divergence by reading the candidates side by side.

# Video pipeline (ADR-0029)

A video is not "rendered"; it is **decided, locked, built, proven, looked at, heard by the owner, and revised**. Each stage below has an exit check. Do not start a stage until the previous one's check passes. The worked history of the first accepted video ("Keeper", v1 → v4) is in `references/case-reference-keynote.md`: read it once; every rule here came from a defect there.

## Stage 0 — Intake (what, for whom, with what)
Read the owner's **raw** brief, not a later agent's rewrite. Write down: audience and the one decision the video must move; hard limits (minimum length, max scene length, headless apps, aspect, "one at a time"); the fact source (one file); the theme; what you may download (ask before any download: name, source, size). Resolve names with `uika where` / `uika find`; study references for video, pictures and themes are listed by `uika ref ls` (ADR-0054) and every collection is study-only.
**Exit:** a 10-line intake note in the project's `PLAN.md`.

## Stage 1 — Direction (divergence before taste)
Run `skills/creative-gates` (`uika creative ledger`, `deck`, three divergent candidates, `diverge`, blind RUBRIC). Expand the winner with `skills/video-direction`: treatment, style bible with a forbidden list, locked characters/world.
This is the stage that was **skipped** on six early launch keynotes, and it is not optional. Before expanding:
- **Name the genotype.** Say which structural archetype this film uses and why it fits this product (cold-open → proof →
  mechanism → caveat → resolve; question → counter-example → mechanism → payoff; single-object film; another you can
  defend). A pack that ships one genotype ships one film in six costumes.
- **Profile the archive.** Write the class profile from accepted siblings — scene count, shot-duration median and IQR,
  entropy, transition family, music character — and state on which **two axes** this film will differ. "Different product,
  different colour" is not a difference.
- **Write the skeleton before opening any sibling** (`skills/creative-gates` Gate E). If you have already read a finished
  film's beat table, say so and expect your skeleton to be its descendant.
**Exit:** `concepts/<variant>.md` with hand, signature beat, forbidden list, the beat list, **the named genotype**, and
`structure.json` (the profile you intend), differencing the archive on ≥ 2 declared axes.

## Stage 2 — Accuracy (evidence lock)
Transcribe every figure the video may show or say into `evidence/<family>.json`: `{"id": {"v": "<exact text>", "src": "<file §section>"}}` plus the verbatim disclosure. Copy labels the source demands ("archived campaign", "visual run"): a true number in the wrong context is a false claim. No derived numbers unless the source prints them.
**Exit:** the renderer refuses any digit not in the table (theme kits enforce this: `pxkit.Evidence.check_text`).

## Stage 3 — Scene direction (beat table before code)
One row per scene: `name | bars | claim | the ONE graphic that carries it | voice line | impact moment | transition out | music section`. Rules:
- Every claim gets a **graphic that carries it** (a duel of bars, a 544-cell grid, a curve, a gauge), never a titled box of numbers.
- One **honest negative** designed as a real beat (e.g., "the top 20 items carried more than all of the net gain").
- **Number first, voice second**: the figure lands (with the impact) before the narrator says it.
- **Impacts never on speech**: stamps and hits go before a line or after it ends.
- Scenes <= 20 s; no dead air: something visibly changes every ~2 s; the ending resolves (cadence + ring-out), it is not cut.
- Lock cuts to the music grid (e.g. 120 bpm = 2 s bars): scene starts on bar lines.
- **One transition family per film**, chosen for what the boundaries mean — not a sampler of every transition the kit has.
  The measured corpus in `skills/keynote-launch` uses few families repeatedly; variety comes from the beats, not the wipes.
- **Durations must not be uniform.** If every scene is 6 s, the edit has no rhythm and the structural census
  (Stage 8) will show a flat histogram; vary with the beat and keep the median honest.
**Exit:** the beat table in the concept file; total length meets the brief; the transition family is named.

## Stage 4 — Audio design (before building visuals)
Decide three buses and their relation, not absolute gains: **voice** (the reference), **music** (arranged cue whose sections follow the scenes; levelled ~3.5 dB under the voice, ducked ~5.5 dB while speaking; real ending), **SFX** (every cue in a class: impact -2, accent -9, texture -14 dB relative to the voice). Voice: a genuine neural TTS or the owner's chosen voice; if it speaks another language, keep the viewer's language on screen. Details and code: `skills/retro-pixel/references/05-sound.md`.
**Exit:** voice lines synthesised and timed; every scene fits its line (voice start + duration < scene - 0.4 s).

## Stage 5 — Build (script on a kit, guards on)
Write the video as one script on a kit (`skills/retro-pixel/kit` with `skills/retro-pixel/examples/template_keynote.py`, or `skills/keynote-launch/kit` with `skills/keynote-launch/examples/template_launch.py`). Guards are part of the build, not a later review: in-frame, decoration-vs-data, text collision, unique labels, type floor, evidence digits, scene cap, unknown SFX/colour/transition names raise. Lookups that drive output raise; never `.get(key, default)`.
**Exit:** `python <script> frames <t...>` writes PNGs for each scene's steady state and you have looked at them.

## Stage 6 — Test before you render (cheap → expensive)
1. **Frames** at each scene's steady state and at each impact; zoom on text, the presenter's face, edges.
2. **Dry run**: every frame through the guards with no encoding (`python <script> dryrun`). A 3-minute render that dies at 90% costs more than this.
3. **Audio alone** (`python <script> audio`): master passes (LUFS, dBTP), then a half-second loudness profile: no holes (below -40 dB mid-programme), no spike more than ~8 dB over the median, ending decays to silence. Recipe in `references/checklists.md`.
**Exit:** all three clean.

## Stage 7 — Render, then the mechanical gate
Render headless (never a window on the owner's screen). Keep the previous accepted final (`out/<name>_v<N>.mp4`) before overwriting: the owner may want to compare. Then `uika video qa <final> --expect-duration <s> --against <silent preview>` — zero FAIL, and **read the WARNs**: "decoded frame counts differ" means the render died and the final is stale.
**Exit:** QA PASS 0 fail, 0 unexplained warn.

## Stage 8 — Look and measure (you cannot watch or hear; prove what you can)
`uika video sheet`, then `uika video frame` at steady states (skills/video-review). Check the presenter at 3x zoom (eyes, mouth, blink frame). Correlate audio measurements with the beat table (impacts where planned, voice where planned). Write what you sampled and what you could not check ("audio measured, not heard").
Then the **structural census**: the delivered file's scene/shot boundaries, shot-duration median and IQR, duration entropy,
and transition family. Compare it with the `structure.json` you declared in Stage 1 and with the class archive. A delivered
profile that matches a sibling's on every axis is the same film with different content — report it as a CONCEPT defect, not
a taste note. `uika video structure <file> --out delivered.json --apply`, then `uika video diff <declared.json> <delivered.json>`:
fewer than two differing axes fails the stage. The profile's transition family and beat archetype are declared
deferred — judge those from the sheet and the beat table, not from the profile.
**Exit:** a short review note in `STATUS.md` with the numbers, including the measured structural profile.

## Stage 9 — Owner loop (the owner is the ears)
Send the file. Ask for the worst thing, not for approval. Translate each note into a **cause in the source** before changing anything ("no music" was music 12 dB under the voice, not missing music). Fix causes in the kit when they would recur, not only in the script. One render per loop; record each loop in STATUS.md.
**Exit:** owner accepts ("this will do").

## Stage 10 — Record
STATUS/RESULTS in the project; lessons into this skill or the theme pack; rules that need enforcing become code in the kit; a postmortem if something shipped broken; WORKSTACK thread updated; `uika creative pick` if the owner chose between variants.

## Bugfixing discipline
Symptom → where (timestamp/frame) → **root cause in the source** → fix in the lowest layer that owns it (kit > script) → the guard that would have caught it → re-test from Stage 6. Pitfalls already paid for: `skills/retro-pixel/references/07-pitfalls.md`.

## Toolchain
Python (numpy, Pillow, scipy) + ffmpeg/ffprobe for the kit; `uika video qa|sheet|frame|ls`; MiKTeX (`latex`, `dvipng`) for formulas; Manim or Godot Movie Maker only where they carry the message (headless/offscreen); Kokoro-82M (kokoro-onnx) for local neural voice. See skills/toolchains.
