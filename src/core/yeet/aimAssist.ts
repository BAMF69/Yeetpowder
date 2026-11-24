// ---------------------------------------------------------------------------
// aimAssist.ts
// Purpose : Aim assist for touch players (a thumb cannot track like a mouse): near a target your look slows down
//           ("friction") and, while you are actively playing (looking, moving or firing), it eases onto the target
//           ("magnetism"). It only bends the look you give it; it never turns you on its own when you are idle,
//           never aims through walls (the caller says what is visible) and never snaps.
// Usage   : const out = aimAssist({ eye, yaw, pitch, dYaw, dPitch, active, dt }, targets, visible, TUNING.touch.assist)
//           then turn by out.dYaw / out.dPitch instead of the raw look
// Notes   : Angles as the sim: yaw 0 looks toward -Z, + turns left; pitch + looks up. Pure maths, unit tested.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import type { Vec3 } from "./vec";

export interface AssistTuning {
  /** rad: half-angle of the cone a target must be in. */
  cone: number;
  /** m: farthest target that counts. */
  range: number;
  /** 0..1: how much the look slows with the crosshair right on a target. */
  friction: number;
  /** rad/s: the most the look eases toward the target per second (on target: full; at the cone's edge: none). */
  pull: number;
}

export interface AssistIn {
  eye: Vec3;
  yaw: number;
  pitch: number;
  /** The look the player gave this frame (rad). */
  dYaw: number;
  dPitch: number;
  /** Looking, moving or firing: magnetism only helps someone already playing. */
  active: boolean;
  dt: number;
}

export interface AssistOut {
  dYaw: number;
  dPitch: number;
  /** The target it helped with (index into targets), or -1. */
  target: number;
}

/** Wraps an angle to -PI..PI. */
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The yaw and pitch that look from `eye` at `p`. */
export function anglesTo(eye: Vec3, p: Vec3): { yaw: number; pitch: number } {
  const dx = p.x - eye.x;
  const dy = p.y - eye.y;
  const dz = p.z - eye.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

export function aimAssist(a: AssistIn, targets: Vec3[], visible: (i: number) => boolean, t: AssistTuning): AssistOut {
  // the target nearest the crosshair (by angle), inside the cone and range, and in sight
  let best = -1;
  let bestErr = t.cone;
  let ey = 0;
  let ep = 0;
  targets.forEach((p, i) => {
    const dist = Math.hypot(p.x - a.eye.x, p.y - a.eye.y, p.z - a.eye.z);
    if (dist > t.range || dist < 0.5) return;
    const want = anglesTo(a.eye, p);
    const dy = wrap(want.yaw - a.yaw);
    const dp = want.pitch - a.pitch;
    const err = Math.hypot(dy * Math.cos(a.pitch), dp);
    if (err >= bestErr || !visible(i)) return;
    best = i;
    bestErr = err;
    ey = dy;
    ep = dp;
  });
  if (best < 0) return { dYaw: a.dYaw, dPitch: a.dPitch, target: -1 };
  const w = 1 - bestErr / t.cone; // 1 on target, 0 at the edge of the cone
  const slow = 1 - t.friction * w;
  let dYaw = a.dYaw * slow;
  let dPitch = a.dPitch * slow;
  if (a.active && bestErr > 1e-4) {
    const step = Math.min(bestErr, t.pull * w * a.dt);
    dYaw += (ey / bestErr) * step;
    dPitch += (ep / bestErr) * step;
  }
  return { dYaw, dPitch, target: best };
}
