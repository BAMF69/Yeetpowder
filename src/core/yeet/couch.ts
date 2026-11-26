import { NO_INPUT, type YeetInput } from "./sim";
export interface PadState { axes: readonly number[]; buttons: readonly { pressed: boolean; value: number }[] }
export interface CouchFrame { input: YeetInput; dYaw: number; dPitch: number; cycle: number; pause: boolean }
const axis = (n = 0) => Math.abs(n) <= 0.2 ? 0 : Math.sign(n) * (Math.abs(n) - 0.2) / 0.8;
export function padFrame(pad: PadState | null, before: readonly boolean[], dt: number): CouchFrame {
  const held = (i: number) => !!pad?.buttons[i]?.pressed || (pad?.buttons[i]?.value ?? 0) > 0.5;
  const pressed = (i: number) => held(i) && !before[i];
  return { input: { ...NO_INPUT, moveX: axis(pad?.axes[0]), moveZ: -axis(pad?.axes[1]),
    jump: pressed(0), firePressed: pressed(7), fireHeld: held(7), aiming: held(6),
    reload: pressed(2), heal: pressed(12), slash: pressed(3), slashHeld: held(3), sprint: held(10) },
    dYaw: -axis(pad?.axes[2]) * 2.8 * dt, dPitch: -axis(pad?.axes[3]) * 2.2 * dt,
    cycle: pressed(5) ? 1 : pressed(4) ? -1 : 0, pause: pressed(9) };
}
/** Normalized viewport rectangles, top-to-bottom (renderer converts to bottom-origin pixels). */
export function couchViews(count: number): { x: number; y: number; w: number; h: number }[] {
  return Array.from({ length: count }, (_, i) => count === 2 ? { x: 0, y: i / 2, w: 1, h: 0.5 }
    : { x: (i % 2) / 2, y: Math.floor(i / 2) / 2, w: 0.5, h: 0.5 });
}
