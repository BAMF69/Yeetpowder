// ---------------------------------------------------------------------------
// muzzleFlash.ts
// Purpose : Yeetpowder's pink muzzle flash (Elaina, 2026-11-22): a hot-pink star with a pale pink core, flat for
//           the first-person gun (it faces the camera) or crossed in three planes for third-person figures, so
//           it reads from any angle. Bright and unlit, so it pops against the subdued scenery (GDD palette).
// Usage   : const f = buildMuzzleFlash(bank, { crossed: true }); mount.add(f); f.visible = true; f.rotation.z = ...
// Notes   : Faces down the barrel (+Z or -Z both fine: double-sided). Drawn after the scene, no depth test in
//           first person so the gun never hides its own flash. Colours are tunables here, in one place.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import type { MaterialBank } from "./materials";

export const FLASH_COLOURS = { outer: "#ff3fa4", core: "#ffd6ec" };
/** Outer star: tip and notch radii (m at scale 1); the core is a smaller star on top. */
const STAR = { tips: 8, outer: 0.07, inner: 0.025, core: 0.55 };

function star(radius: number, notch: number): THREE.Shape {
  const s = new THREE.Shape();
  const n = STAR.tips * 2;
  for (let i = 0; i < n; i++) {
    const r = i % 2 ? notch : radius;
    const a = (i / n) * Math.PI * 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

/** A pink muzzle flash group (hidden until shown). crossed: three planes for figures seen from the side. */
export function buildMuzzleFlash(
  bank: MaterialBank,
  opts: { crossed?: boolean; overlay?: boolean } = {},
): { group: THREE.Group; materials: THREE.Material[] } {
  const group = new THREE.Group();
  const mk = (color: string) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthTest: !opts.overlay, depthWrite: false });
  const outerMat = mk(FLASH_COLOURS.outer);
  const coreMat = mk(FLASH_COLOURS.core);
  const outerGeo = bank.geo(new THREE.ShapeGeometry(star(STAR.outer, STAR.inner)));
  const coreGeo = bank.geo(new THREE.ShapeGeometry(star(STAR.outer * STAR.core, STAR.inner * STAR.core)));
  const planes: THREE.Euler[] = opts.crossed
    ? [new THREE.Euler(0, 0, 0), new THREE.Euler(0, Math.PI / 2, 0), new THREE.Euler(Math.PI / 2, 0, 0)]
    : [new THREE.Euler(0, 0, 0)];
  for (const rot of planes) {
    const outer = new THREE.Mesh(outerGeo, outerMat);
    const core = new THREE.Mesh(coreGeo, coreMat);
    outer.rotation.copy(rot);
    core.rotation.copy(rot);
    core.position.copy(new THREE.Vector3(0, 0, 0.001).applyEuler(rot)); // just in front, so it draws on top
    outer.renderOrder = opts.overlay ? 1001 : 5;
    core.renderOrder = opts.overlay ? 1002 : 6;
    group.add(outer, core);
  }
  group.visible = false;
  return { group, materials: [outerMat, coreMat] };
}
