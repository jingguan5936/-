"""Soundtrack of the bazi short: an original pentatonic score (pluck "guzheng", glockenspiel, warm pad, woodblock,
timpani, gong), synthesized SFX timed to the picture (timeline.json, dumped from story.ts) and the mix.
Standard mix (skill rules): voice unchanged, music bed +3 dB over the template's old -13 LU (so ~-10 LU under the
voice, ducked while it speaks), SFX events at their "naive" level -6 dB. Master -15 LUFS, true peak <= -1.2 dBTP,
exactly TOTAL/30 s, 48 kHz stereo 24-bit. Writes mix.wav, stems and cues.md."""
import json, os, sys
import numpy as np
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dsp import (SR, ns, tt, rng, dbg, lp, hp, bp, peq, pan, st, place, fades, make_ir, convolve_st, integrated, momentary,
                 true_peak, read_wav, write_wav, modal, colored, ramp, lra)
import instruments as I
import sfx_gen as G

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, "timeline.json")))
W = json.load(open(os.path.join(HERE, "..", "voice", "words.json"), encoding="utf-8"))
FPS, TOTAL = TL["FPS"], TL["TOTAL"]
DUR = TOTAL / FPS
N = ns(DUR)
EV = {k: (np.array(v) / FPS if isinstance(v, list) else v / FPS) for k, v in TL["EV"].items()}
BOWL_TIP, BOWL_HIT, FLASH = TL["BOWL_TIP"] / FPS, TL["BOWL_HIT"] / FPS, TL["FLASH_AT"] / FPS
SH = {s["id"]: (s["a"] / FPS, s["b"] / FPS) for s in TL["SHOTS"]}
TARGET_LUFS, CEIL = -15.0, -1.2
SFX_DB, MUSIC_DB = -6.0, -10.0
log = lambda *a: print(*a, flush=True)

# ============================================================ score
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
def m2f(m): return 440.0 * 2 ** ((m - 69) / 12)
def nm(s):  # "D4", "F#5"
    acc = 1 if "#" in s else -1 if "b" in s[1:] else 0
    return 12 * (int(s[-1]) + 1) + NOTE[s[0]] + acc
def woodblock(f=1100, vel=0.6, r=None):
    return modal(0.25, [(f, 1.0, 0.035), (f * 2.7, 0.35, 0.02), (f * 4.1, 0.12, 0.012)], r) * vel
def gong(f=110, vel=0.8, r=None, dur=5.0):
    r = r or rng(3)
    y = modal(dur, [(f, 1.0, 2.2), (f * 1.52, 0.6, 1.6), (f * 2.13, 0.45, 1.2), (f * 2.92, 0.3, 0.9), (f * 3.6, 0.2, 0.6)], r, glide=0.04, glide_tau=0.6)
    y += lp(r.standard_normal(len(y)), 2500) * np.exp(-tt(dur) / 0.08) * 0.25
    return fades(y * vel * 0.6, 0.002, 0.3)
def zheng(f, vel=0.7, r=None, dur=1.4, trem=0.0):
    """guzheng-ish pluck: bright attack, slight downward pitch settle; trem > 0 = tremolo (yao zhi) at 13 Hz"""
    r = r or rng(int(f))
    if trem <= 0:
        return I.pluck(f, vel, r, dur=dur, bright=0.85, pos=0.11)
    y = np.zeros(ns(dur))
    k = 0
    while k / 13.0 < trem:
        x = I.pluck(f, vel * (0.75 + 0.25 * (k % 2)), r, dur=0.4, bright=0.8, pos=0.11)
        i = ns(k / 13.0); y[i:i + len(x)] += x[: max(0, len(y) - i)]
        k += 1
    return y

