// ---------------------------------------------------------------------------
// hazards.test.ts
// Purpose : The new levels' hazards (src/core/yeet/hazards.ts and the sim's use of them; Elaina 2026-11-24):
//           an explosive blows up when shot enough, launches whoever is near (you too), sets off its neighbours,
//           leaves low cover and comes back (not on top of someone); water eats you and credits who hit you.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { box, room } from "../src/core/yeet/arena";
import { blast } from "../src/core/yeet/hazards";
import type { Level } from "../src/core/yeet/levels";
import { NO_INPUT, PLAYER_CODE, YeetSim, type YeetEvent } from "../src/core/yeet/sim";
import { TUNING } from "../src/core/yeet/tuning";
import { vec } from "../src/core/yeet/vec";

/** A small room with the player at (0, 0, 10) looking down -Z, and whatever boxes a test adds. */
function level(extra: Level["arena"]["boxes"], more: Partial<Level> = {}): Level {
  // over water there is no floor (a floor under the water line would hold you up out of it)
  const boxes = more.water ? [box(-5, -1, -5, 5, 0, 5, "floor")] : room(20);
  return {
    id: "sandbox", name: "Test", arena: { boxes: [...boxes, ...extra], dummySpawns: [] },
    spawn: more.water ? vec(0, 0, 0) : vec(0, 0, 10), spawnYaw: 0, startWeapons: ["pistol", "shotgun"], pickups: [], dummiesFight: false,
    dummyRespawn: 3, seed: 1, ...more,
  };
}
const drum = (x: number, z: number) => ({ ...box(x - 0.4, 0, z - 0.4, x + 0.4, 1.2, z + 0.4), prop: "drum" as const });
const steps = (sim: YeetSim, seconds: number, extra: Partial<typeof NO_INPUT> = {}): YeetEvent[] => {
  const ev: YeetEvent[] = [];
  for (let i = 0; i < Math.round(seconds / sim.t.step); i++) ev.push(...sim.step({ ...NO_INPUT, ...extra }));
  return ev;
};

describe("blast", () => {
  const spec = TUNING.explosive.truck;
  it("is strongest at the centre, nothing at the radius, and pushes away and up", () => {
    const near = blast(vec(0, 1, 0), vec(1, 1, 0), spec);
    const far = blast(vec(0, 1, 0), vec(spec.radius - 0.5, 1, 0), spec);
    expect(near.damage).toBeGreaterThan(far.damage);
    expect(near.push.x).toBeGreaterThan(0);
    expect(near.push.y).toBeGreaterThan(0);
    expect(blast(vec(0, 1, 0), vec(spec.radius + 0.1, 1, 0), spec).damage).toBe(0);
  });

  it("straight above the centre pushes straight up", () => {
    const r = blast(vec(0, 1, 0), vec(0, 3, 0), spec);
    expect(r.push.x).toBe(0);
    expect(r.push.z).toBe(0);
    expect(r.push.y).toBeGreaterThan(0);
  });
});

describe("explosives in the sim", () => {
  it("shooting a drum enough blows it up and launches you if you are close; the wreck is low cover", () => {
    const sim = new YeetSim(structuredClone(TUNING), level([drum(0, 7)]));
    steps(sim, 0.3);
    sim.explosives[0].hp = 5; // one Pea Pistol shot (its recoil hops you back, so the next shots would miss)
    sim.player.pitch = -0.35; // down at the drum 3 m ahead
    const ev: YeetEvent[] = [];
    for (let i = 0; i < 60 && !ev.some((e) => e.type === "explode"); i++) {
      ev.push(...sim.step({ ...NO_INPUT, firePressed: i % 20 === 0 }));
    }
    expect(ev.find((e) => e.type === "explode")).toMatchObject({ kind: "drum" });
    expect(sim.player.vel.y).toBeGreaterThan(2); // launched
    expect(sim.player.hp).toBeLessThan(TUNING.player.hp);
    const b = sim.arena.boxes[sim.explosives[0].box];
    expect(b.max.y - b.min.y).toBeCloseTo(TUNING.explosive.drum.wreck);
  });

  it("one blast sets off another explosive in reach (a chain), not one out of reach", () => {
    const sim = new YeetSim(structuredClone(TUNING), level([drum(0, -5), drum(2, -5), drum(15, -15)]));
    sim.explosives[0].hp = 1;
    sim.explosives[1].hp = 10; // less than the blast deals 2 m away
    // the first drum is shot from range (no harm to you)
    sim.player.pitch = -0.08;
    const ev = steps(sim, 1, { firePressed: true });
    expect(ev.filter((e) => e.type === "explode").length).toBe(2);
    expect(sim.explosives[2].wreckT).toBe(0);
  });

  it("a wreck comes back after its time, but waits while someone stands in it", () => {
    const sim = new YeetSim(structuredClone(TUNING), level([drum(5, 5)]));
    sim.explosives[0].hp = 1;
    sim.player.pos = vec(5, 0.3, 5); // standing on the wreck spot once it drops
    (sim as unknown as { damageExplosive(i: number, d: number, ev: YeetEvent[]): void }).damageExplosive(0, 5, []);
    expect(sim.explosives[0].wreckT).toBeGreaterThan(0);
    sim.player.pos = vec(5, 0.3, 5);
    steps(sim, TUNING.explosive.respawn + 0.5);
    expect(sim.explosives[0].wreckT).toBeGreaterThan(0); // still you in it: it waits
    sim.player.pos = vec(-5, 0, 5);
    const back = steps(sim, 1.5);
    expect(back.some((e) => e.type === "explosiveBack")).toBe(true);
    expect(sim.explosives[0].hp).toBe(TUNING.explosive.drum.hp);
  });
});

describe("water (Shark Island)", () => {
  it("falling in is a knockout, and the player who knocked you in scores it", () => {
    const sim = new YeetSim(structuredClone(TUNING), level([], { water: { y: -1 } }), 2);
    // drop player 2 (the victim) into the water, just after player 1 hit them
    const victim = sim.players[1];
    victim.lastHitBy = 0;
    victim.lastHitAt = sim.time;
    victim.pos = vec(12, -1.5, 12);
    const ev = sim.step([NO_INPUT, NO_INPUT]);
    expect(ev.find((e) => e.type === "eaten")).toMatchObject({ who: "player", by: 0 });
    expect(victim.dead).toBeGreaterThan(0);
    expect(sim.kos[0]).toBe(1);
  });

  it("falling in on your own is still a knockout, with no one credited", () => {
    const sim = new YeetSim(structuredClone(TUNING), level([], { water: { y: -1 } }));
    sim.player.pos = vec(12, -1.5, 12);
    const ev = sim.step(NO_INPUT);
    expect(ev.find((e) => e.type === "eaten")).toMatchObject({ who: "player", by: -1 });
    expect(sim.player.dead).toBeGreaterThan(0);
  });

  it("an old hit does not count: past the credit time, a fall is your own", () => {
    const sim = new YeetSim(structuredClone(TUNING), level([], { water: { y: -1 } }), 2);
    steps(sim, TUNING.water.credit + 1);
    const victim = sim.players[1];
    victim.lastHitBy = 0;
    victim.lastHitAt = 0;
    victim.pos = vec(12, -1.5, 12);
    expect(sim.step([NO_INPUT, NO_INPUT]).find((e) => e.type === "eaten")).toMatchObject({ by: -1 });
    expect(PLAYER_CODE).toBeGreaterThan(0);
  });
});
