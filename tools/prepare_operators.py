"""Prepare the CC0 community operator runtime copies; keep originals and skeletons intact."""
import hashlib, json, subprocess, struct
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def main():
    rows = []
    for source in sorted((ROOT / "assets_src/approved-art/operators/rigged").glob("*.glb")):
        target = ROOT / "public/assets/models/operators" / source.name
        target.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["node", "tools/slim_glb.mjs", str(source), str(target), "--size", "1024", "--quality", "0.85"], cwd=ROOT, check=True)
        b = source.read_bytes(); j = json.loads(b[20:20+struct.unpack_from("<I", b, 12)[0]])
        rows.append({"id": source.stem, "source": source.relative_to(ROOT).as_posix(), "runtime": target.relative_to(ROOT).as_posix(),
            "sourceSha256": hashlib.sha256(b).hexdigest(), "runtimeSha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            "sourceBytes": len(b), "runtimeBytes": target.stat().st_size, "joints": len(j["skins"][0]["joints"]),
            "sourceCommit": "8a1f632", "license": "CC0-1.0", "releaseEnabled": True,
            "provenance": "Shane confirmed CC0 community models on 2026-11-25. Individual creator/listing links not supplied.",
            "licenseEvidence": "https://www.meshy.ai/terms-of-use (2026-09-19), section 3.3: Community 3D Customer Output; https://help.meshy.ai/en/articles/10225410-what-are-the-community-guidelines-for-meshy",
            "aiAssisted": "pre-generated", "modifications": "Embedded textures resized to 1024 JPEG; geometry, rig, clips and metadata preserved. Runtime retargeting only."})
    (ROOT / "docs/licenses/operator-sources.json").write_text(json.dumps(rows, indent=2)+"\n", encoding="utf-8")
    print(f"Prepared {len(rows)} operators: {sum(r['sourceBytes'] for r in rows):,} -> {sum(r['runtimeBytes'] for r in rows):,} bytes.", flush=True)
if __name__ == "__main__": main()
