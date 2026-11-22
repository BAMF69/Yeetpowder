// ---------------------------------------------------------------------------
// net.test.ts
// Purpose : The duel netcode without sockets: room slots and input queues, acks, snapshots with tagged events, and
//           client prediction over a simulated laggy link (inputs and snapshots each delayed): a client whose inputs
//           all reach the server ends up exactly where the server puts it (no correction), and a mismatch is
//           corrected.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { NO_INPUT, type YeetInput } from "../src/core/yeet/sim";
import { cleanCode, makeCode, SNAP_EVERY, type NetInput, type Snapshot } from "../src/net/protocol";
import { Predictor } from "../src/net/predict";
import { Room } from "../src/net/room";

const inp = (seq: number, extra: Partial<NetInput> = {}): NetInput => ({ ...NO_INPUT, seq, dYaw: 0, dPitch: 0, ...extra });

describe("protocol helpers", () => {
  it("room codes are 4 letters without I or O, and typed codes are cleaned", () => {
    let k = 0;
    const code = makeCode(() => (k++ * 0.137) % 1);
    expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(cleanCode(" ab-c d9 ")).toBe("ABCD");
  });
});

describe("Room", () => {
  it("has two slots; a third player is turned away; a slot frees when its player leaves", () => {
    const room = new Room("TEST");
    expect(room.join()).toBe(0);
    expect(room.join()).toBe(1);
    expect(room.join()).toBe(-1);
    room.leave(0);
    expect(room.join()).toBe(0);
  });

  it("applies queued inputs in order, acknowledges them, and ignores resends", () => {
    const room = new Room("TEST");
    room.join();
    room.join();
    room.push(0, [inp(1, { moveZ: 1 }), inp(2, { moveZ: 1 })]);
    room.push(0, [inp(2, { moveZ: 1 }), inp(3, { moveZ: 1 })]); // 2 again: ignored
    room.step();
    expect(room.acks[0]).toBe(1);
    room.step();
    room.step();
    expect(room.acks[0]).toBe(3);
    room.step(); // nothing queued: last input repeated, ack unchanged
    expect(room.acks[0]).toBe(3);
  });

  it("a repeated input never fires twice or turns you twice", () => {
    const room = new Room("TEST");
    room.join();
    room.join();
    room.push(0, [inp(1, { firePressed: true })]);
    room.step();
    const shotsBefore = room.snapshot().events.filter((e) => e.type === "fire").length;
    for (let i = 0; i < 30; i++) room.step();
    expect(shotsBefore).toBe(1);
    expect(room.snapshot().events.filter((e) => e.type === "fire").length).toBe(0);
    // a look change applies once (no shot here: a hip shot's twist keeps turning you, which is correct)
    room.push(1, [inp(1, { dYaw: 0.5 })]);
    room.step();
    const yaw = room.sim.players[1].yaw;
    for (let i = 0; i < 30; i++) room.step();
    expect(room.sim.players[1].yaw).toBeCloseTo(yaw, 6);
  });

  it("snapshots carry the state, acks, presence and the events since the last one, tagged by player", () => {
    const room = new Room("TEST");
    room.join();
    room.join();
    room.push(1, [inp(1, { firePressed: true })]);
    room.step();
    const snap = room.snapshot();
    expect(snap.present).toEqual([true, true]);
    expect(snap.state.players.length).toBe(2);
    expect(snap.events.find((e) => e.type === "fire")?.p).toBe(1);
    expect(room.snapshot().events.length).toBe(0); // events go out once
  });
});

describe("Predictor over a laggy link", () => {
  /**
   * Runs `steps` steps of a client (slot 0) talking to a room through a link that delays inputs by `up` steps and
   * snapshots by `down` steps. Player 2 is connected but idle. Returns every correction size and both final positions.
   */
  const simulate = (steps: number, up: number, down: number, script: (i: number) => [YeetInput, number]) => {
    const room = new Room("TEST");
    room.join();
    room.join();
    const pr = new Predictor(0);
    const toServer: Array<[number, NetInput]> = [];
    const toClient: Array<[number, Snapshot]> = [];
    const corrections: number[] = [];
    for (let i = 0; i < steps; i++) {
      const [input, dYaw] = script(i);
      toServer.push([i + up, pr.local(input, dYaw, 0).msg]);
      while (toServer.length && toServer[0][0] <= i) room.push(0, [toServer.shift()![1]]);
      room.step();
      if (room.tick % SNAP_EVERY === 0) toClient.push([i + down, room.snapshot()]);
      while (toClient.length && toClient[0][0] <= i) corrections.push(pr.onSnapshot(toClient.shift()![1]));
    }
    return { corrections, client: pr.sim.players[0], pr };
  };

  it("with every input arriving, prediction is exact: no visible correction, 60 ms each way", () => {
    // run, strafe, jump, turn and shoot: everything that moves you
    const r = simulate(900, 7, 7, (i) => [
      { ...NO_INPUT, moveZ: 1, moveX: Math.floor(i / 100) % 2 ? 1 : -1, jump: i % 120 === 30, firePressed: i % 75 === 10 },
      i % 40 === 0 ? 0.3 : 0,
    ]);
    expect(r.corrections.length).toBeGreaterThan(50);
    expect(Math.max(...r.corrections)).toBeLessThan(1e-6);
    expect(r.pr.pending.length).toBeLessThan(20); // acks keep the replay short
  });

  it("when the server saw something the client did not, the snapshot corrects it", () => {
    const room = new Room("TEST");
    room.join();
    room.join();
    const pr = new Predictor(0);
    for (let i = 0; i < 10; i++) {
      room.push(0, [pr.local({ ...NO_INPUT, moveZ: 1 }, 0, 0).msg]);
      room.step();
    }
    room.sim.players[0].pos.x += 3; // the server knows better (say, a hit the client could not predict)
    for (let i = 0; i < SNAP_EVERY; i++) room.step();
    const err = pr.onSnapshot(room.snapshot());
    expect(err).toBeGreaterThan(2.5);
    expect(pr.sim.players[0].pos.x).toBeCloseTo(room.sim.players[0].pos.x, 6);
  });

  it("old or repeated snapshots are ignored", () => {
    const room = new Room("TEST");
    room.join();
    const pr = new Predictor(0);
    room.step();
    const s1 = room.snapshot();
    room.step();
    const s2 = room.snapshot();
    pr.onSnapshot(s2);
    expect(pr.onSnapshot(s1)).toBe(0);
    expect(pr.lastTick).toBe(s2.tick);
  });
});
