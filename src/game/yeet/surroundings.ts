// ---------------------------------------------------------------------------
// surroundings.ts
// Purpose : The ground beyond an outdoor level's edge (Elaina, 2026-11-27: flying the Gatling Copter high showed an
//           empty void past the map). A wide textured plane just under the floor, fading into the haze, so a
//           high view always looks down on land. Shark Island needs none: its sea already runs to the horizon.
// Usage   : const s = buildSurroundings(level); scene.add(s.group); ... s.dispose()
// Notes   : Visual only, never collides (the level's own hidden bounds still stop you). Sits SINK m below the
//           floor top, so the level's floor always draws over it (no z-fighting). Uses the CC0 Poly Haven maps
//           already loaded for the level (terrainMaterials.ts), with world-space UVs at their usual tile size.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import type { Level } from "../../core/yeet/levels";
import { TERRAIN, terrainMaterial, type TerrainKind } from "./terrainMaterials";

/** Plane size (m; wide enough that the haze, pushed out with height by hazeFor, hides its edge) and how far under the floor top it lies. */
export const SURROUNDINGS = { size: 4000, sink: 0.04 } as const;
/** Which surface surrounds each level family, and its tint (dusty yard asphalt; junkyard dirt from the sand maps). */
const LOOK: { prefix: string; kind: TerrainKind; tint: string }[] = [
  { prefix: "industrial", kind: "asphalt", tint: "#d6d6d2" },
  { prefix: "junkyard", kind: "sand", tint: "#9c7f62" },
  { prefix: "coliseum", kind: "sand", tint: "#c9b48f" },
];

/**
 * Outdoor haze for a camera `height` m above the floor: the usual 70-260 m on the ground, pushed out as you climb
 * so the Gatling Copter looks down on the yard and the land round it instead of a grey wall (camera far follows).
 */
export function hazeFor(height: number): { near: number; far: number } {
  const h = Math.max(0, height - 10);
  return { near: 70 + h * 1.6, far: 260 + h * 4 };
}

export function surroundingsLook(level: Pick<Level, "id" | "outdoor" | "water">): { kind: TerrainKind; tint: string } | null {
  if (!level.outdoor || level.water) return null;
  return LOOK.find((l) => level.id.startsWith(l.prefix)) ?? { kind: "sand", tint: "#a89474" };
}

export function buildSurroundings(level: Pick<Level, "id" | "outdoor" | "water">): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  group.name = "surroundings";
  const look = surroundingsLook(level);
  if (!look) return { group, dispose: () => {} };
  const geometry = new THREE.PlaneGeometry(SURROUNDINGS.size, SURROUNDINGS.size);
  const uv = geometry.getAttribute("uv");
  const repeats = SURROUNDINGS.size / TERRAIN[look.kind].tile;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * repeats, uv.getY(i) * repeats);
  const material = terrainMaterial(look.kind, look.tint);
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -SURROUNDINGS.sink;
  ground.receiveShadow = false;
  ground.name = "surroundings:ground";
  group.add(ground);
  return { group, dispose: () => { group.removeFromParent(); geometry.dispose(); material.dispose(); } };
}
