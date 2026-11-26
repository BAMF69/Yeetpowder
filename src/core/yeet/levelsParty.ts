// Eight-spawn arena variants. Distances grow; cars, cover heights and jumps stay human-sized.
// Each arena has multiple cross-routes, protected edge spawns and contested elevated pickups.
import { box, type Box } from "./arena";
import type { Decor, Level } from "./levels";
import { bounds, drum, fence, yardFence, stack, tank, truck, ISLAND_WATER } from "./levelsOutdoor";
import type { Vec3 } from "./vec";

export const PARTY_LEVELS = ["island-party", "industrial-party", "junkyard-party"] as const;
const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const facing = (a: Vec3, b = v(0, 0, 0)) => Math.atan2(a.x - b.x, a.z - b.z);
const painted = (b: Box, paint: Box["paint"]): Box => ({ ...b, paint });

export function islandPartyLevel(): Level {
  const spawns = [v(-18, 0, -18), v(0, 0, -22), v(18, 0, -18), v(22, 0, 0),
    v(18, 0, 18), v(0, 0, 22), v(-18, 0, 18), v(-22, 0, 0)];
  const satellites = [v(40, 0.5, 0), v(-40, 0.5, 0), v(0, 0.5, 40), v(0, 0.5, -40)];
  const rocks: Box[] = [];
  const decor: Decor[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * 13, z = sz * 12;
    rocks.push(painted(box(x - 2.5, 0, z - 2, x + 2.5, 2.4, z + 2), "rock"));
    rocks.push(painted(box(sx * 8 - 1.5, 0, sz * 6 - 1.5, sx * 8 + 1.5, 1.4, sz * 6 + 1.5), "rock"));
    decor.push({ kind: "palm", pos: v(sx * 21, 0, sz * 13), yaw: sx + sz, scale: 1.2 },
      { kind: "palm", pos: v(sx * 12, 0, sz * 22), yaw: sx - sz, scale: 0.9 });
  }
  return {
    id: "island-party", name: "Shark Island — Party", recommendedPlayers: 8,
    arena: { boxes: [
      // Cross-shaped beach gives an irregular coastline rather than a single stretched square.
      painted(box(-26, -4, -20, 26, 0, 20, "floor"), "sand"),
      painted(box(-20, -4, -26, 20, 0, 26, "floor"), "sand"),
      painted(box(-6, 0, -6, 6, 3, 6), "rock"),
      painted(box(-3.5, 3, -3.5, 3.5, 5, 3.5), "rock"),
      ...rocks,
      ...satellites.map((p) => painted(box(p.x - 5, -5, p.z - 5, p.x + 5, p.y, p.z + 5, "floor"), "rock")),
      // Exposed stone causeways: a second route to each risky weapon platform.
      painted(box(24, -2, -2, 36, 0.35, 2), "rock"),
      painted(box(-36, -2, -2, -24, 0.35, 2), "rock"),
      painted(box(-2, -2, 24, 2, 0.35, 36), "rock"),
      painted(box(-2, -2, -36, 2, 0.35, -24), "rock"),
      ...bounds(90, 55),
    ], dummySpawns: [...satellites, v(0, 5, 0), v(12, 0, 4), v(-12, 0, -4)] },
    spawn: spawns[0], spawnYaw: facing(spawns[0]), spawns, spawnYaws: spawns.map((p) => facing(p)),
    startWeapons: ["pistol", "shotgun"],
    pickups: [
      { weapon: "sniper", pos: v(0, 5, 0) },
      { weapon: "copter", pos: v(0, 0.5, -40) }, { weapon: "rocket", pos: v(0, 0.5, 40) },
      { weapon: "reaper", pos: v(-40, 0.5, 0) }, { weapon: "sakura", pos: v(40, 0.5, 0) },
      { weapon: "grenade", pos: v(-12, 0, 4) }, { weapon: "grenade", pos: v(12, 0, -4) },
      { weapon: "axe", pos: v(0, 3, 5) },
    ], dummiesFight: true, dummyRespawn: 5, seed: 111,
    outdoor: true, water: { y: ISLAND_WATER }, decor,
  };
}

