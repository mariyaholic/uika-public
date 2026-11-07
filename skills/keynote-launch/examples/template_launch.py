"""template_launch: the smallest complete modern launch keynote on launchkit (ADR-0031). Copy it into a project folder, then grow it.

A smoke test of the whole look: evidence lock, one technique per scene, eight studied transitions, a music bed
with an arc, accent cues on hero beats only, master to -14 LUFS, mux. It runs 54 s with no voice and no
footage; procedural "b-roll" stands in where real footage would go. A real keynote has a narrator
(skills/retro-pixel/kit/vo.py) and is >= 60 s with one graphic per claim (skills/video-pipeline).

    python template_launch.py frames 3 12 20 30     # PNGs of chosen seconds into ./out
    python template_launch.py dryrun                # every frame rendered, strings guarded, no encoding
    python template_launch.py render                # silent preview + audio + master + mux -> ./out/launch_demo.mp4
Then: uika video qa out/launch_demo.mp4 --expect-duration 54 --against out/launch_demo_preview_silent.mp4
"""
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get("LAUNCH_KIT", os.path.join(HERE, "..", "kit")))
sys.path.insert(0, os.environ.get("RETRO_KIT", os.path.join(HERE, "..", "..", "retro-pixel", "kit")))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import launchkit as K
import sfx                                   # audio comes from the PC-98 kit: Mix, master, mux (see 05-sound.md)

NAME = "launch_demo"
OUT = os.path.join(os.getcwd(), "out")
EV = K.Evidence(os.path.join(HERE, "evidence_template.json"))
G = EV.guard                                 # every string with digits passes through G()
STU, STG, FLD = K.THEMES["studio"], K.THEMES["stage"], K.THEMES["field"]
W, H, FPS = K.W, K.H, K.FPS


def bg(c):
    return Image.new("RGB", (W, H), c)


# ---------------------------------------------------------------- procedural b-roll (stand-in for real footage)
_YY, _XX = np.mgrid[0:108, 0:192] / 108.0


def broll(t, warm=True):
    """slow drifting light blobs at 192x108, upscaled: reads as defocused footage, owns no rights problem"""
    img = np.zeros((108, 192, 3), np.float32)
    cols = [(255, 170, 90), (230, 90, 60), (255, 220, 160), (120, 60, 140)] if warm else \
           [(60, 120, 255), (30, 200, 220), (160, 120, 255), (20, 40, 90)]
    for i, c in enumerate(cols):
        cx = 0.9 + 0.7 * math.sin(0.21 * t + i * 1.7); cy = 0.5 + 0.3 * math.cos(0.17 * t + i * 2.3)
        g = np.exp(-(((_XX - cx) ** 2 + (_YY - cy) ** 2) / (0.12 + 0.05 * i)))
        img += g[..., None] * np.array(c, np.float32) * 0.8
    img = np.clip(img + 18, 0, 255).astype(np.uint8)
    small = Image.fromarray(img).filter(ImageFilter.GaussianBlur(1.2))   # blur at 192x108, not at 1080p
    return small.resize((W, H), Image.BICUBIC)


# ---------------------------------------------------------------- scenes: f(t) with scene-local seconds (t may be <0 or >dur)
def s_cold(t):
    """dark stage, giant word wall drifting behind, the line lands word by word (Build type wall + Apple kinetic)"""
    img = bg(STG["bg"])
    K.type_wall(img, "KEEPER", t, (26, 28, 34), size=560)
    K.text(img, (W / 2, 400), "DEMO BRAND  ·  DEMO", "text_b", 30, STG["sub"], anchor="ms", tracking=6,
           alpha=K.seg(t, 0.3, 1.0))
    K.kinetic_words(img, ["Meet", "the", "keeper."], (W / 2, 600), t - 0.9, size=170, fill=STG["ink"],
                    anchor="ms", accent=2, accent_fill=STG["accent"])
    return img


def s_kpis(t):
    """KPIs ride on b-roll (Tesla Investor Day 'Holistic Charging Experience'), DJI bug + feature caption"""
    img = K.scrim(broll(t + 10), 420, 1080, strength=0.78)
    K.bug(img, "KEEPER ONE")
    K.kinetic_words(img, ["Built", "to", "run", "for", "a", "decade."], (96, 300), t - 0.3, size=96,
                    fill=(255, 255, 255), stagger=0.09)
    items = []
    for key, cap in (("kpi.uptime", "uptime"), ("kpi.sites", "sites served"), ("kpi.water", "less water per unit")):
        v, dec, pre, suf = EV.num(key)
        items.append((v, dec, pre, suf, cap))
    K.kpi_row(img, items, t - 1.4, y=760, size=140)
    if t > 4.6:
        K.lower_caption(img, "Closed loop", G(f"{EV.fig('kpi.water')} less water per unit than the last model"), t - 4.6)
    return img


