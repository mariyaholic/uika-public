# 06 — Encodings, palette and the accessibility floor

Which visual channel carries a number is a perceptual decision before it is a styling decision. This page is the
evidence and the defaults; the engine's guards can check contrast and labels, but nothing checks that you picked the
right channel.

## 1. The encoding rank (and what it does not mean)

Cleveland & McGill's classic quantitative-perception experiments rank channels roughly:

| Rank | Channel | Use for |
|---|---|---|
| 1 | position on a common scale | any comparison of magnitudes — the default |
| 2 | position on non-aligned scales, length, direction, angle | a comparison that must be *estimated*, not read |
| 3 | area, volume, curvature | a rough magnitude or a part-to-whole, never a precise one |
| 4 | shading, colour saturation/value | an *ordered* attribute only (a sequential scale) |

Two honest caveats, both from the revision literature:

- **The ranking is task-dependent.** The original work distinguishes aligned vs non-aligned position, and its "colour"
  result is not a test of categorical hue palettes. Do not read the table as "colour is bad for categories" — read it as
  "colour is bad for quantities you need to compare precisely".
- **Individual differences are real.** A 2022 replication found some participants' accuracy patterns credibly deviated
  from the canonical average-observer ranking. Group rankings describe a group. Use position/length as the default because
  it is the safest channel for the widest range of readers, not because everyone perceives it identically.

Practical consequence for this engine: a `bar`/`line` form with a shared axis is the default for a magnitude; a `quadrant`
or `matrix` is for a *relationship*; a `tree`/`flow` is for a *structure*; an `area`-based form needs a label value on the
mark, because nobody reads a bubble's true value from its area.

Sources: Cleveland & McGill, *JASA* 1984, doi:10.1080/01621459.1984.10478080 · Heer & Bostock, CHI 2010,
doi:10.1145/1753326.1753357 · replication: IEEE TVCG 2022, doi:10.1109/TVCG.2022.3226463.

## 2. Colour: category vs order, and the colour-vision floor

Two different jobs, two different palettes, and the crate does not let you use one for the other:

- **Categorical** means "different, with no order". Use Okabe–Ito's nine-colour set, designed to stay distinguishable
  under colour-vision deficiency:

  | | | | | | | | | |
  |---|---|---|---|---|---|---|---|---|
  | `#000000` | `#E69F00` | `#56B4E9` | `#009E73` | `#F0E442` | `#0072B2` | `#D55E00` | `#CC79A7` | `#999999` |

  Nine is the hard ceiling for *reliably* distinguishable categories. Past that, you are asking the reader to compare
  swatches; split the figure or use a small multiple instead.
- **Sequential/ordered** means "more or less". Use a single-hue lightness ramp, not a rainbow, and remember that
  perceived lightness is the channel doing the work (rank 4 above) — so anything you read from it is an estimate.

The same value set on a different theme is fine. The same *hue* meaning two different things in one document is not;
the token sheet is what prevents that.

Sources: Okabe & Ito, Color Universal Design, https://jfly.uni-koeln.de/color/ (values cross-checked against
https://journal.r-project.org/articles/RJ-2023-071/) · ColorBrewer's colorblind-safe filter,
https://colorbrewer2.org/ (doi of the original: 10.1179/000870403235002042).

## 3. The hard floor: contrast and colour-independence

These are not style choices; they are what makes a figure usable:

- **4.5:1** for text (a caption, an axis title) and **3:1** for large text; **3:1** for graphical objects needed to
  identify content, against their adjacent colours. WCAG 2.2 AA, SC 1.4.3 and 1.4.11.
- **Colour is never the only carrier** (SC 1.4.1). A category line also gets a label, a direct label, a shape, a dash
  pattern or position. In this engine, that usually means `labels` on or beside the marks, not a legend alone.
- **Contrast is checked on the pair, not the swatch.** A palette entry that passes against white can fail against the
  panel fill it actually sits on. Check the rendered foreground/background pairs.

The floor applies to a *legend* too: a legend key that is a 10 px coloured square with a 9 px grey label fails the
legibility floor even if the mark itself is fine.

Sources: WCAG 2.2 SC 1.4.3, https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html · SC 1.4.11,
https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html · SC 1.4.1,
https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html.

## 4. A figure needs a text alternative, and sometimes a table

An informative figure has to survive being read aloud. Minimum:

- `title` and `caption` that state the claim, not the chart type ("Latency drops 40 % after the cache", not "Bar chart of
  latency").
- `notes.interpretation` naming what the reader should and should not conclude (the engine carries it into the manifest
  and the `<figcaption>`).
- For a complex chart, a **data table is a valid part of the alternative** — WCAG requires an adequate text alternative,
  not a table specifically, but a table is the easiest adequate one for a dense series.

Sources: WAI complex images, https://www.w3.org/WAI/tutorials/images/complex/ · WCAG technique G92,
https://www.w3.org/WAI/WCAG21/Techniques/general/G92.

## 5. When the right answer is a table, not a figure

Use a **table** when the reader needs exact values, lookup, or a ranking they will compare row by row; use a **figure**
when they need a pattern, a trend or a shape. A figure of six numbers is a table wearing a costume. A table of 60 rows
is a figure nobody can see.

If it is a table, the same floors apply, plus:

- right-align numeric columns, use tabular figures, and keep one precision per column (an audit of >1,000 published
  tables found most failed exactly this: numerics that could not be compared vertically);
- `<th>` with `scope`, a `<caption>` that names the topic, and `id`/`headers` only when the table is genuinely
  multi-level;
- SI spacing between value and unit (`30.2 °C`), and never confuse percent change with percentage points (10 % → 9 % is
  −1 pp, −10 % relative).

Sources: Remshard & Queenborough 2023, doi:10.1002/ece3.10062 · WAI tables tutorial,
https://www.w3.org/WAI/tutorials/tables/ · NIST SI guide ch. 7 and 10, https://www.nist.gov/pml/special-publication-811 ·
ONS percentages, https://service-manual.ons.gov.uk/content/numbers/percentages.

## 6. Checklist before you render

- [ ] The channel matches the job (magnitude → position/length; relationship → quadrant/matrix; structure → tree/flow).
- [ ] Categorical colour is Okabe–Ito and ≤ 9 classes; ordered colour is one hue.
- [ ] Every colour-carried distinction has a second carrier (label, shape, position).
- [ ] Text pairs pass 4.5:1, marks pass 3:1, checked on the actual panel fill.
- [ ] `title`/`caption`/`notes.interpretation` state the claim, not the chart type.
- [ ] If it is really a table, it is a table — right-aligned numerics, one precision, a caption.
