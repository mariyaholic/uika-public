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
If a repo has canon (Uika: `design/uika-canonical.css`, ADR-0011), the card must cite it and inherit its tokens.

## 2. Tokens first
One file of CSS variables: color roles (bg, surface, ink, accent, warning), a type scale (ratio), spacing scale, radius, shadow, motion. Components only read tokens. Set light and dark.

## 3. Choices that defeat slop
- **Type**: a distinctive display face + a refined body face. Not Inter/Roboto/Arial/system as the identity. Body 16–18px, 60–75ch measure.
- **Color**: one dominant + one sharp accent, neutrals tinted toward the hue. No default purple-to-blue gradients. Contrast ≥ 4.5:1.
- **Layout**: break symmetry on purpose. Not: centered badge + headline + 3 identical cards; nested cards; floating icon blobs; fake dashboards; emoji bullets; stock "Elevate your workflow" copy.
- **Detail**: real copy, real empty/loading/error states, visible focus, `prefers-reduced-motion`.

## 4. Two tests
- **Swap test**: replace the name/logo — if nothing else must change, it is slop. Every decorative choice must trace to the Concept line.
- **Crude ≠ intentional**: raw/brutalist is allowed only when executed precisely (alignment, rhythm, a rule for why it's rough). "Ugly by default" fails.

## 5. Critique loop (max 2 rounds)
Render → screenshot (browser tool) → critique against the direction card in 5 bullets → fix the top 3 → re-render. Report what changed and which card line it served.

## 6. Embeds (figures and video)
A page that carries a figure or a video follows the embed contract in ADR-0034 §9.
- **A figure goes in as inline SVG** — produced by `skills/figure-craft` (`uika figure render <spec> --formats svg,html --apply`),
  placed in a `<figure>` whose `<figcaption>` carries the manifest's provenance line. Never rasterise a figure
  to sit in a page; SVG stays crisp and themeable.
- **A video goes in as `<video controls preload="metadata" poster="<name>_sheet.png" width height>`** inside a
  fixed-aspect box, so the space is reserved before it loads (no layout shift). Never autoplay with sound.
- Both read the page's tokens. Do not restyle a figure's colours in CSS — change the token sheet instead
  (ADR-0011); the same spec then renders consistently in every repo.

Sources: Anthropic frontend-aesthetics cookbook; design-system-first guidance (MindStudio); Taste/Impeccable/Hallmark anti-slop skills.

## Toolchain
HTML, CSS and JavaScript are the default surface. Verify every visual change with Playwright screenshots at 375 and 1440 px, take colours and type from the repo's tokens (supply layer), self-host fonts as woff2, and check images with Pillow or `sharp`. Vite/Tailwind only when the repo already uses them. See skills/toolchains.
