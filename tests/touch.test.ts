import { describe, expect, it } from "vitest";
import { knobOffset, stickFrom } from "../src/core/yeet/touch";
import { TUNING } from "../src/core/yeet/tuning";

const T = TUNING.touch;

describe("touch stick", () => {
  it("does nothing inside the deadzone", () => {
    const s = stickFrom(T.stickRadius * T.deadzone * 0.9, 0, T);
    expect(s).toEqual({ x: 0, z: 0, sprint: false, amount: 0 });
  });

  it("starts from zero just past the deadzone (no jump)", () => {
    const s = stickFrom(T.stickRadius * (T.deadzone + 0.01), 0, T);
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(0.05);
  });

  it("pushing up walks forward, right strafes right", () => {
    expect(stickFrom(0, -T.stickRadius * 0.6, T).z).toBeGreaterThan(0.4);
    expect(stickFrom(T.stickRadius * 0.6, 0, T).x).toBeGreaterThan(0.4);
  });

  it("is full speed at the rim and beyond, and sprints there", () => {
    const s = stickFrom(0, -T.stickRadius * 3, T);
    expect(s.z).toBeCloseTo(1);
    expect(s.sprint).toBe(true);
    expect(stickFrom(0, -T.stickRadius * 0.7, T).sprint).toBe(false);
  });

  it("keeps the vector at most length 1 on diagonals", () => {
    const s = stickFrom(500, 500, T);
    expect(Math.hypot(s.x, s.z)).toBeCloseTo(1);
  });

  it("clamps the knob to the rim", () => {
    expect(knobOffset(10, 0, 64)).toEqual({ x: 10, y: 0 });
    const k = knobOffset(0, 200, 64);
    expect(k.y).toBeCloseTo(64);
  });
});
