"""template_keynote: the smallest complete PC-98 keynote on the kit. Copy this file into a project folder, then grow it.

It is a smoke test of the whole pipeline (evidence lock, voice, bar-locked scenes, captions, a MiKTeX formula,
class-levelled SFX, arranged score, master, dry run, render). It runs ~34 s; a real keynote is >= 60 s with one
graphic per claim and one honest negative (skills/video-pipeline). No private assets: no presenter by default.

    python template_keynote.py frames 3 10 20     # PNGs of chosen moments (x2) into ./out
    python template_keynote.py dryrun             # every frame through the guards, no encoding
    python template_keynote.py render             # dry run, silent preview, audio, master, mux -> ./out/<name>.mp4
Then: uika video qa out/template_demo.mp4 --expect-duration <total> --against out/template_demo_preview_silent.mp4
"""
import math, os, random, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get("RETRO_KIT", os.path.join(HERE, "..", "kit")))
from pxkit import *
from kit import frame2, stamp_text, shake, wrap_px
from keynote import Keynote
from texsprite import tex_mask, draw_mask
import vo

# ---------------------------------------------------------------- 1. palette: 16 named slots, decided up front
PAL = Pal([("black", "#000000"), ("white", "#f8f8ff"), ("navy", "#0a1040"), ("sea", "#1848a0"),
           ("seahi", "#50a0f0"), ("lamp", "#ffc820"), ("red", "#e02038"), ("dred", "#6a1020"),
           ("gray", "#9098b8"), ("dgray", "#585c68"), ("beam", "#fff0a0"), ("green", "#30c070")])

K = Keynote("template_demo", __file__, PAL, evidence="evidence_template.json", bpm=120)
EV = K.ev

# ---------------------------------------------------------------- 2. lines: what the viewer reads (guarded)
VOICE = os.environ.get("KEYNOTE_VOICE", "af_heart" if os.path.exists(os.path.join(vo.KOKORO_DIR, "voices-v1.0.bin"))
                       else None)
K.lines([
    "This is the pipeline, end to end. Every number you see comes from one table.",
    f"Profit factor {EV.fig('demo.pf')} over {EV.fig('demo.n')} trades. The number lands first; I read it after.",
    "Size grows slower than the account. The formula is typeset, then drawn.",
    "Demonstration only. Nothing here describes a real system.",
], voice=VOICE)

random.seed(7)
STARS = [(random.randrange(0, W), random.randrange(0, 250), random.random() * 6) for _ in range(60)]


def sky(cv, t):
    cv.grad_v(0, 0, W, 290, "black", "navy")
    for (x, y, ph) in STARS:
        cv.px(x, y, "white" if int(t * 1.5 + ph) % 3 else "gray")


# ---------------------------------------------------------------- 3. scenes (scene-local time t)
def s_title(cv, t, _):
    sky(cv, t)
    if t >= 0.6:                                   # the stamp lands before the voice starts (impact off voice)
        dx, dy = shake(t - 0.6, 3)
        stamp_text(cv, 320 + dx, 110 + dy, "KEYNOTE", "red", size=16, scale=5, angle=-4, bg="black")
        cv.text(320, 170, "PC-98 PIPELINE DEMO", "lamp", size=12, anchor="c", tag="label", guard=False)  # a name, not a figure
    K.say(cv, t, 0)


HERO_T = 0.4


