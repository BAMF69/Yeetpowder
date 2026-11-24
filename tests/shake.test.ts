// ---------------------------------------------------------------------------
// shake.test.ts
// Purpose : Shake moves for touch players (src/core/yeet/shake.ts; Elaina 2026-11-24): a real shake is found and
//           a tilt or a bump is not; each gun's move is planned from the shake's direction; and played through the
//           real sim each move does what it says (a cartwheel the way you shook, the big backflip on a down shake,
//           the YEETREAP when an enemy is in hook range, the Sakura's dash ULTRASLASH). Also the touch Gatling's
//           bullet bend (hits for thumbs, the aim left alone).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { sandboxLevel } from "../src/core/yeet/levels";
import { deviceToScreen, planShakeMove, ShakeDetector, ShakeRunner, type ShakeMove } from "../src/core/yeet/shake";
import { NO_INPUT, YeetSim, type YeetEvent } from "../src/core/yeet/sim";
import { TUNING, type WeaponId } from "../src/core/yeet/tuning";
import { aimDir, vec } from "../src/core/yeet/vec";

const S = TUNING.touch.shake;
const newSim = () => new YeetSim(structuredClone(TUNING), sandboxLevel());
const parkDummies = (sim: YeetSim) => sim.dummies.forEach((d, i) => {
  d.pos = vec(-24 + i * 0.9, 0, -24);
  d.spawn = vec(-24 + i * 0.9, 0, -24);
});
const arm = (sim: YeetSim, w: WeaponId) => {
  if (!sim.player.owned.includes(w)) sim.player.owned.push(w);
  sim.step({ ...NO_INPUT, select: TUNING.weaponOrder.indexOf(w) });
  for (let i = 0; i < 30; i++) sim.step(NO_INPUT); // settle on the floor, finish the switch
};

/** Plays a move through the sim as the game does: its controls over no input, its pitch goal applied to the view. */
function play(sim: YeetSim, move: ShakeMove, seconds = 1.5): YeetEvent[] {
  const r = new ShakeRunner();
  r.start(move);
  const ev: YeetEvent[] = [];
  for (let i = 0; i < Math.round(seconds / sim.t.step); i++) {
    const goal = r.look();
    if (goal?.kind === "pitch") sim.player.pitch = goal.pitch;
    const over = r.step(sim.t.step, sim.player) ?? {};
    ev.push(...sim.step({ ...NO_INPUT, ...over }));
  }
  return ev;
}

