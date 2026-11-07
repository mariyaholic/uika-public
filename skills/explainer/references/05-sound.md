# 05 — Sound

Narration leads. The picture is timed to the voice, not the reverse.

## Voice
- Synthesize the narration **first** (reuse `skills/retro-pixel/kit/vo.py`, Kokoro, `KOKORO_DIR`).
- Time each beat to its line: `voice_start + duration < beat_length − 0.4 s`.
- One narrator. Keep the on-screen language the viewer's, even if the voice is another (state the choice).

## Bed
- A quiet bed, arranged to the beats (a section per beat), levelled ~6–8 dB under the voice and ducked while
  speaking. It resolves at the close; never cut mid-phrase.
- Master to −14 LUFS, true peak ≤ −1.5 dBTP (same targets as the other packs; `uika video qa` enforces).

## Accents
- The idiom is **sparse**. Put a soft accent on the 2–3 aha beats (the reveal, the payoff, the close). Not on
  every transition.
- **Silence is an accent.** Drop the bed for a beat before the payoff; the absence does the work.
- Never put a hit on top of speech; land accents in the gap after a line.

## What to measure when you cannot hear
`uika video qa` gives loudness, peak and LRA; a half-second profile should show no holes and no spike > 8 dB
over the median, and an ending that decays to silence (skills/video-pipeline, stage 6).
