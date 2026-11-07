# 05 — Pitfalls and guard failures

Every guard failure names what to fix. This is the catalogue; the same names appear in `figure.mjs`.

## Guard failures → fixes
| Guard | Message looks like | Fix |
|---|---|---|
| `knownRefs` | `flow edge a->b: endpoint not declared` | declare every node an edge touches; no dangling arrows |
| `inFrame` | `text "…" spans x[…] y[…], outside […]` | shorten a label, widen the matrix gutter, or set `width`/`height` |
| `typeFloor` | `"…" is 8px (< 12)` | raise `size`; nothing below 12px at this canvas scale |
| `noOverlap` | `"…" overlaps "…"` | fewer items, shorter labels, or a wider canvas |
| `evidenceDigits` | `"…" renders 7, which is not in the source data` | add the value to `data.rows`/`data.allowed` with a source, or drop it |
| `uniqueLabels` | `duplicate labels …` | two items claim one identity; give them distinct ids |
| `fontsBound` | `font role "mono" has no declared family` | declare the face in the theme's `fonts` map |

## Diagram slop tells (avoid by construction)
- **The titled box of numbers.** If a claim is a magnitude, it wants a `bar`/`line`, not a card. (This is
  the exact defect the launch-keynotes postmortem named.)
- **Decoration over data.** Watermarks, ticks, glows must not sit on the marks; the engine's `noOverlap`
  covers labels, but keep decorative SVG clear of marks too.
- **A figure that restates a sentence.** Three boxes in a row is prose with extra steps.
- **Colour carrying meaning alone.** Sign is also encoded by position/opacity; state the reading in `notes`.
- **Derived numbers dressed as evidence.** A percentage computed in your head is not in the source; put it
  in `data.allowed` with the arithmetic in `notes`, or leave it out.
- **One spec, two looks.** Do not fork the spec per theme; swap tokens.
- **A stale manifest.** Re-render after editing the spec or the source; the `figure_sha256` is the proof.

## The evidence question, again
If you cannot name the file a number came from, you cannot show the number. `data.source` +
`notes.provenance` are how the manifest anchors a figure to a revision — fill them first, not last.