class Score:
    def __init__(self):
        self.buf = np.zeros((2, N)); self.dry = np.zeros((2, N)); self.r = rng(77)
    def add(self, t, x, vel=1.0, p=0.0, wet=True):
        if t < 0 or t >= DUR: return
        place(self.buf if wet else self.dry, pan(np.asarray(x) * vel, p) if np.asarray(x).ndim == 1 else x * vel, t)
    def notes(self, t0, beat, seq, inst="zheng", vel=0.6, p=0.0, octave=0):
        """seq: list of (beats_from_t0, note, dur_beats[, vel])"""
        for item in seq:
            b, n, d = item[0], item[1], item[2]
            v = item[3] if len(item) > 3 else vel
            f = m2f(nm(n) + 12 * octave)
            if inst == "zheng": x = zheng(f, v, self.r, dur=max(0.6, d * beat + 0.5))
            elif inst == "trem": x = zheng(f, v, self.r, dur=d * beat + 0.6, trem=d * beat)
            elif inst == "glock": x = I.glock(f, v, self.r, dur=1.6)
            elif inst == "mbox": x = I.musicbox(f, v, self.r, dur=1.4)
            else: raise ValueError(inst)
            self.add(t0 + b * beat, x, 1.0, p + 0.15 * np.sin(b * 1.7))
    def pad(self, t0, t1, chord, vel=0.35, warm=900):
        if t1 <= t0: return
        x = I.pad([m2f(nm(c)) for c in chord], t1 - t0 + 0.8, vel, self.r, att=0.5, rel=0.8, warm=warm)
        self.add(t0, x, 1.0)
    def blocks(self, t0, t1, beat, pat="x.x.", vel=0.35, f=1150):
        k, t = 0, t0
        while t < t1:
            if pat[k % len(pat)] == "x": self.add(t, woodblock(f * (1.0 if k % 4 else 0.82), vel, self.r), 1.0, 0.3)
            k += 1; t = t0 + k * beat / 2

