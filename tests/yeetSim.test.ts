// ---------------------------------------------------------------------------
// yeetSim.test.ts
// Purpose : Proves the toy's rules without a browser: recoil moves you opposite the aim, a Boomstick floor shot is a
//           super jump within the GDD's 25 m cap, the sniper spins you, fast wall hits bonk-stun, dummies take hits and
//           respawn, and the Gatling Copter lifts, overheats and crash-lands. Ends with the autoplay tour replayed.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { moveBody, rayBox, testRoom } from "../src/core/yeet/arena";
import { AUTOPLAY_SECONDS, autoplayStep } from "../src/core/yeet/autoplay";
import { NO_INPUT, YeetSim, type YeetEvent, type YeetInput } from "../src/core/yeet/sim";
import { TUNING } from "../src/core/yeet/tuning";
import { aimDir, vec } from "../src/core/yeet/vec";

const newSim = () => new YeetSim(structuredClone(TUNING), testRoom());
const run = (sim: YeetSim, seconds: number, input: Partial<YeetInput> = {}): YeetEvent[] => {
  const all: YeetEvent[] = [];
  for (let i = 0; i < Math.round(seconds / sim.t.step); i++) all.push(...sim.step({ ...NO_INPUT, ...input }));
  return all;
};
const fire = (sim: YeetSim) => sim.step({ ...NO_INPUT, firePressed: true });
const select = (sim: YeetSim, i: number) => sim.step({ ...NO_INPUT, select: i });

describe("vectors and collision", () => {
  it("aimDir looks down -Z at yaw 0 and turns left with positive yaw", () => {
    const d = aimDir(0, 0);
    expect(d.z).toBeCloseTo(-1);
    expect(aimDir(Math.PI / 2, 0).x).toBeCloseTo(-1);
    expect(aimDir(0, Math.PI / 2).y).toBeCloseTo(1);
  });

  it("rayBox finds the near face and misses beside the box", () => {
    expect(rayBox(vec(0, 0, 5), vec(0, 0, -1), vec(-1, -1, -1), vec(1, 1, 1))).toBeCloseTo(4);
    expect(rayBox(vec(3, 0, 5), vec(0, 0, -1), vec(-1, -1, -1), vec(1, 1, 1))).toBe(Infinity);
  });

  it("moveBody stops a body at a wall and reports the impact speed", () => {
    const arena = testRoom();
    const pos = vec(18, 0, 10);
    const v = vec(20, 0, 0);
    const r = moveBody(arena, pos, v, 0.2, 0.4, 1.7);
    expect(pos.x).toBeCloseTo(20 - 0.4);
    expect(v.x).toBe(0);
    expect(r.wallImpact).toBe(20);
    expect(r.wallNormal).toEqual({ x: -1, y: 0, z: 0 });
  });

  it("the player and every dummy spawn clear of the geometry, standing on something (SOP-09)", () => {
    const sim = newSim();
    const ev = run(sim, 0.5);
    expect(ev.some((e) => e.type === "bonk")).toBe(false);
    const spawns = [TUNING.player.respawn, ...testRoom().dummySpawns];
    const bodies = [sim.player, ...sim.dummies];
    bodies.forEach((b, i) => {
      expect(b.onGround).toBe(true);
      expect(b.pos.x).toBeCloseTo(spawns[i].x, 3); // nothing pushed them sideways out of a wall
      expect(b.pos.y).toBeCloseTo(spawns[i].y, 3);
      expect(b.pos.z).toBeCloseTo(spawns[i].z, 3);
    });
  });
});

