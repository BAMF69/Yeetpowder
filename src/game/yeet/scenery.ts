// ---------------------------------------------------------------------------
// scenery.ts (game)
// Purpose : Draws a level's reviewed scenery models over the colliders in src/core/yeet/scenery.ts: static props
//           as one InstancedMesh per model part (forty crates cost a handful of draw calls), animated props
//           (crabs, turtles, the cement mixer) as their own clones with a mixer, and the explosive trucks and fuel
//           drums as clones that follow hazards.ts (a truck becomes the Burned Out Truck, a drum is crushed and
//           charred). ?noart and failed loads draw each collider as a plain box so play stays readable.
// Usage   : const s = new SceneryViews(level, sim.explosives, props); scene.add(s.group); await s.load(noart);
//           each frame s.update(dt); s.dispose() when the world goes
// Notes   : Per-world ownership: sources are loaded per world and released with it, so materials, animations and
//           late loads never leak into another match. Model files ship from public/assets/models/scenery/ with
//           relative paths (GitHub Pages subfolders). Log channel "scenery": SCENERY_READY reports counts.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5); rewritten for the 2026-11-26 level pass.
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { Box } from "../../core/yeet/arena";
import type { ExplosiveState } from "../../core/yeet/hazards";
import type { Level } from "../../core/yeet/levels";
import { SCENERY_ART, sceneryBoxes, type SceneryId, type SceneryPlacement } from "../../core/yeet/scenery";
import { Log } from "../../core/log";

/** What props.ts offers so its procedural stand-ins step aside once the real models are in. */
export interface ProceduralProps { hide(boxIndices: number[]): void }
/** The model an exploded truck turns into (same length, so the same scale). */
const WRECK_OF: Partial<Record<SceneryId, SceneryId>> = { boxTruck: "burnedTruck" };
/** Ambient clips that may loop: wildlife and the cement mixer's drum (none of them move a collider). */
const AMBIENT: Partial<Record<SceneryId, string>> = { crab: "Idle", turtle: "Swim", cementMixer: "Mix" };
const FALLBACK_TINT: Partial<Record<SceneryId, string>> = {
  boulder: "#8e8577", seaStack: "#8e8577", crate: "#976843", pallet: "#a77b4f", container: "#8b3a2f",
  wreckedCar: "#7a4b3a", charredCar: "#3b3330", van: "#9c9a90", carPile: "#7a4b3a", stylizedPalm: "#8a6a46",
};

interface ExplosiveView { ex: ExplosiveState; box: Box; whole: THREE.Object3D; wreck: THREE.Object3D | null; materials: Map<THREE.Mesh, THREE.Material | THREE.Material[]> }

export class SceneryViews {
  readonly group = new THREE.Group();
  private disposed = false;
  private mixers: THREE.AnimationMixer[] = [];
  private originals: THREE.Object3D[] = [];
  private instanced: THREE.InstancedMesh[] = [];
  private explosiveViews: ExplosiveView[] = [];
  private readonly charred = new THREE.MeshStandardMaterial({ color: "#2a2522", roughness: 1, metalness: 0 });
  private readonly placements: readonly SceneryPlacement[];

  constructor(private readonly level: Pick<Level, "scenery" | "arena">, private readonly explosives: readonly ExplosiveState[] = [],
    private readonly procedural: ProceduralProps | null = null) {
    this.placements = level.scenery ?? [];
    this.group.name = "scenery";
  }

