# 01 — The look

The idiom is **clarity by subtraction**. The screen holds one idea; everything else is dimmed or absent.
It borrows 3Blue1Brown's discipline without imitating its brand: dark canvas, geometric construction,
equations that appear as consequences.

## Canvas
- Background: `#0E1116` (near-black, cool). Never pure black.
- One dominant ink (`ACCENT` #58C4DD) and one second idea (`WARM` #D8A657). A negative (`NEG`) for the
  wrong/contrast case. All else is `INK`/`DIM`. **≤ 6 inks on screen at once.**
- 16:9, 1080p. Generous margins; a strong left or centre anchor.

## Type
- Prose/narration on screen: a serif (`SERIF`), sparse, sentence case.
- Maths and coordinates: `MONO`. Nothing below **24 px at 1080p** (`TYPE_FLOOR_PX`); the guard asserts it.
- One line of text at a time in the build; the voice carries the rest.

## The one-idea law
Ask of every element: does removing it lose the idea? If not, remove it. Decoration (glow, grid, watermark)
must never touch a mark; the guard `assert_no_overlap` covers labels, and the author keeps decoration clear
of data.

## What this look is not
- A corporate explainer with stock gradients and bullet cards.
- An equation pasted whole while a voice reads it.
- Aesthetic maths: symbols that are never used to reach a conclusion.
