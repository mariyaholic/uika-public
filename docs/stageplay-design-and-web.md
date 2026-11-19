# Stageplay Design and Modern Web Guidebook (`docs/stageplay-design-and-web.md`)

Design canon, UIverse component integration, modern web guidance, and web interactibility checks (`ADR-0011`, `ADR-0063`, `ADR-0076`).

## 1. Design Canon (ADR-0011)
- **Token Single Source**: Derive all colors, radii, motion timings, and font stacks from `design/uika-canonical.css`.
- **Duality Rule**:
  - **night face (`:root`, default)**: `#0b0913` stage ground, `#bb9955` gold, `#881144` wine curtain, `#a497d6` lavender, `#e9e4da` platinum, `#a2434d` inner lining, `#6e9c7e` sage.
  - **light face (`[data-face="light"]`)**: `#f7f3ea` warm paper ground, `#a37f2e` gold, `#6fa61d` lime accent, `#6f5faa` lavender, `#241f18` dark ink.
- **Scoped Alias Rule**: Re-declare derived CSS variable aliases inside `[data-face="light"]` scopes so theme switching updates inherited components consistently.

## 2. UIverse Stack Policy
- **Zero-Dependency Default**: Static sites, manuals, and React 19 workspaces use plain HTML, CSS, and ESM with `design/uika-canonical.css`.
- **UIverse Adaptation**: When porting CSS components, strip hardcoded hex colors, map to canonical tokens (`--gold`/`--bg-panel`/`--line-strong`), enforce `:focus-visible`, wrap animations in `@media (prefers-reduced-motion: reduce)`, and use native `<button>`/`<a>` elements.

## 3. Modern Web Guidance & Unmask Checks (ADR-0063, ADR-0075)
- **Modern Web Lookup**: Run `DISABLE_TELEMETRY=1 npx -y modern-web-guidance@1.0.0 search "<query>"` for native dialogs, popovers, view transitions, CSP, and `inert` state handling.
- **Unmask Interactibility Audit**: Run `uika unmask check <dir>` before wrap to verify every `<button>` has an explicit `type` or action handler, no inert `href="#"` links exist, and no `pointer-events: none` rules trap interactive child controls.
- **Plain Prose Compliance (ADR-0062)**: Check all UI labels, tooltips, empty states, and headings against the ten banned prose patterns in `skills/plain-prose/SKILL.md`.
