#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# yeet_music.py
# Purpose : Yeetpowder's match music, written as a chiptune song in code (GDD music: surf-rock and spy-jazz):
#           a surf intro riff, a tremolo-picked surf melody, a walking-bass spy bridge and a turnaround, looping.
#           The melody is original (E harmonic minor); it quotes no existing theme.
# Usage   : python tools/audio/yeet_music.py     # writes assets_src/audio/music/theme.song.json, renders
#                                                 # public/assets/audio/music/theme.wav (looping, smpl chunk)
# Needs   : Python 3.8+ only (Wavesmith's chiptune renderer)
# Notes   : 16 steps per bar (steps_per_beat 4). bar() checks every bar is exactly 16 steps, so a typo fails here
#           with the pattern and bar named, not as a silent misalignment. Tempo and the mix are in SONG below.
#           data/music.json describes the track for the game's music player (bars must match: BARS).
# Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
# ---------------------------------------------------------------------------
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets_src" / "audio" / "music" / "theme.song.json"
OUT = ROOT / "public" / "assets" / "audio" / "music" / "theme.wav"
WAVESMITH = ROOT / "tools" / "audio" / "wavesmith" / "wavesmith.py"
BPM = 168
STEPS = 16


def bar(s: str, where: str) -> str:
    n = len(s.split())
    if n != STEPS:
        sys.exit(f"[FAIL] {where}: {n} steps, want {STEPS}: {s!r}")
    return s


def bars(rows, where):
    return " | ".join(bar(r, f"{where} bar {i + 1}") for i, r in enumerate(rows))


REST = ". . . . . . . . . . . . . . . ."
SURF_BEAT = "k . h . s . h . k . h k s . h ."

PATTERNS = {
    # intro: the band kicks in, bass riff on driving eighths
    "A": {
        "lead": [REST, REST],
        "rhythm": [REST, REST],
        "bass": ["E2 . E2 . G2 . E2 . A2 . G2 . F#2 . E2 .", "E2 . E2 . G2 . E2 . B2 . A2 . G2 . F#2 ."],
        "drums": ["k . h . s . h . k k h . s . h .", "k . h . s . h . k k h . s s s s"],
    },
    # the surf melody: tremolo picking (every sixteenth re-struck) over Em, B, Am-C, B7
    "B": {
        "lead": ["E5 E5 E5 E5 E5 E5 E5 E5 G5 G5 G5 G5 F#5 F#5 E5 E5",
                 "D#5 D#5 D#5 D#5 E5 E5 E5 E5 B4 B4 B4 B4 B4 B4 - -",
                 "C5 C5 C5 C5 B4 B4 B4 B4 A4 A4 A4 A4 G4 G4 A4 A4",
                 "B4 B4 B4 B4 B4 B4 B4 B4 - - - - . . . ."],
        "rhythm": ["E4 G4 B4 G4 E4 G4 B4 G4 E4 G4 B4 G4 E4 G4 B4 G4",
                   "B3 D#4 F#4 D#4 B3 D#4 F#4 D#4 B3 D#4 F#4 D#4 B3 D#4 F#4 D#4",
                   "A3 C4 E4 C4 A3 C4 E4 C4 C4 E4 G4 E4 C4 E4 G4 E4",
                   "B3 D#4 F#4 A4 B3 D#4 F#4 A4 B3 D#4 F#4 A4 B3 D#4 F#4 A4"],
        "bass": ["E2 . E2 . E2 . E2 . G2 . G2 . F#2 . F#2 .",
                 "B1 . B1 . B1 . B1 . D#2 . D#2 . F#2 . F#2 .",
                 "A1 . A1 . C2 . C2 . E2 . E2 . D2 . D2 .",
                 "B1 . B1 . D#2 . D#2 . F#2 . F#2 . B1 . B1 ."],
        "drums": [SURF_BEAT, SURF_BEAT, SURF_BEAT, "k . s . s . s s s s s s c . . ."],
    },
    # the spy bridge: walking quarter-note bass, muted staccato lead, offbeat comping, a ride-like hat
    "C": {
        "lead": [". . B4 . . . D5 . E5 - . . . . . .",
                 ". . D5 . . . E5 . G5 - - - F#5 . . .",
                 ". . C5 . . . E5 . G5 . . . A5 - . .",
                 "B5 - - - A5 . G5 . F#5 . D#5 . B4 - - ."],
        "rhythm": [". . G4 . . . . . . . G4 . . . . .",
                   ". . A4 . . . . . . . G4 . . . . .",
                   ". . E4 . . . . . . . G4 . . . . .",
                   ". . F#4 . . . . . . . A4 . . . . ."],
        "bass": ["E2 - - . G2 - - . A2 - - . Bb2 - - .",
                 "B2 - - . A2 - - . G2 - - . E2 - - .",
                 "C2 - - . E2 - - . G2 - - . A2 - - .",
                 "B1 - - . D#2 - - . F#2 - - . B2 - - ."],
        "drums": ["k . . h s . . h k . . h s . h .", "k . . h s . . h k . . h s . h .",
                  "k . . h s . . h k . . h s . h .", "k . . h s . . h k . s . s s s s"],
    },
    # turnaround back to the top
    "D": {
        "lead": ["E5 - - - D#5 - - - E5 - - - B4 - - -", "E5 E5 E5 E5 E5 E5 E5 E5 - - - - . . . ."],
        "rhythm": ["E4 G4 B4 G4 E4 G4 B4 G4 C4 E4 G4 E4 B3 D#4 F#4 D#4", REST],
        "bass": ["E2 . B1 . E2 . B1 . C2 . B1 . A1 . B1 .", "E2 . E2 . E2 . . . E1 - - - . . . ."],
        "drums": ["k . h . s . h . k . h . s s s s", "k . . . c . . . k . . . . . . ."],
    },
}
ORDER = ["A", "B", "B", "C", "C", "B", "D"]

SONG = {
    "bpm": BPM, "steps_per_beat": 4, "loop": True, "rate": 22050, "seed": 7,
    "channels": {
        # a twangy surf lead: thin pulse, quick decay so each tremolo stroke is heard
        "lead": {"wave": "square", "duty": 0.25, "volume": 0.27, "attack": 0.002, "decay": 0.09, "sustain": 0.45,
                 "release": 0.03, "vibrato": [0.1, 6.0, 0.15]},
        "rhythm": {"wave": "square", "duty": 0.5, "volume": 0.11, "attack": 0.002, "decay": 0.06, "sustain": 0.3,
                   "release": 0.03},
        "bass": {"wave": "triangle", "volume": 0.5, "sustain": 0.8, "release": 0.03},
        "drums": {"wave": "drums", "volume": 0.5},
    },
}

BARS = sum(len(PATTERNS[p]["bass"]) for p in ORDER)


def main() -> int:
    song = dict(SONG)
    song["patterns"] = {name: {ch: bars(rows, f"{name}.{ch}") for ch, rows in p.items()} for name, p in PATTERNS.items()}
    song["order"] = ORDER
    SRC.parent.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    SRC.write_text(json.dumps(song, indent=1) + "\n", encoding="utf-8")
    res = subprocess.run([sys.executable, str(WAVESMITH), "chiptune", str(SRC), "--out", str(OUT)], capture_output=True, text=True)
    print(res.stdout.strip())
    if res.returncode != 0:
        print(res.stderr, file=sys.stderr)
        return res.returncode
    print(f"[ OK ] {OUT.relative_to(ROOT)}: {BARS} bars at {BPM} bpm ({BARS * 4 * 60 / BPM:.1f} s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
