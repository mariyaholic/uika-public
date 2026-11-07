# 05 — Sound: FM score, SFX classes, voice, ducking, mastering

You (the agent) cannot listen. Every audio decision below is a **measured** rule that came from an owner note.
Report measurements (LUFS, peak, per-bus RMS, spike list); leave taste to the owner.

## 5.1 Buses and the reference level
Three buses, all levelled against **the voice's speaking RMS** (`v_rms` = RMS of the voice bus where its
envelope > 0.02). The voice is the reference because it is the thing that must be understood.
```
voice  : lines placed at scene_start + vstart[i], gain 1.0, centre
music  : score.cue(plan) -> scaled so music RMS = v_rms - 3.5 dB -> sfx.duck(music, voice, depth_db=5.5)
sfx    : each cue at its class level vs v_rms (below), light reverb 0.15
mix    = voice + music + sfx -> last 1.2 s * linspace(1,0)^2 -> sfx.master(target -14 LUFS, ceiling -2 dBFS)
```
Why these numbers: music at -12 dB read as "no music"; -3.5 then a 5.5 dB duck keeps it present between lines
and clear under them. `Keynote.build_audio()` does all of this; you only list cues.

## 5.2 The score (kit/score.py): an arranged cue, not a loop
```python
MUSIC = [(4, "intro"), (8, "groove"), (7, "tension"), (9, "drive"), (8, "hush"), (7, "build"),
         (9, "finale"), (2, "intro"), (3, "ending")]            # (bars, section) == one per scene
mus, bar = score.cue(MUSIC, bpm=120)
```
- **Instruments are FM** (2-operator `sfx.fm(f, dur, ratio, idx, adsr, idx_decay)`): pad (ratio 1 + 2, detuned
  +-0.3%, low-passed 2.6 kHz), DX electric piano (ratio 1 + a 14x "tine"), bell (ratio 3.5), bass (ratio 1,
  `slap` = idx 2.2 on octave notes), a square lead with delayed 5.2 Hz vibrato doubling the bell. Drums are
  synthesized kick/snare/hat/tick. That palette is what makes it sound like a PC-98 (YM2608) soundtrack.
- **Harmony**: the anime "royal road" 王道進行 IVM7-V7-iiim7-vim7 (`FM7 G7 Em7 Am7` in C) for the main sections;
  `tension` = Dm7-E7-Am7-Am7 (minor, dominant pull); `lift` = FM7-G7-CM7-Am7; `ending` = FM7-Gsus-Cadd9 indexed
  from the end so the **last bar is always the tonic**.
- **Sections = layer sets**: intro (pad, bell hook, EP) · groove (+bass, hat, kick) · tension (pad, 16th pulse,
  8th bass, no hook) · drive (full kit, city-pop EP pushes on 1, &2, &3, 4&) · hush (sparse bells) · build (16th
  hats) · finale (answer hook HOOK_B climbs, crash on bar 1) · ending (EP arpeggiated tonic + bell 76-79-84, crash).
  Match the section to the scene's emotion: the caveat gets `tension`, the honest negative gets `hush`, the payoff
  gets `finale`.
- **The hook** is written, 8th notes per bar (HOOK, HOOK_B), pentatonic-leaning. Random notes read as noodling.
- **Every bar carries its pad** (overlapping 0.6 s release). v1 started pads only on section bars and left a
  -92 dB hole at a mid-bar section change.
- **The ending resolves**: the final tonic pad rings for the 5 s tail; the picture holds for RING = 3.5 s; the
  mix fades only in its last 1.2 s. A cue that stops at the last frame is "abrupt".
New section? Add it to `SECTIONS` with `prog`, `layers`, `g` (gain); unknown names raise.

## 5.3 SFX: library and classes
`sfx.SFX` (all synthesized, no samples, no licence questions): kick snare hat click clack tick thunk stamp hit
klaxon hum whoosh_up whoosh_down sweep blip chime power glitch ratchet drop tape bell pencil page.

