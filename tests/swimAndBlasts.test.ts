// ---------------------------------------------------------------------------
// swimAndBlasts.test.ts
// Purpose : The 2026-11-27 hazard changes (Elaina): swimming on Shark Island with a 2 s shark timer and a recoil
//           way out, solid sea stacks you can stand on, the bigger truck blast, and exploding compressors and
//           mixers that leave low scrap.
// Usage   : python tools/dev.py test
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { levelById } from "../src/core/yeet/levels";
import { NO_INPUT, YeetSim, type TaggedEvent } from "../src/core/yeet/sim";
import { TUNING } from "../src/core/yeet/tuning";
import { ISLAND_WATER } from "../src/core/yeet/levelsOutdoor";
import { sceneryBoxes } from "../src/core/yeet/scenery";

const steps = (sim: YeetSim, n: number, input = NO_INPUT): TaggedEvent[] => {
  const out: TaggedEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...sim.step(input));
  return out;
};
const seconds = (s: number) => Math.round(s / TUNING.step);

describe("swimming round Shark Island", () => {
  it("floats you head-up and lets you paddle, then the shark eats you after two seconds in", () => {
    const sim = new YeetSim(TUNING, levelById("island"));
    sim.player.pos = { x: 30, y: 2, z: 30 };
    const ev = steps(sim, seconds(0.9), { ...NO_INPUT, moveZ: 1 });
    expect(ev.some((e) => e.type === "sharkApproach")).toBe(true);
    expect(sim.player.pos.y).toBeCloseTo(ISLAND_WATER - TUNING.swim.float, 3);
    expect(Math.hypot(sim.player.vel.x, sim.player.vel.z)).toBeGreaterThan(TUNING.swim.speed * 0.8); // paddling
    expect(sim.player.dead).toBe(0);
    const later = steps(sim, seconds(TUNING.shark.approach), { ...NO_INPUT, moveZ: 1 });
    expect(later.some((e) => e.type === "eaten")).toBe(true);
    expect(sim.player.swallowed).toBe(true);
    expect(sim.player.dead).toBeGreaterThan(0);
  });

  it("has no jump in the water", () => {
    const sim = new YeetSim(TUNING, levelById("island"));
    sim.player.pos = { x: 30, y: ISLAND_WATER - TUNING.swim.float, z: 30 };
    steps(sim, 3);
    steps(sim, seconds(0.3), { ...NO_INPUT, jump: true });
    expect(sim.player.pos.y).toBeLessThan(ISLAND_WATER);
  });

  it("lets a Boomstick blast at the water lift you out and back onto the beach, and land resets the timer", () => {
    const sim = new YeetSim(TUNING, levelById("island"));
    sim.dummies.length = 0;
    // in the water just off the west beach (sand ends at x = -13), facing away from the island
    sim.player.pos = { x: -14.5, y: ISLAND_WATER - TUNING.swim.float, z: 0 };
    sim.player.owned = [...new Set([...sim.player.owned, "shotgun" as const])];
    sim.player.weapon = "shotgun";
    sim.player.yaw = Math.PI / 2; // facing -X: the kick throws you +X, toward the sand
    sim.player.pitch = -1.15;
    steps(sim, seconds(0.5));
    expect(sim.player.swimT).toBeGreaterThan(0);
    steps(sim, 1, { ...NO_INPUT, firePressed: true });
    let landed = false;
    for (let i = 0; i < seconds(3) && !landed; i++) {
      sim.step(NO_INPUT);
      landed = sim.player.onGround && sim.player.pos.y >= -0.01;
    }
    expect(landed).toBe(true);
    expect(sim.player.dead).toBe(0);
    expect(sim.player.swimT).toBe(0);
  });
});

describe("sea stacks", () => {
  for (const id of ["island", "island-party"]) {
    it(`${id}: every sea stack is solid with a top you can stand on, well above the water`, () => {
      const level = levelById(id);
      const stacks = (level.scenery ?? []).filter((p) => p.art === "seaStack");
      expect(stacks.length).toBeGreaterThanOrEqual(4);
      for (const p of stacks) {
        expect(p.solid).toBe(true);
        const [b] = sceneryBoxes(p);
        expect(b.max.y).toBeGreaterThan(ISLAND_WATER + 4);
        const sim = new YeetSim(TUNING, level);
        sim.dummies.length = 0;
        sim.player.pos = { x: (b.min.x + b.max.x) / 2, y: b.max.y + 0.5, z: (b.min.z + b.max.z) / 2 };
        steps(sim, seconds(1));
        expect(sim.player.onGround).toBe(true);
        expect(sim.player.pos.y).toBeCloseTo(b.max.y, 3);
        expect(sim.player.swimT).toBe(0);
      }
    });
  }
});

