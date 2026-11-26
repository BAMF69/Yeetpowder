import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { SCENERY_ART, sceneryBox, type SceneryPlacement } from "../../core/yeet/scenery";
import { Log } from "../../core/log";

/** Per-world ownership: static art cannot leak materials, animations or late loads into another match. */
export class SceneryViews {
  readonly group = new THREE.Group();
  private disposed = false;
  private mixers: THREE.AnimationMixer[] = [];
  private originals: THREE.Object3D[] = [];
  constructor(private readonly placements: readonly SceneryPlacement[]) {}
  async load(noart: boolean): Promise<void> {
    const loader = new GLTFLoader();
    const sources = new Map<string, THREE.Object3D>();
    for (const art of new Set(this.placements.map((p) => p.art))) {
      if (noart) break;
      try {
        const gltf = await loader.loadAsync(`assets/models/scenery/vinish/${SCENERY_ART[art].file}.glb`);
        gltf.scene.animations = gltf.animations; this.originals.push(gltf.scene); sources.set(art, gltf.scene);
      } catch (error) { Log.warn("scenery", `${art}: keeping the visible collision fallback (${String(error)})`); }
    }
    if (this.disposed) { this.release(); return; }
    for (const p of this.placements) {
      const source = sources.get(p.art);
      if (source) {
        const model = clone(source), bounds = new THREE.Box3().setFromObject(model), center = bounds.getCenter(new THREE.Vector3());
        const pivot = new THREE.Group();
        model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
        pivot.add(model); pivot.scale.setScalar(p.scale); pivot.rotation.y = p.quarter * Math.PI / 2;
        pivot.position.set(p.pos.x, p.pos.y, p.pos.z); pivot.name = `scenery:${p.art}`;
        pivot.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true; });
        this.group.add(pivot);
        // Retain every original clip. Only idle ambient motion runs; interactive doors stay shut and solid.
        const idle = source.animations.find((a) => a.name === "Idle");
        if (idle && !p.solid) { const mixer = new THREE.AnimationMixer(model); mixer.clipAction(idle).play(); this.mixers.push(mixer); }
      } else if (p.solid) {
        const b = sceneryBox(p), size = new THREE.Vector3(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshStandardMaterial({ color: p.art === "crate" ? "#976843" : "#526971", roughness: 0.9 }));
        mesh.position.set(p.pos.x, p.pos.y + size.y / 2, p.pos.z); mesh.castShadow = mesh.receiveShadow = true;
        mesh.name = `scenery-fallback:${p.art}`; this.group.add(mesh); this.originals.push(mesh);
      }
    }
    Log.info("scenery", `SCENERY_READY count=${this.placements.length} noart=${noart}`);
  }
  update(dt: number): void { this.mixers.forEach((m) => m.update(dt)); }
  dispose(): void { this.disposed = true; this.group.removeFromParent(); this.mixers.forEach((m) => m.stopAllAction()); this.mixers = []; this.release(); }
  private release(): void {
    const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.originals.forEach((root) => root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      geometry.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        materials.add(m); Object.values(m).forEach((v) => { if (v instanceof THREE.Texture) textures.add(v); });
      });
    }));
    geometry.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose()); this.originals = [];
  }
}
