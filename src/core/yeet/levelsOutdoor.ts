// ---------------------------------------------------------------------------
// levelsOutdoor.ts
// Purpose : The three new levels (Elaina, 2026-11-24), first build with placeholder shapes:
//             island      Shark Island: a sandy island, a rock hill, four rock platforms out over the water; fall in
//                         and a shark eats you (a knockout for whoever knocked you in). Made for knocking people off.
//             industrial  Industrial Yard: a factory hall (catwalk, crates, cover) whose doorway opens onto a yard
//                         with no roof, where trucks, a tank and fuel drums blow up when shot (hazards.ts).
//             junkyard    Junkyard: stacks of crushed cars in rows that make lanes, a crusher in the middle (the
//                         Gatling on top), a crane in a corner; the stacks are launch routes the floor is not.
// Usage   : levelById("island") etc. (levels.ts); ?play&level=island, or ?bot=easy&level=island for a bot match
// Notes   : No three import. Props (cars, trucks, tanks, drums) are collision boxes with a `prop` the renderer
//           draws as that thing (props.ts); `paint` picks the surface. Far bounds are solid but not drawn
//           (prop "hidden"), so the Gatling cannot fly off for ever. Spawns stand on something (tests).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { box, type Box } from "./arena";
import type { Level } from "./levels";
import type { Vec3 } from "./vec";
import { carStack, stackTop } from "./sceneryJunkyard";
import { CONTAINER_TOP, STACK_TOP, TRUCK_TOP } from "./sceneryIndustrial";

const SOLID = 400; // m: walls and bounds are solid this high (the Gatling cannot fly over)
const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
/** The yaw that looks from `a` toward `b` (yaw 0 looks down -Z, + turns left). */
const facing = (a: Vec3, b: Vec3) => Math.atan2(-(b.x - a.x), -(b.z - a.z));

/** Four walls round a rectangle, drawn `drawTop` m tall and solid far above, painted `paint`. */
export function fence(x0: number, x1: number, z0: number, z1: number, drawTop: number, paint?: Box["paint"]): Box[] {
  const wall = (b: Box): Box => ({ ...b, kind: "wall", drawTop, ...(paint ? { paint } : {}) });
  return [
    wall(box(x0 - 1, 0, z0 - 1, x1 + 1, SOLID, z0)),
    wall(box(x0 - 1, 0, z1, x1 + 1, SOLID, z1 + 1)),
    wall(box(x0 - 1, 0, z0, x0, SOLID, z1)),
    wall(box(x1, 0, z0, x1 + 1, SOLID, z1)),
  ];
}

/** The warehouse supplies the west walls. Drawing another fence on those exact faces causes z-fighting. */
export function yardFence(x: number, z0: number, z1: number): Box[] {
  return fence(0, x, z0, z1, 5, "corrugated").filter((b) => b.max.x > 0).map((b) => ({ ...b, min: { ...b.min, x: Math.max(0, b.min.x) } }));
}

/** Invisible solid bounds round an open level (and a lid), so nothing leaves it. */
export function bounds(half: number, lid: number): Box[] {
  const hidden = (b: Box): Box => ({ ...b, kind: "wall", prop: "hidden" });
  return [
    hidden(box(-half - 1, -50, -half - 1, half + 1, SOLID, -half)),
    hidden(box(-half - 1, -50, half, half + 1, SOLID, half + 1)),
    hidden(box(-half - 1, -50, -half, -half, SOLID, half)),
    hidden(box(half, -50, -half, half + 1, SOLID, half)),
    hidden(box(-half, lid, -half, half, lid + 1, half)),
  ];
}

// ---- Shark Island ---------------------------------------------------------------------
export const ISLAND_WATER = -0.6;
/** Platform centres and their top (m): out over the water, a Boomstick launch from the island reaches them. */
const PLATFORMS: Vec3[] = [v(24, 0.5, 0), v(-24, 0.5, 0), v(0, 0.5, 24), v(0, 0.5, -24)];

export function islandLevel(): Level {
  const platforms = PLATFORMS.map((p): Box => ({ ...box(p.x - 3, -4, p.z - 3, p.x + 3, p.y, p.z + 3), paint: "rock" }));
  const p1 = v(-8, 0, 8);
  const p2 = v(8, 0, -8);
  return {
    id: "island", name: "Shark Island",
    arena: {
      boxes: [
        { ...box(-13, -4, -13, 13, 0, 13, "floor"), paint: "sand" }, // the island (its sides are the cliffs)
        { ...box(-4, 0, -4, 4, 2.5, 4), paint: "rock" }, // the hill in the middle (boulders and palms: sceneryIsland.ts)
        ...platforms,
        ...bounds(70, 45),
      ],
      dummySpawns: [...PLATFORMS, v(0, 2.5, 0), v(8, 0, 4)],
    },
    spawn: p1, spawnYaw: facing(p1, v(0, 0, 0)),
    spawns: [p1, p2], spawnYaws: [facing(p1, v(0, 0, 0)), facing(p2, v(0, 0, 0))],
    startWeapons: ["pistol", "shotgun"], // the Boomstick is the launcher: knock them into the sea
    pickups: [
      { weapon: "sniper", pos: v(2, 2.5, 2) }, // on the hill, up the rock stairs
      { weapon: "reaper", pos: v(-24, 0.5, 1.5) },
      { weapon: "sakura", pos: v(24, 0.5, -1.5) },
      { weapon: "copter", pos: v(1.5, 0.5, -24) }, // the Gatling over the water: risky
      { weapon: "rocket", pos: v(-1.5, 0.5, 24) }, // its opposite number on the far platform
      { weapon: "axe", pos: v(-10.5, 0, -2) },
      // rare supplies equidistant from both spawns (the duel layout is point-symmetric)
      { weapon: "shield", pos: v(-9, 0, -9) },
      { weapon: "grenade", pos: v(8.7, 0, 8.7) },
      { weapon: "health", pos: v(-2.5, 2.5, -2.5) },
    ],
    dummiesFight: true, dummyRespawn: 5, seed: 11,
    outdoor: true, water: { y: ISLAND_WATER }, designedSupplies: true,
  };
}