Classes (dB vs `v_rms`, measured on the loudest 100 ms of each cue — `sfx.loud_rms`):
| Class | Level | Members | Meaning |
|---|---|---|---|
| impact | -2 dB | hit stamp klaxon thunk | a verdict lands; max one per 2 s; never on speech |
| accent | -9 dB | whoosh_* sweep power drop tape pencil bell chime page | a thing moves or appears |
| texture | -14 dB | hum tick blip click clack glitch ratchet | continuous detail, counters, typing |
```python
def cues(c, st):                                  # st = scene start times; c(name, t, trim_db=0, pan=0)
    c("stamp", st[3] + VERDICT_T - 0.02)          # class level
    for i in range(5):
        c("chime", st[1] + FIRST_LIT[i] - 0.03, -3, pan=-0.6 + 0.3 * i)   # trim within the class, pan across
K.cues = cues                                     # Keynote.build_audio calls it; < 8 cues raises
```
Rules: `trim_db` only nudges inside a class (-3..+1); a name not in `SFX_KIND` raises (add it with a class).
Impacts inside a voice span (`start - 0.1 < t < end`) raise `GuardError` — move the impact after the line.
Visual hits lead their sound by 0-20 ms (`- 0.02`), never trail it. At least 12 cues per minute of film, else
the picture feels silent under the music.

## 5.4 Voice
| Option | When | Notes |
|---|---|---|
| Kokoro-82M (`kokoro-onnx`, Apache-2.0, local CPU) | default for English | `KOKORO_DIR` holds `kokoro-v1.0.onnx` + `voices-v1.0.bin`; voices `af_heart` (warm), `af_bella`, `af_nicole`, `jf_alpha` (Japanese female); blends `"af_heart:0.6+jf_alpha:0.4"`. Its Japanese G2P (espeak) is poor: do not use it for Japanese text |
| Your own voice clone (GPT-SoVITS on Modal, optional) | Japanese speech | **private, internal only, never redistribute**. `vo.prefetch_clone(LINES_JA)` = one Modal session; speaks exact text; ~1 min cold start |
| SAPI Zira (pitched) | offline fallback | owner: "robotic". Never the first choice |
Speech language and screen language are separate decisions. the reference film: Japanese audio, English message window
(`LINES` guarded on screen, `LINES_JA` spoken). Write numbers in the spoken text the way the engine reads them:
kana readings in Japanese (544 -> ごひゃくよんじゅうよん (any number)), and `vo.spoken()` substitutions in English (PF ->
"profit factor", 2% -> "2 percent", SHA-256 -> "S H A 256"). Keep lines <= ~7 s; long lines force 12 px type
and bars you do not have. Send the owner a short reel (`tools/voice_reel.py` pattern) before committing a voice.

## 5.5 Mastering (sfx.master)
1. Measure integrated loudness with ffmpeg `loudnorm` (print_format=json).
2. Gain to -14 LUFS, then `sfx.limit` (lookahead brickwall: min-filter of the needed gain, smoothed; never tanh).
3. Repeat up to 3x until within 0.2 LU and the peak <= ceiling + 0.6. Typical passes:
   `(-23.4, -6.2) -> (-14.3, -1.3) -> (-14.0, -1.3)`.
Targets: -14 LUFS integrated, sample peak <= -2 dBFS (true peak lands -1.3..-1.7), LRA 3-6 LU.
Then `sfx.mux(preview_silent, wav, final)` (AAC 256k, `-shortest`, video copied, no second loudnorm).

## 5.6 Checking it without ears
Run the audio-profile snippet in skills/video-pipeline/references/checklists.md: half-second RMS, holes
(< -40 dB mid-programme), spikes (> median + 8 dB), the tail (must fall steadily). Compare the spike list to the
cue list: every spike should be a planned impact. Report the numbers to the owner with the file.
