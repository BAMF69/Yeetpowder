import { describe, expect, it } from "vitest";
import { Room } from "../src/net/room";
import { RoomDirectory } from "../src/net/roomDirectory";
import { quickOptions, roomOptions } from "../src/net/roomOptions";
import { NO_INPUT } from "../src/core/yeet/sim";
import { TUNING } from "../src/core/yeet/tuning";
import { Predictor } from "../src/net/predict";
import type { NetInput } from "../src/net/protocol";

describe("eight-combatant matchmaking", () => {
  it("replaces bots on join and restores easy/medium bots immediately on leave", () => {
    const room = new Room("PART", quickOptions());
    room.join(); room.step();
    expect(room.sim.players).toHaveLength(8);
    expect(room.bots.filter(Boolean)).toHaveLength(7);
    expect(new Set(room.bots.filter(Boolean))).toEqual(new Set(["easy", "medium"]));
    expect(room.active.filter(Boolean)).toHaveLength(8);
    const slot = room.join();
    expect(room.bots[slot]).toBeNull();
    expect(room.bots.filter(Boolean)).toHaveLength(6);
    room.leave(slot);
    expect(room.active.filter(Boolean)).toHaveLength(8);
    expect(room.bots.filter(Boolean)).toHaveLength(7);
    expect(room.join()).toBe(slot);
    for (let i = 0; i < 6; i++) expect(room.join()).toBeGreaterThanOrEqual(0);
    expect(room.join()).toBe(-1);
    expect(room.bots.filter(Boolean)).toHaveLength(0);
  });

  it("matches public rooms, excludes private/full/elimination rooms, and creates overflow rooms", () => {
    const directory = new RoomDirectory();
    const privateRoom = directory.create({ ...quickOptions(), visibility: "private" }); privateRoom.join();
    const elimination = directory.create({ ...quickOptions(), mode: "lives" }); elimination.join();
    const first = directory.quick(); first.join();
    expect(first.code).not.toBe(privateRoom.code);
    expect(first.code).not.toBe(elimination.code);
    expect(directory.quick()).toBe(first);
    for (let i = 1; i < 8; i++) first.join();
    const overflow = directory.quick();
    expect(overflow).not.toBe(first);
    expect(overflow.options.capacity).toBe(8);
    expect(overflow.options.botFill).toBe(true);
  });

  it("steps every bot through player controls and sends their held inputs for prediction", () => {
    const room = new Room("PART", quickOptions()); room.join();
    const before = room.sim.players.map((p) => ({ ...p.pos }));
    for (let step = 0; step < 240; step++) room.step();
    expect(room.sim.players.slice(1).every((p, i) => Math.hypot(p.pos.x - before[i + 1].x, p.pos.z - before[i + 1].z) > 0.1)).toBe(true);
    const snapshot = room.snapshot();
    expect(snapshot.active!.every(Boolean)).toBe(true);
    const predictor = new Predictor(0, room.options);
    predictor.onSnapshot(snapshot);
    expect(predictor.sim.players).toHaveLength(8);
    expect(predictor.heldBy(1)).toEqual(snapshot.held![1]);
    expect(room.sim.dummies).toHaveLength(0);
  });

  it("validates room capacities, maps, modes and limits at the authority", () => {
    expect(roomOptions({ capacity: 200, level: "duel", minutes: -5 })).toMatchObject({ capacity: 8, level: "industrial-party", minutes: 1 });
    expect(roomOptions({ mode: "ringout", level: "industrial-party" }).level).toBe("island-party");
    expect(roomOptions({ capacity: NaN }).capacity).toBe(8);
    expect(roomOptions({ capacity: 4, visibility: "public" }).visibility).toBe("private");
  });

  it("rejects non-finite inputs and keeps unknown packet fields out of snapshots", () => {
    const room = new Room("PART", quickOptions()); room.join();
    room.push(0, [{ ...NO_INPUT, seq: 1, dYaw: NaN, dPitch: 0 }]); room.step();
    expect(room.acks[0]).toBe(0);
    room.push(0, [{ ...NO_INPUT, seq: 2, dYaw: 0, dPitch: 0, firePressed: "yes", arbitrary: "payload" } as unknown as NetInput]);
    room.step(); const snapshot = room.snapshot();
    expect(room.acks[0]).toBe(2);
    expect(snapshot.held![0]).not.toHaveProperty("arbitrary");
    expect(snapshot.events.filter((e) => e.p === 0 && e.type === "fire")).toHaveLength(0);
  });
});

