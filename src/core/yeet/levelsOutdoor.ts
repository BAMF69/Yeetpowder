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
import type { Decor, Level } from "./levels";
import type { Vec3 } from "./vec";

const SOLID = 400; // m: walls and bounds are solid this high (the Gatling cannot fly over)
const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
/** The yaw that looks from `a` toward `b` (yaw 0 looks down -Z, + turns left). */
const facing = (a: Vec3, b: Vec3) => Math.atan2(-(b.x - a.x), -(b.z - a.z));

/** Four walls round a rectangle, drawn `drawTop` m tall and solid far above, painted `paint`. */
function fence(x0: number, x1: number, z0: number, z1: number, drawTop: number, paint?: Box["paint"]): Box[] {
  const wall = (b: Box): Box => ({ ...b, kind: "wall", drawTop, ...(paint ? { paint } : {}) });
  return [
    wall(box(x0 - 1, 0, z0 - 1, x1 + 1, SOLID, z0)),
    wall(box(x0 - 1, 0, z1, x1 + 1, SOLID, z1 + 1)),
    wall(box(x0 - 1, 0, z0, x0, SOLID, z1)),
    wall(box(x1, 0, z0, x1 + 1, SOLID, z1)),
  ];
}

/** Invisible solid bounds round an open level (and a lid), so nothing leaves it. */
function bounds(half: number, lid: number): Box[] {
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
  const decor: Decor[] = [
    { kind: "palm", pos: v(-10, 0, 10), yaw: 0.4 }, { kind: "palm", pos: v(10.5, 0, 9.5), yaw: 2.1, scale: 1.15 },
    { kind: "palm", pos: v(-10.5, 0, -9), yaw: 4, scale: 0.9 }, { kind: "palm", pos: v(9, 0, -11), yaw: 5.2 },
    { kind: "rock", pos: v(-12, 0, 1), scale: 1.3 }, { kind: "rock", pos: v(12, 0, -3), scale: 1 },
  ];
  return {
    id: "island", name: "Shark Island",
    arena: {
      boxes: [
        { ...box(-13, -4, -13, 13, 0, 13, "floor"), paint: "sand" }, // the island (its sides are the cliffs)
        { ...box(-4, 0, -4, 4, 2.5, 4), paint: "rock" }, // the hill in the middle
        { ...box(4.5, 0, 6.5, 7.5, 1.4, 9.5), paint: "rock" }, // a low rock to hop
        { ...box(-9, 0, 5, -6.5, 1.2, 6.5), paint: "rock" },
        ...platforms,
        ...bounds(70, 45),
      ],
      dummySpawns: [...PLATFORMS, v(0, 2.5, 0), v(8, 0, 4)],
    },
    spawn: p1, spawnYaw: facing(p1, v(0, 0, 0)),
    spawns: [p1, p2], spawnYaws: [facing(p1, v(0, 0, 0)), facing(p2, v(0, 0, 0))],
    startWeapons: ["pistol", "shotgun"], // the Boomstick is the launcher: knock them into the sea
    pickups: [
      { weapon: "sniper", pos: v(1, 2.5, 1) }, // on the hill
      { weapon: "reaper", pos: v(-24, 0.5, 1.5) },
      { weapon: "sakura", pos: v(24, 0.5, -1.5) },
      { weapon: "copter", pos: v(1.5, 0.5, -24) }, // the Gatling over the water: risky
    ],
    dummiesFight: true, dummyRespawn: 5, seed: 11,
    outdoor: true, water: { y: ISLAND_WATER }, decor,
  };
}

// ---- Industrial Yard -------------------------------------------------------------------
const HALL_H = 12; // m: the hall's roof
/** An explosive vehicle or drum: a box the renderer draws as one (hazards.ts gives it health and a blast). */
const truck = (x: number, z: number, alongX = true): Box => alongX
  ? { ...box(x - 3.5, 0, z - 1.3, x + 3.5, 3, z + 1.3), prop: "truck" }
  : { ...box(x - 1.3, 0, z - 3.5, x + 1.3, 3, z + 3.5), prop: "truck" };
