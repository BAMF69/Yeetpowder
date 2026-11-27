// ---------------------------------------------------------------------------
// botFooting.ts
// Purpose : Where a bot can stand on a level with water (Shark Island): is there solid ground under a point, and
//           where would a shot's recoil carry it? The bot's retreat redirect, its combat shots and its Boomstick
//           launch all ask this, so "safe" means one thing.
// Usage   : solidGround(sim, x, z, maxTop) ; shotLanding(sim, pos, vel, yaw, pitch, weapon, aimed, onGround) and
//           bodyLanding(sim, pos, vel, onGround) -> where it can stand still again, or null (the water)
// Notes   : No three import. shotLanding is a prediction, not the sim: the same kick, hop, gravity, air drag and
//           ground friction (sim.ts shoot/move), but no steering, walls or tumble spin. Good enough to tell
//           "stops on the island" from "lands 30 m out at sea" (2026-11-26: a launch toward the Gatling platform
//           flew ~40 m, and hip shots at an enemy inland pushed retreating bots off the shore, to the shark).
// Pseudocode
//   shot: v = vel - aim * recoil (x airRecoil in the air) (+ hop, + tumble pop on the move) -> bodyLanding
//   each step: grounded -> friction until run speed (the bot can stop: done) ; off the edge -> airborne
//              airborne -> drag, gravity ; crossed a dry top -> grounded ; below the water -> null
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import type { YeetSim } from "./sim";
import type { WeaponId } from "./tuning";
import { aimDir, type Vec3 } from "./vec";

const FOOT = 0.6; // m: the ground must reach this far round the point (the player's half width, a little more)
const DRY = 0.2; // m: a top this far above the water counts as land
const HORIZON = 6; // s: a body still moving after this is treated as lost
const STAND = 0.05; // m: ground this close under the feet is the ground being stood on

/** Is there land above the water under (x, z), with a top no higher than `maxTop`? */
export function solidGround(sim: YeetSim, x: number, z: number, maxTop: number): boolean {
  const water = sim.level.water;
  const minTop = water ? water.y + DRY : -Infinity;
  return sim.arena.boxes.some((b) => b.max.y >= minTop && b.max.y <= maxTop
    && b.min.x <= x - FOOT && b.max.x >= x + FOOT && b.min.z <= z - FOOT && b.max.z >= z + FOOT);
}

/**
 * Where a shot of `weapon` fired now (at `pos`, moving `vel`, view yaw/pitch, standing or in the air) leaves the
 * shooter once it can stand still again: that point on dry ground, or null when it ends in the water or never
 * settles. A shot on the move is assumed to start a tumble (its pop: the worst case of the run-and-gun roll).
 */
export function shotLanding(sim: YeetSim, pos: Vec3, vel: Vec3, yaw: number, pitch: number, weapon: WeaponId,
  aimed: boolean, onGround: boolean): Vec3 | null {
  const t = sim.t;
  const w = t.weapons[weapon === "shield" ? "pistol" : weapon];
  const aim = aimDir(yaw, pitch);
  const push = w.recoil * (aimed ? t.aim.braced.recoil : 1) * (onGround ? 1 : w.airRecoil);
  const kick = { x: -aim.x * push, y: -aim.y * push, z: -aim.z * push };
  if (!onGround && kick.y > 0) kick.y = Math.min(kick.y, Math.max(0, w.airLiftCap - vel.y)); // as sim.ts shoot
  const v = { x: vel.x + kick.x, y: vel.y + kick.y, z: vel.z + kick.z };
  const hop = onGround ? w.hop * (aimed ? t.aim.braced.hop : 1) : 0;
  if (hop > 0) v.y = Math.max(v.y, 0) + hop;
  if (w.recoil > 0 && Math.hypot(vel.x, vel.z) >= t.tumble.minSpeed) v.y = Math.max(v.y, 0) + t.tumble.pop;
  return bodyLanding(sim, pos, v, onGround && v.y <= 0 && !(w.recoil > 0 && aim.y < 0));
}

/** Where a body at `pos` moving `vel` (standing or flying) comes to a stop it can hold: dry ground, or null. */
export function bodyLanding(sim: YeetSim, pos: Vec3, vel: Vec3, onGround: boolean): Vec3 | null {
  const t = sim.t;
  const pt = t.player;
  const v = { ...vel };
  let grounded = onGround;
  if (grounded) v.y = 0;
  const p = { ...pos };
  const dt = t.step;
  const drag = Math.exp(-pt.airDrag * dt);
  const waterY = sim.level.water?.y ?? -Infinity;
  for (let s = 0; s * dt < HORIZON; s++) {
    if (grounded) {
      const h = Math.hypot(v.x, v.z);
      if (h <= pt.runSpeed + 0.01) return p; // walking speed: its own feet can stop it here
      const k = (h - Math.min(h - pt.runSpeed, pt.groundFriction * dt)) / h;
      v.x *= k;
      v.z *= k;
      p.x += v.x * dt;
      p.z += v.z * dt;
      if (!solidGround(sim, p.x, p.z, p.y + STAND)) grounded = false; // slid off the edge
      continue;
    }
    v.x *= drag;
    v.z *= drag;
    if (v.y > 0) v.y *= drag;
    v.y -= t.gravity * dt;
    const prevY = p.y;
    p.x += v.x * dt;
    p.y += v.y * dt;
    p.z += v.z * dt;
    if (v.y < 0 && solidGround(sim, p.x, p.z, prevY) && !solidGround(sim, p.x, p.z, p.y)) { // came down on a top
      p.y = prevY;
      v.y = 0;
      grounded = true;
    }
    if (p.y < waterY) return null;
  }
  return null;
}
