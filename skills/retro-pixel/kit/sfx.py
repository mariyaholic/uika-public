"""sfx: numpy FM/chiptune synthesis, SFX library, mixer, loudness-normalised mux.

Rules (ADR-0025): a video's cue list must be non-empty; unknown SFX names raise; no silent defaults.
"""
import json, math, subprocess, wave, os
import numpy as np
from scipy.signal import lfilter

SR = 44100
_rng = np.random.default_rng(1998)


# ------------------------------------------------------------------ basics
def t_(n):
    return np.arange(n) / SR


def env(n, a=0.005, d=0.1, s=0.6, r=0.1):
    e = np.ones(n)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = min(na, n)
    e[:na] = np.linspace(0, 1, max(na, 1), endpoint=False)
    nd = min(nd, n - na)
    if nd > 0:
        e[na:na + nd] = np.linspace(1, s, nd)
    if n - na - nd > 0:
        e[na + nd:] = s
    nr = min(nr, n)
    if nr > 0:
        e[n - nr:] *= np.linspace(1, 0, nr)
    return e


def sine(f, n, ph=0.0):
    return np.sin(2 * np.pi * f * t_(n) + ph)


def square(f, n, duty=0.5):
    x = (f * t_(n)) % 1.0
    return np.where(x < duty, 1.0, -1.0)


def tri(f, n):
    x = (f * t_(n)) % 1.0
    return 4 * np.abs(x - 0.5) - 1


def saw(f, n):
    return 2 * ((f * t_(n)) % 1.0) - 1


def noise(n):
    return _rng.uniform(-1, 1, n)


def fm(f, dur, ratio=2.0, idx=2.5, adsr=(0.004, 0.12, 0.5, 0.12), idx_decay=0.25):
    """two-operator FM (YM2608-flavoured)"""
    n = int(dur * SR)
    if n <= 0:
        return np.zeros(0)
    ie = idx * np.exp(-t_(n) / max(idx_decay, 1e-3))
    mod = np.sin(2 * np.pi * f * ratio * t_(n))
    car = np.sin(2 * np.pi * f * t_(n) + ie * mod)
    return car * env(n, *adsr)


def hz(name):
    """'C4' -> Hz. raises on bad names."""
    base = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    p = name[0]
    acc = 0
    i = 1
    if name[i] == "#":
        acc, i = 1, i + 1
    elif name[i] == "b":
        acc, i = -1, i + 1
    octv = int(name[i:])
    midi = 12 * (octv + 1) + base[p] + acc
    return 440.0 * 2 ** ((midi - 69) / 12)


def lp(x, cutoff):
    a = math.exp(-2 * math.pi * cutoff / SR)
    return lfilter([1 - a], [1, -a], x)


def hp(x, cutoff):
    return x - lp(x, cutoff)


# ------------------------------------------------------------------ SFX library (mono float arrays)
def _kick():
    n = int(0.28 * SR)
    f = 130 * np.exp(-t_(n) * 18) + 42
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(n, 0.001, 0.2, 0.0, 0.05)


def _snare():
    n = int(0.2 * SR)
    return (hp(noise(n), 1500) * 0.8 + sine(190, n) * 0.4) * env(n, 0.001, 0.14, 0.0, 0.04)


def _hat():
    n = int(0.06 * SR)
    return hp(noise(n), 7000) * env(n, 0.001, 0.04, 0.0, 0.01)


def _click():
    n = int(0.03 * SR)
    return (hp(noise(n), 2500) * 0.7 + square(1900, n) * 0.4) * env(n, 0.0005, 0.02, 0.0, 0.006)


def _clack():
    n = int(0.06 * SR)
    return (lp(noise(n), 3000) * 0.6 + sine(420, n) * 0.6) * env(n, 0.0005, 0.04, 0.0, 0.01)


def _tick():
    n = int(0.02 * SR)
    return sine(2600, n) * env(n, 0.0003, 0.012, 0.0, 0.004) * 0.8


def _thunk():
    n = int(0.22 * SR)
    f = 90 * np.exp(-t_(n) * 22) + 45
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.35 * lp(noise(n), 900)) * env(n, 0.001, 0.15, 0.0, 0.05)


