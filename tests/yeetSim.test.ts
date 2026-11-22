// ---------------------------------------------------------------------------
// yeetSim.test.ts
// Purpose : Proves the toy's rules without a browser: recoil moves you opposite the aim, a Boomstick floor shot is a
//           super jump within the GDD's 25 m cap, hip fire twists you right while aimed fire keeps the push without
//           the twist, fast wall hits bonk-stun, run-and-gun shots can tumble you, dummies take hits and respawn,
//           the Gatling Copter lifts, turns you, overheats and crash-lands, pickups give guns, the Gatling tower is
//           Boomstick-only, and Fight Back's dummies telegraph, throw balls and knock you out. Ends with the autoplay
//           tour replayed.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// Updated : 2026-11-21 with Claude (Opus 5.5, claude-opus-5-5): playtest 3 (levels, twist, tumbles, pickups, AI)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { moveBody, rayBox, testRoom } from "../src/core/yeet/arena";
import { AUTOPLAY_SECONDS, autoplayStep } from "../src/core/yeet/autoplay";
import { fightLevel, sandboxLevel, TOWER_TOP, type Level } from "../src/core/yeet/levels";
import { NO_INPUT, YeetSim, type YeetEvent, type YeetInput } from "../src/core/yeet/sim";
import { TUNING } from "../src/core/yeet/tuning";
import { aimDir, vec } from "../src/core/yeet/vec";

const newSim = (level: Level = sandboxLevel()) => new YeetSim(structuredClone(TUNING), level);
const run = (sim: YeetSim, seconds: number, input: Partial<YeetInput> = {}): YeetEvent[] => {
  const all: YeetEvent[] = [];
  for (let i = 0; i < Math.round(seconds / sim.t.step); i++) all.push(...sim.step({ ...NO_INPUT, ...input }));
  return all;
};
const fire = (sim: YeetSim, extra: Partial<YeetInput> = {}) => sim.step({ ...NO_INPUT, firePressed: true, ...extra });
const select = (sim: YeetSim, i: number) => sim.step({ ...NO_INPUT, select: i });
const has = (ev: YeetEvent[], type: YeetEvent["type"]) => ev.some((e) => e.type === type);
/** A sim whose dummies are all parked far away and out of sight (so a test controls who is where). */
const parkDummies = (sim: YeetSim) => sim.dummies.forEach((d, i) => {
  d.pos = vec(-24 + i * 0.9, 0, -24);
  d.spawn = vec(-24 + i * 0.9, 0, -24);
});

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

  for (const make of [sandboxLevel, fightLevel]) {
    it(`${make().name}: the player and every dummy spawn clear of the geometry, standing on something (SOP-09)`, () => {
      const level = make();
      const sim = newSim(level);
      const spawns = [level.spawn, ...level.arena.dummySpawns];
      const before = [sim.player, ...sim.dummies].map((b) => ({ ...b.pos }));
      sim.dummies.forEach((d) => (d.aiCooldown = 99)); // nobody shoots during this check
      const ev = run(sim, 0.5);
      expect(has(ev, "bonk")).toBe(false);
      [sim.player, ...sim.dummies].forEach((b, i) => {
        expect(b.onGround).toBe(true);
        expect(before[i]).toEqual(spawns[i]);
        expect(b.pos.x).toBeCloseTo(spawns[i].x, 3);
        expect(b.pos.y).toBeCloseTo(spawns[i].y, 3);
        expect(b.pos.z).toBeCloseTo(spawns[i].z, 3);
      });
    });
  }
});