const tank = (x: number, z: number): Box => ({ ...box(x - 3.5, 0, z - 1.8, x + 3.5, 2.6, z + 1.8), prop: "tank" });
const drum = (x: number, z: number): Box => ({ ...box(x - 0.4, 0, z - 0.4, x + 0.4, 1.2, z + 0.4), prop: "drum" });

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
        ...fence(-32, 32, -20, 20, 5, "corrugated"), // the yard's fence (the hall's walls are drawn taller below)
        hallWall(box(-33, 0, -21, -32, SOLID, 21)), // the hall: west wall, north and south walls drawn to the roof
        hallWall(box(-32, 0, -21, 0, SOLID, -20)),
        hallWall(box(-32, 0, 20, 0, SOLID, 21)),
        hallWall(box(-0.5, 0, -20, 0.5, SOLID, -4)), // the wall between hall and yard, with an 8 m doorway
        hallWall(box(-0.5, 0, 4, 0.5, SOLID, 20)),
        box(-0.5, 6, -4, 0.5, HALL_H, 4), // over the doorway
        box(-33, HALL_H, -21, 0.5, HALL_H + 1, 21, "ceiling"), // the hall's roof (the yard is open sky)
        // inside: a catwalk along the north wall, crate steps up to it, crates and steel cover
        box(-30, 4, -19.5, -6, 4.4, -16.5),
        box(-10, 0, -16, -8, 1.6, -14),
        box(-8, 0, -17, -6, 3.2, -14),
        box(-20, 0, 4, -17, 1.6, 7),
        box(-24, 0, 10, -21, 3.2, 13),
        box(-14, 0, -2, -12.8, 1.4, 6),
        box(-27, 0, -8, -25.8, 1.4, -2),
        // the yard: trucks, a tank, fuel drums (all explode), containers and concrete barriers
        truck(11.5, -12.7),
        truck(23.5, 11.3),
        tank(21.5, -4.2),
        drum(6, 8), drum(6.9, 8.6), drum(12, 4), drum(26, -16), drum(5, -6), drum(15.5, 13),
        { ...box(26, 0, -19.5, 31.5, 2.6, -17), paint: "container" },
        { ...box(26, 2.6, -19.5, 31.5, 5.2, -17), paint: "container" },
        { ...box(3, 0, 15, 5.4, 2.6, 19.5), paint: "container" },
        box(10, 0, 0, 14, 1, 0.6),
        box(17, 0, 5, 17.6, 1, 9),
      ],
      dummySpawns: [v(20, 0, 1.5), v(14, 0, 7), v(29, 0, -9), v(-20, 4.4, -18), v(-10, 0, 9), v(23.5, 3, 11.3), v(7, 0, 14)],
    },
    spawn: p1, spawnYaw: facing(p1, p2),
    spawns: [p1, p2], spawnYaws: [facing(p1, p2), facing(p2, p1)],
    startWeapons: ["pistol", "shotgun"],
    pickups: [
      { weapon: "sniper", pos: v(-28, 4.4, -18) }, // on the catwalk
      { weapon: "copter", pos: v(30, 0, 18) },
      { weapon: "reaper", pos: v(-28, 0, 16) },
      { weapon: "sakura", pos: v(16, 0, 17) },
    ],
    dummiesFight: true, dummyRespawn: 6, seed: 13,
    outdoor: true,
  };
}

// ---- Junkyard ------------------------------------------------------------------------
const CAR = { l: 4.2, h: 1.5, w: 1.9 };

/** A stack of `n` cars at (x, z), lying along x (or z), each a little offset from the one below. */
function stack(x: number, z: number, n: number, alongX = true): Box[] {
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
  return {
    id: "junkyard", name: "Junkyard",
    arena: {
      boxes: [
        { ...box(-26, -1, -26, 26, 0, 26, "floor"), paint: "asphalt" },
        ...fence(-25, 25, -25, 25, 5, "corrugated"),
        // the north row, lanes between the stacks
        ...stack(-18, -14, 3), ...stack(-12, -14, 2), ...stack(-6, -14, 4), ...stack(4, -14, 1), ...stack(10, -14, 3), ...stack(18, -14, 2),
        // the middle: stacks round the crusher's plaza
        ...stack(-20, 0, 2), ...stack(-14, 1, 1), ...stack(9, 0, 2), ...stack(15, -1, 4), ...stack(21, 0, 1),
        { ...box(-2.5, 0, -2.5, 2.5, 3, 2.5), paint: "corrugated" }, // the crusher (the Gatling on top)
        // the south row
        ...stack(-17, 13, 1), ...stack(-10, 14, 3), ...stack(-3, 14, 2), ...stack(6, 13, 4), ...stack(13, 14, 1),
        // along the sides
        ...stack(-23, -5, 2, false), ...stack(23, 7, 3, false), ...stack(23, 18, 1, false),
      ],
      dummySpawns: [v(-6, 6, -14), v(15, 6, -1), v(6, 6, 13), v(-10, 4.5, 14), v(0, 0, 8), v(-8, 0, -6)],
    },
    spawn: p1, spawnYaw: facing(p1, v(0, 0, 0)),
    spawns: [p1, p2], spawnYaws: [facing(p1, v(0, 0, 0)), facing(p2, v(0, 0, 0))],
    startWeapons: ["pistol", "shotgun"],
    pickups: [
      { weapon: "copter", pos: v(0, 3, 0) }, // on the crusher
      { weapon: "reaper", pos: v(-6, 6, -13.6) }, // on the tallest north stack
      { weapon: "sniper", pos: v(15, 6, -0.6) },
      { weapon: "sakura", pos: v(-22, 0, -14) },
    ],
    dummiesFight: true, dummyRespawn: 6, seed: 17,
    outdoor: true,
    decor: [{ kind: "crane", pos: v(19, 0, 19), yaw: 2.4 }, { kind: "crusher", pos: v(0, 0, 0) }],
  };
}
