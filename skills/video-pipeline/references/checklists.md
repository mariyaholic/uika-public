# Checklists (copy into STATUS.md and tick)

## Before the first frame
- [ ] Raw brief quoted in PLAN.md; limits listed (length, scene cap, headless, aspect, one-at-a-time)
- [ ] Fact source named; evidence table written; source-required labels copied (era, run type, tier)
- [ ] Creative gates run; concept file with hand, signature, forbids, beat table
- [ ] Beat table: one carrying graphic per claim; one honest negative; number-first; impacts off speech; ending resolves
- [ ] Voice chosen by the owner (reel sent) or an explicit default; language of speech vs screen decided
- [ ] Downloads asked for (name, source, size); art provenance in assets/MANIFEST.json; rights noted (internal-only?)

## Before rendering
- [ ] `frames` at every scene's steady state, every impact, first/last 2 s; presenter at 3x zoom
- [ ] `dryrun` clean (every frame through the guards)
- [ ] `audio` clean: master within -14 +-0.5 LUFS, sample peak <= -2 dBFS, true peak <= -1.0 dBTP; loudness profile checked (below)
- [ ] Previous accepted final copied to `out/<name>_v<N>.mp4`

## After rendering
- [ ] `uika video qa <final> --expect-duration <s> --against <preview>`: 0 FAIL; every WARN explained
- [ ] `uika video sheet`; suspects confirmed with `uika video frame` at steady state
- [ ] STATUS.md: QA numbers, what was sampled, what was not (audio not heard, motion not played)
- [ ] File sent to the owner with 3-5 lines on what changed and what is still open

## Audio profile (you cannot listen; measure)
```python
import wave, numpy as np
w = wave.open("out/<name>.wav"); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, 2).astype(float) / 32768
m = x.mean(1); h = sr // 2
r = [20 * np.log10(np.sqrt(np.mean(m[i:i + h] ** 2)) + 1e-9) for i in range(0, len(m) - h + 1, h)]
med = float(np.median(r))
print("median", round(med, 1), "max", round(max(r), 1), "@", r.index(max(r)) / 2, "s")
print("holes (< -40 dB) at", [i / 2 for i, v in enumerate(r[:-8]) if v < -40])        # mid-programme silence
print("spikes (> median+8) at", [i / 2 for i, v in enumerate(r) if v > med + 8])      # SFX too loud
print("tail", [round(v) for v in r[-8:]])                                            # must decay, not stop
```
Read it against the beat table: spikes should be planned impacts (and still within +8 dB), holes are bugs,
the tail must fall steadily to below -40 dB.

## Owner-note translation table
| Owner says | Measure first | Usual cause |
|---|---|---|
| "no music" | music RMS vs voice RMS | bed > 8 dB under voice; thin arrangement |
| "sfx overwhelming" | half-second spikes vs median | raw gains; impacts stacked; no class levels |
| "abrupt ending" | last 2 s RMS and content | no cadence / ring-out; picture ends on a data frame |
| "scuffed audio" | peak before limiter; overlaps of impacts and voice | saturation; hits on speech |
| "robotic voice" | engine used | pitched SAPI; switch to neural TTS and send a reel |
| "eerie / wrong fps" | per-element update rate | an element animates at 30 fps in a stepped-motion style |
| "too few stats" | fact sheet rows unused | titled cards instead of carrying graphics |
