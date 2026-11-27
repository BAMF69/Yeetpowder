// ---------------------------------------------------------------------------
// sceneryIsland.ts
// Purpose : Shark Island dressing for the duel map and its Party variant (2026-11-26 level pass): granite boulders
//           as cover and as a rock stair onto the hill, palms along the beach, solid sea stacks far offshore as
//           landmarks and perches, crabs on the sand and turtles swimming under the surface.
// Usage   : islandScenery(false) (duel) / islandScenery(true) (Party); levels.ts adds the colliders.
// Notes   : No three import. Nothing solid stands in the water near the beach: a knock-off must still end in the
//           sea (readable edges), so offshore rocks are > 30 m out (solid perches since 2026-11-27, reached by copter). Platforms, causeways and the
//           animated shark (props.ts) are unchanged. The duel layout is point-symmetric for fairness.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { ISLAND_WATER } from "./levelsOutdoor";
import { place, decor, type SceneryPlacement } from "./scenery";

/** Boulder scales: a hop (collider 1.04 m), a step (1.83-2.09 m) and full cover (2.43 m). */
export const BOULDER = { hop: 1.2, step: 2.1, high: 2.4, cover: 2.8 } as const;
const PALM = { straight: 3.6, leaning: 4 } as const;
const boulder = (x: number, z: number, scale: number, quarter = 0) => place("boulder", x, 0, z, scale, quarter);
/**
 * Offshore landmark and perch (Elaina, 2026-11-27): solid, its base under the water and its flat top 6-10 m up, far
 * beyond a swim (the shark bites after 2 s), so the way there is the Gatling Copter or a big launch.
 */
const seaStack = (x: number, z: number, scale: number, quarter = 0) => place("seaStack", x, ISLAND_WATER - 1.5, z, scale, quarter);
const turtle = (x: number, z: number, quarter = 0) => decor("turtle", x, ISLAND_WATER - 0.35, z, 0.9, quarter);

function duel(): SceneryPlacement[] {
  const out: SceneryPlacement[] = [];
  for (const s of [1, -1]) {
    // point-symmetric pairs: (x, z) and (-x, -z), one per spawn side
    out.push(boulder(6 * s, 8 * s, BOULDER.step), boulder(7.8 * s, -5 * s, BOULDER.hop),
      // the rock stair onto the hill: hop boulder, step boulder (overlapping the hill's foot), hill top 2.5 m
      boulder(5.4 * s, 1 * s, BOULDER.step), boulder(7.6 * s, -1.6 * s, BOULDER.hop, 1));
  }
  out.push(place("stylizedPalm", -10.4, 0, 10.6, PALM.straight), place("stylizedPalm", 10.6, 0, -10.4, PALM.straight, 2),
    place("stylizedPalm", 10.2, 0, 10.2, PALM.straight, 1), place("stylizedPalm", -10.2, 0, -10.2, PALM.straight, 3),
    decor("leaningPalm", 12.2, 0, 3, PALM.leaning, 1), decor("leaningPalm", -12.2, 0, -3, PALM.leaning, 3),
    decor("leaningPalm", -3, 0, 12.3, PALM.leaning, 0), decor("leaningPalm", 3, 0, -12.3, PALM.leaning, 2));
  out.push(seaStack(42, -32, 8), seaStack(-44, 28, 10, 1), seaStack(-22, -46, 7, 2), seaStack(32, 46, 6, 3));
  out.push(decor("crab", 10.3, 0.015, -9, 1.2, 1), decor("crab", -11.6, 0.015, 6.5, 1.1, 3), decor("crab", 2.4, 0.015, 11.8, 1, 2),
    turtle(-8.8, -16.5, 1), turtle(17, 9, 2));
  return out;
}

function party(): SceneryPlacement[] {
  const out: SceneryPlacement[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    out.push(boulder(sx * 13, sz * 12, BOULDER.cover, (sx + sz + 2) % 4), boulder(sx * 8, sz * 6, BOULDER.hop, sx > 0 ? 1 : 0),
      place("stylizedPalm", sx * 21, 0, sz * 13, PALM.straight * 1.15, (sx * 2 + sz + 4) % 4),
      place("stylizedPalm", sx * 12, 0, sz * 22, PALM.straight * 0.95, (sx + 4) % 4));
  }
  // rock stairs onto the central rock's lower tier (3 m) from north and south; the 5 m crown is recoil-only
  for (const s of [1, -1]) out.push(boulder(2 * s, 7.2 * s, BOULDER.high), boulder(2 * s, 9.95 * s, BOULDER.hop, 1));
  // leaning palms at the beach tips, crowns out over the water (never solid)
  out.push(decor("leaningPalm", 25.2, 0, 8, PALM.leaning, 1), decor("leaningPalm", -25.2, 0, -8, PALM.leaning, 3),
    decor("leaningPalm", 8, 0, -25.2, PALM.leaning, 2), decor("leaningPalm", -8, 0, 25.2, PALM.leaning, 0),
    decor("leaningPalm", 19.3, 0, -19.4, PALM.leaning, 2), decor("leaningPalm", -19.3, 0, 19.4, PALM.leaning, 0));
  out.push(seaStack(62, -48, 10), seaStack(-66, 44, 12, 1), seaStack(-40, -68, 9, 2), seaStack(50, 64, 8, 3), seaStack(72, 18, 7, 1));
  out.push(decor("crab", 14.6, 0.015, -3, 1.2, 1), decor("crab", -17.2, 0.015, 4.4, 1.1, 3), decor("crab", 3.2, 0.015, 17.6, 1, 2),
    decor("crab", -4.8, 0.015, -18.2, 1.2, 0), turtle(-30, 15, 1), turtle(30, -16, 3), turtle(16, 31, 2));
  return out;
}

export function islandScenery(isParty: boolean): SceneryPlacement[] {
  return isParty ? party() : duel();
}
