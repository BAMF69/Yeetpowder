// ---------------------------------------------------------------------------
// projectiles.test.ts
// Purpose : The Rocket Launcher, Grenades and the Kaboomerax (Elaina, 2026-11-24): rockets fly straight and blow up
//           on what they hit, a rocket at your feet is a rocket jump that hurts only a little, grenades arc, bounce
//           and go off on their fuse (or on touching someone), the axe's rocket throws you FORWARD, its slash throws
//           a grenade behind you and flips you in the air, and a rocket knockout scores for whoever fired it.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { room } from "../src/core/yeet/arena";
import type { Level } from "../src/core/yeet/levels";
import { NO_INPUT, YeetSim, type YeetEvent, type YeetInput } from "../src/core/yeet/sim";
import { TUNING, type WeaponId } from "../src/core/yeet/tuning";
import { aimDir, vec } from "../src/core/yeet/vec";

/** A 40 x 40 m room, the player at (0, 0, 10) looking down -Z, holding `weapon`; dummies where a test puts them. */
function sim(weapon: WeaponId, dummies: { x: number; y: number; z: number }[] = [], players = 1): YeetSim {
  const level: Level = {
    id: "sandbox", name: "Test", arena: { boxes: room(20), dummySpawns: dummies }, spawn: vec(0, 0, 10), spawnYaw: 0,
    spawns: [vec(0, 0, 10), vec(0, 0, -10)], spawnYaws: [0, Math.PI],
    startWeapons: [weapon], pickups: [], dummiesFight: false, dummyRespawn: 3, seed: 1,
  };
  const s = new YeetSim(structuredClone(TUNING), level, players);
  for (let i = 0; i < 20; i++) s.step(players > 1 ? [NO_INPUT, NO_INPUT] : NO_INPUT);
  return s;
}
const run = (s: YeetSim, seconds: number, first: Partial<YeetInput> = {}): YeetEvent[] => {
  const ev: YeetEvent[] = [];
  for (let i = 0; i < Math.round(seconds / s.t.step); i++) ev.push(...s.step({ ...NO_INPUT, ...(i === 0 ? first : {}) }));
  return ev;
};

describe("Rocket Launcher", () => {
  it("a rocket flies straight and blows up on the far wall", () => {
    const s = sim("rocket");
    const ev = run(s, 1.5, { firePressed: true });
    const b = ev.find((e) => e.type === "blast");
    expect(b).toMatchObject({ kind: "rocket" });
    if (b?.type === "blast") expect(b.at.z).toBeLessThan(-19); // the north wall is at z -20
    expect(s.projectiles.length).toBe(0);
  });

  it("a rocket on a dummy hurts it and knocks it away", () => {
    const s = sim("rocket", [vec(0, 0, 2)]);
    const ev = run(s, 1, { firePressed: true });
    expect(ev.some((e) => e.type === "hit" && e.dummy === 0)).toBe(true);
    expect(s.dummies[0].vel.z).toBeLessThan(-2); // pushed on, away from you
  });

  it("a rocket at your feet is a rocket jump: launched high, hurt a little", () => {
    const s = sim("rocket");
    s.player.pitch = -1.45;
    run(s, 0.35, { firePressed: true });
    expect(s.player.vel.y > 6 || s.player.pos.y > 1.5).toBe(true);
    const lost = TUNING.player.hp - s.player.hp;
    expect(lost).toBeGreaterThan(0);
    expect(lost).toBeLessThanOrEqual(TUNING.projectile.rocket.blast.damage * TUNING.projectile.rocket.self.damage + 1e-6);
  });

  it("a rocket knockout scores for whoever fired it", () => {
    const s = sim("rocket", [], 2);
    s.players[1].hp = 10;
    s.players[1].pos = vec(0, 0, 0); // 10 m ahead, in the rocket's path
    const ev: YeetEvent[] = [];
    for (let i = 0; i < 120; i++) ev.push(...s.step([i === 0 ? { ...NO_INPUT, firePressed: true } : NO_INPUT, NO_INPUT]));
    expect(ev.some((e) => e.type === "pvpDown" && e.by === 0 && e.target === 1)).toBe(true);
    expect(s.kos[0]).toBe(1);
  });
});

describe("Grenades", () => {
  it("a grenade arcs up, bounces, and goes off on its fuse", () => {
    const s = sim("grenade");
    const ev: YeetEvent[] = [];
    let top = 0;
    for (let i = 0; i < Math.round((TUNING.projectile.grenade.fuse + 0.2) / s.t.step); i++) {
      ev.push(...s.step({ ...NO_INPUT, firePressed: i === 0 }));
      if (s.projectiles[0]) top = Math.max(top, s.projectiles[0].pos.y);
    }
    expect(top).toBeGreaterThan(TUNING.player.eyeHeight + 0.2); // it went up first
    expect(ev.some((e) => e.type === "bounce")).toBe(true);
    expect(ev.find((e) => e.type === "blast")).toMatchObject({ kind: "grenade" });
  });

  it("a grenade touching someone goes off at once, before its fuse", () => {
    const f = aimDir(0, 0);
    // about 7 m ahead the arc comes down through body height (closer, it sails over their head)
    const s = sim("grenade", [vec(f.x * 7.3, 0, 10 + f.z * 7.3)]);
    const ev = run(s, 0.6, { firePressed: true });
    expect(ev.some((e) => e.type === "blast")).toBe(true);
    expect(ev.some((e) => e.type === "hit" && e.dummy === 0)).toBe(true);
  });
});