describe("recoil", () => {
  it("a grounded Pea Pistol shot hops you back a visible distance (playtest 2)", () => {
    const sim = newSim();
    run(sim, 0.1);
    const z0 = sim.player.pos.z;
    fire(sim);
    expect(sim.player.vel.y).toBeGreaterThan(0); // the hop
    run(sim, 1);
    const pushed = sim.player.pos.z - z0;
    expect(pushed).toBeGreaterThan(1.5);
    expect(pushed).toBeLessThan(6); // a nudge, not a launch
  });

  it("the pistol pushes you opposite the aim", () => {
    const sim = newSim();
    run(sim, 0.1);
    fire(sim);
    expect(sim.player.vel.z).toBeGreaterThan(0); // aimed at -Z, pushed toward +Z
  });

  it("a Boomstick shot at the floor is a super jump, and stays under the 25 m cap", () => {
    const sim = newSim();
    run(sim, 0.1);
    select(sim, 1);
    run(sim, 0.2);
    sim.look(0, -10); // clamps to straight down
    const startY = sim.player.pos.y;
    fire(sim);
    let top = startY;
    for (let i = 0; i < 240; i++) {
      sim.step(NO_INPUT);
      top = Math.max(top, sim.player.pos.y);
    }
    expect(top - startY).toBeGreaterThan(4); // reaches the 5 m ledge with a jump on top
    expect(top - startY).toBeLessThan(25);
  });

  it("two Boomstick blasts cross a medium room (> 12 m) and one shot never moves you past 25 m", () => {
    const sim = newSim();
    sim.player.pos = vec(15, 0, 18);
    sim.player.yaw = 0; // facing -Z: shots push toward +Z ... turn around to cross the room toward -Z
    sim.player.yaw = Math.PI; // facing +Z, recoil pushes toward -Z
    select(sim, 1);
    run(sim, 0.2);
    const z0 = sim.player.pos.z;
    sim.look(0, -0.15); // slightly down: a low arc across the floor
    fire(sim);
    run(sim, 0.8);
    const one = Math.abs(sim.player.pos.z - z0);
    fire(sim);
    run(sim, 2);
    const two = Math.abs(sim.player.pos.z - z0);
    expect(one).toBeLessThan(25);
    expect(two).toBeGreaterThan(12);
  });

  it("one level Boomstick shot, slide included, travels about 25 m at most (GDD tuning target)", () => {
    const sim = newSim();
    sim.player.pos = vec(-18, 0, 18);
    sim.player.yaw = Math.PI / 2; // face -X... (yaw +90 deg looks toward -X), so recoil pushes toward +X
    select(sim, 1);
    run(sim, 0.2);
    const x0 = sim.player.pos.x;
    fire(sim);
    run(sim, 4);
    const dist = sim.player.pos.x - x0;
    expect(dist).toBeGreaterThan(12); // a real launch
    expect(dist).toBeLessThan(27); // "about 25 m"
  });

  it("the Spin Doctor spins you, and the spin settles in about a second", () => {
    const sim = newSim();
    select(sim, 2);
    run(sim, 0.2);
    const yaw0 = sim.player.yaw;
    fire(sim);
    expect(Math.abs(sim.player.spin)).toBeGreaterThan(10);
    run(sim, 1.2);
    expect(Math.abs(sim.player.spin)).toBeLessThan(0.5);
    expect(Math.abs(sim.player.yaw - yaw0)).toBeGreaterThan(Math.PI / 2); // at least a quarter turn
  });
});

describe("wall bonk", () => {
  it("hitting a wall fast stuns you and bounces you back", () => {
    const sim = newSim();
    sim.player.pos = vec(17, 0.5, 10);
    sim.player.vel = vec(25, 0, 0);
    sim.player.onGround = false;
    const ev = run(sim, 0.3);
    expect(ev.some((e) => e.type === "bonk" && e.who === "player")).toBe(true);
    expect(sim.player.stun).toBeGreaterThan(0);
  });

  it("walking into a wall does not bonk", () => {
    const sim = newSim();
    sim.player.pos = vec(18, 0, 10);
    sim.player.yaw = -Math.PI / 2; // face +X
    const ev = run(sim, 1, { moveZ: 1 });
    expect(ev.some((e) => e.type === "bonk")).toBe(false);
  });

  it("stunned players cannot fire", () => {
    const sim = newSim();
    sim.player.stun = 0.5;
    const ev = fire(sim);
    expect(ev.some((e) => e.type === "fire")).toBe(false);
  });
});

describe("dummies", () => {
  it("a sniper hit knocks a dummy flying, downs it, and it respawns", () => {
    const sim = newSim();
    sim.player.pos = vec(4, 0, 0 + 4);
    sim.player.yaw = 0;
    sim.dummies[1].pos = vec(4, 0, -8);
    select(sim, 2);
    run(sim, 0.2);
    const ev = fire(sim);
    expect(ev.some((e) => e.type === "hit" && e.dummy === 1)).toBe(true);
    expect(ev.some((e) => e.type === "down" && e.dummy === 1)).toBe(true);
    expect(sim.dummies[1].vel.z).toBeLessThan(-5);
    const later = run(sim, TUNING.dummy.respawnDelay + 0.1);
    expect(later.some((e) => e.type === "respawn" && e.dummy === 1)).toBe(true);
    expect(sim.dummies[1].hp).toBe(TUNING.dummy.hp);
  });

  it("walls block shots", () => {
    const sim = newSim();
    sim.player.pos = vec(0, 0, 6); // the central pillar is between us and dummy 2
    sim.player.yaw = 0;
    sim.dummies[2].pos = vec(0, 0, -10);
    const ev = fire(sim);
    expect(ev.some((e) => e.type === "hit")).toBe(false);
  });
});

