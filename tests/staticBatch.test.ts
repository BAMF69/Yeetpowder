import * as THREE from "three";
import { expect, it } from "vitest";
import { batchStaticMeshes } from "../src/game/yeet/staticBatch";

it("reduces static draw calls while preserving translated geometry and shadow state", () => {
  const root = new THREE.Group(); root.position.x = 40;
  const material = new THREE.MeshStandardMaterial();
  const original = new THREE.BoxGeometry(2, 2, 2);
  for (const x of [-5, 5]) {
    const nested = new THREE.Group(); nested.position.set(x, 3, 0);
    const mesh = new THREE.Mesh(original, material); mesh.castShadow = true;
    nested.add(mesh); root.add(nested);
  }
  const merged = batchStaticMeshes(root);
  expect(root.children).toHaveLength(1);
  const mesh = root.children[0] as THREE.Mesh;
  expect(mesh.castShadow).toBe(true);
  expect(mesh.material).toBe(material);
  merged[0].computeBoundingBox();
  expect(merged[0].boundingBox!.min.toArray()).toEqual([-6, 2, -1]);
  expect(merged[0].boundingBox!.max.toArray()).toEqual([6, 4, 1]);
  merged.forEach((g) => g.dispose()); original.dispose(); material.dispose();
});
