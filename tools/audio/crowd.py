#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# crowd.py
# Purpose : Yeetpowder's crowd reactions made in code (GDD SFX: a crowd "ooooh" for big airtime): many detuned
#           voices shaped into a vowel by formant filters, with breath noise, claps and whistles where they fit.
#             ooh   a rising-then-falling "ooooh" for big airtime
#             cheer an "aaay!" with claps and a whistle for knockouts, hero landings and YEETREAPs
#             aww   a falling "awww" for your own wipeouts
# Usage   : python tools/audio/crowd.py              # writes public/assets/audio/sfx/crowd_<name>_<n>.wav
#           python tools/audio/crowd.py ooh          # only that one
# Needs   : Python 3.8+ only (standard library); output is our own work, no samples (ASSET_LOG A-0001's licence)
# Notes   : Additive and linear: every voice's glottal pulse train is summed first, then one bank of formant
#           band-passes shapes the vowel, so a 40-voice crowd renders in seconds in pure Python. Each sound has
#           seeded variants (a different crowd), so repeats never sound identical. Tune the RECIPES table and rerun.
# Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
# ---------------------------------------------------------------------------
#
# Pseudocode
#   for each voice: random base pitch (men and women), vibrato, jitter, its own start delay
#     -> pitch(t) = base x contour(t) -> phase accumulate -> a soft pulse (sum of a few harmonics) x envelope(t)
#   sum voices + breath noise -> formant band-passes for the vowel (blend from vowel A to vowel B over time)
#   + claps (short filtered noise bursts) + whistle (a sine with a slide) -> normalize -> 16-bit WAV
import math
import random
import struct
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "assets" / "audio" / "sfx"
RATE = 22050
PEAK = 0.8

# vowel formants (Hz, bandwidth Hz, gain): a rough "oo", "ah", "aw", "ay" for mixed adult voices
VOWELS = {
    "oo": [(320, 90, 1.0), (800, 110, 0.5), (2400, 200, 0.12)],
    "ah": [(720, 110, 1.0), (1200, 130, 0.6), (2600, 220, 0.2)],
    "aw": [(580, 100, 1.0), (880, 120, 0.55), (2500, 200, 0.12)],
    "ay": [(560, 100, 0.9), (1800, 160, 0.55), (2600, 220, 0.25)],
}

# seconds, voices, pitch contour [(t 0..1, pitch multiplier)], vowel from -> to, loudness envelope, extras
RECIPES = {
    "ooh": dict(length=1.9, voices=40, contour=[(0, 0.9), (0.45, 1.28), (1, 0.98)], vowels=("oo", "oo"),
                env=[(0, 0), (0.25, 0.9), (0.6, 1.0), (1, 0)], breath=0.05, claps=0, whistle=False, variants=2),
    "cheer": dict(length=1.8, voices=44, contour=[(0, 1.0), (0.2, 1.35), (1, 1.15)], vowels=("ah", "ay"),
                  env=[(0, 0), (0.08, 1.0), (0.55, 0.85), (1, 0)], breath=0.12, claps=26, whistle=True, variants=2),
    "aww": dict(length=1.5, voices=36, contour=[(0, 1.12), (1, 0.72)], vowels=("aw", "oo"),
                env=[(0, 0), (0.15, 1.0), (0.7, 0.7), (1, 0)], breath=0.06, claps=0, whistle=False, variants=2),
}


def curve(points, x):
    """Piecewise-linear value of [(x, y), ...] at x."""
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if x <= x1:
            k = 0 if x1 == x0 else (x - x0) / (x1 - x0)
            return y0 + (y1 - y0) * k
    return points[-1][1]


def voices_source(r, rnd, n):
    """The summed glottal pulses of every voice (before the vowel filter)."""
    out = [0.0] * n
    for _ in range(r["voices"]):
        base = rnd.uniform(105, 150) if rnd.random() < 0.55 else rnd.uniform(185, 260)  # men and women
        vib_rate, vib_depth = rnd.uniform(4.5, 6.5), rnd.uniform(0.006, 0.02)
        delay = rnd.uniform(0, 0.12) * RATE
        amp = rnd.uniform(0.5, 1.0)
        phase = rnd.random()
        for i in range(int(delay), n):
            t = i / n
            f = base * curve(r["contour"], t) * (1 + vib_depth * math.sin(2 * math.pi * vib_rate * i / RATE))
            f *= 1 + rnd.uniform(-0.004, 0.004)  # jitter: a real voice wobbles
            phase = (phase + f / RATE) % 1.0
            # a soft pulse: the first few harmonics, falling off (cheap and vowel-friendly)
            p = 2 * math.pi * phase
            out[i] += amp * (math.sin(p) + 0.5 * math.sin(2 * p) + 0.3 * math.sin(3 * p) + 0.18 * math.sin(4 * p))
    return out


