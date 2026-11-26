"""Stage only the eight provenance-verified original Vinish props; preserve GLB metadata/clips byte-for-byte."""
import hashlib
import json
from pathlib import Path
import shutil
import struct

ROOT = Path(__file__).resolve().parents[1]
FILES = ['industrial/industrial-mixer', 'industrial/belt-conveyor', 'industrial/portable-toilet',
         'industrial/skip', 'industrial/wooden-crate', 'junkyard/oil-drum', 'island/crab', 'island/sea-turtle']

def main():
    rows = []
    for name in FILES:
        source = ROOT / f'assets_src/approved-art/vinish/{name}.glb'
        data = source.read_bytes()
        if data[:4] != b'glTF':
            raise ValueError(f'{source}: GLB missing (fetch its Git LFS object)')
        metadata = json.loads(data[20:20 + struct.unpack_from('<I', data, 12)[0]])['asset']
        extras = metadata.get('extras', {})
        if extras.get('author') != 'vinish.dev' or extras.get('license') != 'CC BY 4.0' or extras.get('source') != 'https://vinish.dev/free-3d-models/':
            raise ValueError(f'{source}: source/license must be reviewed before staging')
        target = ROOT / f'public/assets/models/scenery/vinish/{name}.glb'
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        rows.append({'sourceFile': source.relative_to(ROOT).as_posix(), 'runtimeFile': target.relative_to(ROOT).as_posix(),
                     'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'title': extras['title'],
                     'author': extras['author'], 'source': extras['source'], 'license': extras['license'],
                     'licenseUrl': extras['licenseUrl'], 'credit': metadata['copyright'],
                     'modification': 'Original file unchanged. Runtime placement, rotation and uniform scale.'})
    evidence = ROOT / 'docs/licenses/scenery-sources.json'
    evidence.parent.mkdir(parents=True, exist_ok=True)
    evidence.write_text(json.dumps({'reviewed': '2026-11-25', 'publisherLicense': 'https://vinish.dev/free-3d-models/', 'assets': rows}, indent=2) + '\n', encoding='utf-8')
    print(f'Staged {len(rows)} verified Vinish originals, {sum(r["bytes"] for r in rows):,} bytes; clips and attribution retained.')

if __name__ == '__main__':
    main()
