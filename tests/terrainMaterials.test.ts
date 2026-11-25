import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { expect, it } from "vitest";
import { TERRAIN, terrainMaterial, disposeTerrainTextures } from "../src/game/yeet/terrainMaterials";

it("uses repeat wrapping, sRGB colour and linear OpenGL normal/roughness maps", () => {
  for (const kind of Object.keys(TERRAIN) as (keyof typeof TERRAIN)[]) {
    const mat = terrainMaterial(kind);
    expect(mat.map!.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(mat.normalMap!.colorSpace).toBe(THREE.NoColorSpace);
    expect(mat.roughnessMap!.colorSpace).toBe(THREE.NoColorSpace);
    for (const map of [mat.map!, mat.normalMap!, mat.roughnessMap!]) {
      expect([map.wrapS, map.wrapT]).toEqual([THREE.RepeatWrapping, THREE.RepeatWrapping]);
    }
    mat.dispose();
  }
  disposeTerrainTextures();
});

it("ships all fifteen optimised maps with source provenance and intact checksums", () => {
  const assets = JSON.parse(readFileSync("docs/licenses/terrain-sources.json", "utf8")) as {
    license: string; maps: Record<string, { file: string; shipped_sha256: string; size: number }>;
  }[];
  expect(assets).toHaveLength(5);
  for (const asset of assets) {
    expect(asset.license).toBe("CC0-1.0");
    expect(Object.keys(asset.maps).sort()).toEqual(["color", "normal", "roughness"]);
    for (const map of Object.values(asset.maps)) {
      const bytes = readFileSync(`public/assets/textures/terrain/${map.file}`);
      expect(map.size).toBe(512);
      expect(bytes.subarray(0, 2)).toEqual(Buffer.from([255, 216]));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(map.shipped_sha256);
    }
  }
});
