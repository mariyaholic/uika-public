---
name: video-prompt
description: Use when writing the prompt or spec for a video that someone else will build — a shot list, a beat table, a generator prompt, a renderer brief — and especially when the agent that writes prompts is not the agent that makes the video. Produces a typed .vprompt.md pack (treatment, style bible, measured cut table, scene specs, evidence lock, acceptance tests) plus the closure checks and blind-render sufficiency test that make the handoff measurable. Also use when a video must be reproducible from a document, when a pack is handed to a cheaper or different renderer, or when an agent is asked to "just write the video prompt" without building it.
---

> **uika-oss note:** `uika video`, `uika figure`, `uika ref` and `uika eval` ship with uika-oss (ffmpeg and Playwright are separate installs). The `uika creative ledger|deck|diverge|pick` commands named below are not in uika-oss yet: draw a hand from `skills/creative-gates/deck.json` yourself and note the seed, keep the picks ledger as a plain file, and check wording divergence by reading the candidates side by side.

# Video prompt packs (ADR-0055)

A video prompt is not a paragraph. It is a **pack**: a typed document that fixes what the film says, how it
looks, when every cut lands, what every number is, and how the result will be measured — detailed enough
that a renderer which has never seen the film, the source, or its siblings can build it. The pack *is* the
prompt; the code is one possible execution of it.

This matters because the two roles can now be different agents. The author brings taste and evidence; the
renderer brings a kit; the reviewer measures. That split only works if the handoff is checkable.

## Why prose fails (measured, not asserted)

The `latch` v4 keynote was re-specified as a pack and rebuilt blind by a fresh renderer. The film matched
every fixed item (cuts, strings, palette, chrome, evidence) and passed `uika video qa` 0 fail — but the
pack itself had **13 gaps**: arithmetic that did not close (32 bars over a 48-band vector; 48 rows in a
34 px well), geometry collisions (`240 Hz OFF` inside the title bar), a contradiction between the colour
law and the palette table, a scene with no reveal time, and — the worst — an **acceptance gate the spec
could not see**, which forced the renderer to invent stepped reveals to pass a hidden test. None of that
was taste. All of it was checkable. Record: `register/postmortems/2026-10-19-latch-vprompt-experiment.md`.

The design rule that follows: **anything a machine can check belongs in the pack as a check, not in prose
as an adjective.**

## Roles

| role | owns | may | may not |
|---|---|---|---|
| **author** (`*.tower`) | brief, hand, evidence, pack | read measured inputs, the theme pack, a sibling film's *style*; dump stills from the kit to test feasibility | render or mux the deliverable; open a sibling's beat table before its own skeleton exists (Gate E) |
| **renderer** (`*.impl` or a cheaper model) | one pack → one film | read the pack, the theme pack kit, and the named inputs | read prior films, their source, or any other pack; add content the pack does not sanction |
| **reviewer** (`*.review`) | fidelity + mechanical gates | measure, watch, score the fixed list | rewrite the pack to match the film |
| **owner** | taste | watch and pick | — |

The renderer writes a **decision log** as it goes: every point where the pack was silent, the choice it
made, and why. That log is the sufficiency instrument — not an afterthought.

## The pack

One file, `<slug>.vprompt.md`, beside the film in the product repo. Front matter fixes the spec; the body
sections carry the content. Full field-by-field format: `references/pack-format.md`; skeleton:
`assets/pack-template.vprompt.md`.

```
spec: 20.0 s · 30 fps · 600 frames · 640x360 native · 1920x1080 export
theme_pack: skills/retro-pixel     audio: inputs/<slug>_bed.wav
timing: inputs/<slug>.timing.json  evidence: inputs/<slug>_evidence.json
output: out/<slug>.mp4
```

Body sections, in order: **1** brief + creative hand verbatim · **2** what the film claims (logline, arc) ·
**3** timing (measured facts, cut table with the event each cut lands on) · **4** style bible + forbidden
list · **5** palette and colour law · **6** fixed chrome · **7** scenes (view, content, reveal times,
per-scene prompt/spec block) · **8** evidence table · **9** acceptance tests · **10** deliberately free ·
**11** deliberately fixed · **12** build report required from the renderer.

Two payload styles behind one format: for a **generative model**, §7 rows are the generator prompts
(model, shot, seed policy, takes, selection rule); for a **programmatic kit**, §7 rows are the scene spec
the code implements (rect, slot, guard, reveal). Everything else is identical.

## Time: measured or refused

- A cut is not "at 9.7 s". It is "at the onset at 9.776 s" and the pack names the event id from the timing
  file. The renderer resolves it; it does not retype a number.
- Mark every time as either **global** (G) or **scene-local** (+ from the scene start). Half the latch gaps
  came from mixing them, including a "beat 1" that meant 0.045 in one place and 0.673 in another.
