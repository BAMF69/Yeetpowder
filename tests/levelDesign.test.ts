// ---------------------------------------------------------------------------
// levelDesign.test.ts
// Purpose : The 2026-11-26 scenery/level pass, checked as data and in the sim: every spawn and pickup stands on
//           solid ground clear of colliders, scenery colliders do not overlap each other by accident, supplies
//           follow the agreed rules, the designed climbs are walkable with plain jumps, the recoil perches are
//           reachable by recoil, and bots keep moving through every revised layout.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { rayArena, type Box } from "../src/core/yeet/arena";
import { BotBrain } from "../src/core/yeet/bot";
import { levelById, RARE_SPAWN_CLEARANCE, type Level } from "../src/core/yeet/levels";
import { SCENERY_ART, sceneryBoxes, sceneryExtent } from "../src/core/yeet/scenery";
import { NO_INPUT, YeetSim } from "../src/core/yeet/sim";
import { TUNING } from "../src/core/yeet/tuning";
import type { Vec3 } from "../src/core/yeet/vec";

const DESIGNED = ["industrial", "industrial-party", "junkyard", "junkyard-party", "island", "island-party"];
const HW = TUNING.player.halfWidth, H = TUNING.player.height;
const JUMP_PEAK = TUNING.player.jumpSpeed ** 2 / (2 * TUNING.gravity);

/** Boxes a body standing at p (feet) would intersect. */
function blocking(level: Level, p: Vec3, hw = HW): Box[] {
  return level.arena.boxes.filter((b) => b.max.y > p.y + 0.02 && b.min.y < p.y + H &&
    b.min.x < p.x + hw && b.max.x > p.x - hw && b.min.z < p.z + hw && b.max.z > p.z - hw);
}
const supported = (level: Level, p: Vec3) => level.arena.boxes.some((b) => Math.abs(b.max.y - p.y) < 0.03 &&
  p.x >= b.min.x && p.x <= b.max.x && p.z >= b.min.z && p.z <= b.max.z);
const overlapVolume = (a: Box, b: Box) => Math.max(0, Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x)) *
  Math.max(0, Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y)) * Math.max(0, Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z));