describe("Kaboomerax", () => {
  it("hip fire sends the rocket into your feet and launches you up", () => {
    const s = sim("axe");
    s.step({ ...NO_INPUT, firePressed: true });
    expect(s.player.vel.y).toBeGreaterThan(TUNING.axe.hipRecoil - 1);
    expect(Math.hypot(s.player.vel.x, s.player.vel.z)).toBeLessThan(0.5); // straight up, no shove
    const ev = run(s, 0.3);
    expect(ev.some((e) => e.type === "blast")).toBe(true); // it went off at your feet
    expect(s.player.pos.y).toBeGreaterThan(1);
  });

  it("aimed fire is a bazooka: the rocket goes forward and you are thrown back like the Boomstick", () => {
    const s = sim("axe");
    s.step({ ...NO_INPUT, firePressed: true, aiming: true });
    expect(s.projectiles[0].vel.z).toBeLessThan(0); // forward
    expect(s.player.vel.z).toBeGreaterThan(5); // thrown back (+Z)
  });

  it("a plain slash is just a cleave: no grenade, no flip", () => {
    const s = sim("axe");
    const ev = s.step({ ...NO_INPUT, slash: true, slashHeld: true });
    expect(ev.find((e) => e.type === "slash")).toMatchObject({ weapon: "axe" });
    expect(s.projectiles.length).toBe(0);
    expect(ev.some((e) => e.type === "flip")).toBe(false);
  });

  it("F held + Fire is the grenade slash: a forward leap in a front flip, a grenade out behind you, no rocket", () => {
    const s = sim("axe");
    const ev = s.step({ ...NO_INPUT, slashHeld: true, firePressed: true });
    expect(ev.some((e) => e.type === "grenadeSlash")).toBe(true);
    expect(ev.find((e) => e.type === "flip")).toMatchObject({ kind: "frontflip" });
    expect(ev.some((e) => e.type === "fire")).toBe(false); // no rocket
    expect(s.projectiles.length).toBe(1);
    expect(s.projectiles[0]).toMatchObject({ kind: "grenade" });
    expect(s.projectiles[0].vel.z).toBeGreaterThan(0); // behind you
    expect(s.player.vel.z).toBeLessThan(-TUNING.axe.leap + 1); // leapt forward
    expect(s.player.vel.y).toBeGreaterThan(TUNING.axe.leapUp - 1);
    expect(s.player.mag.axe).toBe(TUNING.weapons.axe.mag); // it costs no rocket
  });
});

describe("explosive weapons in the air", () => {
  it("a Rocket Launcher shot in mid-air kicks twice as hard as on the ground (like the Pea Pistol)", () => {
    const kick = (air: boolean) => {
      const s = sim("rocket");
      if (air) {
        s.player.pos.y = 6;
        s.player.onGround = false;
      }
      const v0 = s.player.vel.z;
      s.step({ ...NO_INPUT, firePressed: true });
      return s.player.vel.z - v0;
    };
    expect(kick(true)).toBeCloseTo(kick(false) * 2, 1);
    expect(kick(false)).toBeGreaterThan(20); // a Boomstick-size shove
  });
});

describe("magazines and the throw (playtest 2026-11-24)", () => {
  it("throwing a grenade leaves you standing: no push, still on the ground", () => {
    const s = sim("grenade");
    s.step({ ...NO_INPUT, firePressed: true });
    expect(s.player.onGround).toBe(true);
    expect(Math.hypot(s.player.vel.x, s.player.vel.y, s.player.vel.z)).toBeLessThan(0.01);
    expect(s.projectiles[0]).toMatchObject({ kind: "grenade" });
  });

  it("the Rocket Launcher and Grenades reload after every shot", () => {
    for (const w of ["rocket", "grenade"] as const) {
      const s = sim(w);
      const ev = s.step({ ...NO_INPUT, firePressed: true });
      expect(ev.some((e) => e.type === "reload"), w).toBe(true);
      expect(s.player.mag[w]).toBe(0);
    }
  });

  it("the Kaboomerax's grenade launcher holds 4 grenade slashes, then reloads on its own; the rocket is separate", () => {
    const s = sim("axe");
    let slashes = 0;
    for (let i = 0; i < 6; i++) {
      run(s, TUNING.axe.grenadeCooldown + 0.05);
      s.player.pos = vec(0, 0, 10); // back on the floor for the next one
      s.player.vel = vec(0, 0, 0);
      s.player.onGround = true;
      if (s.step({ ...NO_INPUT, slashHeld: true, firePressed: true }).some((e) => e.type === "grenadeSlash")) slashes++;
    }
    expect(slashes).toBe(TUNING.axe.grenadeMag);
    expect(s.player.axeGrenadeReload).toBeGreaterThan(0);
    expect(s.player.mag.axe).toBe(TUNING.weapons.axe.mag); // the rocket untouched
    run(s, TUNING.axe.grenadeReload + 0.1);
    expect(s.player.axeGrenades).toBe(TUNING.axe.grenadeMag);
  });
});
