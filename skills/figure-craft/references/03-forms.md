# 03 — The form catalogue

Thirteen forms. Each row: when to use it, its `data` shape, and a minimal spec.

## Diagram forms

### flow — process, pipeline, cause
`data: { nodes: [{ id, label, layer }], edges: [[from, to]] }` — `layer` sets left-to-right position.
Edges are straight, so keep a pipeline linear; give a branch its own adjacent layer (a skip edge
crosses the nodes in between).
```json
{ "id": "p", "form": "flow", "data": { "nodes": [
  { "id": "a", "label": "Ingest", "layer": 0 }, { "id": "b", "label": "Compile", "layer": 1 }],
  "edges": [["a","b"]] } }
```

### sequence — who talks to whom, in order
`data: { participants: [{ id, label }], messages: [{ from, to, label }] }`.
```json
{ "id": "s", "form": "sequence", "data": {
  "participants": [{ "id": "u", "label": "user" }, { "id": "s", "label": "server" }],
  "messages": [{ "from": "u", "to": "s", "label": "request" }] } }
```

### layers — a stack / architecture
`data: { layers: [{ id, label, note? }] }` — top to bottom.

### timeline — events along an axis
`data: { events: [{ at, label }], range: [lo, hi] }` — `at` is a number (year, day, ms).

### quadrant — two axes, four zones
`data: { quadrants: [tl, tr, bl, br], points: [{ label, x, y }], x?: { left, right } }`
where `x`,`y` are 0..1.

### tree — hierarchy
`data: { root: { label, children: [ …same shape… ] } }`.

## Data forms

### bar — compare magnitudes
`data: { series: [{ label, value, fill? }] }`. One value per category.

### line — trend over an ordered x
`data: { series: [{ label?, color?, points: [{ x, y }] }] }` (x is ordinal; points are evenly spaced).

### scatter — relationship between two measures
`data: { points: [{ x, y, label? }] }`.

### distribution — spread / frequency
`data: { values: [ … ], bins? }`, or pre-binned `series: [{ label, value }]`. Bin edges are derived (axis).

### matrix — heatmap / coverage grid
`data: { rows: [ … ], cols: [ … ], values: [[ … per row … ]] }`. Sign picks the colour role; magnitude is opacity.

## Escape hatch and ornament

### custom-svg — hand-drawn geometry
`data: { svg: "<fragment>" }`. The engine cannot bound raw geometry, so it is exempt from `inFrame`;
the author owns the coordinates and the frame.

### pattern — decorative field
`data: { seed, count?, max? }`. Seeded and deterministic. Ornament only — never a claim by itself.

## Choosing between two that fit
- `bar` vs `line`: categories → bar; a continuum → line.
- `flow` vs `sequence`: shape of a system → flow; order of messages → sequence.
- `tree` vs `layers`: branching → tree; a stack → layers.
- `matrix` vs `quadrant`: many rows × many cols → matrix; two axes with a few points → quadrant.
