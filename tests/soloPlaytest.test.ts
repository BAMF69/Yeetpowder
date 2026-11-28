import { describe, expect, it } from "vitest";
import { levelById, sandboxLevel } from "../src/core/yeet/levels";
import { NO_INPUT, YeetSim, type TaggedEvent } from "../src/core/yeet/sim";
import { TUNING } from "../src/core/yeet/tuning";
import { grenadeAim } from "../src/core/yeet/grenadeAim";
import { aimDir } from "../src/core/yeet/vec";
import { Room } from "../src/net/room";
import { quickOptions } from "../src/net/roomOptions";
import { playerProfile } from "../src/net/profile";
import { HighlightRecorder } from "../src/net/highlight";
import { BotBrain } from "../src/core/yeet/bot";

const step = (sim: YeetSim, n: number) => { const events: TaggedEvent[] = []; for (let i = 0; i < n; i++) events.push(...sim.step(NO_INPUT)); return events; };
describe("solo playtest fixes", () => {
  it("removes yard fence faces from the warehouse half of both industrial maps", () => {
    for (const id of ["industrial", "industrial-party"]) {
      const fences = levelById(id).arena.boxes.filter((b) => b.paint === "corrugated" && b.kind === "wall");
      expect(fences.length).toBe(3); expect(fences.every((b) => b.min.x >= 0)).toBe(true);
    }
  });
  it("collects a three-use health pack and lets map supplies return", () => {
    const lv = sandboxLevel(); lv.pickups = [{ weapon: "health", pos: { ...lv.spawn } }];
    const sim = new YeetSim(TUNING, lv); sim.step(NO_INPUT);
    expect(sim.pickups[0].taken).toBe(true); expect(sim.player.healthUses).toBe(3);
    expect(sim.player.hp).toBe(100);
    sim.player.pos.x += 5; step(sim, Math.ceil(TUNING.supplies.healthRespawn / TUNING.step) + 1);
    expect(sim.pickups[0].taken).toBe(false);
    sim.player.pos = { ...lv.spawn }; sim.step(NO_INPUT); expect(sim.pickups[0].taken).toBe(false);
    const weapons = new YeetSim(TUNING, levelById("duel")); const pickup = weapons.pickups[0]; weapons.player.pos = { ...pickup.pos }; weapons.step(NO_INPUT);
    expect(pickup.taken).toBe(true); weapons.player.pos = { ...weapons.level.spawn };
    step(weapons, Math.ceil(TUNING.supplies.weaponRespawn / TUNING.step) + 1); expect(pickup.taken).toBe(false);
  });
  it("adds reachable health, shield and extra weapon supplies to every Party map", () => {
    for (const id of ["island-party", "industrial-party", "junkyard-party", "coliseum"]) {
      const level = levelById(id);
      expect(level.pickups.some((p) => p.weapon === "shield")).toBe(true);
      expect(level.pickups.filter((p) => p.weapon === "health")).toHaveLength(1);
      expect(level.pickups.filter((p) => p.weapon === "grenade")).toHaveLength(1);
      expect(level.pickups.some((p) => p.weapon === "shotgun")).toBe(false);
      expect(level.pickups.length).toBeGreaterThan(12);
    }
  });
  it("uses a seeded variety of respawns and avoids occupied spawn points", () => {
    const make = () => new YeetSim(TUNING, levelById("coliseum"), 2);
    const a = make(), b = make(); const seen = new Set<string>();
    for (let i = 0; i < 16; i++) {
      a.players[0].dead = b.players[0].dead = TUNING.step * 0.5; a.step(NO_INPUT); b.step(NO_INPUT);
      expect(a.player.pos).toEqual(b.player.pos); expect(Math.hypot(a.player.pos.x - a.players[1].pos.x, a.player.pos.z - a.players[1].pos.z)).toBeGreaterThan(8);
      seen.add(JSON.stringify(a.player.pos));
    }
    expect(seen.size).toBeGreaterThan(3);
  });
  it("blocks frontal bullets while allowing rear hits and hip pistol fire", () => {
    const sim = new YeetSim(TUNING, levelById("duel"), 2), a = sim.players[0], b = sim.players[1];
    a.pos = { x: -7.5, y: 0, z: 2 }; a.yaw = 0; a.pitch = 0; a.weapon = "sniper";
    b.pos = { x: -7.5, y: 0, z: -5 }; b.yaw = Math.PI; b.weapon = "shield"; b.owned.push("shield");
    sim.step([NO_INPUT, { ...NO_INPUT, aiming: true }]);
    sim.step([{ ...NO_INPUT, firePressed: true }, { ...NO_INPUT, aiming: true }]); expect(b.hp).toBeGreaterThan(80);
    const flank = new YeetSim(TUNING, levelById("duel"), 2); flank.players[0].pos = { x: -7.5, y: 0, z: 2 }; flank.players[0].yaw = 0; flank.players[0].weapon = "sniper";
    flank.players[1].pos = { x: -7.5, y: 0, z: -5 }; flank.players[1].weapon = "shield"; flank.players[1].yaw = 0;
    flank.step([NO_INPUT, { ...NO_INPUT, aiming: true }]); flank.step([{ ...NO_INPUT, firePressed: true }, { ...NO_INPUT, aiming: true }]); expect(flank.players[1].hp).toBe(0);
    const bash = new YeetSim(TUNING, levelById("duel"), 2); bash.players[0].weapon = "shield"; bash.players[0].pos = { x: -7.5, y: 0, z: 0 }; bash.players[0].yaw = 0; bash.players[1].pos = { x: -7.5, y: 0, z: -2 };
    bash.step([{ ...NO_INPUT, firePressed: true }, NO_INPUT]); expect(bash.players[1].hp).toBe(100 - TUNING.weapons.pistol.damage); expect(bash.players[0].mag.pistol).toBe(TUNING.weapons.pistol.mag - 1);
  });
  it("predicts aimed grenade motion through its fuse using the same bounces as simulation", () => {
    const sim = new YeetSim(TUNING, sandboxLevel()); sim.dummies.length = 0; sim.player.weapon = "grenade"; sim.player.pitch = -0.3;
    const eye = sim.eye(), direction = aimDir(sim.player.yaw, sim.player.pitch), path = grenadeAim(sim.arena, eye, direction, TUNING);
    const hip = grenadeAim(sim.arena, eye, direction, TUNING, false);
    expect(Math.abs(path[4].z - eye.z)).toBeGreaterThan(Math.abs(hip[4].z - eye.z));
    const events = sim.step({ ...NO_INPUT, firePressed: true, aiming: true });
    events.push(...step(sim, Math.ceil(TUNING.projectile.grenade.fuse / TUNING.step)));
    const boom = events.find((e) => e.type === "blast"); expect(boom?.type).toBe("blast");
    if (boom?.type === "blast") expect(Math.hypot(boom.at.x - path.at(-1)!.x, boom.at.z - path.at(-1)!.z)).toBeLessThan(0.15);
    expect(TUNING.projectile.grenade.blast.radius).toBe(8); expect(TUNING.weapons.shotgun.spread).toBe(0.15);
  });
  it("holds a player visible for two seconds before the shark knockout and disappearance", () => {
    const sim = new YeetSim(TUNING, levelById("island")); sim.player.pos = { x: 50, y: -2, z: 0 };
    const entered = sim.step(NO_INPUT); expect(entered.some((e) => e.type === "sharkApproach")).toBe(true);
    const before = step(sim, 230); expect(before.some((e) => e.type === "eaten")).toBe(false); expect(sim.player.dead).toBe(0); expect(sim.player.swallowed).toBe(false);
    expect(step(sim, 12).some((e) => e.type === "eaten")).toBe(true); expect(sim.player.swallowed).toBe(true); expect(sim.player.dead).toBeGreaterThan(0);
  });
  it("redirects island retreat controls toward solid ground without an edge recoil shot", () => {
    // On the shore (the island top spans x, z in [-13, 13]); x = 17.5 was open water, so it fell in on frame 0.
    const sim = new YeetSim(TUNING, levelById("island"), 2); sim.players[1].pos = { x: 12.5, y: 0, z: 0 }; sim.players[1].onGround = true;
    const brain = new BotBrain(TUNING, 1, "medium", 10);
    // Checks the water entry itself: the old end-state check passed only because a 2.2 s respawn hid the fall.
    let entered = false;
    for (let i = 0; i < 600; i++) { const out = brain.think(sim); sim.look(out.dYaw, out.dPitch, 1); if (sim.step([NO_INPUT, out.input]).some((e) => e.type === "sharkApproach")) entered = true; }
    expect(entered).toBe(false); expect(sim.players[1].swallowed).toBe(false);
  });
});
describe("profiles, next matches and kill-qualified highlights", () => {
  it("sanitizes names, persists normalized operator choices in snapshots and labels bots", () => {
    expect(playerProfile({ name: "  <Elaina>\n", operator: "mint" })).toEqual({ name: "Elaina", operator: "mint" });
    const room = new Room("NAME", quickOptions()); room.join({ name: "Elaina", operator: "violet" });
    expect(room.snapshot().profiles![0]).toEqual({ name: "Elaina", operator: "violet" }); expect(room.profiles[1].name).toContain("bot");
  });
  it("rotates public rooms after exactly 30 seconds, keeps humans, clears scores and rejects old-round inputs", () => {
    const room = new Room("NEXT", { ...quickOptions(), scoreLimit: 1 }); room.join({ name: "Elaina", operator: "mint" }); room.step(); room.sim.kos[0] = 1; room.step();
    const map = room.options.level; expect(room.match.nextRoundIn).toBe(30);
    for (let i = 0; i < 3599; i++) room.step(); expect(room.round).toBe(1);
    room.step(); expect(room.round).toBe(2); expect(room.options.level).not.toBe(map); expect(room.sim.kos.every((n) => n === 0)).toBe(true); expect(room.profiles[0].name).toBe("Elaina"); expect(room.active.filter(Boolean)).toHaveLength(8);
    room.push(0, [{ ...NO_INPUT, seq: 9000, round: 1, dYaw: 0, dPitch: 0 }]); room.step(); expect(room.acks[0]).toBe(0);
    room.push(0, [{ ...NO_INPUT, seq: 1, round: 2, dYaw: 0, dPitch: 0 }]); room.step(); expect(room.acks[0]).toBe(1);
  });
  it("lets a present player start a new map immediately after a quick match", () => {
    const room = new Room("NEXT", { ...quickOptions(), scoreLimit: 1 }); room.join(); room.join(); room.step(); room.sim.kos[0] = 1; room.step();
    room.nextRound(1); expect(room.round).toBe(2); expect(room.match.nextRoundIn).toBeUndefined();
    const privateRoom = new Room("PRIV", { capacity: 2, scoreLimit: 1 }); privateRoom.join(); privateRoom.step(); privateRoom.sim.kos[0] = 1; privateRoom.step(); privateRoom.nextRound(0); expect(privateRoom.round).toBe(1);
  });
  it("rejects a faster no-kill moment and selects a lower-speed moment containing a credited kill", () => {
    const sim = new YeetSim(TUNING, levelById("duel"), 2), recorder = new HighlightRecorder();
    for (let i = 0; i < 60; i++) { sim.players[0].vel.x = i < 10 ? 100 : 5; sim.players[1].vel.x = 7; recorder.record(i / 10, sim.players, [true, true], i === 50 ? [{ type: "pvpDown", by: 1, target: 0 }] : []); }
    const clip = recorder.clip()!; expect(clip.slot).toBe(1); expect(clip.speed).toBe(7); expect(clip.killAt).toBe(5); expect(clip.frames.at(-1)!.time).toBeGreaterThanOrEqual(5);
  });
});
