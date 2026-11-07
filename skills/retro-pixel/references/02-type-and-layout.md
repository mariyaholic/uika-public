# 02 — Type, stamps, windows, layout grid, guards

## 2.1 Bitmap type
Font: Windows **MS Gothic** (`C:\Windows\Fonts\msgothic.ttc`): index 1 = MS PGothic (proportional, `prop=True`,
the default), index 0 = MS Gothic (monospace, `prop=False`, use for big numerals so digits align). It carries
kana/kanji, which the theme needs (灯台守, ロード).

Every glyph run is rendered into a **1-bit mask** (no anti-aliasing), then scaled with nearest-neighbour:
```python
cv.text(x, y, "PROFIT FACTOR", "lamp", size=16, scale=2, tag="label", guard=False, bold=True)
cv.text(24, 44, EV.fig("ctrl.pf"), "white", size=16, scale=6, prop=False, shadow="red", tag="data")
cv.text(632, 6, "DEMO · LEDGER", "gray", size=12, anchor="r", tag="label")
```
- Sizes: **12** (captions, sources, HUD) and **16** (body, labels). Heroes = 16 x `scale` 2..8.
  Never below 12 (the guard raises under 8; 12 is the readable floor at 1080p).
- `bold=True` = the mask pasted twice, 1 px apart (the PC-98 way to embolden).
- `shadow="red"` = the mask pasted `scale` px down-right in a darker/accent slot: the classic hero-number look.
- `anchor="l"|"c"|"r"`; returns the bbox.
- `wrap_px(s, width_px, size)` wraps by measured pixel width (use it, not character counts).

## 2.2 Rubber stamps (verdicts, titles)
`stamp_text(cv, x, y, "CLEARED", "lamp", size=16, scale=3, angle=-4, bg="black")`: text + a 1-px frame drawn into
a 1-bit mask, scaled, **rotated with nearest** (jaggy edges are the point), and a dilated `bg` outline (MaxFilter 5)
so it reads over busy art. Land it with `shake(t - t0, amp)` (18 Hz, decays over 0.6 s) and an `impact` SFX.
Angles -2..-6 degrees; kanji stamps (灯台守) at size 44 x2.

## 2.3 Frames and windows
- `frame2(cv, x0, y0, x1, y1, fill=...)`: the PC-98 double frame (black outer, gray middle, white inner inset 3).
- `window(cv, x, y, w, h, title=...)`: bevelled window with a title bar (light top/left, dark bottom/right edges).
- `msgbox(cv, x0, y0, x1, y1, speaker, text, frac, face="navy", size=16)`: the visual-novel message window: a
  double frame, a red name tab above the top-left corner, text typed to `frac` (0..1) of its length, wrapped by
  pixel width. 16 px fits two rows in a 58 px box; `Keynote.say` drops to 12 px when 16 px would need three rows.

## 2.4 The 640x360 layout grid (tested; reuse it)
```
y   0-22   HUD strip: "灯台守  KEEPER" (lamp, 12) left, "DEMO · <SECTION>" (gray, 12) right, dgray rule at y=22
y  25-291  main viewport: frame2(5,25,523,291); content area (8,28)-(520,288)
x 524-632  right column: presenter window at (524,28) = 108x108 (sprite height 100)
                         side panel frame2(524,146,632,288): HEAD (lamp 12 bold) / BIG (white 16) / 3 gray 12 lines /
                         source "FACT SHEET §N" (dgray 12) at y=262
y 296-354  message window msgbox(8,296,632,354); name tab sits at y 287-303
y 262-358  (cards only) disclosure frame2(4,262,636,358), 12 px gray, up to 6 lines of 610 px
```
Title/hero scenes drop the HUD and viewport and use the full frame, keeping the message window. Cards (outro,
estate) replace the message window with the disclosure block.

## 2.5 Guards and tags (what the canvas checks)
Every draw call registers a box with a **tag**: `data` (numbers, values), `label` (names, headings), `caption`
(message text, disclosure), `panel` (frames, fills), `decor` (stripes, rules), `fx`/`bg`/`scroll` (exempt).
- **Every frame**: nothing tagged outside `fx/bg/scroll` may leave the 640x360 frame.
- **Audit frames** (every 15th in render, every 3rd in dry run): `decor` must not overlap `data`; no two
  `data/label/caption` texts may overlap; `label` texts must be unique on screen.
- **Evidence lock**: any text drawn with `guard=True` (default) is scanned for number tokens (`\d[\d,]*(\.\d+)?`);
  each token longer than one digit must appear in some evidence value or `_extra_tokens`, else `GuardError`.
  Use `guard=False` only for (a) names that contain digits ("PC-98", "SHA-256", "M1"), (b) text already checked
  whole (a voice line typed out letter by letter: its prefix "54" of "544" is not a figure), (c) the verbatim
  disclosure.
- Type floor: `size * scale < 8` raises.
- Scene cap: `Scene(dur > 20)` raises.

When a guard fires, move the element (never disable the guard): the collision is real at some frame.
