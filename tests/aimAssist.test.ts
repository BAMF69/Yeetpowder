// ---------------------------------------------------------------------------
// aimAssist.test.ts
// Purpose : Touch aim assist (friction and magnetism, only while playing, only in sight) and the gyro axis mapping.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { aimAssist, anglesTo } from "../src/core/yeet/aimAssist";
import { gyroToLook } from "../src/core/yeet/touch";
import { TUNING } from "../src/core/yeet/tuning";

const T = TUNING.touch.assist;
const eye = { x: 0, y: 1.6, z: 0 };
/** A target `deg` to the left of straight ahead (-Z), `dist` m away, at eye height. */
const ahead = (deg: number, dist = 10) => {
  const r = (deg * Math.PI) / 180;
  return { x: -Math.sin(r) * dist, y: 1.6, z: -Math.cos(r) * dist };
};
const base = { eye, yaw: 0, pitch: 0, dYaw: 0, dPitch: 0, active: true, dt: 1 / 60 };
const all = () => true;

describe("aim assist (touch)", () => {
  it("anglesTo matches the sim's convention (yaw 0 = -Z, + left; pitch + up)", () => {
    expect(anglesTo(eye, { x: 0, y: 1.6, z: -5 }).yaw).toBeCloseTo(0);
    expect(anglesTo(eye, { x: -5, y: 1.6, z: 0 }).yaw).toBeCloseTo(Math.PI / 2);
    expect(anglesTo(eye, { x: 0, y: 6.6, z: -5 }).pitch).toBeCloseTo(Math.PI / 4);
  });

  it("eases toward a target near the crosshair while you play, never past it", () => {
    const out = aimAssist(base, [ahead(3)], all, T);
    expect(out.target).toBe(0);
    expect(out.dYaw).toBeGreaterThan(0); // the target is to the left: + yaw
    expect(out.dYaw).toBeLessThan((3 * Math.PI) / 180);
  });

  it("does nothing while you are idle, outside the cone, too far, or behind a wall", () => {
    expect(aimAssist({ ...base, active: false }, [ahead(3)], all, T).dYaw).toBe(0);
    expect(aimAssist(base, [ahead(40)], all, T).target).toBe(-1);
    expect(aimAssist(base, [ahead(2, T.range + 5)], all, T).target).toBe(-1);
    expect(aimAssist(base, [ahead(3)], () => false, T).target).toBe(-1);
  });

  it("slows your own look over a target (friction), not elsewhere", () => {
    const on = aimAssist({ ...base, active: false, dYaw: 0.1 }, [ahead(0)], all, T);
    const off = aimAssist({ ...base, active: false, dYaw: 0.1 }, [ahead(60)], all, T);
    expect(on.dYaw).toBeCloseTo(0.1 * (1 - T.friction));
    expect(off.dYaw).toBe(0.1);
  });

  it("picks the target nearest the crosshair", () => {
    expect(aimAssist(base, [ahead(6), ahead(-2)], all, T).target).toBe(1);
  });
});

describe("gyro to look", () => {
  it("portrait: turning about the device's up axis turns you, about its right axis pitches", () => {
    expect(gyroToLook({ beta: 0, gamma: 90 }, 0).yaw).toBeCloseTo(Math.PI / 2);
    expect(gyroToLook({ beta: 90, gamma: 0 }, 0).pitch).toBeCloseTo(Math.PI / 2);
  });

  it("landscape either way round swaps the axes (and their signs)", () => {
    expect(gyroToLook({ beta: 90, gamma: 0 }, 90).yaw).toBeCloseTo(Math.PI / 2);
    expect(gyroToLook({ beta: 90, gamma: 0 }, 270).yaw).toBeCloseTo(-Math.PI / 2);
    expect(gyroToLook({ beta: 0, gamma: 90 }, 90).pitch).toBeCloseTo(-Math.PI / 2);
    expect(gyroToLook({ beta: 0, gamma: 90 }, -90).pitch).toBeCloseTo(Math.PI / 2);
  });
});
