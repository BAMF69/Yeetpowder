// ---------------------------------------------------------------------------
// arena.ts
// Purpose : The toy's gray-box test room as data (axis-aligned boxes) plus the collision the sim needs: moving a
//           body box through the room one axis at a time, and ray casts for hitscan shots.
// Usage   : const arena = testRoom(); const hit = moveBody(arena, pos, vel, dt, halfW, height)
// Notes   : No three import. Every solid is an AABB, which is plenty for a gray box and keeps collision exact and
//           testable. Outer walls reach far above their drawn height so nothing leaves the room.
//
// Pseudocode (moveBody):
//   for axis in x, z, y:  pos[axis] += vel[axis]*dt
//     for each box overlapping the body: push the body out along that axis, record the impact speed, zero vel[axis]
//   y impacts from above set onGround
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import type { Vec3 } from "./vec";

export interface Box {
  min: Vec3;
  max: Vec3;
  /** Drawing hint: "floor", "wall" (drawn up to drawTop), "block". */
  kind: "floor" | "wall" | "block";
  /** Walls: the height to draw (the solid goes far higher). */
  drawTop?: number;
}

export interface Arena {
  boxes: Box[];
  /** Dummy spawn points (feet). */
  dummySpawns: Vec3[];
}

export const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, kind: Box["kind"] = "block"): Box => ({
  min: { x: Math.min(x0, x1), y: Math.min(y0, y1), z: Math.min(z0, z1) },
  max: { x: Math.max(x0, x1), y: Math.max(y0, y1), z: Math.max(z0, z1) },
  kind,
});

const ROOM_HALF = 20; // the room is 40 x 40 m
const WALL_DRAW = 24; // m: Boomstick floor launches clear ~18 m
const WALL_SOLID = 400; // m: the solid part, so the copter cannot fly out

/** A floor and four walls for a (2*h) x (2*h) m room. Walls are solid far above their drawn height. */
export function room(h: number): Box[] {
  const wall = (b: Box): Box => ({ ...b, kind: "wall", drawTop: WALL_DRAW });
  return [
    box(-h - 1, -1, -h - 1, h + 1, 0, h + 1, "floor"),
    wall(box(-h - 1, 0, -h - 1, h + 1, WALL_SOLID, -h)), // north
    wall(box(-h - 1, 0, h, h + 1, WALL_SOLID, h + 1)), // south
    wall(box(-h - 1, 0, -h, -h, WALL_SOLID, h)), // west
    wall(box(h, 0, -h, h + 1, WALL_SOLID, h)), // east
  ];
}

/** One 40 x 40 m room: a high ledge to self-launch onto, a crate stack, a pillar, a low wall to bonk into. */
export function testRoom(): Arena {
  return {
    boxes: [
      ...room(ROOM_HALF),
      box(-20, 0, -20, -8, 5, -12), // the high ledge (5 m): Boomstick at the floor gets you up
      box(8, 0, -6, 11, 2, -3), // crate stack, bottom
      box(9, 2, -5.5, 10.5, 3.5, -4), // crate stack, top
      box(-2, 0, -2, 2, 7, 2), // central pillar (bonk target)
      box(-12, 0, 6, -4, 3, 7), // low wall, west side
    ],
    dummySpawns: [
      { x: -4, y: 0, z: -6 },
      { x: 4, y: 0, z: -8 },
      { x: 0, y: 0, z: -14 },
      { x: 13, y: 0, z: 4 },
      { x: -14, y: 5, z: -16 }, // on the high ledge
    ],
  };
}

export interface MoveResult {
  onGround: boolean;
  /** Fastest impact into a side wall or ceiling this step (m/s, positive), and its normal. */
  wallImpact: number;
  wallNormal: Vec3 | null;
  /** Speed of hitting the floor this step (m/s, positive), 0 if none. */
  landSpeed: number;
}

function overlaps(px: number, py: number, pz: number, hw: number, ht: number, b: Box): boolean {
  return px + hw > b.min.x && px - hw < b.max.x && py + ht > b.min.y && py < b.max.y && pz + hw > b.min.z && pz - hw < b.max.z;
}

/**
 * Moves a body (feet at pos, half width hw, height ht) by vel*dt through the arena, axis by axis.
 * Mutates pos and vel (blocked axes lose their velocity). Pure otherwise.
 */
export function moveBody(arena: Arena, pos: Vec3, vel: Vec3, dt: number, hw: number, ht: number): MoveResult {
  const out: MoveResult = { onGround: false, wallImpact: 0, wallNormal: null, landSpeed: 0 };
  // sub-steps keep every move shorter than the body is wide, so a big launch cannot tunnel through a wall
  const maxMove = Math.max(Math.abs(vel.x), Math.abs(vel.y), Math.abs(vel.z)) * dt;
  const n = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(maxMove / (hw * 0.75))));
  for (let i = 0; i < n; i++) moveOnce(arena, pos, vel, dt / n, hw, ht, out);
  // standing still on something still counts as grounded (no y movement means no y collision above)
  if (!out.onGround && vel.y <= 0) {
    for (const b of arena.boxes) {
      if (overlaps(pos.x, pos.y - 0.02, pos.z, hw, ht, b)) {
        out.onGround = true;
        break;
      }
    }
  }
  return out;
}

const MAX_SUBSTEPS = 32;

function moveOnce(arena: Arena, pos: Vec3, vel: Vec3, dt: number, hw: number, ht: number, out: MoveResult): void {
  for (const axis of ["x", "z", "y"] as const) {
    const d = vel[axis] * dt;
    if (d === 0) continue;
    pos[axis] += d;
    for (const b of arena.boxes) {
      if (!overlaps(pos.x, pos.y, pos.z, hw, ht, b)) continue;
      const speed = Math.abs(vel[axis]);
      if (axis === "y") {
        if (d < 0) {
          pos.y = b.max.y;
          out.onGround = true;
          out.landSpeed = Math.max(out.landSpeed, speed);
        } else {
          pos.y = b.min.y - ht;
          if (speed > out.wallImpact) {
            out.wallImpact = speed;
            out.wallNormal = { x: 0, y: -1, z: 0 };
          }
        }
      } else {
        const lo = axis === "x" ? b.min.x : b.min.z;
        const hi = axis === "x" ? b.max.x : b.max.z;
        pos[axis] = d > 0 ? lo - hw : hi + hw;
        if (speed > out.wallImpact) {
          out.wallImpact = speed;
          out.wallNormal = axis === "x" ? { x: d > 0 ? -1 : 1, y: 0, z: 0 } : { x: 0, y: 0, z: d > 0 ? -1 : 1 };
        }
      }
      vel[axis] = 0;
    }
  }
}

/** Ray vs AABB (slab test): distance along the unit dir, or Infinity. */
export function rayBox(o: Vec3, d: Vec3, min: Vec3, max: Vec3): number {
  let t0 = 0;
  let t1 = Infinity;
  for (const a of ["x", "y", "z"] as const) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < min[a] || o[a] > max[a]) return Infinity;
      continue;
    }
    let ta = (min[a] - o[a]) / d[a];
    let tb = (max[a] - o[a]) / d[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

/** The nearest solid along a ray, as a distance (Infinity past maxDist). */
export function rayArena(arena: Arena, o: Vec3, d: Vec3, maxDist: number): number {
  let best = maxDist;
  for (const b of arena.boxes) best = Math.min(best, rayBox(o, d, b.min, b.max));
  return best;
}
