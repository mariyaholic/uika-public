# 02 — Type and layout (1920x1080)

## Type roles (`font(role, size)`)
| Role | Font | Use | Sizes at 1080p |
|---|---|---|---|
| `display` | Bahnschrift Bold SemiCondensed | headlines, product names | 84–170 (cold-open line 150–170) |
| `display_c` | Bahnschrift Bold Condensed | type walls, giant split letters | 400–700 |
| `num` / `num_light` | Bahnschrift SemiBold / Light | every figure, count-ups, the year clock | KPI 120–140, hero 200–320, clock 0.55 x chart height |
| `text` / `text_b` | Segoe UI / Bold | captions, labels, kickers | 24–40 (never < 24) |
| `light` | Segoe UI Light | quiet secondary lines | 30–48 |
| `serif` / `serif_i` | Georgia | editorial wordmarks, calls to action (Nothing "Ear (a)", Gore's numbered asks, DevDay serif numerals) | 60–140 |
| `cjk`, `cjk_b`, `jp` | Microsoft YaHei, Yu Gothic | Chinese/Japanese lines (Xiaomi question card, Google I/O bilingual name cards) | same scale as `text`/`display` |

Rules:
- Show numbers in `num`, never in `text`. Tabular digits keep count-ups from jittering.
- Kickers (small all-caps lines above a headline) use `text_b` 26–34 with `tracking=4..6`, as in the
  template's "DEMO BRAND · DEMO" and "EST. STARTING PRICE".
- Keep ≤ 12 words on screen outside charts. If the narrator says it, the screen shows only the noun or the
  number.

## Kinetic type (`kinetic_words`)
- Words land one by one with a 24 px rise and stagger 0.09–0.12 s. One accent word per line, in `accent`
  (template: "Meet the **keeper.**").
- In-scene claims (Apple M5 GriXfu4tL30 "Up to / 5x / faster") use 40–60 px type placed next to the action,
  not centred over it.
- A type wall is a giant word behind the subject, about 8 % contrast against the field, drifting 40–80 px/s
  (`type_wall`). Seen in Build ceV3RsG946s, Xiaomi "VLOG" and the Pixel "10" backdrop.

## Grid
- Margins: 96 px left/right for captions and bugs, 160 px for headlines; the bug sits at 72,72.
- Safe title area: keep everything important inside 160..1760 x 100..1000.
- The headline sits top-left (160,120..300) or centred at y≈540–600 for cold opens.
- A KPI row sits at y≈760 on b-roll, over a scrim from y=420 (`scrim(img, 420, 1080, 0.78)`), with columns at
  w*(i+0.5)/n.
- A chart's plot rect is about (220,190)-(1700,940), with the title above at y 120–240 and footnotes
  bottom-right at y≈1030.
- A lower caption sits bottom-left: CAPS feature name at h-140 and the spec line at h-96 (DJI BNEmDcQr6hk).

## Stage-screen layouts (when the "slide" sits behind a presenter)
Seen on every stage keynote. Use these when compositing a presenter (03) over a generated LED wall:
1. **Presenter left third, word or number right two-thirds** (Rivian "Spaces", OpenAI DevDay "Developers").
2. **Capsule photo window plus a word** (Rivian 82IiXIKkRIA). Use `capsule_photo` for the window.
3. **Giant word wall behind the presenter**, cropped by the frame (Build, Xiaomi calligraphy).
4. **Colour panels as a carousel**: each stat word sits on its own flat panel and slides horizontally behind the
   speaker (DevDay U9mJuUkhUzk 2:10–2:28). Build it with `t_push` between panel frames.
5. **Ultra-wide scale shot**: the tiny presenter and the whole LED. Cut to it once per chapter to reset scale.