describe("shake detector", () => {
  /** Feeds samples 1/60 s apart. */
  const feed = (det: ShakeDetector, samples: Array<[number, number]>, t0 = 0) =>
    samples.map(([x, y], i) => det.feed(x, y, t0 + i / 60)).filter(Boolean);

  it("a jolt to the left, then the hand stopping it, is a left shake", () => {
    expect(feed(new ShakeDetector(S), [[0, 0], [-8, 1], [-18, 2], [-6, 0], [9, 0], [12, -1], [2, 0]])).toEqual(["left"]);
  });

  it("an up-down shake is up or down by its first jolt", () => {
    expect(feed(new ShakeDetector(S), [[0, 16], [1, 3], [0, -10]])).toEqual(["up"]);
    expect(feed(new ShakeDetector(S), [[1, -16], [0, 2], [-1, 9]])).toEqual(["down"]);
  });

  it("a slow tilt and a bump with no stop are not shakes", () => {
    const tilt: Array<[number, number]> = Array.from({ length: 60 }, (_, i) => [Math.sin(i / 20) * 4, 0]);
    expect(feed(new ShakeDetector(S), tilt)).toEqual([]);
    expect(feed(new ShakeDetector(S), [[18, 0], [3, 0], [1, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [-10, 0]])).toEqual([]);
  });

  it("a diagonal jolt (no axis clearly ahead) is not a shake", () => {
    expect(feed(new ShakeDetector(S), [[15, 14], [-12, -12]])).toEqual([]);
  });

  it("waits out the cooldown before the next shake; Shake strength makes it easier", () => {
    const det = new ShakeDetector(S);
    expect(feed(det, [[18, 0], [-12, 0], [18, 0], [-12, 0]])).toEqual(["right"]);
    const soft = new ShakeDetector(S);
    soft.strength = 2;
    expect(feed(soft, [[8, 0], [-5, 0]])).toEqual(["right"]);
    expect(feed(new ShakeDetector(S), [[8, 0], [-5, 0]])).toEqual([]);
  });

  it("maps the device's axes to the screen's for each way it is held", () => {
    expect(deviceToScreen({ x: 1, y: 0 }, 0)).toEqual({ x: 1, y: 0 });
    expect(deviceToScreen({ x: 1, y: 0 }, 90)).toEqual({ x: -0, y: 1 }); // right side up: the device's +x is screen up
    expect(deviceToScreen({ x: 0, y: 1 }, 90)).toEqual({ x: -1, y: 0 });
    expect(deviceToScreen({ x: 0, y: 1 }, 270)).toEqual({ x: 1, y: -0 });
  });
});

describe("shake moves (planned)", () => {
  const plan = (w: WeaponId, d: "left" | "right" | "up" | "down", reapInRange = false) => planShakeMove(w, d, { reapInRange }, TUNING);

  it("each gun's moves", () => {
    expect(plan("reaper", "left")?.name).toBe("cartwheel");
    expect(plan("reaper", "up")?.name).toBe("flip-reap");
    expect(plan("reaper", "down")?.name).toBe("backflip-reap");
    expect(plan("reaper", "left", true)?.name).toBe("yeetreap"); // in hook range, any shake reaps
    expect(plan("sakura", "right")?.name).toBe("slash-lunge");
    expect(plan("sakura", "down")?.name).toBe("dash-ultraslash");
    for (const w of ["pistol", "shotgun", "sniper", "copter"] as WeaponId[]) expect(plan(w, "left")).toBeNull();
  });

  it("Reaper flips lock on afterwards; Sakura moves home in from the start", () => {
    expect(plan("reaper", "right")!.lockOn).toBeGreaterThan(0);
    expect(plan("sakura", "left")!.look).toEqual({ kind: "home" });
  });

  it("the runner gives up when the hook never catches (no lock-on)", () => {
    const r = new ShakeRunner();
    r.start(plan("reaper", "up", true)!);
    for (let i = 0; i < 120; i++) r.step(TUNING.step, { hook: -1, stance: false });
    expect(r.active).toBe(false);
    expect(r.locking).toBe(0);
  });
});

describe("shake moves (played in the sim)", () => {
  for (const [dir, side] of [["right", 1], ["left", -1]] as const) {
    it(`Reaper's Kick: a ${dir} shake cartwheels ${dir}`, () => {
      const sim = newSim();
      parkDummies(sim);
      arm(sim, "reaper");
      const ev = play(sim, planShakeMove("reaper", dir, { reapInRange: false }, TUNING)!);
      expect(ev.find((e) => e.type === "flip")).toMatchObject({ kind: "cartwheel", side });
    });
  }

  it("Reaper's Kick: a down shake is the big backflip, then a REAP slash", () => {
    const sim = newSim();
    parkDummies(sim);
    arm(sim, "reaper");
    const ev = play(sim, planShakeMove("reaper", "down", { reapInRange: false }, TUNING)!);
    expect(ev.find((e) => e.type === "flip")).toMatchObject({ kind: "backflip", big: true });
    expect(ev.some((e) => e.type === "slash")).toBe(true);
  });

  it("Reaper's Kick: a shake with an enemy in hook range is a YEETREAP", () => {
    const sim = newSim();
    parkDummies(sim);
    arm(sim, "reaper");
    const f = aimDir(sim.player.yaw, 0);
    sim.dummies[0].pos = vec(sim.player.pos.x + f.x * 2, sim.player.pos.y, sim.player.pos.z + f.z * 2);
    const ev = play(sim, planShakeMove("reaper", "left", { reapInRange: true }, TUNING)!);
    expect(ev.some((e) => e.type === "hook")).toBe(true);
    expect(ev.some((e) => e.type === "yeetreap")).toBe(true);
  });

  it("Six-Shot Sakura: an up/down shake dashes then lets go into the ULTRASLASH", () => {
    const sim = newSim();
    parkDummies(sim);
    arm(sim, "sakura");
    const ev = play(sim, planShakeMove("sakura", "up", { reapInRange: false }, TUNING)!);
    expect(ev.some((e) => e.type === "dash")).toBe(true);
    expect(ev.some((e) => e.type === "ultraslash")).toBe(true);
  });

  it("Six-Shot Sakura: a left/right shake slashes then lunges", () => {
    const sim = newSim();
    parkDummies(sim);
    arm(sim, "sakura");
    const ev = play(sim, planShakeMove("sakura", "right", { reapInRange: false }, TUNING)!);
    expect(ev.some((e) => e.type === "slash")).toBe(true);
    expect(ev.some((e) => e.type === "lunge")).toBe(true);
  });
});

describe("touch Gatling bullet bend", () => {
  it("bends a touch player's bullets onto an enemy just off the crosshair, and leaves the aim alone", () => {
    const hits = (touch: boolean) => {
      const sim = newSim();
      parkDummies(sim);
      arm(sim, "copter");
      const p = sim.player;
      const f = aimDir(p.yaw, 0);
      // 8 m ahead (short of the Sandbox crate at 12 m) and 0.7 m to the side: 5 degrees off, clear of the body,
      // inside the bend cone
      sim.dummies[0].pos = vec(p.pos.x + f.x * 8 - f.z * 0.7, p.pos.y, p.pos.z + f.z * 8 + f.x * 0.7);
      sim.dummies[0].vel = vec(0, 0, 0);
      let n = 0;
      for (let i = 0; i < 30; i++) {
        for (const e of sim.step({ ...NO_INPUT, fireHeld: true, firePressed: i === 0, touch })) if (e.type === "hit") n++;
      }
      return n;
    };
    expect(hits(true)).toBeGreaterThan(0);
    expect(hits(false)).toBe(0);
  });
});
