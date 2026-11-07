---
name: document-craft
description: Use when producing a page, memo, report, paper, one-pager, investor document or PDF — choosing a generator (Typst, LaTeX, WeasyPrint, ReportLab, Pandoc) for its real limits, laying out structure before style, setting type to readable measures, making accessibility claims that are true (PDF/UA, tagged PDF, title/language/alt text), clearing font licences, and deciding whether a table, a figure or prose carries the claim. Owns the page rung of the output ladder above figure-craft.
---

# Document craft (ADR-0040)

A document is **an argument with a reading order**, compiled from a declaration. Two failures dominate: styling before
the structure is decided, and an accessibility claim that is a flag rather than a fact.

Pick the rung first (`skills/figure-craft` owns the ladder): prose < table < figure < **page** < deck < video. Do not
build a page to carry one relationship.

## 1. Generator: choose for the limits, not the demo

| Tool | Model | Real limits |
|---|---|---|
| **Typst** | markup + rules; fast incremental compile | font selection follows installed fonts unless you control them (`--font-path`, or disable system fonts); PDF/UA-1 export exists but "some crucial rules cannot be checked automatically" |
| **LaTeX** | markup + packages; strongest math | tagging needs `\DocumentMetadata` plus author-supplied alt text and table headers; package compatibility tied to TeX version |
| **WeasyPrint** | HTML/CSS → PDF; reuse web skills | page size/margins belong in CSS `@page`; rendering can change between versions; PDF/UA variants may be requested but valid output is not guaranteed |
| **ReportLab** | imperative Python (Platypus: templates/pages/frames/flowables) | automatic tagging is scoped to the commercial RLextra edition; font embedding documented for Type 1 |
| **Pandoc** | converter; delegates PDF to an engine | conversion can lose layout detail (margins named explicitly in its docs); the engine's limits become yours |

There is **no defensible "fastest" or "byte-identical" ranking** across these. Pin the tool version, the fonts, the
template and the dependencies, then measure on a real project document. If reproducibility matters, the pinned inputs are
the guarantee; the tool is not.

Default choice: Typst for a new document (declarative, fast, one file), LaTeX when the math or an existing template
demands it, WeasyPrint when the page must share the web design system, Pandoc only for conversion.

## 2. Structure before style

Write, in this order, before a single token is applied:

1. **Reader and decision.** Who reads it, and what do they do next?
2. **One claim per section**, as a sentence. A section with two claims is two sections.
3. **Which carrier per claim**: prose, a table (exact values), or a figure (a relationship). The figure goes through
   `skills/figure-craft`, not through hand-placed boxes.
4. **Order** — the order a reader needs, which is often not the order you discovered things.
5. **Budget** — page or word count, and the caveats that must survive it.

Only then pick type and colour. Tokens come from the repo's sheet (`design/uika-canonical.css`, ADR-0011); a document is
not the place to invent a palette.

## 3. Type: the numbers that are actually sourced

- **Measure**: 45–75 characters per line, 66 as a common ideal (Rutter). USWDS gives 45–90 for screens, 66 for long text.
  Print follows the same range at a different point size.
- **Body size**: ≥ 16 px effective on screen with line-height ≥ 1.5 for long text (USWDS). Print body commonly 10–12 pt;
  large print 16–18 pt (Library of Congress NLS).
- **Contrast**: 4.5:1 normal text, 3:1 large text (18 pt, or 14 pt bold) — WCAG 2.2 AA. The screen floor is a floor for
  print too, because most print documents are read on screen.
- **Space**: paragraph spacing ≥ 1em; a heading's space above ≥ 1.5× its space below (USWDS). A page with no margin is a
  page nobody scans.

These are recommendations with named sources, not laws. State which one you broke and why.

## 4. Accessibility: a claim, not a flag

- **Tagged PDF is not PDF/UA.** Tagging gives structure and reading order; PDF/UA (ISO 14289) adds requirements on
  structure, embedded fonts, language, and alternatives for meaningful graphics.
- **Never write "accessible" or "PDF/UA" on a document because a generator flag was set.** Typst says some rules cannot be
  checked automatically; WeasyPrint warns valid output is not guaranteed. Write "tagged export requested; not validated"
  until a validator has run on the actual file.
- **Every document** gets a meaningful `<title>`, a `lang`, logical reading order, alt text on meaningful images, and
  decorative graphics marked as artifacts.
- A complex chart needs a text alternative; a data table is the easiest adequate one (`skills/figure-craft`
  references/06).

## 5. Fonts: check the licence before you embed and ship

The SIL Open Font License permits full or subset embedding without changing the document's licence. Microsoft's guidance
distinguishes embedding in a document from redistributing the font file — permission for one is not permission for the
other. Most commercial faces allow document embedding but not extraction; some forbid embedding entirely.

Before a PDF leaves the repo: name every face, name its licence, and record whether embedding is permitted. A face that
is fine on the owner's screen can be a licence breach in a distributed PDF. Unverified faces are listed as such in
`labs/eval/creative-pipeline/README.md` (gap G7) — do not paper over it.

## 6. Tables, when the claim is exact

A table is the right rung for exact values, lookup and ranking (`skills/figure-craft` references/06 has the full rule).
Minimum: right-aligned numerics, tabular figures, one precision per column, a caption naming the topic, `<th>` with
`scope`, and SI spacing between value and unit. Percentage change is not percentage points.

## Non-negotiables

- Structure (reader, claim per section, carrier, order, budget) is written before any styling.
- Tokens come from the canon sheet; no new palette in a document.
- No accessibility claim without validation on the output file.
- Every font's embedding permission is named before distribution.
- Every number traces to a source file, with its context (`skills/video-pipeline` Stage 2 is the same rule for film;
  `skills/copy-craft` is the same rule for prose).
- One document, one look: do not fork the template per section.

## Checklist before you deliver

- [ ] Reader, decision and one claim per section are written down, and the order serves the reader.
- [ ] Each claim's carrier is chosen (prose / table / figure) and a figure went through `figure-craft`.
- [ ] Measure, body size, leading and contrast are inside the numbers above, or the break is stated.
- [ ] Title, language, reading order, alt text present; decorative graphics are artifacts.
- [ ] Accessibility claim matches what was validated — usually "tagged, not validated".
- [ ] Every font's licence and embedding permission is recorded.
- [ ] Every number has a source and its context.

## Toolchain

Typst ≥ 0.13, or a TeX distribution, or WeasyPrint ≥ 60 (Python), or Pandoc ≥ 3. Fonts must be file-bound, not
system-resolved, when the document is rebuilt elsewhere. PDF inspection: `pdffonts`, `pdfinfo`, and a tagged-PDF check
(`pdfinfo` reports "Tagged: yes/no" but that is not PDF/UA conformance). See skills/toolchains.