export function industrialPartyLevel(): Level {
  const spawns = [v(-56, 0, -30), v(-56, 0, 30), v(-22, 0, -34), v(-22, 0, 34),
    v(22, 0, -34), v(22, 0, 34), v(56, 0, -30), v(56, 0, 30)];
  const wall = (b: Box): Box => ({ ...b, kind: "wall", drawTop: 12 });
  const cover: Box[] = [];
  // Three warehouse doors avoid funnelling eight people through the duel map's one entrance.
  for (const [z0, z1] of [[-39, -27], [-17, -5], [5, 17], [27, 39]]) cover.push(wall(box(-0.5, 0, z0, 0.5, 400, z1)));
  for (const z of [-22, 0, 22]) cover.push(box(-0.5, 6, z - 5, 0.5, 12, z + 5));
  for (const z of [-22, 0, 22]) {
    cover.push(box(-43, 0, z - 3, -39, 2, z + 3), box(-23, 0, z - 6, -21, 2.2, z + 2));
    cover.push(painted(box(16, 0, z - 5, 28, 3, z), "container"));
    cover.push(box(40, 0, z - 3, 41, 1.2, z + 3));
  }
  return {
    id: "industrial-party", name: "Industrial Yard — Party", recommendedPlayers: 8,
    arena: { boxes: [
      box(-65, -1, -41, 0, 0, 41, "floor"),
      painted(box(0, -1, -41, 65, 0, 41, "floor"), "asphalt"),
      ...yardFence(64, -40, 40),
      wall(box(-65, 0, -41, -64, 400, 41)), wall(box(-64, 0, -41, 0, 400, -40)),
      wall(box(-64, 0, 40, 0, 400, 41)), box(-65, 12, -41, 0, 13, 41, "ceiling"),
      ...cover,
      // Two catwalk routes and stepping crates; a central crosswalk joins them above the hall.
      box(-60, 4, -38, -8, 4.4, -35), box(-60, 4, 35, -8, 4.4, 38),
      box(-34, 4, -35, -31, 4.4, 35),
      box(-11, 0, -33, -8, 1.6, -30), box(-11, 0, -36, -8, 3.2, -33),
      box(-60, 0, 30, -57, 1.6, 33), box(-60, 0, 33, -57, 3.2, 35),
      truck(10, -12), truck(45, 14, false), tank(47, -17),
      drum(8, 16), drum(9, 16.5), drum(33, -9), drum(36, 24), drum(55, 0), drum(12, -32),
      painted(box(34, 0, -35, 46, 3, -30), "container"),
      painted(box(34, 3, -35, 46, 6, -30), "container"),
    ], dummySpawns: [v(-50, 4.4, -36), v(-40, 4.4, 36), v(-32.5, 4.4, 0), v(-14, 0, 12),
      v(20, 3, -2), v(20, 3, 20), v(48, 0, 2)] },
    spawn: spawns[0], spawnYaw: facing(spawns[0]), spawns, spawnYaws: spawns.map((p) => facing(p)),
    startWeapons: ["pistol", "shotgun"],
    pickups: [
      { weapon: "sniper", pos: v(-50, 4.4, -36) }, { weapon: "sniper", pos: v(40, 6, -32) },
      { weapon: "copter", pos: v(-32.5, 4.4, 0) }, { weapon: "rocket", pos: v(22, 3, -2) },
      { weapon: "reaper", pos: v(-52, 0, 14) }, { weapon: "sakura", pos: v(52, 0, -2) },
      { weapon: "grenade", pos: v(-12, 0, 0) }, { weapon: "grenade", pos: v(34, 0, 12) },
      { weapon: "axe", pos: v(22, 3, 20) },
    ], dummiesFight: true, dummyRespawn: 6, seed: 113, outdoor: true,
    decor: [{ kind: "crane", pos: v(54, 0, 29), yaw: 2.5 }],
  };
}

export function junkyardPartyLevel(): Level {
  const spawns = [v(-43, 0, -43), v(0, 0, -44), v(43, 0, -43), v(46, 0, 0),
    v(43, 0, 43), v(0, 0, 44), v(-43, 0, 43), v(-46, 0, 0)];
  const cars: Box[] = [];
  // Four salvage courts, joined by a clear cross and perimeter loop. Stacks retain duel-map dimensions.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = sx * 25, cz = sz * 24;
    cars.push(...stack(cx - 7, cz - 9, 3), ...stack(cx, cz - 9, 2), ...stack(cx + 7, cz - 9, 4));
    cars.push(...stack(cx - 7, cz + 9, 2), ...stack(cx + 7, cz + 9, 3));
    cars.push(...stack(cx + sx * 11, cz, 2, false));
  }
  return {
    id: "junkyard-party", name: "Junkyard — Party", recommendedPlayers: 8,
    arena: { boxes: [
      painted(box(-51, -1, -51, 51, 0, 51, "floor"), "asphalt"),
      ...fence(-50, 50, -50, 50, 5, "corrugated"), ...cars,
      painted(box(-4, 0, -4, 4, 3, 4), "corrugated"),
      // Elevated crossing with four launch steps; lanes below stay open to ordinary running.
      box(-15, 4, -1.5, 15, 4.4, 1.5), box(-1.5, 4, -15, 1.5, 4.4, 15),
      ...stack(-11, -7, 2), ...stack(11, 7, 2), ...stack(-7, 11, 2, false), ...stack(7, -11, 2, false),
      painted(box(-44, 0, -6, -40, 2, 6), "container"),
      painted(box(40, 0, -6, 44, 2, 6), "container"),
    ], dummySpawns: [v(-25, 3, -33), v(32, 6, -33), v(-18, 6, 15), v(32, 4.5, 33),
      v(0, 4.4, 0), v(-12, 0, 22), v(12, 0, -22)] },
    spawn: spawns[0], spawnYaw: facing(spawns[0]), spawns, spawnYaws: spawns.map((p) => facing(p)),
    startWeapons: ["pistol", "shotgun"],
    pickups: [
      { weapon: "copter", pos: v(0, 4.4, 0) },
      { weapon: "sniper", pos: v(32, 6, -33) }, { weapon: "sniper", pos: v(-18, 6, 15) },
      { weapon: "reaper", pos: v(-12, 0, 22) }, { weapon: "sakura", pos: v(12, 0, -22) },
      { weapon: "rocket", pos: v(25, 0, 24) }, { weapon: "axe", pos: v(-25, 0, -24) },
      { weapon: "grenade", pos: v(-25, 0, 24) }, { weapon: "grenade", pos: v(25, 0, -24) },
    ], dummiesFight: true, dummyRespawn: 6, seed: 117, outdoor: true,
    decor: [{ kind: "crusher", pos: v(0, 0, 0) }, { kind: "crane", pos: v(40, 0, 37), yaw: 2.4 },
      { kind: "crane", pos: v(-40, 0, -37), yaw: -0.7 }],
  };
}
