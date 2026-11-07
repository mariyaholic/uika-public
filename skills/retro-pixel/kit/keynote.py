"""keynote: the pipeline plumbing every keynote shares, with the the reference film lessons (2026-09-30) enforced as code.

A video script declares a palette, an evidence table, voice lines, scene functions and cues; this module owns timing,
captions, the presenter face, the audio buses, the checks and the render. What it enforces (each was a real defect):
- scenes start on bar lines (cuts land on downbeats; music sections follow scenes)          [assert]
- every voice line fits its scene with >= 0.4 s to spare                                    [assert]
- impacts (hit/stamp/klaxon/thunk) never sit on a voice line                                [GuardError]
- stamps that follow a line are timed from the line's end (after_line) and must fit         [assert]
- every SFX cue is levelled by class against the voice (sfx.SFX_CLASS), never a raw gain     [sfx.cue_gain]
- music is an arranged cue (score.py), levelled 3.5 dB under the voice and ducked under it   [build_audio]
- the ending rings out; the last 1.2 s eases to silence                                      [build_audio]
- every frame passes the guards in a dry run BEFORE encoding; the preview frame count is checked after
  (a render once died silently at frame ~2977 and left a stale final behind)                 [render]

    K = Keynote("demo", __file__, PAL, evidence="evidence.json", bpm=120)
    K.lines(["English line 0", ...], voice="af_heart")          # or ja=[...], voice="clone"
    K.scene("open", 4, s1, out=("shutter", 10), line=0, vstart=1.5, music="intro")
    ...
    K.scene("card", 3, s9, line=5, vstart=1.0, music="ending", ring=3.5)   # last scene: bars + ring-out
    K.host = presenter(PAL, "bust.png", 100)                     # optional
    K.cues = lambda c, st: (c("stamp", st[0] + 1.0), ...)         # c(name, t, trim_db=0, pan=0)
    K.main()                                                     # frames T.. | dryrun | audio | render
"""
import json, os, subprocess, sys
import numpy as np
from pxkit import *
from kit import msgbox, wrap_px, blink_at
import vo, sfx, score

IMPACTS = {"hit", "stamp", "klaxon", "thunk"}


