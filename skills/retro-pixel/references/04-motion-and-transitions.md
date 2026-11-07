# 04 — Motion, pacing and transitions

## 4.1 Time is bars
Everything is timed in **bars** at 120 bpm (1 bar = 2.0 s, 1 beat = 0.5 s). Scenes are whole bars; scene starts
land on bar lines; the score's sections switch on the same lines. That is why cuts feel "on the music" without
any beat detection.
```python
BAR = 2.0
BARS = [4, 8, 7, 9, 8, 7, 9, 2]                          # the reference film: every scene but the last
OUTS = [("shutter", 10), ("flash", 4), ("mosaic", 12), ...]   # transition OUT of each scene, frames
DUR  = [BARS[i] * BAR + OUTS[i][1] / FPS for i in range(NS - 1)] + [3 * BAR + RING]
```
The `+ OUTS[i][1]/FPS` matters: `Video` overlaps each transition with the next scene's first frames, so a scene
must be longer by the transition to keep the next start on the bar line. `Keynote.build()` asserts
`abs(start[i+1] - sum(bars[:i+1]) * BAR) < 1e-6`. Scene cap 20 s (10 bars) is enforced by `Scene`.

How many bars: voice length + ~1 bar of payoff after the line. `Keynote` asserts `vstart + voice_dur < dur - 0.4`.
If a line does not fit, shorten the line (preferred) or add a bar, never speed the voice past 1.1x.

## 4.2 Stepped cadence (the most "PC-98" thing about motion)
The hardware animated in held poses. Mixed cadences read wrong (owner: "eerily higher fps").
| Element | Rate | How |
|---|---|---|
| Presenter mouth | 10 fps | `vo.mouth` quantised to 0.1 s |
| Blink states | held 2-3 frames | `_BLINK_SEQ` |
| Stars twinkle | ~1.5 Hz | `int(t*1.5 + phase) % 3` |
| Lamp flicker | 6 Hz | `int(t*12) % 2` |
| Siren | 4 Hz | palette LUT |
| Typing | 28-44 chars/s | `typed()` / `ln[:int((t-t0)*44)]` |
| Bars, curves, wipes | per frame (30) | eased; these are "machine" motions and may be smooth |
Rule: **characters and props step; data graphics may glide.** Positions are always whole pixels (Cv rounds).

## 4.3 Easing and reveals
```python
seg(t, a, b)          # progress 0..1 of t inside [a, b]
ease_out(p)           # 1-(1-p)^3: things that arrive (bars growing, gauges)
ease_io(p)            # smoothstep: things that travel (a curve drawn by a moving dot)
g = ease_out(clamp((t - DUEL_T[k]) / 0.6)); ln = int(BXW * 0.62 * v / mx * g)
```
Reveal vocabulary (pick per claim, don't repeat one reveal three scenes running):
- **typed**: text appears letter by letter (message window; the caveat reasons, 1.4 s apart).
- **scan-in**: a grid appears row by row (`if r / GR > scan: continue`).
- **grow**: bars from a baseline with `ease_out` over 0.6 s, value text appears only when `g >= 1`.
- **draw-on**: a line/curve drawn up to `g` with a lead dot (`ellipse` in `beam`) until complete.
- **light-sweep**: an object exists only where/after a light touches it (the rock ledger; see 06).
- **dither-in**: `bayer_mask(16*alpha)` as paste mask = "fade" done the PC-98 way (and stays legal).
- **edge-by-edge**: an emblem draws its edges one per 0.16 s with a tick on each.

## 4.4 Impacts: stamp + shake + sound
```python
if t >= T:
    dx, dy = shake(t - T, 4)            # 18 Hz, decays over 0.6 s; amp 3-6 px
    stamp_text(cv, x + dx, y + dy, "CLEARED", "lamp", size=16, scale=3, angle=-4, bg="black")
```
Only the stamped group shakes, not the whole frame (whole-frame shake reserved for the single loudest beat).
Every impact is paired with a `stamp`/`hit` SFX **at T - 0.02 s** and must fall outside the voice (see 05).
Time an impact **after** the line that justifies it: `VERDICT_T = VSTART + voice_dur + 0.3`, asserted to fit.

## 4.5 Transitions (index-array only; `pxkit.transition`)
| Kind | Frames | Character | Use for |
|---|---|---|---|
| `cut` | 0 | none | inside an act, rhythm changes |
| `wipe_r` / `wipe_l` | 10 | dithered vertical edge | "next item" |
| `wipe_u` | 10 | rising edge | toward a card/finale |
| `mosaic` | 12 | 16 px blocks in random order | topic change, "data resolves" |
| `shutter` | 10 | 24 px venetian bands | title -> first content |
| `scan` | 12 | white line sweeping down | into analysis (feels like a CRT redraw) |
| `iris` | 12 | growing circle from centre | into the payoff |
| `push_l` / `push_u` | 12 | old frame slides out, new follows | sequential evidence |
| `flash` | 4 | 2 white frames then B | into the loudest beat (alarm/caveat) |
Rules: never the same transition twice in a row; one `flash` per film; an ending is not a transition (see 4.6).
There is no cross-fade and no opacity; adding one breaks the look and the house rule.

## 4.6 Pacing a keynote
- Open on the world + title stamp inside the first 1.0 s; the first line starts by 2.0 s.
- One claim per scene; one carrying graphic per claim; the message window carries the words.
- **Number-first**: the figure appears on screen at or before the moment it is spoken (the grid/bar/gauge
  starts moving before the line reaches the number).
- Place the honest negative mid-film, not at the end; put the pre-declared bar right before the payoff.
- No dead space: every second something is moving (typing, wave, star, sweep) — but nothing new starts in the
  last 0.5 s before a cut.
- Ending: a card that holds (outro), then an estate card with a 3-bar cadence and a **ring-out** (RING = 3.5 s)
  while the picture holds; the audio fades over the last 1.2 s only.
