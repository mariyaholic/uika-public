# 02 — The spec

A spec is one JSON file, `*.figure.json`. The engine reads it, compiles an in-memory model, runs the
guards, and serialises SVG + a manifest.

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | stable slug; default output basename and manifest id |
| `title` | no | display title (top-left); defaults to `id` |
| `caption` | no | one line under the figure (bottom-left); the provenance goes here on embeds |
| `form` | yes | one of the thirteen in `03-forms.md` |
| `width` / `height` | no | canvas in px; default 960×600 |
| `data` | yes | rows + everything drawn (per-form shape in `03-forms.md`) |
| `notes` | yes* | `provenance` and `interpretation`; *required in spirit, copied into the manifest |

## Data and the evidence lock
`data` is the single source of truth. Any string or number inside it (any depth) is admissible on the
figure. A number the engine renders that is **not** found anywhere in `data` fails `evidenceDigits`.

- Put the real rows in `data.rows` and the drawn series in `data.series`; keep both, so the manifest is a
  proof, not a summary.
- `data.source` is a path (relative to the repo root); the manifest hashes that file when present.
- When a source prints numbers you must show but which are not rows (a total on a cover page), list them
  in `data.allowed: [ … ]` and say why in `notes`.
- Axis ticks and histogram bin edges are **derived** and are marked as axis — they are exempt, because the
  scale is the engine's job, not a claim about the world.

## Outputs
`uika figure render <spec> --apply` writes, beside the spec or to `--out` (without `--apply` it lists what it would write):
- `<id>.svg` — canonical, text-diffable, themeable.
- `<id>.manifest.json` — `uika.figure-manifest.v1`:
  `{ schema, id, form, title, source, source_sha256, tokens_sha256, figure_sha256, rows, interpretation }`.
- `<id>.html` — an embeddable `<figure class="uika-figure">` with a provenance `<figcaption>`.
- `<id>.png` / `<id>.pdf` — via Playwright (see the skill's Toolchain note).

## Themes and faces
- Default token sheet: `<repo>/design/uika-canonical.css`. Override with `--tokens <sheet.css>`.
- Canonical faces: `--face night` (default, night stage) or `--face light` (light).
- Named themes live in `kit/themes/*.json`; `--theme paper` for print. A theme is a token swap only.
