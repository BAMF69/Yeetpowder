import * as THREE from "three";
import { grenadeAim } from "../../core/yeet/grenadeAim";
import { aimDir } from "../../core/yeet/vec";
import type { YeetSim, PlayerState } from "../../core/yeet/sim";
export class GrenadeGuide {
  readonly root = new THREE.Group();
  private readonly line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: "#ff65d0", depthTest: false }));
  private readonly target: THREE.Mesh;
  private next = 0;
  constructor(scene: THREE.Scene, radius: number) {
    this.target = new THREE.Mesh(new THREE.RingGeometry(radius - 0.1, radius, 64), new THREE.MeshBasicMaterial({ color: "#ff65d0", side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false }));
    this.target.rotation.x = -Math.PI / 2; this.root.add(this.line, this.target); scene.add(this.root); this.root.visible = false;
  }
  update(sim: YeetSim, player: PlayerState, aimed: boolean, dt: number): void {
    this.root.visible = player.weapon === "grenade" && aimed && player.dead === 0 && player.sharkT === 0;
    if (!this.root.visible) return;
    this.next -= dt; if (this.next > 0) return; this.next = 0.05;
    const eye = { x: player.pos.x, y: player.pos.y + sim.t.player.eyeHeight, z: player.pos.z };
    const points = grenadeAim(sim.arena, eye, aimDir(player.yaw, player.pitch), sim.t);
    this.line.geometry.dispose(); this.line.geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
    const end = points.at(-1)!; this.target.position.set(end.x, end.y + 0.03, end.z);
  }
  dispose(): void { this.root.removeFromParent(); this.line.geometry.dispose(); this.line.material.dispose(); this.target.geometry.dispose(); (this.target.material as THREE.Material).dispose(); }
}
