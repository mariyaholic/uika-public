# 04 — Tokens and themes

The estate rule (ADR-0011) is **import, never re-invent**. The figure engine obeys it: a form names a
*role* (`accent`, `ink`, `surface`, `negative`), never a colour. The token sheet decides the paint.

## The bridge
`uika figure` resolves, in order:
1. `--theme <name>` → `kit/themes/<name>.json` (DTCG-shaped token groups + optional `fonts`; the
   legacy `{ "tokens": { ... } }` shape still reads).
2. `--tokens <sheet.css>` → CSS custom properties; `--face night` (default) reads `:root`,
   `--face light` reads `[data-face="light"]`.
3. Default: `<repo>/design/uika-canonical.css`, face `night`.

`var(--x)` indirection is resolved (e.g. `--text-bright: var(--platinum)` becomes a real paint), so a
sheet that composes tokens works.

## Role map
| Role | Canonical token | Used by |
|---|---|---|
| `bg` | `--bg-ground` | canvas |
| `surface` / `surface2` | `--bg-panel` / `--bg-panel-2` | cards, nodes |
| `rule` / `ruleStrong` | `--line` / `--line-strong` | grid, connectors |
| `accent` / `accentBright` | `--gold` / `--gold-bright` | the one dominant mark |
| `info` | `--lavender` | secondary series |
| `ornament` | `--marigold` | trims/callouts |
| `negative` / `positive` | `--lining` / `--sage` | sign/matrix, up/down |
| `ink` / `inkBright` / `muted` / `slate` | `--text` / `--text-bright` / `--muted` / `--slate` | type |

## Making a repo theme
1. Put the repo's token sheet somewhere stable and pass `--tokens`; or
2. Copy `kit/themes/paper.json` as `kit/themes/<repo>.json`, fill the token groups, commit it. A theme is a
   **token swap only** — it must not change layout, so the same spec looks consistent in every repo.

## The theme file shape (DTCG)
Themes use the Design Tokens Format Module's shape (ADR-0040 Q9): a group declares `$type`, a token
carries `$value`, and the CSS role name is the key. `--bg-ground` is `color.bg-ground.$value`.

```json
{
  "color": {
    "$type": "color",
    "bg-ground": { "$value": "#ffffff" },
    "gold": { "$value": "#8a6a20" }
  },
  "fontFamily": {
    "$type": "fontFamily",
    "display": { "$value": "Georgia, serif" }
  },
  "fonts": { "mono": { "family": "Consolas, monospace", "system": true } }
}
```

The engine rebuilds the custom properties from the groups (`fromDtcg` in `kit/figure.mjs`), and
`toDtcg` exports a token map back to this shape for other tooling. The eight bundled themes were
migrated to it and were verified to render byte-identically before and after.

## Fonts, bound by declaration
The canonical sheet names installed faces; a past project's IBM Plex Mono incident showed an installed-name request
can silently substitute and break a layout. So a theme declares a `fonts` map. A used role with no
`family` fails `fontsBound`. For exports that need exact glyphs, bind by file in the HTML/PDF wrapper via
`@font-face` and record the file in `fonts[role].src`.

```json
{ "fonts": { "mono": { "family": "Consolas, monospace", "system": true } } }
```
Set `"system": true` to acknowledge an installed face; give `"src"` instead when you ship the file.

## Light and dark
The estate has two faces (`night`, `light`) plus the print themes (`paper`, `mono`). Produce
the figure once and render it per face/theme; do not fork the spec.
