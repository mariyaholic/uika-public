"""manim_guards.py — render-side guards for Manim scenes (ADR-0025).

Fail the RENDER, not the later review, for the four defects the launch-keynotes postmortem found:
  overflow            -> assert_in_frame
  decoration on data  -> assert_no_overlap
  wrong / duplicate labels -> assert_texts, assert_unique
  unreadable type     -> assert_min_text_height

Usage (call at the scene's steady state, i.e. after the last build animation of a beat, before the hold):

    from manim_guards import assert_in_frame, assert_no_overlap, assert_texts, assert_unique, assert_min_text_height
    cards = VGroup(*cards)
    assert_in_frame(cards, name="market cards")
    assert_unique([labels_of(c)[0] for c in cards], name="card headers")     # three cards, three different headers
    assert_texts(cards[0], ["BTCUSD", "1.66"])                                 # this card must say these strings
    assert_no_overlap(window_ticks, numeral, name="title-bar ticks vs hero number")
    assert_min_text_height(source_lines, min_px=14, out_height_px=1080)

Requires manim (on PATH or in `<MANIM_VENV>`). No other dependencies.
Self-test: python manim_guards.py  (exits non-zero on failure).
"""
from __future__ import annotations

from manim import Text, config


class GuardError(AssertionError):
    """A render-side guard failed. The message says what to fix."""


def _flat(*mobs):
    """Leaves to check: Text is a unit (not its glyphs); any other container is descended into."""
    for m in mobs:
        if isinstance(m, Text) or not getattr(m, "submobjects", None):
            yield m
        else:
            yield from _flat(*m.submobjects)


def _box(m):
    return (m.get_left()[0], m.get_right()[0], m.get_bottom()[1], m.get_top()[1])


def assert_in_frame(*mobs, margin: float = 0.15, name: str = "group"):
    """Every mobject's bounding box must sit inside the frame with `margin` units to spare."""
    fw, fh = config.frame_width, config.frame_height
    for m in _flat(*mobs):
        l, r, b, t = _box(m)
        if l < -fw / 2 + margin or r > fw / 2 - margin or b < -fh / 2 + margin or t > fh / 2 - margin:
            raise GuardError(
                f"{name}: {type(m).__name__} spans x[{l:.2f},{r:.2f}] y[{b:.2f},{t:.2f}] but the safe frame is "
                f"x[±{fw/2 - margin:.2f}] y[±{fh/2 - margin:.2f}]. Resize or re-space the row."
            )


def labels_of(*mobs) -> list[str]:
    """All Text strings inside the given mobjects, in draw order."""
    return [m.text for m in _flat(*mobs) if isinstance(m, Text)]


def assert_texts(group, expected, name: str = "group"):
    """Each string in `expected` must appear in some Text inside `group` (substring match)."""
    have = labels_of(group)
    missing = [e for e in expected if not any(e in h for h in have)]
    if missing:
        raise GuardError(f"{name}: expected text {missing} not on screen; found {have}")


def assert_unique(labels, name: str = "labels"):
    """Labels that identify different things must differ (the duplicate-header card bug)."""
    seen, dup = set(), set()
    for x in labels:
        (dup if x in seen else seen).add(x)
    if dup:
        raise GuardError(f"{name}: duplicate labels {sorted(dup)} in {list(labels)}; a lookup probably fell through to a default")


def assert_no_overlap(a, b, pad: float = 0.0, name: str = "decoration vs data"):
    """Bounding boxes of `a` and `b` (mobjects or groups) must not intersect. Use for decoration vs data."""
    for x in _flat(a):
        for y in _flat(b):
            xl, xr, xb, xt = _box(x)
            yl, yr, yb, yt = _box(y)
            if xl < yr + pad and yl < xr + pad and xb < yt + pad and yb < xt + pad:
                raise GuardError(f"{name}: {type(x).__name__} box x[{xl:.2f},{xr:.2f}] y[{xb:.2f},{xt:.2f}] overlaps "
                                 f"{type(y).__name__} box x[{yl:.2f},{yr:.2f}] y[{yb:.2f},{yt:.2f}]")


def assert_min_text_height(*mobs, min_px: float = 14, out_height_px: int = 1080, name: str = "text"):
    """Text must be at least `min_px` tall in the FINAL output (bounding box height, so a floor for cap height)."""
    px_per_unit = out_height_px / config.frame_height
    for m in _flat(*mobs):
        if isinstance(m, Text):
            h = m.height * px_per_unit
            if h < min_px:
                raise GuardError(f"{name}: '{m.text[:40]}' is {h:.1f}px tall at {out_height_px}p (< {min_px}px). Raise font_size.")


if __name__ == "__main__":  # self-test against the real defect patterns
    from manim import DL, RIGHT, UR, Line, Rectangle, VGroup

    # 1. the duplicate label bug: three cards, one header
    try:
        assert_unique(["USDCHF", "USDCHF", "USDCHF"], name="card headers"); raise SystemExit("FAIL: duplicates not caught")
    except GuardError:
        pass
    assert_unique(["BTCUSD", "USDJPY", "USDCHF"])
    # 2. the promo_style.title_bar bug: 'close ticks' built from unit corner vectors are 2.8-unit diagonals over the card
    numeral = Text("1.66", font_size=44)
    tick = Line(UR, DL).move_to(numeral.get_right())  # title_bar() parks the ticks at the card's right edge, beside the hero number
    try:
        assert_no_overlap(tick, numeral, name="tick vs numeral"); raise SystemExit("FAIL: overlap not caught")
    except GuardError:
        pass
    # 3. overflow: three 4.3-wide cards + 0.6 gaps = 14.1 units in a 14.22 frame; three 3.9-wide cards fit
    ok = VGroup(*[Rectangle(width=3.9, height=2) for _ in range(3)]).arrange(RIGHT, buff=0.6)
    assert_in_frame(ok)
    bad = VGroup(*[Rectangle(width=4.3, height=2) for _ in range(3)]).arrange(RIGHT, buff=0.6)
    try:
        assert_in_frame(bad, name="cards"); raise SystemExit("FAIL: overflow not caught")
    except GuardError:
        pass
    # 4. text content + size
    assert_texts(VGroup(Text("BTCUSD"), Text("PF 1.66")), ["BTCUSD", "1.66"])
    try:
        assert_min_text_height(Text("source: families.json", font_size=6), min_px=14); raise SystemExit("FAIL: tiny text not caught")
    except GuardError:
        pass
    print("manim_guards self-test: PASS")