def _stamp():
    n = int(0.45 * SR)
    body = _thunk()
    out = np.zeros(n)
    out[:len(body)] += body
    s = int(0.012 * SR)
    out[s:s + int(0.12 * SR)] += lp(noise(int(0.12 * SR)), 2200) * env(int(0.12 * SR), 0.001, 0.08, 0, 0.03) * 0.6
    return out


def _hit():
    """the big one: low boom + noise burst + FM bell"""
    n = int(1.6 * SR)
    f = 70 * np.exp(-t_(n) * 5) + 36
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 1.2, 0.0, 0.3)
    burst = lp(noise(n), 5000) * env(n, 0.001, 0.35, 0.0, 0.1) * 0.7
    bell = fm(hz("E5"), 1.6, ratio=3.5, idx=4, adsr=(0.001, 1.3, 0.0, 0.2), idx_decay=0.5) * 0.35
    return boom + burst + bell


def _klaxon():
    n = int(1.3 * SR)
    f = np.where((t_(n) * 3.2 % 1.0) < 0.5, 440.0, 330.0)
    x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.6 + np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * 0.2
    return x * env(n, 0.01, 0.1, 0.9, 0.15)


def _hum():
    n = int(2.0 * SR)
    x = saw(55, n) * 0.35 + sine(110, n) * 0.4 + lp(noise(n), 300) * 0.15
    return x * env(n, 0.2, 0.2, 1.0, 0.3)


def _whoosh_up():
    n = int(0.55 * SR)
    e = np.linspace(0, 1, n) ** 2
    return lp(noise(n), 400)[:n] * 0 + hp(lp(noise(n), 3000), 400) * e * env(n, 0.05, 0.1, 1.0, 0.05)


def _whoosh_down():
    n = int(0.6 * SR)
    e = np.linspace(1, 0, n) ** 1.5
    return hp(lp(noise(n), 2500), 300) * e * env(n, 0.005, 0.1, 1.0, 0.1)


def _sweep():
    """rising FM zap for wipes"""
    n = int(0.4 * SR)
    f = np.linspace(200, 1800, n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.005, 0.1, 0.5, 0.15) * 0.6


def _blip():
    return fm(hz("A5"), 0.09, ratio=2, idx=1.5, adsr=(0.001, 0.05, 0.3, 0.03))


def _chime():
    return fm(hz("C6"), 1.2, ratio=3.01, idx=3, adsr=(0.001, 0.9, 0.0, 0.2), idx_decay=0.4) * 0.7


def _power():
    n = int(0.5 * SR)
    f = np.linspace(80, 900, n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.02, 0.2, 0.3, 0.2) * 0.6


def _glitch():
    n = int(0.18 * SR)
    x = np.sign(noise(n)) * (np.sin(2 * np.pi * 40 * t_(n)) > 0)
    return lp(x, 4000) * env(n, 0.001, 0.12, 0.2, 0.03)


def _ratchet():
    """a run of clicks, used for gear and pawl sounds"""
    out = np.zeros(int(0.5 * SR))
    for i in range(8):
        c = _clack() * 0.8
        s = int(i * 0.055 * SR)
        out[s:s + len(c)] += c[:max(0, len(out) - s)]
    return out


def _drop():
    n = int(0.5 * SR)
    f = 900 * np.exp(-t_(n) * 7) + 60
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.4, 0.0, 0.08)


def _tape():
    n = int(0.25 * SR)
    return hp(lp(noise(n), 2500), 500) * (0.5 + 0.5 * square(70, n)) * env(n, 0.005, 0.2, 0.3, 0.05) * 0.5


def _bell():
    return fm(hz("G5"), 2.0, ratio=2.76, idx=5, adsr=(0.001, 1.8, 0.0, 0.2), idx_decay=0.6) * 0.6


def _pencil():
    n = int(0.3 * SR)
    return hp(lp(noise(n), 6000), 2500) * (0.6 + 0.4 * np.sin(2 * np.pi * 22 * t_(n))) * env(n, 0.01, 0.2, 0.3, 0.06) * 0.6


def _page():
    n = int(0.35 * SR)
    return hp(lp(noise(n), 4500), 1200) * env(n, 0.03, 0.25, 0.1, 0.05) * 0.7