describe.each(DESIGNED)("%s layout", (id) => {
  const level = levelById(id);
  it("stands every spawn and pickup on solid ground, clear of every collider", () => {
    for (const [i, p] of (level.spawns ?? [level.spawn]).entries()) {
      expect(supported(level, p), `spawn ${i} ${JSON.stringify(p)} unsupported`).toBe(true);
      expect(blocking(level, p, HW + 0.6).map((b) => b.prop ?? b.kind), `spawn ${i} needs room to move`).toEqual([]);
    }
    for (const k of level.pickups) {
      expect(supported(level, k.pos), `${k.weapon} ${JSON.stringify(k.pos)} unsupported`).toBe(true);
      expect(blocking(level, k.pos).map((b) => b.prop ?? b.kind), `${k.weapon} ${JSON.stringify(k.pos)} blocked`).toEqual([]);
    }
  });

  it("stands every bot waypoint on clear ground", () => {
    for (const p of level.nav ?? []) {
      expect(supported(level, p), `nav ${JSON.stringify(p)} unsupported`).toBe(true);
      expect(blocking(level, p).map((b) => b.prop ?? b.kind), `nav ${JSON.stringify(p)} blocked`).toEqual([]);
    }
  });

  it("keeps scenery colliders from overlapping each other except where one rests on another", () => {
    const placed = level.scenery!.filter((p) => p.solid).map((p) => ({ p, boxes: sceneryBoxes(p) }));
    const structure = level.arena.boxes.filter((b) => !b.prop || b.prop === "hidden" ? b.kind !== "floor" && b.prop !== "hidden" : false);
    const bad: string[] = [];
    placed.forEach((a, i) => {
      for (const b of placed.slice(i + 1)) for (const x of a.boxes) for (const y of b.boxes)
        if (overlapVolume(x, y) > 0.02) bad.push(`${a.p.art}@${a.p.pos.x},${a.p.pos.z} x ${b.p.art}@${b.p.pos.x},${b.p.pos.z}`);
      // Boulders may lean into the island hill: rock against rock reads as one outcrop and forms its stair.
      if (a.p.art !== "boulder") for (const x of a.boxes) for (const s of structure)
        if (overlapVolume(x, s) > 0.02) bad.push(`${a.p.art}@${a.p.pos.x},${a.p.pos.z} x structure ${JSON.stringify(s.min)}`);
    });
    expect(bad).toEqual([]);
  });

  it("keeps all scenery inside the playable floor", () => {
    const floors = level.arena.boxes.filter((b) => b.kind === "floor");
    const lo = { x: Math.min(...floors.map((b) => b.min.x)), z: Math.min(...floors.map((b) => b.min.z)) };
    const hi = { x: Math.max(...floors.map((b) => b.max.x)), z: Math.max(...floors.map((b) => b.max.z)) };
    for (const p of level.scenery!.filter((q) => q.solid)) { // decoration may hang over the water (palm crowns, sea stacks)
      const e = sceneryExtent(p);
      expect(e.min.x >= lo.x - 0.5 && e.max.x <= hi.x + 0.5 && e.min.z >= lo.z - 0.5 && e.max.z <= hi.z + 0.5, `${p.art} at ${p.pos.x},${p.pos.z}`).toBe(true);
    }
  });

  it("follows the supply rules: no shotgun pickups, one grenade, one health pack far from spawns", () => {
    expect(level.pickups.some((p) => p.weapon === "shotgun")).toBe(false);
    expect(level.pickups.filter((p) => p.weapon === "grenade")).toHaveLength(1);
    expect(level.pickups.filter((p) => p.weapon === "health")).toHaveLength(1);
    for (const rare of level.pickups.filter((p) => p.weapon === "health" || p.weapon === "grenade"))
      for (const s of level.spawns!) expect(Math.hypot(rare.pos.x - s.x, rare.pos.z - s.z)).toBeGreaterThan(RARE_SPAWN_CLEARANCE);
  });

  it("uses only reviewed scenery with collider heights a jump either clears or clearly cannot", () => {
    const band: string[] = [];
    for (const p of level.scenery!) {
      expect(SCENERY_ART[p.art]).toBeDefined();
      for (const b of sceneryBoxes(p)) {
        const h = b.max.y - b.min.y;
        // A ground obstacle a jump only just clears (or only just misses) is a pixel-perfect hop: ambiguous.
        if (b.min.y === 0 && h > JUMP_PEAK - 0.17 && h < JUMP_PEAK + 0.1) band.push(`${p.art}@${p.pos.x},${p.pos.z} ${h.toFixed(2)}`);
      }
    }
    expect(band).toEqual([]);
  });
});

/** Walks a path of footholds (yaw set each step), jumping when the next foothold is higher and within reach. */
function climb(id: string, from: Vec3, path: Vec3[], seconds = 8): number {
  const sim = new YeetSim(structuredClone(TUNING), levelById(id));
  sim.dummies.length = 0;
  sim.player.pos = { ...from };
  let top = from.y, leg = 0;
  for (let i = 0; i < Math.round(seconds / TUNING.step) && leg < path.length; i++) {
    const t = path[leg], p = sim.player.pos;
    const d = Math.hypot(t.x - p.x, t.z - p.z);
    if (d < 0.5 && Math.abs(p.y - t.y) < 0.1) { leg++; continue; }
    sim.player.yaw = Math.atan2(-(t.x - p.x), -(t.z - p.z));
    // jump when a riser stands just ahead at shin height and the next foothold is higher (how a person climbs)
    const dir = { x: (t.x - p.x) / d, y: 0, z: (t.z - p.z) / d };
    const riser = rayArena(sim.arena, { x: p.x, y: p.y + 0.3, z: p.z }, dir, HW + 0.45) < HW + 0.45;
    // ...or at the edge of a ledge with a higher foothold across the gap
    const ahead = { x: p.x + dir.x * (HW + 0.3), y: p.y, z: p.z + dir.z * (HW + 0.3) };
    const edge = !sim.arena.boxes.some((b) => Math.abs(b.max.y - p.y) < 0.05 && ahead.x > b.min.x && ahead.x < b.max.x && ahead.z > b.min.z && ahead.z < b.max.z);
    // only once actually running toward it: air control is small, so a sideways jump lands somewhere else
    const v = sim.player.vel, speed = Math.hypot(v.x, v.z), aligned = speed > 3 && (v.x * dir.x + v.z * dir.z) / speed > 0.9;
    sim.step({ ...NO_INPUT, moveZ: 1, jump: sim.player.onGround && t.y > p.y + 0.05 && (riser || edge) && aligned });
    top = Math.max(top, sim.player.onGround ? sim.player.pos.y : top);
  }
  return top;
}