- Every reveal has a start and a hold. A scene with an unstated reveal time hands a visible decision to the
  renderer.

## The closure rules (part linted, part by hand)

Check these before handoff; a pack that fails one is not ready. `uika video prompt lint <pack>` checks the
mechanical subset (front matter, required sections, L1 arithmetic and cut table, L2 reveal/hold, L3 bare indices,
L5 palette, L6 rect bounds, L8 acceptance table) and prints the rest as MANUAL; walk those rows by hand.

| id | check | catches |
|---|---|---|
| L1 | durations sum to the spec; cuts strictly increasing; frame-exact integers | scene count vs cuts; 20.0 s that is 19.97 |
| L2 | every element has a reveal and a hold; no reveal after its scene's end | the missing hero time |
| L3 | every measured time names an event present in `timing.json` (tolerance stated); beat references resolve to values | "beat 1", invented cut times |
| L4 | every on-screen figure is verbatim in the evidence table; the evidence gate runs before frame 1 | unbacked numbers, typed-prefix bypasses |
| L5 | ≤16 palette slots, named + hex; every colour token resolves; the single meaning-change point is stated | alias KeyErrors, red meaning two things |
| L6 | every rect inside the canvas; text width ≤ its rect; labels do not share a cell with the title bar; "centred" is a predicate | the logotype that was "centred" but left-anchored |
| L7 | graphic arithmetic closes: bar → band mapping covers the vector; rows × cell ≤ well; capacity ≤ available columns | 32 bars from `2i`; 48 rows in 34 px |
| L8 | the acceptance gate is visible: tool, threshold, merge window, and what it does to motion | stepped reveals invented to dodge a detector |
| L9 | review stills are generated at reveal + hold, never inside a stagger | blank caveat card at 15.2 s |
| L10 | every element is either fully specified or listed free; nothing is silently unstated | the whole gap class |

## Contradictions and precedence

Internal contradiction is legal in a first draft and fatal in a handoff. Declare a precedence order and
put it in the pack: **colour law / physics > explicit scene spec > usage table > example > habit**. When
the renderer hits a contradiction it logs it and applies the order; it never "smooths it over". The pack's
author fixes the pack afterwards — a renderer forced to invent a resolution is a pack defect.

The latch run resolved one correctly: §4 said red means *fault* until frame 293 and never again; §5's
table said the VN name tab is red. The law won, the pin scene's tab is green, and the shipped v4 (which
kept it red) turned out to violate its own hand CONSTRAINT. Written law beat habit — that is the whole
argument for packs.

## The sufficiency test (run it before trusting a pack)

1. **Hermetic inputs.** Copy the bed, timing JSON and evidence into a test folder. Nothing else.
2. **Fresh renderer.** A subagent whose brief forbids `promo-v4/`, prior films, posters/sheets, and
   `uika find`. It sees the pack, the theme pack kit, and the three inputs.
3. **Build to spec.** The renderer delivers: film, 14 stills at the pack's times, report with the
   decision log.
4. **Score fidelity on fixed items only.** Structure (scene count, cut frames ±1), strings, palette,
   chrome, reveal times, meaning change, audio, gates. Free-item differences are *expected*.
5. **Classify every log entry**: true gap (pack silent, visible choice), ambiguity, contradiction,
   noise (pack said it), missing input.
6. **Verdict.** Pass = every fixed item reproduced and the true gaps are chrome/build only. A pack whose
   blind film differs on *intent* has failed even if a gate passed — the renderer guessed, it did not read.

Done once, this costs one film and returns a defect list the author can fix in the pack. That is cheaper
than the owner rejecting a delivered set, which is the alternative.

## Author's checklist before handoff

- [ ] hand drawn with `uika creative deck`, pasted verbatim, and structurally obeyed (not just quoted)
- [ ] cut table names a measured event per cut; no free-floating seconds
- [ ] every scene has: view, content, reveal times, hold, and its per-scene prompt/spec block
- [ ] every number is in the evidence table with a source; the gate command is named
- [ ] palette + colour law + the one meaning change, stated together
- [ ] closure rules L1–L10 walked, or `uika video prompt lint` clean
- [ ] acceptance section names the tools, thresholds and merge windows
- [ ] free/fixed split is explicit
- [ ] the pack was written **before** the renderer wrote code (a pack reconstructed afterwards is a review
      record, not a prompt)
- [ ] the renderer brief is four-section (Objective / Output format / Tools allowed / Boundaries) and
      carries the decision-log requirement

## Related

`skills/creative-gates` (hands, divergence, ledger) → `skills/video-direction` (treatment, style bible,
shot list craft) → **this skill** (the pack) → `skills/video-pipeline` (stages, kit, render) →
`skills/video-review` (QA, sheets, postmortem). Theme packs: `skills/retro-pixel`, `skills/keynote-launch`,
`skills/explainer`. The pack does not replace those; it composes them into one artifact.