def _entity(x0, y0, dx, dy, r, g):
    return {"x": lambda yr: x0 + dx * (yr - 2015), "y": lambda yr: y0 + dy * (yr - 2015), "r": lambda yr: r, "g": g}


BUBBLES = {"Keeper": _entity(0.15, 0.20, 0.060, 0.065, 46, 3), "A": _entity(0.30, 0.35, 0.012, 0.010, 38, 0),
           "B": _entity(0.55, 0.30, 0.008, 0.018, 30, 1), "C": _entity(0.70, 0.55, -0.010, 0.012, 54, 2),
           "D": _entity(0.40, 0.60, 0.015, -0.006, 26, 4), "E": _entity(0.80, 0.25, -0.006, 0.020, 34, 5)}


def s_bubbles(t):
    """Rosling: the year is the clock behind the data, one entity leaves a trail (TED hVimVzgtD6w)"""
    img = bg((250, 250, 248))
    yr = 2015 + 10 * K.ease_io(K.seg(t, 1.2, 7.6))
    K.kinetic_words(img, ["Ten", "years,", "one", "direction."], (160, 120), t - 0.2, size=64, fill=STU["ink"],
                    stagger=0.1)
    K.bubble_chart(img, (220, 190, 1700, 940), BUBBLES, yr, t_in=K.seg(t, 0.3, 1.1),
                   trail=("Keeper", [2015 + i * 0.5 for i in range(21)]), axis=("cost per unit", "efficiency"),
                   xlim=(0, 1), ylim=(0, 1))
    K.text(img, (1700, 1030), "Illustrative motion. Figures live in the evidence table.", "text", 24, STU["sub"],
           anchor="rs")
    return img


YEARS = [2020, 2025, 2030, 2035, 2040, 2045, 2050]


def _ramp(a, b):
    return [a + (b - a) * i / (len(YEARS) - 1) for i in range(len(YEARS))]


# derived rows must equal their arithmetic: a stale evidence row fails here, not on screen
_f = lambda k: float(EV.fig(k))
for key, val in (("wedge.after_eff", _f("wedge.bau2050") - _f("wedge.eff2050")),
                 ("wedge.after_ren", _f("wedge.bau2050") - _f("wedge.eff2050") - _f("wedge.ren2050")),
                 ("wedge.net2050", _f("wedge.bau2050") - _f("wedge.eff2050") - _f("wedge.ren2050") - _f("wedge.loop2050"))):
    assert abs(_f(key) - val) < 1e-6, f"evidence row {key} = {_f(key)} but its arithmetic gives {val:.3f}"


def s_wedges(t):
    """Al Gore wedges: baseline, then one reduction wedge per beat (TED rDiGYuQicpA)"""
    img = bg(STG["bg"])
    K.text(img, (160, 130), "Closing the gap", "display", 84, STG["ink"], alpha=K.seg(t, 0, 0.5))
    K.text(img, (160, 236), "emissions, Gt per year (demo data)", "text", 30, STG["sub"], alpha=K.seg(t, 0.2, 0.7))
    base = _ramp(float(EV.fig("wedge.base2020")), float(EV.fig("wedge.bau2050")))
    wedges = [("Efficiency", _ramp(0, float(EV.fig("wedge.eff2050")))),
              ("Renewables", _ramp(0, float(EV.fig("wedge.ren2050")))),
              ("Closed loop", _ramp(0, float(EV.fig("wedge.loop2050"))))]
    k = sum(K.ease_io(K.seg(t, b, b + 1.3)) for b in (1.6, 3.6, 5.6))
    K.wedge_chart(img, (220, 260, 1480, 940), YEARS, base, wedges, k, ink=STG["ink"], sub=STG["sub"], unit=" Gt",
                  guard=G)   # running totals (2.1, 1.7, 1.4) are derived rows in the evidence table
    if t > 7.2:
        K.text(img, (1560, 1000), G(f"2050: {EV.fig('wedge.net2050')} Gt"), "num", 44, STG["accent"], anchor="ls",
               alpha=K.seg(t, 7.2, 7.7))
    return img


