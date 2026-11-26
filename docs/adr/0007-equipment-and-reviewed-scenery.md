# 0007: Held shield, carried treatment, and verified scenery

Accepted by Shane, 2026-11-25. Continues art integration 9284a6c with gameplay main 6983335; source checkouts preserved.

## Equipment rules

Selecting shield slot 0 equips it in the left hand and the Pea Pistol in the right. The pistol shares its normal
magazine, recoil, reload and cooldown. Aiming holsters the pistol, uses both hands and looks through the viewport;
firing/reloading cannot occur while braced. Frontal bullets do no damage while equipped at either stance. Frontal
knockback is multiplied by 0.5; blast damage by 0.5 at the hip and 0 while aimed. The rear and melee remain exposed.
Front means the horizontal forward hemisphere. No durability or movement penalty was added.

A map health pack refills one carried pack to three uses, without stacking; it does not heal on contact. A use
requires an injured living player, a charge and no cooldown. It consumes one charge, holsters equipment for 3 s,
then restores full HP and starts a 10 s cooldown. Movement/damage/stun cannot cancel an application; death does.
Full-HP and infinite-HP players do not waste a use. Refill does not clear treatment/cooldown timers. Map health
packs return after the existing 12 s and weapons after 6 s. Death restores starter gear and clears carried health;
there are no equipment drops.

The authoritative sim owns healthUses/healing/healCooldown and the shield's braced state. Snapshots and prediction
carry them together. The optional heal input is sanitized as a boolean and cleared in repeated held inputs and
between local fixed steps. V, touch HEAL and gamepad D-pad Up use the same action. Shared HUD text derives from
player state; treatment, reload and ammo displays use the correct pistol magazine while shield-equipped.

## Art and levels

The approved weapon selection, Tactical operative and existing first-person anchors/holds are retained. Ten
development preview GLBs have texture-only 1024 px exports (78,885,652 to 5,310,428 bytes); original files, meshes,
anchors and metadata remain. The shield's opaque baked viewport gets a runtime window cutout; this modification
is restricted to the development preview until source provenance is confirmed. Procedural shield has a real
opening. First-person alignment uses each model's viewport height. Noart uses procedural equipment and visible
scenery collision blocks. Grip-editor JSON has not been supplied; final third-person weapon grip edits are pending.

Scenery placement/collision data is engine-free and shared by the server and clients. Eight original Vinish GLBs
are cleared for runtime use after matching embedded author/source/license metadata against the publisher license.
Their bytes/animation clips are retained and hashes recorded in scenery-sources.json (A-0019). The art is loaded
per world and only for that level, grounded and uniformly scaled. Industrial gets mixer/conveyor/yard props;
Junkyard gets a skip, crate launch step and drums; Island gets nonblocking shoreline wildlife. Main lanes, doorway,
spawns, supplies, launch platforms and current shark are retained. Closed solid props use matching box envelopes;
no hollow scaffold/container with an unexplained invisible wall was introduced. Cosmetic wildlife has no collision.

Meshy exports without a confirmed listing/export chain remain development-only (A-0020). No runtime release copy
is made for them. Vinish credit is visible in the game's generated Credits screen. No paid generation, new dependency,
deployment or push was performed.

## Verification and remaining review

Unit tests exercise real shots, blast protection, shared ammo, delayed full recovery, cooldown, refill/death,
snapshot consistency, held-input sanitization, spawn/supply clearance and source hashes/credits. Browser and actual
two-socket tests cover the same player-facing actions. See HANDOFF.md for final command results and captures.

Final scenery composition, combat balance, touch ergonomics, controller feel and target-GPU performance still need
Shane's human playtest. The initial scenery batch is deliberately small; remaining Meshy scenery awaits exact
source/license evidence and populated-scene review before release enablement.
