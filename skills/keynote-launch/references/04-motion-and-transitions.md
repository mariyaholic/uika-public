# 04 — Motion and transitions

## Measured pacing by format (the defaults, not taste)
Measured from 43 of the 46 library videos, about 43 h of footage. Three flagged fan uploads are excluded (see
`_plan/flags.json`). The method is in the library's `_tools/analyze.py`:
- frames sampled at 10 fps;
- a hard cut is a single-frame jump;
- an animated transition is ≥ 0.2 s of sustained change whose two ends differ strongly.

Each cell is the median across that category's videos.

| Format | n | Cuts/min | Median shot | p90 shot | Animated transitions/min | Graphic share | Read it as |
|---|---|---|---|---|---|---|---|
| Product film (Linear, Raycast, Framer, DJI, teenage engineering, Notion, Arc, Cursor, Apple) | 9 | 15.1 | 2.9 s | 5.9 s | 3.2 | 0.29 | Our default for a 30–90 s launch video |
| Produced keynote (Apple, Google, Samsung, Microsoft, Nintendo, Nothing, OnePlus, Vercel) | 10 | 9.5 | 4.1 s | 13.7 s | 3.2 | 0.34 | Our default for a 2–10 min explainer |
| Statistics talk (Rosling, Gore) | 3 | 8.6 | 4.0 s | 16.0 s | 4.6 | 0.14 | Cut faster than you would think while a chart moves |
| Stage live (NVIDIA, Xiaomi, Rivian, Stripe, Meta, AMD, Huawei, SpaceX, Figma, GitHub …) | 14 | 4.6 | 6.0 s | 28.7 s | 1.7 | 0.26 | Reference only: a live camera, not a design target |
| Livestream launch (OpenAI, Anthropic) | 3 | 3.8 | 11.7 s | 33.9 s | 0.2 | 0.15 | Talking heads with demos; graphics are rare |
| Stage classic (Jobs 2007, 2010) | 2 | 2.3 | 13.4 s | 62.6 s | 1.1 | 0.24 | The slide holds and the speaker carries it |

Single-video categories aren't defaults. Apple's sustainability film runs 21 cuts/min with a 1.3 s median shot,
a montage extreme. Tesla Investor Day runs 2.6 cuts/min.

**Animated-transition length** (all 5,121 detected, flagged videos excluded):
- p25 0.5 s, median 0.8 s, p75 1.4 s;
- 58 % fall between 0.5 and 1.5 s;
- statistics talks are the slowest, with a median of 1.0 s.

So a scene transition runs **0.6–1.0 s**. Use **1.0–1.4 s** only for the unveiling transition (slit, portal),
and **≤ 0.6 s** for energy (whip).

### What the numbers mean for a template
- A 54 s product film at 15 cuts/min has about 13 shots. The template has 8 scenes and gets its extra cuts
  inside scenes: word-by-word headlines, KPI count-ups, wedge beats. Each one counts as a "change" for the eye.
  Don't add cuts for their own sake.
- No scene runs longer than the p90 of its format: 6 s in a product film, 14 s in a keynote. A chart scene may
  run to about 9 s because its clock or beats keep changing the picture (statistics talks hold 16 s at p90).
- Animated transitions run 3 per minute in produced work. At most one boundary in three should be a
  showpiece; the rest are plain cuts or pushes.

## Transition catalogue (kit name → meaning → library pointer)
Choose a transition for what it *means*, then check the pointer: open the clip in
`clips/<id>/` or the strip in `strips/<id>.jpg`.

| Kit | Meaning | Length | Studied at |
|---|---|---|---|
| `t_slit` | Unveiling: light opens the next world | 1.0–1.2 s | Samsung Unpacked `Nul7mPL7Nt4` 12:24 |
| `t_capsule` | Zoom into a detail, or a window opening on the LED | 0.8–1.0 s | Rivian `82IiXIKkRIA` (capsule photo windows) |
| `t_portal` | Enter a product's world (app icon becomes the scene); run it backwards to put the UI back into the device | 0.9–1.2 s | Apple WWDC25 `0_DjDdfqtUE` 41:42; UI → device at 10:32 |
| `t_mosaic` | A change of state: data → product, physical → digital | 0.8–1.0 s | OpenAI DevDay `U9mJuUkhUzk` 0:20 (wordmark → LED blocks) |
| `t_push` | Next item in a series (carousel) | 0.5–0.8 s | OpenAI DevDay colour-panel carousel 2:10 |
| `t_whip` | Energy before a reveal; it hides a jump | 0.4–0.6 s | Apple M5 film `GriXfu4tL30` 1:09 |
| `t_shape` | A brand or partner silhouette grows into its own field | 0.9–1.1 s | Samsung `Nul7mPL7Nt4` 52:37 |
| `value_ramp` | End of the film, field to black | 1.2–1.6 s | Google I/O `o8NiE3XMPrM` 115:00; Linear `9Q5BoiIFBiY` 3:59 |
| plain cut | Everything else; most boundaries | 0 | everywhere |

Composite moves with no single kit function (recipes in 06):
- **UI persists across a cut**: Samsung 19:39. The UI layer stays fixed while the background changes.
- **Liquid-glass material move**: WWDC25 10:00. A translucent panel slides over content and refracts it. Fake
  it with a blurred, brightened crop under a capsule mask.
- **Name card becomes the frame**: Google I/O 83:36.
- **Lights-off reveal**: Nothing `Muen4f4L_6M` 1:47.
- **Grid-to-grid swap**: Nothing 17:41.
- **Audience-reaction cut**: Google I/O 3:52. A cutaway to the crowd after a claim lands. In produced films the
  equivalent is a 1 s customer-face shot.

## Motion inside a scene
- **Easing**: `ease_out` (cubic) for anything arriving, `ease_io` for anything that travels, and
  `ease_back` only for small UI chips (overshoot ≤ 8 %). Use `ease_expo` for counters, so the number settles
  instead of ticking.
- **Arrival stagger**: 0.12–0.2 s per word, 0.4–0.5 s per KPI or callout. Show three items at most before
  pausing.
- **Hold after arrival**: a claim stays on screen until it has been read twice: about 0.3 s per word plus 1 s.
- **Everything drifts**: footage-like frames push 1.02 → 1.08 over the shot, and type walls drift about
  60 px/s. Nothing that is meant to look filmed sits dead still.
- **One mover per chart** (08): while the hero element moves, everything else stays still.

## Never
- Never cross-fade between *scenes*. This is a pack rule, not a measurement: the detector can't tell a
  dissolve from other animated changes. The viewing notes do show dissolves *inside* a scene, between two
  states of the same thing: Nothing's grid-to-grid swap, and Google's satellite image → data overlay. That use
  is allowed. A dissolve between unrelated scenes is the generic look this pack avoids.
- No spin, cube or page-curl transitions, and no star wipes.
- No transition longer than 1.6 s.
- Never use two showpiece transitions back to back.
