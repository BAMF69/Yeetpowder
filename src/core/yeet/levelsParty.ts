// Eight-spawn arena variants. Distances grow; cars, cover heights and jumps stay human-sized.
// Each arena has multiple cross-routes, protected edge spawns and contested elevated pickups.
import { box, type Box } from "./arena";
import type { Level } from "./levels";
import { bounds, fence, yardFence, stair, ISLAND_WATER } from "./levelsOutdoor";
import { carStack, stackTop } from "./sceneryJunkyard";
import { CONTAINER_TOP, STACK_TOP } from "./sceneryIndustrial";
import type { Vec3 } from "./vec";

export const PARTY_LEVELS = ["island-party", "industrial-party", "junkyard-party"] as const;
const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const facing = (a: Vec3, b = v(0, 0, 0)) => Math.atan2(a.x - b.x, a.z - b.z);
const painted = (b: Box, paint: Box["paint"]): Box => ({ ...b, paint });

export function islandPartyLevel(): Level {
  const spawns = [v(-18, 0, -18), v(0, 0, -22), v(18, 0, -18), v(22, 0, 0),
    v(18, 0, 18), v(0, 0, 22), v(-18, 0, 18), v(-22, 0, 0)];
  const satellites = [v(40, 0.5, 0), v(-40, 0.5, 0), v(0, 0.5, 40), v(0, 0.5, -40)];
  return {
    id: "island-party", name: "Shark Island — Party", recommendedPlayers: 8,
    arena: { boxes: [
      // Cross-shaped beach gives an irregular coastline rather than a single stretched square.
      painted(box(-26, -4, -20, 26, 0, 20, "floor"), "sand"),
      painted(box(-20, -4, -26, 20, 0, 26, "floor"), "sand"),
      painted(box(-6, 0, -6, 6, 3, 6), "rock"),
      painted(box(-3.5, 3, -3.5, 3.5, 5, 3.5), "rock"),
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
      { weapon: "axe", pos: v(0, 3, 5) }, { weapon: "shield", pos: v(12, 0, 4) },
      // both rare supplies on the central rock's lower tier, up the boulder stairs: contested, far from spawns
      { weapon: "grenade", pos: v(4.6, 3, -4.6) }, { weapon: "health", pos: v(-4.6, 3, 4.6) },
    ], dummiesFight: true, dummyRespawn: 5, seed: 111,
    outdoor: true, water: { y: ISLAND_WATER }, designedSupplies: true,
  };
}

export function industrialPartyLevel(): Level {
  const spawns = [v(-56, 0, -30), v(-56, 0, 30), v(-22, 0, -34), v(-22, 0, 34),
    v(22, 0, -34), v(22, 0, 34), v(56, 0, -30), v(56, 0, 30)];
  const wall = (b: Box): Box => ({ ...b, kind: "wall", drawTop: 12 });
  const structure: Box[] = [];
  // Three warehouse doors avoid funnelling eight people through the duel map's one entrance. The end segments run
  // all the way to the outer walls (the first Party build left 1 m slots at z = +-39.5).
  for (const [z0, z1] of [[-40, -27], [-17, -5], [5, 17], [27, 40]]) structure.push(wall(box(-0.5, 0, z0, 0.5, 400, z1)));
  for (const z of [-22, 0, 22]) structure.push(box(-0.5, 6, z - 5, 0.5, 12, z + 5));
  // Low concrete barriers along the east lane: 1 m, hoppable (machinery and containers: sceneryIndustrial.ts).
  for (const z of [-22, 0, 22]) structure.push(painted(box(40, 0, z - 3, 41, 1, z + 3), "concrete"));
  return {
    id: "industrial-party", name: "Industrial Yard — Party", recommendedPlayers: 8,
    arena: { boxes: [
      box(-65, -1, -41, 0, 0, 41, "floor"),
      painted(box(0, -1, -41, 65, 0, 41, "floor"), "asphalt"),
      ...yardFence(64, -40, 40),
      wall(box(-65, 0, -41, -64, 400, 41)), wall(box(-64, 0, -41, 0, 400, -40)),
      wall(box(-64, 0, 40, 0, 400, 41)), box(-65, 12, -41, 0, 13, 41, "ceiling"),
      ...structure,
      // Two catwalks joined by a crosswalk; each catwalk has a concrete stair down toward its door.
      box(-60, 4, -38, -8, 4.4, -35), box(-60, 4, 35, -8, 4.4, 38),
      box(-34, 4, -35, -31, 4.4, 35),
      ...stair(-8, -38, -35, 4.4, 1), ...stair(-8, 35, 38, 4.4, 1),
    ], dummySpawns: [v(-50, 4.4, -36), v(-40, 4.4, 36), v(-32.5, 4.4, 0), v(-14, 0, 12),
      v(20, CONTAINER_TOP, 0.05), v(20, CONTAINER_TOP, -25.4), v(48, 0, 2)] },
    spawn: spawns[0], spawnYaw: facing(spawns[0]), spawns, spawnYaws: spawns.map((p) => facing(p)),
    startWeapons: ["pistol", "shotgun"],
    pickups: [
      { weapon: "sniper", pos: v(-50, 4.4, -36.5) }, { weapon: "sniper", pos: v(40, STACK_TOP, -33.8) },
      { weapon: "copter", pos: v(-32.5, 4.4, 0) }, { weapon: "rocket", pos: v(23.5, CONTAINER_TOP, 0.05) },
      { weapon: "reaper", pos: v(-52, 0, 14) }, { weapon: "sakura", pos: v(50, 0, -2) },
      { weapon: "axe", pos: v(22, STACK_TOP, -2.4) }, { weapon: "shield", pos: v(-30, 0, -11) },
      { weapon: "grenade", pos: v(-12, 0, 0) }, { weapon: "health", pos: v(31, 0, 6) },
    ], dummiesFight: true, dummyRespawn: 6, seed: 113, outdoor: true, designedSupplies: true,
    // bots: both sides of each warehouse door, hall lanes and yard lanes
    nav: [...[-22, 0, 22].flatMap((z) => [v(-3, 0, z), v(3, 0, z), v(-30, 0, z), v(-50, 0, z)]), v(-15, 0, -11), v(-15, 0, 11),
      v(12, 0, -20), v(12, 0, 0), v(12, 0, 13), v(30, 0, -15), v(30, 0, 8), v(29, 0, 31), v(50, 0, 0), v(50, 0, -25), v(50, 0, 25)],
  };
}

export function junkyardPartyLevel(): Level {
  const spawns = [v(-43, 0, -43), v(0, 0, -44), v(43, 0, -43), v(46, 0, 0),
    v(43, 0, 43), v(0, 0, 44), v(-43, 0, 43), v(-46, 0, 0)];
  // Four themed salvage courts joined by a clear cross and perimeter loop (sceneryJunkyard.ts).
  const craneTower = stackTop(carStack(-19, -33, 4)), burntTower = stackTop(carStack(-18, 15, 4, true, "charredCar"));
  return {
    id: "junkyard-party", name: "Junkyard — Party", recommendedPlayers: 8,
    arena: { boxes: [
      painted(box(-51, -1, -51, 51, 0, 51, "floor"), "asphalt"),
      ...fence(-50, 50, -50, 50, 5, "corrugated"),
      painted(box(-4, 0, -4, 4, 3, 4), "corrugated"),
      // Elevated crossing; two-car launch steps round it are scenery. Lanes below stay open to ordinary running.
      box(-15, 4, -1.5, 15, 4.4, 1.5), box(-1.5, 4, -15, 1.5, 4.4, 15),
    ], dummySpawns: [v(-25, 0, -20), v(-19, craneTower, -33), v(-18, burntTower, 15), v(32, 0, 30),
      v(0, 4.4, 0), v(-12, 0, 22), v(12, 0, -22)] },
    spawn: spawns[0], spawnYaw: facing(spawns[0]), spawns, spawnYaws: spawns.map((p) => facing(p)),
    startWeapons: ["pistol", "shotgun"],
    pickups: [
      { weapon: "copter", pos: v(0, 4.4, 0) },
      { weapon: "sniper", pos: v(-19, craneTower, -33) }, { weapon: "sniper", pos: v(-18, burntTower, 15) },
      { weapon: "reaper", pos: v(-12, 0, 22) }, { weapon: "sakura", pos: v(12, 0, -22) },
      { weapon: "rocket", pos: v(25, 0, 24) }, { weapon: "axe", pos: v(-18, 0, -24) },
      { weapon: "shield", pos: v(13, 0, 13) },
      { weapon: "grenade", pos: v(0, 0, -24) }, { weapon: "health", pos: v(-13, 0, -13) },
    ], dummiesFight: true, dummyRespawn: 6, seed: 117, outdoor: true, designedSupplies: true,
    // bots: the open cross lanes and the perimeter loop between the courts
    nav: [v(0, 0, -12), v(0, 0, 12), v(-12, 0, 0), v(12, 0, 0), v(0, 0, -30), v(0, 0, 30), v(-30, 0, 0), v(30, 0, 0),
      v(-46, 0, -24), v(-46, 0, 24), v(46, 0, -24), v(46, 0, 24), v(-24, 0, -46), v(24, 0, -46), v(-24, 0, 46), v(24, 0, 46)],
    decor: [{ kind: "crusher", pos: v(0, 0, 0) }],
  };
}
