# 08 — Data showcase: making statistics the impressive part

This file exists because of the owner's note on the reference film v1: "not much impressive statistical showcases".
The 46-video library shows that great launches don't add more charts. They stage a few numbers as events.
Every form below was seen working in a real keynote. The library pointer is `video id + mm:ss`; open
`strips/<id>.jpg` or `stills/<id>/` in the reference folder.

## The four rules every form obeys
1. **Question before answer.** Rosling opens with a quiz ("Pre-test: which country has higher child mortality?")
   then shows the answers marked with red arrows and the audience's scores (hVimVzgtD6w 0:47 → 1:30).
   Xiaomi puts a white question card up before a comparison ("which one feels better in hand?",
   l5f3wvLwLXY). Plant the question in the line before the chart.
2. **The number lands, then the voice reads it.** The count-up finishes 0.3–0.6 s before the narrator says the
   figure, the same rule as PC-98 "numbers first".
3. **One mover per chart.** Use one moving entity (Rosling's trail), one wedge per beat (Gore) or one
   highlighted row (Apple's rank table). Everything else holds still or stays grey.
4. **Show the delta, not the table.** Show the gap (wedge), the climb (rank 2 → 1), the ratio ("Up to 5x"), the
   change (1.8 → 2.6 → 1.4). A static table of ten numbers is never the showcase.

## Ten forms (kit function → when to use → library reference)
| # | Form | Kit | Use when | Studied in |
|---|---|---|---|---|
| 1 | **KPI row on b-roll**: 2–4 big numbers with one-word captions over footage | `kpi_row` + `scrim` | Proof points for one chapter; the footage carries the context | Tesla Investor Day qUQLTciXCBE ("Holistic Charging Experience" 99% / 1.5M / 99.9%), DJI BNEmDcQr6hk captions |
| 2 | **Kinetic claim in the scene**: "Up to / 5x / faster" word by word, small, beside the action | `kinetic_words(accent=…)` | Performance ratios and speedups; you want the film to feel fast, not like a slide | Apple M5 GriXfu4tL30 0:33, 0:56 |
| 3 | **Bubble clock**: the moving scatter, with the year as a giant translucent numeral behind the data | `bubble_chart(trail=…)` | Change over time for many entities, where one entity's path is the story | TED Rosling hVimVzgtD6w, BBC jbkSRLYSojo (AR version) |
| 4 | **Wedges**: business-as-usual area, then reduction wedges added one per beat | `wedge_chart(k)` | A gap closed by several levers (sustainability, cost-down, roadmap) | TED Gore rDiGYuQicpA ("U.S. Emissions" 1.8 → 2.6 and wedges) |
| 5 | **Rank table**: one column per period, the subject highlighted in each | `rank_table` | "We became #1" or a climb against named peers | Apple WWDC25 0_DjDdfqtUE ("Highest-rated original programs") |
| 6 | **Spec constellation**: product centred, leader lines out to value + caption | `spec_callouts` | Dimensions, weight, lifetime, any 3–6 physical facts | Samsung Nul7mPL7Nt4 32:22, Rivian 82IiXIKkRIA dimensions |
| 7 | **Radar collapsing into UI**: a pentagon of scores over footage that becomes the product UI | `radar` (+ a push into the UI) | Multi-axis scores (health, quality, readiness) | Samsung Nul7mPL7Nt4 51:35 |
| 8 | **Price/number between split letterforms**: giant model letters part, the figure sits in the gap | `price_split` | The one number everyone waits for (price, launch date, headline metric) | Rivian 82IiXIKkRIA ("R … $45,000 … 2") |
| 9 | **Single giant numeral** on a plain field, with an object or demo beside it | `text("num", 300+)` + `count` | A weight, a speed or a percentage that can be demonstrated physically | Xiaomi l5f3wvLwLXY ("32g" hanging-weight demo), Pixel JXCXTQIIvM0 ("10" behind the phone) |
| 10 | **Coverage / proportion rings**: concentric translucent arcs with two numerals | compose with `aa_mask` arcs | Coverage, reach, sensor fields, market share | Rivian 82IiXIKkRIA ("11 cameras / 5 radars") |

## Choosing (decision order)
- One number that matters most → **8** (price split) or **9** (giant numeral). Use it once per video, as its peak.
- Two to four supporting numbers in one chapter → **1** (KPI row on b-roll).
- A ratio or speedup → **2** (kinetic claim). Never put a ratio in a bar chart of two bars.
- Change over time with a protagonist → **3** (bubble clock with trail). If there's only one series, use a
  stepped line and put the year as the clock behind it.
- Closing a gap with several contributors → **4** (wedges): one wedge per narration beat, and keep the
  business-as-usual line dashed and visible.
- Standing against peers → **5** (rank table). Use real, named peers only when the evidence table names them.
- Physical facts → **6** (spec constellation); scores → **7** (radar).

## Timing recipes (30 fps; beats at the narrator's line starts)
- Count-up: `count(v, seg(t, t0, t0 + 1.2))`. The expo ease settles the last digits slowly, which reads as
  precise. Stagger KPIs by 0.25 s. Start each at least 0.4 s before the voice line that reads it.
- Wedge: each wedge sweeps for 1.3 s on its beat (`k = sum(ease_io(seg(t, b, b + 1.3)))`). Labels appear only
  when a wedge is complete, and the final net figure lands after the last wedge, in the accent colour.
- Bubble clock: run the year across 6–8 s with `ease_io`. Start the trail 0.5 s after the bubbles grow in, and
  label only the protagonist.
- Rank table: columns appear 0.15 s apart, left to right, so the eye reads the climb in time order.
- Price split: the letters part over 0.9 s (expo), then the kicker and the price appear from 0.55 s. Put
  the hero accent cue at +0.5 s (05).

## Honesty guards (carry over from the PC-98 pack)
- Every figure comes from `EV.fig`/`EV.num`, and every string with digits goes through `EV.guard`. A derived
  number (a wedge net, a delta) needs its own evidence row with the arithmetic in `src`
  ("2.6 - 0.5 - 0.4 - 0.3").
- Illustrative motion (a bubble path, a demo rank) carries a small footnote saying so, as in the template.
- Include one honest negative per video (skills/video-pipeline): a wedge that is still unfunded, a KPI that
  missed its target. Launches that admit one weakness read as more credible.
