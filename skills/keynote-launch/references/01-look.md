# 01 — The look

## What 46 launches share
- **One idea on screen.** The modal frame holds one line of type, one product, one chart or one person. Busy
  frames are rare and deliberate: Nothing's spec "bento" grid (Muen4f4L_6M 17:41) and Raycast's 102-feature
  montage (G7_7F_FBqQE).
- **Big plain fields.** A presenter or product sits on a flat or softly graded field. The field changes per
  chapter, and that change marks the chapter (Xiaomi's teal, ocean and orange LED fields; Stripe's purple).
- **Two families.** *Produced films* (Apple WWDC/September, Pixel, Samsung, Nothing, DJI, product films) are
  edited at about 3–4 s per shot, with graphics composited into footage. *Stage keynotes* (Jobs, Google I/O,
  Build, DevDay, GTC, Xiaomi, Rivian, Figma, Stripe) hold the presenter against a giant LED. The LED is the
  slide, and the edit cuts between close-up, mid shot and an ultra-wide that shows scale.
- **Restraint in colour.** Use one neutral family plus one accent. The accent marks the payoff word or number
  (Rivian's grey second word, Gore's green "green consumer", Pixel's single highlight).

## Themes in the kit (`THEMES`)
| Theme | Field | Ink | Accent | Use for | Seen in |
|---|---|---|---|---|---|
| `studio` | warm grey 232/230/226 | graphite | orange-red | product, spec, price, layout-led stories | Rivian R2 82IiXIKkRIA, Apple seamless white |
| `stage` | near-black | white | amber | cold opens, data on dark, drama | Jobs 2007 VQKMoT-6XSg, Nothing, Gore |
| `field` | saturated violet | white | yellow | brand moments, end cards, chapter colour | Stripe ONIexChUpuw, Xiaomi chapter fields |
Change the hues per brand, but keep the roles: `bg`, `ink`, `sub` (≈50 % contrast), `accent` (one per frame),
`accent2` (data only), `panel` and `line`. Data series use `SERIES` (six distinguishable hues). Never use more
than two series colours in one non-chart frame.

## Light and depth
- Products sit on seamless backgrounds with a soft contact shadow (a blurred capsule, 35–50 % opacity, offset
  down). Never use a hard drop shadow.
- Dark scenes use a horizon glow (Nothing's backlit silhouettes) or one light slit (Samsung) instead of
  vignettes.
- Defocused light blobs make honest b-roll stand-ins when there is no footage (template `broll()`). Use them
  only behind type, never as the subject.

## Banned (generic-template tells)
Bullet lists of more than three lines; drop shadows on type; bevels; spinning 3D logos; a stock blue gradient
with lens flares; crossfades between every slide; clip-art icons; charts with gridlines on every tick;
centred paragraphs; three accent colours in one frame.

## Mixing with the PC-98 pack
The two packs share the evidence format, the audio kit and the pipeline. A PC-98 video can borrow a
launch *structure* (cold open → claim → data → reveal → end card) and the mosaic transition, which comes from
OpenAI DevDay's LED block dissolve and is PC-98-native. Keep each video in one look. Never mix anti-aliased
launch type into a 16-colour frame.
