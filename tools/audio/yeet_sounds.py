#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# yeet_sounds.py
# Purpose : Yeetpowder's placeholder sounds, made in code with Wavesmith's synth (retro sfxr-style, no download, no
#           license question: the output is ours). One table of recipes below; this script writes each recipe as
#           JSON (assets_src/audio/, the source of truth) and renders it to public/assets/audio/sfx/*.wav.
# Usage   : python tools/audio/yeet_sounds.py            # render everything (overwrites)
#           python tools/audio/yeet_sounds.py bonk boom  # only these sounds
#           then: python tools/audio/wavesmith/wavesmith.py events validate data/audio_events.json --root public/assets/audio
# Needs   : Python 3.8+ only (Wavesmith is in tools/audio/wavesmith/)
# Notes   : Variants are small pitch/length changes of one recipe, so a sound never repeats identically; the
#           events file adds a pitch range on top. Tune a sound here, rerun, reload the game. Parameters are the
#           synth's (python tools/audio/wavesmith/wavesmith.py synth --list): wave, freq, slide, duty, vibrato_*,
#           repeat, attack, sustain, decay, punch, lowpass, highpass, volume.
# Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
# ---------------------------------------------------------------------------
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SYNTH = ROOT / "tools" / "audio" / "wavesmith" / "wavesmith.py"
SRC = ROOT / "assets_src" / "audio"
OUT = ROOT / "public" / "assets" / "audio" / "sfx"

# name: (recipe, variant multipliers on freq). Comments say what the sound is for.
SOUNDS = {
    # Pea Pistol: a bright cartoon "pew-pop"
    "pea": ({"wave": "square", "freq": 980, "slide": -2.6, "duty": 0.3, "sustain": 0.02, "decay": 0.09,
             "punch": 0.5, "lowpass": 7000, "volume": 0.42}, [1.0, 1.07, 0.94]),
    # Boomstick: a fat noisy BOOM with a long tail
    "boom": ({"wave": "noise", "freq": 95, "slide": -0.9, "sustain": 0.09, "decay": 0.55, "punch": 0.8,
              "lowpass": 2600, "volume": 0.42}, [1.0, 0.9]),
    # Spin Doctor: a sharp KRAK that rings out
    "krak": ({"wave": "noise", "freq": 620, "slide": -2.2, "sustain": 0.025, "decay": 0.4, "punch": 0.9,
              "lowpass": 7000, "highpass": 180, "volume": 0.45}, [1.0, 1.08]),
    # Gatling Copter: one bullet "tk" (plays many times a second)
    "brrt": ({"wave": "noise", "freq": 320, "slide": -1.5, "sustain": 0.008, "decay": 0.045, "punch": 0.6,
              "lowpass": 4500, "volume": 0.4}, [1.0, 1.12, 0.9]),
    # Gatling Copter: the rotor "wup", retriggered while firing so it chops like a helicopter
    "wup": ({"wave": "saw", "freq": 62, "vibrato_depth": 5, "vibrato_rate": 16, "sustain": 0.16, "decay": 0.06,
             "lowpass": 900, "volume": 0.55}, [1.0, 1.05]),
    # a launch: the slide whistle going up ("fweeee!")
    "whistle": ({"wave": "sine", "freq": 420, "slide": 2.2, "vibrato_depth": 0.4, "vibrato_rate": 7,
                 "attack": 0.02, "sustain": 0.42, "decay": 0.12, "volume": 0.42}, [1.0, 1.12, 0.9]),
    # wall bonk: a hollow cartoon BONK
    "bonk": ({"wave": "triangle", "freq": 210, "slide": -1.8, "sustain": 0.03, "decay": 0.26, "punch": 0.9,
              "lowpass": 2400, "volume": 0.5}, [1.0, 1.1, 0.9]),
    # dummy hit: a little thwack
    "thwack": ({"wave": "saw", "freq": 380, "slide": -3.0, "sustain": 0.02, "decay": 0.12, "punch": 0.5,
                "lowpass": 3500, "volume": 0.38}, [1.0, 1.1, 0.9]),
    # dummy knocked out: a comic "boing" as it flies
    "boing": ({"wave": "sine", "freq": 260, "slide": 0.9, "vibrato_depth": 5, "vibrato_rate": 13,
               "sustain": 0.28, "decay": 0.22, "volume": 0.45}, [1.0, 1.1]),
    # hard landing
    "thud": ({"wave": "noise", "freq": 70, "slide": -1.2, "sustain": 0.015, "decay": 0.12, "punch": 0.4,
              "lowpass": 1400, "volume": 0.45}, [1.0, 0.9]),
    # copter overheat: a sputtering alarm
    "sputter": ({"wave": "square", "freq": 760, "slide": -0.8, "duty": 0.3, "vibrato_depth": 3,
                 "vibrato_rate": 19, "repeat": 0.12, "sustain": 0.45, "decay": 0.15, "lowpass": 5000,
                 "volume": 0.36}, [1.0]),
    # copter crash landing: KABOOM
    "kaboom": ({"wave": "noise", "freq": 105, "slide": -0.6, "sustain": 0.15, "decay": 0.95, "punch": 0.7,
                "lowpass": 3000, "volume": 0.45}, [1.0]),
    # weapon switch: a small click
    "click": ({"wave": "square", "freq": 1400, "duty": 0.2, "sustain": 0.012, "decay": 0.03, "volume": 0.28},
              [1.0]),
    # Fight Back: a dummy throws its ball (a rising "fwip")
    "lob": ({"wave": "square", "freq": 300, "slide": 1.8, "duty": 0.4, "sustain": 0.04, "decay": 0.1,
             "lowpass": 4000, "volume": 0.35}, [1.0, 1.08]),
    # a ball splats on a wall
    "splat": ({"wave": "noise", "freq": 240, "slide": -1.6, "sustain": 0.01, "decay": 0.12, "punch": 0.5,
               "lowpass": 2200, "volume": 0.4}, [1.0, 0.9]),
    # you get hit
    "ouch": ({"wave": "saw", "freq": 300, "slide": -2.2, "sustain": 0.03, "decay": 0.16, "punch": 0.6,
              "lowpass": 2500, "volume": 0.45}, [1.0, 0.92]),
    # you are knocked out: a long falling whistle
    "ko": ({"wave": "sine", "freq": 900, "slide": -1.4, "vibrato_depth": 0.6, "vibrato_rate": 8,
            "sustain": 0.7, "decay": 0.25, "volume": 0.42}, [1.0]),
    # picking up a gun
    "pickup": ({"wave": "square", "freq": 660, "arp_mult": 1.5, "arp_time": 0.08, "duty": 0.4, "sustain": 0.12,
                "decay": 0.22, "punch": 0.3, "lowpass": 8000, "volume": 0.38}, [1.0]),
    # a run-and-gun tumble starts: a quick wobbly whistle down
    "tumble": ({"wave": "sine", "freq": 700, "slide": -2.0, "vibrato_depth": 2, "vibrato_rate": 14,
                "sustain": 0.35, "decay": 0.12, "volume": 0.4}, [1.0, 1.1]),
    # a dummy starts glowing: about to shoot
    "alert": ({"wave": "square", "freq": 1100, "duty": 0.3, "repeat": 0.09, "sustain": 0.17, "decay": 0.03,
               "volume": 0.26}, [1.0]),
    # reload starts: a mechanical clack (magazine out)
    "reload": ({"wave": "noise", "freq": 900, "slide": -1.0, "repeat": 0.09, "sustain": 0.16, "decay": 0.05,
                "punch": 0.5, "lowpass": 5000, "highpass": 400, "volume": 0.32}, [1.0]),
    # reload done: a two-tone "chk-chk"
    "loaded": ({"wave": "square", "freq": 700, "arp_mult": 1.6, "arp_time": 0.05, "duty": 0.25, "sustain": 0.06,
                "decay": 0.06, "punch": 0.5, "lowpass": 6000, "volume": 0.3}, [1.0]),
    # pulling the trigger on an empty gun: a dry click
    "dry": ({"wave": "noise", "freq": 1800, "sustain": 0.008, "decay": 0.03, "punch": 0.6, "highpass": 800,
             "volume": 0.3}, [1.0]),
    # dummy respawn: a soft pop-in
    "popin": ({"wave": "square", "freq": 420, "slide": 1.6, "duty": 0.35, "sustain": 0.05, "decay": 0.12,
               "lowpass": 6000, "volume": 0.3}, [1.0]),
}


