// CC0 Poly Haven terrain maps. World-space UVs in room.ts keep the physical tile size consistent.
// Placeholder Texture objects are filled during world.load(), before the first gameplay frame.
import * as THREE from "three";

export const TERRAIN = {
  sand: { tile: 8, normal: 0.2, metal: 0, tint: "#ffe7b5" },
  rock: { tile: 3, normal: 0.75, metal: 0, tint: "#ffffff" },
  asphalt: { tile: 5, normal: 0.4, metal: 0, tint: "#a4bdd0" },
  corrugated: { tile: 2.8, normal: 0.8, metal: 0.45, tint: "#ffffff" },
  concrete: { tile: 3, normal: 0.5, metal: 0, tint: "#aacbff" },
} as const;
export type TerrainKind = keyof typeof TERRAIN;
type Slot = "color" | "normal" | "roughness";
const textures = new Map<string, THREE.Texture>();
let loading: Promise<void> | undefined;

function map(kind: TerrainKind, slot: Slot): THREE.Texture {
  const key = `${kind}_${slot}`;
  let texture = textures.get(key);
  if (!texture) {
    texture = new THREE.Texture();
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = slot === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = 4;
    textures.set(key, texture);
  }
  return texture;
}

export function terrainMaterial(kind: TerrainKind, tint = "#ffffff"): THREE.MeshStandardMaterial {
  const spec = TERRAIN[kind];
  return new THREE.MeshStandardMaterial({ map: map(kind, "color"), normalMap: map(kind, "normal"),
    roughnessMap: map(kind, "roughness"), normalScale: new THREE.Vector2(spec.normal, spec.normal),
    color: new THREE.Color(spec.tint).multiply(new THREE.Color(tint)), roughness: 1, metalness: spec.metal });
}

export function loadTerrainTextures(): Promise<void> {
  return loading ??= Promise.all((Object.keys(TERRAIN) as TerrainKind[]).flatMap((kind) =>
    (["color", "normal", "roughness"] as Slot[]).map(async (slot) => {
      const texture = map(kind, slot);
      const loaded = await new THREE.TextureLoader().loadAsync(`assets/textures/terrain/${kind}_${slot}.jpg`);
      texture.image = loaded.image;
      texture.needsUpdate = true;
      loaded.dispose();
    }),
  )).then(() => {});
}

export function disposeTerrainTextures(): void {
  for (const texture of textures.values()) texture.dispose();
  textures.clear();
  loading = undefined;
}
