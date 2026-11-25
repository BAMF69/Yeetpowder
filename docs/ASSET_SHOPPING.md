# Asset shopping list (Meshy community, CC0)

> Picked 2026-11-24 for the new levels, the operators and the guns still built in code. Every post page lists the
> model under CC0 1.0 (Meshy Terms 3.3). Sign in on meshy.ai, open each link, Download as **GLB**, and save it into
> `Documents/game assets/` under the file name given (so Claude can find it). Claude then remeshes where needed
> (5 credits each), rigs the operators (5 credits each), slims the textures (`tools/slim_glb.mjs`) and logs each one
> in `docs/ASSET_LOG.md` with its link. Tick them off here as you go.

## Operators (T- or A-pose, empty hands; Meshy auto-rig after)
- [ ] `op_tactical.glb` - Tactical Operator: https://www.meshy.ai/posts/01999629-98d4-7ab1-b7d8-58b6af0c531f
- [ ] `op_camo.glb` - Camouflage Soldier: https://www.meshy.ai/posts/019966a7-f194-7505-a1af-c76e36fc602d
- [ ] `op_shadow.glb` - Shadow Vanguard: https://www.meshy.ai/posts/Shadow-Vanguard-01a02fd6-b674-7cdd-8da3-4c3888b3eca2
- [ ] `op_mercenary.glb` - Undercover Mercenary: https://www.meshy.ai/posts/undercover-mercenary-game-ready-3d-tactical-character-01a00f71-043c-73e1-b561-1195cd9c7dc0

## Guns (replace the code-built ones)
- [ ] `gun_pistol.glb` - Glock-17: https://www.meshy.ai/posts/019d4448-3c8b-7b72-933a-80dddd856d44 (or DS-45 MK II: https://www.meshy.ai/posts/019da89f-5c05-7a37-bb5b-40e418eb0e3a)
- [ ] `gun_boomstick.glb` - Old_shotgun: https://www.meshy.ai/posts/019b3fa6-5958-74b8-8a13-3a3261a828d6 (a short double-barrel if you find a better one)
- [ ] `gun_spindoctor.glb` - Rustbound Sniper Rifle: https://www.meshy.ai/posts/019d6a6f-a0bd-7c52-bbcf-8f385dc7964f (or OS5-Sniper: https://www.meshy.ai/posts/019be04f-ad94-744d-9faa-86ea1c351504)
- [ ] `gun_gatling.glb` - Minigun: https://www.meshy.ai/posts/019bb5aa-afb4-71de-9342-fd1942198191 (or MINI-GUN: https://www.meshy.ai/posts/mini-gun-019fbb47-59d3-7f40-8f4d-f1b7eb8e35a3)

## Junkyard
- [ ] `junk_carstack.glb` - Rusty Car Stack: https://www.meshy.ai/posts/019ee8e0-bd3e-772c-b697-4160bd7e6f28
- [ ] `junk_wreck.glb` - wrecked_car_2: https://www.meshy.ai/posts/019d4064-a66e-7b40-b549-9e7d99a71962
- [ ] `junk_charred.glb` - Charred Car Remnant: https://www.meshy.ai/posts/019d2ad6-8159-7bca-82f2-e0945778d4c6
- [ ] `junk_van.glb` - Rusty Van: https://www.meshy.ai/posts/019b470d-295f-7638-ae24-45a2dfc44706
- [ ] `junk_crane.glb` - Yellow Giant Crane: https://www.meshy.ai/posts/Yellow-Giant-Crane-01a09323-d2a0-76dd-ad7d-4e2600b7ca4e

## Industrial Yard
- [ ] `ind_truck.glb` - box-truck-3d: https://www.meshy.ai/posts/019fb159-6051-7d69-b61a-6c41423455c2
- [ ] `ind_truck_wreck.glb` - Burned Out Truck: https://www.meshy.ai/posts/Burned-Out-Truck-01a00257-155b-76dd-b9a8-52e1ebef0e41
- [ ] `ind_tank.glb` - Armored Military Vehicle: https://www.meshy.ai/posts/019ea0ab-6539-7683-888c-a020cbeb80ff
- [ ] `ind_drum.glb` - Rusted Fuel Drum: https://www.meshy.ai/posts/019e8174-973c-7684-9503-84c429725629
- [ ] `ind_barrier.glb` - Concrete Barrier: https://www.meshy.ai/posts/019f420c-4a2f-70a9-a4d0-cd12210099ac
- [ ] `ind_forklift.glb` - Yellow Forklift: https://www.meshy.ai/posts/019c68c5-b0db-7b76-a01a-6495d343a327

## Shark Island
- [ ] `isl_shark.glb` - Shark: https://www.meshy.ai/posts/shark-01a05e8f-9378-72a7-b8ef-0cac71f1bc2f
- [ ] `isl_palm.glb` - Leaning Palm Tree: https://www.meshy.ai/posts/019f91f8-ff82-7aaf-bb1b-63cf1a4af99a (or low-poly: https://www.meshy.ai/posts/019604db-50e0-72cb-b154-0864af6b9e49)
- [ ] `isl_boulder.glb` - Cracked Granite Boulder: https://www.meshy.ai/posts/019d55bb-e8b7-70d5-81b1-359081bf56ee
- [ ] `isl_seastack.glb` - Towering Sea Stack: https://www.meshy.ai/posts/019e46bc-018a-73a9-bb4f-72eac3e95d58

## Tileable ground and wall textures (not Meshy)
Installed 2026-11-24: sand, rock, asphalt, corrugated metal and concrete from Poly Haven, CC0 (ASSET_LOG A-0018).
Five 512 px PBR sets (colour, OpenGL normal, roughness), source provenance in `docs/licenses/terrain-sources.json`.
Re-download with `python tools/fetch_level_textures.py`, then `node tools/optimize_level_textures.mjs`.