describe("designed climbs need nothing but jumps", () => {
  it("industrial: the concrete stair reaches the catwalk", () => {
    // the stair is open along its south side: hop onto the lowest riser from the hall floor, then climb west
    expect(climb("industrial", { x: -1.45, y: 0, z: -14 }, [{ x: -1.45, y: 0.88, z: -17.4 }, { x: -2.75, y: 1.76, z: -17.6 }, { x: -4.05, y: 2.64, z: -17.8 }, { x: -5.35, y: 3.52, z: -18 }, { x: -8, y: 4.4, z: -18 }])).toBeCloseTo(4.4, 1);
  });
  it("industrial: the crate steps reach the health pack on the mid-yard container", () => {
    expect(climb("industrial", { x: 14.5, y: 0, z: -4.2 }, [{ x: 16.9, y: 0.99, z: -4.2 }, { x: 17.9, y: 1.99, z: -4.2 }, { x: 22.8, y: 2.6, z: -4.2 }])).toBeCloseTo(2.6, 1);
  });
  it("junkyard: the car pile leads onto the two-car walkway", () => {
    const level = levelById("junkyard");
    const walkway = Math.max(...level.arena.boxes.filter((b) => b.prop === "scenery" && b.min.x > -15.6 && b.max.x < -11 && b.min.z > -15 && b.max.z < -13).map((b) => b.max.y));
    // the pile's wide ledge faces west (away from the walkway): ledge, pile top, then across onto the cars
    expect(climb("junkyard", { x: -23.5, y: 0, z: -14 }, [{ x: -20.85, y: 0.886, z: -14 }, { x: -18.5, y: 1.85, z: -14 }, { x: -13.4, y: walkway, z: -14 }])).toBeCloseTo(walkway, 1);
  });
  it("island: the boulder stair reaches the hill top", () => {
    expect(climb("island", { x: 10.5, y: 0, z: -1.6 }, [{ x: 7.6, y: 1.04, z: -1.6 }, { x: 6, y: 1.83, z: -0.2 }, { x: 5.2, y: 1.83, z: 1 }, { x: 2, y: 2.5, z: 1 }])).toBeCloseTo(2.5, 1);
  });
});

/**
 * Recoil perches: from some spot beside the roost, a Boomstick floor shot aimed down and away lands the player on
 * its roof. A small deterministic search over start distance and pitch, so a player has a learnable launch.
 */
