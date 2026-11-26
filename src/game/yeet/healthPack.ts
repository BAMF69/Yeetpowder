import * as THREE from "three";
import type { MaterialBank } from "./materials";

let preview: THREE.Object3D | null = null;
/** Source art remains development-only until its exact source/license is confirmed. */
export function registerHealthPackPreview(source: THREE.Object3D): void { preview = source; }
export function buildHealthPack(bank: MaterialBank): THREE.Group {
  const group = new THREE.Group();
  if (preview) {
    const art = preview.clone(), bounds = new THREE.Box3().setFromObject(art), center = bounds.getCenter(new THREE.Vector3());
    const fit = 0.3 / Math.max(0.001, bounds.max.y - bounds.min.y);
    art.position.sub(center); const fitGroup = new THREE.Group(); fitGroup.add(art); fitGroup.scale.setScalar(fit); group.add(fitGroup);
  } else {
    const part = (w: number, h: number, d: number, color: string, z = 0) => {
      const mesh = new THREE.Mesh(bank.geo(new THREE.BoxGeometry(w, h, d)), bank.plain(color)); mesh.position.z = z; group.add(mesh);
    };
    part(0.36, 0.26, 0.14, "#137c49"); part(0.06, 0.17, 0.015, "#eaffea", 0.078); part(0.18, 0.06, 0.015, "#eaffea", 0.078);
  }
  return group;
}
