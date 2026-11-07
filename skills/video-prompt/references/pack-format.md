# Pack format v1 (video-prompt)

The pack is one markdown file with YAML front matter. It is written to be read by an agent and parsed by a
linter; every fixed fact lives in a table with a fixed column order so the linter can find it. Prose
explains *why*; tables carry *what*.

Status: v1. `uika video prompt lint` (ADR-0055) enforces the mechanical part of §7 and lists the rest as
MANUAL rows the author walks by hand. This file and the linter's grammar move
together — a pack that parses under one must pass the other.

## 1. File and place

- Name: `<slug>.vprompt.md`, one film per pack.
- Place: in the product repo beside the film's inputs (`<project>/<film>/promo/` or the film's `pack/`
  folder). The pack is a product artifact, not a Uika registry entry.
- Inputs named in the front matter are the only files the renderer may read beyond the theme pack and this
  document. Copy them into a hermetic folder for a blind run.

## 2. Front matter

| key | type | required | rule |
|---|---|---|---|
| `pack` | slug | yes | equals the file stem |
| `title` | string | yes | the film's working title, quoted if it contains `: ` |
| `spec` | string | yes | `length · fps · frames · native · export`, all four arithmetic-linked |
| `theme_pack` | path | yes | `skills/<pack>`; the kit path is implied by it |
| `audio` | path | yes | the bed, no voice-over unless the pack says so |
| `timing` | path \| none | when cuts are measured | the analysis this pack's cut table resolves against |
| `evidence` | path \| none | when a number is on screen | the evidence lock file |
| `output` | path | yes | where the renderer writes the film |
| `owner` | handle | yes | the author, `<harness>.<role>` (ADR-0014) |
| `hand_seed` | string | yes | the creative-gates hand this pack obeys |
| `precedence` | string | yes | `law > scene-spec > usage-table > example` unless the film needs another |

## 3. Sections

| # | section | carries | required |
|---|---|---|---|
| 1 | Brief and creative hand | the owner's words, the hand verbatim (seed, WORLD, CONSTRAINT, SIGNATURE, FORBID) | yes |
| 2 | What the film claims | logline, the one argument, the emotional arc in scene beats | yes |
| 3 | Timing | measured facts (tempo, grid, bar energy, sections, strongest onsets) + the cut table | when a bed exists |
| 4 | Style bible | palette law, type, texture, motion, forbidden list | yes |
| 5 | Palette and colour law | ≤16 named slots with hex; what each colour means; the single meaning-change point | yes |
| 6 | Fixed chrome | HUD, spectrum/level display, key strip, copyright, plate rules — with rects | if the film has chrome |
| 7 | Scenes | one block per scene: view, content, element rows with reveal times, the per-scene payload | yes |
| 8 | Evidence table | figure → exact text → source → on-screen or not | if any number appears |
| 9 | Acceptance tests | tool, command, threshold, tolerance, consequence for motion | yes |
| 10 | Deliberately free | what the renderer may choose, and why it is safe to leave free | yes |
| 11 | Deliberately fixed | what must not be improvised | yes |
| 12 | Build report required | what the renderer must deliver back, including the decision log | yes |

## 4. Types and conventions

- **Time.** Every time is tagged: `G` = global seconds from frame 0; `+` = scene-local seconds from the
  scene's first frame. A bare time is a lint error. Frames are integers at the spec's fps; the pack gives
  both (`frame 293 · 9.767 s`) wherever a cut or a flash must be frame-exact.
- **Event reference.** A cut or reveal that is supposed to be measured names the event as
  `<kind>@<seconds>` — `onset@9.776`, `beat@5.067`, `section@10.2`, `bar@5.0` — and the tolerance. The
  linter resolves each against the timing file and fails when no event is within tolerance. Never use an
  index ("beat 1") without its resolved value; indices are how 0.045 and 0.673 became the same words.
- **Rect.** `(x0,y0)-(x1,y1)` in native canvas pixels, bottom-right exclusive by convention.
- **Slot.** A palette name from §5, never a hex in the body. Hexes appear only in the palette table.
- **Guard.** `claim` (a number that must be in evidence), `data` (non-numeric content), `decor` (must not
  overlap data), `fx` (may be anywhere, never carries meaning). The theme kit's guards read these.
- **Evidence id.** The row id in §8 (`e-release-kb`); §7 elements cite it.

## 5. Row formats (fixed column order)

Cut table (§3):

