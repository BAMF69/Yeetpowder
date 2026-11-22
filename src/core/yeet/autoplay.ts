// ---------------------------------------------------------------------------
// autoplay.ts
// Purpose : A scripted run of the toy that tours every mechanic: pistol taps at a dummy, a Boomstick floor launch,
//           a Spin Doctor shot, then the Gatling Copter until it overheats and crash-lands.
// Usage   : Browser: open the game with ?play&autoplay (dev.py smoke --query "play&autoplay"); it logs
//           YEET_AUTOPLAY_DONE. Vitest: tests/yeetSim.test.ts runs the same script against YeetSim.
// Notes   : The script aims by setting yaw/pitch directly (absolute look), so it does not depend on mouse input.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { NO_INPUT, type YeetInput, type YeetSim } from "./sim";

export const AUTOPLAY_SECONDS = 17;

export interface ScriptStep {
  input: YeetInput;
  /** Absolute aim to set before this step, if any. */
  aim?: { yaw: number; pitch: number };
}

/** Yaw and pitch from the player's eye to a dummy's chest. */
export function aimAt(sim: YeetSim, dummy: number): { yaw: number; pitch: number } {
  const e = sim.eye();
  const d = sim.dummies[dummy].pos;
  const dx = d.x - e.x;
  const dy = d.y + 0.9 - e.y;
  const dz = d.z - e.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

const at = (t: number, start: number, dur = 1 / 120) => t >= start && t < start + dur;

/** The input for simulated time t (seconds). */
export function autoplayStep(sim: YeetSim, t: number): ScriptStep {
  const input: YeetInput = { ...NO_INPUT };
  let aim: ScriptStep["aim"];
  if (t >= 0.5 && t < 1.5) {
    aim = aimAt(sim, 1);
    input.firePressed = at(t, 0.6) || at(t, 0.9) || at(t, 1.2);
  } else if (t >= 1.5 && t < 3.5) {
    if (at(t, 1.5)) input.select = 1;
    aim = { yaw: sim.player.yaw, pitch: -1.5 };
    input.firePressed = at(t, 2.0);
  } else if (t >= 3.5 && t < 5.5) {
    if (at(t, 3.5)) input.select = 2;
    if (t < 3.9) aim = aimAt(sim, 0);
    input.firePressed = at(t, 3.9);
  } else if (t >= 5.5 && t < 12) {
    if (at(t, 5.5)) input.select = 3;
    if (t < 5.6) aim = { yaw: aimAt(sim, 0).yaw, pitch: -1.35 };
    input.fireHeld = t >= 5.6;
  }
  return { input, aim };
}
