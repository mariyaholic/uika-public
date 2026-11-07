# 01 — When a figure is the right output

Karpathy's ranking of output formats, low to high (2026-10-02): prose, **diagram**, page, explainer video.
The rule is not "make it visual"; it is **pick the lowest rung that carries the meaning**, because every
rung above prose costs more to build, review and keep.

## Choose prose when
- The content is a decision, a caveat, a story, or a sequence of reasoning.
- The relationships are few and the reader needs the argument, not the shape.
- A figure would only restate a sentence ("A → B → C" as three boxes is usually prose debt).

## Choose a figure (this skill) when
- The meaning is **relational** (what connects to what, what depends on what) — `flow`, `tree`, `sequence`.
- The meaning is **comparative** (which is bigger, by how much) — `bar`, `distribution`.
- The meaning is **trend / shape** — `line`, `scatter`, `quadrant`, `matrix`, `timeline`.
- The figure is going to be **embedded** somewhere else (a page, a report, a README): SVG scales, diffs,
  and carries its manifest.

## Choose a page (skills/visual-direction) when
- The reader must **navigate** (sections, links, more than one figure, interactive state).
- A design direction is part of the message.

## Choose video (skills/video-pipeline) when
- The meaning unfolds **in time** and motion does work words cannot.

## What a figure is NOT for
- Dressing up a single number (a KPI is prose or one bold line).
- Replacing an argument with a picture of the argument.
- Decoration: a `pattern` plate is ornament and belongs with a real claim, never alone.

## The evidence question (ask it before drawing)
For every number you intend to show, name the file it came from. If you cannot, the figure is not ready.
Put those figures in `data.source` and `notes.provenance`; the manifest hashes the source so the figure is
anchored to a revision, not to memory.
