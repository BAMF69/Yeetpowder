// ---------------------------------------------------------------------------
// pickups.ts
// Purpose : Draws the guns lying in a level (Fight Back): a spinning, bobbing gun-shaped block over a glowing ring,
//           with a tall light beam so you can spot it from across the room. Hidden once taken.
// Usage   : const p = new PickupViews(scene, sim.pickups); each frame p.update(dt, sim.pickups); p.dispose()
// Notes   : Placeholder shapes (first-art floor): each gun keeps its viewmodel colours so you recognise it.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import type { PickupState } from "../../core/yeet/sim";
import type { WeaponId } from "../../core/yeet/tuning";

const LOOK: Record<WeaponId, { color: string; size: [number, number, number] }> = {
  pistol: { color: "#3fbf5a", size: [0.12, 0.16, 0.4] },
  shotgun: { color: "#8b5a2b", size: [0.14, 0.16, 0.9] },
  sniper: { color: "#7a4fd1", size: [0.12, 0.16, 1.2] },
  copter: { color: "#f28c28", size: [0.32, 0.28, 0.8] },
};

interface View {
  root: THREE.Group;
  gun: THREE.Mesh;
}

export class PickupViews {
  private readonly views: View[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];
  private t = 0;

  constructor(private readonly scene: THREE.Scene, pickups: PickupState[]) {
    const ringGeo = this.geo(new THREE.TorusGeometry(0.7, 0.06, 8, 32));
    const beamGeo = this.geo(new THREE.CylinderGeometry(0.25, 0.25, 14, 12, 1, true));
    for (const p of pickups) {
      const look = LOOK[p.weapon];
      const root = new THREE.Group();
      root.position.set(p.pos.x, p.pos.y, p.pos.z);
      const glow = new THREE.MeshBasicMaterial({ color: look.color, transparent: true, opacity: 0.9 });
      const beamMat = new THREE.MeshBasicMaterial({ color: look.color, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
      const gunMat = new THREE.MeshStandardMaterial({ color: look.color, emissive: look.color, emissiveIntensity: 0.35, roughness: 0.5 });
      this.mats.push(glow, beamMat, gunMat);
      const ring = new THREE.Mesh(ringGeo, glow);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05;
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 7;
      const gun = new THREE.Mesh(this.geo(new THREE.BoxGeometry(...look.size)), gunMat);
      gun.position.y = 0.9;
      gun.castShadow = true;
      root.add(ring, beam, gun);
      scene.add(root);
      this.views.push({ root, gun });
    }
  }

  update(dt: number, pickups: PickupState[]): void {
    this.t += dt;
    pickups.forEach((p, i) => {
      const v = this.views[i];
      v.root.visible = !p.taken;
      v.gun.rotation.y = this.t * 1.8;
      v.gun.position.y = 0.9 + Math.sin(this.t * 2.4 + i) * 0.12;
    });
  }

  dispose(): void {
    for (const v of this.views) this.scene.remove(v.root);
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }
}