def build_score():
    S, b = Score(), 60 / 96.0               # 96 bpm, beat = 0.625 s
    sh = lambda i: SH[i]
    # ---- hook (0 - slip land): playful pizzicato, stops dead on the landing
    S.notes(0.15, b / 2, [(0, "D5", 1), (1, "F#5", 1), (2, "A5", 1), (3, "B5", 1), (4, "A5", 1), (5, "F#5", 1), (6, "E5", 2)], "zheng", 0.55)
    S.blocks(0.15, EV["slipLand"] - 0.1, b, "x.xx", 0.3)
    S.add(EV["slipLand"], I.timpani(m2f(nm("D2")), 0.9, S.r), 1.0); S.add(EV["slipLand"], gong(m2f(nm("A2")), 0.5, S.r, 3.0), 1.0, 0.0)
    # ---- town (flash - 11 s): the Jiangnan theme in D major pentatonic
    t0 = FLASH + 0.05
    S.pad(t0, sh(2)[1], ["D3", "A3", "F#4"], 0.32)
    theme = [(0, "A4", 1), (1, "B4", 0.5), (1.5, "A4", 0.5), (2, "F#4", 1), (3, "E4", 1), (4, "D4", 1.5), (5.5, "E4", 0.5), (6, "F#4", 1), (7, "A4", 1),
             (8, "B4", 1), (9, "D5", 0.5), (9.5, "B4", 0.5), (10, "A4", 1), (11, "F#4", 1), (12, "E4", 2, 0.6)]
    S.notes(t0, b, theme, "zheng", 0.6)
    S.notes(t0 + 14 * b, b, [(0, "A4", 2, 0.5)], "trem", 0.45)
    S.blocks(t0, sh(2)[1] - 0.3, b, "x...x.x.", 0.22)
    # ---- pillars (11 - 17.2): one rising note per pillar, glock sparkles on the glows
    for k, n in enumerate(["D4", "E4", "F#4", "A4"]): S.add(EV["rise"][k] + 0.22, zheng(m2f(nm(n)), 0.75, S.r, 1.6), 1.0, -0.3 + 0.2 * k)
    S.pad(sh(3)[0] + 1.0, sh(3)[1], ["D3", "A3", "E4"], 0.28)
    for t in (EV["stems"], EV["branches"]): S.notes(t, 0.09, [(0, "A5", 1), (1, "D6", 1), (2, "F#6", 1)], "glock", 0.38)
    S.notes(EV["eight"], 0.08, [(k, n, 1) for k, n in enumerate(["D5", "E5", "F#5", "A5", "B5", "D6", "E6", "F#6"])], "glock", 0.36)
    # ---- hall (17.2 - 23.3): tiptoe pizzicato on the off-beats, very light
    t0 = sh(4)[0] + 0.2
    tip = [(0.5, "D4", 0.25), (1.5, "F#4", 0.25), (2.5, "E4", 0.25), (3.5, "A3", 0.25), (4.5, "D4", 0.25), (5.5, "E4", 0.25), (6.5, "F#4", 0.25), (7.5, "A4", 0.25)]
    for rep in range(2): S.notes(t0 + rep * 8 * b * 0.75, b * 0.75, tip, "zheng", 0.42)
    S.add(EV["bow"], I.triangle(0.25, S.r), 1.0, 0.2)
    # ---- the fortune teller (23.3 - 29.5): mystery in B minor pentatonic, woodblock clock
    t0 = sh(5)[0]
    S.pad(t0, sh(6)[1] - 1.3, ["B2", "F#3", "D4"], 0.3, warm=700)
    S.notes(t0 + 0.3, b, [(0, "B4", 1.5), (1.5, "A4", 0.5), (2, "F#4", 1), (3, "E4", 1), (4, "D4", 1), (5, "E4", 1), (6, "F#4", 2)], "zheng", 0.5)
    S.blocks(t0, sh(6)[1] - 1.4, b, "x.x.", 0.2, 900)
    S.notes(EV["dayBranch"], 0.1, [(0, "F#6", 1), (1, "B6", 1)], "glock", 0.35)
    S.add(EV["figs"], zheng(m2f(nm("B5")), 0.5, S.r), 1.0, -0.2); S.add(EV["figs"] + 0.13, zheng(m2f(nm("D6")), 0.5, S.r), 1.0, 0.2)
    # ---- snap: tremolo builds into the clash, then a gong
    S.notes(EV["horse"] - 0.1, b, [(0, "F#4", 1.2, 0.45)], "trem", 0.45)
    S.notes(EV["rat"] - 0.1, b, [(0, "G4", 1.2, 0.5)], "trem", 0.5)
    S.add(EV["chong"], gong(m2f(nm("B1")), 1.0, S.r, 5.0), 1.0)
    S.add(EV["chong"], I.timpani(m2f(nm("B1")), 1.0, S.r), 1.0)
    # ---- rhyme (golden, 34.3 - 40): bouncy call and response
    t0 = sh(7)[0] + 0.25
    S.pad(t0, sh(7)[1], ["D3", "A3", "B3", "F#4"], 0.28)
    S.notes(t0, b, [(0, "D5", 0.5), (0.5, "B4", 0.5), (1, "A4", 1), (2, "F#4", 0.5), (2.5, "A4", 0.5), (3, "D5", 1)], "zheng", 0.5)
    S.blocks(t0, sh(7)[1] - 0.2, b, "x.xx", 0.22)
    S.notes(EV["horseOx"], b / 2, [(0, "D4", 1), (1, "D4", 1), (2, "A3", 2)], "zheng", 0.6)
    S.notes(EV["goatRat"], b / 2, [(0, "B4", 1), (1, "A4", 1), (2, "E4", 2)], "zheng", 0.55)
    # ---- ring (40 - 49.8): sweet good news, then sour bad news and the storm
    t0 = sh(8)[0] + 0.15
    S.pad(t0, EV["bad"] - 0.1, ["D3", "A3", "F#4", "B4"], 0.3)
    S.notes(t0, b, [(0, "F#5", 1), (1, "A5", 1), (2, "B5", 1), (3, "A5", 1), (4, "F#5", 1), (5, "E5", 1), (6, "D5", 2)], "mbox", 0.42)
    S.notes(EV["hearts"], 0.11, [(k, n, 1) for k, n in enumerate(["D6", "F#6", "A6", "D7"])], "glock", 0.32)
    t1 = EV["bad"]
    S.pad(t1, sh(8)[1], ["B2", "F3", "D4"], 0.28, warm=650)
    S.notes(t1 + 0.1, b, [(0, "B4", 1), (1, "A4", 1), (2, "F4", 1), (3, "E4", 1), (4, "D4", 2)], "zheng", 0.5)
    S.add(EV["chongs"], I.timpani(m2f(nm("F2")), 0.8, S.r), 1.0); S.add(EV["hais"], I.timpani(m2f(nm("E2")), 0.7, S.r), 1.0)
    S.add(EV["xing"], gong(m2f(nm("A1")), 0.9, S.r, 5.0), 1.0)
    # ---- gears (49.8 - 56.7): clockwork ostinato in time with the teeth, stops dead on the jam
    t0 = sh(9)[0] + 0.1
    tick = 60 / 132.0
    k = 0
    while t0 + k * tick / 2 < EV["jam"] - 0.05:
        t = t0 + k * tick / 2
        S.add(t, woodblock(1300 if k % 2 else 980, 0.3, S.r), 1.0, 0.35 if k % 2 else -0.35)
        if k % 2 == 0 and t > EV["mesh"]: S.add(t, zheng(m2f(nm(["D4", "A4", "F#4", "A4", "E4", "A4", "D4", "B3"][(k // 2) % 8])), 0.42, S.r, 0.8), 1.0)
        k += 1
    S.pad(EV["mesh"], EV["jam"], ["D3", "A3", "F#4"], 0.25)
    S.notes(EV["he"], 0.09, [(0, "A5", 1), (1, "D6", 1), (2, "F#6", 1), (3, "A6", 1)], "glock", 0.35)
    S.add(EV["jam"] + 0.25, I.timpani(m2f(nm("C2")), 0.8, S.r), 1.0)
    # ---- a thousand years (56.7 - 61.7): the theme, full and warm, golden
    t0 = sh(10)[0] + 0.1
    S.pad(t0, sh(10)[1] + 0.6, ["D3", "A3", "F#4", "A4"], 0.36)
    S.notes(t0, b * 0.9, theme[:12], "zheng", 0.6)
    S.notes(t0, b * 0.9, [(0, "D3", 4), (4, "B2", 4), (8, "G2", 4)], "zheng", 0.45)
    # ---- the cat (61.7 - end): tiptoe again, holds its breath before the push, a two-note button after the crash
    t0 = sh(11)[0] + 0.15
    for rep in range(3):
        tt0 = t0 + rep * 8 * b * 0.75
        S.notes(tt0, b * 0.75, [x for x in tip if tt0 + x[0] * b * 0.75 < EV["push"] - 0.3], "zheng", 0.38)
    S.notes(EV["catPaw"], b, [(0, "E5", 2.5, 0.3)], "trem", 0.3)
    S.add(BOWL_HIT + 0.55, zheng(m2f(nm("A3")), 0.7, S.r, 1.2), 1.0, -0.1)
    S.add(BOWL_HIT + 0.85, zheng(m2f(nm("D3")), 0.75, S.r, 1.6), 1.0, 0.1)
    ir = make_ir(1.6, 11, hf=1.4)
    out = S.buf + 0.22 * convolve_st(S.buf, ir)[:, :N] + S.dry
    return out

# ============================================================ sfx
class Cue:
    def __init__(self, t, name, gen, lvl, p=0.0, wet=0.12):
        self.t, self.name, self.gen, self.lvl, self.p, self.wet = t, name, gen, lvl, p, wet

def thump(r, f=70, dur=0.5):
    y = modal(dur, [(f, 1.0, 0.12), (f * 1.6, 0.4, 0.07), (f * 2.4, 0.2, 0.05)], r)
    return fades(y + lp(r.standard_normal(len(y)), 900) * np.exp(-tt(dur) / 0.03) * 0.5, 0.001, 0.05)
def paper(r, dur=0.35):
    y = bp(r.standard_normal(ns(dur)), 1500, 7000) * np.exp(-tt(dur) / (dur / 3)) * (0.6 + 0.4 * np.sin(np.linspace(0, 40, ns(dur))) ** 2)
    return fades(y, 0.002, 0.03)
def rumble(r, dur=0.7):
    y = lp(r.standard_normal(ns(dur)), 180) * np.sin(np.linspace(0, np.pi, ns(dur))) ** 0.7
    return fades(y * 3, 0.01, 0.1)
def zap(r, dur=0.35):
    n = ns(dur); t = tt(dur)
    buzz = np.sign(np.sin(2 * np.pi * (120 + 60 * np.sin(t * 40)) * t)) * 0.3
    y = (bp(r.standard_normal(n), 1800, 9000) * (r.random(n) < 0.25) + lp(buzz, 3000)) * np.exp(-t / 0.12)
    return fades(y, 0.001, 0.04)
def thunder(r, dur=2.5):
    t = tt(dur)
    crack = bp(r.standard_normal(ns(dur)), 300, 6000) * np.exp(-t / 0.08)
    roll = lp(r.standard_normal(ns(dur)), 220) * np.exp(-t / 0.9) * (1 + 0.5 * np.sin(t * 9))
    return fades(crack * 0.8 + roll * 2.5, 0.002, 0.3)
def snort(r, dur=0.4):
    t = tt(dur)
    y = bp(r.standard_normal(ns(dur)), 300, 2500) * np.exp(-t / 0.09) * (1 + 0.6 * np.sin(2 * np.pi * 28 * t))
    return fades(y, 0.004, 0.05)
def scrape(r, dur=0.5):
    y = bp(r.standard_normal(ns(dur)), 600, 4000) * (0.5 + 0.5 * np.abs(np.sin(np.linspace(0, 18, ns(dur)))))
    return fades(y * 0.7, 0.01, 0.06)
def shatter(r):
    y = np.zeros(ns(1.4))
    y[: ns(0.25)] += bp(r.standard_normal(ns(0.25)), 2000, 12000) * np.exp(-tt(0.25) / 0.05) * 1.2
    for k in range(26):
        x = G.clink(r, f0=r.uniform(2500, 7500), dur=0.12, bright=1.2) * r.uniform(0.3, 0.9)
        i = ns(r.uniform(0.0, 0.6) ** 1.6)
        y[i:i + len(x)] += x[: len(y) - i]
    y[: ns(0.4)] += thump(r, 110, 0.4) * 0.8
    return fades(y, 0.001, 0.1)
def bead(r):
    return modal(0.12, [(1900, 1.0, 0.012), (3300, 0.5, 0.008), (5200, 0.25, 0.005)], r)
def popsnd(r, f0=600):
    t = tt(0.18)
    return np.sin(2 * np.pi * (f0 + 900 * t / 0.18) * t) * np.exp(-t / 0.05)
def meow(r):
    t = tt(0.55)
    f = 520 + 260 * np.sin(np.pi * np.clip(t / 0.5, 0, 1)) ** 1.5
    src = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR))
    y = bp(src, 500, 3200) * np.sin(np.pi * np.clip(t / 0.55, 0, 1)) ** 0.8
    return fades(y * 0.4, 0.01, 0.06)

def cues():
    C = []
    r = rng(5)
    a = lambda t, name, gen, lvl, p=0.0, wet=0.12: C.append(Cue(t, name, gen, lvl, p, wet))
    a(EV["slipFall"], "slip falls (flutter whoosh)", lambda r: G.whoosh(EV["slipLand"] - EV["slipFall"] + 0.1, r, peak=0.85, f_lo=500, f_hi=3000), -6)
    a(EV["slipLand"], "slip slaps onto the bridge", lambda r: paper(r, 0.2), -2)
    a(EV["slipLand"], "thump of the landing", lambda r: thump(r, 65, 0.6), 0)
    a(FLASH - 0.12, "flash whoosh", lambda r: G.whoosh(0.5, r, peak=0.6, f_lo=900, f_hi=5000), -8)
    for k in range(int((249 - 186) / 7.5)):                                                           # the matchmaker trots (4 steps/s)
        a((186 + k * 7.5) / FPS, "matchmaker step", lambda r: G.stroll_step(r, 0.3), -13, 0.0)
    a(EV["slipOpen"], "slip unfolds", lambda r: paper(r, 0.45), -8)
    a(EV["slipOpen"] + 0.25, "characters glow", lambda r: I.triangle(0.4, r), -12)
    for k, t in enumerate(EV["rise"]):
        a(t - 0.05, f"pillar {k + 1} rises (stone rumble)", lambda r: rumble(r, 0.4), -8, -0.3 + 0.2 * k)
        a(t + 0.27, f"pillar {k + 1} lands", lambda r: thump(r, 60, 0.6), -4, -0.3 + 0.2 * k)
    a(EV["place"], "slip laid on the altar", lambda r: paper(r, 0.25), -12)
    a(EV["bow"], "robe rustle (bow)", lambda r: lp(paper(r, 0.4), 3000), -14)
    for k in range(6):
        a((592 + k * 9) / FPS, "mother tiptoes", lambda r: G.stroll_step(r, 0.1) * 0.5, -18, 0.2)
    a(EV["figs"], "figurine pops (horse)", lambda r: popsnd(r, 500), -12, 0.2)
    a(EV["figs"] + 0.13, "figurine pops (rat)", lambda r: popsnd(r, 700), -12, -0.2)
    a(EV["bead1"], "abacus bead", bead, -6, 0.1); a(EV["bead2"], "abacus bead", bead, -6, -0.1)
    a(EV["horse"], "horse hops", lambda r: popsnd(r, 400), -14, 0.2); a(EV["rat"], "rat hops", lambda r: popsnd(r, 800), -14, -0.2)
    a(EV["chong"], "the clash: crack", G.wood_crack, 0); a(EV["chong"], "the clash: thump", lambda r: thump(r, 50, 0.8), 0)
    a(EV["dodge"] + 0.1, "dodge whoosh", lambda r: G.whoosh(0.5, r, peak=0.5), -10)
    for k in range(4):
        a(EV["horseOx"] + 0.15 + k * 0.53, "snort", snort, -10, -0.4 if k % 2 else 0.4)
    a(EV["horseOx"] + 0.2, "clash spark", lambda r: zap(r, 0.25), -12)
    a(EV["goatRat"] + 0.15, "hmph whoosh (turn away)", lambda r: G.whoosh(0.35, r, peak=0.4, f_lo=700, f_hi=3000), -12)
    for k in range(6):
        a(EV["liuhe"] + k * 0.1, "thread", lambda r: I.glock(m2f(nm("A6")) * (1 + 0.06 * k), 0.3, r, dur=0.8), -14, -0.5 + 0.2 * k)
        a(EV["hearts"] + k * 0.067, "heart pop", lambda r: popsnd(r, 900), -14, -0.5 + 0.2 * k)
    a(EV["chongs"], "clash bolts (冲)", lambda r: zap(r, 0.5), -2)
    a(EV["hais"], "harm bolts (害)", lambda r: zap(r, 0.4) * 0.8, -4)
    a(EV["xing"], "storm thunder (刑)", thunder, -2)
    a(EV["gearsUp"], "gears rise", lambda r: rumble(r, 0.8), -6)
    a(EV["he"], "gears mesh (sparkle)", lambda r: I.triangle(0.5, r), -12)
    a(EV["jam"] + 0.05, "teeth jam (grind)", lambda r: G.creak(0.6, r) * 8, -6)
    a(EV["jam"] + 0.27, "jam thump", lambda r: thump(r, 55, 0.6), -4)
    a(EV["ka1"], "咔 (wood crack)", G.wood_crack, -3, 0.2); a(EV["ka2"], "咔 (wood crack)", G.wood_crack, -3, -0.2)
    for k in range(int((SH[10][1] - SH[10][0]) * 3)):
        a(SH[10][0] + k / 3 + 0.03 * (k % 2), "procession steps", lambda r: G.stroll_step(r, 0.2) * 0.6, -18, -0.3 + 0.6 * (k % 2))
    a(EV["catLook"] - 0.25, "cat: mrrp", meow, -12, -0.2)
    a(EV["catPaw"] + 0.2, "paw on wood", lambda r: scrape(r, 0.3) * 0.5, -16, -0.2)
    a(EV["push"], "bowl slides", lambda r: scrape(r, BOWL_TIP - EV["push"] + 0.05), -10, 0.1)
    a(BOWL_TIP, "bowl tips and falls (whoosh)", lambda r: G.whoosh(BOWL_HIT - BOWL_TIP + 0.1, r, peak=0.9, f_lo=800, f_hi=4000), -12, 0.1)
    a(BOWL_HIT, "porcelain shatters", shatter, 0, 0.15)
    return C

def beds():
    """ambience beds (integrated loudness relative to the voice, not reduced by SFX_DB)"""
    r = rng(9)
    out = np.zeros((2, N))
    def seg(a, b, x, gdb, fin=0.3, fout=0.3):
        x = st(x)[:, : ns(b - a)].copy() * dbg(gdb)
        n = x.shape[1]; e = np.ones(n); fi, fo = min(n // 2, ns(fin)), min(n // 2, ns(fout))
        e[:fi] = np.linspace(0, 1, fi); e[n - fo:] = np.linspace(1, 0, fo)
        place(out, x * e[None, :], a)
    town = [(0, SH[3][1]), (SH[5][0], SH[10][1])]
    for a, b in town:
        d = b - a
        w = G.water_bed(d, r, close=0.6, slosh_rate=0.6)
        seg(a, b, w, -30)
        seg(a, b, G.breeze(d, r, level=0.6), -34)
    for a, b in [(0, SH[3][1]), (SH[5][0], SH[6][1])]:
        seg(a, b, pan(G.bird_chirps(b - a, r, density=0.35), 0.3), -30)
    for a, b in [(SH[4][0], SH[4][1]), (SH[11][0], DUR)]:
        seg(a, b, pan(lp(colored(ns(b - a), r, -1.0), 400) * 0.3, 0), -40)          # quiet room tone
    return out

def render_sfx(v_ref):
    out = np.zeros((2, N)); rows = []
    ir = make_ir(0.9, 21, hf=1.6)
    for k, c in enumerate(cues()):
        r = rng(100 + k)
        x = np.asarray(c.gen(r), float)
        x = st(x) if x.ndim == 2 else pan(x, c.p)
        Mmax = float(np.max(momentary(np.pad(x, ((0, 0), (0, ns(0.4)))))))
        g = (v_ref + c.lvl + SFX_DB) - Mmax if np.isfinite(Mmax) else 0.0
        x = x * dbg(g)
        wet = convolve_st(x, ir)[:, : x.shape[1] + ns(0.9)]
        y = np.pad(x, ((0, 0), (0, wet.shape[1] - x.shape[1]))) + c.wet * wet
        place(out, y, c.t)
        rows.append((c.t, c.name, c.lvl + SFX_DB))
    return out + beds() * 1.0, rows

def limiter(x, ceil_db=CEIL, look=0.003, rel=0.08):
    from scipy import signal
    up = signal.resample_poly(x, 4, 1, axis=1)
    pk = np.max(np.abs(up), axis=0).reshape(-1, 4).max(axis=1)
    pk = np.pad(pk, (0, x.shape[1] - len(pk)))[: x.shape[1]]
    c = dbg(ceil_db)
    need = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    L = ns(look)
    need = ndimage.minimum_filter1d(need, 2 * L + 1)
    g = np.empty_like(need); e = 1.0; kr = 1 - np.exp(-1 / (rel * SR))
    for i in range(len(need)):
        e = need[i] if need[i] < e else e + (need[i] - e) * kr
        g[i] = e
    g = ndimage.uniform_filter1d(g, L)
    return x * g[None, :], g

def main():
    import soundfile as sf
    from scipy import signal
    v, _sr = sf.read(os.path.join(HERE, "..", "voice", "voice.wav"), always_2d=True)
    v = v.T
    if v.ndim == 1: v = v[None, :]
    v = signal.resample_poly(v, SR, W["sr"], axis=1)
    v = st(v[0]) if v.shape[0] == 1 else v
    vb = np.zeros((2, N)); vb[:, : min(N, v.shape[1])] = v[:, :N]
    v = vb
    v_ref = integrated(v)
    log(f"voice {v_ref:.2f} LUFS")
    # music: ducked under speech, set to MUSIC_DB under the voice
    m = build_score()
    spans = [(c["s"], c["e"]) for c in W["clauses"]]
    ctrl = np.zeros(N)
    for s, e in spans: ctrl[ns(max(0, s - 0.08)): ns(e + 0.12)] = 1
    duck = ndimage.uniform_filter1d(ctrl, ns(0.25))
    m = m * dbg(-3.0 * duck)[None, :]
    Lm = integrated(m)
    m = m * dbg(v_ref + MUSIC_DB - Lm)
    log(f"music {integrated(m):.2f} LUFS ({MUSIC_DB} LU under the voice)")
    s, rows = render_sfx(v_ref)
    log(f"sfx {integrated(s):.2f} LUFS, {len(rows)} events")
    mix0 = v + m + s
    Gm = TARGET_LUFS - integrated(mix0)
    for it in range(5):
        y, g = limiter(mix0 * dbg(Gm))
        L = integrated(y)
        if abs(L - TARGET_LUFS) < 0.03: break
        Gm += TARGET_LUFS - L
    y = fades(y, 0.0, 0.05)
    write_wav(os.path.join(HERE, "mix.wav"), y)
    for name, x in (("voice", v), ("music", m), ("sfx", s)): write_wav(os.path.join(HERE, f"stem_{name}.wav"), x * dbg(Gm))
    I_, TP, LRA_ = integrated(y), true_peak(y), lra(y)
    log(f"mix: {I_:.2f} LUFS, TP {TP:.2f} dBTP, LRA {LRA_:.1f}, max GR {-20 * np.log10(g.min()):.2f} dB, {y.shape[1] / SR:.3f} s")
    with open(os.path.join(HERE, "cues.md"), "w", encoding="utf-8") as f:
        f.write(f"# Bazi short: sound cues\n\nmix {I_:.2f} LUFS, true peak {TP:.2f} dBTP, LRA {LRA_:.1f} LU, length {y.shape[1] / SR:.3f} s (48 kHz stereo 24-bit)\n\n")
        f.write(f"voice {v_ref:.2f} LUFS (unchanged), music {MUSIC_DB} LU under the voice (ducked -3 dB under speech), SFX at naive level {SFX_DB} dB\n\n| t (s) | frame | event | level (LU vs voice) |\n|---|---|---|---|\n")
        for t, name, lvl in sorted(rows): f.write(f"| {t:6.2f} | {round(t * FPS):4d} | {name} | {lvl:+.0f} |\n")

if __name__ == "__main__":
    main()
