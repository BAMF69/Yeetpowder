// ---------------------------------------------------------------------------
// scenery.ts
// Purpose : The reviewed scenery models as data: where each file lives, its measured bounds, and the simple
//           gameplay colliders that stand in for its visual mesh. A placement (model, position, quarter turn,
//           uniform scale, optional vertical stack) expands into AABB boxes the sim, bots and renderer all share.
// Usage   : const boxes = sceneryBoxes(place("container", 4, 0, 10, 3.1, 1));   sceneryFor("junkyard-party")
// Notes   : No three import. Bounds and collider boxes are in the model's own units, measured from its vertices
//           (tools/prepare_scenery.py stages the files; docs/licenses/scenery-sources.json records provenance).
//           Colliders follow what you would stand on or hide behind, not every spike: crane jibs, palm crowns,
//           forklift forks and scaffold rails are drawn but not solid. Quarter turns only, so a collider stays an
//           exact AABB. Heights avoid the band a jump cannot clear but a bot would try to hop (layouts check it).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5); collider catalog for the 2026-11-26 level pass.
// ---------------------------------------------------------------------------
import { box, type Box, type ExplosiveKind } from "./arena";
import type { Vec3 } from "./vec";

/** One collider in model units: [minX, minY, minZ, maxX, maxY, maxZ]. */
export type ColliderSpec = readonly [number, number, number, number, number, number];
export interface SceneryArt {
  /** Under public/assets/models/scenery/, without .glb. */
  file: string;
  /** Model-space bounds (min corner, size), measured from the file's vertices. */
  min: readonly [number, number, number];
  size: readonly [number, number, number];
  /** Model-space colliders; none means the model is decoration only. */
  colliders: readonly ColliderSpec[];
  /** Idle animation clip that may play when the placement is not solid (wildlife). */
  idle?: string;
}

/** A collider covering a fraction of the bounds, centred in x/z and standing on the base. */
function fit(min: readonly number[], size: readonly number[], fx: number, fy: number, fz: number): ColliderSpec {
  const cx = min[0] + size[0] / 2, cz = min[2] + size[2] / 2;
  return [cx - size[0] * fx / 2, min[1], cz - size[2] * fz / 2, cx + size[0] * fx / 2, min[1] + size[1] * fy, cz + size[2] * fz / 2];
}
function art(file: string, min: [number, number, number], size: [number, number, number], colliders: "none" | [number, number, number] | ColliderSpec[], idle?: string): SceneryArt {
  const spec = colliders === "none" ? [] : typeof colliders[0] === "number" ? [fit(min, size, ...(colliders as [number, number, number]))] : colliders as ColliderSpec[];
  return { file, min, size, colliders: spec, idle };
}

