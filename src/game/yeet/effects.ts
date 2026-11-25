// ---------------------------------------------------------------------------
// effects.ts
// Purpose : Short-lived 3D effects: bullet tracers and animated Vinish impacts, blasts and blade trails, in
//           yeetpowder pink (design doc Lore: every flash, explosion and smoke puff burns hot pink).
// Usage   : const fx = new Effects(scene); fx.tracer(from, to, hit); fx.puff(at, big); fx.update(dt); fx.dispose()
// Notes   : Shared atlas textures; each effect owns a material and frame uniform, disposed when it ends.
//           A cap keeps a long Gatling burst from piling up effects.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { VinishFlipbook, animationFrame, VFX_PLAYBACK_FRAMES, type VfxKind } from "./vinishVfx";

interface Fx {
  obj: THREE.Object3D;
  mat: THREE.Material & { opacity: number };
  life: number;
  max: number;
  flipbook?: VinishFlipbook;
  frames?: number;
}

const MAX_FX = 120;
const TRACER = { miss: "#ffc2e2", hit: "#ff3fa4" };

export class Effects {
  private readonly live: Fx[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  tracer(from: THREE.Vector3, to: THREE.Vector3, hit: boolean): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color: hit ? TRACER.hit : TRACER.miss, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.add({ obj: line, mat, life: 0.09, max: 0.09 });
  }

  puff(at: THREE.Vector3, big = false): void {
    this.burst(big ? "explosion" : "impact", at, big ? 3 : 0.55, big ? 0.7 : 0.25);
  }

  explosion(at: THREE.Vector3, radius: number): void {
    this.burst("explosion", at, Math.min(12, radius * 2), 0.7);
  }

  slash(at: THREE.Vector3, reverse = false): void {
    this.burst("slash", at, 2.2, 0.32, reverse ? Math.PI : 0);
  }

  private burst(kind: VfxKind, at: THREE.Vector3, size: number, duration: number, rotation = 0): void {
    const flipbook = new VinishFlipbook(kind);
    flipbook.material.rotation = rotation;
    const sprite = new THREE.Sprite(flipbook.material);
    sprite.position.copy(at);
    sprite.scale.setScalar(size);
    this.add({ obj: sprite, mat: flipbook.material, life: duration, max: duration, flipbook, frames: VFX_PLAYBACK_FRAMES[kind] });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const f = this.live[i];
      f.life -= dt;
      if (f.flipbook) f.flipbook.frame(animationFrame(f.max - f.life, f.max, f.frames));
      else f.mat.opacity = Math.max(0, f.life / f.max);
      if (f.life <= 0) this.remove(i);
    }
  }

  dispose(): void {
    while (this.live.length) this.remove(this.live.length - 1);
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