// ---- Industrial Yard -------------------------------------------------------------------
const HALL_H = 12; // m: the hall's roof
/** An explosive vehicle or drum: a box the renderer draws as one (hazards.ts gives it health and a blast). */
export const truck = (x: number, z: number, alongX = true): Box => alongX
  ? { ...box(x - 3.5, 0, z - 1.3, x + 3.5, 3, z + 1.3), prop: "truck" }
  : { ...box(x - 1.3, 0, z - 3.5, x + 1.3, 3, z + 3.5), prop: "truck" };
export const tank = (x: number, z: number): Box => ({ ...box(x - 3.5, 0, z - 1.8, x + 3.5, 2.6, z + 1.8), prop: "tank" });
export const drum = (x: number, z: number): Box => ({ ...box(x - 0.4, 0, z - 0.4, x + 0.4, 1.2, z + 0.4), prop: "drum" });

/**
 * A straight stair of jumpable risers from the floor up to a deck at `top`: the step against the deck starts at x0
 * and the stair descends along `dir` (+1 toward +x). Risers are top / (steps + 1) apart (0.88 m for a 4.4 m deck;
 * the jump clears 1.28 m), replacing the old 1.6 m crate leaps with deliberate catwalk access.
 */
export function stair(x0: number, z0: number, z1: number, top: number, dir: 1 | -1, steps = 4, depth = 1.3): Box[] {
  return Array.from({ length: steps }, (_, i) => {
    const xa = x0 + dir * i * depth, h = Math.round(top * (steps - i) / (steps + 1) * 100) / 100;
    return { ...box(xa, 0, z0, xa + dir * depth, h, z1), paint: "concrete" as const };
  });
}

export function industrialLevel(): Level {
  const hallWall = (b: Box): Box => ({ ...b, kind: "wall", drawTop: HALL_H });
  const p1 = v(-26, 0, 0);
  const p2 = v(28, 0, 3);
  return {
    id: "industrial", name: "Industrial Yard",
    arena: {
      boxes: [
        box(-33, -1, -21, 0, 0, 21, "floor"), // the hall's floor
        { ...box(0, -1, -21, 33, 0, 21, "floor"), paint: "asphalt" }, // the yard
        ...yardFence(32, -20, 20),
        hallWall(box(-33, 0, -21, -32, SOLID, 21)), // the hall: west wall, north and south walls drawn to the roof
        hallWall(box(-32, 0, -21, 0, SOLID, -20)),
        hallWall(box(-32, 0, 20, 0, SOLID, 21)),
        hallWall(box(-0.5, 0, -20, 0.5, SOLID, -4)), // the wall between hall and yard, with an 8 m doorway
        hallWall(box(-0.5, 0, 4, 0.5, SOLID, 20)),
        box(-0.5, 6, -4, 0.5, HALL_H, 4), // over the doorway
        box(-33, HALL_H, -21, 0.5, HALL_H + 1, 21, "ceiling"), // the hall's roof (the yard is open sky)
        // the catwalk along the north wall and its stair down toward the doorway (machinery: sceneryIndustrial.ts)
        box(-30, 4, -19.5, -6, 4.4, -16.5),
        ...stair(-6, -19.5, -16.5, 4.4, 1),
        // concrete barriers in the yard: 1 m, so anyone can hop them
        { ...box(10, 0, 0, 14, 1, 0.6), paint: "concrete" },
        { ...box(17, 0, 5, 17.6, 1, 9), paint: "concrete" },
      ],
      dummySpawns: [v(20, 0, 1.5), v(14, 0, 7), v(29, 0, -9), v(-20, 4.4, -18), v(-10, 0, 9), v(23.5, TRUCK_TOP, 11.3), v(7, 0, 12)],
    },
    spawn: p1, spawnYaw: facing(p1, p2),
    spawns: [p1, p2], spawnYaws: [facing(p1, p2), facing(p2, p1)],
    startWeapons: ["pistol", "shotgun"],
    pickups: [
      { weapon: "sniper", pos: v(-28, 4.4, -18) }, // on the catwalk
      { weapon: "copter", pos: v(30, 0, 18) }, // the yard's far corner, behind the trucks
      { weapon: "reaper", pos: v(-28, 0, 16) },
      { weapon: "sakura", pos: v(28.75, STACK_TOP, -18.25) }, // on the two-high container stack: a recoil climb
      { weapon: "rocket", pos: v(-16, 0, -12) }, // rockets in the hall: blow up the yard from the doorway
      { weapon: "shield", pos: v(-8, 0, -6) },
      { weapon: "grenade", pos: v(9, 0, -3) },
      { weapon: "health", pos: v(22.8, CONTAINER_TOP, -4.2) }, // on the mid-yard container, up its crate steps
    ],
    dummiesFight: true, dummyRespawn: 6, seed: 13,
    outdoor: true, designedSupplies: true,
    // bots: the doorway, then hall and yard lanes (the hall wall defeats a straight-line steer)
    nav: [v(-2.5, 0, 0), v(2.5, 0, 0), v(-8, 0, -2), v(-18, 0, -6), v(-20, 0, -12), v(-9, 0, 14), v(-26, 0, 9),
      v(6, 0, 0), v(15, 0, -6.5), v(17, 0, 2), v(27, 0, -8), v(17, 0, 12), v(8, 0, 12)],
  };
}

