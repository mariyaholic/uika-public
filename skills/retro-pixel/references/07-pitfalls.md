# 07 — Pitfalls already paid for (symptom -> cause -> fix -> guard)

| # | Symptom | Cause | Fix | Guard now |
|---|---|---|---|---|
| 1 | "no music" | bed 12 dB under voice; thin 4-chord loop | arranged `score.cue`, levelled to voice -3.5 dB, ducked 5.5 dB | `build_audio` levels music vs `v_rms` |
| 2 | -92 dB hole mid-film | pads only started on a section's bar; mid-bar section change | pad on every bar with overlapping release | audio profile "holes" check |
| 3 | "abrupt ending" | picture and audio cut at the last frame | `ending` section resolves on tonic, RING 3.5 s hold, 1.2 s squared fade | `scene(..., ring=)` on the last scene |
| 4 | "scuffed" final scene | tanh saturation + impacts stacked on speech | lookahead limiter + iterative master; move impacts | impact-on-voice `GuardError` |
| 5 | "sfx overwhelming" | raw per-cue gains; some hits +10 dB over the voice | SFX classes vs voice RMS (loudest 100 ms) | `cue_gain` / unknown SFX raises |
| 6 | number said before shown | voice line timed from scene start only | number-first: graphic starts before the line reaches it | review rule; beat table column |
| 7 | "robotic voice" | pitched SAPI | Kokoro (EN) / the voice clone (JA); owner picks from a reel | SAPI documented as fallback only |
| 8 | Japanese read as "Chinese letter" garbage | Kokoro's espeak G2P for Japanese | route Japanese to the voice clone; kana numerals | 05 §5.4 |
| 9 | Modal `NotFoundError` on `Cls.from_name(...).speak` | not a method on that deployed class | own `modal run` script reusing the image/volume | `vo.prefetch_clone` |
| 10 | guard: "20,000" not in evidence | token with comma vs evidence "20000" | write figures exactly as in evidence | evidence lock |
| 11 | guard: "54" not in evidence | typed prefix of "544" checked mid-typing | check the whole line at import, `guard=False` on the typed box | `Keynote.lines` checks EN lines whole |
| 12 | guard: "98" in "PC-98" | a name containing digits | `guard=False` on that label only | 02 §2.5 |
| 13 | PIL crash "x1 must be >= x0" | zero-width bar at g=0 | `Cv.rect` skips empty rects; `max(ln,1)` | kit |
| 14 | final video 8 s short, QA "frames" WARN | render died silently at frame 2977 (exception after ffmpeg closed) | dry run every frame first; compare packet count | `render()` dryrun + `_count_frames` |
| 15 | CLEARED stamp over net-profit text | stamp placed by eye at one frame | moved to (440,226) | text-collision audit |
| 16 | Session Block plate overflow | long evidence value on one line | split into lines derived from the evidence | in-frame guard |
| 17 | formula exponent clipped | mask drawn at y 32 into the HUD strip | y 40 | frame screenshot at reveal end |
| 18 | "x1.187" label over the curve | label above a rising curve | below with a leader line | text-collision audit (labels vs data) |
| 19 | blink erased hair | eye box found from dark pixels merged with bangs | anchor on iris colour; lid copies skin from below | `Presenter._find_eyes` |
| 20 | blink "mechanical" | metronome 3.4 s, one-frame states | irregular 2.3-5.2 s, 18% doubles, held states | `kit.blink_at` |
| 21 | mouth "eerily higher fps" | per-frame envelope lip sync | 3 shapes at 10 fps | `vo.MOUTH_FPS` |
| 22 | Japanese line overruns its scene | JA lines longer than the EN draft | shorten the JA line, then re-bar | `build()` voice-fit assert |
| 23 | "procedural face too unhuman" | drawn ellipses for a face | real art -> pc98ify | 03 §3.1 |
| 24 | too few stats | titled cards instead of graphics | one carrying graphic per claim; use unused fact-sheet rows | pipeline stage 2 |
| 25 | shell edit of Python broke escapes | inline `python -c` / sed with backslashes | Edit/Write tools only | skills/shell-safe-writes |
| 26 | kit caches in the skill folder | `vo`/`texsprite` cached next to the module | `KEYNOTE_CACHE` (default %LOCALAPPDATA%\keynote-cache) | kit |

## Debug order when something is wrong
1. Reproduce at one timestamp: `python v.py frames <t>` (fast; guards on).
2. Read the GuardError: it names the scene@time and the two boxes; the fix is a layout move, not `guard=False`.
3. Audio: `python v.py audio` then the profile snippet; compare spikes with the cue list in meta.json.
4. Only then re-render; keep the previous accepted final as `out/<name>_v<N>.mp4`.
5. Record the new row in this table (symptom, cause, fix, guard) and in the video's STATUS.md.
