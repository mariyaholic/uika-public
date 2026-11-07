---
name: figure-craft
description: Use when output must be understood at a glance rather than read — a diagram, chart, figure, matrix, timeline or decorative plate — and when that figure must be consistent across repos. One declarative spec compiles to SVG (canonical), PNG, PDF and an embeddable HTML block, with tokens inherited from the repo canon and an evidence manifest. Owns the middle rung of the output ladder (prose < diagram < page < video). Pairs with visual-direction (pages) and video-pipeline (video).
---

# Figure craft (ADR-0034)

A figure is not "drawn"; it is **declared once and compiled** to one canonical SVG plus a manifest that
proves where every number came from. The same spec renders in any repo because the engine reads the
repo's own token sheet; a figure never hard-codes the estate palette. Guards fail the render, not a
later review (the same discipline as `manim_guards.py`).

Pick the lowest rung that carries the meaning: prose, then a **figure**, then a page (skills/visual-direction),
then video (skills/video-pipeline). Do not build a page to show one relationship.

## Quick path
```
uika figure check  <spec.figure.json>                    # guards only (dry run)
uika figure render <spec.figure.json> --formats svg,html,png,pdf --apply   # dry run without --apply
uika figure ls     <dir>
uika figure theme  [name]                                # listed/inspected themes
```
`render` writes `<id>.svg` (canonical), `<id>.manifest.json` (the evidence lock) and, on request,
`<id>.html` (embeddable `<figure>`), `<id>.png`/`<id>.pdf` (via Playwright). The engine is
`kit/figure.mjs` — pure ESM, zero dependencies, importable in any repo; `uika figure` is a thin wrapper. PNG/PDF need Playwright (`npm i -D playwright`), which uika does not bundle.

## The spec (`*.figure.json`)
```json
{
  "id": "weekly-signups",
  "title": "Weekly sign-ups",
  "caption": "source: signups.csv",
  "form": "bar",
  "data": { "source": "…/signups.csv", "series": [{ "label": "Week 1", "value": 120 }, { "label": "Week 2", "value": 145 }] },
  "notes": { "provenance": "…", "interpretation": "sign-ups, not active users" }
}
```
- `form` is one of the thirteen in `references/03-forms.md`.
- `data` carries the rows AND everything drawn; `source` points at the file the numbers came from.
- `notes.provenance` / `notes.interpretation` are required in spirit: a true number in the wrong context
  is a false claim. They surface in the manifest and the HTML `<figcaption>`.

## Non-negotiables
- **Tokens, not literals.** Colour/type come from the token sheet; change the sheet, every figure follows.
- **Evidence lock.** Every number on the figure must exist in `data` (or `data.allowed`); a number the
  spec invents fails `evidenceDigits`. Axis ticks and bin edges are the only derived numbers, and are
  marked as axis, never evidence.
- **Deterministic.** Same spec + tokens ⇒ identical bytes; figures are reviewable in a git diff.
- **Fonts bound by declaration.** A font role with no family fails `fontsBound` (never a silent substitute).
- **Guards, not vibes.** `knownRefs`, `inFrame`, `typeFloor`, `noOverlap`, `evidenceDigits`, `uniqueLabels`,
  `fontsBound`.
- **The channel is the message.** A precise comparison gets position/length, not area or colour; categorical colour is
  Okabe–Ito with ≤ 9 classes; every colour-carried distinction has a second carrier; contrast is checked on the pair,
  not the swatch (references/06). A figure of six numbers is a table — render the table instead.

## References (read in order the first time)
1. `references/01-when-a-figure.md` — the ladder, and when a diagram beats prose (and when it does not)
2. `references/02-spec.md` — the full spec schema and the per-form `data` shapes
3. `references/03-forms.md` — the form catalogue with when-to-use and a minimal example each
4. `references/04-tokens-and-themes.md` — the token bridge, faces, file-bound fonts, making a repo theme
5. `references/05-pitfalls.md` — diagram slop tells, and every guard failure with its fix
6. `references/06-encodings-and-palette.md` — which channel carries which number, the colour-vision palette, the
   contrast floor, the table fallback, and the pre-render checklist (ADR-0040)

## Toolchain
Node ≥ 22 for the engine (zero deps). PNG/PDF export needs Playwright (`npm i -D playwright`), the same
tool `visual-direction` uses for screenshots. See skills/toolchains.
