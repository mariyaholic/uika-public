# 05 — Sound

The audio code is shared with the PC-98 pack: `skills/retro-pixel/kit/sfx.py`, covering `Mix`, `note`, `bass`,
`sfx`, `reverb`, `duck`, `master`, `mux` and `chord_notes`. This file covers what changes for a launch: how loud,
how sparse, and where the accents go.

## Measured (library `_tools/audio_stats.py`, flagged uploads excluded)
Each cell is the median across that category's videos.
- **Accent share**: the fraction of animated transitions where the 0.4 s window around the motion start is
  ≥ 6 dB louder than the 1.5 s before it. Only videos with ≥ 10 transitions are counted.
- **Silence share**: the fraction of 100 ms windows below −50 dBFS.

| Format | n | Integrated LUFS | LRA (LU) | Accent share | Silence share |
|---|---|---|---|---|---|
| Product film | 9 | −16.4 | 7.1 | 0.10 | 0.06 |
| Produced keynote | 10 | −21.3 | 7.7 | 0.06 | 0.09 |
| Statistics talk | 3 | −18.2 | 5.3 | 0.02 | 0.04 |
| Stage live | 14 | −22.7 | 8.2 | 0.07 | 0.15 |
| Livestream launch | 3 | −18.0 | 7.6 | 0.05 | 0.17 |
| Stage classic | 2 | −21.7 | 9.7 | 0.07 | 0.20 |

What it says:
1. **Transitions rarely carry a hit.** Between 2 % and 10 % of animated transitions coincide with a loud
   accent. Picture changes ride the music; the music doesn't punch every picture change. Even product films,
   the punchiest format, accent only about one transition in ten.
2. **Uploads are quieter than our master.** The uploads sit at −16 to −23 LUFS because the platform normalises
   playback. Don't copy their loudness. We master to −14 LUFS so that a file played outside a platform (local
   player, conference screen) isn't weak. The `uika video qa` gate checks −14 ±2.
3. **Dynamics are moderate.** LRA is 5–8 LU in produced work. Our template measures 5.9. Above about 10 LU, the
   quiet parts get lost on laptop speakers; below 3 LU, the result is flat and fatiguing (qa marks LRA < 1 as
   flat).
4. **Produced films are almost never silent.** Silence shares are 0.06–0.09, against 0.15–0.20 for live
   stages, where silence is applause gaps and walk-ons. A deliberate silence is a tool for one beat (the
   lights-off reveal), not a texture.

## The bed: an arc, then a resolution
- **Tempo** 90–110 bpm. Use a four-chord loop in a major key (template: F C G Am at 96 bpm), with pad + bass.
- **Arc**: energy starts at about 0.55 and grows to 1.0 by the first data scene. A pulse layer (arps on half
  beats) enters with the data and leaves one bar before the end card.
- **Resolution**: the end card holds the tonic chord and lets it ring about 2 s past the picture
  (`Mix(TOTAL + 2.5)`). Never cut the music on the last frame.
- **With a voice**: duck the bed 4–6 dB under the voice (`sfx.duck(music, voice, depth_db=5)`). The bed carries
  the arc only between lines.

## Accents: three classes, set relative to the bed
Set an accent's level relative to the bed's RMS, never as an absolute gain. The template's `cue(name, t, rel_db)`
does this with `sfx.loud_rms`.

| Class | Use | Cue | Level vs bed | Placement |
|---|---|---|---|---|
| Hero | The one moment the film is about (price, name reveal) | `chime`, `bell` | 0 dB | +0.5 s after the visual lands. The number first, then the sound |
| Unveil | Showpiece transitions (slit, portal, shape) | `whoosh_up`, `sweep` | −2 to −6 dB | Starts 0.45–0.5 s before the boundary so it peaks on it |
| Texture | UI ticks, counter settle | `tick`, `blip`, `click` | −12 dB or lower | On the event; most scenes need none |

Budget: **2–3 hero/unveil accents in a 60 s film**, which matches the measured 6–10 %. Never put an accent on
top of a voice line: move the accent or the line.

## Mastering
`sfx.master(stereo, tmp_wav, target=-14.0, ceiling_db=-1.5)` runs loudness passes until it hits −14 LUFS with
true peak ≤ −1.5 dBTP. Then `mux`. The QA gate (`uika video qa`) must pass:
- loudness −14 ±2;
- peak warn above −1.0 dBFS;
- no silent stretch ≥ 3 s.

After that, **listen** once on laptop speakers.

## Studied
- Apple M5 film `GriXfu4tL30`: LUFS −16.4, LRA 16.5, accent share 0.024. It is the widest dynamics in the
  set; we deliberately master narrower (5–8 LU).
- Rosling `hVimVzgtD6w`: the voice carries the talk; accent share 0.02 is the lowest format median.
- Linear `9Q5BoiIFBiY`: calm, no music hits (viewing notes). It's the model for UI-led films.
