// ---------------------------------------------------------------------------
// levels.ts
// Purpose : The toy's levels as data: the room (collision boxes), where you start, which guns you start with, gun
//           pickups lying in the level, and whether the dummies fight back.
//             sandbox -> the original test room: every gun, dummies just stand there (Sandbox on the menu)
//             fight   -> "Fight Back": dummies shoot at you; you start with the Pea Pistol and Boomstick, the Spin
//                        Doctor lies on the ground, the Gatling Copter waits on an 11 m tower only a Boomstick launch
//                        reaches (Play on the menu)
//             island, industrial, junkyard -> the new levels (levelsOutdoor.ts)
// Usage   : const sim = new YeetSim(TUNING, fightLevel());   levelById("sandbox")
// Notes   : No three import. The tower height is checked by tests/yeetSim.test.ts: a Boomstick floor launch must
//           clear it and the Pea Pistol must not (from the floor or from the highest crate).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { box, room, testRoom, type Arena } from "./arena";
import type { WeaponId } from "./tuning";
import type { Vec3 } from "./vec";
import { industrialLevel, islandLevel, junkyardLevel } from "./levelsOutdoor";
import { industrialPartyLevel, islandPartyLevel, junkyardPartyLevel, PARTY_LEVELS } from "./levelsParty";
import { coliseumLevel } from "./levelColiseum";

export type LevelId = "sandbox" | "fight" | "duel" | "island" | "industrial" | "junkyard" | "coliseum" | (typeof PARTY_LEVELS)[number];

/** The new levels a bot match can be played on (?bot=easy&level=island): no dummies then, just the two of you. */
export const BOT_LEVELS: LevelId[] = ["island", "industrial", "junkyard", "coliseum", ...PARTY_LEVELS];

export interface Pickup {
  weapon: WeaponId | "health";
  pos: Vec3;
}

export interface Level {
  id: LevelId;
  name: string;
  /** Layout capacity; the online lobby's player limit is configured separately. */
  recommendedPlayers?: number;
  /** Ring Out: hits and blasts still push players, but only leaving the arena knocks them out. */
  infiniteHp?: boolean;
  arena: Arena;
  spawn: Vec3;
  spawnYaw: number;
  /** Multiplayer: one spawn (and facing) per player slot; player 1 falls back to spawn/spawnYaw. */
  spawns?: Vec3[];
  spawnYaws?: number[];
  startWeapons: WeaponId[];
  pickups: Pickup[];
  dummiesFight: boolean;
  /** Seconds a knocked-out dummy stays down. */
  dummyRespawn: number;
  /** Seed for the run's chance rolls (run-and-gun tumbles): same seed + same inputs = same run. */
  seed: number;
  /** Open sky above (no ceiling over at least part of it): the renderer draws a sky and sunlight. */
  outdoor?: boolean;
  /** Water at this height: falling below it is a knockout (Shark Island; hazards.ts, the sim's eaten rule). */
  water?: { y: number };
  /** Scenery that is drawn but not collided with (palms, a crane): props.ts. */
  decor?: Decor[];
}

export interface Decor {
  kind: "palm" | "rock" | "crane" | "crusher";
  pos: Vec3;
  yaw?: number;
  scale?: number;
}

export function sandboxLevel(): Level {
  return {
    id: "sandbox", name: "Sandbox", arena: testRoom(), spawn: { x: 0, y: 0, z: 14 }, spawnYaw: 0,
    startWeapons: ["pistol", "shotgun", "sniper", "copter", "reaper", "sakura", "rocket", "grenade", "axe", "shield"], // every weapon, for testing
    pickups: [], dummiesFight: false, dummyRespawn: 2.5,
    seed: 1,
  };
}

/** The Gatling tower's top (m). Pea Pistol max reach from the highest crate stays well below (tests). */
export const TOWER_TOP = 11;

export function fightLevel(): Level {
  const half = 25; // a 50 x 50 m room
  return {
    id: "fight", name: "Fight Back",
    arena: {
      boxes: [
        ...room(half),
        box(-4, 0, -4, 4, TOWER_TOP, 4), // the Gatling tower: only a Boomstick floor launch gets you up
        box(-14, 0, 8, -6, 1.4, 9), // low cover walls (crouch-high: you can hop them)
        box(6, 0, 8, 14, 1.4, 9),
        box(-21, 0, -12, -19, 2, -4),
        box(19, 0, -14, 21, 2, -6),
        box(14, 0, -22, 22, 1.2, -21), // the wall in front of the Spin Doctor
        box(-16, 0, -22, -11, 2.5, -17), // crate stack (the highest crate: 2.5 m)
        box(9, 0, 14, 12, 1.6, 17), // crates near the start
        box(-12, 0, 15, -9, 1.6, 18),
      ],
      dummySpawns: [
        { x: -14, y: 2.5, z: -20 }, // on the crate stack
        { x: 14, y: 0, z: -12 },
        { x: -18, y: 0, z: 2 },
        { x: 17, y: 0, z: 2 },
        { x: 0, y: 0, z: -18 },
        { x: 2, y: TOWER_TOP, z: 2 }, // guarding the Gatling on the tower
      ],
    },
    spawn: { x: 0, y: 0, z: 21 },
    spawnYaw: 0,
    startWeapons: ["pistol", "shotgun"],
    pickups: [
      { weapon: "sniper", pos: { x: 18, y: 0, z: -23 } }, // on the ground, behind the far wall
      { weapon: "copter", pos: { x: -1.5, y: TOWER_TOP, z: -1.5 } }, // on the tower
      { weapon: "reaper", pos: { x: -22.5, y: 0, z: -1 } }, // rare gunblades on the flanks, near dummies
      { weapon: "sakura", pos: { x: 22.5, y: 0, z: -1 } },
    ],
    dummiesFight: true,
    dummyRespawn: 6,
    seed: 7,
  };
}

