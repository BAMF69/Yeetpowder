import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { levelById } from "../src/core/yeet/levels";
import { sceneryBoxes, SCENERY_ART } from "../src/core/yeet/scenery";
import { NO_INPUT, YeetSim } from "../src/core/yeet/sim";
import { TUNING } from "../src/core/yeet/tuning";

describe("reviewed scenery and playable routes", () => {
  it.each(["industrial", "industrial-party", "junkyard", "junkyard-party", "island", "island-party"])("keeps spawns and supplies clear in %s", (id) => {
    const level = levelById(id), solids = level.scenery!.flatMap(sceneryBoxes);
    expect(level.scenery!.length).toBeGreaterThan(0);
    for (const p of [...level.spawns!, ...level.pickups.map((p) => p.pos)]) {
      expect(solids.some((b) => b.min.y < p.y + 1.7 && b.max.y > p.y + 0.05 &&
        b.min.x < p.x + 0.4 && b.max.x > p.x - 0.4 && b.min.z < p.z + 0.4 && b.max.z > p.z - 0.4)).toBe(false);
    }
  });
  it("leaves the warehouse doorways and island launch surfaces free of scenery collision", () => {
    for (const p of levelById("industrial").scenery!) for (const b of sceneryBoxes(p)) expect(b.min.x < 1.5 && b.max.x > -1.5 && b.min.z < 4 && b.max.z > -4).toBe(false);
    for (const p of levelById("industrial-party").scenery!) for (const b of sceneryBoxes(p))
      for (const z of [-22, 0, 22]) expect(b.min.x < 1.5 && b.max.x > -1.5 && b.min.z < z + 5 && b.max.z > z - 5).toBe(false);
    // nothing solid in the water near the beach: the sea stacks (2026-11-27 perches) stand far out, > 30 m from the sand
    for (const id of ["island", "island-party"]) for (const p of levelById(id).scenery!) for (const b of sceneryBoxes(p))
      if (b.min.y < 0) { expect(p.art).toBe("seaStack"); expect(Math.min(Math.abs(b.min.x), Math.abs(b.max.x), Math.abs(b.min.z), Math.abs(b.max.z)) > 20 || Math.hypot(p.pos.x, p.pos.z) > 40).toBe(true); }
  });
  it("lets a player jump onto the junkyard crate step and launch above the crusher", () => {
    const sim = new YeetSim(TUNING, levelById("junkyard")); sim.dummies.length = 0;
    sim.player.pos = { x: -3.12, y: 0, z: 3.6 }; sim.player.yaw = 0;
    for (let i = 0; i < 90 && sim.player.pos.z > 2.9; i++) sim.step({ ...NO_INPUT, moveZ: 1 });
    let landed = false;
    for (let i = 0; i < 150; i++) {
      sim.step({ ...NO_INPUT, moveZ: 1, jump: i === 0 });
      if (sim.player.onGround && sim.player.pos.y > 1) { landed = true; break; }
    }
    expect(landed).toBe(true);
    sim.player.weapon = "shotgun"; sim.player.pitch = -1.5;
    sim.step({ ...NO_INPUT, firePressed: true });
    let top = 0; for (let i = 0; i < 120; i++) { sim.step(NO_INPUT); top = Math.max(top, sim.player.pos.y); }
    expect(top).toBeGreaterThan(3);
  });
  it("ships every catalogued model with verified provenance: vinish originals byte-for-byte, community remeshes credited", () => {
    const manifest = JSON.parse(readFileSync("docs/licenses/scenery-sources.json", "utf8"));
    expect(manifest.assets).toHaveLength(Object.keys(SCENERY_ART).length);
    const files = new Set(Object.values(SCENERY_ART).map((a) => `public/assets/models/scenery/${a.file}.glb`));
    for (const a of manifest.assets) {
      expect(files.has(a.runtimeFile), a.runtimeFile).toBe(true);
      const data = readFileSync(a.runtimeFile), source = readFileSync(a.sourceFile);
      expect(createHash("sha256").update(data).digest("hex")).toBe(a.sha256);
      const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
      expect(gltf.asset.copyright).toBe(a.credit);
      if (a.runtimeFile.includes("/vinish/")) {
        expect(data.equals(source)).toBe(true); expect(gltf.asset.extras.license).toBe("CC BY 4.0");
      } else {
        expect(createHash("sha256").update(source).digest("hex")).toBe(a.sourceSha256);
        expect(["CC0 1.0", "CC BY 4.0"]).toContain(a.license); expect(a.remeshTask).toMatch(/^[0-9a-f-]{36}$/);
        expect(a.bytes).toBeLessThan(a.sourceBytes);
      }
      if (a.title === "Crab") expect(gltf.animations.map((c: { name: string }) => c.name)).toContain("Idle");
    }
  });
  it("keeps the accepted preview meshes, nodes, anchors and source metadata while reducing texture payloads", () => {
    const previews = JSON.parse(readFileSync("docs/licenses/art-preview-sources.json", "utf8"));
    expect(previews).toHaveLength(10);
    const gltf = (file: string) => { const b = readFileSync(file); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()); };
    for (const row of previews) {
      const before = gltf(row.source), after = gltf(row.preview);
      for (const field of ["meshes", "nodes", "accessors", "skins", "animations", "asset", "materials"]) expect(after[field]).toEqual(before[field]);
      expect(row.previewBytes).toBeLessThan(row.sourceBytes); expect(row.releaseEnabled).toBe(false);
    }
  });
});