function recoilLanding(id: string, roof: Vec3, side: Vec3, roofY: number): boolean {
  // pitch -1.55 drifts ~1.3 m and -1.4 ~10.6 m (apex ~18 m), so the useful launches live in between
  for (const back of [1.5, 2.5, 3.5, 5]) for (let pitch = -1.565; pitch <= -1.4; pitch += 0.015) {
    const sim = new YeetSim(structuredClone(TUNING), levelById(id));
    sim.dummies.length = 0;
    const start = { x: roof.x + side.x * back, y: 0, z: roof.z + side.z * back };
    sim.player.pos = start; sim.player.weapon = "shotgun";
    sim.player.yaw = Math.atan2(-side.x, -side.z); // facing away from the roof (yaw 0 looks down -Z): the push flies toward it
    sim.player.pitch = pitch;
    for (let i = 0; i < 20; i++) sim.step(NO_INPUT);
    sim.step({ ...NO_INPUT, firePressed: true });
    for (let i = 0; i < Math.round(4 / TUNING.step); i++) {
      sim.step(NO_INPUT);
      if (sim.player.onGround && Math.abs(sim.player.pos.y - roofY) < 0.05) return true;
      if (sim.player.onGround && i > 30) break;
    }
  }
  return false;
}

describe("recoil perches are reachable by a Boomstick floor launch", () => {
  it("industrial: the two-high container stack (Six-Shot Sakura)", () => {
    const level = levelById("industrial"), sakura = level.pickups.find((p) => p.weapon === "sakura")!;
    expect(recoilLanding("industrial", sakura.pos, { x: 0, y: 0, z: 1 }, sakura.pos.y)).toBe(true);
  });
  it("junkyard: the four-car tower (Reaper's Kick)", () => {
    const level = levelById("junkyard"), reaper = level.pickups.find((p) => p.weapon === "reaper")!;
    // along the roof's 4.3 m length from the open central lane (east), or across its 1.7 m width from the south
    expect(recoilLanding("junkyard", reaper.pos, { x: 1, y: 0, z: 0 }, reaper.pos.y) || recoilLanding("junkyard", reaper.pos, { x: 0, y: 0, z: 1 }, reaper.pos.y)).toBe(true);
  });
  it("industrial party: the terminal stack (second Spin Doctor)", () => {
    const level = levelById("industrial-party"), sniper = level.pickups.find((p) => p.weapon === "sniper" && p.pos.x > 0)!;
    // from the step-container's side (south) or the open west end of the stack
    expect(recoilLanding("industrial-party", sniper.pos, { x: -1, y: 0, z: 0 }, sniper.pos.y) || recoilLanding("industrial-party", sniper.pos, { x: 0, y: 0, z: 1 }, sniper.pos.y)).toBe(true);
  });
});

describe("bots navigate the revised layouts", () => {
  it.each(DESIGNED)("%s: medium bots keep moving and find each other", (id) => {
    const level = levelById(id), n = level.recommendedPlayers === 8 ? 4 : 2;
    const sim = new YeetSim(structuredClone(TUNING), level, n);
    sim.dummies.length = 0;
    const brains = Array.from({ length: n }, (_, i) => new BotBrain(TUNING, i, "medium", 40 + i));
    const travelled = Array(n).fill(0), stuckSteps = Array(n).fill(0);
    let last = sim.players.map((p) => ({ ...p.pos })), hits = 0;
    for (let s = 0; s < Math.round(60 / TUNING.step); s++) {
      const outs = brains.map((b) => b.think(sim));
      outs.forEach((o, i) => sim.look(o.dYaw, o.dPitch, i));
      for (const e of sim.step(outs.map((o) => o.input))) if (e.type === "pvpHit") hits++;
      sim.players.forEach((p, i) => {
        const d = Math.hypot(p.pos.x - last[i].x, p.pos.z - last[i].z);
        travelled[i] += d;
        stuckSteps[i] = d < 1e-4 && outs[i].input.moveZ !== 0 ? stuckSteps[i] + 1 : 0;
        expect(stuckSteps[i], `bot ${i} pinned against scenery at ${JSON.stringify(p.pos)}`).toBeLessThan(Math.round(6 / TUNING.step));
      });
      last = sim.players.map((p) => ({ ...p.pos }));
    }
    travelled.forEach((d, i) => expect(d, `bot ${i} travelled`).toBeGreaterThan(25));
    expect(hits).toBeGreaterThan(0);
  });
});
