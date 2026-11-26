# Yeetpowder asset integration handoff

Use this prompt to start the integration task:

> Integrate the reviewed game art from `codex/approved-art-assets` in BAMF69/Yeetpowder. Fetch that branch and pull its Git LFS objects. Bring the asset commit into the latest gameplay branch that the user is working on. Preserve their in-progress work.
>
> Yeetpowder is a Three.js, TypeScript, and Vite browser arena shooter built around recoil movement. Read `README.md`, `docs/GDD.md`, `docs/ARCHITECTURE.md`, `docs/ENGINE.md`, `docs/HANDOFF.md`, `docs/ASSET_LOG.md`, and `docs/sop/SOP-11-3d-pipeline.md`. Start by running the project's checks and opening the game. Read the asset inventory below before editing.
>
> Stage the models in-game in small, playable batches. For held weapon visuals, inspect `src/game/yeet/meshyArt.ts`, `gunModels.ts`, `viewmodel.ts`, and `operative.ts`. Calibrate grip, foregrip, muzzle, orientation, and scale for first and third person. Start with the pistol, sniper, rocket launcher, and shield. Compare the two shotgun candidates in gameplay before selecting one. Check the minigun against the existing copter pose. Use the split AT-2X rocket for the rocket projectile visual and the launcher for the held model. These are cosmetic integrations. Preserve existing projectile, collision, recoil, and network behavior. Check the procedural fallback and the `?noart` path.
>
> For operators, inspect `operativeSkin.ts`, `operativePose.ts`, and the loaded operative in `meshyArt.ts`. Confirm pose and rig suitability, then map the rigs and test gameplay poses before enabling each skin. Use the 4,000-target Tactical Shadow and Field Survivor variants. Use the staged Tactical T-Pose Soldier as the first test. The Samurai and Galactic Gunslinger remain pending weapon removal.
>
> For scenery, inspect `src/core/yeet/levels.ts`, `levelsOutdoor.ts`, `levelsParty.ts` where available, `src/game/yeet/props.ts`, and the scene assembly in `YeetWorld.ts`. Place industrial, junkyard, and island art in the matching levels. Confirm scale, floor contact, sightlines, and collisions using the game's existing collider definitions. Use the original Vinish props listed below. Keep the current shark and build a simple solid concrete barrier. Leave the medkit replacement pending.
>
> Ship only assets with verified provenance. Add the confirmed source and license for each model to `docs/ASSET_LOG.md` before enabling it in a release build. Keep Vinish attribution in game credits and record modifications. Use separate runtime GLBs as needed, profile populated scenes on the intended browser and hardware, and check transfer sizes as well as triangles. Run `python tools/dev.py check`, `python tools/dev.py test`, and `python tools/dev.py smoke` if available on your branch. Exercise aiming, weapon swaps, reloads, projectile flight, opposite-player poses, and collisions in a browser playtest. Report which mappings passed and which assets are still pending. Ask before any paid Meshy work.

## Inventory and review notes

### Local integration preview

Run the Vite development server and open `?play&art-preview=approved` to try the Glock-17, the selected existing shotgun, Rustbound Sniper Rifle, Minigun, AT-2X launcher and rocket, and the supplied grenade held and in flight. The grip editor defaults to Sandbox with passive dummies. Add `&showcase` to inspect the Tactical operator, now the default third-person body. The first-person arms, gloves, and legs use their own geometry.

Add `&grip-editor` to open the third-person calibration view. Under **Adjust**, choose a hand, the gun, either foot, the torso, or the head. Use the slider or type an exact value next to it. Hand offsets use weapon-space metres, gun offsets use operator torso-space metres, and rotations use degrees. Drag the scene to orbit and use **Camera distance** to see the full stance. The editor saves ready and aimed adjustments separately per weapon in the browser. **Export grips** downloads both poses as version 4 JSON for integration and review.

To combine JSON files, choose the base file under **Import JSON** and press **Load base file**. Then choose the second file, select the weapon and ready or aimed stance, and press **Load selected pose** to apply only that entry. Both imports can be undone. Older exports have one set of adjustments per weapon, so the editor applies that entry to the selected stance when loading one pose.

Select a hand and enable **Pin hand to body** to edit its torso-space position independently of the weapon. Move the weapon into place, then turn the pin off to save the hand's new offset from its weapon grip point.

Select **Left elbow** or **Right elbow**. **Elbow swivel** changes the bend plane around the shoulder-to-hand line. **Elbow bend** flexes or straightens the hinge itself, which moves the hand along the forearm's arc. Recheck the grip after changing the bend.

Use **Operator** to compare the default operative, **Tactical T-Pose Soldier**, **Samurai**, and **Viking** with the same grip adjustments. **Animation** starts off for a fixed edit pose. Turning it on uses the procedural gameplay pose driver and previews a walk in place when idle. Turning it off returns to the fixed edit pose for the current stance. The three additional rigged GLBs are staged in `assets_src/additional-art/` for the editor.

Scroll over the scene to zoom the showcase camera. **Aimed pose** keeps the operator visible, including with the Spin Doctor. **Copy hands** captures the displayed grip contacts and wrist angles relative to the weapon and applies them to its other stance. **Copy hands + gun** also transfers the gun adjustment. Copied hands follow the gun within arm reach. Each **Gunblade state** starts from that weapon's normal grip and saves its own adjustments per stance. Resetting a special-state adjustment restores the corresponding normal value. Exports include special-state settings alongside the normal ready and aimed poses.

To reuse a stance, select the weapon you already adjusted, choose **Both feet** under **Copy**, then choose one destination or **All other weapons**. Copy only transfers the selected edited parts. **Undo** or **Ctrl+Z** reverts the last edit, reset, or copy as a single step during the current session.

