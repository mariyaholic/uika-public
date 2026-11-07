---
name: creative-gates
description: Use when a creative output (video, deck, landing page, brand piece, story, any "make something good") must be better than a cheaper or weaker model's default, or when generating options for the owner to choose between. Injects divergence from outside the model, blocks known defaults, selects with a blind pairwise rubric, and records the owner's real picks so the scaffold improves over time. Also stops a new artefact from inheriting a sibling's structure (descriptor-axis divergence, example-exposure rule, ADR-0040).
---

> **uika-oss note:** `uika video`, `uika figure`, `uika ref` and `uika eval` ship with uika-oss (ffmpeg and Playwright are separate installs). The `uika creative ledger|deck|diverge|pick` commands named below are not in uika-oss yet: draw a hand from `skills/creative-gates/deck.json` yourself and note the seed, keep the picks ledger as a plain file, and check wording divergence by reading the candidates side by side.

# Creative gates (ADR-0026)

Honest premise: **creativity cannot be verified like a decode.** What you can do is (1) stop the model collapsing to its modal answer, (2) block known defaults, (3) choose between real alternatives with a blind rubric, and (4) learn from the owner's actual picks. Weaker models are weak at *originating* taste and reasonably good at *following a sharp brief, obeying constraints and comparing two options*. So: spend the strong model (or the owner) on the brief and the judgment; let the cheap model do breadth and execution inside tight rails.

"Be creative" in a prompt does nothing: the model returns the most probable creative-sounding answer. Divergence has to be injected from outside.

## Gate A: divergence (before writing anything)
Two things have to diverge: **what the piece says** and **how it is built**. Text similarity only sees the first. The
recorded failure mode is the second — six films sharing one five-beat sequence (ADR-0040; `labs/eval/creative-pipeline`).
1. **Read the archive, not the sibling.** `uika creative ledger` gives the owner's past picks and reasons. The accepted
   artefacts in this output class are the structural archive: read their *profiles* (counts, medians, families), never
   their internal structure — Gate E.
2. **Declare the descriptor axes** before a candidate exists. For film: scene count, shot-duration median and IQR,
   shot-duration entropy, transition family, beat archetype, music character. For a document: section count, claim
   order, figures per page. For a figure: form, encoding channel, panel count. Axes you did not declare are differences
   you cannot claim.
3. Draw a hand per candidate: `uika creative deck` (each run a fresh seed; note it). A hand = one WORLD (a metaphor with a physical vocabulary), one CONSTRAINT (a checkable formal rule), one SIGNATURE prompt, two FORBIDs (defaults banned).
4. Write **3 candidates**, each from its own hand, each as a short file: `Concept (one sentence) · Signature beat · Beat list (one line each) · How it obeys its hand`. Cheap models are fine here.
5. **Diverge on both levels.** `uika creative diverge a.md b.md c.md` must PASS (< 0.5) for wording, *and* the three
   beat tables / section lists must differ from each other and from the archive on **at least two declared axes**
   (`uika video structure` writes the profile; `uika video diff a.json b.json` applies the two-axis rule and exits
   non-zero on a clone).
   A candidate that passes the text check while sitting in an occupied cell is a clone. Redraw it; never choose between clones.
6. **Pre-register the prediction** (ADR-0039) before any candidate is built: "for product class P, a candidate with
   property X will be preferred over one with Y". One falsifiable sentence, stored in the brief. Scoring it after the
   pick is what makes the scaffold improve.

## Gate B: default test (per candidate, before selecting)
- **Swap test**: replace the subject's name. If the concept still works unchanged, it is generic; it needs a beat derived from this subject's *mechanism*, not its metrics.
- **Structure swap test**: hand the beat table to another product in the same class. If it still works, you have a
template, not a piece. This is the test the six keynote films would have failed.
- **Stranger test**: can you state the piece in one sentence a stranger would repeat? If not, no concept yet.
- **Signature beat**: one beat that could only exist for this subject. Name it.
- **Forbidden list**: your hand's FORBIDs plus `deck.json` `forbid` cards; any hit is a redraw of that beat.
- **Hierarchy**: every beat has one idea and one graphic that carries the claim; cards only support it.

## Gate C: selection (blind pairwise, never "rate this 1–10")
Use `RUBRIC.md`. Compare candidates **two at a time**, show them in both orders (A/B then B/A), and require a one-line reason per criterion. A judge that is a different model or a different call from the generator is required; never let the generator judge its own output in the same turn. LLM judges favor longer, first-shown and same-family text, so blind the labels and swap order; on a tie or disagreement between the two orders, escalate to the owner with the two finalists, not a vote.
- **Noise floor first** (ADR-0039): put the *same* artefact in both slots before trusting any pair. A judge that prefers
a slot is biased; discount its verdicts until fixed.
- **No 1–10 scales.** Position bias, verbosity bias and self-preference are documented in LLM judges (arXiv:2306.05685,
2410.21819), and pairwise comparison is the protocol the listening/perception literature uses for preference. A rating
number is not a cheaper pairwise test; it is a different, weaker instrument.
- **Report a win rate with an interval**, not a bare fraction: a Wilson 95 % interval (proposal M7 in
`labs/eval/creative-pipeline/README.md`; no `uika creative ledger --stats` command exists yet). A win rate over four
pairs has an interval wide enough to contain the opposite conclusion.

## Gate D: the owner's taste is ground truth
When the owner picks between takes (or says why they liked something), record it: `uika creative pick <project> --winner W --loser L --why "their words"`. Only log what they actually said. Read the ledger before every creative brief. When ≥ 8 entries repeat a reason, turn it into a RUBRIC criterion or a deck card via `skills/eval-hillclimb` (one change per iteration). Score the pre-registered prediction in the same act: did the winner have property X? Record yes, no, or the owner's reason why the rule did not apply. Two failures retire the rule.

## Gate E: example exposure (the rule that stops the next clone)
Showing a finished example raises fixation: designers copy its features without producing fewer ideas (Jansson & Smith
1991, doi:10.1016/0142-694X(91)90003-F), and AI image support produced *more* fixation and lower divergent-thinking scores
than no support (CHI 2024, arXiv:2403.11164). A theme pack's runnable example is therefore an **API demonstration, not a
starting structure**.
- Read the kit's API and one field list. Write your own skeleton (beat table, section list, figure list) **before**
  opening any finished sibling.
- If a sibling must be seen, skeleton first, then compare on the declared axes and record what differed (`uika video
diff` checks film profiles; compare documents and figures by hand).
- Never adopt a sibling's beat count because it worked. Adopt a *reason*; derive the structure from this subject.
This is the cheapest control in the repo and the one most likely to be skipped under deadline.

## Improving cheaper models (the collective loop)
Improve the **scaffold**, not the model:
1. Fix a bench of ~6 briefs, split train/test (ADR-0018).
2. For each, produce: cheap model with no scaffold (baseline), cheap model with these gates (candidate), and a strong-model reference on the same brief.
3. Compare blind and pairwise, judged by the owner (or by an LLM judge whose agreement with the owner has been checked on a sample).
4. Keep a scaffold change only if the candidate's win rate against the baseline rises on the *held-out* briefs; the target is closing the gap to the reference, not beating it.
5. Promote what works into deck cards, RUBRIC weights and `skills/video-direction` house rules.
The gates lift the floor (no generic slop, real alternatives); the ceiling still comes from the brief author, so use the strongest available mind for the brief and the owner for the final pick.

## What this does not do
It does not certify that a piece is good, and a passing `diverge` only proves candidates differ. Say so in the handoff: which gates ran, which hand each candidate drew, what the judge said, whether the owner picked, and whether the prediction held.