class Keynote:
    def __init__(self, name, script, pal, evidence, bpm=120):
        self.name, self.pal = name, pal
        self.here = os.path.dirname(os.path.abspath(script))
        self.out = os.path.join(self.here, "out")
        os.makedirs(self.out, exist_ok=True)
        self.ev = use_evidence(evidence if os.path.isabs(evidence) else os.path.join(self.here, evidence))
        self.bar = 4 * 60.0 / bpm
        self.bpm = bpm
        self.sc = []            # dicts: name bars fn out line vstart music ring
        self.host = None
        self.cues = None
        self.lut_fn = None
        self.V = None
        self.speaker = "HOST"

    # ------------------------------------------------------------ voice
    def lines(self, en, ja=None, voice="af_heart", speed=1.0):
        """en: what the viewer reads (evidence-guarded). ja: what is spoken, if the voice speaks Japanese."""
        for s in en:
            self.ev.check_text(s)
        self.en = en
        if ja is not None:
            if len(ja) != len(en):
                raise GuardError("every English line needs its spoken Japanese twin")
            if voice == "clone":
                vo.prefetch_clone(ja)            # one Modal session for all lines
            self.vox = [vo.line(s, voice=voice, speed=speed, lang="ja") for s in ja]
        else:
            self.vox = [vo.line(s, voice=voice, speed=speed) for s in en]
        return self.vox

    # ------------------------------------------------------------ timeline
    def scene(self, name, bars, fn, out=("cut", 0), line=None, vstart=1.0, music="groove", ring=None):
        self.sc.append(dict(name=name, bars=bars, fn=fn, out=out, line=line, vstart=vstart, music=music, ring=ring))

    def build(self):
        n = len(self.sc)
        if n == 0:
            raise GuardError("no scenes")
        self.dur = []
        for i, s in enumerate(self.sc):
            if i < n - 1:
                self.dur.append(s["bars"] * self.bar + s["out"][1] / FPS)
            else:
                self.dur.append(s["bars"] * self.bar + (s["ring"] or 0.0))
        scenes = [Scene(s["name"], self.dur[i], s["fn"], s["out"] if i < n - 1 else ("cut", 0))
                  for i, s in enumerate(self.sc)]
        self.V = Video(self.name, self.pal, scenes)
        self.V.lut_fn = self.lut_fn
        for i in range(n - 1):
            want = sum(s["bars"] for s in self.sc[:i + 1]) * self.bar
            assert abs(self.V.starts[i + 1] - want) < 1e-6, "scene starts must sit on bar lines"
        for i, s in enumerate(self.sc):
            if s["line"] is not None:
                d = self.vox[s["line"]]["dur"]
                assert s["vstart"] + d < self.dur[i] - 0.4, \
                    f"voice {s['line']} ({d:.1f}s) overruns scene {s['name']} ({self.dur[i]:.1f}s): add bars or cut words"
        return self.V

    def after_line(self, i, pad=0.3):
        """scene-local time just after scene i's line ends: where a verdict stamp may land"""
        s = self.sc[i]
        t = s["vstart"] + self.vox[s["line"]]["dur"] + pad
        assert t < self.dur[i] - 0.9, f"no room after the line in scene {s['name']}"
        return t

    # ------------------------------------------------------------ on-screen helpers for scene functions
    def say(self, cv, t, i, box=(8, 296, 632, 354), hold=0.8):
        """VN message window typing scene i's English line over the spoken duration (either language)."""
        s = self.sc[i]
        k = s["line"]
        v = self.vox[k]
        t0 = s["vstart"]
        text = self.en[k]
        size = 16 if len(wrap_px(text, box[2] - box[0] - 24, 16)) <= 2 else 12
        if t < t0 or t > t0 + v["dur"] + hold:
            msgbox(cv, *box, self.speaker, "", 0.0, face="navy")
            return
        # guard=False: the whole line was checked at lines(); a typed prefix of "544" reads "54"
        msgbox(cv, *box, self.speaker, text, (t - t0) / (v["dur"] * 0.92), face="navy", size=size, guard=False)

    def face(self, cv, t, i, x=524, y=28):
        s = self.sc[i]
        m = 0.0
        if s["line"] is not None:
            v = self.vox[s["line"]]
            tt = t - s["vstart"]
            m = vo.mouth(v, tt) if 0 <= tt <= v["dur"] else 0.0
        self.host.window(cv, x, y, m, blink_at(t))

    # ------------------------------------------------------------ audio
    def build_audio(self):
        V, st = self.V, self.V.starts
        voice, fx = sfx.Mix(V.total), sfx.Mix(V.total)
        spans = []
        for i, s in enumerate(self.sc):
            if s["line"] is not None:
                v = self.vox[s["line"]]
                voice.add(v["x"], st[i] + s["vstart"], 1.0)
                spans.append((st[i] + s["vstart"], st[i] + s["vstart"] + v["dur"]))
        vs = voice.stereo()
        active = sfx.envelope(vs) > 0.02
        if not active.any():
            raise GuardError("no voice: the keynote has no narration")
        v_rms = float(np.sqrt(np.mean(vs[active] ** 2)))

        def c(name, t, trim_db=0.0, pan=0.0):
            fx.sfx(name, t, sfx.cue_gain(name, v_rms, trim_db), pan)

        if self.cues is None:
            raise GuardError("no cue function: every keynote needs SFX cues")
        self.cues(c, st)
        if len(fx.cues) < 8:
            raise GuardError(f"cue list too thin ({len(fx.cues)})")
        for tc, name in fx.cues:
            if name in IMPACTS:
                for a, b in spans:
                    if a - 0.1 < tc < b:
                        raise GuardError(f"impact {name}@{tc:.2f} lands on voice {a:.2f}-{b:.2f}")
        plan = [(s["bars"], s["music"]) for s in self.sc]
        mus, _ = score.cue(plan, bpm=self.bpm)
        mus = mus[: voice.n] if len(mus) >= voice.n else np.pad(mus, ((0, voice.n - len(mus)), (0, 0)))
        mus = mus * (v_rms / float(np.sqrt(np.mean(mus ** 2)))) * 10 ** (-3.5 / 20)
        mus = sfx.duck(mus, vs, depth_db=5.5)
        fxs = fx.stereo()
        rev = sfx.Mix(V.total)
        rev.L[:], rev.R[:] = fxs[:, 0], fxs[:, 1]
        rev.reverb(0.15)
        mix = vs + mus + rev.stereo()
        nf = int(1.2 * sfx.SR)
        mix[-nf:] *= np.linspace(1, 0, nf)[:, None] ** 2
        return mix, fx.cues

    # ------------------------------------------------------------ checks and render
    def dryrun(self, audit_every=3):
        V = self.V
        for f in range(V.n_frames()):
            V.frame(f, audit=(f % audit_every == 0))
        print(f"dry run ok: {V.n_frames()} frames through the guards")

    def _count_frames(self, path):
        r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries",
                            "stream=nb_read_packets", "-of", "csv=p=0", path], capture_output=True, text=True)
        return int(r.stdout.strip() or 0)

    def render(self):
        V = self.V
        self.dryrun()
        prev = os.path.join(self.out, self.name + "_preview_silent.mp4")
        render_silent(V, prev)
        got = self._count_frames(prev)
        if got != V.n_frames():
            raise GuardError(f"preview has {got} frames, expected {V.n_frames()}: the render died; the old final "
                             f"(if any) is stale")
        mix, cues = self.build_audio()
        x, rep = sfx.master(mix, os.path.join(self.out, "_tmp.wav"))
        os.remove(os.path.join(self.out, "_tmp.wav"))
        wav = os.path.join(self.out, self.name + ".wav")
        sfx.write_pcm(wav, x)
        final = os.path.join(self.out, self.name + ".mp4")
        sfx.mux(prev, wav, final)
        meta = {"name": self.name, "total": V.total, "beat_table": V.table, "figures_used": sorted(self.ev.used),
                "cues": cues, "master_lufs_dbtp": rep,
                "lines": [{"text": s, "dur": round(v["dur"], 2)} for s, v in zip(self.en, self.vox)]}
        with open(os.path.join(self.out, self.name + ".meta.json"), "w", encoding="utf8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=1)
        print("master passes (LUFS, dBTP):", rep)
        print(f"next: uika video qa {final} --expect-duration {V.total:.2f} --against {prev}; then look (video sheet)")

    def main(self):
        if self.V is None:
            self.build()
        cmd = sys.argv[1] if len(sys.argv) > 1 else "render"
        print("scenes:", [(n, round(a, 2), round(b, 2)) for n, a, b in self.V.table], "total", round(self.V.total, 2))
        print("voice:", [round(v["dur"], 2) for v in self.vox])
        if cmd == "frames":
            for t in [float(x) for x in sys.argv[2:]]:
                p = os.path.join(self.out, f"f_{t:05.1f}.png")
                dump_frame(self.V, t, p)
                print("wrote", p)
        elif cmd == "dryrun":
            self.dryrun()
        elif cmd == "audio":
            mix, _ = self.build_audio()
            x, rep = sfx.master(mix, os.path.join(self.out, "_tmp.wav"))
            os.remove(os.path.join(self.out, "_tmp.wav"))
            sfx.write_pcm(os.path.join(self.out, self.name + ".wav"), x)
            print("master passes (LUFS, dBTP):", rep)
        elif cmd == "render":
            self.render()
        else:
            raise SystemExit("usage: frames T.. | dryrun | audio | render")