  async load(noart: boolean): Promise<void> {
    const sources = noart ? new Map<SceneryId, THREE.Object3D>() : await this.loadSources();
    if (this.disposed) { this.release(); return; }
    let instances = 0, clones = 0, fallbacks = 0;
    const statics = new Map<SceneryId, THREE.Matrix4[]>();
    for (const p of this.placements) {
      const source = sources.get(p.art);
      if (!source) { fallbacks += this.drawFallback(p); continue; }
      if (p.prop) { clones += this.drawExplosive(p, source, sources); continue; }
      if (AMBIENT[p.art]) { this.drawAnimated(p, source); clones++; continue; }
      for (let layer = 0; layer < (p.count ?? 1); layer++) {
        const list = statics.get(p.art) ?? [];
        list.push(placementMatrix(p, layer));
        statics.set(p.art, list);
      }
    }
    for (const [art, matrices] of statics) instances += this.drawInstanced(sources.get(art)!, matrices, art);
    Log.info("scenery", `SCENERY_READY count=${this.placements.length} instances=${instances} clones=${clones} fallbacks=${fallbacks} noart=${noart}`);
  }

  update(dt: number): void {
    this.mixers.forEach((m) => m.update(dt));
    for (const v of this.explosiveViews) {
      const wrecked = v.ex.wreckT > 0;
      if ((v.whole.userData.wrecked ?? false) === wrecked) continue;
      v.whole.userData.wrecked = wrecked;
      if (v.wreck) { v.whole.visible = !wrecked; v.wreck.visible = wrecked; continue; }
      // no wreck model (a fuel drum): crush it to its wreck box and char it, as the procedural drum does
      v.whole.scale.y = wrecked ? Math.max(0.05, (v.box.max.y - v.box.min.y) / (v.ex.top - v.box.min.y)) : 1;
      v.whole.traverse((o) => { if (o instanceof THREE.Mesh) o.material = wrecked ? this.charred : v.materials.get(o)!; });
    }
  }

  dispose(): void {
    this.disposed = true;
    this.group.removeFromParent();
    this.mixers.forEach((m) => m.stopAllAction());
    this.mixers = [];
    this.instanced.forEach((m) => m.dispose());
    this.instanced = [];
    this.charred.dispose();
    this.release();
  }

  // ---- loading ----------------------------------------------------------------------
  private async loadSources(): Promise<Map<SceneryId, THREE.Object3D>> {
    const loader = new GLTFLoader();
    const wanted = new Set<SceneryId>();
    for (const p of this.placements) { wanted.add(p.art); const w = WRECK_OF[p.art]; if (w && p.prop) wanted.add(w); }
    const sources = new Map<SceneryId, THREE.Object3D>();
    await Promise.all([...wanted].map(async (art) => {
      try {
        const gltf = await loader.loadAsync(`assets/models/scenery/${SCENERY_ART[art].file}.glb`);
        gltf.scene.animations = gltf.animations;
        gltf.scene.updateMatrixWorld(true);
        this.originals.push(gltf.scene);
        sources.set(art, gltf.scene);
      } catch (error) {
        Log.warn("scenery", `${art}: keeping the visible collision fallback (${String(error)})`);
      }
    }));
    return sources;
  }