describe("recoil", () => {
  it("a grounded Pea Pistol shot hops you back a visible distance", () => {
    const sim = newSim();
    run(sim, 0.1);
    const z0 = sim.player.pos.z;
    fire(sim);
    expect(sim.player.vel.y).toBeGreaterThan(0); // the hop
    run(sim, 1);
    const pushed = sim.player.pos.z - z0;
    expect(pushed).toBeGreaterThan(2.5); // playtest 3: more kick
    expect(pushed).toBeLessThan(8); // a shove, not a launch
  });

  it("Pea Pistol and Spin Doctor shots in mid-air kick and twist twice as hard (playtest 5)", () => {
    for (const gun of [0, 2]) {
      const w = TUNING.weapons[TUNING.weaponOrder[gun]];
      const air = newSim();
      select(air, gun);
      run(air, 0.2);
      air.player.pos = vec(0, 8, 14);
      air.player.vel = vec(0, 0, 0);
      air.player.onGround = false;
      fire(air);
      const ground = newSim();
      select(ground, gun);
      run(ground, 0.2);
      fire(ground);
      expect(air.player.vel.z, `gun ${gun} kick`).toBeCloseTo(w.recoil * 2, 0);
      expect(air.player.spin / ground.player.spin, `gun ${gun} twist`).toBeCloseTo(2, 5);
    }
  });

  it("a mid-air Pea Pistol shot at the floor never adds climb (no pistol jetpack)", () => {
    const sim = newSim();
    sim.player.pos = vec(0, 8, 14);
    sim.player.vel = vec(0, -2, 0);
    sim.player.onGround = false;
    sim.look(0, -10);
    fire(sim);
    expect(sim.player.vel.y).toBeLessThanOrEqual(TUNING.weapons.pistol.airLiftCap + 1e-9);
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
    for (let i = 0; i < 360; i++) {
      sim.step(NO_INPUT);
      top = Math.max(top, sim.player.pos.y);
    }
    expect(top - startY).toBeGreaterThan(TOWER_TOP + 1);
    expect(top - startY).toBeLessThan(25);
  });

  it("two Boomstick blasts cross a medium room (> 12 m) and one shot never moves you past 25 m", () => {
    const sim = newSim();
    sim.player.pos = vec(15, 0, 18);
    sim.player.yaw = Math.PI; // facing +Z, recoil pushes toward -Z
    select(sim, 1);
    run(sim, 0.2);
    const z0 = sim.player.pos.z;
    sim.look(0, -0.15);
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
    sim.player.yaw = Math.PI / 2; // looking toward -X, so recoil pushes toward +X
    select(sim, 1);
    run(sim, 0.2);
    const x0 = sim.player.pos.x;
    fire(sim);
    run(sim, 4);
    const dist = sim.player.pos.x - x0;
    expect(dist).toBeGreaterThan(12);
    expect(dist).toBeLessThan(27);
  });

  it("the Spin Doctor from the hip spins you right, and the spin settles in about a second", () => {
    const sim = newSim();
    select(sim, 2);
    run(sim, 0.2);
    const yaw0 = sim.player.yaw;
    fire(sim);
    expect(sim.player.spin).toBeLessThan(-10); // negative = to the right
    run(sim, 1.2);
    expect(Math.abs(sim.player.spin)).toBeLessThan(0.5);
    expect(sim.player.yaw - yaw0).toBeLessThan(-Math.PI / 2); // at least a quarter turn right
  });
});

