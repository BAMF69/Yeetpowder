"""Stage the reviewed arena scenery for production and write its provenance manifest.

Two families, both verified 2026-11-26 (docs/ASSET_LOG.md A-0019 and A-0026):
  * 17 original vinish.dev GLBs (CC BY 4.0): copied byte-for-byte, embedded attribution and clips retained.
  * 14 community remeshes: CC0 Meshy community listings (author, licence and, where the page shows it, the exact
    face count of the original download checked against the listing), remeshed on the project's Meshy account.
    The Shipping Container retry is a remesh of the vinish.dev "Shipping Container" (CC BY 4.0): it carries that
    credit and the change notice. Runtime copies get 1024 px JPEG base colour (512 px for the small drum; other maps 512 px) through
    tools/slim_glb.mjs, then their provenance is written into asset.copyright/asset.extras. Geometry, materials and
    node data are unchanged.

Usage: python tools/prepare_scenery.py          (re-create runtime copies and the manifest)
       python tools/prepare_scenery.py --check  (verify sources, runtime copies and the manifest; writes nothing)
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'docs/licenses/scenery-sources.json'
REVIEWED = '2026-11-26'
VINISH = ['industrial/industrial-mixer', 'industrial/belt-conveyor', 'industrial/portable-toilet', 'industrial/skip',
          'industrial/wooden-crate', 'industrial/cement-mixer', 'industrial/cyclone-dust-collector',
          'industrial/fuel-can', 'industrial/industrial-air-compressor', 'industrial/scaffold',
          'industrial/site-fence', 'industrial/steel-beams', 'industrial/supply-crate', 'industrial/wooden-pallet',
          'junkyard/oil-drum', 'island/crab', 'island/sea-turtle']
MESHY_TERMS = 'https://www.meshy.ai/terms-of-use'
CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/'
# name: (title, creator, listing, original download, listing faces or None when the page shows none, remesh task)
COMMUNITY = {
    'box-truck': ('box-truck-3d', 'MeshMint', 'https://www.meshy.ai/posts/019fb159-6051-7d69-b61a-6c41423455c2',
                  'Meshy_AI_box_truck_3d_20260729_image-to-3d-texture.glb', 632578, '01a21329-6ca4-7637-b6c3-11e88376e639'),
    'burned-out-truck': ('Burned Out Truck', 'danil.f7lipok', 'https://www.meshy.ai/posts/Burned-Out-Truck-01a00257-155b-76dd-b9a8-52e1ebef0e41',
                         'Meshy_AI_Burned_Out_Truck_1124082301_texture.glb', 1947578, '01a2134f-3609-76e1-addc-c8462daa2399'),
    'charred-car': ('Charred Car Remnant', 'dividebytube', 'https://www.meshy.ai/posts/019d2ad6-8159-7bca-82f2-e0945778d4c6',
                    'Meshy_AI_Charred_Car_Remnant_1124082215_texture.glb', 3883268, '01a2135c-9fcc-775d-8b96-f11fd63f102d'),
    'forklift-3000': ('Yellow Forklift', 'andrea.anastasi2', 'https://www.meshy.ai/posts/019c68c5-b0db-7b76-a01a-6495d343a327',
                      'Meshy_AI_Yellow_Forklift_20260216_texture.glb', 979152, '01a21124-fa4c-7094-a479-bcf01f33009e'),
    'fuel-drum': ('Rusted Fuel Drum', 'theanh75', 'https://www.meshy.ai/posts/019e8174-973c-7684-9503-84c429725629',
                  'Meshy_AI_Rusted_Fuel_Drum_20260601_texture.glb', 314768, '01a210fd-debd-74a9-8370-cabed599867c'),
    'granite-boulder': ('Cracked Granite Boulder', 'axx.s', 'https://www.meshy.ai/posts/019d55bb-e8b7-70d5-81b1-359081bf56ee',
                        'Meshy_AI_Cracked_Granite_Boulder_20260401_texture.glb', None, '01a2132a-8caa-766c-89e5-6efc446b557a'),
    'leaning-palm': ('Leaning Palm Tree', 'erick.estrada1531', 'https://www.meshy.ai/posts/019f91f8-ff82-7aaf-bb1b-63cf1a4af99a',
                     'Meshy_AI_Leaning_Palm_Tree_20260722_texture.glb', 8008, '01a212f3-d3bc-70f3-b125-445862466acb'),
    'rusty-car-stack': ('Rusty Car Stack', 'Xefero', 'https://www.meshy.ai/posts/019ee8e0-bd3e-772c-b697-4160bd7e6f28',
                        'Meshy_AI_Rusty_Car_Stack_20260621_texture.glb', 302997, '01a21329-5704-72cc-adae-591a4acfbab0'),
    'rusty-van': ('Rusty Van Model', 'venport', 'https://www.meshy.ai/posts/019b470d-295f-7638-ae24-45a2dfc44706',
                  'Meshy_AI_Rusty_Van_Model_20251215_texture.glb', 1369936, '01a2133b-de25-77ae-bdce-3b5d8a22ccb1'),
    'sea-stack': ('Towering Sea Stack', 'gamexgroup', 'https://www.meshy.ai/posts/019e46bc-018a-73a9-bb4f-72eac3e95d58',
                  'Meshy_AI_Towering_Sea_Stack_20260519_texture.glb', 15770, '01a2132a-9038-722a-89c2-22c9b4e64a92'),
    'stylized-palm': ('Stylized Low-Poly Palm', 'ey_gen', 'https://www.meshy.ai/posts/019604db-50e0-72cb-b154-0864af6b9e49',
                      'Meshy_AI_Generate_a_stylized_very_low_poly_palm_20250405_texture.glb', None, '01a21359-150c-7446-82a8-6e4d6e112e90'),
    'wrecked-car': ('wrecked_car_2', 'dividebytube', 'https://www.meshy.ai/posts/019d4064-a66e-7b40-b549-9e7d99a71962',
                    'Meshy_AI_wrecked_car_2_1124082230_texture.glb', 882140, '01a212f4-204f-7353-8420-4e78cb7f84cc'),
    'yellow-crane-6000': ('Yellow Giant Crane', 'danil.f7lipok', 'https://www.meshy.ai/posts/Yellow-Giant-Crane-01a09323-d2a0-76dd-ad7d-4e2600b7ca4e',
                          'Meshy_AI_Yellow_Giant_Crane_20260911_texture.glb', 1979110, '01a2134d-f48f-7041-b03a-ee51a02e8834'),
}
CONTAINER_TASK = '01a2134c-c1d3-740b-aa90-cff9faabcd7c'
TEXTURE = {'fuel-drum': 512}
# metal/roughness and emissive maps: 512 px halves GPU memory per model with no visible loss at arena distances
SECONDARY = 512


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_glb(data: bytes):
    if data[:4] != b'glTF':
        raise ValueError('GLB missing (fetch its Git LFS object)')
    length = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + length]), data[20 + length:]


def write_json_chunk(data: bytes, gltf) -> bytes:
    """Replace only the JSON chunk; the BIN chunk (geometry and textures) is kept byte for byte."""
    _, rest = read_glb(data)
    text = json.dumps(gltf, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    body = struct.pack('<II', len(text), 0x4E4F534A) + text + rest
    return struct.pack('<III', 0x46546C67, 2, 12 + len(body)) + body


def triangles(gltf) -> int:
    total = 0
    for mesh in gltf.get('meshes', []):
        for p in mesh['primitives']:
            total += gltf['accessors'][p['indices'] if 'indices' in p else p['attributes']['POSITION']]['count'] // 3
    return total


def community_metadata(name: str):
    if name == 'shipping-container-2000':
        credit = ('"Shipping Container" by vinish.dev (https://vinish.dev/free-3d-models/), CC BY 4.0; '
                  'remeshed to 1,161 triangles and texture-optimised for Yeetpowder')
        return credit, {'title': 'Shipping Container (remesh)', 'author': 'vinish.dev', 'license': 'CC BY 4.0',
                        'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/', 'source': 'https://vinish.dev/free-3d-models/',
                        'credit': credit, 'modification': f'Meshy remesh task {CONTAINER_TASK}; base colour resized to 1024 px JPEG, other maps to {SECONDARY} px.'}
    title, author, listing, _, _, task = COMMUNITY[name]
    credit = f'"{title}" by {author} (Meshy community, {listing}), CC0 1.0'
    return credit, {'title': title, 'author': author, 'license': 'CC0 1.0', 'licenseUrl': CC0, 'source': listing,
                    'credit': credit, 'modification': f'Meshy remesh task {task}; base colour resized to {TEXTURE.get(name, 1024)} px JPEG, other maps to {min(SECONDARY, TEXTURE.get(name, 1024))} px.'}


def stage_community(name: str, source: Path, target: Path) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        slim = Path(tmp) / 'slim.glb'
        subprocess.run(['node', 'tools/slim_glb.mjs', str(source), str(slim), '--size', str(TEXTURE.get(name, 1024)),
                        '--secondary-size', str(SECONDARY), '--quality', '0.85'], cwd=ROOT, check=True, capture_output=True)
        data = slim.read_bytes()
    gltf, _ = read_glb(data)
    credit, extras = community_metadata(name)
    gltf['asset']['copyright'] = credit
    gltf['asset']['extras'] = {**gltf['asset'].get('extras', {}), **extras}
    out = write_json_chunk(data, gltf)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(out)
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='verify only; write nothing')
    args = parser.parse_args()
    rows = []
    for name in VINISH:
        source = ROOT / f'assets_src/approved-art/vinish/{name}.glb'
        data = source.read_bytes()
        extras = read_glb(data)[0]['asset'].get('extras', {})
        if extras.get('author') != 'vinish.dev' or extras.get('license') != 'CC BY 4.0' or extras.get('source') != 'https://vinish.dev/free-3d-models/':
            raise ValueError(f'{source}: source/license must be reviewed before staging')
        target = ROOT / f'public/assets/models/scenery/vinish/{name}.glb'
        if not args.check:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
        assert target.read_bytes() == data, f'{target}: runtime copy must equal the original'
        rows.append({'sourceFile': source.relative_to(ROOT).as_posix(), 'runtimeFile': target.relative_to(ROOT).as_posix(),
                     'bytes': len(data), 'sha256': digest(data), 'title': extras['title'], 'author': extras['author'],
                     'source': extras['source'], 'license': extras['license'], 'licenseUrl': extras['licenseUrl'],
                     'credit': read_glb(data)[0]['asset']['copyright'], 'triangles': triangles(read_glb(data)[0]),
                     'modification': 'Original file unchanged. Runtime placement, rotation, uniform scale and gameplay collider.'})
    for name in [*COMMUNITY, 'shipping-container-2000']:
        source = ROOT / f'assets_src/approved-art/scenery/{name}.glb'
        target = ROOT / f'public/assets/models/scenery/community/{name}.glb'
        data = source.read_bytes()
        out = target.read_bytes() if args.check else stage_community(name, source, target)
        gltf = read_glb(out)[0]
        credit, extras = community_metadata(name)
        assert gltf['asset'].get('copyright') == credit, f'{target}: provenance metadata missing or stale'
        original = read_glb(data)[0]
        for field in ('meshes', 'nodes', 'accessors', 'materials'):
            assert gltf.get(field) == original.get(field), f'{target}: {field} changed'
        row = {'sourceFile': source.relative_to(ROOT).as_posix(), 'runtimeFile': target.relative_to(ROOT).as_posix(),
               'sourceBytes': len(data), 'sourceSha256': digest(data), 'bytes': len(out), 'sha256': digest(out),
               'title': extras['title'], 'author': extras['author'], 'source': extras['source'], 'license': extras['license'],
               'licenseUrl': extras['licenseUrl'], 'credit': credit, 'triangles': triangles(gltf),
               'modification': extras['modification'] + ' Geometry, materials and nodes unchanged; provenance written to asset metadata. Runtime placement, rotation, uniform scale and gameplay collider.'}
        if name in COMMUNITY:
            _, _, listing, download, faces, task = COMMUNITY[name]
            row.update({'aiAssisted': 'pre-generated', 'termsUrl': MESHY_TERMS, 'originalDownload': download,
                        'listingFaces': faces, 'remeshTask': task,
                        'evidence': 'Listing JSON-LD 3DModel licence is CC0 1.0 with this creator (checked 2026-11-26); original download name matches the listing title'
                                    + (f' and its {faces:,} faces match the listing' if faces else '; listing page shows no face count')
                                    + '; staged file equals the recorded remesh output (meshy-pilot task metadata).'})
        else:
            row.update({'aiAssisted': 'pre-generated', 'originalDownload': 'shipping-container.glb (vinish.dev original, embedded CC BY 4.0 metadata)',
                        'remeshTask': CONTAINER_TASK,
                        'evidence': 'Remesh input is the vinish.dev Shipping Container with embedded CC BY 4.0 attribution; staged file equals the recorded remesh output.'})
        rows.append(row)
    manifest = {'reviewed': REVIEWED, 'publisherLicense': 'https://vinish.dev/free-3d-models/', 'communityTerms': MESHY_TERMS, 'assets': rows}
    if args.check:
        assert json.loads(MANIFEST.read_text(encoding='utf-8')) == manifest, 'docs/licenses/scenery-sources.json is stale'
    else:
        MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    total = sum(r['bytes'] for r in rows)
    print(f'{"Verified" if args.check else "Staged"} {len(rows)} scenery models ({len(VINISH)} vinish.dev originals, '
          f'{len(rows) - len(VINISH)} community remeshes), {total:,} runtime bytes; credits and clips retained.')


if __name__ == '__main__':
    main()
