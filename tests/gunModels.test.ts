// ---------------------------------------------------------------------------
// gunModels.test.ts
// Purpose : Every held weapon model stays inside the GDD's triangle budget (300-2,500 per held weapon) and builds
//           without a browser; the Gatling keeps its spinning barrels.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildWeapon, triangleCount, type ModelKit } from "../src/game/yeet/gunModels";
import type { WeaponId } from "../src/core/yeet/tuning";

const IDS: WeaponId[] = ["pistol", "shotgun", "sniper", "copter", "reaper", "sakura"];
const kit: ModelKit = { mat: () => new THREE.MeshBasicMaterial(), geo: (g) => g };

describe("gun models", () => {
  for (const id of IDS) {
    it(`${id} is 300-2,500 triangles`, () => {
      const n = triangleCount(buildWeapon(id, kit).group);
      expect(n).toBeGreaterThanOrEqual(300);
      expect(n).toBeLessThanOrEqual(2500);
    });
  }

  it("the Gatling has six spinning barrels", () => {
    const m = buildWeapon("copter", kit);
    expect(m.spinner).toBeDefined();
    expect(m.spinner!.children.length).toBeGreaterThanOrEqual(6);
  });
});
