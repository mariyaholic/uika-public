"""score: an arranged music cue, not a loop. Bar-locked sections, 7th-chord voicings, a written hook, a real ending.

Owner feedback on the first cut (2026-09-30): the old bed was a thin C-G-Am-F loop sitting ~12 dB under the voice,
read as "no music", and it hard-stopped at the last frame. This module fixes the causes:
- sections switch on bar lines, and every bar carries its full pad (the old pad only started on a bar inside a section,
  which left a -92 dB hole at a mid-bar section change);
- a hand-written melody (the hook) instead of random notes; anime "royal road" progression IVM7-V7-iiim7-vim7;
- `ending` resolves to a held tonic chord and rings out: the cue ends, it is not cut.

    plan = [(bars, section), ...]      # sections below; bars at `bpm`, 4/4
    music = cue(plan, bpm=120)         # -> stereo float array (n, 2) at sfx.SR, peak-normalised to 0.9
"""
import math
import numpy as np
from sfx import SR, fm, env, t_, lp, hp, noise, sfx_wave, tri, square


def m2f(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# voicings as MIDI notes (bass root, chord tones). C major / A minor.
V = {
    "FM7": (41, [53, 57, 60, 64]), "G7": (43, [55, 59, 62, 65]), "Em7": (40, [52, 55, 59, 62]),
    "Am7": (45, [57, 60, 64, 67]), "Dm7": (38, [50, 53, 57, 60]), "E7": (40, [52, 56, 59, 62]),
    "Cadd9": (36, [52, 55, 60, 62]), "Gsus": (43, [55, 60, 62, 67]), "CM7": (36, [52, 55, 59, 64]),
    "Bb": (46, [53, 58, 62, 65]),
}
PROG = {
    "royal": ["FM7", "G7", "Em7", "Am7"],            # 王道進行
    "tension": ["Dm7", "E7", "Am7", "Am7"],
    "lift": ["FM7", "G7", "CM7", "Am7"],
    "ending": ["FM7", "Gsus", "Cadd9"],        # indexed from the end: the last bar is always the tonic
}
# the hook: 8th notes per bar over the royal road (None = rest). Pentatonic-leaning, singable.
HOOK = [
    [76, None, 79, 81, None, 79, 76, 74],
    [74, None, None, 76, 74, 72, 74, None],
    [71, None, 74, 76, None, 79, 76, 74],
    [72, None, None, None, 69, None, 72, 74],
]
HOOK_B = [   # answer phrase (finale): climbs instead of settling
    [76, None, 79, 81, None, 84, 81, 79],
    [79, None, 81, 79, 76, 74, 76, None],
    [76, None, 79, 83, None, 84, 83, 79],
    [81, None, None, None, 79, 81, 84, None],
]
# sections: which layers play. names are explicit; an unknown section raises.
SECTIONS = {
    "intro":    dict(prog="royal", layers={"pad", "bell", "ep"}, g=1.5),
    "groove":   dict(prog="royal", layers={"pad", "ep", "bass", "hat", "kick"}, g=1.0),
    "tension":  dict(prog="tension", layers={"pad", "pulse", "bass8"}, g=0.9),
    "drive":    dict(prog="lift", layers={"pad", "ep", "bass", "hat", "kick", "snare"}, g=1.0),
    "hush":     dict(prog="tension", layers={"pad", "bell_sparse", "pulse"}, g=1.4),
    "build":    dict(prog="royal", layers={"pad", "ep", "bass", "hat16", "kick"}, g=1.0),
    "finale":   dict(prog="royal", layers={"pad", "ep", "bass", "hat", "kick", "snare", "hook_b", "crash1"}, g=1.1),
    "ending":   dict(prog="ending", layers={"pad", "ep_last", "bell_last", "crash_last"}, g=1.0),
}


class Bus:
    def __init__(self, n):
        self.L = np.zeros(n)
        self.R = np.zeros(n)
        self.n = n

    def add(self, x, t, g, pan=0.0):
        s = int(t * SR)
        if s >= self.n or len(x) == 0:
            return
        x = x[: self.n - s]
        self.L[s:s + len(x)] += x * g * math.cos((pan + 1) * math.pi / 4)
        self.R[s:s + len(x)] += x * g * math.sin((pan + 1) * math.pi / 4)


def _ep(f, dur):
    """DX-style electric piano: carrier + fast-decaying tine partial"""
    n = int(dur * SR)
    body = fm(f, dur, ratio=1.0, idx=1.4, adsr=(0.002, 0.5, 0.35, 0.15), idx_decay=0.35)
    tine = np.sin(2 * np.pi * f * 14 * t_(n)) * np.exp(-t_(n) * 40) * 0.12
    return body + tine


def _pad(f, dur, att=0.35, rel=0.5):
    n = int(dur * SR)
    a = fm(f * 1.003, dur, ratio=1.0, idx=0.7, adsr=(att, 0.4, 0.8, rel), idx_decay=2.0)
    b = fm(f * 0.997, dur, ratio=2.0, idx=0.35, adsr=(att, 0.4, 0.8, rel), idx_decay=2.0)
    return lp(a + 0.6 * b, 2600)


def _bell(f, dur):
    return fm(f, dur, ratio=3.5, idx=2.2, adsr=(0.001, dur * 0.8, 0.0, 0.1), idx_decay=0.3)


def _lead(f, dur):
    """soft square lead doubling the bell (PC-98 FM flavour)"""
    n = int(dur * SR)
    vib = 1 + 0.005 * np.sin(2 * np.pi * 5.2 * t_(n)) * np.clip(t_(n) / 0.25, 0, 1)
    x = square(1, n) * 0 + np.sign(np.sin(2 * np.pi * np.cumsum(f * vib) / SR))
    return lp(x, 3000) * env(n, 0.01, 0.1, 0.6, 0.06) * 0.5


def _bass(f, dur, slap=False):
    n = int(dur * SR)
    x = fm(f, dur, ratio=1.0, idx=2.2 if slap else 1.2, adsr=(0.003, 0.15, 0.6, 0.05), idx_decay=0.06)
    return lp(x + 0.3 * tri(f, n) * env(n, 0.003, 0.1, 0.6, 0.05), 1800)


def _crash():
    n = int(2.2 * SR)
    return hp(noise(n), 3000) * np.exp(-t_(n) * 2.2) * 0.5


def cue(plan, bpm=120, seed=3):
    beat = 60.0 / bpm
    bar = 4 * beat
    total_bars = sum(b for b, _ in plan)
    tail = 5.0
    n = int((total_bars * bar + tail) * SR)
    B = Bus(n)
    rng = np.random.default_rng(seed)
    bi = 0
    for nbars, name in plan:
        if name not in SECTIONS:
            raise KeyError(f"unknown section {name}")
        S = SECTIONS[name]
        L, g, prog = S["layers"], S["g"], PROG[S["prog"]]
        for k in range(nbars):
            tb = (bi + k) * bar
            ch = prog[k % len(prog)] if name != "ending" else prog[len(prog) - nbars + k]
            root, tones = V[ch]
            last = (k == nbars - 1)
            # pad: every bar, whole bar (overlapping release keeps it seamless)
            if "pad" in L:
                ring = name == "ending" and last          # the final tonic holds through the tail
                dur = bar + (tail - 0.5 if ring else 0.6)
                for m in tones:
                    B.add(_pad(m2f(m), dur, rel=(tail + bar - 1.0) if ring else 0.5), tb, 0.055 * g, pan=rng.uniform(-0.6, 0.6))
            # electric piano comping: city-pop pushes (1, &2, &3, 4&)
            if "ep" in L:
                for off in (0.0, 1.5, 2.5, 3.5):
                    for m in tones:
                        B.add(_ep(m2f(m + 12), beat * 0.7), tb + off * beat, 0.035 * g, pan=0.25)
            if "ep_last" in L and last:
                for j, m in enumerate(tones + [tones[0] + 12]):
                    B.add(_ep(m2f(m + 12), bar + tail * 0.8), tb + j * 0.06, 0.05 * g, pan=-0.3 + 0.15 * j)
            # bass
            if "bass" in L:
                pat = [(0, 0, 0.9), (1.5, 0, 0.5), (2, 12, 0.4), (3, 0, 0.5), (3.5, 7, 0.4)]
                for off, iv, d in pat:
                    B.add(_bass(m2f(root + iv), beat * d, slap=iv == 12), tb + off * beat, 0.30 * g)
            if "bass8" in L:
                for e in range(8):
                    B.add(_bass(m2f(root), beat * 0.4), tb + e * beat / 2, 0.24 * g * (1.0 if e % 2 == 0 else 0.7))
            # drums
            if "kick" in L:
                for q in (0, 2) if "snare" in L else (0, 2.5):
                    B.add(sfx_wave("kick"), tb + q * beat, 0.5 * g)
            if "snare" in L:
                for q in (1, 3):
                    B.add(sfx_wave("snare"), tb + q * beat, 0.26 * g)
            if "hat" in L or "hat16" in L:
                steps = 16 if "hat16" in L else 8
                for e in range(steps):
                    B.add(sfx_wave("hat"), tb + e * bar / steps, 0.07 * g * (1.0 if e % 2 else 0.55), pan=0.35)
            if "pulse" in L:
                for e in range(16):
                    B.add(sfx_wave("tick"), tb + e * beat / 4, 0.10 * g * (1.0 if e % 4 == 0 else 0.45), pan=-0.3)
            if "crash1" in L and k == 0:
                B.add(_crash(), tb, 0.35 * g)
            if "crash_last" in L and last:
                B.add(_crash(), tb, 0.3 * g)
            # melody
            hook = HOOK_B if "hook_b" in L else (HOOK if "bell" in L else None)
            if hook is not None and name != "ending":
                ph = hook[k % 4]
                for e, m in enumerate(ph):
                    if m is None:
                        continue
                    d = beat * 0.5 * (2 if e + 1 < 8 and ph[e + 1] is None else 1) * 0.95
                    B.add(_bell(m2f(m), d + 0.3), tb + e * beat / 2, 0.09 * g, pan=-0.1)
                    B.add(_lead(m2f(m), d), tb + e * beat / 2, 0.035 * g, pan=0.1)
            if "bell_sparse" in L:
                m = tones[-1] + 12
                B.add(_bell(m2f(m), bar * 0.9), tb, 0.08 * g)
                B.add(_bell(m2f(tones[1] + 12), bar * 0.5), tb + 2.5 * beat, 0.05 * g)
            if "bell_last" in L and last:
                for j, m in enumerate([76, 79, 84]):
                    B.add(_bell(m2f(m), 3.5), tb + j * beat / 2, 0.08 * g)
        bi += nbars
    x = np.stack([B.L, B.R], axis=1)
    x *= 0.9 / max(np.abs(x).max(), 1e-9)
    return x, bar
