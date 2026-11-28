// ---------------------------------------------------------------------------
// botFooting.test.ts
// Purpose : Bots keep their footing on Shark Island (2026-11-26 bug): the footing predictions (botFooting.ts) and
//           shore runs where the old bot fed itself to the shark (a Boomstick launch toward the Gatling platform,
//           recoil away from an enemy inland, a mid-air shot's doubled kick, a jump while still sliding, keys held
//           while sliding above run speed).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { BotBrain } from "../src/core/yeet/bot";
import { bodyLanding, shotLanding, solidGround } from "../src/core/yeet/botFooting";
import { levelById } from "../src/core/yeet/levels";
import { NO_INPUT, YeetSim, type TaggedEvent } from "../src/core/yeet/sim";
import { TUNING } from "../src/core/yeet/tuning";

const island = () => new YeetSim(TUNING, levelById("island"), 2);
const v = (x: number, y: number, z: number) => ({ x, y, z });

describe("bot footing predictions", () => {
  it("knows the island, the platforms and the open water between them", () => {
    const sim = island();
    expect(solidGround(sim, 0, 8, 0.1)).toBe(true); // sand
    expect(solidGround(sim, 12.3, 0, 0.1)).toBe(true); // the east shore (0.6 m of ground round the feet)
    expect(solidGround(sim, 12.5, 0, 0.1)).toBe(false); // the lip: standing, but not footing to count on
    expect(solidGround(sim, 24, 0, 0.6)).toBe(true); // the east platform
    expect(solidGround(sim, 17.5, 0, 0.6)).toBe(false); // between them: the sea
  });
  it("calls a Boomstick launch from the shore toward the far platform a swim", () => {
    // The old bot: at the east shore, launch toward the Gatling at (1.5, 0.5, -24); it flew ~40 m and landed at sea.
    const sim = island();
    const yaw = Math.atan2(1.5 - 9.6, -24 + 6.1); // the launch faces away from the goal (bot.ts decide)
    expect(shotLanding(sim, v(9.6, 0, -6.1), v(-2.9, 0, -6.4), yaw, -0.75, "shotgun", false, true)).toBeNull();
  });
  it("lets a standing pistol shot inland stay on the island, but not one fired with its back to the shore", () => {
    // yaw 0 looks down -Z, so the ~4.4 m kick (recoil + hop) carries the shooter toward +Z
    expect(shotLanding(island(), v(8, 0, -6), v(0, 0, 0), 0, 0, "pistol", false, true)).not.toBeNull();
    expect(shotLanding(island(), v(8, 0, 10), v(0, 0, 0), 0, 0, "pistol", false, true)).toBeNull();
  });
  it("counts the doubled air recoil of a shot fired mid-air", () => {
    const sim = island();
    const yaw = Math.PI / 2 + 0.3; // facing roughly -x: the kick pushes toward +x, the near east shore
    const ground = shotLanding(sim, v(4.4, 0, 10), v(0, 0, 0), yaw, 0, "pistol", false, true);
    const air = shotLanding(sim, v(4.4, 0.6, 10), v(9.5, 0, 2), yaw, -0.1, "pistol", false, false);
    expect(ground).not.toBeNull(); expect(air).toBeNull();
  });
  it("sees that a jump while sliding fast toward the shore ends in the water", () => {
    const sim = island();
    expect(bodyLanding(sim, v(6.7, 0, 10.3), v(18.6, 0, 2.6), true)).not.toBeNull(); // friction stops it on land
    expect(bodyLanding(sim, v(6.7, 0, 10.3), v(18.6, TUNING.player.jumpSpeed, 2.6), false)).toBeNull(); // a hop: it flies
  });
});

describe("bots on Shark Island's shore", () => {
  // Shore starts from the 2026-11-26 sweep where the old bot went into the water on its own.
  const cases: Array<{ pos: { x: number; z: number }; diff: "easy" | "medium" | "hard"; seed: number; lowHp?: boolean }> = [
    { pos: { x: 12.5, z: 0 }, diff: "medium", seed: 10 }, // launch toward the Gatling platform
    { pos: { x: 12.5, z: 0 }, diff: "hard", seed: 3, lowHp: true }, // retreat: recoil away from the enemy
    { pos: { x: 5.2, z: 12.5 }, diff: "easy", seed: 3 }, // a mid-air pistol shot
    { pos: { x: 5.2, z: 12.5 }, diff: "hard", seed: 3 }, // a jump while still sliding
    { pos: { x: 12.5, z: 5.18 }, diff: "easy", seed: 3 }, // jump and shot on the same step
    { pos: { x: 12, z: 12 }, diff: "easy", seed: 3 }, // keys held while sliding above run speed
  ];
  for (const c of cases) {
    it(`a ${c.diff} bot (seed ${c.seed}${c.lowHp ? ", low hp" : ""}) at (${c.pos.x}, ${c.pos.z}) never enters the water`, () => {
      const sim = island();
      sim.players[1].pos = v(c.pos.x, 0, c.pos.z); sim.players[1].onGround = true;
      if (c.lowHp) { sim.players[1].hp = TUNING.player.hp * 0.1; sim.players[0].pos = v(c.pos.x * 0.6, 0, c.pos.z * 0.6); }
      const brain = new BotBrain(TUNING, 1, c.diff, c.seed);
      const events: TaggedEvent[] = [];
      for (let i = 0; i < 900; i++) { const out = brain.think(sim); sim.look(out.dYaw, out.dPitch, 1); events.push(...sim.step([NO_INPUT, out.input])); }
      expect(events.filter((e) => e.type === "sharkApproach" && e.p === 1)).toEqual([]);
    });
  }
  it("still shoots back on the island (footing checks must not make it a pacifist)", () => {
    const sim = island();
    sim.players[1].pos = v(12.5, 0, 0); sim.players[1].onGround = true; sim.players[0].pos = v(-2, 0, -8); // in the open: the 2026-11-26 boulders sit between (12.5, 0) and (4, 6)
    const brain = new BotBrain(TUNING, 1, "hard", 10);
    let shots = 0;
    for (let i = 0; i < 900; i++) { const out = brain.think(sim); if (out.input.firePressed || out.input.fireHeld) shots++; sim.look(out.dYaw, out.dPitch, 1); sim.step([NO_INPUT, out.input]); }
    expect(shots).toBeGreaterThan(0);
  });
});
