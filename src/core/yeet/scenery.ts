import { box, type Box } from "./arena";
import type { Vec3 } from "./vec";

/** Verified original Vinish exports. Metre bounds measured from their glTF node transforms. */
export const SCENERY_ART = {
  mixer: { file: "industrial/industrial-mixer", size: [1.364513, 2.75, 1.529499] },
  conveyor: { file: "industrial/belt-conveyor", size: [1.055, 1.124, 3.002] },
  toilet: { file: "industrial/portable-toilet", size: [1.24, 2.795, 1.24] },
  skip: { file: "industrial/skip", size: [1.964833, 1.365, 3.73] },
  crate: { file: "industrial/wooden-crate", size: [0.9552, 0.9456, 0.9552] },
  oilDrum: { file: "junkyard/oil-drum", size: [0.585, 0.887, 0.585] },
  crab: { file: "island/crab", size: [0.552911, 0.148445, 0.472341] },
  turtle: { file: "island/sea-turtle", size: [1.875109, 0.289679, 1.370344] },
} as const;
export type SceneryId = keyof typeof SCENERY_ART;
export interface SceneryPlacement { art: SceneryId; pos: Vec3; scale: number; quarter: number; solid: boolean }
const place = (art: SceneryId, x: number, y: number, z: number, scale = 1, quarter = 0, solid = true): SceneryPlacement =>
  ({ art, pos: { x, y, z }, scale, quarter, solid });

/** Small batches leave primary duel/Party routes and spawn exits open. */
export function sceneryFor(level: string): SceneryPlacement[] {
  if (level.startsWith("industrial")) return [
    place("mixer", -29.5, 0, -12), place("conveyor", -19, 0, -7, 1.4, 1),
    place("toilet", 30, 0, 12.5), place("skip", 9, 0, 17, 1, 1),
  ];
  if (level.startsWith("junkyard")) return [
    place("skip", -19, 0, 8, 1, 1),
    place("crate", -3.12, 0, 1.5, 1.15),
    place("oilDrum", 17, 0, 20, 1.3), place("oilDrum", 18, 0, 20, 1.3), place("oilDrum", 17.5, 0, 21, 1.3),
  ];
  if (level.startsWith("island")) return [
    place("crab", 10.3, 0.015, -9, 1.2, 1, false),
    place("turtle", -8.8, 0.015, -11.4, 0.7, 1, false),
  ];
  return [];
}

export function sceneryBox(p: SceneryPlacement): Box {
  const size = SCENERY_ART[p.art].size;
  const x = size[p.quarter % 2 ? 2 : 0] * p.scale / 2, z = size[p.quarter % 2 ? 0 : 2] * p.scale / 2;
  return { ...box(p.pos.x - x, p.pos.y, p.pos.z - z, p.pos.x + x, p.pos.y + size[1] * p.scale, p.pos.z + z), prop: "scenery" };
}
