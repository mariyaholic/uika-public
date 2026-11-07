# 03 — Art and the presenter: real art in, PC-98 out

## 3.1 The rule (owner direction, 2026-09-30)
Procedural faces (drawn ellipses and lines) read as "too unhuman". **Source good modern art, then convert it.**
Conversion keeps the drawing's anatomy and expression; the PC-98 look comes from palette, dither and outline.

Sourcing:
- Ask the owner which character/model to use; prefer art they supply. Do not scan personal folders (Downloads)
  for "references": they hold private photos and third-party IP. If you open one by mistake, stop, delete any
  thumbnails you made, and say so.
- Record provenance before use: `assets/MANIFEST.json` = path, sha256, source (URL or where the owner got it),
  licence, "rights verified: yes/no". Unverified rights => the video is internal-only; say so in STATUS.
- Best inputs: a bust with a clear face (for the window) and a full body on transparent background (PNG/WebP with
  alpha) for outros. 500-1000 px sources are plenty.

## 3.2 pc98ify: the conversion, step by step
`load_sprite(path, height, palette_hexes=..., dither=0.5, outline=..., sat=..., contrast=..., k=..., crop=..., key_bg=True)`
1. **Background key**: alpha if present; else flood-fill the border colour if the four corners agree (within 24).
   Busy backgrounds keep everything (crop first).
2. **Downscale** with LANCZOS to `height` px (100 for a bust window, 200-220 for a full body at 640x360).
3. **Enhance**: saturation x`sat`, contrast x`contrast`, unsharp mask (r 1.2, 140%) — small sprites lose edges
   without it. Presenter uses sat 1.0 / contrast 1.05 (the art is already tuned).
4. **Palette**: either median-cut `k` colours from the visible pixels only (background excluded), ordered dark
   to light, or — for presenters — **the video palette's own entries** (`palette_hexes`). Use the second: the
   presenter then costs zero extra slots and matches the scene.
5. **Ordered dither**: an 8x8 Bayer offset of strength `dither * 255 / sqrt(k)` added before choosing the nearest
   colour (luma-weighted distance 0.30/0.59/0.11). 0.5 is the tested value: lower = posterised, higher = noisy.
6. **Outline**: `outline=True` sets the mask edge to index 0 (black) — use for full bodies over scenery; a bust
   inside a window looks better without.
Result: `Sprite(idx, mask, hexes)`; draw with `draw_sprite(cv, spr, x, y, remap=[palette indices])`.

## 3.3 The presenter (kit/presenter.py)
```python
from presenter import presenter, full_body, SPRITE_NAMES
HOST = presenter(PAL, r"assets\bust.png", height=100)       # palette must define all SPRITE_NAMES (aliases OK)
BODY = full_body(PAL, r"assets\full.webp", height=200)
K.host = HOST                                               # Keynote.face() draws it with mouth + blink
HOST.window(cv, 524, 28, mouth, blink)                      # 108x108 framed bust
BODY.draw(cv, 460, 262 - BODY.h + 6)                        # standing on the card's floor line
```
`SPRITE_NAMES = black white red lamp skin skin2 hair hair2 uni uni2`: the ten roles the art is quantised onto.
Choose those hexes so the art survives: two skins (light/shade), two hairs, two clothing tones, the accent
(`lamp` for gold buttons), `red` for eyes/lips. The eyes must use the `iris=` colour (default `red`) — blink
detection anchors on it.

## 3.4 Blink (why it is built this way)
- Eye boxes are found automatically per sprite size: pixels of the iris colour in the face band
  (y 34-46%, x 34-68% of the sprite), split left/right at the midpoint; box = iris +-2 px across, 1 px above/below.
  Anchoring on dark pixels failed: at 100 px the eyes merge with the bangs and the lid erased hair.
- The lid is **the skin row just below the eye, copied upward** over the box (so the face's own dither continues),
  then a 1-px lash line in `hair` and a 1-px flick at the outer corner. Half-closed covers the top half only.
- Timing (`kit.blink_at`): blinks at irregular intervals (2.3-5.2 s, seeded) with an 18% chance of a double
  blink; the lid sequence is half, half, closed, closed, closed, half, half (7 frames at 30 fps). A metronome
  blink every 3.4 s and one-frame states both read as mechanical.
Check it: dump a frame inside a blink and crop the window at 3x (see 06, "presenter zoom").

## 3.5 Lip flaps (why 10 fps)
`vo.mouth(v, t)` returns 0, 0.5 or 1: the mean voice envelope over each 0.1 s step, thresholds 0.2 / 0.55.
The mouth is an ellipse (8 px wide, 1 + 4*m tall) in `dred` with a black outline at `mouth_at` (fraction of the
source image; verify once on a zoomed frame). A per-frame (30 fps) mouth looked "eerily higher fps than the rest"
in a picture that moves in held steps. Measured result on a Japanese line: ~4 shape changes/s, minimum hold 3
frames, closed ~50% of speaking time (pauses between phrases).

## 3.6 Full body and hero art
Full bodies go on cards (outro, title) standing on a floor line, not inside windows; `outline=True`. Do not
animate the body with sub-pixel motion; if it must move, move in whole pixels at <= 12 fps, or cut between poses.
