// Merge immutable scenery by material/shadow state. Large arenas should not multiply draw calls per car or lamp.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function batchStaticMeshes(root: THREE.Group, targets = [...root.children]): THREE.BufferGeometry[] {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const batches = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; geometries: THREE.BufferGeometry[] }>();
  for (const target of targets) target.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || Array.isArray(obj.material)) return;
    const geometry = obj.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, obj.matrixWorld));
    const schema = Object.keys(geometry.attributes).sort().join(",");
    const key = `${obj.material.uuid}:${obj.castShadow}:${obj.receiveShadow}:${!!geometry.index}:${schema}`;
    let batch = batches.get(key);
    if (!batch) { batch = { material: obj.material, cast: obj.castShadow, receive: obj.receiveShadow, geometries: [] }; batches.set(key, batch); }
    batch.geometries.push(geometry);
  });
  const merged: THREE.BufferGeometry[] = [];
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.geometries);
    if (!geometry) throw new Error("Static scenery geometry could not be batched");
    for (const part of batch.geometries) part.dispose();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, batch.material);
    mesh.castShadow = batch.cast; mesh.receiveShadow = batch.receive;
    root.add(mesh);
    merged.push(geometry);
  }
  root.remove(...targets);
  return merged;
}
