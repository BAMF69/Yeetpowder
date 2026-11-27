// ---------------------------------------------------------------------------
// sceneryIndustrial.ts
// Purpose : Industrial Yard dressing for the duel map and its eight-player Party variant (2026-11-26 level pass):
//           machinery lines and crate climbs inside the warehouse, a container terminal, loading trucks, forklifts
//           and a construction corner in the yard. Trucks, fuel drums, compressors and mixers are
//           explosives (hazards.ts).
// Usage   : industrialScenery(false) (duel) / industrialScenery(true) (Party); levels.ts adds the colliders.
// Notes   : No three import. Every height is either hoppable (<= 1.05 m) or clearly a wall (>= 1.8 m), except
//           where a lower step stands beside it as the intended way up. Doorways (x = 0) and spawn exits stay
//           open; tests/levelDesign.test.ts checks clearances, supports and walkable climbs.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import type { ExplosiveKind } from "./arena";
import { place, decor, sceneryTop, type SceneryId, type SceneryPlacement } from "./scenery";

/** Real-world scales for the normalised community models (metres per model unit). */
export const SCALE = { truck: 3.5, container: 3.1, forklift: 1.7, drum: 0.5, crate: 1.05, crane: 9, skip: 1.33, cement: 1.15, pallet: 1 } as const;
const explosive = (art: SceneryId, kind: ExplosiveKind, x: number, z: number, scale: number, quarter = 0): SceneryPlacement =>
  ({ ...place(art, x, 0, z, scale, quarter), prop: kind });
export const truck = (x: number, z: number, quarter = 0) => explosive("boxTruck", "truck", x, z, SCALE.truck, quarter);
export const fuelDrum = (x: number, z: number) => explosive("fuelDrum", "drum", x, z, SCALE.drum);
/** Air compressors and mixers blow up too (Elaina, 2026-11-27), leaving a low scrap pile (TUNING.explosive.machine). */
const compressor = (x: number, z: number, quarter = 1) => explosive("compressor", "machine", x, z, 1, quarter);
const mixer = (x: number, z: number) => explosive("mixer", "machine", x, z, 1);
const crate = (x: number, z: number, high = 1, y = 0) => place("crate", x, y, z, SCALE.crate, 0, true, high);
const container = (x: number, z: number, quarter = 0, high = 1) => place("container", x, 0, z, SCALE.container, quarter, true, high);
/** Seven pallets make a 1.0 m step; a lone pallet would only snag feet, so pallets are always stacked. */
const pallets = (x: number, z: number, quarter = 0, n = 7) => place("pallet", x, 0, z, SCALE.pallet, quarter, true, n);

/** Roof heights for pickups and spawns placed on them (exact, from the colliders). */
export const CONTAINER_TOP = sceneryTop(container(0, 0)), STACK_TOP = sceneryTop(container(0, 0, 0, 2)), TRUCK_TOP = sceneryTop(truck(0, 0));

/** The duel map: one doorway, one catwalk, a yard of trucks and containers. */
function duel(): SceneryPlacement[] {
  return [
    // ---- warehouse ----
    // conveyor line: a 6 m hoppable wall across the middle of the hall, the tall mixer as its end post
    place("conveyor", -13.4, 0, -0.6), place("conveyor", -13.4, 0, 2.5), mixer(-13.4, 5.3),
    // compressors: low cover in front of the west spawn (3 m clear of it)
    compressor(-26.4, -4.3, 1), compressor(-26.4, -6.3, 1),
    // a crate climb: singles (1 m) up to a two-high column (2 m) with a supply crate on top
    crate(-19, 5, 2), crate(-18, 5), crate(-19, 6), crate(-18, 6), decor("supplyCrate", -19, 1.99, 5, 1, 1),
    place("cyclone", -22.5, 0, 11.5), pallets(-24.6, 11.5, 1),
    // scaffold on the south wall: crate hop to its 2 m deck, the 4 m top deck by recoil
    place("scaffold", -20, 0, 18.7), crate(-20.5, 17),
    place("forklift", -6, 0, 10, SCALE.forklift, 1),
    decor("fuelCan", -31.6, 0, -19.4), decor("fuelCan", -31.2, 0, -19.5, 1, 1),
    // ---- yard ----
    truck(11.5, -12.7), truck(23.5, 11.3),
    place("forklift", 17, 0, -17.6, SCALE.forklift), place("cementMixer", 7.3, 0, -17.6, SCALE.cement),
    // the mid-yard container: crate steps on its west end lead to the health pack on its roof
    container(21.5, -4.2), crate(17.9, -4.2, 2), crate(16.9, -4.2),
    // a two-high stack in the north-east corner: the Gatling Copter's roost, reached by recoil
    container(28.75, -18.25, 0, 2), fuelDrum(26, -15.5),
    container(4.2, 16.8, 1), place("skip", 11, 0, 17.6, SCALE.skip, 1),
    place("steelBeams", 24.5, 0, 4.6), place("toilet", 30.6, 0, 13),
    fuelDrum(5, -6.6), fuelDrum(12, 4), fuelDrum(6, 8), fuelDrum(6.9, 8.7), fuelDrum(15.5, 14.6),
    decor("fuelCan", 31.4, 0, -12), decor("fuelCan", 4.6, 0, -6.5),
  ];
}

