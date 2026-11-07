"""vo: voice lines -> trimmed wav + lip-sync envelope + mouth shapes. Three backends, one interface:

    vo.line(text, voice="af_heart")                  Kokoro-82M neural TTS, local CPU (Apache-2.0). English default.
    vo.line(ja_text, voice="clone", lang="ja")      your own GPT-SoVITS clone on Modal (optional, BYO)
    vo.line(text)                                    Windows SAPI Zira, pitched: offline fallback only (owner found
                                                     it robotic, 2026-09-30); never the first choice
Every line is cached by content hash under $KEYNOTE_CACHE/vo. The author cannot hear audio: report measurements
(duration, level); taste is the owner's call. See skills/retro-pixel/references/05-sound.md.
"""
import hashlib, os, re, subprocess, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_ROOT = os.environ.get("KEYNOTE_CACHE", os.path.join(os.environ.get("LOCALAPPDATA", HERE), "keynote-cache"))
CACHE = os.path.join(CACHE_ROOT, "vo")          # outside the skill folder: skills are synced, caches are not
os.makedirs(CACHE, exist_ok=True)

# things a TTS engine would mangle -> what to say. Word-boundary, case-sensitive.
SAY = [
    (r"\bPF\b", "profit factor"), (r"\bDD\b", "drawdown"), (r"\bOOS\b", "out of sample"),
    (r"\bSEL\b", "selection"), (r"\bER\b", "efficiency ratio"), (r"\bATR\b", "A T R"),
    (r"\bRR\b", "reward to risk"), (r"\bMT5\b", "M T 5"), (r"\bUTC\b", "U T C"), (r"\bEDT\b", "E D T"),
    (r"\bEST\b", "E S T"), (r"\bNY\b", "New York"), (r"\bUSDJPY\b", "U S D J P Y"),
    (r"\bUSDCHF\b", "U S D C H F"), (r"\bBTC\b", "Bitcoin"), (r"\bXAU\b", "gold"),
    (r"\bXAUUSD\b", "gold"), (r"\bM15\b", "fifteen minute"), (r"\bSHA-256\b", "S H A 256"),
    (r"\bVPS\b", "V P S"), (r"\bEA\b", "E A"), (r"\bN\b", "trade count"),
    (r"(\d)%", r"\1 percent"), (r"\bx(\d)", r"times \1"), (r"\bR\b", "R"),
]


def spoken(text):
    s = text
    for pat, rep in SAY:
        s = re.sub(pat, rep, s)
    return s


def _tts(text, wav, rate=2):
    txt = os.path.join(CACHE, "in.txt")
    with open(txt, "w", encoding="utf8") as f:
        f.write(text)
    ps = os.path.join(CACHE, "say.ps1")
    with open(ps, "w", encoding="utf8") as f:
        f.write(
            "param($in,$out)\n"
            "Add-Type -AssemblyName System.Speech\n"
            "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer\n"
            "$s.SelectVoice('Microsoft Zira Desktop')\n"
            f"$s.Rate = {rate}\n"
            "$s.SetOutputToWaveFile($out)\n"
            "$s.Speak([IO.File]::ReadAllText($in))\n"
            "$s.Dispose()\n")
    r = subprocess.run(["pwsh", "-NoProfile", "-File", ps, txt, wav], capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(wav):
        raise RuntimeError("tts failed: " + r.stderr)


KOKORO_DIR = os.environ.get("KOKORO_DIR", os.path.expanduser("~/models/kokoro"))   # kokoro-v1.0.onnx + voices-v1.0.bin
_KK = []


def _kokoro():
    if not _KK:
        from kokoro_onnx import Kokoro
        _KK.append(Kokoro(os.path.join(KOKORO_DIR, "kokoro-v1.0.onnx"), os.path.join(KOKORO_DIR, "voices-v1.0.bin")))
    return _KK[0]


def _style(k, voice):
    """'af_heart' or a blend 'af_heart:0.6+jf_alpha:0.4' (weights normalised)."""
    parts = []
    for p in voice.split("+"):
        name, _, w = p.partition(":")
        parts.append((name, float(w or 1)))
    tot = sum(w for _, w in parts)
    return sum(k.get_voice_style(n) * (w / tot) for n, w in parts)


def _tts_kokoro(text, wav, voice, speed, lang):
    import soundfile as sf
    k = _kokoro()
    x, sr = k.create(text, voice=_style(k, voice), speed=speed, lang=lang)
    sf.write(wav, x, sr)


MODAL_EXE = os.environ.get("MODAL_EXE", "modal")
# optional private Japanese voice clone (bring your own; keep it internal): a `modal run` script taking --req
CLONE = os.environ.get("CLONE_MODAL_SCRIPT")  # path to YOUR `modal run` script; see references/05-sound.md


def _key(text, pitch, speed, rate, voice, lang):
    return hashlib.sha1(f"{text}|{pitch}|{speed}|{rate}|{voice}|{lang}".encode()).hexdigest()[:12]


def prefetch_clone(texts, seed=7):
    """synthesise uncached Japanese lines in ONE Modal session (one cold start). voice id 'clone'."""
    import json as _json
    todo = []
    for t in texts:
        k = _key(t, 1.16, 1.0, 2, "clone", "ja")
        out = os.path.join(CACHE, f"{k}.wav")
        if not os.path.exists(out):
            todo.append({"text": t, "out": os.path.join(CACHE, f"{k}_raw.wav"), "seed": seed, "final": out})
    if not todo:
        return []
    if not CLONE:
        raise RuntimeError("voice='clone' needs CLONE_MODAL_SCRIPT set to your own modal run script")
    req = os.path.join(CACHE, "clone_req.json")
    with open(req, "w", encoding="utf8") as f:
        _json.dump(todo, f, ensure_ascii=False)
    r = subprocess.run([MODAL_EXE, "run", CLONE, "--req", req], capture_output=True, text=True, encoding="utf8",
                       errors="replace", env=dict(os.environ, PYTHONIOENCODING="utf-8"),
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if r.returncode != 0:
        raise RuntimeError("clone synth failed: " + r.stderr[-1500:])
    res = _json.loads([ln for ln in r.stdout.splitlines() if ln.startswith("[{")][-1])
    for item, rr in zip(todo, res):
        if rr["jp"].strip() != item["text"].strip():
            print(f"  warning: server rewrote the line: {item['text']!r} -> {rr['jp']!r}")
        af = ("silenceremove=start_periods=1:start_threshold=-50dB,areverse,"
              "silenceremove=start_periods=1:start_threshold=-50dB,areverse")
        p = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", item["out"], "-af", af, "-ac", "1", "-ar", "44100",
                            item["final"]], capture_output=True, text=True)
        if p.returncode != 0:
            raise RuntimeError(p.stderr)
        os.remove(item["out"])
    return res