describe("hip fire vs aimed fire (playtest 3: physics, not strength)", () => {
  const shot = (gun: number, aiming: boolean) => {
    const sim = newSim();
    select(sim, gun);
    run(sim, 0.2);
    const ev = fire(sim, { aiming });
    return { vz: sim.player.vel.z, spin: sim.player.spin, ev };
  };

  it("an aimed Boomstick shot pushes you just as hard as a hip shot", () => {
    expect(shot(1, true).vz).toBeCloseTo(shot(1, false).vz, 5);
  });

  it("a scoped Spin Doctor shot still spins you around (playtest 4)", () => {
    const hip = shot(2, false).spin;
    const aimed = shot(2, true).spin;
    expect(aimed).toBeLessThan(-5); // still a real spin, to the right
    expect(Math.abs(aimed)).toBeLessThan(Math.abs(hip));
  });

  it("every hip shot twists you right; aimed Pea Pistol and Boomstick shots barely twist", () => {
    for (const gun of [0, 1]) {
      const hip = shot(gun, false).spin;
      const aimed = shot(gun, true).spin;
      expect(hip, `gun ${gun} hip`).toBeLessThan(0);
      expect(Math.abs(aimed), `gun ${gun} aimed`).toBeLessThan(Math.abs(hip) * 0.25);
    }
  });

  it("aimed shotgun pellets group tighter", () => {
    const spread = (aiming: boolean) => {
      const f = shot(1, aiming).ev.find((e) => e.type === "fire");
      if (!f || f.type !== "fire") throw new Error("no shot");
      const xs = f.tracers.map((t) => (t.to.x - t.from.x) / Math.hypot(t.to.x - t.from.x, t.to.z - t.from.z));
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(spread(true)).toBeLessThan(spread(false) * 0.5);
  });

  it("the fire event says whether the shot was aimed", () => {
    const f = shot(0, true).ev.find((e) => e.type === "fire");
    expect(f && f.type === "fire" && f.aimed).toBe(true);
  });
});

describe("run-and-gun tumbles", () => {
  /** Runs forward and fires the gun every time it is ready; counts tumbles over `shots` shots. */
  const runAndGun = (gun: number, shots: number, aiming = false) => {
    const sim = newSim();
    parkDummies(sim);
    select(sim, gun);
    let tumbles = 0;
    let fired = 0;
    for (let i = 0; i < shots * 400 && fired < shots; i++) {
      // keep running back and forth across the room so speed stays up
      if (Math.abs(sim.player.pos.z) > 12) sim.player.yaw += Math.PI;
      const ev = sim.step({ ...NO_INPUT, moveZ: 1, firePressed: true, fireHeld: true, aiming, reload: false });
      if (has(ev, "fire")) fired++;
      if (has(ev, "tumble")) tumbles++;
    }
    return { tumbles, fired };
  };

  it("standing still never tumbles you", () => {
    const sim = newSim();
    select(sim, 1);
    let tumbles = 0;
    for (let i = 0; i < 30; i++) {
      run(sim, 0.8);
      if (has(fire(sim), "tumble")) tumbles++;
    }
    expect(tumbles).toBe(0);
  });

  it("firing the Boomstick while running sometimes sends you tumbling, without control", () => {
    const r = runAndGun(1, 40);
    expect(r.tumbles).toBeGreaterThan(2);
    expect(r.tumbles).toBeLessThan(r.fired);
  });

  it("aimed shots tumble you less often, and the chance grows with speed and recoil", () => {
    const sim = newSim();
    const w = sim.t.weapons;
    expect(sim.tumbleChance(w.shotgun, 7, true)).toBeLessThan(sim.tumbleChance(w.shotgun, 7, false));
    expect(sim.tumbleChance(w.pistol, 7, false)).toBeLessThan(sim.tumbleChance(w.shotgun, 7, false));
    expect(sim.tumbleChance(w.pistol, 4, false)).toBeLessThan(sim.tumbleChance(w.pistol, 7, false));
  });

  it("the Gatling Copter never tumbles you", () => {
    expect(runAndGun(3, 60).tumbles).toBe(0);
  });

  it("a tumble takes control away, then gives it back once you land", () => {
    const sim = newSim();
    parkDummies(sim);
    sim.startTumble([]);
    expect(sim.helpless).toBe(true);
    const ev = run(sim, TUNING.tumble.maxDuration + 0.5);
    expect(has(ev, "recover")).toBe(true);
    expect(sim.helpless).toBe(false);
  });

  it("the same inputs give the same tumbles (seeded, replayable)", () => {
    expect(runAndGun(1, 30)).toEqual(runAndGun(1, 30));
  });
});

describe("sprint (playtest 4)", () => {
  it("holding Shift runs faster, for a few seconds, then you are winded until it refills", () => {
    const sim = newSim();
    parkDummies(sim);
    sim.player.pos = vec(15, 0, 18); // a clear lane to the far wall
    sim.player.yaw = 0;
    run(sim, 0.5, { moveZ: 1, sprint: true });
    expect(sim.player.sprinting).toBe(true);
    expect(Math.hypot(sim.player.vel.x, sim.player.vel.z)).toBeCloseTo(TUNING.sprint.speed, 1);
    run(sim, TUNING.sprint.stamina, { moveZ: 1, sprint: true });
    expect(sim.player.winded).toBe(true);
    expect(sim.player.sprinting).toBe(false);
    run(sim, 0.5, { moveZ: 1, sprint: true });
    expect(Math.hypot(sim.player.vel.x, sim.player.vel.z)).toBeLessThanOrEqual(TUNING.player.runSpeed + 0.01);
    run(sim, TUNING.sprint.regenDelay + TUNING.sprint.stamina);
    expect(sim.player.winded).toBe(false);
    expect(sim.player.stamina).toBeCloseTo(TUNING.sprint.stamina, 1);
  });

  it("firing while sprinting doubles the tumble chance", () => {
    const sim = newSim();
    const w = sim.t.weapons.pistol;
    expect(sim.tumbleChance(w, 7, false, true)).toBeCloseTo(sim.tumbleChance(w, 7, false) * 2, 6);
  });
});

describe("magazines and reloading (playtest 5)", () => {
  it("each gun holds its magazine: pistol 9, shotgun 2, sniper 5, gatling 200", () => {
    const sim = newSim();
    expect(sim.player.mag).toEqual({ pistol: 9, shotgun: 2, sniper: 5, copter: 200 });
  });

  it("emptying the Boomstick reloads it on its own; it cannot fire until the reload is done, then it is full", () => {
    const sim = newSim();
    parkDummies(sim);
    select(sim, 1);
    run(sim, 0.2);
    fire(sim);
    run(sim, TUNING.weapons.shotgun.cooldown + 0.05);
    const ev = fire(sim);
    expect(has(ev, "fire")).toBe(true);
    expect(has(ev, "reload")).toBe(true); // the last shell
    expect(sim.player.mag.shotgun).toBe(0);
    run(sim, TUNING.weapons.shotgun.cooldown + 0.05);
    expect(has(fire(sim), "fire")).toBe(false); // still reloading
    const later = run(sim, TUNING.weapons.shotgun.reload);
    expect(has(later, "reloaded")).toBe(true);
    expect(sim.player.mag.shotgun).toBe(2);
    expect(has(fire(sim), "fire")).toBe(true);
  });

  it("R reloads a part-used magazine; switching guns cancels a reload; reserve ammo never runs out", () => {
    const sim = newSim();
    parkDummies(sim);
    fire(sim);
    expect(sim.player.mag.pistol).toBe(8);
    expect(has(sim.step({ ...NO_INPUT, reload: true }), "reload")).toBe(true);
    select(sim, 1);
    expect(sim.player.reloading).toBe(0);
    expect(sim.player.mag.pistol).toBe(8); // the cancelled reload did not fill it
    select(sim, 0);
    let shots = 0;
    for (let i = 0; i < 120 * 30; i++) if (has(sim.step({ ...NO_INPUT, firePressed: true }), "fire")) shots++;
    expect(shots).toBeGreaterThan(50); // many magazines, never out
  });

  it("the Gatling Copter stops pushing when its 200 rounds run out mid-burst, then reloads", () => {
    const sim = newSim();
    parkDummies(sim);
    select(sim, 3);
    run(sim, 0.2);
    sim.player.mag.copter = 3;
    const ev = run(sim, 0.5, { fireHeld: true });
    expect(ev.filter((e) => e.type === "fire").length).toBe(3);
    expect(has(ev, "reload")).toBe(true);
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

  it("sprinting into a wall does not bonk", () => {
    const sim = newSim();
    sim.player.pos = vec(15, 0, -15);
    sim.player.yaw = 0;
    const ev = run(sim, 1.5, { moveZ: 1, sprint: true });
    expect(has(ev, "bonk")).toBe(false);
  });

  it("walking into a wall does not bonk", () => {
    const sim = newSim();
    sim.player.pos = vec(18, 0, 10);
    sim.player.yaw = -Math.PI / 2; // face +X
    const ev = run(sim, 1, { moveZ: 1 });
    expect(has(ev, "bonk")).toBe(false);
  });

  it("stunned players cannot fire", () => {
    const sim = newSim();
    sim.player.stun = 0.5;
    expect(has(fire(sim), "fire")).toBe(false);
  });
});

describe("dummies", () => {
  it("a sniper hit knocks a dummy flying, downs it, and it respawns", () => {
    const sim = newSim();
    sim.player.pos = vec(4, 0, 4);
    sim.player.yaw = 0;
    sim.dummies[1].pos = vec(4, 0, -8);
    select(sim, 2);
    run(sim, 0.2);
    const ev = fire(sim);
    expect(ev.some((e) => e.type === "hit" && e.dummy === 1)).toBe(true);
    expect(ev.some((e) => e.type === "down" && e.dummy === 1)).toBe(true);
    expect(sim.dummies[1].vel.z).toBeLessThan(-5);
    const later = run(sim, sim.level.dummyRespawn + 0.1);
    expect(later.some((e) => e.type === "respawn" && e.dummy === 1)).toBe(true);
    expect(sim.dummies[1].hp).toBe(TUNING.dummy.hp);
  });

  it("walls block shots", () => {
    const sim = newSim();
    sim.player.pos = vec(0, 0, 6); // the central pillar is between us and dummy 2
    sim.player.yaw = 0;
    sim.dummies[2].pos = vec(0, 0, -10);
    expect(has(fire(sim), "hit")).toBe(false);
  });

  it("sandbox dummies never shoot", () => {
    const sim = newSim();
    const ev = run(sim, 10);
    expect(has(ev, "dummyAim") || has(ev, "dummyFire")).toBe(false);
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
    expect(has(ev, "overheat")).toBe(true);
    let crashed = has(ev, "crash");
    for (let i = 0; i < 10 * 120 && !crashed; i++) crashed = has(sim.step(NO_INPUT), "crash");
    expect(crashed).toBe(true);
    expect(sim.player.overheated).toBe(true);
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
    const crash = run(sim, 2).find((e) => e.type === "crash");
    expect(crash && crash.type === "crash" && crash.hits).toBe(1);
  });

  it("firing turns you right and makes the aim wander", () => {
    const sim = newSim();
    select(sim, 3);
    run(sim, 0.2);
    const yaw0 = sim.player.yaw;
    const pitches: number[] = [];
    for (let i = 0; i < 120; i++) {
      sim.step({ ...NO_INPUT, fireHeld: true });
      pitches.push(sim.player.pitch);
    }
    expect(sim.player.yaw).toBeLessThan(yaw0 - 0.5);
    expect(Math.max(...pitches) - Math.min(...pitches)).toBeGreaterThan(0.1);
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

describe("Fight Back: guns and pickups", () => {
  it("you start with the Pea Pistol and Boomstick only, and cannot switch to guns you do not own", () => {
    const sim = newSim(fightLevel());
    expect(sim.player.owned).toEqual(["pistol", "shotgun"]);
    expect(has(select(sim, 2), "switch")).toBe(false);
    expect(sim.player.weapon).toBe("pistol");
    expect(has(select(sim, 1), "switch")).toBe(true);
  });

  it("walking over the Spin Doctor picks it up and puts it in your hands", () => {
    const sim = newSim(fightLevel());
    parkDummies(sim);
    const p = sim.pickups.find((x) => x.weapon === "sniper")!;
    sim.player.pos = vec(p.pos.x, p.pos.y, p.pos.z + 0.5);
    const ev = run(sim, 0.1);
    expect(ev.some((e) => e.type === "pickup" && e.weapon === "sniper")).toBe(true);
    expect(sim.player.owned).toContain("sniper");
    expect(sim.player.weapon).toBe("sniper");
  });

  it("a Boomstick floor launch beside the tower lands you on top, next to the Gatling Copter", () => {
    const sim = newSim(fightLevel());
    parkDummies(sim);
    sim.player.pos = vec(0, 0, 6); // 2 m south of the tower
    sim.player.yaw = Math.PI; // facing away from it (+Z)
    select(sim, 1);
    run(sim, 0.2);
    sim.look(0, -1.5); // nearly straight down: the kick goes up and a little back, over the tower's edge
    fire(sim);
    let landed = false;
    for (let i = 0; i < 480 && !landed; i++) {
      sim.step(NO_INPUT);
      landed = sim.player.onGround && sim.player.pos.y > TOWER_TOP - 0.01;
    }
    expect(landed).toBe(true); // on top of the tower
    // walk to the Gatling Copter
    const p = sim.pickups.find((x) => x.weapon === "copter")!;
    let ev: YeetEvent[] = [];
    for (let i = 0; i < 480 && !has(ev, "pickup"); i++) {
      sim.player.yaw = Math.atan2(-(p.pos.x - sim.player.pos.x), -(p.pos.z - sim.player.pos.z));
      ev = ev.concat(sim.step({ ...NO_INPUT, moveZ: 1 }));
    }
    expect(ev.some((e) => e.type === "pickup" && e.weapon === "copter")).toBe(true);
  });

  it("the Pea Pistol cannot reach the tower top, even hover-skipping off the highest crate", () => {
    const sim = newSim(fightLevel());
    parkDummies(sim);
    sim.player.pos = vec(-13.5, 2.5, -19.5); // on the crate stack
    sim.player.onGround = true;
    sim.look(0, -10); // straight down
    let top = 0;
    // fire as fast as the pistol allows, jumping too, for 4 seconds
    for (let i = 0; i < 480; i++) {
      sim.step({ ...NO_INPUT, firePressed: true, jump: i === 1 });
      top = Math.max(top, sim.player.pos.y);
    }
    expect(top).toBeLessThan(TOWER_TOP - 1);
  });

  it("the Spin Doctor cannot reach the tower top either, firing at the floor from the ground and again in mid-air", () => {
    const sim = newSim(fightLevel());
    parkDummies(sim);
    sim.player.owned.push("sniper");
    select(sim, 2);
    run(sim, 0.2);
    sim.player.pos = vec(-13.5, 2.5, -19.5); // on the highest crate
    sim.player.onGround = true;
    sim.look(0, -10);
    let top = 0;
    for (let i = 0; i < 600; i++) {
      sim.step({ ...NO_INPUT, firePressed: true }); // every shot the gun allows, ground and air
      top = Math.max(top, sim.player.pos.y);
    }
    expect(top).toBeLessThan(TOWER_TOP - 0.5);
  });

  it("being knocked out resets your guns and puts the pickups back", () => {
    const sim = newSim(fightLevel());
    parkDummies(sim);
    sim.player.owned.push("sniper");
    sim.pickups[0].taken = true;
    sim.player.hp = 1;
    sim.balls.push({ pos: vec(sim.player.pos.x, 1, sim.player.pos.z - 0.3), vel: vec(0, 0, 20), life: 1, owner: 0 });
    const ev = run(sim, TUNING.player.respawnDelay + 0.2);
    expect(has(ev, "playerDown")).toBe(true);
    expect(has(ev, "playerRespawn")).toBe(true);
    expect(sim.player.owned).toEqual(["pistol", "shotgun"]);
    expect(sim.pickups.every((p) => !p.taken)).toBe(true);
    expect(sim.player.hp).toBe(TUNING.player.hp);
  });
});

describe("Fight Back: the dummies shoot back", () => {
  /** One dummy in the open facing the player 15 m away; the rest parked out of sight. */
  const duel = () => {
    const sim = newSim(fightLevel());
    parkDummies(sim);
    sim.dummies[1].pos = vec(0, 0, 8);
    sim.dummies[1].aiCooldown = 0;
    sim.player.pos = vec(0, 0, 21);
    return sim;
  };

  it("a dummy that sees you glows first, then throws a ball that hurts and knocks you back", () => {
    const sim = duel();
    const ev = run(sim, 0.05);
    expect(ev.some((e) => e.type === "dummyAim" && e.dummy === 1)).toBe(true);
    const early = run(sim, TUNING.ai.telegraph * 0.5);
    expect(has(early, "dummyFire")).toBe(false); // the telegraph gives you time
    const later = run(sim, TUNING.ai.telegraph + 1.5);
    expect(has(later, "dummyFire")).toBe(true);
    expect(later.some((e) => e.type === "playerHit" && e.dummy === 1)).toBe(true);
    expect(sim.player.hp).toBe(TUNING.player.hp - TUNING.ai.damage);
  });

  it("dummies do not shoot through walls", () => {
    const sim = newSim(fightLevel());
    parkDummies(sim); // parked in the far corner, behind cover from the start
    sim.dummies.forEach((d) => (d.aiCooldown = 0));
    sim.player.pos = vec(0, 0, 21);
    sim.dummies[0].pos = vec(0, 0, -6); // straight behind the tower from the spawn
    const ev = run(sim, 4);
    expect(ev.some((e) => e.type === "dummyAim" && e.dummy === 0)).toBe(false);
  });

  it("knocking a dummy around while it glows cancels its shot", () => {
    const sim = duel();
    run(sim, 0.05);
    expect(sim.dummies[1].aiming).toBeGreaterThan(0);
    sim.dummies[1].vel = vec(0, 3, -6); // as if hit
    sim.dummies[1].onGround = false;
    const ev = run(sim, TUNING.ai.telegraph + 0.2);
    expect(has(ev, "dummyFire")).toBe(false);
  });

  it("enough hits knock you out; you respawn at the start", () => {
    const sim = duel();
    let downs = 0;
    for (let i = 0; i < 60 * 120 && downs === 0; i++) if (has(sim.step(NO_INPUT), "playerDown")) downs++;
    expect(downs).toBe(1);
    expect(sim.helpless).toBe(true);
    run(sim, TUNING.player.respawnDelay + 0.1);
    expect(sim.player.pos).toEqual(fightLevel().spawn);
    expect(sim.player.dead).toBe(0);
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