describe("Gatling Copter", () => {
  it("firing down lifts you, then it overheats and crash-lands", () => {
    const sim = newSim();
    select(sim, 3);
    run(sim, 0.2);
    sim.look(0, -10);
    const y0 = sim.player.pos.y;
    run(sim, 1.5, { fireHeld: true });
    expect(sim.player.pos.y).toBeGreaterThan(y0 + 1);
    const ev = run(sim, TUNING.copter.heatMax, { fireHeld: true });
    expect(ev.some((e) => e.type === "overheat")).toBe(true);
    // fall until the crash landing (a high climb takes a few seconds to come down)
    let crashed = ev.some((e) => e.type === "crash");
    for (let i = 0; i < 10 * 120 && !crashed; i++) crashed = sim.step(NO_INPUT).some((e) => e.type === "crash");
    expect(crashed).toBe(true);
    expect(sim.player.overheated).toBe(true); // still locked out right after landing
    run(sim, TUNING.copter.heatMax / TUNING.copter.coolPerSecond + 0.5);
    expect(sim.player.overheated).toBe(false);
  });

  it("the crash landing hurts dummies underneath", () => {
    const sim = newSim();
    sim.player.pos = vec(4, 6, -8);
    sim.player.onGround = false;
    sim.player.crashing = true;
    sim.player.overheated = true;
    sim.dummies[1].pos = vec(5, 0, -8);
    const ev = run(sim, 2);
    const crash = ev.find((e) => e.type === "crash");
    expect(crash && crash.type === "crash" && crash.hits).toBe(1);
  });

  it("firing turns you right and makes the aim wander (playtest 2)", () => {
    const sim = newSim();
    select(sim, 3);
    run(sim, 0.2);
    const yaw0 = sim.player.yaw;
    const pitches: number[] = [];
    for (let i = 0; i < 120; i++) {
      sim.step({ ...NO_INPUT, fireHeld: true });
      pitches.push(sim.player.pitch);
    }
    expect(sim.player.yaw).toBeLessThan(yaw0 - 0.5); // yaw going down = turning right
    expect(Math.max(...pitches) - Math.min(...pitches)).toBeGreaterThan(0.1); // the aim moved by itself
  });

  it("aiming steadies it: half the turn", () => {
    const turn = (aiming: boolean) => {
      const sim = newSim();
      select(sim, 3);
      run(sim, 0.2);
      const yaw0 = sim.player.yaw;
      run(sim, 1, { fireHeld: true, aiming });
      return yaw0 - sim.player.yaw;
    };
    expect(turn(true)).toBeLessThan(turn(false) * 0.7);
  });
});

describe("hip fire vs aimed fire", () => {
  it("an aimed Boomstick shot pushes you less than a hip shot", () => {
    const push = (aiming: boolean) => {
      const sim = newSim();
      select(sim, 1);
      run(sim, 0.2);
      sim.step({ ...NO_INPUT, firePressed: true, aiming });
      return sim.player.vel.z;
    };
    expect(push(true)).toBeGreaterThan(5);
    expect(push(true)).toBeLessThan(push(false) * 0.7);
  });

  it("aimed shotgun pellets group tighter", () => {
    const spread = (aiming: boolean) => {
      const sim = newSim();
      select(sim, 1);
      run(sim, 0.2);
      const ev = sim.step({ ...NO_INPUT, firePressed: true, aiming });
      const f = ev.find((e) => e.type === "fire");
      if (!f || f.type !== "fire") throw new Error("no shot");
      const xs = f.tracers.map((t) => (t.to.x - t.from.x) / Math.hypot(t.to.x - t.from.x, t.to.z - t.from.z));
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(spread(true)).toBeLessThan(spread(false) * 0.5);
  });

  it("the fire event says whether the shot was aimed", () => {
    const sim = newSim();
    run(sim, 0.2);
    const ev = sim.step({ ...NO_INPUT, firePressed: true, aiming: true });
    const f = ev.find((e) => e.type === "fire");
    expect(f && f.type === "fire" && f.aimed).toBe(true);
  });
});

describe("autoplay tour", () => {
  it("replays the browser's scripted run: hits, a launch, a spin, an overheat and a crash", () => {
    const sim = newSim();
    const ev: YeetEvent[] = [];
    let top = 0;
    for (let i = 0; i < Math.round(AUTOPLAY_SECONDS / sim.t.step); i++) {
      const s = autoplayStep(sim, sim.time);
      if (s.aim) {
        sim.player.yaw = s.aim.yaw;
        sim.player.pitch = s.aim.pitch;
      }
      ev.push(...sim.step(s.input));
      top = Math.max(top, sim.player.pos.y);
    }
    const count = (type: YeetEvent["type"]) => ev.filter((e) => e.type === type).length;
    expect(count("hit")).toBeGreaterThanOrEqual(3);
    expect(count("overheat")).toBe(1);
    expect(count("crash")).toBe(1);
    expect(top).toBeGreaterThan(4);
  });
});
