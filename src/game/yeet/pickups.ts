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
import { buildWeapon } from "./gunModels";
import { MaterialBank } from "./materials";
import { buildHealthPack } from "./healthPack";

const LOOK: Record<WeaponId | "health", { color: string; size: [number, number, number] }> = {
  shield: { color: "#48d6fa", size: [0.5, 0.8, 0.1] },
  health: { color: "#5bff91", size: [0.5, 0.4, 0.3] },
  pistol: { color: "#3fbf5a", size: [0.12, 0.16, 0.4] },
  shotgun: { color: "#8b5a2b", size: [0.14, 0.16, 0.9] },
  sniper: { color: "#7a4fd1", size: [0.12, 0.16, 1.2] },
  copter: { color: "#f28c28", size: [0.32, 0.28, 0.8] },
  reaper: { color: "#9c7a54", size: [0.1, 0.5, 1.7] }, // the scythe: a long shaft and blade
  sakura: { color: "#f48fb1", size: [0.06, 0.12, 1.2] }, // the katana
  rocket: { color: "#556b2f", size: [0.2, 0.2, 1.1] }, // the tube
  grenade: { color: "#ff3fa4", size: [0.2, 0.24, 0.2] }, // a pink grenade
  axe: { color: "#b0503a", size: [0.1, 0.45, 1.3] }, // the Rocket Axe
};

interface View {
  root: THREE.Group;
  gun: THREE.Group;
  weapon: WeaponId | "health";
}

export class PickupViews {
  private readonly views: View[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];
  private t = 0;
  private readonly bank = new MaterialBank();

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
      const gun = new THREE.Group();
      gun.position.y = 0.9;
      gun.castShadow = true;
      root.add(ring, beam, gun);
      scene.add(root);
      this.views.push({ root, gun, weapon: p.weapon });
    }
    this.rebuildModels();
  }

  rebuildModels(): void {
    for (const view of this.views) {
      view.gun.clear();
      if (view.weapon === "health") {
        const kit = buildHealthPack(this.bank); kit.scale.setScalar(2);
        view.gun.add(kit); continue;
      }
      const model = buildWeapon(view.weapon, this.bank.gunKit(view.weapon));
      const bounds = new THREE.Box3().setFromObject(model.group), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      const scale = 1.25 / Math.max(size.x, size.y, size.z, 0.01);
      model.group.scale.setScalar(scale); model.group.position.copy(center).multiplyScalar(-scale); view.gun.add(model.group);
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
    this.bank.dispose();
    for (const v of this.views) this.scene.remove(v.root);
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }
}
