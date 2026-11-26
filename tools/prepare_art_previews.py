"""Make small, development-only copies of the accepted previews without changing meshes, anchors or source files."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
WEAPONS = ['glock-17', 'sniper', 'minigun', 'at-2x-launcher', 'at-2x-rocket', 'shotgun-existing', 'weathered-shotgun', 'ballistic-shield']
SOURCES = [(f'approved-art/weapons/{name}', f'weapons/{name}') for name in WEAPONS]
SOURCES += [(f'additional-art/{name}', f'equipment/{name}') for name in ['grenade', 'health-pack']]

def main():
    rows = []
    for original, name in SOURCES:
        source = ROOT / f'assets_src/{original}.glb'
        target = ROOT / f'assets_src/runtime-preview/{name}.glb'
        target.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['node', 'tools/slim_glb.mjs', str(source), str(target), '--size', '1024', '--quality', '0.85'], cwd=ROOT, check=True)
        rows.append({'source': source.relative_to(ROOT).as_posix(), 'preview': target.relative_to(ROOT).as_posix(),
                     'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'previewSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                     'sourceBytes': source.stat().st_size, 'previewBytes': target.stat().st_size,
                     'releaseEnabled': False, 'licenseStatus': 'Exact source/export provenance pending; development review only.'})
    (ROOT / 'docs/licenses/art-preview-sources.json').write_text(json.dumps(rows, indent=2) + '\n', encoding='utf-8')
    print(f'Prepared {len(rows)} local previews: {sum(r["sourceBytes"] for r in rows):,} -> {sum(r["previewBytes"] for r in rows):,} bytes. Not release assets.', flush=True)

if __name__ == '__main__': main()
