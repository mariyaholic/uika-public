# Creative rubric (blind pairwise; ADR-0026)

Use for Gate C in SKILL.md. For each pair, judge criterion by criterion, write one line of reason each, then name a winner per criterion and overall. Run it twice with the two candidates in swapped order; if the overall winners differ, it is a tie for the owner.

Anchors are for calibration; judge which of the two is closer to 5, not the absolute score.

| # | Criterion | 1 (weak) | 3 (competent) | 5 (strong) |
|---|---|---|---|---|
| 1 | **Concept trace** | Look is generic; swapping the subject changes nothing | A theme exists but decorates | Every visual choice traces to one concept sentence; swap test fails (good) |
| 2 | **Signature beat** | None; every beat could be another subject's | A distinctive beat, but from metrics | One beat derived from the mechanism that only this subject could have |
| 3 | **One idea per beat** | Cards of text carry the claim | Graphic and text compete | One graphic carries each claim; text supports it |
| 4 | **Restraint and hierarchy** | Everything the same size and weight; boxes bigger than content | Clear headline, cluttered rest | Deliberate emptiness; the eye goes where the claim is |
| 5 | **Surprise with a reason** | Predictable from the first five seconds | One surprise, unexplained | A turn that makes the earlier beats read differently |
| 6 | **Defaults avoided** | Hits several `deck.json` forbid cards | Avoids most | Avoids all, and says what it did instead |
| 7 | **Payoff and ending** | Fades out; last frame is a logo | Ends on the claim | The last beat lands the claim and the viewer remembers one thing |
| 8 | **Honesty** | Overclaims, unsourced numbers | Sources present | A visible caveat or negative result, designed, with a source |

Craft that is mechanically checkable (overflow, legibility, decode, audio levels) is NOT judged here: it goes through `uika video qa` and `skills/video-review`. A piece that fails those cannot win on creativity.

Output block per pair:
```
Order 1 (A first): c1 ... c8 one-liners → overall: <A|B>
Order 2 (B first): c1 ... c8 one-liners → overall: <A|B>
Agreement: yes → winner <X> | no → TIE, send both to the owner with the deciding criteria
```
