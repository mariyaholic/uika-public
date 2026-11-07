---
name: copy-craft
description: Use when writing or reviewing prose for a product — marketing copy, landing pages, launch scripts, README intros, release notes, error messages, emails — or when a sentence makes a claim about a number, a comparison or a superiority. Separates voice from tone, treats readability scores as a diagnostic that cannot certify, and forbids any claim the evidence table does not support (substantiation precedes publication).
---

# Copy craft (ADR-0040)

Copy is **a claim with a reader attached**. Two things follow from that and they are the whole skill: the voice has to be
decided once and held, and every claim has to be supportable before it is published — not softened afterwards.

## 1. Voice is stable; tone moves

The published systems that work split one from the other. Mailchimp keeps a consistent voice (its traits, its rules: active
voice, plain English, positive language, and explicit "do not force a joke" guidance) and lets tone adapt to the reader's
state. GOV.UK does it with practical rules plus examples — user needs first, short sentences, "buy" not "purchase" — rather
than a personality grid. NN/g models tone as four spectrums: formal↔casual, serious↔funny, respectful↔irreverent,
matter-of-fact↔enthusiastic, and advises testing against real users (its own experiment was 50 US respondents on
hypothetical sites, so treat the spectrums as a vocabulary, not a result).

For the repo: **decide the voice once per product, in one short file**, with 3–4 traits, 3 rules, 3 do-words, 3
don't-words, and 5 real examples from the product. Tone then varies by surface (launch page vs error message vs release
note) without relitigating the voice. The duality rule already governs the register: public artefacts speak in the *public-light* register,
interior artefacts speak in the *interior-precise* register (ADR-0011).

Do not copy another company's voice file. Its choices are evidence that a choice can be made, not evidence the choice fits
this product.

## 2. Readability is a smoke alarm, not a verdict

Flesch–Kincaid comes from Kincaid et al. (1975), calibrated on 531 Navy enlisted personnel and 18 training-manual passages.
A grade-level number estimates how hard the *text* looks by sentence length and syllables. It does not measure whether a
reader understands, recognises the vocabulary, can follow the argument, or can act on it — and different formulas can score
the same passage several grade levels apart, which makes the precision of the number an illusion (AHRQ).

Use it as a revision prompt:
- A score far above the audience's comfortable range is a signal to look for long sentences and abstract nouns.
- Never write "grade-8 reading level" as a quality claim. Write "long sentences: three over 35 words" — a fact about the
  text that a writer can act on.
- Domain terms are not a defect. "Latency" is clearer than "quickness of response" for the person who needs it.

## 3. Claims: substantiation precedes publication

This is the rule that binds copy to `evidence.json` (the film pipeline's Stage 2 table, `skills/video-pipeline`).

- The FTC's reasonable-basis doctrine: an advertiser must have a reasonable basis **before** a claim is disseminated, and
  it covers express *and implied* claims. A claim of support ("tests prove", "studies show") requires at least that level
  of support. Later evidence does not substitute for prior substantiation.
- "Competent and reliable scientific evidence" means tests, analyses, research or studies conducted and evaluated
  objectively by qualified people using generally accepted procedures — not a collection of anecdotes.
- UK CAP Code 3.7: marketers must hold documentary evidence for objective claims *before* publication; the ASA may treat a
  claim as misleading where substantiation is missing. Comparisons need evidence about the compared competitors, and
  genuine testimonials alone are unlikely to substantiate an objective claim.
- Natural frequencies are understood better than percentages, and relative risk reductions feel larger than absolute ones
  (Cochrane review of 35 studies). Prefer "3 in 100" to "3 %" when the stake is a risk, and always give the base.

**The operational form of this:**
1. Write the claim as a sentence.
2. Find the row in the evidence table that supports *that* sentence, including its scope and context.
3. If there is no row: delete the claim. Do not add "up to", "helps to", or "can" to rescue it — a hedged unsupported
   claim is still unsupported. If a narrower claim is supportable, state the narrower claim and its limit.
4. A true number in the wrong context is a false claim (an archived prior-release figure presented as current). Context travels
   with the value.

## 4. Numbers in prose

- One precision per claim. "40 %" next to "38.6 %" implies the first was measured more coarsely than it was.
- Percent vs percentage points: 10 % → 9 % is −1 pp, −10 % relative. Say which.
- Give the base ("3 of 12 products", not "25 %") when the base is small enough that a reader would want it.
- Round for the claim, keep the exact value in the footnote or the evidence file.
- Units: SI spacing (`30.2 °C`), and one house convention for thousands throughout (NIST prefers a thin space; ONS writes
  `91%`). Pick one and hold it.

## Non-negotiables

- Voice decided once per product; tone varies by surface. No voice file, no copy.
- No claim without an evidence row — delete, do not hedge.
- Comparative and superlative claims need the comparison stated and evidenced ("faster than X, on this benchmark").
- Readability numbers never appear as a quality claim; they appear as a description of the text.
- The reader's language on screen even when the voice speaks another language (the subtitle-first rule, `skills/video-pipeline`).
- Never state a competitor's product does something it does not; a comparison the evidence does not support is a legal
  risk, not a rhetorical flourish.

## Checklist before you deliver

- [ ] Voice file exists and this surface's tone is named (which of the four spectrums, and why).
- [ ] Every number has an evidence row with scope and context; every superlative has a stated comparison.
- [ ] No hedged claim standing in for an unsupported one.
- [ ] Long sentences and abstract nouns, if any, are deliberate.
- [ ] Percent/percentage-point and precision are consistent; units spaced per SI.
- [ ] Reading level, if reported, is reported as a description of the text, not a grade the reader achieved.

## Toolchain

Plain Markdown for the voice file and the evidence table. A word/sentence pass with any linter is fine; do not install a
readability service for it (`textstat` or a 20-line script does the Flesch-Kincaid arithmetic). Claim checking is a human
read against `evidence.json`, not a regex. See skills/toolchains.