| # | frame | G s | lands on | scene after | visible change |
|---|---|---|---|---|---|
| 2 | 293 | 9.767 | `onset@9.776` ±0.04 | pin | fault trace → flat green line; 2-frame white flash; title bar blue → dgreen |

`visible change` is not narration: it is what a viewer sees differ across the cut. A cut with no visible
change is a cut the structure detector cannot find (and the audience will not feel).

Scene heading (§7): `### <id> — <name> — frames <a>-<b> (<start>G-<end>G)`.

Element table (§7), one row per visible thing:

| id | scene | element | rect | slot | reveal (+) | hold | content | guard | evidence |
|---|---|---|---|---|---|---|---|---|---|
| `hud-left` | all | HUD label | (6,4)-(400,16) | gray | `G@0.0` | to cut | `<PROJECT> · THROUGHPUT · thr-002` | decor | — |
| `hero` | measure | release size | (34,78)-(330,174) | white | `+0.80` | to cut | `510 KB` | claim | `e-release-kb` |

Acceptance table (§9):

| id | tool | command | expected | tolerance | consequence |
|---|---|---|---|---|---|
| `a-qa` | uika video qa | `uika video qa out/<slug>.mp4 --expect-duration 20` | PASS 0 fail | exact | build fails |
| `a-structure` | uika video structure | `--json` | 6 scenes, cuts at 150/293/375/450/525 | ±1 frame | a mid-scene pop > 0.08 must be stepped or it counts as a scene |

Stills table (§9.6 or §10):

| t (G) | checks | hold |
|---|---|---|
| 14.30 | measure: hero + three stats + waterfall | ≥ 0.5 s after each reveal |

## 6. Free and fixed

- **Fixed** means: text verbatim, colour slot, cut frame, scene order, reveal time, evidence row, and the
  meaning of a colour. Fixed items are what the fidelity score measures.
- **Free** means: the renderer chooses and logs. Pixel positions inside named zones, glyph drawing,
  animation phase, easing, dither level where both read, encoder settings, the exact shape of a sample.
- If an element is neither fixed nor free, the pack has a gap. That is the defect class the latch run
  produced thirteen of.

## 7. Closure rules (what the linter must enforce)

L1 durations sum to the spec; cuts strictly increasing; integer frames; last scene ends at the length.
L2 every element has a reveal and a hold; no element reveals after its scene's last frame.
L3 every `onset@`/`beat@`/`section@`/`bar@` reference resolves within its tolerance; no bare indices.
L4 every `claim` string equals an evidence value; every evidence row names a source file and section;
   the evidence gate is listed in the acceptance table and runs before frame 1.
L5 ≤16 slots, each named and hexed; every slot used in the body is defined; each colour has one meaning;
   the meaning-change point is stated with its frame.
L6 every rect is inside the canvas; text width ≤ rect width; no two fixed labels share a cell; a centred
   element says `centred at x=<n>` and the linter checks the rendered bounds, not the word.
L7 graphic arithmetic: bar count × mapping covers the band vector; rows × cell height ≤ well height;
   visible capacity ≤ available columns; sample arrays are in range.
L8 the acceptance gate is declared: tool, command, threshold, merge window, and what a one-frame change
   of X % does. If the gate can count a pop as a cut, the pack must say how pops are allowed to appear.
L9 every still time is ≥ reveal + hold of the element it is meant to show; no still inside a stagger.
L10 the free list and the fixed list together cover every element in §7; nothing is unstated.

## 8. Contradictions

Precedence is in the front matter. The renderer, on hitting a contradiction: log it, apply the order, and
continue. The author fixes the pack afterwards and records the fix. Two fixed rules that cannot both hold
make the pack defective — that is not the renderer's problem to solve silently.

## 9. What the renderer returns

- the film and, when the kit has one, the silent master (600 packets checked before mux);
- the 14 review stills at the pack's times, read back after the render;
- a report with: how to run the build, the acceptance measurements (actual numbers), the **decision log**,
  and any deviation. The decision log is required, not optional: it is the sufficiency evidence.

## 10. Generative vs programmatic payload

The same pack serves both. For a **generative model**, each scene's §7 block is the full prompt (subject,
action, camera, light, texture, negative list), plus the pack-level model, aspect, seed policy, number of
takes, and the selection rule from `skills/video-direction`. For a **programmatic kit**, each §7 block is
the scene spec the code implements, guarded by the kit. Cut tables, evidence, chrome and acceptance are
identical; only the per-scene payload changes.
