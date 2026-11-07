# 01 — The look: canvas, palette, dither, glow, CRT

## 1.1 The canvas: 640x360 indices, 30 fps, exported x3
The PC-98 drew 640x400 in 16 colours. We keep the width and use 16:9 height: **640x360 native pixels**, each
frame a PIL `"P"` image whose pixels are palette **indices** (0..15), not colours. Everything (text, sprites,
transitions) operates on indices; colours are applied only at export. That is what makes palette tricks and
dither-based transitions possible.

```python
from pxkit import *              # W, H, FPS = 640, 360, 30
cv = Cv(PAL, "black")            # new frame filled with the "black" slot
cv.rect(8, 28, 520, 288, fill="navy", outline="gray")   # colours by NAME; unknown names raise KeyError
arr = cv.arr()                   # uint8 (360, 640) index array
```

Export (`render_silent`) pipes `lut[arr]` (RGB) to ffmpeg with this grade, in order:
1. `scale=1920:1080:flags=neighbor` — exact x3, no smoothing (one native pixel = 3x3 screen pixels).
2. `drawgrid=w=0:h=3:x=0:y=2:t=1:c=black@0.28` — a dark line on every third row = one scanline per native row.
3. `split … gblur=sigma=2.5 … blend=screen:0.07` — 7% bloom so bright pixels glow slightly.
4. `vignette=angle=0.3` — faint corner falloff.
Keep this grade light. If the scanlines dominate, text becomes unreadable at 1080p; 0.28 black is the tested value.

## 1.2 Palette design: 16 named slots, decided before drawing
```python
PAL = Pal([("black", "#000000"), ("white", "#f8f8ff"), ("navy", "#0a1040"), ("sea", "#1848a0"),
           ("seahi", "#50a0f0"), ("lamp", "#ffc820"), ("red", "#e02038"), ("dred", "#6a1020"),
           ("skin", "#f8e4c8"), ("skin2", "#d0a888"), ("hair", "#3a2018"), ("hair2", "#7a4a30"),
           ("uni", "#2a2c34"), ("uni2", "#585c68"), ("gray", "#9098b8"), ("beam", "#fff0a0")],
          alias={"rock": "hair2", "dgray": "uni2"})          # the reference film's palette, verbatim
```
Rules, in the order you decide them:
1. **Name by role, not hue**: `lamp`, `beam`, `sea`, `seahi` — a scene reads "fill=lamp", and a palette swap
   later recolours every lamp at once.
2. **Budget the presenter first.** A presenter needs 10 entries (`black white red lamp skin skin2 hair hair2 uni
   uni2`, see 03). That leaves 6 for the world: here `navy sea seahi dred gray beam`.
3. **Pairs for depth**: each surface gets a base and a shade (`sea`/`seahi`, `red`/`dred`, `hair`/`hair2`).
   Dither between a pair makes the in-between tones; you do not need a slot for them.
4. **Aliases save slots**: rocks reuse `hair2` (brown), dark-gray reuses the uniform shade. `Pal` resolves the alias
   to the same index. More than 16 entries raises `GuardError`.
5. **One accent** (`lamp` here) reserved for the thing the eye must go to (the beam, the winning bar, the stamp).
6. Keep `black` at index 0 (outline colour for sprites) and `white` at index 1.

PC-98 authentic palettes were 4096-colour (4 bits per channel). Rounding your hexes to multiples of 0x11
(`#ffcc22`) is optional authenticity; readability wins.

## 1.3 Ordered (Bayer) dither: the only shading allowed
`bayer_mask(level)` returns a full-frame 1-bit mask with `level` of every 16 pixels lit (4x4 Bayer matrix, aligned
to the global grid so adjacent fills never seam).
```python
cv.dither(x0, y0, x1, y1, "white", 3)          # 3/16 white sprinkled over whatever is there: a sheen on a bar
cv.grad_v(0, 0, W, 230, "black", "navy")      # 16 bands, each a dither level: a sky from black to navy
```
Level guide: 2-4 = sheen/haze; 6-8 = half-tone (50%); 9-12 = strong light; 16 = solid. Use pairs from the palette
(black->navy, navy->sea) so the dither reads as a tone, not noise. Never dither two unrelated hues (red over blue
reads as purple static).

## 1.4 Light: masks + dither, never alpha
"Glow" and "light" are a **mask** (where the light is) multiplied with a **Bayer level** (how strong), pasted in a
light colour. The lighthouse beam in the reference film:
```python
def add_glow(cv, mask, level, colour):          # mask: PIL "L" 0/255 region
    g = ImageChops.multiply(mask, bayer_mask(level).convert("L"))
    cv.im.paste(cv.pal.c(colour), (0, 0), g)

m = wedge_mask(beam_polygon(lx, ly, bx, 60, H), None)        # the wedge where the beam is
cv.im.paste(lit_scene.im, (0, 0), m)                         # 1) the scene redrawn "lit" shows through the wedge
add_glow(cv, m, 4, "beam")                                   # 2) a 4/16 haze over the whole wedge
add_glow(cv, core_mask, 9, "beam")                           # 3) a 9/16 core, a third as wide
```
Two-version trick: draw the world twice (dark palette roles and lit roles, e.g. `navy`/`sea`), then paste the lit
one through the light's mask. That is how the beam "reveals" rocks and how the native-test plaque is swept into view.

## 1.5 Palette cycling and swaps: the PC-98's own animation trick
`Video.lut_fn(frame) -> (256,3) uint8` recolours indices per frame without redrawing:
```python
def lut(f):
    lut = PAL.rgb.copy()
    t = f / FPS - V.starts[2]                      # scene 3 = the caveat
    if 0 <= t < DUR[2]:
        on = int(t * 4) % 2 == 0                   # 4 Hz siren
        lut[PAL.ix["red"]] = (255, 40, 60) if on else (150, 12, 30)
        lut[PAL.ix["dred"]] = (130, 16, 34) if on else (60, 6, 18)
    if f / FPS >= V.starts[8]:                     # the estate card wears the estate's own colours
        lut[PAL.ix["navy"]] = (10, 26, 20)
        lut[PAL.ix["lamp"]] = (198, 161, 91)
        lut[PAL.ix["beam"]] = (232, 212, 154)
    return lut
V.lut_fn = lut
```
Uses: sirens and alarms (alternate a pair), water shimmer (rotate three blues), a brand card in brand colours,
a "power off" (step every slot toward black over 6 frames). The frame content is unchanged; only colours move.

## 1.6 What breaks the look (forbidden)
Anti-aliased text or shapes · alpha blending or opacity fades · gradients that are not dithered · more than 16
colours on screen · smooth sub-pixel motion of pixel art (move whole pixels) · photographic backgrounds that were
not converted · a CRT filter over a modern render instead of drawing in indices.
