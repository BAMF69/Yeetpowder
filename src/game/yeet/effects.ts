// ---------------------------------------------------------------------------
// effects.ts
// Purpose : Short-lived 3D effects: bullet tracers and impact puffs (confetti-like sparks, no blood: GDD), in
//           yeetpowder pink (design doc Lore: every flash, explosion and smoke puff burns hot pink).
// Usage   : const fx = new Effects(scene); fx.tracer(from, to, hit); fx.puff(at, big); fx.update(dt); fx.dispose()
// Notes   : Shared geometry; each effect owns only a material, disposed when it ends (ENGINE.md gotcha 3).
//           A cap keeps a long Gatling burst from piling up effects.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";

interface Fx {
  obj: THREE.Object3D;
  mat: THREE.Material & { opacity: number };
  life: number;
  max: number;
  grow: number;
}

const MAX_FX = 120;
/** Yeetpowder pink, from hot to pale (lime green is the design doc's backup if pink tests poorly). */
const PUFF_COLORS = ["#ff3fa4", "#ff7cc4", "#ffd6ec", "#e0218a"];
const TRACER = { miss: "#ffc2e2", hit: "#ff3fa4" };

export class Effects {
  private readonly live: Fx[] = [];
  private readonly puffGeo = new THREE.IcosahedronGeometry(0.12, 0);
  private n = 0;

  constructor(private readonly scene: THREE.Scene) {}

  tracer(from: THREE.Vector3, to: THREE.Vector3, hit: boolean): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color: hit ? TRACER.hit : TRACER.miss, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.add({ obj: line, mat, life: 0.09, max: 0.09, grow: 0 });
  }

  puff(at: THREE.Vector3, big = false): void {
    const mat = new THREE.MeshBasicMaterial({ color: PUFF_COLORS[this.n++ % PUFF_COLORS.length], transparent: true, opacity: 1 });
    const m = new THREE.Mesh(this.puffGeo, mat);
    m.position.copy(at);
    m.scale.setScalar(big ? 4 : 1);
    this.add({ obj: m, mat, life: big ? 0.5 : 0.22, max: big ? 0.5 : 0.22, grow: big ? 10 : 5 });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const f = this.live[i];
      f.life -= dt;
      f.mat.opacity = Math.max(0, f.life / f.max);
      if (f.grow) f.obj.scale.addScalar(f.grow * dt);
      if (f.life <= 0) this.remove(i);
    }
  }

  dispose(): void {
    while (this.live.length) this.remove(this.live.length - 1);
    this.puffGeo.dispose();
  }

  private add(f: Fx): void {
    if (this.live.length >= MAX_FX) this.remove(0);
    this.scene.add(f.obj);
    this.live.push(f);
  }

  private remove(i: number): void {
    const f = this.live[i];
    this.scene.remove(f.obj);
    f.mat.dispose();
    if (f.obj instanceof THREE.Line) f.obj.geometry.dispose();
    this.live.splice(i, 1);
  }
}
