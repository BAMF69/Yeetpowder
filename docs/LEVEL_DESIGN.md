# Level design: Industrial Yard, Junkyard, Shark Island (2026-11-26 pass)

> The scenery and level-design pass on `codex/level-design` (from `origin/main` 862f84e). Layout data lives in
> `src/core/yeet/scenery*.ts` and `levelsOutdoor.ts` / `levelsParty.ts`; checks in `tests/levelDesign.test.ts`
> and `tools/test_level_design_browser.mjs`. Duel maps keep their structure; Party maps keep ≥ 3× the ground
> area and eight spawns. The Coliseum, Sandbox, Fight Back and Duel rooms are unchanged.

## Rules every layout follows

- **Heights a player can read.** Jump peak is jumpSpeed²/2g = 1.28 m. A ground obstacle is either a sure hop
  (≤ 1.1 m: crates, drums, pallet stacks, conveyors, compressors, small boulders, concrete barriers) or clearly
  not (≥ 1.38 m: cars, containers, skips, machinery). Nothing sits in the pixel-perfect band between (tested).
- **Walkable climbs are explicit.** Concrete stairs (0.88 m risers), crate steps (1 m), Rusty Car Stack piles
  (0.89 m ledge then 1.85 m top, climbed from their wide west/north ledge), boulder stairs (1.04 → 1.83 m).
- **Recoil perches are explicit.** Two-high container stacks (5.2 m), four-car towers (~5.6 m), scaffold top
  decks (4 m) and the 5 m island crown are reached by a Boomstick floor launch (pitch about −1.5 rad, apex ~18 m;
  a landing exists from the open side, tested). Each holds a worthwhile pickup, never a rare supply.
- **Colliders follow what you stand on or hide behind.** Crane jibs, palm crowns, forklift forks, scaffold rails and
  the burnt truck's cage frame are drawn but open. Quarter turns only, so every collider is an exact AABB.
- **Nothing solid in the island's water.** Offshore sea stacks are > 30 m out and visual only: a knock-off still
  ends in the sea, so edges stay readable.
- **Supplies.** No shotgun pickups; exactly one grenade (45 s) and one health pack (60 s) per map, declared by the
  layout (`designedSupplies`), more than 6 m from every spawn, on clear supported ground; `levelById` fails loudly
  otherwise. Party maps still get one ordinary weapon beside each spawn, found against the final colliders.
- **Bots.** Maps whose walls defeat straight-line steering list a few waypoints (`nav`: doorways, lane mouths,
  row gaps; `src/core/yeet/botNav.ts`). Bots hop only what a jump clears, pop onto ledges by recoil, and give up a
  Gatling they cannot reach after 12 s.

## Industrial Yard (duel)
- **Warehouse:** a conveyor line (hoppable, 1 m) with the industrial mixer as its end post splits the hall;
  compressors give the west spawn low cover; a crate climb (1 m → 2 m); the cyclone and a pallet step; a scaffold
  on the south wall (2 m deck by crate hop, 4 m deck by recoil); a forklift by the door. The north catwalk now has
  a concrete stair (four 0.88 m risers, open on its south side) instead of 1.6/3.2 m crate leaps.
- **Yard:** two Box Truck explosives (they burn into the Burned Out Truck for 25 s), fuel-drum explosives, a forklift
  and cement mixer by the north truck, the mid-yard container with crate steps up to the **health pack** on its roof,
  the two-high corner stack (Six-Shot Sakura, recoil), a container and skip along the south fence, steel beams as
  spawn cover, the portable toilet. The two 1 m concrete barriers stay as simple solid boxes (now concrete paint).
- **Supplies:** grenade at the yard barrier (9, −3); shield inside the doorway; Gatling back on the ground in the
  far yard corner (bots and players can reach it).

## Industrial Yard — Party
- Three doors (the old 1 m slots at z = ±39.5 are closed). Each hall lane has its own machinery so doors read
  differently: mixing station (north), conveyor wall with a centre gap and crate climb (centre), cyclones and
  compressors (south). Both catwalks have concrete stairs; west-wall scaffolds give 2 m / 4 m perches.
- Yard: the container terminal (two-high stack with the second Spin Doctor by recoil, step container by crates),
  a walkable 12 m container wall on the north lane, the loading dock (stack + step container, rocket and axe),
  a south loading yard, three Box Trucks (the old tank slot is now a truck: there is no approved tank model),
  site-fence screens breaking the door-to-fence sightlines, a construction corner, the crane over the east fence.
  The east-lane concrete barriers drop from 1.2 m (an ambiguous hop) to 1 m.
- **Supplies:** grenade inside the centre door (−12, 0); health in the open yard (31, 6); shield in the hall.

## Junkyard (duel)
- Rows of stacked wrecks (Wrecked Car, Charred Car Remnant, Rusty Van bases): one car ~1.4 m, two ~2.8 m,
  three ~4.2 m, four ~5.6 m. Rusty Car Stack piles start the walkable routes (west end of the north row onto the
  two-car walkway; behind the south row; beside the crusher plaza). Lanes between stacks ≥ 1.9 m.
- The crusher (Gatling on top, crate step kept) is the centre; the crane stands in the north-west corner with its
  jib over the north row; oil drums (1 m hops) and the skip as cover.
- **Supplies:** grenade north-west of the crusher (−7, −5); health in the open south-east court (6, 6.5);
  Reaper's Kick on the four-car tower (recoil), Spin Doctor on the east tower.

## Junkyard — Party
- Four themed courts joined by the cross and perimeter loop: **crane court** (north-west), **van line**
  (north-east), **burnt row** (south-west), **pile hill** (south-east, three walkable piles to a two-car crest).
  The elevated crossing keeps its four two-car launch steps; wrecks along the cross lanes; container walls shield
  the east and west spawns.
