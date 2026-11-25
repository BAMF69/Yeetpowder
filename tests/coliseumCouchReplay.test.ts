import { describe, expect, it } from "vitest";
import { levelById } from "../src/core/yeet/levels";
import { NO_INPUT, YeetSim } from "../src/core/yeet/sim";
import { TUNING } from "../src/core/yeet/tuning";
import { couchViews, padFrame, type PadState } from "../src/core/yeet/couch";
import { HighlightRecorder, replayFrame } from "../src/net/highlight";
import { Room } from "../src/net/room";
import { roomOptions } from "../src/net/roomOptions";
import { RoomDirectory } from "../src/net/roomDirectory";

describe("open coliseum", () => {
  it("keeps the outside edge of every ring supported around the full circumference", () => {
    const boxes = levelById("coliseum").arena.boxes;
    for (const [radius, height] of [[37.5, 2], [43.5, 4], [49.5, 6]]) for (let i = 0; i < 360; i++) {
      const x = Math.sin(i * Math.PI / 180) * radius, z = Math.cos(i * Math.PI / 180) * radius;
      expect(boxes.some((b) => b.min.x <= x && b.max.x >= x && b.min.z <= z && b.max.z >= z && b.max.y >= height), `ring ${radius}, angle ${i}`).toBe(true);
    }
  });
  it("has a circular footprint, open sky, three walkable rings and eight separated spawns", () => {
    const level = levelById("coliseum");
    expect(level.outdoor).toBe(true); expect(level.arena.boxes.some((b) => b.kind === "ceiling")).toBe(false);
    expect(level.spawns).toHaveLength(8);
    expect(level.arena.boxes.some((b) => b.min.x <= 45 && b.max.x >= 45 && b.min.z <= 45 && b.max.z >= 45)).toBe(false);
    for (const [x, z, height] of [[0, 0, 0], [35, 8, 2], [41, 8, 4], [46, 8, 6]]) {
      const sim = new YeetSim(TUNING, level); sim.player.pos = { x, y: height + 0.2, z };
      for (let i = 0; i < 100; i++) sim.step(NO_INPUT);
      expect(sim.player.onGround).toBe(true); expect(sim.player.pos.y).toBeCloseTo(height);
    }
    const sim = new YeetSim(TUNING, level, 8);
    for (let i = 0; i < 90; i++) sim.step(Array(8).fill(NO_INPUT));
    sim.players.forEach((p, i) => { expect(p.onGround).toBe(true); expect(p.pos).toEqual(level.spawns![i]); });
  });
  it("keeps every pickup on its advertised surface and accepts the map in matchmaking", () => {
    const level = levelById("coliseum");
    for (const pickup of level.pickups) {
      const sim = new YeetSim(TUNING, level); sim.player.pos = { ...pickup.pos, y: pickup.pos.y + 0.2 };
      for (let i = 0; i < 90; i++) sim.step(NO_INPUT);
      expect(sim.player.pos.y, pickup.weapon).toBeCloseTo(pickup.pos.y);
    }
    expect(roomOptions({ level: "coliseum", capacity: 8 }).level).toBe("coliseum");
    const directory = new RoomDirectory(); const room = directory.create({ level: "coliseum", capacity: 8, visibility: "public" }); room.join();
    expect(directory.quick()).toBe(room);
  });
});

describe("couch controls", () => {
  const pad = (buttons: number[], axes = [0, 0, 0, 0]): PadState => ({ axes,
    buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: buttons.includes(i), value: Number(buttons.includes(i)) })) });
  it("isolates pads, debounces presses, keeps triggers held and clears disconnected controls", () => {
    const a = padFrame(pad([0, 7], [1, -1, 0.8, 0]), [], 0.1);
    const b = padFrame(pad([]), [], 0.1);
    expect(a.input).toMatchObject({ jump: true, firePressed: true, fireHeld: true, moveX: 1, moveZ: 1 });
    expect(a.dYaw).toBeLessThan(0); expect(b.input.fireHeld).toBe(false);
    const held = padFrame(pad([0, 7]), Array.from({ length: 16 }, (_, i) => i === 0 || i === 7), 0.1);
    expect(held.input).toMatchObject({ jump: false, firePressed: false, fireHeld: true });
    expect(padFrame(null, [], 0.1).input.fireHeld).toBe(false);
  });
  it("partitions two, three and four players without overlapping views", () => {
    for (const count of [2, 3, 4]) {
      const views = couchViews(count); expect(views).toHaveLength(count);
      for (const a of views) for (const b of views) if (a !== b) {
        expect(Math.min(a.x + a.w, b.x + b.w) <= Math.max(a.x, b.x) || Math.min(a.y + a.h, b.y + b.h) <= Math.max(a.y, b.y)).toBe(true);
      }
    }
  });
});

describe("authoritative Yeet of the match", () => {
  it("selects total three-dimensional speed, ignores inactive/dead players, retains the peak and lead-in", () => {
    const sim = new YeetSim(TUNING, levelById("duel"), 2), recorder = new HighlightRecorder();
    for (let i = 0; i < 70; i++) {
      sim.players[0].vel = { x: i === 30 ? 3 : 1, y: i === 30 ? 4 : 0, z: 0 };
      sim.players[1].vel = { x: 1000, y: 0, z: 0 };
      recorder.record(i / 10, sim.players, [true, false]);
    }
    const clip = recorder.clip()!; expect(clip.slot).toBe(0); expect(clip.speed).toBe(5); expect(clip.peak).toBe(3);
    expect(clip.frames[0].time).toBeLessThanOrEqual(0.2); expect(clip.frames.at(-1)!.time).toBeCloseTo(5, 0);
    expect(clip.frames.some((f) => f.time === 3)).toBe(true);
    const frozen = structuredClone(clip); sim.players[0].pos.x = 999; expect(recorder.clip()).toEqual(frozen);
    sim.players[1].dead = 1; recorder.record(7.1, sim.players, [true, true]); expect(recorder.clip()!.speed).toBe(5);
  });
  it("keeps a bounded clip even when velocity sets a new record every physics step", () => {
    const sim = new YeetSim(TUNING, levelById("duel")), recorder = new HighlightRecorder();
    for (let i = 0; i < 2400; i++) { sim.player.vel.x = i; recorder.record(i / 120, sim.players, [true]); }
    expect(recorder.clip()!.frames.length).toBeLessThan(40);
  });
  it("interpolates the short way around yaw and resets the clip on rematch", () => {
    const room = new Room("TEST", { level: "duel", capacity: 2, botFill: false, scoreLimit: 1 });
    room.join(); room.join(); room.step();
    room.sim.players[0].vel = { x: 10, y: 20, z: 0 }; room.step(); room.sim.kos[0] = 1; room.step();
    const snap = room.snapshot(); expect(snap.replay!.speed).toBeGreaterThan(0); expect(room.snapshot().replay).toBeUndefined();
    expect(room.snapshot(false).replay).toBeTruthy();
    const clip = snap.replay!; const one = clip.frames[0].actors[0]!;
    clip.frames = [{ time: 0, actors: [{ ...one, x: 0, yaw: Math.PI - 0.1 }] }, { time: 1, actors: [{ ...one, x: 10, yaw: -Math.PI + 0.1 }] }];
    expect(replayFrame(clip, 0.5).actors[0]!.x).toBe(5);
    expect(Math.abs(replayFrame(clip, 0.5).actors[0]!.yaw)).toBeCloseTo(Math.PI);
    room.restart(0); room.step(); expect(room.match.phase).toBe("playing"); expect(room.snapshot().replay).toBeUndefined();
  });
});