SFX = {"kick": _kick, "snare": _snare, "hat": _hat, "click": _click, "clack": _clack, "tick": _tick,
       "thunk": _thunk, "stamp": _stamp, "hit": _hit, "klaxon": _klaxon, "hum": _hum,
       "whoosh_up": _whoosh_up, "whoosh_down": _whoosh_down, "sweep": _sweep, "blip": _blip,
       "chime": _chime, "power": _power, "glitch": _glitch, "ratchet": _ratchet, "drop": _drop,
       "tape": _tape, "bell": _bell, "pencil": _pencil, "page": _page}
_cache = {}


def sfx_wave(name):
    if name not in SFX:
        raise KeyError(f"unknown SFX '{name}'")
    if name not in _cache:
        _cache[name] = SFX[name]()
    return _cache[name]


# ------------------------------------------------------------------ mixer
class Mix:
    def __init__(self, dur):
        self.dur = dur
        self.n = int(dur * SR)
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)
        self.cues = []

    def add(self, x, t, gain=1.0, pan=0.0):
        s = int(t * SR)
        if s < 0:
            x = x[-s:]
            s = 0
        if s >= self.n:
            return
        x = x[: self.n - s]
        gl = gain * math.cos((pan + 1) * math.pi / 4)
        gr = gain * math.sin((pan + 1) * math.pi / 4)
        self.L[s:s + len(x)] += x * gl
        self.R[s:s + len(x)] += x * gr

    def sfx(self, name, t, gain=1.0, pan=0.0):
        self.cues.append((round(t, 3), name))
        self.add(sfx_wave(name), t, gain, pan)

    def note(self, f, t, dur, gain=0.3, pan=0.0, ratio=2.0, idx=2.5, adsr=(0.004, 0.12, 0.5, 0.12), idx_decay=0.25):
        self.add(fm(f, dur, ratio, idx, adsr, idx_decay), t, gain, pan)

    def bass(self, f, t, dur, gain=0.35):
        n = int(dur * SR)
        x = (tri(f, n) * 0.7 + square(f, n, 0.25) * 0.25) * env(n, 0.005, 0.1, 0.7, 0.06)
        self.add(x, t, gain, 0.0)

    def lead(self, f, t, dur, gain=0.2, pan=0.15):
        n = int(dur * SR)
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t_(n))
        x = np.sign(np.sin(2 * np.pi * np.cumsum(f * vib * np.ones(n)) / SR + 0)) * 0.5
        x = lp(x, 3500) * env(n, 0.01, 0.1, 0.7, 0.08)
        self.add(x, t, gain, pan)

    def reverb(self, wet=0.18):
        """four feedback combs, vectorised per delay-length block (y[n] = x[n] + g*y[n-d])"""
        for arr in (self.L, self.R):
            acc = np.zeros_like(arr)
            for d_ms, g in ((29.7, 0.62), (37.1, 0.56), (41.1, 0.5), (43.7, 0.48)):
                d = int(d_ms * SR / 1000)
                y = arr.copy()
                for i in range(d, len(arr), d):
                    y[i:i + d] += g * y[i - d:i][: len(y[i:i + d])]
                acc += y
            arr += wet * acc / 4

    def stereo(self):
        return np.stack([self.L, self.R], axis=1)

    def peak(self):
        return float(max(np.abs(self.L).max(), np.abs(self.R).max()))


def write_wav(path, stereo):
    x = np.tanh(stereo * 0.9)          # soft limiter: loud hits saturate gently instead of hard-clipping
    pcm = (x * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def _measure(wav):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", wav, "-af",
                        "loudnorm=I=-14:TP=-1.5:LRA=20:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    txt = r.stderr
    j = txt[txt.rindex("{"):txt.rindex("}") + 1]
    return json.loads(j)


def normalise_and_mux(video_mp4, wav, out_mp4, note=""):
    """two-pass linear loudnorm to -14 LUFS / -1.5 dBTP, then mux (video copied)."""
    m = _measure(wav)
    af = ("loudnorm=I=-14:TP=-1.5:LRA=20:measured_I={i}:measured_TP={tp}:measured_LRA={lra}:"
          "measured_thresh={th}:offset={off}:linear=true:print_format=summary").format(
        i=m["input_i"], tp=m["input_tp"], lra=m["input_lra"], th=m["input_thresh"], off=m["target_offset"])
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video_mp4, "-i", wav, "-map", "0:v", "-map",
                        "1:a", "-c:v", "copy", "-af", af, "-c:a", "aac", "-b:a", "192k", "-shortest",
                        "-movflags", "+faststart", out_mp4], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr)
    return m