describe("match modes", () => {
  it("drops pending prediction controls when a player is eliminated", () => {
    const room = new Room("LIFE", { ...quickOptions(), mode: "lives" }); room.join(); room.step();
    const predictor = new Predictor(0, room.options); predictor.onSnapshot(room.snapshot());
    predictor.local(NO_INPUT, 0, 0); expect(predictor.pending).toHaveLength(1);
    room.match.lives[0] = 0; room.step(); predictor.onSnapshot(room.snapshot());
    expect(predictor.pending).toHaveLength(0);
  });

  it("finishes Deathmatch at its kill target and allows only the current owner to restart", () => {
    const room = new Room("PART", { ...quickOptions(), scoreLimit: 5 }); room.join(); room.join(); room.step();
    room.sim.kos[1] = 5; room.step();
    expect(room.match.phase).toBe("finished"); expect(room.match.winners).toEqual([1]);
    expect(room.join()).toBe(-1); // Joining cannot claim a winning bot's identity after the result.
    const time = room.sim.time; room.step(); expect(room.sim.time).toBe(time);
    room.restart(1); expect(room.match.phase).toBe("finished");
    room.restart(0); expect(room.match.phase).toBe("waiting"); expect(room.sim.kos).toEqual(Array(8).fill(0));
    expect(room.bots.filter(Boolean)).toHaveLength(6);
  });

  it("counts self-inflicted ring-outs as lost lives and eliminates without respawning", () => {
    const room = new Room("LIFE", { level: "island", capacity: 2, botFill: false, mode: "lives", lives: 1 });
    room.join(); room.join(); room.step();
    room.sim.players[1].pos = { x: 50, y: -2, z: 0 };
    room.step();
    expect(room.match.lives).toEqual([1, 0]);
    expect(room.match.phase).toBe("finished"); expect(room.match.winners).toEqual([0]);
  });

  it("waits for human seats when bot fill is off", () => {
    const room = new Room("WAIT", { capacity: 4, botFill: false }); room.join(); room.join(); room.step();
    expect(room.match.phase).toBe("waiting"); expect(room.active.filter(Boolean)).toHaveLength(2);
    room.sim.kos[0] = 3; room.sim.players[0].hp = 10;
    room.join(); room.join(); room.step(); expect(room.match.phase).toBe("playing");
    expect(room.sim.kos).toEqual([0, 0, 0, 0]); expect(room.sim.players[0].hp).toBe(TUNING.player.hp);
  });

  it("ends Timed matches at the buzzer and includes tied winners", () => {
    const room = new Room("TIME", { level: "duel", capacity: 2, botFill: false, mode: "timed", minutes: 1 });
    room.join(); room.join(); room.step(); room.sim.kos[0] = room.sim.kos[1] = 3;
    for (let i = 0; i < Math.ceil(60 / TUNING.step) + 2; i++) room.step();
    expect(room.match.phase).toBe("finished"); expect(room.match.winners).toEqual([0, 1]);
  });

  it("keeps Ring Out HP intact under sniper fire while preserving knockback and credited water KOs", () => {
    const room = new Room("RING", { level: "island-party", capacity: 2, botFill: false, mode: "ringout", scoreLimit: 1 });
    room.join(); room.join(); room.step();
    const shooter = room.sim.players[0], victim = room.sim.players[1];
    shooter.pos = { x: 18, y: 0, z: 18 }; shooter.yaw = 0; shooter.pitch = -0.045;
    shooter.weapon = "sniper"; shooter.owned.push("sniper");
    victim.pos = { x: 18, y: 0, z: 8 };
    room.push(0, [{ ...NO_INPUT, seq: 1, dYaw: 0, dPitch: 0, firePressed: true, aiming: true }]);
    room.step();
    expect(room.snapshot().events.some((e) => e.type === "pvpHit")).toBe(true);
    expect(victim.hp).toBe(TUNING.player.hp); expect(victim.dead).toBe(0);
    expect(Math.hypot(victim.vel.x, victim.vel.y, victim.vel.z)).toBeGreaterThan(0);
    victim.pos.y = -2; room.step();
    expect(room.sim.kos[0]).toBe(1); expect(room.match.winners).toEqual([0]);
  });
});
