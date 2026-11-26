"""Download selected CC0 Poly Haven PBR maps and provenance. Then run optimize_level_textures.mjs.

Source 1K JPGs stay in .asset_cache; the game ships 512px copies produced by the browser's image encoder.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ASSETS = {"sand": "aerial_sand", "rock": "rock_face_03", "asphalt": "asphalt_03",
          "corrugated": "corrugated_iron", "concrete": "concrete_floor"}


def fetch(url):
    return subprocess.check_output(["curl.exe" if os.name == "nt" else "curl", "-sS", "-L", "--fail",
                                   "--retry", "2", "--max-time", "60", "-A", "YeetpowderAssetIntake/1.0", url])


def main():
    folder = ROOT / ".asset_cache/level-textures"
    folder.mkdir(parents=True, exist_ok=True)
    manifest = []
    for surface, asset in ASSETS.items():
        files = json.loads(fetch(f"https://api.polyhaven.com/files/{asset}"))
        info = json.loads(fetch(f"https://api.polyhaven.com/info/{asset}"))
        (folder / f"{asset}.json").write_text(json.dumps(dict(info=info, files=files), indent=2), encoding="utf-8")
        keys = {k.lower(): k for k in files}
        record = dict(surface=surface, asset=asset, source=f"https://polyhaven.com/a/{asset}",
                      authors=info.get("authors"), license="CC0-1.0", maps={})
        for slot, channel in [("color", "diffuse"), ("normal", "nor_gl"), ("roughness", "rough")]:
            download = files[keys[channel]]["1k"]["jpg"]
            data = fetch(download["url"])
            if hashlib.md5(data).hexdigest() != download["md5"]:
                raise ValueError(f"Source checksum mismatch: {asset} {slot}")
            filename = f"{surface}_{slot}.jpg"
            (folder / filename).write_bytes(data)
            record["maps"][slot] = dict(file=filename, url=download["url"], source_sha256=hashlib.sha256(data).hexdigest())
            print(f"{surface} {slot}: {len(data):,} bytes", flush=True)
        manifest.append(record)
    (folder / "sources.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    licenses = ROOT / "docs/licenses"
    licenses.mkdir(exist_ok=True)
    (licenses / "CC0-1.0.txt").write_bytes(fetch("https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt"))


if __name__ == "__main__":
    main()