def _device(img, t):
    d = ImageDraw.Draw(img)
    sh = K.capsule(img.size, (780, 330, 1160, 850), 70).filter(ImageFilter.GaussianBlur(30))
    img.paste(Image.composite(bg((150, 146, 140)), img, sh.point(lambda v: int(v * 0.5))))
    d.rounded_rectangle([760, 300, 1160, 820], radius=70, fill=(46, 46, 50))
    d.rounded_rectangle([790, 330, 1130, 790], radius=48, fill=(22, 22, 26))
    k = K.seg(t, 0.4, 1.4)
    d.ellipse([930 - 40 * k, 520 - 40 * k, 990 + 40 * k, 580 + 40 * k], outline=STU["accent"], width=6)


def s_spec(t):
    """spec constellation around the product (Samsung Nul7mPL7Nt4 32:22, Rivian dimensions)"""
    img = bg(STU["bg"])
    K.text(img, (W / 2, 160), "Keeper One", "display", 96, STU["ink"], anchor="ms", alpha=K.seg(t, 0, 0.5))
    _device(img, t)
    K.spec_callouts(img, [((1160, 360), (1480, 300), EV.fig("spec.length"), "length"),
                          ((760, 760), (420, 820), EV.fig("spec.weight"), "per module"),
                          ((1160, 760), (1480, 860), EV.fig("spec.life"), "design life")],
                    t - 1.2, color=STU["ink"], sub=STU["sub"], stagger=0.5)
    return img


def s_rank(t):
    """rank table with the focus entity highlighted per column (Apple WWDC25 0_DjDdfqtUE)"""
    img = bg((255, 255, 255))
    K.text(img, (W / 2, 150), "Rank by uptime", "display", 80, STU["ink"], anchor="ms", alpha=K.seg(t, 0, 0.4))
    K.text(img, (W / 2, 200), "demo data", "text", 30, STU["sub"], anchor="ms", alpha=K.seg(t, 0.2, 0.6))
    cols = [["Atlas", "Keeper", "Nimbus", "Orca"], ["Keeper", "Atlas", "Orca", "Nimbus"],
            ["Keeper", "Nimbus", "Atlas", "Orca"]]
    K.rank_table(img, (520, 260, 1400, 900), cols, ["2023", "2024", "2025"], "Keeper", t + 0.1, ink=STU["ink"],
                 sub=STU["sub"], hi=STU["accent"])
    return img


def s_price(t):
    """split letterforms part for the price (Rivian 82IiXIKkRIA)"""
    img = bg(STU["bg"])
    K.price_split(img, "K", "1", "EST. STARTING PRICE", EV.fig("price"), t - 0.5, ink=STU["ink"], sub=STU["sub"])
    return img


def s_end(t, dur=5.0):
    """brand end card on a saturated field; a value ramp only on the last card (never between scenes)"""
    img = bg(FLD["bg"])
    K.text(img, (W / 2, H / 2 + 20), "Demo Brand", "display", 150, FLD["ink"], anchor="ms", alpha=K.seg(t, 0.2, 0.9))
    K.text(img, (W / 2, H / 2 + 90), "Keeper One", "text", 40, FLD["sub"], anchor="ms", alpha=K.seg(t, 0.6, 1.2))
    K.text(img, (W / 2, H - 60), EV.fig("disc.demo"), "text", 24, FLD["sub"], anchor="ms", alpha=K.seg(t, 1.0, 1.6))
    return K.value_ramp(img, K.seg(t, dur - 1.4, dur - 0.2)) if t > dur - 1.4 else img


def _peak_mask():
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).polygon([(830, 700), (960, 470), (1090, 700)], fill=255)
    return m


PEAK = _peak_mask()
SCENES = [  # (name, seconds, fn, transition into the NEXT scene, transition seconds)
    ("cold", 5.0, s_cold, "slit", 1.0),
    ("kpis", 7.0, s_kpis, "capsule", 0.9),
    ("bubbles", 9.0, s_bubbles, "push", 0.8),
    ("wedges", 9.0, s_wedges, "mosaic", 1.0),
    ("spec", 7.0, s_spec, "portal", 0.9),
    ("rank", 6.0, s_rank, "whip", 0.6),
    ("price", 6.0, s_price, "shape", 1.0),
    ("end", 5.0, s_end, None, 0.0),
]
STARTS = np.cumsum([0] + [s[1] for s in SCENES]).tolist()
TOTAL = STARTS[-1]
assert max(s[1] for s in SCENES) <= 20, "house rule: no scene over 20 s"


