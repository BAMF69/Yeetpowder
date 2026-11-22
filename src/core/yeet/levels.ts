// ---------------------------------------------------------------------------
// levels.ts
// Purpose : The toy's levels as data: the room (collision boxes), where you start, which guns you start with, gun
//           pickups lying in the level, and whether the dummies fight back.
//             sandbox -> the original test room: every gun, dummies just stand there (Sandbox on the menu)
//             fight   -> "Fight Back": dummies shoot at you; you start with the Pea Pistol and Boomstick, the Spin
//                        Doctor lies on the ground, the Gatling Copter waits on an 11 m tower only a Boomstick launch
//                        reaches (Play on the menu)
// Usage   : const sim = new YeetSim(TUNING, fightLevel());   levelById("sandbox")
// Notes   : No three import. The tower height is checked by tests/yeetSim.test.ts: a Boomstick floor launch must
//           clear it and the Pea Pistol must not (from the floor or from the highest crate).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { box, room, testRoom, type Arena } from "./arena";
import type { WeaponId } from "./tuning";
import type { Vec3 } from "./vec";

export type LevelId = "sandbox" | "fight";

export interface Pickup {
  weapon: WeaponId;
  pos: Vec3;
}

export interface Level {
  id: LevelId;
  name: string;
  arena: Arena;
  spawn: Vec3;
  spawnYaw: number;
  startWeapons: WeaponId[];
  pickups: Pickup[];
  dummiesFight: boolean;
  /** Seconds a knocked-out dummy stays down. */
  dummyRespawn: number;
  /** Seed for the run's chance rolls (run-and-gun tumbles): same seed + same inputs = same run. */
  seed: number;
}

export function sandboxLevel(): Level {
  return {
    id: "sandbox", name: "Sandbox", arena: testRoom(), spawn: { x: 0, y: 0, z: 14 }, spawnYaw: 0,
    startWeapons: ["pistol", "shotgun", "sniper", "copter"], pickups: [], dummiesFight: false, dummyRespawn: 2.5,
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
    ],
    dummiesFight: true,
    dummyRespawn: 6,
    seed: 7,
  };
}

export function levelById(id: string | null | undefined): Level {
  return id === "sandbox" ? sandboxLevel() : fightLevel();
}
