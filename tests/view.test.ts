// ---------------------------------------------------------------------------
// view.test.ts
// Purpose : A narrow screen keeps a usable horizontal view (src/core/yeet/view.ts): the gun stays on screen on a
//           phone held upright (iPhone home-screen app, 2026-11-24); landscape screens are untouched.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { fovForAspect } from "../src/core/yeet/view";

/** Horizontal fov (degrees) for a vertical fov at an aspect. */
const horizontal = (vfov: number, aspect: number) => (2 * Math.atan(Math.tan((vfov * Math.PI) / 360) * aspect) * 180) / Math.PI;

describe("fovForAspect", () => {
  it("leaves landscape screens alone", () => {
    expect(fovForAspect(75, 16 / 9, 4 / 3)).toBe(75);
    expect(fovForAspect(75, 4 / 3, 4 / 3)).toBe(75);
  });

  it("gives a portrait phone the horizontal view a 4:3 screen has", () => {
    const portrait = 390 / 844;
    const v = fovForAspect(75, portrait, 4 / 3);
    expect(v).toBeGreaterThan(75);
    expect(horizontal(v, portrait)).toBeCloseTo(horizontal(75, 4 / 3), 6);
  });

  it("keeps a zoomed scope narrower than hip fire on the same screen", () => {
    expect(fovForAspect(18, 0.5, 4 / 3)).toBeLessThan(fovForAspect(75, 0.5, 4 / 3));
  });

  it("ignores a zero or broken aspect", () => {
    expect(fovForAspect(75, 0, 4 / 3)).toBe(75);
    expect(fovForAspect(75, Number.NaN, 4 / 3)).toBe(75);
  });
});