/**
 * The vertical slice's duel room (2 players, no dummies): 30 x 30 m, a low wall across the middle for cover, a 4 m
 * ledge in two corners to flip onto, crates to bonk. Start with the three standard guns; both gunblades lie on the
 * flanks and the Gatling Copter on a pedestal in the middle (slice decisions 4 and 7).
 */
export function duelLevel(): Level {
  return {
    id: "duel", name: "Duel",
    arena: {
      boxes: [
        ...room(15),
        box(-6, 0, -0.5, -1.5, 1.4, 0.5), // the low wall across the middle, with a gap at the centre
        box(1.5, 0, -0.5, 6, 1.4, 0.5),
        box(-0.8, 0, -0.8, 0.8, 1.2, 0.8), // the Gatling pedestal in the gap
        box(-15, 0, -15, -10, 4, -10), // corner ledges (4 m)
        box(10, 0, 10, 15, 4, 15),
        box(8, 0, -9, 10, 1.6, -7), // crates
        box(-10, 0, 7, -8, 1.6, 9),
      ],
      dummySpawns: [],
    },
    // both in the clear west lane (past the low wall's end): any line through the centre is blocked by the pedestal
    spawn: { x: -7.5, y: 0, z: 12 }, spawnYaw: 0,
    spawns: [{ x: -7.5, y: 0, z: 12 }, { x: -7.5, y: 0, z: -12 }],
    spawnYaws: [0, Math.PI], // facing each other down the lane
    startWeapons: ["pistol", "shotgun", "sniper"],
    pickups: [
      { weapon: "copter", pos: { x: 0, y: 1.2, z: 0 } },
      { weapon: "reaper", pos: { x: -13, y: 0, z: 2 } },
      { weapon: "sakura", pos: { x: 13, y: 0, z: -2 } },
    ],
    dummiesFight: false, dummyRespawn: 6, seed: 3,
  };
}

function baseLevelById(id: string | null | undefined): Level {
  switch (id) {
    case "sandbox": return sandboxLevel();
    case "duel": return duelLevel();
    case "island": return islandLevel();
    case "industrial": return industrialLevel();
    case "junkyard": return junkyardLevel();
    case "island-party": return islandPartyLevel();
    case "industrial-party": return industrialPartyLevel();
    case "junkyard-party": return junkyardPartyLevel();
    case "coliseum": return coliseumLevel();
    default: return fightLevel();
  }
}

export function levelById(id: string | null | undefined): Level {
  const level = baseLevelById(id);
  if (!level.outdoor) return level;
  const clear = (p: Vec3) => level.arena.boxes.some((b) => b.max.y <= p.y + 0.05 && Math.abs(b.max.y - p.y) < 0.1 && p.x >= b.min.x && p.x <= b.max.x && p.z >= b.min.z && p.z <= b.max.z)
    && !level.arena.boxes.some((b) => b.max.y > p.y + 0.1 && b.min.y < p.y + 1.7 && b.min.x < p.x + 0.5 && b.max.x > p.x - 0.5 && b.min.z < p.z + 0.5 && b.max.z > p.z - 0.5);
  const nearby = (p: Vec3) => Array.from({ length: 8 }, (_, i) => ({ x: p.x + Math.sin(i * Math.PI / 4) * 3, y: p.y, z: p.z + Math.cos(i * Math.PI / 4) * 3 })).find(clear);
  const spawns = level.spawns ?? [level.spawn];
  for (const p of spawns.filter((_, i) => i % 2 === 0)) level.pickups.push({ weapon: "health", pos: { ...p } });
  const shield = nearby(spawns[1] ?? level.spawn); if (shield) level.pickups.push({ weapon: "shield", pos: shield });
  if (level.recommendedPlayers === 8) spawns.forEach((p, i) => {
    const pos = nearby(p); if (pos && (!shield || pos.x !== shield.x || pos.z !== shield.z)) level.pickups.push({ weapon: ["shotgun", "grenade", "sniper", "rocket"][i % 4] as WeaponId, pos });
  });
  return level;
}
