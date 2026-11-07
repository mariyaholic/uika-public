# 06 — Recipes: the the reference film scenes, bit by bit

Each recipe = the claim it carries, the build steps, the timing, the sound, and what to check. Full code:
the original private reference script (function names kept in brackets). Coordinates are native 640x360.

## R1 Title over a living world [s1 coast] — 4 bars, voice at 2.0 s
Claim: who and what ("the reference film, launch day"), and the metaphor (only what the light touches is real).
1. Draw the world dark: `grad_v(black->navy)` sky to 64% height, `navy` sea, twinkling stars, wave dashes that
   drift (`x + 6*sin(t*1.3 + row*0.9 + x*0.05)`), a horizon line.
2. Draw the same world lit into a second `Cv` (navy->sea sky, sea water, `seahi` waves).
3. Lighthouse at (560, 300): 14 px red/white bands tapering 15->9 px half-width, gallery, lamp flickering
   lamp/white at 6 Hz, red roof, rock base. It returns the lamp point (lx, ly).
4. Beam centre sweeps `bx = mid + half*cos(2*pi*t/6.0)` between x 40 and 470. Wedge = triangle lamp -> (bx+-60, H).
5. Paste lit world through the wedge; `add_glow` level 4 over the wedge, level 9 over a 21 px core wedge.
6. Redraw the lighthouse on top (the beam must come out of the lamp, not cover it).
7. At t=1.0: kanji stamp 灯台守 (size 44 x2, red, -4 deg, black outline) + "DEMO" 16x3 white with `dred`
   shadow + "LAUNCH DAY" 12 lamp, all shaking together.
Sound: hum (texture) from 0, sweep at 0.3, stamp at 0.98. Check: stamp lands before the voice starts (2.0).

## R2 A ledger revealed by light [s2 ledger] — 8 bars
Claim: "ten ideas were built, measured and cut" with the headline rejection figures.
1. HUD strip + viewport frame (5,25,523,291); world clipped to the viewport (`wedge_mask(poly, VP2)` multiplies
   the wedge with the viewport rectangle so the beam never paints the HUD).
2. Lighthouse at the right edge (x 498, height 130); beam sweeps x 14..410, period 5.6 s, wedge half-width 44,
   aimed to reach y=250 (`beam_polygon(..., yt=250)` extends the triangle through that point).
3. Five rocks at x 56,142,228,314,400, each with a 132x50 plate on alternating rows (y 36 / 92) joined to its rock
   by a gray leader line. Plate text: name in lamp bold 12, 1-2 data lines in white 12 from the evidence.
4. **Lit-time guard**: precompute `FIRST_LIT[i]` by scanning t in 1/30 s steps for when the beam span at the
   rock's height covers it; raise if any rock is never lit. That makes "all five appear within the first sweep"
   a checked fact, not a hope.
5. `rock_alpha`: 0 before first lit, 1 while lit, then dims to a 0.45 floor over 2 s (dither mask
   `bayer_mask(16*alpha)`): the ledger accumulates instead of blinking out.
6. Side panel: REJECTED / "10 ideas" / built, measured, cut / FACT SHEET §5.
Sound: whoosh_down at the cut, one chime per rock at `FIRST_LIT - 0.03`, trim -3, panned left->right.
Check: frame at 10.5 s shows several plates, none overlapping (the text-collision guard catches it).

## R3 The loudest beat: the caveat [s3 caveat] — 7 bars, entered by `flash`
Claim: the live record cannot be isolated, so no equity curve is shown. Loudest, not buried.
1. Black field; red/black hazard stripes top (y 0-14) and bottom (278-290) scrolling opposite ways (phase `t*46`).
2. t=0.3: "NO CURVE" stamp 16x6 red, -3 deg, heavy shake (amp 5, decay 0.9).
3. Five reasons typed at 44 chars/s, 1.4 s apart from t=1.8, the last in lamp.
4. t=9.0: TIER: RECORD / "not verified" plate in dred with a lamp outline.
5. Presenter window moves down to (524, 166) to make room; message window as usual.
6. Palette LUT siren: red/dred alternate bright/dim at 4 Hz for this scene only (01 §1.5).
Sound: klaxon (impact, -3) at the cut - 0.1, stamp at 0.28, a tick per reason, power at 9.0. Music `tension`.

## R4 The duel: matched pair bars [s4 duel] — 9 bars, verdict after the line
Claim: control vs specialist sleeve on the native tester; the sleeve draws down less, the control earns more.
1. Header typed in three lines from the evidence (symbol/model/leverage, window/deposit, SHA-256 hashes in gray).
2. Legend: CONTROL (lamp) at x 176, FLIP SLEEVE (seahi) at x 296.
3. Four rows (PF, NET, TRADES, DRAWDOWN "lower wins") at y 110 + 40k, starting 1.8 + 1.1k s. Each row: two
   10 px bars from x 176, length `250*0.62*v/max*g`, `g=ease_out` over 0.6 s, 3/16 white sheen dither; the value
   appears at the bar end when g reaches 1, with a star on the winner (per-row rule: higher or lower wins).
4. **Verdict after speech**: `VERDICT_T = vstart + voice_dur + 0.3`; assert it is < scene end - 0.9. At VERDICT_T
   the header is replaced by the stamp CONTROL SHIPS (lamp, 16x2).
