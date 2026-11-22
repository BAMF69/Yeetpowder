#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# announcer.py
# Purpose : Brings Elaina's recorded announcer lines into the game: each recording is mixed to mono, trimmed of
#           the silence around it, cleaned of rumble, optionally given a stadium PA punch and an arena slap-back,
#           levelled, and written to public/assets/audio/vo/; then the voice events (vo_<id>, dialogue bus) and the
#           lines' audio in data/dialogue.json are updated and the subtitle file is rebuilt. The game's announcer
#           (YeetWorld.announce) speaks every line that has a file and stays silent for the rest.
# Usage   : record the lines (LINES below) as assets_src/voice/announcer/<id>.wav (or .flac / .ogg), then
#             python tools/audio/announcer.py              # import every recording found
#             python tools/audio/announcer.py --pa --echo  # with the PA punch and the arena slap-back
#             python tools/audio/announcer.py --list       # the lines to record, and which are done
# Needs   : Python 3.8+ only. Phone formats (.m4a, .mp3) need ffmpeg; without it, record WAV (Windows Sound
#           Recorder: Settings > Recording format > WAV) or convert first.
# Notes   : Your own voice needs no permission (it is recorded as origin "self" in ASSET_LOG). Rerun after any new
#           take: it overwrites the game files from the recordings, which stay the source of truth.
# Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
# ---------------------------------------------------------------------------
#
# Pseudocode
#   for each line id with a recording: read -> mono -> remove DC -> trim (first/last sample above peak - 36 dB, padded)
#     -> high-pass 90 Hz -> [--pa: band 160 Hz..6 kHz + soft saturation] -> [--echo: 85 ms slap-back] -> fade edges
#     -> normalize to -3 dBFS peak -> write vo/announcer_<id>.wav
#   rewrite the vo_ events in audio_events.json and the audio fields in dialogue.json -> dialogue build
import argparse
import json
import math
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "audio" / "wavesmith"))
from audioio import AudioIOError, read_audio  # noqa: E402
from wavfile import write_wav  # noqa: E402

SRC = ROOT / "assets_src" / "voice" / "announcer"
OUT = ROOT / "public" / "assets" / "audio" / "vo"
EVENTS = ROOT / "data" / "audio_events.json"
DIALOGUE = ROOT / "data" / "dialogue.json"
BUILT = ROOT / "data" / "dialogue" / "en.built.json"
WAVESMITH = ROOT / "tools" / "audio" / "wavesmith" / "wavesmith.py"
EXTS = (".wav", ".flac", ".ogg", ".m4a", ".mp3")

TRIM_DB = -36.0      # below the line's peak: silence
PAD_IN, PAD_OUT = 0.04, 0.09   # seconds kept before and after the speech
FADE = 0.01
PEAK_DB = -3.0


def lines():
    """(id without 'announcer.', text) for every announcer line in dialogue.json."""
    d = json.loads(DIALOGUE.read_text(encoding="utf-8"))
    return [(l["id"].split(".", 1)[1], l["text"]) for l in d["lines"] if l["id"].startswith("announcer.")]


def recording(lid):
    for ext in EXTS:
        p = SRC / f"{lid}{ext}"
        if p.exists():
            return p
    return None


def one_pole_hp(x, rate, hz):
    a = math.exp(-2 * math.pi * hz / rate)
    out, prev_x, prev_y = [0.0] * len(x), 0.0, 0.0
    for i, v in enumerate(x):
        y = a * (prev_y + v - prev_x)
        out[i], prev_x, prev_y = y, v, y
    return out


def one_pole_lp(x, rate, hz):
    a = math.exp(-2 * math.pi * hz / rate)
    out, y = [0.0] * len(x), 0.0
    for i, v in enumerate(x):
        y = (1 - a) * v + a * y
        out[i] = y
    return out


def process(path, pa, echo):
    channels, rate = read_audio(path)
    n = len(channels[0])
    x = [sum(ch[i] for ch in channels) / len(channels) for i in range(n)]
    mean = sum(x) / max(1, n)
    x = [v - mean for v in x]
    peak = max((abs(v) for v in x), default=0.0)
    if peak < 1e-4:
        raise AudioIOError(f"{path.name} is silent")
    gate = peak * 10 ** (TRIM_DB / 20)
    loud = [i for i, v in enumerate(x) if abs(v) > gate]
    a = max(0, loud[0] - int(PAD_IN * rate))
    b = min(n, loud[-1] + int(PAD_OUT * rate))
    x = x[a:b]
    x = one_pole_hp(x, rate, 90)
    if pa:
        # a stadium PA: no boom, no fizz, a little drive so it cuts through gunfire
        x = one_pole_hp(x, rate, 160)
        x = one_pole_lp(x, rate, 6000)
        pk = max(abs(v) for v in x) or 1
        x = [math.tanh(2.2 * v / pk) for v in x]
    if echo:
        d = int(0.085 * rate)
        x = x + [0.0] * (d * 3)
        x = [v + (0.32 * x[i - d] if i >= d else 0) + (0.12 * x[i - 2 * d] if i >= 2 * d else 0) for i, v in enumerate(x)]
    f = int(FADE * rate)
    for i in range(min(f, len(x))):
        x[i] *= i / f
        x[-1 - i] *= i / f
    pk = max(abs(v) for v in x) or 1
    g = 10 ** (PEAK_DB / 20) / pk
    return [v * g for v in x], rate


