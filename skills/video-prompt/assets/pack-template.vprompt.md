---
pack: <slug>
title: "<Working title>"
spec: <L> s · <fps> fps · <frames> frames · 640x360 native · 1920x1080 export
theme_pack: skills/<theme-pack>
audio: inputs/<slug>_bed.wav
timing: inputs/<slug>.timing.json
evidence: inputs/<slug>_evidence.json
output: out/<slug>.mp4
owner: <harness>.<role>
hand_seed: <creative-gates seed>
precedence: law > scene-spec > usage-table > example
---

# Pack: <TITLE>

One paragraph: what this document is, and the rule that the pack is the contract — the renderer decides
where the pack is silent (and logs it), the pack wins where it speaks.

## 1. Brief and creative hand

Owner's brief, verbatim. Then the hand, pasted verbatim:

- `seed` · `WORLD` · `CONSTRAINT` · `SIGNATURE` · `FORBID`

## 2. What the film claims

Logline. The one argument. The emotional arc, one line per scene, in scene order. The signature beat named.

## 3. Timing

Measured facts from the timing file: tempo, beat grid origin and period, bars, bar energy, sections,
strongest onsets. Then the cut table — every cut names the measured event and the visible change:

| # | frame | G s | lands on | scene after | visible change |
|---|---|---|---|---|---|
| 1 | <f> | <s> | `onset@<s>` ±<tol> | <scene> | <what visibly differs across the cut> |

Rules: no bare seconds for a measured cut; no index without its resolved value; if the film has no bed,
say so and use the score's own grid.

## 4. Style bible

Canvas and export chain. Palette law. Type. Texture. Motion cadence. Forbidden list (at least three).

## 5. Palette and colour law

| slot | hex | meaning |
|---|---|---|
| black | #000000 | field |

Exactly ≤16 rows. One line: which single colour changes meaning, at which frame, and what it means before
and after.

## 6. Fixed chrome

Every persistent element with its rect and slot: HUD, level/spectrum display, key strip, copyright, plate
frame, title-bar rules. Name the element ids the scene tables will reuse.

## 7. Scenes

One block per scene.

### <id> — <name> — frames <a>-<b> (<start>G-<end>G)

View: the screen and its state. Content: the element table below. Reveal order.

| id | scene | element | rect | slot | reveal (+) | hold | content | guard | evidence |
|---|---|---|---|---|---|---|---|---|---|
| `el-1` | <id> | <what it is> | (x0,y0)-(x1,y1) | <slot> | `+0.00` | to cut | `<exact string>` | `claim`/`data`/`decor` | `e-1` |

Per-scene payload (choose one style, delete the other):
`<!-- programmatic -->` the scene spec the code implements, in prose or a list;
`<!-- generative -->` the full generator prompt (subject, action, camera, light, texture, negatives).

## 8. Evidence table

| id | figure | exact text | on screen | source |
|---|---|---|---|---|
| `e-1` | <what it measures> | `<510 KB>` | `<scene / element>` | `<file> §<section>` |

The evidence gate command goes in §9; nothing may appear on screen that is not in this table.

## 9. Acceptance tests

| id | tool | command | expected | tolerance | consequence |
|---|---|---|---|---|---|
| `a-qa` | uika video qa | `uika video qa out/<slug>.mp4 --expect-duration <L>` | PASS 0 fail | exact | build fails |
| `a-structure` | uika video structure | `--json` | <n> scenes, cuts at <frames> | ±1 frame | <what a pop does to the count> |
| `a-loud` | uika video qa | — | ≈ −14 LUFS, peak ≤ −1.5 dBFS | 1.5 LU / 0.5 dB | build fails |

Review stills — each at reveal + hold, never inside a stagger:

| t (G) | checks |
|---|---|
| <s> | <element/state> |

## 10. Deliberately free

List what the renderer may choose (glyph drawing, phase, easing, dither level, tiling, encoder), and why it
is safe: none of it changes the claim, the cut, or the meaning.

## 11. Deliberately fixed

List what must not be improvised: all strings in §7/§8, palette slots, cut frames, scene order, reveal
times, the flash/cut policy, the meaning change, no cross-fade/alpha/anti-aliasing, and this report.

## 12. Build report required

`<project>/<film>/report.md`: how to run the build; the acceptance measurements with actual numbers; the
**decision log** (every point the pack was silent — choice and reason, written as it is made); deviations.