Use `art-preview=weathered-shotgun` to compare the alternate shotgun. Add `&noart` to compare with the procedural models. The preview uses the source GLBs directly. Release builds do not include these GLBs.

The four additional exports are staged in `assets_src/additional-art/`. Confirm their source and license before release.

| Local source | Staged GLB | Triangles | Remaining checks |
| --- | --- | ---: | --- |
| Meshy Alien T-Pose | `alien.glb` | 3,132 | Rig and test gameplay poses. The source is 39.4 MB and needs a smaller runtime export. |
| Meshy Samurai Warrior | `samurai.glb` | 3,133 | Inspect hands and accessories, then rig and test gameplay poses. |
| Meshy Health Pack | `health-pack.glb` | 2,590 | Check the replacement mesh in scene. The current branch has no health-pack pickup. |
| Meshy grenade | `grenade.glb` | 518 | Check held fit and flight, and prepare the pickup visual. |

All staged files are under `assets_src/approved-art/`. They are review-approved source art for integration. This staging commit adds no runtime loading.

- **Weapons** include the split AT-2X launcher and rocket, Ballistic Shield, Glock-17, Minigun, Rustbound Sniper Rifle, and two shotgun candidates. The standalone AT-2X GLBs contain 2,142 and 192 triangles, respectively. Both use centering pivots, with their original positions stored as node extras named `sourcePivot`. Set in-game attach points from the art. The original long-barrel gun is held for a replacement. The medkit remesh has holes and is held for replacement.
- **Operators** include Tactical T-Pose Soldier, Camouflage Soldier, Ninja, Shadow Vanguard, Symmetrical T-Pose Robot, Tactical Operator, and the approved Tactical Shadow and Field Survivor retries at 4,106 and 4,092 triangles. These GLBs require rig and gameplay pose checks. Red Samurai Warrior and Galactic Gunslinger are held for source edits to remove their fused weapons.
- **Scenery** includes Rusted Fuel Drum, Yellow Forklift retry, Leaning Palm Tree, Wrecked Car 2, Box Truck, Rusty Car Stack, Towering Sea Stack, Cracked Granite Boulder, Rusty Van, the Shipping Container retry, the Yellow Giant Crane retry, Burned Out Truck, Stylized Low-Poly Palm, and Charred Car Remnant. The forklift and van are usable with visible rough spots. The container retry is visually accepted and has open edges, so retain a simple gameplay collider. The car remesh is visually accepted at 5,382 triangles, above its 3,000 target. Its upload copy was simplified before Meshy to fit the upload limit.
- **Vinish originals** include the Industrial Mixer, Conveyor, Portable Toilet, and Scaffold, whose remeshes lost materials or had holes, plus the remaining usable industrial, island, and junkyard props. Preserve the original materials and animation clips when present. Check repeated crates, the oil drum, crab, and sea turtle in a populated scene before budgeting further optimization.
- **Excluded** are both concrete barrier candidates, the static shark remesh, unapproved operator variants, and the rejected prop remeshes. The game should retain its current shark because Meshy removed the source's Swim and Fast clips.

## Source and licensing

- The `vinish/` subfolders contain unmodified files by vinish.dev under CC BY 4.0. The Shipping Container retry is also based on a Vinish model and was remeshed. Preserve credit and identify the modification. [Vinish 3D model catalog](https://vinish.dev/free-3d-models) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- `docs/ASSET_SHOPPING.md` records Meshy community links for many inputs. Match each staged asset to its exact listing or user-supplied provenance before release. Several alternate exports, including the AT-2X and the existing remeshed shotgun, have no exact listing in that shopping list. Keep them in staging until their provenance is confirmed.
- The 3D budget in the GDD is under 6,000 triangles per operator and 300–2,500 per held weapon. Use separate triangle and file-size budgets for visible scenery and texture payloads. Browser preview checks covered loading and triangle counts. In-game scaling, animation, collisions, and performance still need testing.


## Rigged community operators — 2026-11-25

The eleven files from `codex/approved-art-assets` at `8a1f632` supersede the earlier unrigged-operator exclusions for these exact rigged exports, including Samurai Titan and Samurai Warrior. Shane confirmed they are CC0 community models. Individual listing URLs and creator names were not supplied; this is recorded as user-supplied provenance, supported by Meshy Terms section 3.3 (Community 3D Customer Output), without inventing individual credits. Per-file hashes, original sizes and runtime mappings are in `docs/licenses/operator-sources.json` (A-0021).

All eleven are selectable alongside the four original Tactical color variants. Runtime texture copies preserve the source meshes, skins, animation clips and metadata; newer Meshy spine/neck aliases are retargeted to existing gameplay poses. Models are downloaded on demand and shared between actors. First-person behavior and accepted weapons remain as before; `?noart` uses procedural figures. Profile choices pass through the shared network whitelist, couch player one, spectator actors and full replay roster.

Shane's version-4 grip-editor export is preserved byte-for-byte at `assets_src/approved-art/poses/third-person-grips.v4.json` and used as `data/yeet/third-person-grips.json`. Coordinate semantics come from the concurrently published editor commit `4a63477`, merged here: positions use the weapon anchor or pinned torso in metres, rotations are degrees, copied wrist orientations preserve their declared rotation space. Ready/aimed values blend and supported gunblade special states override the base pose. Applied in third-person only for art-backed weapons; explicit editor adjustments override these shipped defaults. First-person and procedural fallback poses are unchanged. A complete scenery placement pass remains outstanding; only the previously verified Vinish scenery batch is enabled.
