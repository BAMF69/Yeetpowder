import { describe, expect, it } from "vitest";
import { levelById, type Level } from "../src/core/yeet/levels";
import { PARTY_LEVELS } from "../src/core/yeet/levelsParty";
import { parseMatch } from "../src/core/yeet/matchSetup";
import { NO_INPUT, YeetSim } from "../src/core/yeet/sim";
import { TUNING } from "../src/core/yeet/tuning";

/** Union of ground-floor rectangles, so overlapping beach pieces cannot inflate the area claim. */
function floorArea(level: Level): number {
  const floors = level.arena.boxes.filter((b) => b.kind === "floor" && b.max.y === 0);
  const xs = [...new Set(floors.flatMap((b) => [b.min.x, b.max.x]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const spans = floors.filter((b) => b.min.x < xs[i] && b.max.x > xs[i - 1])
      .map((b) => [b.min.z, b.max.z]).sort((a, b) => a[0] - b[0]);
    let end = -Infinity, length = 0;
    for (const [lo, hi] of spans) { length += Math.max(0, hi - Math.max(lo, end)); end = Math.max(end, hi); }
    area += length * (xs[i] - xs[i - 1]);
  }
  return area;
}

for (const id of PARTY_LEVELS) describe(id, () => {
  it("adds at least three times the original ground area while retaining the duel version", () => {
    const party = levelById(id), duel = levelById(id.replace("-party", ""));
    expect(party.id).toBe(id);
    expect(duel.spawns).toHaveLength(2);
    expect(party.recommendedPlayers).toBe(8);
    expect(floorArea(party) / floorArea(duel)).toBeGreaterThanOrEqual(3);
    expect(parseMatch({ level: id, bot: "medium" }).levelId).toBe(id);
  });

  it("supports eight separate, clear player spawns and stable dummy spawns", () => {
    const level = levelById(id);
    expect(level.spawns).toHaveLength(8);
    expect(level.spawnYaws).toHaveLength(8);
    for (const a of level.spawns!) for (const b of level.spawns!) if (a !== b) {
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(12);
    }
    const sim = new YeetSim(structuredClone(TUNING), level, 8);
    sim.dummies.forEach((d) => d.aiCooldown = 99);
    for (let i = 0; i < 60; i++) sim.step(Array.from({ length: 8 }, () => ({ ...NO_INPUT })));
    const actors = [...sim.players, ...sim.dummies];
    const spawns = [...level.spawns!, ...level.arena.dummySpawns];
    actors.forEach((actor, i) => {
      expect(actor.onGround, `spawn ${i}`).toBe(true);
      expect(actor.pos.x, `spawn ${i} x`).toBeCloseTo(spawns[i].x, 3);
      expect(actor.pos.y, `spawn ${i} y`).toBeCloseTo(spawns[i].y, 3);
      expect(actor.pos.z, `spawn ${i} z`).toBeCloseTo(spawns[i].z, 3);
    });
  });

  it("places every pickup on reachable solid ground rather than inside scenery", () => {
    const level = levelById(id);
    for (const pickup of level.pickups) {
      const sim = new YeetSim(structuredClone(TUNING), structuredClone(level));
      sim.dummies.forEach((d) => d.aiCooldown = 99);
      sim.player.pos = { ...pickup.pos, y: pickup.pos.y + 0.5 };
      for (let i = 0; i < 90; i++) sim.step(NO_INPUT);
      expect(sim.player.onGround, pickup.weapon).toBe(true);
      expect(sim.player.pos.y, `${pickup.weapon} at ${JSON.stringify(pickup.pos)}`).toBeCloseTo(pickup.pos.y, 2);
      expect(Math.hypot(sim.player.pos.x - pickup.pos.x, sim.player.pos.z - pickup.pos.z)).toBeLessThan(0.1);
    }
  });
});
