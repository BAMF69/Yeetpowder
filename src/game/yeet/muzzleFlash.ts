// Pink Vinish front-view flashes, camera-facing in first and third person.
// Play one four-frame burst per shot; the source sheet is a rapid-fire loop.
import * as THREE from "three";
import type { MaterialBank } from "./materials";
import { VinishFlipbook, animationFrame } from "./vinishVfx";

export const FLASH_COLOURS = { outer: "#ff3fa4", core: "#ffd6ec" };

export function buildMuzzleFlash(
  _bank: MaterialBank,
  opts: { crossed?: boolean; overlay?: boolean } = {},
): { group: THREE.Group; materials: THREE.Material[]; update: (age: number) => void } {
  const group = new THREE.Group();
  const flipbook = new VinishFlipbook("muzzle", opts.overlay);
  const sprite = new THREE.Sprite(flipbook.material);
  sprite.scale.setScalar(0.24);
  sprite.renderOrder = opts.overlay ? 1001 : 5;
  group.add(sprite);
  group.visible = false;
  return { group, materials: [flipbook.material], update: (age) => {
    flipbook.frame(animationFrame(age, 0.05, 4));
    flipbook.material.rotation = group.rotation.z;
  } };
}