export const SCENERY_ART = {
  // ---- vinish.dev originals (metres) ----
  mixer: art("vinish/industrial/industrial-mixer", [-0.745, 0, -0.843], [1.365, 2.75, 1.529], [0.85, 1, 0.85]),
  conveyor: art("vinish/industrial/belt-conveyor", [-0.375, 0, -1.52], [1.055, 1.124, 3.002], [0.95, 0.9, 1]),
  toilet: art("vinish/industrial/portable-toilet", [-0.62, 0, -0.62], [1.24, 2.795, 1.24], [1, 1, 1]),
  skip: art("vinish/industrial/skip", [-0.982, 0, -1.865], [1.965, 1.365, 3.73], [1, 1, 1]),
  crate: art("vinish/industrial/wooden-crate", [-0.478, 0, -0.478], [0.955, 0.946, 0.955], [1, 1, 1]),
  cementMixer: art("vinish/industrial/cement-mixer", [-0.49, 0, -0.56], [0.98, 1.661, 1.65], [0.8, 1, 0.75]),
  cyclone: art("vinish/industrial/cyclone-dust-collector", [-0.465, 0, -0.465], [1.565, 3.29, 0.945], [0.65, 1, 0.95]),
  fuelCan: art("vinish/industrial/fuel-can", [-0.177, 0, -0.087], [0.355, 0.51, 0.174], "none"),
  compressor: art("vinish/industrial/industrial-air-compressor", [-0.92, 0, -0.3], [1.84, 1.284, 0.6], [1, 0.85, 1]),
  // Lower deck at 2.0 m (a crate hop from the floor); the top deck at 4.0 m is a recoil roost. Ladder/rails open.
  scaffold: art("vinish/industrial/scaffold", [-1.36, 0, -0.975], [3.39, 5.024, 1.95],
    [[-1.33, 0, -0.7, 1.72, 2.02, 0.7], [-1.33, 3.85, -0.7, 1.42, 4.02, 0.7]]),
  siteFence: art("vinish/industrial/site-fence", [-2.085, 0, -0.11], [4.17, 2.1, 0.22], [1, 1, 1.6]),
  steelBeams: art("vinish/industrial/steel-beams", [-0.75, 0, -3], [1.5, 0.85, 6.001], [1, 1, 1]),
  supplyCrate: art("vinish/industrial/supply-crate", [-0.603, 0, -0.214], [1.206, 0.314, 0.437], "none"),
  // Only ever placed as stacks (seven make a 1 m step): a lone pallet would snag feet.
  pallet: art("vinish/industrial/wooden-pallet", [-0.6, 0, -0.4], [1.2, 0.145, 0.8], [1, 1, 1]),
  oilDrum: art("vinish/junkyard/oil-drum", [-0.292, 0, -0.292], [0.585, 0.887, 0.585], [0.95, 1, 0.95]),
  crab: art("vinish/island/crab", [-0.276, 0, -0.141], [0.553, 0.148, 0.472], "none", "Idle"),
  turtle: art("vinish/island/sea-turtle", [-0.938, 0, -0.589], [1.875, 0.29, 1.37], "none", "Swim"),
  // ---- community remeshes (normalised to ~2 units; placements give the real-world scale) ----
  boxTruck: art("community/box-truck", [-0.998, -0.55, -0.425], [1.996, 1.101, 0.851], [0.98, 0.97, 0.96]),
  burnedTruck: art("community/burned-out-truck", [-1, -0.441, -0.369], [1.999, 0.88, 0.749], [[-1, -0.441, -0.35, 1, -0.08, 0.36]]),
  charredCar: art("community/charred-car", [-0.987, -0.31, -0.407], [1.975, 0.609, 0.811], [0.95, 0.98, 0.9]),
  wreckedCar: art("community/wrecked-car", [-0.999, -0.322, -0.445], [1.998, 0.643, 0.895], [0.95, 0.98, 0.9]),
  van: art("community/rusty-van", [-0.992, -0.385, -0.445], [1.987, 0.764, 0.893], [0.97, 0.95, 0.92]),
  // Lower layer is a 0.89 m ledge at scale 2.4, the top layer a further hop: a two-step climb.
  carPile: art("community/rusty-car-stack", [-0.986, -0.419, -0.739], [1.967, 0.826, 1.533],
    [[-0.95, -0.419, -0.7, 0.92, -0.05, 0.76], [-0.6, -0.05, -0.44, 0.72, 0.35, 0.7]]),
  // Body and driver cage are solid; the forks lie flat at ground level and stay open.
  forklift: art("community/forklift-3000", [-0.999, -0.586, -0.414], [1.998, 1.169, 0.83],
    [[-0.38, -0.586, -0.4, 1, 0.06, 0.4], [-0.34, 0.06, -0.33, 0.71, 0.58, 0.33]]),
  fuelDrum: art("community/fuel-drum", [-0.633, -0.998, -0.637], [1.269, 1.995, 1.277], [0.95, 1, 0.95]),
  container: art("community/shipping-container-2000", [-0.998, -0.42, -0.395], [1.978, 0.839, 0.79], [1, 1, 1]),
  // Tracks and cab only: the lattice mast and jib are drawn over the play space, high and see-through.
  crane: art("community/yellow-crane-6000", [-0.997, -0.725, -0.251], [1.997, 1.448, 0.503],
    [[0.16, -0.725, -0.25, 1, -0.51, 0.25], [0.47, -0.51, -0.15, 0.88, -0.3, 0.15]]),
  boulder: art("community/granite-boulder", [-0.988, -0.5, -0.915], [1.972, 0.988, 1.828], [0.82, 0.88, 0.8]),
  seaStack: art("community/sea-stack", [-0.992, -0.656, -0.907], [1.988, 1.313, 1.815], [0.62, 0.92, 0.6]),
  leaningPalm: art("community/leaning-palm", [-0.516, -0.995, -0.529], [1.014, 1.958, 1.036], "none"),
  stylizedPalm: art("community/stylized-palm", [-0.72, -0.999, -0.691], [1.415, 1.999, 1.393], [0.14, 0.62, 0.14]),
} as const satisfies Record<string, SceneryArt>;
export type SceneryId = keyof typeof SCENERY_ART;

