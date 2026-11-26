import { describe, expect, it } from "vitest";
import { box } from "../src/core/yeet/arena";
import { sandboxLevel } from "../src/core/yeet/levels";
import { NO_INPUT, YeetSim } from "../src/core/yeet/sim";
import { TUNING } from "../src/core/yeet/tuning";
import { Room } from "../src/net/room";

const step = (s: YeetSim, n: number) => { for (let i = 0; i < n; i++) s.step(NO_INPUT); };
function arena() {
  const level = sandboxLevel(); level.arena = { boxes: [box(-40, -1, -40, 40, 0, 40, "floor")], dummySpawns: [] };
  level.spawn = { x: 0, y: 0, z: 0 }; level.spawns = [level.spawn, { x: 0, y: 0, z: -8 }]; return level;
}
describe("agreed shield rules", () => {
  it.each([false, true])("blocks frontal bullets in hip/aimed modes (%s) but leaves the rear vulnerable", (aiming) => {
    const sim = new YeetSim(TUNING, arena(), 2), p = sim.players[0], enemy = sim.players[1];
    p.weapon = "shield"; enemy.yaw = Math.PI; enemy.weapon = "pistol";
    sim.step([{ ...NO_INPUT, aiming }, { ...NO_INPUT, firePressed: true }]);
    expect(p.hp).toBe(100); expect(p.vel.z).toBeGreaterThan(0);
    const blockedForce = p.vel.z;
    const rear = new YeetSim(TUNING, arena(), 2); rear.players[0].weapon = "shield"; rear.players[0].yaw = Math.PI;
    rear.players[1].yaw = Math.PI; rear.step([NO_INPUT, { ...NO_INPUT, firePressed: true }]);
    expect(rear.players[0].hp).toBe(100 - TUNING.weapons.pistol.damage);
    expect(blockedForce / rear.players[0].vel.z).toBeCloseTo(0.5);
  });
  it("uses the shared Pea Pistol magazine at the hip and cannot shoot or reload while braced", () => {
    const s = new YeetSim(TUNING, arena()); s.player.weapon = "shield";
    expect(s.step({ ...NO_INPUT, firePressed: true }).some((e) => e.type === "fire" && e.weapon === "pistol")).toBe(true);
    expect(s.player.mag.pistol).toBe(TUNING.weapons.pistol.mag - 1);
    step(s, 60); const ammo = s.player.mag.pistol;
    expect(s.step({ ...NO_INPUT, aiming: true, firePressed: true, reload: true }).some((e) => e.type === "fire")).toBe(false);
    expect(s.player.mag.pistol).toBe(ammo); expect(s.player.reloading).toBe(0);
  });
  it("halves frontal blast damage/knockback at the hip and prevents frontal aimed blast damage", () => {
    const blast = (weapon: "shield" | "pistol", aimed: boolean, yaw = 0) => {
      const level = arena(); level.arena.boxes.push({ ...box(-0.4, 0, -4.4, 0.4, 1.2, -3.6), prop: "drum" });
      const sim = new YeetSim(TUNING, level); sim.player.weapon = weapon; sim.player.yaw = yaw;
      sim.step({ ...NO_INPUT, aiming: aimed }); sim.debugExplode(0);
      return { damage: 100 - sim.player.hp, force: sim.player.vel.z };
    };
    const plain = blast("pistol", false), hip = blast("shield", false), aimed = blast("shield", true), rear = blast("shield", true, Math.PI);
    expect(plain.damage).toBeGreaterThan(0); expect(hip.damage).toBeCloseTo(plain.damage * 0.5);
    expect(aimed.damage).toBe(0); expect(hip.force).toBeCloseTo(plain.force * 0.5); expect(aimed.force).toBeCloseTo(hip.force);
    expect(rear.damage).toBeCloseTo(plain.damage);
  });
});
describe("carried health packs", () => {
  it("fully heals after three seconds despite damage/stun, holsters weapons, then starts a ten-second cooldown", () => {
    const s = new YeetSim(TUNING, arena()); s.player.healthUses = 3; s.player.hp = 20;
    s.step({ ...NO_INPUT, heal: true, firePressed: true }); expect(s.player.healthUses).toBe(2);
    expect(s.player.mag.pistol).toBe(TUNING.weapons.pistol.mag);
    step(s, 120); s.player.hp = 5; s.player.stun = 0.4; step(s, 239); expect(s.player.hp).toBe(5);
    step(s, 1); expect(s.player.hp).toBe(100); expect(s.player.healCooldown).toBeCloseTo(10);
    s.player.hp = 25; s.step({ ...NO_INPUT, heal: true }); expect(s.player.healing).toBe(0); expect(s.player.healthUses).toBe(2);
    step(s, 1201); s.step({ ...NO_INPUT, heal: true }); expect(s.player.healing).toBe(3); expect(s.player.healthUses).toBe(1);
  });
  it("refills to three without stacking, does not reset cooldown, and does not consume a use at full health", () => {
    const level = arena(); level.pickups = [{ weapon: "health", pos: { ...level.spawn } }];
    const s = new YeetSim(TUNING, level); s.player.healthUses = 1; s.player.healCooldown = 7;
    s.step(NO_INPUT); expect(s.player.healthUses).toBe(3); expect(s.player.healCooldown).toBeGreaterThan(6.9);
    s.step({ ...NO_INPUT, heal: true }); expect(s.player.healthUses).toBe(3); expect(s.player.healing).toBe(0);
  });
  it("clears equipment on death and does not resurrect someone whose application was in progress", () => {
    const level = arena(); level.startWeapons = ["pistol", "shotgun"];
    const s = new YeetSim(TUNING, level); s.player.healthUses = 3; s.player.hp = 10; s.player.owned.push("shield");
    s.step({ ...NO_INPUT, heal: true }); s.player.dead = 1; step(s, 20); expect(s.player.healing).toBe(0);
    step(s, 200); expect(s.player.healthUses).toBe(0); expect(s.player.owned).toEqual(level.startWeapons);
  });
  it("allows exactly three recoveries and cannot spend an empty pack", () => {
    const s = new YeetSim(TUNING, arena()); s.player.healthUses = 3;
    for (let i = 0; i < 3; i++) {
      s.player.hp = 20; s.step({ ...NO_INPUT, heal: true }); step(s, 360);
      expect(s.player.hp).toBe(100); expect(s.player.healthUses).toBe(2 - i); step(s, 1201);
    }
    s.player.hp = 20; s.step({ ...NO_INPUT, heal: true }); step(s, 400); expect(s.player.hp).toBe(20);
  });
  it("round-trips treatment state deterministically through snapshots", () => {
    const a = new YeetSim(TUNING, arena()), b = new YeetSim(TUNING, arena());
    a.player.healthUses = 3; a.player.hp = 12; a.step({ ...NO_INPUT, heal: true }); step(a, 85);
    b.importState(a.exportState()); step(a, 400); step(b, 400); expect(b.exportState()).toEqual(a.exportState());
  });
  it("sanitizes the network heal press and never repeats it as a held action", () => {
    const r = new Room("HEAL"); r.join(); r.join(); r.sim.players[0].healthUses = 3; r.sim.players[0].hp = 10;
    r.push(0, [{ ...NO_INPUT, seq: 1, dYaw: 0, dPitch: 0, heal: true }]); r.step();
    expect(r.sim.players[0].healing).toBe(3); expect(r.snapshot().held![0].heal).toBe(false);
    for (let i = 0; i < 1700; i++) r.step();
    r.sim.players[0].hp = 5; r.step(); expect(r.sim.players[0].healing).toBe(0); expect(r.sim.players[0].healthUses).toBe(2);
  });
});
