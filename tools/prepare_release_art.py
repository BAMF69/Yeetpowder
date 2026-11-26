"""Copy the approved, already optimized weapons/equipment into production; verify source hashes."""
import argparse, hashlib, json, shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
LISTINGS = {
    "glock-17": "https://www.meshy.ai/posts/019d4448-3c8b-7b72-933a-80dddd856d44",
    "sniper": "https://www.meshy.ai/posts/019d6a6f-a0bd-7c52-bbcf-8f385dc7964f",
    "minigun": "https://www.meshy.ai/posts/019bb5aa-afb4-71de-9342-fd1942198191",
}
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    parser=argparse.ArgumentParser();parser.add_argument("--check",action="store_true");args=parser.parse_args()
    rows=[]
    for row in json.loads((ROOT/"docs/licenses/art-preview-sources.json").read_text()):
        name=Path(row["preview"]).stem
        if name=="weathered-shotgun": continue
        source=ROOT/row["source"]; preview=ROOT/row["preview"]
        assert digest(source)==row["sourceSha256"],source
        assert digest(preview)==row["previewSha256"],preview
        target=ROOT/"public/assets/models/approved"/Path(row["preview"]).relative_to("assets_src/runtime-preview")
        if not args.check:
            target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(preview,target)
        assert target.is_file() and digest(target)==row["previewSha256"],target
        rows.append({"source":row["source"],"runtime":target.relative_to(ROOT).as_posix(),"sourceSha256":row["sourceSha256"],"runtimeSha256":digest(target),
            "runtimeBytes":target.stat().st_size,"license":"CC0-1.0","releaseEnabled":True,"aiAssisted":"pre-generated",
            "provenance":"Shane confirmed these approved gun/equipment exports are CC0 Meshy community models on 2026-11-26.",
            "listing":LISTINGS.get(name),"notes":"Listing not individually supplied for this export; user-supplied CC0 provenance applies." if name not in LISTINGS else "Source listing recorded in docs/ASSET_SHOPPING.md.",
            "modifications":"Textures optimized to 1024 JPEG; original meshes, anchors, materials and metadata retained. Runtime weapon fitting and shield viewport cutout."})
    manifest=ROOT/"docs/licenses/weapon-sources.json"
    if args.check: assert json.loads(manifest.read_text())==rows,"Runtime asset manifest is stale"
    else: manifest.write_text(json.dumps(rows,indent=2)+"\n",encoding="utf-8")
    print(f"Verified {len(rows)} production models, {sum(row['runtimeBytes'] for row in rows):,} bytes.")
if __name__=="__main__": main()
