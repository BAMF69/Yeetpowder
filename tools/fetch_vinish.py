"""Fetch Yeetpowder's selected CC BY 4.0 Vinish assets, preserving originals and presets.

Run: python tools/fetch_vinish.py. Sources and SHA-256 hashes go beside the assets.
Pink recolouring happens in the renderer, so the PNGs remain unmodified.
"""
import hashlib
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VFX = {
    "muzzle-flashes": ["muzzle_flash_front_loop"],
    "hit-flashes-and-impacts": ["hit_star_flash"],
    "explosions": ["explosion_cartoon"],
    "sword-slashes-and-trails": ["sword_slash_arc"],
}
SFX = {
    "impacts-and-punches": ["bonk_cartoon", "body_fall", "sword_clash"],
    "whooshes-and-swings": ["sword_swing_light", "sword_swing_heavy"],
    "explosions": ["explosion_cartoon", "explosion_grenade"],
}


def download(url):
    # The CDN rejects Python's default HTTP client; curl follows its normal public download links.
    return subprocess.check_output(["curl.exe" if os.name == "nt" else "curl",
        "-sS", "-L", "--fail", "--max-time", "30", "-A", "Mozilla/5.0",
        "-e", "https://vinish.dev/", url])


def main():
    records = []
    for kind, groups, host, dest in [
        ("vfx", VFX, "vinish-vfx.pages.dev", "public/assets/vfx/vinish"),
        ("sound-effects", SFX, "vinish-sounds.pages.dev", "public/assets/audio/sfx/vinish"),
    ]:
        folder = ROOT / dest
        folder.mkdir(parents=True, exist_ok=True)
        for category, names in groups.items():
            for name in names:
                for suffix in (["_sheet_1024.png", ".json"] if kind == "vfx" else [".ogg"]):
                    filename = name + suffix
                    url = f"https://{host}/{category}/{filename}"
                    data = download(url)
                    if suffix.endswith("png") and not data.startswith(b"\x89PNG\r\n\x1a\n"):
                        raise ValueError(f"Not a PNG: {url}")
                    if suffix == ".ogg" and not data.startswith(b"OggS"):
                        raise ValueError(f"Not an OGG: {url}")
                    if suffix == ".json":
                        json.loads(data)
                    (folder / filename).write_bytes(data)
                    records.append(dict(file=f"{dest}/{filename}", url=url,
                                        source=f"https://vinish.dev/free-{kind}/{category}",
                                        sha256=hashlib.sha256(data).hexdigest(), bytes=len(data)))
                    print(f"{filename}: {len(data):,} bytes")
    license_dir = ROOT / "docs/licenses"
    license_dir.mkdir(exist_ok=True)
    (license_dir / "vinish-CC-BY-4.0.txt").write_bytes(download("https://creativecommons.org/licenses/by/4.0/legalcode.txt"))
    (license_dir / "vinish-sources.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    # Full page snapshots are local evidence, not game content or license text.
    cache = ROOT / ".asset_cache/vinish"
    cache.mkdir(parents=True, exist_ok=True)
    for path in ["free-vfx/muzzle-flashes", "free-sound-effects"]:
        (cache / (path.replace("/", "-") + ".html")).write_bytes(download(f"https://vinish.dev/{path}"))


if __name__ == "__main__":
    main()
