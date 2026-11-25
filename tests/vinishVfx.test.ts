import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { animationFrame, atlasCell, disposeVinishVfx, VinishFlipbook, VFX_PRESETS } from "../src/game/yeet/vinishVfx";

describe("Vinish combat flipbooks", () => {
  it("addresses rows from the top and holds the final frame instead of looping", () => {
    expect(atlasCell(0)).toEqual([0, 7]);
    expect(atlasCell(8)).toEqual([0, 6]);
    expect(atlasCell(63)).toEqual([7, 0]);
    expect(animationFrame(0.125, 0.25)).toBe(32);
    expect(animationFrame(0.5, 0.25)).toBe(63);
    expect(animationFrame(-1, 0.25)).toBe(0);
    expect(animationFrame(0.025, 0.05, 4)).toBe(2);
  });

  it("shares a sheet but keeps simultaneous animations independent", () => {
    const a = new VinishFlipbook("impact");
    const b = new VinishFlipbook("impact");
    const shader = () => ({ uniforms: {}, fragmentShader: "#include <map_fragment>" });
    const sa = shader(), sb = shader();
    // Only the fragment and uniform fields are used by the compile hook.
    a.material.onBeforeCompile(sa as never, null as never);
    b.material.onBeforeCompile(sb as never, null as never);
    a.frame(8);
    b.frame(63);
    const uniforms = (s: typeof sa) => s.uniforms as Record<string, { value: { toArray(): number[] } }>;
    expect(a.material.map).toBe(b.material.map);
    expect(uniforms(sa).vinishCell.value.toArray()).toEqual([0, 6]);
    expect(uniforms(sb).vinishCell.value.toArray()).toEqual([7, 0]);
    expect(sa.fragmentShader).toContain("sampleFx.a");
    a.dispose(); b.dispose(); disposeVinishVfx();
  });

  it("ships intact source downloads and matching 8x8 RGBA atlases", () => {
    const records = JSON.parse(readFileSync("docs/licenses/vinish-sources.json", "utf8")) as {file: string; sha256: string}[];
    for (const record of records) {
      const bytes = readFileSync(record.file);
      expect(createHash("sha256").update(bytes).digest("hex"), record.file).toBe(record.sha256);
    }
    for (const preset of Object.values(VFX_PRESETS)) {
      expect([preset.columns, preset.rows, preset.frames]).toEqual([8, 8, 64]);
      const png = readFileSync(`public/assets/vfx/vinish/${preset.sheets["1024"]}`);
      expect([png.readUInt32BE(16), png.readUInt32BE(20), png[25]]).toEqual([1024, 1024, 6]);
    }
  });
});