def render(name: str, recipe: dict, mults: list) -> list:
    files = []
    for i, m in enumerate(mults, start=1):
        r = dict(recipe)
        r["freq"] = round(r["freq"] * m, 2)
        stem = name if len(mults) == 1 else f"{name}_{i}"
        rpath = SRC / f"{stem}.sfx.json"
        wpath = OUT / f"{stem}.wav"
        # the synth reads its numbers from "params" (a flat file silently renders the defaults)
        rpath.write_text(json.dumps({"tool": "sfx_synth", "name": stem, "params": r}, indent=1) + "\n", encoding="utf-8")
        res = subprocess.run([sys.executable, str(SYNTH), "synth", "--from", str(rpath), "--out", str(wpath),
                              "--no-recipe", "--overwrite"], capture_output=True, text=True)
        if res.returncode != 0:
            sys.exit(f"[FAIL] {stem}: {res.stdout}{res.stderr}")
        files.append(f"sfx/{stem}.wav")
    return files


def main() -> int:
    only = set(sys.argv[1:])
    unknown = only - set(SOUNDS)
    if unknown:
        print(f"unknown sound(s): {', '.join(sorted(unknown))}; known: {', '.join(SOUNDS)}", file=sys.stderr)
        return 2
    SRC.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (recipe, mults) in SOUNDS.items():
        if only and name not in only:
            continue
        files = render(name, recipe, mults)
        print(f"[ OK ] {name}: {', '.join(files)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
