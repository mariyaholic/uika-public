---
name: theme-craft
description: Use when defining, extending or re-skinning a visual theme — design tokens, brand systems, per-product palettes, figure themes, dark mode, multi-brand identities — or when one system must yield several distinct looks without forking. Three token layers over fixed roles, DTCG-shaped interchange (and an accurate statement of its status), alias-cycle and contrast checks, and the rule that a new identity is a parameter set, never a second canon.
---

# Theme craft (ADR-0040)

A theme is **a parameter set over stable roles**. The failure this skill exists to prevent is a new identity produced by
editing literals in a copy of the sheet, so nothing downstream can tell "different brand" from "drifted". The other
failure is a second canon: `design/uika-canonical.css` is the canon (ADR-0011); this skill is a method, never a palette
proposal.

## 1. Three layers, and most output should name only the middle one

| Layer | What it holds | Rule |
|---|---|---|
| **primitive / reference** | raw values: `ink-900`, `bone-50`, `signal-500` | no usage intent; never referenced directly by a component or a figure |
| **semantic / role** | purpose: `surface`, `surface-raised`, `text-primary`, `text-dim`, `accent`, `data-1…n`, `grid` | the surface everything else names; this is where a theme's identity lives |
| **component** | a narrow override: `chart-axis-label` | small, and shrinking; a growing component layer means the role layer is wrong |

Spectrum describes primitives as underpinning higher-level decisions by alias and semantic tokens as the primary way
consumers interact; Primer's equivalent is base → functional → component. The names differ, the discipline does not.
DTCG's format does **not** require a semantic tier — it is a convention that earns its place because it is what makes a
theme a parameter set.

## 2. Interchange: DTCG, stated accurately

The Design Tokens Format Module 2025.10 is a **Final Community Group Report dated 28 October 2025**, published as a DTCG
Candidate Recommendation — and it says of itself: *"It is not a W3C Standard nor is it on the W3C Standards Track."* Write
that, not "W3C design tokens standard". The W3C's name is on the Community Group, not on a Recommendation.

The shape that matters operationally:

- hierarchical JSON; a group is an object without `$value`, a token has a name and a required `$value`;
- `$type` may sit on a token or be inherited from its group; `$description` is optional;
- **group names are organisational** — a tool must not infer a token's type or purpose from the group it sits in;
- **aliases** let a value reference another token, which is how a role layer points at primitives without duplicating
  literals;
- tools that open token files must support `application/design-tokens+json` and `application/json` — a scoped MUST, not a
  demand that every renderer implement the whole format.

Two structural failure modes are documented and must be handled by the loader: **circular references** (detect and fail)
and **names differing only by case** (legal in source JSON, collapsing to duplicate output names in some target languages).

Existing theme files predate DTCG and are theme JSON with semantic role names. Migration buys interop when needed; it is
an open question (ADR-0040 Q9), not a default.

## 3. Parameterising: how one system yields many identities

An identity is a set of choices on **axes**, not a new file. Declare the axes before touching values:

1. **Substrate** — the ground: paper, ink, stage-black, screen-grey.
2. **Chroma policy** — monochrome, one accent, or a categorical set; and how saturated the accent is allowed to be.
3. **Contrast posture** — high-contrast editorial vs low-contrast atmospheric (the second must still clear the floor).
4. **Type pairing** — a display voice and a text voice, and the ratio between their sizes.
5. **Density** — air per unit of information: a page that breathes vs a plate that packs.
6. **Motion/edge** — stepped vs continuous, hard vs soft corners (a figure theme inherits this even with no motion).

Two themes that differ on **fewer than three axes** read as the same identity in a different colour — that is the same
clone failure as six films with one beat table, one rung down. Carbon's model is the proof it works: token identifiers and
roles stay stable, the values change, and nothing downstream is edited per component. Primer's functional tokens switch
with colour mode and its inverted scales avoid per-component overrides.

Keep the identifiers stable across themes. If a role only exists in one theme, the role is wrong.

## 4. The floors a token system must enforce

- **4.5:1** text, **3:1** large text (WCAG 2.2 AA), checked on the **final foreground/background pairs**, not on the
  palette entries in isolation. Brand styling is not a general exemption.
- **3:1** for graphical objects needed to identify content, and never colour as the sole carrier.
- **Forced-colors / high-contrast mode** can replace authored colours wholesale and remove effects; the theme must survive
  it. Do not override forced colors to preserve an aesthetic.
- **A dark/light pair is two parameter sets**, not an inversion filter. Inverting luminance breaks ordered data ramps and
  every "red means bad" semantic.
- **Data colours are roles too** (`data-1…n`): a chart theme that hard-codes hexes is a fork of the canon.

## 5. Failure modes to look for in a review

- **Token sprawl** — dozens of near-duplicate values because nobody aliased. DTCG's own rationale names this as the problem
  it exists to solve (multi-brand teams juggling dozens or hundreds of files, with drift).
- **Semantic drift** — `accent` means three things in three products. A role is a contract.
- **Alias cycles** — A → B → A. A loader that recurses without a visited-set hangs; make it fail instead.
- **Case collisions** — `textPrimary` and `textprimary` export to one name in some targets.
- **Orphan component tokens** — a component layer that outgrew the role layer; delete, do not accumulate.
- **A second canon** — a themed sheet that redefines the canonical faces or colour meanings. That is an ADR, not a theme.

## Non-negotiables

- Canon stays `design/uika-canonical.css`; a theme parameterises it and never replaces it.
- Three layers; components name roles; roles name primitives.
- Stable role identifiers across themes; a role exists in every theme or it is not a role.
- Contrast measured on rendered pairs; colour never the sole carrier; forced-colors survives.
- DTCG status stated accurately wherever the format is named.
- An identity differs on ≥ 3 declared axes, not on hue alone.

## Checklist before a theme ships

- [ ] The six axes are declared, and this identity differs from its siblings on ≥ 3.
- [ ] Every role exists in every theme; no component token without a role behind it.
- [ ] Aliases resolve to primitives; no cycles; no case-collision names.
- [ ] Every text pair passes 4.5:1 (or 3:1 large), and every data mark passes 3:1 against its panel.
- [ ] Dark and light are two parameter sets; ordered ramps were re-authored, not inverted.
- [ ] Rendered once in forced-colors mode and looked at.
- [ ] Nothing in the theme redefines the canon's type faces or colour meanings.

## Toolchain

JSON token files; a small resolver in ESM (the figure engine already reads a token sheet — extend it rather than writing a
second loader). Style Dictionary is the mature build tool if outputs for many platforms are needed (it accepts DTCG input
and ships conversion utilities). Pin the resolver version: a token build that changes silently changes every artefact
downstream. See skills/toolchains.