Sound: tape at 0.3, blip per row (panned), stamp at VERDICT_T - 0.02. Check: DRAWDOWN star goes to the sleeve.

## R5 The honest negative: a 544-cell grid [s5 tail] — 8 bars, music `hush`
Claim: in an earlier campaign the top 20 of N items carried more than 100% of the total; the rest gave a little back.
1. A 34x16 grid = 544 cells (13x9 px, 1 px gaps) at (38, 58), scanned in row by row over 1.1 s.
2. The top 20 (fixed seed) light up in lamp one every 0.14 s from 3.2 s (a tick each, panned across).
3. At 7.2 s the unlit cells drop from dgray to navy (the rest recedes) and the profit bar starts at y 234:
   gold grows past 100% of its 440 px width, a white marker at 100% labelled "all profit", then 1.4 s later the
   segment beyond 100% turns red with a dred dither ("gives back").
4. Caption line from the evidence under the bar; CONCENTRATED stamp (red) after the voice line.
Sound: sweep, 20 ticks (-2), power at 7.2, drop at 8.6, stamp after speech. This scene is the credibility
scene; keep it plain and slow.

## R6 A formula drawn by the numbers [s6 scale] — 8 bars (7 + transition)
Claim: position size grows slower than the account: size = (balance / 20000)^0.35.
1. `FORMULA = tex_mask(r"\text{size}\;=\;\left(\frac{\text{balance}}{20000}\right)^{0.35}", dpi=140)` —
   MiKTeX `latex` -> `dvipng` -> threshold 110 -> 1-bit mask, cached. `draw_mask(cv, FORMULA, 20, 40, "white",
   reveal=clamp((t-0.3)/1.2), shadow="sea")` reveals it left to right. y=40, not 32: the exponent clipped.
2. Axes from (64,262) to (500,112); x = balance 20k..400k, y = multiplier 1..3.
3. At 1.6 s a dashed red "linear sizing" line shoots off the chart in 0.6 s (the contrast).
4. From 2.4 to 9.0 s the law is drawn by a moving lamp dot (`ease_io`), 80 segments, 2 px lamp line.
5. Marks at the evidence's low and high points: white dot + "x1.187 @ balance" label. The low label sits
   **below the curve with a leader** (it overlapped the curve above it).
6. Footer: "applied only at flat moments · run · N updates".
Sound: pencil at 0.3; a blip exactly when the dot reaches each mark — invert the easing:
`u = next(k/300 for k in range(301) if ease_io(k/300) >= frac)`.

## R7 Payoff against a pre-declared bar [s7 screen] — 9 bars, entered by `iris`, music `finale`
Claim: the bar was set before the test (metric > bar, N > minimum); the reference film cleared both.
1. Sky gradient, stars, a sunburst at (470,150): 12 rays alternating lamp/beam that extend with `ease_out` and
   rotate slowly, over a lamp disc with a white core.
2. At 0.4 s ("HIT"): "PROFIT FACTOR" 16x2 + the figure 16x6 monospace white with red shadow, shaking (amp 6).
   A gauge: navy track, lamp fill to value/3.0, a red 2 px tick at the bar (2/3.0). Label "bar: metric > threshold".
3. At 1.2 s the N gauge (seahi, scale 600) + "526 trades · 1.09% drawdown" + the net line.
4. At 1.7 s CLEARED stamp at (440,226) — moved there after it collided with the net-profit text.
5. At 3.0 s the LIVE plate: since-date, "the author's own capital", "record tier: positive, by the author's
   account" (the honest label travels with the payoff).
Sound: whoosh_up 0.45 s before the hit, hit + bell, thunk at N, stamp at CLEARED. These impacts sit before the
voice starts (vstart 2.4) — that is why the voice starts late here.

## R8 Outro card [s8 outro] — 2 bars
Lighthouse (smaller, centre) with its beam still on, full-body presenter at x 460 standing on the y 262 line,
title stamp group, and the **verbatim disclosure** typed in within 1 s into frame2(4,262,636,358), 12 px gray.

## R9 Estate card with a palette swap [s9 estate] — 3 bars + 3.5 s ring
1. Hexagon emblem at (320,94) r 56 drawn edge by edge (6 sides + 3 spokes, 0.16 s each, 3 px lamp lines, a tick
   per edge), then a pulsing dither glow in its centre.
2. At 0.5 s "DEMO BRAND" 16x3 white with lamp shadow; the tagline typed in `beam` as she says it.
3. From 4.2 s the fleet names PRODUCT A (lamp, bold) · PRODUCT B · PRODUCT C (gray), 0.35 s apart, a blip each.
4. The palette LUT swaps navy -> brand green (10,26,20), lamp -> brand gold (198,161,91), beam -> (232,212,154) for
   this scene only: the same drawing code wears the estate's colours.
5. Music `ending` resolves on the tonic; the picture holds through the ring; audio fades in the last 1.2 s.

## Checking any recipe
- `python <video>.py frames <t...>` at: steady state of each scene, 0.1 s after every impact, mid-transition,
  the last 2 s. Look at every PNG (2x nearest).
- Presenter zoom: crop the window from a frame at 3x to check the blink lid and mouth placement.
- `dryrun` before `render`: every frame through the guards, audits every 3rd frame.
