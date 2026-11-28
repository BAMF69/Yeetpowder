// ---------------------------------------------------------------------------
// operative.test.ts
// Purpose : The third-person operative: its poses (operativePose.ts) do what each moment needs, the two-bone arm
//           solve puts the wrist on its target, and the body stays inside the GDD budget (under 6,000 triangles).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { MaterialBank } from "../src/game/yeet/materials";
import { bodyTriangles, FOREARM, makeOperative, solveArm, UPPER_ARM, type Arm } from "../src/game/yeet/operative";
import { inputFromPlayer, targetPose, type PoseInput } from "../src/game/yeet/operativePose";
import { sandboxLevel } from "../src/core/yeet/levels";
import { YeetSim } from "../src/core/yeet/sim";
import { TUNING } from "../src/core/yeet/tuning";

/** Materials without painted textures (Node has no canvas). */
class PlainBank extends MaterialBank {
  override paint(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial();
  }
}

const base: PoseInput = { weapon: "shotgun", speed: 0, onGround: true, aim: 0, pitch: 0, fling: 0, tumbling: false, dead: false, kneel: 0 };

describe("operative poses", () => {
  it("knocked out drops the gun and frees both arms", () => {
    const t = targetPose({ ...base, dead: true }, 0, 0);
    expect(t.gun).toBeNull();
    expect(t.leftArm).not.toBe("fore");
    expect(t.rightArm).not.toBe("grip");
  });

  it("two-handed guns put the left hand on the foregrip; the pistol and the Sakura leave it free", () => {
    expect(targetPose(base, 0, 0).leftArm).toBe("fore");
    expect(targetPose({ ...base, weapon: "copter" }, 0, 0).leftArm).toBe("fore");
    expect(targetPose({ ...base, weapon: "pistol" }, 0, 0).leftArm).not.toBe("fore");
    expect(targetPose({ ...base, weapon: "sakura" }, 0, 0).leftArm).not.toBe("fore");
  });

  it("a Rocket Launcher or Kaboomerax shot swings the legs up like a Boomstick launch; a Pea Pistol shot does not", () => {
    const fling = (weapon: "rocket" | "axe" | "shotgun" | "pistol") => {
      const sim = new YeetSim(structuredClone(TUNING), sandboxLevel());
      const pl = sim.player;
      pl.weapon = weapon;
      pl.lastShotAt = sim.time - 0.1; // just fired
      return inputFromPlayer(pl, sim.time, 0, 0).fling;
    };
    expect(fling("rocket")).toBeGreaterThan(0.9);
    expect(fling("axe")).toBeGreaterThan(0.9);
    expect(fling("shotgun")).toBeGreaterThan(0.9);
    expect(fling("pistol")).toBe(0);
  });

  it("Reaper's Kick hooking turns the gunblade a quarter turn counter-clockwise (only the scythe)", () => {
    const free = targetPose({ ...base, weapon: "reaper" }, 0, 0).gun!.rot[2];
    expect(targetPose({ ...base, weapon: "reaper", hook: true }, 0, 0).gun!.rot[2]).toBeCloseTo(free - Math.PI / 2);
    expect(targetPose({ ...base, weapon: "sakura", hook: true }, 0, 0).gun!.rot[2]).toBe(targetPose({ ...base, weapon: "sakura" }, 0, 0).gun!.rot[2]);
  });

  it("the Boomstick fling swings both legs up in front", () => {
    const t = targetPose({ ...base, fling: 1, onGround: false }, 0, 0);
    for (const l of t.legs) expect(l.hip[0]).toBeLessThan(-1);
  });

  it("the hero landing kneels: back knee bent flat, front thigh level", () => {
    const t = targetPose({ ...base, kneel: 1 }, 0, 0);
    expect(t.legs[1].knee).toBeGreaterThan(1.5);
    expect(t.legs[0].hip[0]).toBeLessThan(-1.3);
  });

  it("aiming raises the gun toward the shoulder", () => {
    const hip = targetPose(base, 0, 0).gun!;
    const aimed = targetPose({ ...base, aim: 1 }, 0, 0).gun!;
    expect(aimed.pos[1]).toBeGreaterThan(hip.pos[1]);
  });
});

describe("two-bone arm solve", () => {
  it("puts the wrist on a reachable target", () => {
    const torso = new THREE.Group();
    const shoulder = new THREE.Group();
    shoulder.position.set(0.235, 0.47, 0);
    torso.add(shoulder);
    const elbow = new THREE.Group();
    elbow.position.y = -UPPER_ARM;
    shoulder.add(elbow);
    const wrist = new THREE.Group();
    wrist.position.y = -FOREARM - 0.03;
    elbow.add(wrist);
    const arm: Arm = { shoulder, elbow, wrist, side: 1 };
    for (const target of [new THREE.Vector3(0.15, 0.25, 0.35), new THREE.Vector3(0.05, 0.4, 0.4), new THREE.Vector3(0.3, 0.1, 0.2)]) {
      torso.updateMatrixWorld(true);
      solveArm(arm, target, torso);
      torso.updateMatrixWorld(true);
      const got = wrist.getWorldPosition(new THREE.Vector3());
      expect(got.distanceTo(target)).toBeLessThan(0.005);
      const originalElbow = elbow.getWorldPosition(new THREE.Vector3());
      solveArm(arm, target, torso, Math.PI / 2);
      expect(wrist.getWorldPosition(got).distanceTo(target)).toBeLessThan(0.005);
      expect(elbow.getWorldPosition(new THREE.Vector3()).distanceTo(originalElbow)).toBeGreaterThan(0.05);
    }
  });
});

describe("operative budget", () => {
  it("the body is under 6,000 triangles (the held gun has its own budget)", () => {
    const op = makeOperative("#3b4a78", new PlainBank());
    op.setPose({ ...base, weapon: null });
    op.update(1 / 60, new THREE.PerspectiveCamera());
    const n = bodyTriangles(op);
    expect(n).toBeGreaterThan(300);
    expect(n).toBeLessThan(6000);
    op.dispose();
  });
});

describe("reading other players (third-person moves)", () => {
  it("the head and body follow the look: up tilts the head up and leans back, down the other way", () => {
    const up = targetPose({ ...base, pitch: 0.6 }, 0, 0);
    const down = targetPose({ ...base, pitch: -0.6 }, 0, 0);
    expect(up.head).toBeGreaterThan(0.3);
    expect(down.head).toBeLessThan(-0.3);
    expect(up.lean).toBeLessThan(down.lean);
  });

  it("a flip tucks the knees most at its middle and lets them out at the end", () => {
    const mid = targetPose({ ...base, flip: 0.5 }, 0, 0);
    const end = targetPose({ ...base, flip: 0.99 }, 0, 0);
    expect(mid.legs[0].knee).toBeGreaterThan(1.8);
    expect(mid.legs[0].hip[0]).toBeLessThan(-1.2); // thighs up to the chest
    expect(end.legs[0].knee).toBeLessThan(0.5);
  });

  it("a gunblade slash sweeps the blade from the right across to the left", () => {
    const at = (k: number) => targetPose({ ...base, weapon: "reaper", slash: k }, 0, 0);
    expect(at(0.05).gun!.rot[1]).toBeLessThan(-1);
    expect(at(0.95).gun!.rot[1]).toBeGreaterThan(1);
    expect(at(0.95).gun!.pos[0]).toBeGreaterThan(at(0.05).gun!.pos[0]); // right hand side (-X) to left (+X)
    expect(targetPose({ ...base, weapon: "shotgun", slash: 0.5 }, 0, 0).gun!.rot[1]).toBe(0); // guns do not slash
  });
});