def bandpass(x, f0, bw):
    """A two-pole resonator (constant-peak band-pass) at f0 Hz with bandwidth bw Hz."""
    rr = math.exp(-math.pi * bw / RATE)
    a1, a2 = -2 * rr * math.cos(2 * math.pi * f0 / RATE), rr * rr
    g = 1 - rr
    y1 = y2 = 0.0
    out = [0.0] * len(x)
    for i, v in enumerate(x):
        y = g * v - a1 * y1 - a2 * y2
        out[i] = y
        y2, y1 = y1, y
    return out


def vowel(x, frm, to):
    """Shapes x into a vowel that blends from vowel `frm` to `to` over the sound."""
    n = len(x)
    a = [0.0] * n
    b = [0.0] * n
    for (f, bw, g) in VOWELS[frm]:
        for i, v in enumerate(bandpass(x, f, bw)):
            a[i] += g * v
    if to == frm:
        return a
    for (f, bw, g) in VOWELS[to]:
        for i, v in enumerate(bandpass(x, f, bw)):
            b[i] += g * v
    return [a[i] * (1 - i / n) + b[i] * (i / n) for i in range(n)]


def claps(rnd, n, count):
    out = [0.0] * n
    for _ in range(count):
        start = int(rnd.uniform(0.05, 0.75) * n)
        length = int(0.03 * RATE)
        amp = rnd.uniform(0.3, 0.7)
        for k in range(length):
            if start + k < n:
                out[start + k] += amp * rnd.uniform(-1, 1) * math.exp(-k / (0.006 * RATE))
    return bandpass(out, 1500, 1800)


def whistle(rnd, n):
    out = [0.0] * n
    start, length = int(0.1 * n), int(0.5 * n)
    phase = 0.0
    for k in range(length):
        t = k / length
        f = 1900 + 700 * math.sin(math.pi * t)  # a rising-falling wolf whistle shape, not a tune
        phase += f / RATE
        if start + k < n:
            out[start + k] = 0.25 * math.sin(2 * math.pi * phase) * math.sin(math.pi * t)
    return out


def render(name, r, seed):
    rnd = random.Random(seed)
    n = int(r["length"] * RATE)
    src = voices_source(r, rnd, n)
    for i in range(n):
        src[i] += r["breath"] * r["voices"] * rnd.uniform(-1, 1)  # breathy crowd air
    mix = vowel(src, *r["vowels"])
    env = [curve(r["env"], i / n) for i in range(n)]
    mix = [m * e for m, e in zip(mix, env)]
    peak = max(1e-9, max(abs(v) for v in mix))
    mix = [v / peak for v in mix]
    if r["claps"]:
        c = claps(rnd, n, r["claps"])
        cp = max(1e-9, max(abs(v) for v in c))
        mix = [m + 0.45 * v / cp for m, v in zip(mix, c)]
    if r["whistle"]:
        mix = [m + v for m, v in zip(mix, whistle(rnd, n))]
    peak = max(1e-9, max(abs(v) for v in mix))
    return [PEAK * v / peak for v in mix]


def write(path, samples):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32767)) for s in samples))


def main():
    only = set(sys.argv[1:])
    unknown = only - set(RECIPES)
    if unknown:
        print(f"unknown: {', '.join(sorted(unknown))}; known: {', '.join(RECIPES)}", file=sys.stderr)
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    for name, r in RECIPES.items():
        if only and name not in only:
            continue
        for v in range(1, r["variants"] + 1):
            path = OUT / f"crowd_{name}_{v}.wav"
            write(path, render(name, r, seed=sum(map(ord, name)) * 100 + v))  # stable: same crowd every run
            print(f"[ OK ] {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