/** The Party map: a 128 x 80 m warehouse-and-yard with three doors, two catwalks and a container terminal. */
function party(): SceneryPlacement[] {
  const out: SceneryPlacement[] = [];
  // ---- warehouse: each lane gets its own machinery so the three doors read differently ----
  // north lane (z -22): a mixing station
  out.push(mixer(-41, -23.5), mixer(-41, -21), place("cyclone", -41.2, 0, -18.4),
    place("conveyor", -22, 0, -25), place("conveyor", -22, 0, -21.9), compressor(-22, -19.3, 1));
  // centre lane (z 0): conveyor wall with a gap in the middle, crate climb by the west spawns' corridor
  out.push(place("conveyor", -22, 0, -4), place("conveyor", -22, 0, 4), mixer(-22, 0),
    crate(-41, -1, 2), crate(-40, -1), crate(-41, 0), crate(-40, 0), crate(-41, 1, 1), decor("supplyCrate", -41, 1.99, -1, 1, 1));
  // south lane (z 22): compressors and a cyclone pair
  out.push(place("cyclone", -41, 0, 20.4), place("cyclone", -41, 0, 23.6), compressor(-41.2, 26.2, 0),
    place("conveyor", -22, 0, 19.2), place("conveyor", -22, 0, 22.3), compressor(-22, 24.8, 1));
  // scaffold perches on the west wall between the spawn corridors (2 m deck by crate, 4 m by recoil)
  out.push(place("scaffold", -62.9, 0, -11, 1, 1), crate(-61.3, -12.3), place("scaffold", -62.9, 0, 11, 1, 3), crate(-61.3, 12.3));
  out.push(place("forklift", -7, 0, -12, SCALE.forklift, 1), place("forklift", -7, 0, 12, SCALE.forklift, 3),
    // single crates as 1 m steps in the hall (pallet stacks cost 7 x 3,240 triangles each: two stay in the loading yard)
    crate(-10, -14.6), crate(-10, 14.6), crate(-52, -8.5), crate(-52, 8.5));
  // ---- yard ----
  // container terminal (north-east): a two-high stack with the second Spin Doctor, a single step-container in front
  out.push(container(40, -33.8, 0, 2), container(40, -31.35), crate(36.4, -31.35, 2), crate(35.4, -31.35));
  // north lane: a 12 m container wall you can walk along at 2.6 m once you climb the crates at its west end
  out.push(container(18.9, -25.4), container(25.05, -25.4), crate(15.2, -25.4, 2), crate(14.2, -25.4));
  // centre: the loading dock with a trucked lane and a stacked container lookout
  out.push(truck(10, -12), container(22, -2.4, 0, 2), container(22, 0.05), crate(18.4, 0.05, 2), crate(17.4, 0.05));
  // south lane: loading yard with a forklift and pallets
  out.push(container(19.5, 21.6), place("forklift", 26.5, 0, 21.6, SCALE.forklift, 2), pallets(14.6, 21.6, 1), pallets(14.6, 22.8, 1));
  out.push(truck(45, 13, 1), truck(46, -17.5));
  // the crane over the east perimeter, tracks against the fence, jib over the terminal
  out.push(place("crane", 53.2, 0, -8, SCALE.crane));
  // site-fence screens in front of the warehouse doors break the long door-to-fence sightlines
  out.push(place("siteFence", 8, 0, -27), place("siteFence", 8, 0, 6.5), place("siteFence", 8, 0, 27));
  // construction corner (south-east), cover between the two south-east spawns
  out.push(place("cementMixer", 38, 0, 33.5, SCALE.cement), place("steelBeams", 42.5, 0, 31), place("steelBeams", 44.5, 0, 31),
    place("skip", 33, 0, 27, SCALE.skip, 1), place("toilet", 62.6, 0, 18), place("toilet", 62.6, 0, 16.6));
  out.push(fuelDrum(8, 16), fuelDrum(9, 16.6), fuelDrum(33, -9), fuelDrum(36, 23), fuelDrum(55, 1), fuelDrum(12, -32),
    fuelDrum(30.5, -30), decor("fuelCan", 63.4, 0, -2), decor("fuelCan", 0.9, 0, -38.8, 1, 1), decor("fuelCan", 34.2, 0, -27.6));
  return out;
}

export function industrialScenery(isParty: boolean): SceneryPlacement[] {
  return isParty ? party() : duel();
}