def s_number(cv, t, _):
    sky(cv, t)
    if t >= HERO_T:                                # number first, voice after (vstart 1.4)
        dx, dy = shake(t - HERO_T, 5, decay=0.7)
        cv.text(24 + dx, 20 + dy, "PROFIT FACTOR", "lamp", size=16, scale=2, tag="label", guard=False, bold=True)
        cv.text(24 + dx, 60 + dy, EV.fig("demo.pf"), "white", size=16, scale=6, prop=False, shadow="red", tag="data")
        g = ease_out(clamp((t - HERO_T) / 0.8))
        cv.rect(300, 90, 300 + int(260 * g), 104, fill="green", track=False)
        cv.text(300, 70, f"{EV.fig('demo.n')} trades · {EV.fig('demo.dd')} drawdown", "white", size=12, tag="data")
    if t >= VERDICT:
        dx, dy = shake(t - VERDICT, 4)
        stamp_text(cv, 430 + dx, 200 + dy, "LOCKED", "lamp", size=16, scale=3, angle=-3, bg="black")
    K.say(cv, t, 1)


FORMULA = tex_mask(r"\text{size}\;=\;\left(\frac{\text{balance}}{10000}\right)^{0.5}", dpi=140)


def s_formula(cv, t, _):
    cv.rect(0, 0, W, H, fill="black", track=False)
    frame2(cv, 5, 5, 635, 288, fill="black")
    draw_mask(cv, FORMULA, 24, 16, "white", reveal=clamp((t - 0.3) / 1.2), shadow="sea")
    x0, x1, y0, y1 = 60, 600, 110, 270
    cv.line(x0, y0, x0, y1, "gray")
    cv.line(x0, y1, x1, y1, "gray")
    g = ease_io(clamp((t - 1.8) / 5.0))
    if t >= 1.8:
        pts = [(x0 + (x1 - x0) * u, y1 - (y1 - y0) * math.sqrt(u)) for u in np.linspace(0, g, 60)]
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            cv.line(xa, ya, xb, yb, "lamp", 2)
        cx, cy = pts[-1]
        cv.ellipse(cx - 3, cy - 3, cx + 3, cy + 3, fill="beam", outline="white")
    K.say(cv, t, 2)


DISC = wrap_px(EV.fig("disc.demo"), 600, 12)


def s_card(cv, t, _):
    sky(cv, t)
    if t >= 0.3:
        dx, dy = shake(t - 0.3, 3)
        cv.text(320 + dx, 90 + dy, "ESTATE", "white", size=16, scale=3, anchor="c", shadow="lamp", bold=True)
    frame2(cv, 4, 262, 636, 358, fill="black")
    for i, ln in enumerate(DISC):
        cv.text(12, 268 + i * 14, ln, "gray", size=12, tag="caption", guard=False)
    if t >= 0.8:                                   # the last line has no message box: the card is the caption
        tag = K.en[3]
        n = int(len(tag) * clamp((t - 0.8) / (K.vox[3]["dur"] * 0.9)))
        cv.text(320, 150, tag[:n], "beam", size=12, anchor="c", tag="caption", guard=False)


# ---------------------------------------------------------------- 4. timeline: bars, transitions, lines, music
K.scene("title", 4, s_title, out=("shutter", 10), line=0, vstart=1.4, music="intro")
K.scene("number", 5, s_number, out=("mosaic", 12), line=1, vstart=1.4, music="groove")
K.scene("formula", 5, s_formula, out=("wipe_r", 10), line=2, vstart=1.2, music="build")
K.scene("card", 3, s_card, line=3, vstart=0.8, music="ending", ring=3.5)
K.build()
VERDICT = K.after_line(1)                          # the verdict stamp lands after the line ends


# ---------------------------------------------------------------- 5. cues: names + times only; levels come from class
def cues(c, st):
    c("hum", 0.0); c("sweep", 0.3); c("stamp", st[0] + 0.6 - 0.02)
    c("whoosh_up", st[1] + HERO_T - 0.45); c("hit", st[1] + HERO_T); c("bell", st[1] + HERO_T + 0.03, -3)
    c("stamp", st[1] + VERDICT - 0.02)
    c("pencil", st[2] + 0.3); c("blip", st[2] + 1.8); c("chime", st[2] + 6.8, -3)
    c("stamp", st[3] + 0.3 - 0.02, -3)


K.cues = cues

if __name__ == "__main__":
    K.main()