def line(text, pitch=1.16, speed=1.06, rate=2, tag="", voice=None, lang="en-us"):
    """returns dict(wav, dur, env30, text). cached by content hash.
    voice=None: SAPI Zira pitched (legacy). voice='af_heart' etc: Kokoro neural TTS, unpitched (pitch ignored)."""
    key = hashlib.sha1(f"{text}|{pitch}|{speed}|{rate}|{voice}|{lang}".encode()).hexdigest()[:12]
    out = os.path.join(CACHE, f"{key}.wav")
    if voice == "clone" and not os.path.exists(out):
        prefetch_clone([text])
    if voice and voice != "clone" and not os.path.exists(out):
        raw = os.path.join(CACHE, f"{key}_raw.wav")
        _tts_kokoro(spoken(text), raw, voice, speed, lang)
        af = ("silenceremove=start_periods=1:start_threshold=-50dB,areverse,"
              "silenceremove=start_periods=1:start_threshold=-50dB,areverse")
        r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", af, "-ac", "1", "-ar", "44100",
                            out], capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError(r.stderr)
        os.remove(raw)
    if not os.path.exists(out):
        raw = os.path.join(CACHE, f"{key}_raw.wav")
        _tts(spoken(text), raw, rate)
        # pitch/formant up by asetrate, restore tempo, trim silence, gentle brighten
        af = (f"asetrate=22050*{pitch},aresample=44100,atempo={speed / pitch:.4f},"
              "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,"
              "highshelf=f=3500:g=3,volume=1.0")
        r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", af, "-ac", "1", "-ar", "44100",
                            out], capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError(r.stderr)
        os.remove(raw)
    with wave.open(out) as w:
        n = w.getnframes()
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768
    dur = n / sr
    hop = sr // 30
    frames = int(np.ceil(len(x) / hop))
    env = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2)) if i * hop < len(x) else 0 for i in range(frames)])
    if env.max() > 0:
        env = env / np.percentile(env, 95)
    return {"wav": out, "dur": dur, "env30": np.clip(env, 0, 1), "text": text, "x": x}


MOUTH_FPS = 10          # owner 2026-09-30: per-frame lip motion read as "eerily higher fps" than the PC-98 picture


def mouth(v, t):
    """mouth shape at local time t: 0 closed, 0.5 half, 1 open. Anime-style lip flaps: three shapes, changed at
    MOUTH_FPS from the mean voice level over each step (not a per-frame envelope)."""
    if t < 0:
        return 0.0
    step = 30 // MOUTH_FPS
    i0 = int(t * MOUTH_FPS) * step
    seg = v["env30"][i0:i0 + step]
    if len(seg) == 0:
        return 0.0
    e = float(seg.mean())
    return 1.0 if e > 0.55 else 0.5 if e > 0.2 else 0.0
