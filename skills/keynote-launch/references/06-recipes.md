# 06 — Recipes (each one is a scene in `skills/keynote-launch/examples/template_launch.py`)

Scene functions take scene-local seconds `t`. `t` can be below 0 or past the scene's length while a
transition renders both sides, so clamp everything through `seg()`.

## A. Cold open: type wall and a kinetic line (template `s_cold`, 5 s)
1. Start from the `stage` field. Draw `type_wall("KEEPER", t, (26,28,34), 560)`: the giant word sits at about
   8 % contrast and drifts 60 px/s.
2. Kicker at y=400: `text_b` 30 px, tracking 6, `alpha=seg(t, .3, 1)`.
3. Headline at y=600: `kinetic_words(["Meet","the","keeper."], t-0.9, size=170, accent=2)`, with the
   accent on the product word.
4. Leave by **light slit** (`t_slit`, 1.0 s). It's the unveiling transition, so it belongs right after the cold
   open. Cue `whoosh_up` at -2 dB against the bed, 0.5 s before the boundary.
Studied: Build ceV3RsG946s (type wall), Samsung Nul7mPL7Nt4 12:24 (slit), Apple M5 kinetic claims.

## B. KPIs on b-roll (template `s_kpis`, 7 s)
1. Background footage (here `broll(t)`), plus `scrim(img, 420, 1080, 0.78)`.
2. Bug "KEEPER ONE" top-left, and a headline that lands word by word at (96,300), size 96.
3. `kpi_row(items, t-1.4, y=760, size=140)`, where items come from `EV.num(key)` with a 1–3 word caption each.
4. At t > 4.6, add `lower_caption("Closed loop", G(f"{EV.fig('kpi.water')} less water …"))`.
5. Leave by **capsule**: the next chart grows out of a centred pill, which reads as "zoom in on the detail".
Studied: Tesla Investor Day qUQLTciXCBE (KPIs on footage), DJI BNEmDcQr6hk (bug and caption).

## C. Bubble clock (template `s_bubbles`, 9 s)
1. Use a near-white field. The headline sits top-left: "Ten years, one direction."
2. Define entities with lambdas of the year (x, y, r, group). Make one protagonist, with the strongest motion
   and a trail.
3. `year = 2015 + 10*ease_io(seg(t, 1.2, 7.6))`. The giant year inside `bubble_chart` is the clock.
4. Add the footnote "Illustrative motion. Figures live in the evidence table." whenever the motion is not data.
5. Leave by **push** (next item in a series).
Studied: TED hVimVzgtD6w, BBC jbkSRLYSojo.

## D. Wedges (template `s_wedges`, 9 s)
1. On the `stage` field, title at (160,130), and the unit line at (160,236). That line once collided with the
   title; see 07.
2. Base = linear ramp from `wedge.base2020` to `wedge.bau2050`. Each wedge ramps from 0 to its 2050 value, and
   each 2050 value is an evidence row.
3. Wedge beats at 1.6 / 3.6 / 5.6 s: `k = sum(ease_io(seg(t, b, b+1.3)))`.
4. Put the net figure in the accent colour after the last wedge (t > 7.2). It's a derived number, so its
   evidence row carries the arithmetic.
5. Leave by **mosaic** (a change of state, from data to product).
Studied: TED rDiGYuQicpA.

## E. Spec constellation (template `s_spec`, 7 s)
1. Use the `studio` field. Put the product name above in `display` 96.
2. Draw the device (rounded rect, inner screen, contact shadow). One accent ring grows on the screen.
3. `spec_callouts` with 3 items, stagger 0.5 s, lines drawn first and values typed after.
4. Leave by **icon portal** (enter the product's world).
Studied: Samsung Nul7mPL7Nt4 32:22, Rivian dimensions, Apple WWDC25 41:42 (portal).

## F. Rank table (template `s_rank`, 6 s)
White field, title plus "demo data" subtitle, columns 2023/2024/2025, the focus pill in `accent`. Leave by
**whip** (energy before the reveal). Studied: Apple WWDC25 0_DjDdfqtUE.

## G. Price reveal (template `s_price`, 6 s)
`price_split("K","1","EST. STARTING PRICE", EV.fig("price"), t-0.5)`. Put the hero accent (`chime`, 0 dB vs the
bed) at +0.5 s. Leave by **shape expand**: a small peak silhouette grows into the brand field. Studied: Rivian
82IiXIKkRIA, Samsung 52:37.

## H. Brand end card (template `s_end`, 5 s)
Use the `field` colour with the wordmark in `display` 150, the product line under it and the disclosure at the
bottom. In the last 1.4 s, `value_ramp` to black, the only fade allowed. The music resolves on a held tonic that
rings past the picture by about 2 s (05). Studied: Google I/O 115:00, Linear 3:59.

## Recipes not in the template (build from the kit)
- **UI persists across a cut** (Samsung 19:39): render the UI card on its own layer. Keep drawing it at the same
  place while the background switches from the UI field to footage (`t_capsule` on the background only).
- **Full-screen UI shrinks into the device** (WWDC25 10:32): `t_portal(b, a, 1-u)`, the portal run backwards
  with the rect set to the device's screen.
- **Name card becomes the frame** (Google I/O 83:36): draw the card's border; scale the border rect to frame
  size while the speaker footage fills it.
- **Lights-off reveal** (Nothing 1:47): ramp the field to black over 0.4 s while LED-like accent shapes
  brighten (draw them additively).
- **Grid-to-grid swap** (Nothing 17:41): build both grids as images and run `t_mosaic(block=160)` between
  them, one block per card.
- **Colour-panel carousel** (DevDay 2:10): one flat panel per stat word, with `t_push` (0.6 s) between panels
  and the presenter layer fixed on top.
