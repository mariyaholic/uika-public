---
name: visual-direction
description: Use when designing or restyling any UI, page, deck, or graphic — forces a concept-first brief, design tokens, and a self-critique loop so output is thematic and distinctive instead of generic template slop. Layer on top of frontend-design / design-taste-frontend.
---

# Visual direction (ADR-0015)

Taste is a *procedure*, not a mood. Do these in order; each step produces text you can check.

## 1. Direction card (write it before any code)
```
Audience:        <who, in what situation>
Concept:         <one sentence: what is this THING thematically, as a metaphor/world>
Three words:     <sensory, not generic — "lacquered, nocturnal, precise", not "modern, clean, sleek">
References:      <2 real named works/eras/designers — not "Apple-like">
Density & mood:  <airy | editorial | dense-instrument>, tone <warm|cold|...>
Forbidden:       <what this must NOT look like>
```
If a repo has canon (`design/uika-canonical.css`, ADR-0011), the card must cite it and inherit its tokens.

## 2. Tokens first
One file of CSS variables: color roles (bg, surface, ink, accent, warning), a type scale (ratio), spacing scale, radius, shadow, motion. Components only read tokens. Set night and light.

## 3. Choices that defeat slop
- **Type**: a distinctive display face + a refined body face. Not Inter/Roboto/Arial/system as the identity. Body 16–18px, 60–75ch measure.
- **Color**: one dominant + one sharp accent, neutrals tinted toward the hue. No default purple-to-blue gradients. Contrast ≥ 4.5:1.
- **Layout**: break symmetry on purpose. Not: centered badge + headline + 3 identical cards; nested cards; floating icon blobs; fake dashboards; emoji bullets; stock copy.
- **Detail**: real copy, real empty/loading/error states, visible focus, `prefers-reduced-motion`.

## 4. Two tests
- **Swap test**: replace the name/logo — if nothing else must change, it is slop. Every decorative choice must trace to the Concept line.
- **Crude ≠ intentional**: raw/brutalist is allowed only when executed precisely (alignment, rhythm, a rule for why it's rough). "Ugly by default" fails.

## 5. Critique loop (max 2 rounds)
Render → screenshot (browser tool) → critique against the direction card in 5 bullets → fix the top 3 → re-render. Report what changed and which card line it served.

## 6. Embeds (figures and video)
A page that carries a figure or a video follows the embed contract in ADR-0034 §9.
- **A figure goes in as inline SVG** — produced by `skills/figure-craft` (`uika figure render <spec> --formats svg,html --apply`), placed in a `<figure>` whose `<figcaption>` carries the manifest's provenance line. Never rasterise a figure to sit in a page; SVG stays crisp and themeable.
- **A video goes in as `<video controls preload="metadata" poster="<name>_sheet.png" width height>`** inside a fixed-aspect box, so the space is reserved before it loads (no layout shift). Never autoplay with sound.
- Both read the page's tokens. Do not restyle a figure's colours in CSS — change the token sheet instead (ADR-0011); the same spec then renders consistently in every repo.

## 7. Platform lookup (optional, ADR-0063)
After the direction card and the tokens exist, you may look up how to build one capability with native HTML, CSS or browser APIs in Chrome's Modern Web Guidance. Use it for dialogs and popovers, focus and `inert` handling, form validation and autofill, view transitions, main-thread scheduling, Content Security Policy, HTML sanitisation and passkeys.
- Set `DISABLE_TELEMETRY=1` first. Without it the tool sends your query text to Google. PowerShell: `$env:DISABLE_TELEMETRY = '1'`.
- Search with two to five framework-neutral words and no project or product names: `npx -y modern-web-guidance@1.0.0 search "dialog open animation"` (`npx.cmd` on Windows).
- Read a guide: `npx -y modern-web-guidance@1.0.0 retrieve <guide-id>`.
- Report on old front-end code without changing it: `npx -y modern-web-guidance@1.0.0 legacy-scan <path>`. Show the plan to the owner before any refactor.
- Never run its `install`, `update` or `uninstall` commands, `@latest`, or a plugin install. Do not add the reply footer that the guides ask for.
- The direction card, the repo's tokens and this skill decide the design. A guide decides only how a native feature is written. Record the guide ids you used in the commit message or the handoff `Verify` line.

Sources: Anthropic frontend-aesthetics cookbook; design-system-first guidance; Taste/Impeccable/Hallmark anti-slop skills; Stageplay guidebook (`docs/stageplay-design-and-web.md`).

## 8. Component sources and interactibility (`unmask`, ADR-0075/0076)
- **Zero-dependency default**: Static pages, manuals, and dashboards use plain HTML, CSS, and ESM reading `design/uika-canonical.css`. Re-declare derived CSS variable aliases inside `[data-face="light"]` so theme switches propagate cleanly.
- **UIverse**: When adapting CSS components from UIverse, strip hardcoded hex colors, map to canonical tokens, enforce `:focus-visible`, and guard animations with `@media (prefers-reduced-motion: reduce)`.
- **Interactibility gate**: Run `uika unmask check <dir>` to catch inert buttons, `href="#"` placeholders, `pointer-events: none` traps, and unguarded async click handlers.

## Toolchain
HTML, CSS and JavaScript are the default surface. Verify every visual change with Playwright screenshots at 375 and 1440 px and `uika unmask check`, take colours and type from the repo's tokens (supply layer), self-host fonts as woff2, and check images with Pillow or `sharp`. Vite/Tailwind only when the repo already uses them. See skills/toolchains.