  // ---- drawing ----------------------------------------------------------------------
  /** One InstancedMesh per mesh of the model, every placement (and stack layer) an instance. */
  private drawInstanced(source: THREE.Object3D, matrices: THREE.Matrix4[], art: SceneryId): number {
    const meshMatrix = new THREE.Matrix4();
    source.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      meshMatrix.copy(o.matrixWorld); // relative to the glTF scene root (the root itself is identity)
      const im = new THREE.InstancedMesh(o.geometry, o.material, matrices.length);
      matrices.forEach((m, i) => im.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(m, meshMatrix)));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = im.receiveShadow = true;
      im.name = `scenery:${art}`;
      this.group.add(im);
      this.instanced.push(im);
    });
    return matrices.length;
  }

  /** A clone placed like a static prop (used for animated and explosive props). */
  private place(p: SceneryPlacement, source: THREE.Object3D, art: SceneryId = p.art): THREE.Object3D {
    const model = clone(source);
    const pivot = new THREE.Group();
    pivot.add(model);
    const m = placementMatrix({ ...p, art }, 0);
    m.decompose(pivot.position, pivot.quaternion, pivot.scale);
    pivot.name = `scenery:${art}`;
    pivot.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true; });
    this.group.add(pivot);
    return pivot;
  }

  private drawAnimated(p: SceneryPlacement, source: THREE.Object3D): void {
    const pivot = this.place(p, source);
    const clip = source.animations.find((a) => a.name === AMBIENT[p.art]);
    if (!clip) return;
    const mixer = new THREE.AnimationMixer(pivot.children[0]);
    const action = mixer.clipAction(clip);
    action.time = (Math.abs(p.pos.x * 7.3 + p.pos.z * 3.1) % 1) * clip.duration; // out of step with its neighbours
    action.play();
    this.mixers.push(mixer);
  }

  /** An explosive's clone, its wreck model (if it has one), and the procedural stand-in hidden. */
  private drawExplosive(p: SceneryPlacement, source: THREE.Object3D, sources: Map<SceneryId, THREE.Object3D>): number {
    const hazard = sceneryBoxes(p)[0];
    const index = this.level.arena.boxes.findIndex((b) => b.prop === p.prop && Math.abs(b.min.x - hazard.min.x) < 1e-6 && Math.abs(b.min.z - hazard.min.z) < 1e-6);
    const ex = this.explosives.find((e) => e.box === index);
    const whole = this.place(p, source);
    if (index < 0 || !ex) return 1; // drawn, but nothing to follow (a level without hazards)
    const wreckArt = WRECK_OF[p.art], wreckSource = wreckArt ? sources.get(wreckArt) : undefined;
    const wreck = wreckSource ? this.place(p, wreckSource, wreckArt) : null;
    if (wreck) wreck.visible = false;
    const materials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    whole.traverse((o) => { if (o instanceof THREE.Mesh) materials.set(o, o.material); });
    this.explosiveViews.push({ ex, box: this.level.arena.boxes[index], whole, wreck, materials });
    this.procedural?.hide([index]);
    return wreck ? 2 : 1;
  }

  /** ?noart or a failed load: each collider as a plain tinted box (decoration is simply left out). */
  private drawFallback(p: SceneryPlacement): number {
    if (p.prop) return 0; // props.ts keeps drawing its procedural truck or drum
    const boxes = sceneryBoxes(p);
    for (const b of boxes) {
      const size = new THREE.Vector3(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z),
        new THREE.MeshStandardMaterial({ color: FALLBACK_TINT[p.art] ?? "#526971", roughness: 0.9 }));
      mesh.position.set((b.min.x + b.max.x) / 2, b.min.y + size.y / 2, (b.min.z + b.max.z) / 2);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.name = `scenery-fallback:${p.art}`;
      this.group.add(mesh);
      this.originals.push(mesh);
    }
    return boxes.length;
  }

  private release(): void {
    const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.originals.forEach((root) => root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      geometry.add(o.geometry);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        materials.add(m);
        Object.values(m).forEach((v) => { if (v instanceof THREE.Texture) textures.add(v); });
      });
    }));
    geometry.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose());
    this.originals = [];
  }
}

/**
 * World matrix for a placement's model: base-centred by the catalog bounds (the same numbers the colliders use),
 * lifted one model height per stack layer, scaled, quarter-turned and moved to its spot.
 */
export function placementMatrix(p: SceneryPlacement, layer: number): THREE.Matrix4 {
  const a = SCENERY_ART[p.art];
  const centre = new THREE.Matrix4().makeTranslation(-(a.min[0] + a.size[0] / 2), -a.min[1] + layer * a.size[1], -(a.min[2] + a.size[2] / 2));
  const turn = new THREE.Matrix4().makeRotationY(p.quarter * Math.PI / 2);
  const scale = new THREE.Matrix4().makeScale(p.scale, p.scale, p.scale);
  return new THREE.Matrix4().makeTranslation(p.pos.x, p.pos.y, p.pos.z).multiply(turn).multiply(scale).multiply(centre);
}