# ------------------------------------------------------------------ mastering (v2: buses, ducking, true limiter)
def envelope(x, att=0.03, rel=0.35):
    """smoothed abs envelope of a mono or stereo signal (moving averages; cheap)"""
    from scipy.ndimage import uniform_filter1d, maximum_filter1d
    a = np.abs(x).max(axis=1) if x.ndim == 2 else np.abs(x)
    a = maximum_filter1d(a, size=int(att * SR) * 2 + 1)
    return uniform_filter1d(a, size=int(rel * SR))


def duck(music, key, depth_db=5.0, thresh=0.02):
    """lower `music` by up to depth_db while `key` (voice bus) is active; smooth attack/release."""
    e = envelope(key)
    k = np.clip(e / (thresh * 3), 0, 1)                 # 0 = silent voice, 1 = speaking
    g = 10 ** (-depth_db * k / 20)
    return music * g[:, None]


def limit(x, ceiling_db=-2.0, look=0.015):
    """lookahead brickwall: gain = moving average of a min filter of the instantaneous gain (never above it)"""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    c = 10 ** (ceiling_db / 20)
    a = np.abs(x).max(axis=1)
    g = np.minimum(1.0, c / np.maximum(a, 1e-9))
    w = int(look * SR) * 2 + 1
    g = uniform_filter1d(minimum_filter1d(g, size=w), size=w)
    return x * g[:, None]


SFX_CLASS = {   # dB relative to the voice's speaking RMS; owner 2026-09-30: "some sfx are still overwhelming"
    "impact": -2.0, "accent": -9.0, "texture": -14.0,
}
SFX_KIND = {"hit": "impact", "stamp": "impact", "klaxon": "impact", "thunk": "impact",
            "whoosh_up": "accent", "whoosh_down": "accent", "sweep": "accent", "power": "accent", "drop": "accent",
            "tape": "accent", "pencil": "accent", "bell": "accent", "chime": "accent", "page": "accent",
            "hum": "texture", "tick": "texture", "blip": "texture", "click": "texture", "clack": "texture",
            "glitch": "texture", "ratchet": "texture"}


def loud_rms(x, win=0.1):
    """loudest 100 ms RMS of a mono cue (what the ear judges as 'how loud is that hit')"""
    n = max(1, int(win * SR))
    if len(x) <= n:
        return float(np.sqrt(np.mean(x ** 2)))
    c = np.cumsum(np.concatenate([[0.0], x ** 2]))
    return float(np.sqrt((c[n:] - c[:-n]).max() / n))


def cue_gain(name, voice_rms, trim_db=0.0):
    """gain that puts cue `name` at its class level against the voice. Unknown names raise."""
    kind = SFX_KIND[name]
    return voice_rms * 10 ** ((SFX_CLASS[kind] + trim_db) / 20) / max(loud_rms(sfx_wave(name)), 1e-9)


def _pcm(x):
    return (np.clip(x, -1, 1) * 32767).astype("<i2")


def write_pcm(path, stereo):
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(_pcm(stereo).tobytes())


def lufs(stereo, tmp):
    write_pcm(tmp, stereo)
    m = _measure(tmp)
    return float(m["input_i"]), float(m["input_tp"])


def master(stereo, tmp_wav, target=-14.0, ceiling_db=-2.0):
    """gain to target LUFS, then brickwall to ceiling; iterate so the limiter's loss is made up. Returns (x, report)."""
    x = stereo.copy()
    rep = []
    for _ in range(3):
        i, tp = lufs(x, tmp_wav)
        rep.append((round(i, 2), round(tp, 2)))
        if abs(i - target) < 0.2 and tp <= ceiling_db + 0.6:
            break
        x = limit(x * 10 ** ((target - i) / 20), ceiling_db)
    i, tp = lufs(x, tmp_wav)
    rep.append((round(i, 2), round(tp, 2)))
    return x, rep


def mux(video_mp4, wav, out_mp4, pad_to=None):
    """mux a mastered wav (no loudnorm; the mix is already at target). pad_to: extend video by holding last frame."""
    vf = ["-c:v", "copy"] if pad_to is None else ["-vf", f"tpad=stop_mode=clone:stop_duration={pad_to}",
                                                   "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p"]
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video_mp4, "-i", wav, "-map", "0:v", "-map", "1:a",
                        *vf, "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", out_mp4],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr)


