# 07 — Pitfalls already paid for

Each row records a defect that really happened while building this pack or its library, with the guard that
now prevents it. Add a row whenever an owner note or a QA failure teaches something new.

| # | Symptom | Cause | Fix / guard |
|---|---|---|---|
| 1 | Laptop power-cycled during reference analysis (Kernel-Power 41, 2026-10-01 08:16) | Six analysis lanes each held a whole 96x54 proxy (2–4 GB for a 4 h keynote) plus `capture_output` copies, on 16 GB of RAM | Stream the proxy frame by frame, keep only 48x27 copies (about 4 KB/frame), and run ≤ 3 lanes. Check RAM headroom before fanning out media jobs |
| 2 | Long keynotes failed analysis after a 15-minute decode | A flat `eq(n,a)+eq(n,b)+…` select expression with ~300 terms made ffmpeg's parser fail with "Cannot allocate memory" | `sel_tree()` nests the terms as a balanced sum. Any generated ffmpeg expression over ~100 terms gets balanced or chunked |
| 3 | Every analysis lane died instantly while looking healthy | A patch wrote a real newline inside an f-string (shell heredoc escaping), and lane output was buffered behind `grep`, so the error was invisible | `python -m py_compile` after every scripted patch. Lanes run `python -u` with `grep --line-buffered`, and failures go to `analysis/_errors.log` with a traceback |
| 4 | The same video was analysed twice and the manifest got duplicate rows | One lane's todo list went stale: it claimed a video another lane had just finished | Re-check for the result after claiming the lock. `build_index.py` keeps the last manifest row per file |
| 5 | The "top transitions" filmstrips were mostly ordinary camera cuts | Ranking by endpoint difference alone favours 0.3–0.4 s camera cuts at 10 fps | Rank by strength x (1 if 0.5 ≤ motion ≤ 2.5 s else 0.3) |
| 6 | Graphic share read 1.0 for a dark stage video | The flat-colour metric counted black stage surround as "flat graphic" | Score only non-dark pixels, and require ≥ 25 % lit pixels |
| 7 | Fan rehosts polluted stats (countdown wrapper, webcam, stock ticker) | Search hit a third-party stream (`qUQLTciXCBE`), and a fan summary slipped past a title-only filter | Filter candidates by **channel**, not title. Mark rehosts in the notes and treat their graphic stats as noise |
| 8 | Subtitle collided with the chart title | `text()` anchors top-left by default ("la"); an 84 px title at y=130 occupies up to y≈214 | Leave title height + 20 px before the next line; check the first frame of every scene in `frames` |
| 9 | Template render ran about 2 s/frame on transitions | Full-frame 3x supersampled masks, a full-res edge filter in `t_slit`, and a 1080p Gaussian blur on b-roll | Half-res masks upscaled, `aa_mask` ss=2, and blur at 192x108 before upscaling. Time `frame()` per scene before a full render |
| 10 | Portal opened onto an empty card | The next scene's content started 0.6 s late, so the portal carried a blank frame | A scene that a transition reveals has to be populated by the time the transition reaches it |
| 11 | Two scene backgrounds produced a harsh black/white checkerboard during the mosaic | `t_mosaic` between a dark and a light field shows every block as max contrast | Use mosaic between similar values, or accept it as a deliberate "digital" beat. Pick the transition for meaning (04) |
| 12 | Rendered chart printed "2.05556 Gt" mid-sweep | `wedge_chart` formatted the running total with `:g` and labels bypassed the evidence guard | Labels use `fmt` and pass through `guard=EV.guard`. The running total shows only between beats, and every intermediate total is a derived evidence row that the template asserts against its arithmetic |
| 13 | The harness listed this skill with only its heading, not the description | The SKILL.md description was an unquoted YAML scalar containing "): ", which is invalid YAML, so the frontmatter was dropped. `uika skills validate` passed because it splits lines with a regex | Quote long descriptions. `skills validate` now flags any unquoted value containing ": " or " #" |

## Carried over from the PC-98 pack (still true here)
- Every number on screen comes from the evidence table (`EV.guard`). Derived numbers get their own row with the
  arithmetic.
- Hits never land on top of a voice line, and accents follow the class levels (05).
- A video isn't done until `uika video qa` passes and you have looked at frames from every scene
  (skills/video-review).