export interface SceneryPlacement {
  art: SceneryId;
  /** Where the model's base centre stands (bounds centre in x/z, lowest point in y). */
  pos: Vec3;
  scale: number;
  /** Quarter turns about +Y (0-3). */
  quarter: number;
  /** Adds the model's colliders to the arena. */
  solid: boolean;
  /** Copies stacked straight up (pallets, crates). */
  count?: number;
  /** An explosive's hazard kind: its first collider becomes the hazard box (hazards.ts). */
  prop?: ExplosiveKind;
}

export const place = (art: SceneryId, x: number, y: number, z: number, scale = 1, quarter = 0, solid = true, count = 1): SceneryPlacement =>
  ({ art, pos: { x, y, z }, scale, quarter, solid, ...(count > 1 ? { count } : {}) });
/** Drawn only: never collides (wildlife, palms over the water, floor clutter). */
export const decor = (art: SceneryId, x: number, y: number, z: number, scale = 1, quarter = 0): SceneryPlacement =>
  place(art, x, y, z, scale, quarter, false);

/** Model-space point -> world, for a placement (base-centred, scaled, quarter-turned). */
function toWorld(p: SceneryPlacement, x: number, y: number, z: number, layer = 0): Vec3 {
  const a = SCENERY_ART[p.art];
  const lx = (x - (a.min[0] + a.size[0] / 2)) * p.scale, ly = (y - a.min[1] + layer * a.size[1]) * p.scale, lz = (z - (a.min[2] + a.size[2] / 2)) * p.scale;
  const q = ((p.quarter % 4) + 4) % 4;
  // +Y rotation by q * 90 deg (three.js convention: x' = x cos + z sin, z' = -x sin + z cos)
  const [rx, rz] = q === 0 ? [lx, lz] : q === 1 ? [lz, -lx] : q === 2 ? [-lx, -lz] : [-lz, lx];
  return { x: p.pos.x + rx, y: p.pos.y + ly, z: p.pos.z + rz };
}

/** The world size of a placement's whole model (after its quarter turn), for spacing checks and fallbacks. */
export function sceneryExtent(p: SceneryPlacement): Box {
  const a = SCENERY_ART[p.art];
  const c0 = toWorld(p, a.min[0], a.min[1], a.min[2]), c1 = toWorld(p, a.min[0] + a.size[0], a.min[1] + a.size[1], a.min[2] + a.size[2], (p.count ?? 1) - 1);
  return { ...box(c0.x, c0.y, c0.z, c1.x, c1.y, c1.z), prop: "scenery" };
}

/** A placement's gameplay colliders as arena boxes (empty when decorative). A stack shares one column. */
export function sceneryBoxes(p: SceneryPlacement): Box[] {
  if (!p.solid) return [];
  const a = SCENERY_ART[p.art], count = p.count ?? 1;
  return a.colliders.map(([x0, y0, z0, x1, y1, z1], i) => {
    const lo = toWorld(p, x0, y0, z0), hi = toWorld(p, x1, y1, z1, count - 1);
    const b: Box = { ...box(lo.x, lo.y, lo.z, hi.x, hi.y, hi.z), prop: i === 0 && p.prop ? p.prop : "scenery" };
    return b;
  });
}

/** Top of the highest collider (where a pickup or spawn on it stands). */
export function sceneryTop(p: SceneryPlacement): number {
  return Math.max(...sceneryBoxes({ ...p, solid: true }).map((b) => b.max.y));
}