# ------------------------------------------------------------------ music helpers
CHORDS = {
    "Am": ["A", "C", "E"], "F": ["F", "A", "C"], "C": ["C", "E", "G"], "G": ["G", "B", "D"],
    "Dm": ["D", "F", "A"], "Em": ["E", "G", "B"], "E": ["E", "G#", "B"], "Bb": ["Bb", "D", "F"],
    "Gm": ["G", "Bb", "D"], "Cm": ["C", "Eb", "G"], "Ab": ["Ab", "C", "Eb"], "Eb": ["Eb", "G", "Bb"],
    "Fm": ["F", "Ab", "C"], "Bm": ["B", "D", "F#"], "D": ["D", "F#", "A"], "A": ["A", "C#", "E"],
}


def chord_notes(ch, octave):
    names = CHORDS[ch]
    out = []
    o = octave
    prev = -1
    for nm in names:
        idx = "CDEFGAB".index(nm[0])
        if idx < prev:
            o += 1
        prev = idx
        out.append(hz(f"{nm}{o}"))
    return out


def bar_grid(bpm, start=0.0):
    beat = 60.0 / bpm
    return beat, lambda k: start + k * beat


def compose(mix, bpm, prog, sections, seed=1):
    """sections: list of dicts {t0,t1,layers:set,g:float}. One chord per bar, cycling prog.
    layers: pad bass arp lead kick snare hat pulse. Empty layers = near silence (allowed, explicit)."""
    rng = np.random.default_rng(seed)
    beat = 60.0 / bpm
    bar = 4 * beat
    motif = [int(x) for x in rng.integers(0, 3, 32)]
    for sec in sections:
        t0, t1, L, g = sec["t0"], sec["t1"], sec["layers"], sec.get("g", 1.0)
        b0 = int(t0 // bar)
        b1 = int(math.ceil(t1 / bar))
        for b in range(b0, b1):
            tb = b * bar
            ch = prog[b % len(prog)]
            lo = chord_notes(ch, 3)
            hi = chord_notes(ch, 4)
            top = chord_notes(ch, 5)
            root = lo[0] / 2
            def ok(t):
                return t0 <= t < t1
            if "pad" in L and ok(tb):
                for f in hi:
                    mix.note(f, tb, min(bar, t1 - tb) + 0.05, 0.05 * g, pan=rng.uniform(-0.5, 0.5), ratio=1.0, idx=0.8,
                             adsr=(0.25, 0.3, 0.7, 0.4), idx_decay=1.0)
            for k in range(8):
                t = tb + k * beat / 2
                if not ok(t):
                    continue
                if "bass" in L:
                    mix.bass(root if k % 4 != 3 else root * 1.5, t, beat / 2 * 0.9, 0.30 * g)
                if "hat" in L:
                    mix.add(sfx_wave("hat"), t, 0.10 * g * (1.0 if k % 2 else 0.6), pan=0.3)
            for k in range(16):
                t = tb + k * beat / 4
                if not ok(t):
                    continue
                if "arp" in L:
                    f = top[[0, 1, 2, 1][k % 4]] if k % 8 < 4 else hi[[2, 1, 0, 1][k % 4]] * 2
                    mix.note(f, t, beat / 4 * 0.9, 0.06 * g, pan=-0.4 if k % 2 else 0.4, ratio=2, idx=1.6,
                             adsr=(0.002, 0.05, 0.2, 0.03), idx_decay=0.08)
                if "pulse" in L and k % 4 == 0:
                    mix.add(sfx_wave("tick"), t, 0.18 * g, 0.0)
            for k in range(8):
                t = tb + k * beat / 2
                if ok(t) and "lead" in L and motif[(b * 8 + k) % 32] != 0 and k % 2 == 0:
                    f = top[motif[(b * 8 + k) % 32] % 3] if True else hi[0]
                    mix.lead(f, t, beat * 0.9, 0.09 * g)
            for k in range(4):
                t = tb + k * beat
                if not ok(t):
                    continue
                if "kick" in L and k in (0, 2):
                    mix.add(sfx_wave("kick"), t, 0.55 * g, 0.0)
                if "snare" in L and k in (1, 3):
                    mix.add(sfx_wave("snare"), t, 0.32 * g, 0.0)
