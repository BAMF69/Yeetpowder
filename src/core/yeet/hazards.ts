// ---------------------------------------------------------------------------
// hazards.ts
// Purpose : The new levels' hazards as rules (Elaina, 2026-11-24): explosive trucks, tanks and fuel drums that
//           shots wear down until they blow up, launching everyone nearby and leaving a wreck for cover; and the
//           water round Shark Island. The sim (sim.ts) owns the bodies and calls these.
// Usage   : const ex = makeExplosives(arena, TUNING)   (one per box with an explosive prop)
//           blast(center, body, spec) -> { push, damage }   (what an explosion does to one body)
//           wreck(ex, arena, spec) / tickWrecks(ex, arena, dt, occupied, t)
// Notes   : No DOM, no three (Vitest runs it). An explosive is its box in arena.boxes: wrecking lowers that box's
//           top (so the wreck is short cover you collide with), respawning puts it back.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { EXPLOSIVES, type Arena, type ExplosiveKind } from "./arena";
import type { TUNING as TuningValue } from "./tuning";
import { vec, type Vec3 } from "./vec";

type Tuning = typeof TuningValue;
/** What a blast does at its centre (an explosive vehicle's, a rocket's, a grenade's). */
export type BlastSpec = Pick<Tuning["explosive"]["truck"], "radius" | "force" | "lift" | "damage">;

export interface ExplosiveState {
  /** Index of its box in arena.boxes. */
  box: number;
  kind: ExplosiveKind;
  hp: number;
  /** s until it is whole again (0 = whole). */
  wreckT: number;
  /** The box's top when whole. */
  top: number;
}

export function makeExplosives(arena: Arena, t: Tuning): ExplosiveState[] {
  const out: ExplosiveState[] = [];
  arena.boxes.forEach((b, i) => {
    const kind = b.prop as ExplosiveKind | undefined;
    if (!kind || !(EXPLOSIVES as readonly string[]).includes(kind)) return;
    out.push({ box: i, kind, hp: t.explosive[kind].hp, wreckT: 0, top: b.max.y });
  });
  return out;
}

/** The middle of an explosive's box (where it blows up from). */
export function centerOf(ex: ExplosiveState, arena: Arena): Vec3 {
  const b = arena.boxes[ex.box];
  return vec((b.min.x + b.max.x) / 2, (b.min.y + ex.top) / 2, (b.min.z + b.max.z) / 2);
}

/**
 * What an explosion at `center` does to a body whose middle is at `at`: a push away from the centre (and up), and
 * damage, both falling off linearly to nothing at the radius. Outside the radius: nothing.
 */
export function blast(center: Vec3, at: Vec3, spec: BlastSpec): { push: Vec3; damage: number } {
  const d = vec(at.x - center.x, at.y - center.y, at.z - center.z);
  const dist = Math.hypot(d.x, d.y, d.z);
  if (dist >= spec.radius) return { push: vec(), damage: 0 };
  const k = 1 - dist / spec.radius;
  const flat = Math.hypot(d.x, d.z);
  // straight above or right at the centre: the push is all up
  const nx = flat > 1e-3 ? d.x / flat : 0;
  const nz = flat > 1e-3 ? d.z / flat : 0;
  return { push: vec(nx * spec.force * k, spec.lift * k, nz * spec.force * k), damage: spec.damage * k };
}

/** Blows it up: the box drops to its wreck height, and it starts counting down to whole again. */
export function wreck(ex: ExplosiveState, arena: Arena, t: Tuning): void {
  const b = arena.boxes[ex.box];
  b.max.y = Math.min(ex.top, b.min.y + t.explosive[ex.kind].wreck);
  ex.hp = 0;
  ex.wreckT = t.explosive.respawn;
}

/**
 * Counts wrecks down; one whose time is up is whole again, unless `occupied(box index)` says someone stands where
 * its full box would be (it waits for them). Returns the explosives that came back this step.
 */
export function tickWrecks(list: ExplosiveState[], arena: Arena, dt: number, occupied: (box: number, top: number) => boolean, t: Tuning): ExplosiveState[] {
  const back: ExplosiveState[] = [];
  for (const ex of list) {
    if (ex.wreckT <= 0) continue;
    ex.wreckT = Math.max(0, ex.wreckT - dt);
    if (ex.wreckT > 0) continue;
    if (occupied(ex.box, ex.top)) {
      ex.wreckT = 1; // someone is standing in it: try again in a second
      continue;
    }
    arena.boxes[ex.box].max.y = ex.top;
    ex.hp = t.explosive[ex.kind].hp;
    back.push(ex);
  }
  return back;
}
