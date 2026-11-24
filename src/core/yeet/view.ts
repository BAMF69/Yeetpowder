// ---------------------------------------------------------------------------
// view.ts
// Purpose : The camera's field of view on any screen shape. Three.js keeps the vertical angle fixed, so a tall,
//           narrow screen (a phone held upright, an iPhone home-screen app) sees a sliver: it looked "too zoomed in"
//           and the gun, hung off the camera to the right, left the screen (Elaina, 2026-11-24).
// Usage   : camera.fov = fovForAspect(designFov, camera.aspect)
// Notes   : No three import (Vitest runs it). Screens at least TUNING.aim.minAspect wide are unchanged; narrower
//           ones widen the vertical angle so the horizontal view stays what minAspect would show.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { TUNING } from "./tuning";

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** The vertical fov (degrees) to use for `fov` (designed for screens at least `minAspect` wide) at `aspect`. */
export function fovForAspect(fov: number, aspect: number, minAspect: number = TUNING.aim.minAspect): number {
  if (!(aspect > 0) || aspect >= minAspect) return fov;
  return deg(2 * Math.atan(Math.tan(rad(fov) / 2) * (minAspect / aspect)));
}