// ---- Junkyard ------------------------------------------------------------------------
const CAR = { l: 4.2, h: 1.5, w: 1.9 };

/** A stack of `n` cars at (x, z), lying along x (or z), each a little offset from the one below. */
export function stack(x: number, z: number, n: number, alongX = true): Box[] {
  const out: Box[] = [];
  for (let i = 0; i < n; i++) {
    const o = (i % 2 ? 0.18 : -0.1) * (alongX ? 1 : -1);
    const cx = x + (alongX ? o : 0);
    const cz = z + (alongX ? 0 : o);
    const hx = (alongX ? CAR.l : CAR.w) / 2;
    const hz = (alongX ? CAR.w : CAR.l) / 2;
    out.push({ ...box(cx - hx, i * CAR.h, cz - hz, cx + hx, (i + 1) * CAR.h, cz + hz), prop: "car" });
  }
  return out;
}

export function junkyardLevel(): Level {
  const p1 = v(-20, 0, 21);
  const p2 = v(20, 0, -21);
  // Stack tops come from the car meshes (sceneryJunkyard.ts), so pickups sit exactly on the roof you land on.
  const tower = stackTop(carStack(-7.5, -14, 4)), east = stackTop(carStack(15, -1, 4)), south = stackTop(carStack(-10, 14, 3));
  return {
    id: "junkyard", name: "Junkyard",
    arena: {
      boxes: [
        { ...box(-26, -1, -26, 26, 0, 26, "floor"), paint: "asphalt" },
        ...fence(-25, 25, -25, 25, 5, "corrugated"),
        { ...box(-2.5, 0, -2.5, 2.5, 3, 2.5), paint: "corrugated" }, // the crusher (the Gatling on top)
      ],
      dummySpawns: [v(-7.5, tower, -14), v(15, east, -1), v(-10, south, 14), v(0, 0, 8), v(-8, 0, -6), v(6, 0, -7)],
    },
    spawn: p1, spawnYaw: facing(p1, v(0, 0, 0)),
    spawns: [p1, p2], spawnYaws: [facing(p1, v(0, 0, 0)), facing(p2, v(0, 0, 0))],
    startWeapons: ["pistol", "shotgun"],
    pickups: [
      { weapon: "copter", pos: v(0, 3, 0) }, // on the crusher
      { weapon: "reaper", pos: v(-7.5, tower, -14) }, // on the four-car tower: a recoil perch
      { weapon: "sniper", pos: v(15, east, -1) },
      { weapon: "sakura", pos: v(-23, 0, -10.5) },
      { weapon: "axe", pos: v(-10, south, 14) }, // on a stack: the Rocket Axe flies you between them
      { weapon: "rocket", pos: v(13, 0, 21) },
      { weapon: "shield", pos: v(-10, 0, 7) },
      { weapon: "grenade", pos: v(-7, 0, -5) },
      { weapon: "health", pos: v(6, 0, 6.5) }, // the open court south-east of the crusher
    ],
    dummiesFight: true, dummyRespawn: 6, seed: 17,
    outdoor: true, designedSupplies: true,
    // bots: lane mouths and the gaps through each row of stacks
    nav: [v(-23, 0, -14), v(-1, 0, -14), v(21.5, 0, -14), v(-16, 0, -7), v(-1, 0, -7), v(16, 0, -7), v(-8, 0, -1), v(5, 0, -4),
      v(-12, 0, 7), v(-1, 0, 7), v(12, 0, 8), v(-22, 0, 13), v(-6.5, 0, 14), v(1.5, 0, 14), v(16.5, 0, 14), v(-8, 0, 20),
      v(6, 0, 20), v(0, 0, -20), v(14, 0, -20)],
    decor: [{ kind: "crusher", pos: v(0, 0, 0) }],
  };
}
