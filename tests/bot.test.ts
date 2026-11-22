// ---------------------------------------------------------------------------
// bot.test.ts
// Purpose : The bots (src/core/yeet/bot.ts) play like players and their difficulties are really different:
//           steering keys and look angles follow the sim's conventions, a helpless bot presses nothing, a bot match
//           replays exactly from its seed, every bot keeps moving, the launch maneuver really travels by recoil,
//           and over many seeded duels hard clearly beats easy and medium beats easy (SOP-14: a gap over seeds,
//           never one seed or an exact count).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { BotBrain, keysFor, lookAngles, type BotSkill } from "../src/core/yeet/bot";
import { duelLevel } from "../src/core/yeet/levels";
import { YeetSim } from "../src/core/yeet/sim";
import { TUNING, type Tuning } from "../src/core/yeet/tuning";

function duel(a: BotSkill, b: BotSkill, seed: number, seconds: number, t: Tuning = TUNING) {
  const sim = new YeetSim(t, duelLevel(), 2);
  const brains = [new BotBrain(t, 0, a, seed), new BotBrain(t, 1, b, seed + 1000)];
  const kos = [0, 0];
  const moved = [0, 0];
  let last = sim.players.map((p) => ({ ...p.pos }));
  for (let s = 0; s < Math.round(seconds / t.step); s++) {
    const outs = brains.map((br) => br.think(sim));
    outs.forEach((o, i) => sim.look(o.dYaw, o.dPitch, i));
    for (const e of sim.step(outs.map((o) => o.input))) if (e.type === "pvpDown") kos[e.by]++;
    sim.players.forEach((p, i) => (moved[i] += Math.hypot(p.pos.x - last[i].x, p.pos.z - last[i].z)));
    last = sim.players.map((p) => ({ ...p.pos }));
  }
  return { kos, moved, sim };
}

describe("bot controls", () => {
  it("keys walk the right way for where the bot faces", () => {
    expect(keysFor(0, -1, 0)).toEqual({ moveX: 0, moveZ: 1 }); // facing -Z, walking -Z: forward
    const right = keysFor(1, 0, 0); // walking +X while facing -Z: strafe right
    expect(right.moveX).toBeCloseTo(1);
    expect(right.moveZ).toBeCloseTo(0);
    const turned = keysFor(0, -1, Math.PI / 2); // facing -X, walking -Z: strafe right
    expect(turned.moveX).toBeCloseTo(1);
  });

  it("look angles match the sim (yaw 0 faces -Z, pitch up is +)", () => {
    const a = lookAngles({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: -1 });
    expect(a.yaw).toBeCloseTo(0);
    expect(a.pitch).toBeCloseTo(Math.PI / 4);
  });

  it("a tumbling or knocked-out bot presses nothing", () => {
    const sim = new YeetSim(TUNING, duelLevel(), 2);
    const brain = new BotBrain(TUNING, 1, "hard", 1);
    sim.players[1].tumbling = 1;
    const out = brain.think(sim);
    expect(out.input.moveX).toBe(0);
    expect(out.input.firePressed).toBe(false);
    expect(brain.debug.state).toBe("recover");
  });
});

describe("bot matches", () => {
  it("replay exactly from their seed", () => {
    const a = duel("medium", "hard", 7, 15);
    const b = duel("medium", "hard", 7, 15);
    expect(a.kos).toEqual(b.kos);
    expect(a.sim.players[0].pos).toEqual(b.sim.players[0].pos);
  });

  it("every difficulty keeps moving (no bot stands stuck)", () => {
    for (const s of ["easy", "medium", "hard"] as BotSkill[]) {
      const r = duel(s, s, 3, 30);
      for (const m of r.moved) expect(m, `${s} moved ${m.toFixed(0)} m in 30 s`).toBeGreaterThan(80);
    }
  });

  it("hard clearly beats easy, and medium beats easy, over 6 seeded minutes", () => {
    let hard = 0, easyVsHard = 0, medium = 0, easyVsMedium = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const h = duel("hard", "easy", seed, 60);
      hard += h.kos[0];
      easyVsHard += h.kos[1];
      const m = duel("medium", "easy", seed, 60);
      medium += m.kos[0];
      easyVsMedium += m.kos[1];
    }
    // measured 35-5 and 11-1 when tuned (2026-11-22); the asserts leave room for tuning changes
    expect(hard).toBeGreaterThanOrEqual(15);
    expect(hard).toBeGreaterThanOrEqual(3 * Math.max(1, easyVsHard));
    expect(medium).toBeGreaterThan(easyVsMedium);
  });

  it("the launch maneuver travels by recoil: Boomstick aimed down and away, then flying at the goal", () => {
    const t: Tuning = structuredClone(TUNING);
    t.bot.skills.medium.launch = 1; // always launch when it can
    t.bot.skills.medium.gatling = true;
    const sim = new YeetSim(t, duelLevel(), 2);
    const brain = new BotBrain(t, 0, "medium", 5); // player 0 heads for the Gatling in the middle (12+ m away)
    sim.players[1].pos = { x: 13, y: 0, z: -13 }; // the other player out of sight in a corner
    let launched = false;
    let peak = 0;
    for (let s = 0; s < 3 * 120; s++) {
      const out = brain.think(sim);
      sim.look(out.dYaw, out.dPitch, 0);
      for (const e of sim.step([out.input, { ...out.input, moveX: 0, moveZ: 0, firePressed: false, fireHeld: false, select: -1 }]))
        if (e.type === "fire" && e.p === 0 && e.weapon === "shotgun") launched = true;
      peak = Math.max(peak, sim.players[0].pos.y);
    }
    expect(launched).toBe(true);
    expect(peak).toBeGreaterThan(1.5); // off the ground by recoil, not a 0.9 m jump
  });
});