- **Supplies:** grenade on the north cross lane (0, −24); health by the crane court's mouth (−13, −13).

## Shark Island (duel, point-symmetric)
- Granite boulders replace the box rocks: tall step boulders as cover, hoppable boulders by each spawn, and a
  boulder stair onto the hill on both sides (1.04 → 1.83 → 2.5 m). Straight palms (trunk collider) inland,
  leaning palms at the beach edges with crowns over the water, crabs on the sand, turtles under the surface,
  sea stacks far offshore. Platforms, the shark and its lunge are unchanged.
- **Supplies:** shield and grenade equidistant from both spawns; health on the hill; rocket opposite the Gatling on
  the far platform; Spin Doctor on the hill.

## Shark Island — Party
- Cover boulders at the four beach quarters, hoppable boulders inside, boulder stairs onto the central rock's
  3 m tier from north and south (the 5 m crown stays recoil-only with the Spin Doctor), palms and leaning palms on
  the beach tips, five offshore sea stacks, wildlife. Satellites and causeways unchanged.
- **Supplies:** grenade and health on the central rock's lower tier, up the boulder stairs.

## Assets: all 31 approved scenic models are used

| Model | Where |
|---|---|
| Industrial Mixer, Belt Conveyor, Cyclone Dust Collector, Industrial Air Compressor | Warehouse machinery lines (both Industrial maps) |
| Wooden Crate | Crate climbs and steps (Industrial), the crusher step (Junkyard) |
| Scaffold Tower | South-wall perch (duel), west-wall perches (Party) |
| Portable Toilet, Cement Mixer (Mix clip looping), Steel Beams, Site Fence Panel | Yard and construction corner (Industrial); site fences in Party only |
| Wooden Pallet | Seven-high stacks as 1 m steps (never a lone pallet: it would snag feet) |
| Skip | Industrial south fence, Junkyard west lane, the van court |
| Fuel Can, Supply Crate | Small decoration on top of crates and along walls (not solid) |
| Oil Drum | Junkyard hops and clusters |
| Crab, Sea Turtle | Island wildlife (Idle / Swim clips) |
| Box Truck → Burned Out Truck | Explosive trucks and their wreck state |
| Rusted Fuel Drum | Explosive drums (crushed and charred when blown) |
| Yellow Forklift (retry) | Warehouse doors and yard loading |
| Shipping Container (retry) | Industrial yards, Junkyard Party spawn walls |
| Yellow Giant Crane (retry) | Industrial Party east fence, Junkyard north-west, Junkyard Party crane court |
| Wrecked Car 2, Charred Car Remnant, Rusty Van | Every Junkyard stack and lane wreck |
| Rusty Car Stack | Walkable piles (Junkyard) |
| Cracked Granite Boulder | All island cover, hops and stairs |
| Towering Sea Stack | Offshore landmarks (decoration only) |
| Leaning Palm Tree, Stylized Low-Poly Palm | Beach edges (leaning, open) and inland (straight, trunk collider) |

**Excluded (rejected or held):** both concrete-barrier candidates (the 1 m concrete barriers stay simple solid
boxes, as the handoff asked), the static shark remesh (the animated shark is kept), the first forklift, crane and
container attempts, the unapproved Armored Military Vehicle (so the tank prop is no longer placed), the medkit
remesh. Provenance: `docs/ASSET_LOG.md` A-0019 and A-0026, `docs/licenses/scenery-sources.json`.

## Still awaiting human review
- Feel of the routes at full speed, sightlines from the perches, and how crowded the Party yards feel with eight
  people; the bots' new routing (they now find each other on every map in tests, but only seeded sims prove it).
- Performance on the target GPU and phones: software rendering proves loading only. Per map 9-22 distinct
  models; static props are instanced (one draw call per model part).

## Hazard pass (2026-11-27, Elaina's requests)
- **Swimming (Shark Island):** falling in no longer freezes you. You float head-up (`TUNING.swim`), paddle at 3 m/s
  and cannot jump; a gun's kick is the way out (a Boomstick blast at the water from just off the beach lands you on
  the sand). The shark eats whoever has been in for `TUNING.shark.approach` (2 s); standing on land resets the
  count, a hop over the water does not. The shark follows the swimmer and is called off if they get out. HUD:
  "SHARK INCOMING! GET OUT: n s". Bots do not yet try to recoil out of the water.
- **Sea stacks** are solid perches (tops 6-10 m above the water, > 30 m offshore): reached by copter or a big launch.
- **Trucks** blow up bigger (radius 11 m, more push and lift) with a second rolling fireball, and leave the Burned
  Out Truck as before.
- **Fuel drums** are red while live and crushed back to the model's own colour once blown.
- **Compressors and mixers** are explosives (`machine`: 60 hp, 6 m blast) and leave a 0.6 m scrap heap drawn in
  code (bent panels, pipes, a split tank); they come back after `TUNING.explosive.respawn`.
- **Surroundings:** a 4 km textured ground under Industrial (asphalt) and Junkyard (dirt) and a 4 km sea round the
  island; the outdoor haze is pushed out with camera height (`hazeFor`) so the copter view shows land, not a void.
- Tests: `tests/swimAndBlasts.test.ts`. Captures: `captures/progress/hazard-*.png`.
- **Ring Out damage (2026-11-27):** with infinite hp, hits and blasts add their damage to a percentage
  (`PlayerState.damage`) and throw you `1 + damage x TUNING.ringOut.perDamage` harder (100% = double). It shows as
  DAMAGE n% in the HUD and resets to 0 on a knockout or respawn. The shark count resets only on land, so repeated
  splash-downs add up (tested).
