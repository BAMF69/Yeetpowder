import { describe, expect, it } from "vitest";
import { respawnView } from "../src/core/yeet/respawnView";
import { TUNING } from "../src/core/yeet/tuning";

const R = TUNING.player; // unlock 10, auto 30

describe("respawn screen view", () => {
  it("is locked and filling before the unlock", () => {
    const v = respawnView(2.5, R, false);
    expect(v.locked).toBe(true);
    expect(v.ring).toBeCloseTo(0.25);
    expect(v.seconds).toBe(8);
    expect(v.spawnNow).toBe(false);
  });
  it("unlocks at respawnUnlock and drains toward respawnAuto", () => {
    expect(respawnView(10, R, false)).toMatchObject({ locked: false, ring: 1, seconds: 20 });
    expect(respawnView(20, R, false).ring).toBeCloseTo(0.5);
    expect(respawnView(31, R, false)).toMatchObject({ ring: 0, seconds: 0 });
  });
  it("auto-spawn presses SPAWN the moment it unlocks, never before", () => {
    expect(respawnView(9.9, R, true).spawnNow).toBe(false);
    expect(respawnView(10, R, true).spawnNow).toBe(true);
  });
});