def frame(T):
    for i, (name, dur, fn, tr, td) in enumerate(SCENES):
        s0 = STARTS[i]
        if i + 1 < len(SCENES) and tr and abs(T - STARTS[i + 1]) < td / 2:
            u = (T - (STARTS[i + 1] - td / 2)) / td
            a, b = fn(T - s0), SCENES[i + 1][2](T - STARTS[i + 1])
            if tr == "shape":
                return K.t_shape(a, b, u, PEAK, (960, 640))
            return K.TRANSITIONS[tr](a, b, u)
        if s0 <= T < s0 + dur:
            return fn(T - s0)
    return SCENES[-1][2](T - STARTS[-1])


# ---------------------------------------------------------------- audio: bed with an arc + accents on hero beats only
BPM = 96


def audio(path_wav):
    mix = sfx.Mix(TOTAL + 2.5)
    beat = 60 / BPM; bar = 4 * beat
    prog = ["F", "C", "G", "Am"]
    n_bars = int(TOTAL / bar)
    for b in range(n_bars):
        t0 = b * bar; ch = prog[b % 4]
        energy = 0.55 + 0.45 * min(1, t0 / STARTS[3])            # bed grows into the data scenes
        for f in sfx.chord_notes(ch, 4):
            mix.note(f, t0, bar * 1.05, gain=0.055 * energy, ratio=1.0, idx=0.5, adsr=(0.35, 0.4, 0.75, 0.6),
                     idx_decay=1.5)
        mix.bass(sfx.chord_notes(ch, 2)[0], t0, bar * 0.95, gain=0.16 * energy)
        if t0 >= STARTS[2] and t0 < STARTS[7] - bar:               # pulse arps only once the data starts
            notes = sfx.chord_notes(ch, 5)
            for k in range(8):
                mix.note(notes[k % 3], t0 + k * beat / 2, beat * 0.45, gain=0.035 * energy, ratio=3.0, idx=1.2,
                         adsr=(0.003, 0.08, 0.2, 0.08))
    for f in sfx.chord_notes("F", 4) + [sfx.chord_notes("F", 2)[0]]:  # resolve: held tonic rings out
        mix.note(f, STARTS[7], 5.0, gain=0.07, ratio=1.0, idx=0.4, adsr=(0.05, 0.6, 0.6, 2.5), idx_decay=2.0)
    bed_rms = float(np.sqrt(np.mean(mix.stereo() ** 2)))
    def cue(name, t, rel_db):                                        # accents sit relative to the bed, not on top of it
        g = bed_rms * 10 ** (rel_db / 20) / max(sfx.loud_rms(sfx.sfx_wave(name)), 1e-9)
        mix.sfx(name, t, gain=g)
    cue("whoosh_up", STARTS[1] - 0.5, -2)       # slit opens
    cue("chime", STARTS[6] + 0.5, 0)            # price lands
    cue("sweep", STARTS[4] - 0.45, -6)          # portal
    mix.reverb(0.22)
    x, rep = sfx.master(mix.stereo(), os.path.join(OUT, "_tmp_master.wav"), target=-14.0, ceiling_db=-1.5)
    sfx.write_pcm(path_wav, x)
    print("master passes (LUFS, TP):", rep, "cues:", mix.cues)


# ---------------------------------------------------------------- CLI
def main():
    os.makedirs(OUT, exist_ok=True)
    cmd = sys.argv[1] if len(sys.argv) > 1 else "frames"
    if cmd == "frames":
        for s in (sys.argv[2:] or ["2", "9", "16", "26", "34", "40", "47", "52"]):
            K.still(frame(float(s)), os.path.join(OUT, f"f_{float(s):05.1f}.png"))
        print("frames ->", OUT)
    elif cmd == "dryrun":
        n = int(TOTAL * FPS)
        for i in range(n):
            frame(i / FPS)
        print(f"dryrun ok: {n} frames, unused evidence: {EV.unused()}")
    elif cmd == "render":
        n = int(TOTAL * FPS)
        silent = os.path.join(OUT, f"{NAME}_preview_silent.mp4")
        with K.Writer(silent) as wr:
            for i in range(n):
                wr.add(frame(i / FPS))
        wav = os.path.join(OUT, f"{NAME}.wav")
        audio(wav)
        sfx.mux(silent, wav, os.path.join(OUT, f"{NAME}.mp4"))
        print(f"rendered {n} frames ({TOTAL:.1f} s) -> {os.path.join(OUT, NAME + '.mp4')}; unused evidence: {EV.unused()}")
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
