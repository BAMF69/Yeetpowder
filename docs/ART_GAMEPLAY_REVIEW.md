# Art/gameplay continuation review

## Continuation implemented after Shane's rules reply

The gameplay checkout was confirmed as the shared repository on main at 6983335. Its equipment and existing
placements were reviewed and integrated into this isolated worktree without committing. The only merge conflict
was the props import list; both accepted projectile art and static batching were retained. Shared checkout files,
its untracked source notes/Meshy directory, accepted weapon choices and Tactical operative were preserved.

Shane confirmed 50% hip frontal blast resistance and 100% braced resistance, shared hip pistol use, frontal bullet
blocking, 50% frontal knockback, three full-heal charges, a 3 s application, 10 s cooldown after completion,
starter inventory after death, no drops and timed/refill pickups. These rules are implemented in the deterministic
sim, HUD, keyboard/touch/couch controls and multiplayer snapshots. See ADR 0007 for exact semantics.

Eight verified Vinish originals are now staged for release and placed with shared collision in the three arenas;
their source bytes and clips are unchanged. The remaining Meshy art has not been cleared for release. Ten local
preview exports shrink texture payload from 78,885,652 to 5,310,428 bytes, retaining geometry, anchors and metadata.
The baked shield viewport is opened at runtime and aligned to the crosshair. Human scenery/combat review and
Shane's third-person grip-editor JSON remain outstanding. Final test results are recorded in HANDOFF.md.

## Previous baseline review (historical; decisions below were pending at that time)

Starting point: `codex/art-integration` at `9284a6c` (2026-11-25).
Isolated checkout: `build/art-integration` under the shared Yeetpowder checkout.

## Preserved work

The shared checkout stays on main; its untracked approved-art handoff, shopping notes and Meshy directory were not changed. The pre-existing approved-art worktree was inspected without edits. No separate checkout named gameplay was found in the registered worktrees or the available Codex/Claude project folders. Its path has been requested before reconciling preview changes.

At this exact starting commit, approved weapon previews exist in meshyArt.ts. Shield and Health Pack gameplay/preview slots and a scenery preview module are absent. Main has later gameplay changes, including earlier shield/healing behavior, but those have not been merged into this branch or treated as agreed rules. Review Shane's gameplay checkout first to avoid replacing or duplicating its work.

## Decisions requested from Shane

- Shield: selectable held item versus protection while another gun is equipped; active aim guard; frontal damage and knockback protection; durability.
- Health: immediate pickup healing versus carried consumable; interruption on damage.
- Inventory and respawn: drops on death, starter gear on respawn, timed map pickup return.
- Grip-editor JSON path when available. Apply only to third-person poses and review ready, aimed, reload and movement; retain accepted first-person fits.

No new equipment balance values have been selected.

## Asset and level review

Read APPROVED_ART_HANDOFF.md and ASSET_LOG.md from the starting commit, plus the existing source shopping list. Keep the accepted Glock, existing-shotgun candidate, sniper, minigun, AT-2X, grenade and current Tactical operative choices. Preview source assets remain development-only at this commit; production retains its existing models and procedural fallbacks.

All 17 staged original Vinish GLBs have embedded copyright, author, source and CC BY 4.0 metadata. The publisher confirms commercial use, adaptation and redistribution with attribution, including identifying changes: https://vinish.dev/free-3d-models/ . Preserve this metadata and visible credits. This audit alone does not enable any new release assets.

The Meshy scenery listings in ASSET_SHOPPING.md are leads, not proof that each staged export is the corresponding source. Exact listing/export matches, modification provenance and license evidence remain pending for release. Direct inspection of the sea-stack and granite-boulder listing pages was unavailable in the web reader. No paid Meshy work was started.

Current layout anchors to preserve while reviewing the missing preview work:
- Industrial: warehouse catwalk and crate access, central doorway into the open yard, explosive vehicle cover and container corner. Avoid narrowing the doorway or placing scenery on pickups/spawns; verify the known overlapping warehouse/fence faces against the newer gameplay fix.
- Junkyard: car-stack traversal lanes, central crusher pickup and crane landmark. Visual meshes must agree with collision tops; do not make an apparently open car/van gap into an invisible solid wall.
- Island: exposed perimeter, central hill, four risky offshore platforms. Keep launch/landing routes visible and distinguish decorative rocks from usable cover. Retain the current shark rather than the rejected static remesh.

Placement, scale and collision are not finalized until the existing gameplay previews have been reviewed and traversed in the browser. Operator grip poses await the supplied JSON.

## Baseline validation

- Type checking passed; 11 shader recipes compiled.
- 464 tests passed in 43 files on this exact art branch.
- Production build passed, 11,533 KB; new staged source GLBs are not copied into the production build.
- First browser attempt waited for YEET_LEVEL_READY, a marker absent in this older branch. It timed out after loading audio and reaching the noart log; that attempt does not establish a gameplay failure. The corrected check uses the existing explosion marker to verify simulation updates after loading.
- Corrected Industrial/noart production browser check passed: YEET_MARK_boom reached, no errors, screenshot captures/progress/art-baseline-industrial-noart.png. Software rendering measured 48 frames (mean 190.97 ms, p95 316.70 ms); this is not target-GPU performance validation.

Equipment, touch/HUD/network behavior, populated scenery performance and third-person grip poses have not yet been validated for this continuation.