describe("industrial explosives", () => {
  it("makes the truck the biggest blast", () => {
    expect(TUNING.explosive.truck.radius).toBeGreaterThan(TUNING.explosive.machine.radius);
    expect(TUNING.explosive.truck.radius).toBeGreaterThanOrEqual(11);
  });
  for (const id of ["industrial", "industrial-party"]) {
    it(`${id}: compressors and mixers explode into low scrap and come back`, () => {
      const sim = new YeetSim(TUNING, levelById(id));
      sim.dummies.length = 0;
      sim.player.pos = { x: 60, y: 0, z: 0 }; // well away from the hall (the Party yard reaches x 64)
      const machines = sim.explosives.map((e, i) => ({ e, i })).filter(({ e }) => e.kind === "machine");
      const art = (levelById(id).scenery ?? []).filter((p) => p.art === "compressor" || p.art === "mixer");
      expect(machines.length).toBe(art.length);
      expect(art.every((p) => p.prop === "machine")).toBe(true);
      const { e, i } = machines[0];
      const ev = sim.debugExplode(i);
      expect(ev.some((x) => x.type === "explode" && x.kind === "machine")).toBe(true);
      const b = sim.arena.boxes[e.box];
      expect(b.max.y - b.min.y).toBeLessThanOrEqual(TUNING.explosive.machine.wreck + 1e-9);
      steps(sim, seconds(TUNING.explosive.respawn + 1.5));
      expect(sim.arena.boxes[e.box].max.y).toBeCloseTo(e.top, 6);
    });
  }
});

describe("shark count only resets on land", () => {
  it("keeps counting through repeated splash-downs and eats you", () => {
    const sim = new YeetSim(TUNING, levelById("island"));
    sim.dummies.length = 0;
    sim.player.pos = { x: 30, y: 0, z: 30 };
    let eaten = false;
    for (let dunk = 0; dunk < 6 && !eaten; dunk++) {
      // in for 0.6 s, then thrown up out of the water (a recoil hop) and back in
      for (let i = 0; i < seconds(0.6) && !eaten; i++) eaten = sim.step(NO_INPUT).some((e) => e.type === "eaten");
      if (eaten) break;
      sim.player.vel.y = 6;
      for (let i = 0; i < seconds(0.6) && !eaten; i++) eaten = sim.step(NO_INPUT).some((e) => e.type === "eaten");
    }
    expect(eaten).toBe(true);
  });
});

describe("Ring Out damage", () => {
  const shove = (preset: number) => {
    const level = levelById("duel");
    level.infiniteHp = true;
    const sim = new YeetSim(TUNING, level, 2);
    sim.dummies.length = 0;
    sim.players[0].pos = { x: -7.5, y: 0, z: 0 }; sim.players[0].yaw = 0; sim.players[0].weapon = "pistol";
    sim.players[1].pos = { x: -7.5, y: 0, z: -4 }; sim.players[1].damage = preset;
    sim.step([{ ...NO_INPUT, firePressed: true }, NO_INPUT]);
    return { speed: Math.hypot(sim.players[1].vel.x, sim.players[1].vel.z), sim };
  };
  it("adds up damage, never lowers hp, and throws a damaged player harder", () => {
    const fresh = shove(0), hurt = shove(100);
    expect(fresh.sim.players[1].damage).toBeGreaterThan(0);
    expect(fresh.sim.players[1].hp).toBe(TUNING.player.hp);
    expect(hurt.speed).toBeGreaterThan(fresh.speed * 1.8);
  });
  it("resets to 0 after a knockout", () => {
    const { sim } = shove(150);
    sim.players[1].pos = { x: 0, y: -40, z: 0 }; // off the map
    for (let i = 0; i < 5; i++) sim.step([NO_INPUT, NO_INPUT]);
    expect(sim.players[1].damage).toBe(0);
  });
});