def update_events(done):
    """Rewrites the vo_ event lines (one line each) just before the events object closes."""
    s = EVENTS.read_text(encoding="utf-8")
    s = re.sub(r'\n  "vo_[a-z_]+": \{[^\n]*\},?(?=\n)', "", s)
    tail = "\n }\n}"
    if not s.rstrip().endswith("}\n}".strip()) or tail not in s:
        sys.exit("[FAIL] data/audio_events.json: could not find the end of the events object")
    body, _ = s.rsplit(tail, 1)
    body = body.rstrip().rstrip(",")
    rows = [f'  "vo_{lid}": {{"bus": "dialogue", "files": ["vo/announcer_{lid}.wav"], "max_voices": 1, "cooldown_ms": 1200}}'
            for lid in done]
    s = body + ("," + "\n" + ",\n".join(rows) if rows else "") + tail + "\n"
    EVENTS.write_text(s, encoding="utf-8")


def update_dialogue(done):
    d = json.loads(DIALOGUE.read_text(encoding="utf-8"))
    for l in d["lines"]:
        lid = l["id"].split(".", 1)[1]
        if lid in done:
            l["audio"] = f"vo/announcer_{lid}.wav"
        else:
            l.pop("audio", None)
    # same layout as written by hand: one line per entry
    rows = ",\n".join("  " + json.dumps(l, ensure_ascii=False) for l in d["lines"])
    speakers = ",\n".join(f"  {json.dumps(k)}: {json.dumps(v)}" for k, v in d["speakers"].items())
    DIALOGUE.write_text('{\n "version": %d,\n "speakers": {\n%s\n },\n "lines": [\n%s\n ],\n "sequences": %s\n}\n'
                        % (d["version"], speakers, rows, json.dumps(d.get("sequences", {}))), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pa", action="store_true", help="stadium PA punch: band-limited, a little drive")
    ap.add_argument("--echo", action="store_true", help="a short arena slap-back")
    ap.add_argument("--list", action="store_true", help="the lines to record and which recordings exist")
    args = ap.parse_args()
    SRC.mkdir(parents=True, exist_ok=True)
    todo = lines()
    if args.list:
        print(f"Record into {SRC.relative_to(ROOT)}/ as <id>.wav:")
        for lid, text in todo:
            print(f"  {'[x]' if recording(lid) else '[ ]'} {lid}.wav  \"{text}\"")
        return 0
    OUT.mkdir(parents=True, exist_ok=True)
    done, failed = [], []
    for lid, text in todo:
        src = recording(lid)
        if not src:
            stale = OUT / f"announcer_{lid}.wav"
            if stale.exists():
                stale.unlink()  # its recording is gone: the recordings are the source of truth
                print(f"[gone] {lid}: removed {stale.relative_to(ROOT)} (no recording)")
            print(f"[skip] {lid}: no recording yet (\"{text}\")")
            continue
        try:
            samples, rate = process(src, args.pa, args.echo)
        except AudioIOError as exc:
            msg = str(exc)
            if "ffmpeg" in msg.lower():
                msg += " (save as WAV instead: Windows Sound Recorder > Settings > Recording format > WAV)"
            failed.append(f"{lid}: {msg}")
            continue
        write_wav(OUT / f"announcer_{lid}.wav", samples, rate)
        done.append(lid)
        print(f"[ OK ] {lid}: {len(samples) / rate:.2f} s from {src.name}")
    update_events(done)
    update_dialogue(done)
    res = subprocess.run([sys.executable, str(WAVESMITH), "dialogue", "build", str(DIALOGUE), "--root",
                          str(ROOT / "public" / "assets" / "audio"), "--events", str(EVENTS), "--out", str(BUILT),
                          "--overwrite"], capture_output=True, text=True)
    print(res.stdout.strip() or res.stderr.strip())
    for f in failed:
        print(f"[FAIL] {f}")
    print(f"{len(done)} of {len(todo)} lines voiced. Reload the game (restart `dev.py run` if it was open).")
    return 1 if failed or res.returncode else 0


if __name__ == "__main__":
    sys.exit(main())
