// ---------------------------------------------------------------------------
// figures.ts
// Purpose : Placeholder 3D figures built from shapes (the kit's first-art floor for 3D): the target dummy in the
//           GDD's character style (stubby, big head, jumpsuit, helmet and goggles), and the cartoon bonk stars.
// Usage   : const d = makeDummy("#f28c28"); scene.add(d.root); d.setHp(0.5); d.flash();
//           const s = makeStars(); s.root.position.y = 1.9; s.update(dt, visible)
// Notes   : Each dummy stays well under the GDD's 2,000 triangles per character. root's origin is the figure's
//           middle (0.85 m up) so it can tumble about its centre; place it at feet + (0, PIVOT, 0).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { loadCharacter, type Character } from "../character";

export const PIVOT = 0.85; // m: figure centre above the feet

const SKIN = "#f2c9a0";
const HELMET = "#e8e8e8";
const GOGGLE = "#2a2f3a";
const LENS = "#7fd6ff";
const BOOT = "#3a3a44";

export interface DummyFigure {
  /** Optional art experiment (?operative, the toy dummies only); keeps the pivot, health bar and hit feedback. */
  loadOperative?(): Promise<void>;
  root: THREE.Group;
  /** 0..1: the health bar above the head. */
  setHp(frac: number): void;
  /** A short white hit flash. */
  flash(): void;
  /** 0..1: the red glow of a dummy about to shoot (Fight Back's telegraph). */
  setAlert(v: number): void;
  update(dt: number, camera: THREE.Camera): void;
  dispose(): void;
}

export function makeDummy(suit: string): DummyFigure {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = -PIVOT;
  root.add(body);
  const mats: THREE.MeshStandardMaterial[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
    mats.push(m);
    return m;
  };
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = body) => {
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  let operative: Character | null = null;
  let reactionLeft = 0;
  const operativeMats: THREE.MeshStandardMaterial[] = [];
  const suitMat = mat(suit);
  // legs and boots
  add(new THREE.CapsuleGeometry(0.11, 0.3, 3, 8), suitMat, -0.13, 0.3, 0);
  add(new THREE.CapsuleGeometry(0.11, 0.3, 3, 8), suitMat, 0.13, 0.3, 0);
  add(new THREE.BoxGeometry(0.2, 0.12, 0.3), mat(BOOT), -0.13, 0.06, 0.04);
  add(new THREE.BoxGeometry(0.2, 0.12, 0.3), mat(BOOT), 0.13, 0.06, 0.04);
  // torso: a stubby jumpsuit with a belt
  add(new THREE.CapsuleGeometry(0.26, 0.3, 4, 10), suitMat, 0, 0.78, 0);
  add(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 12), mat(BOOT), 0, 0.62, 0);
  // arms, flung a little outward (they look funnier tumbling)
  const armL = add(new THREE.CapsuleGeometry(0.08, 0.32, 3, 8), suitMat, -0.36, 0.82, 0);
  armL.rotation.z = -0.5;
  const armR = add(new THREE.CapsuleGeometry(0.08, 0.32, 3, 8), suitMat, 0.36, 0.82, 0);
  armR.rotation.z = 0.5;
  add(new THREE.SphereGeometry(0.08, 8, 6), mat(SKIN), -0.46, 0.66, 0);
  add(new THREE.SphereGeometry(0.08, 8, 6), mat(SKIN), 0.46, 0.66, 0);
  // the big head, helmet and goggles (facing +Z)
  add(new THREE.SphereGeometry(0.3, 14, 10), mat(SKIN), 0, 1.36, 0);
  const helmet = add(new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(HELMET), 0, 1.4, 0);
  helmet.scale.y = 0.9;
  const band = add(new THREE.TorusGeometry(0.305, 0.035, 6, 20), mat(GOGGLE), 0, 1.42, 0);
  band.rotation.x = Math.PI / 2;
  for (const x of [-0.11, 0.11]) {
    const lens = add(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 12), mat(LENS, { emissive: LENS, emissiveIntensity: 0.25 }), x, 1.42, 0.28);
    lens.rotation.x = Math.PI / 2;
  }

  // health bar: two planes that turn to face the camera
  const barRoot = new THREE.Group();
  barRoot.position.y = 1.15;
  root.add(barRoot);
  const barBg = new THREE.MeshBasicMaterial({ color: "#222", depthTest: false, transparent: true, opacity: 0.6 });
  const barFg = new THREE.MeshBasicMaterial({ color: "#5be36b", depthTest: false });
  mats.push(barBg as unknown as THREE.MeshStandardMaterial, barFg as unknown as THREE.MeshStandardMaterial);
  const barGeo = new THREE.PlaneGeometry(0.7, 0.08);
  geos.push(barGeo);
  const bg = new THREE.Mesh(barGeo, barBg);
  const fg = new THREE.Mesh(barGeo, barFg);
  fg.position.z = 0.001;
  bg.renderOrder = fg.renderOrder = 10;
  barRoot.add(bg, fg);

  let flashT = 0;
  let alert = 0;
  let pulse = 0;
  return {
    root,
    async loadOperative() {
      const model = await loadCharacter("assets/models/quaternius/modular_men/Swat.gltf");
      const bounds = new THREE.Box3().setFromObject(model.root);
      const scale = (PIVOT * 2) / (bounds.max.y - bounds.min.y);
      model.root.scale.multiplyScalar(scale);
      model.root.position.set(-(bounds.min.x + bounds.max.x) * scale / 2, -bounds.min.y * scale,
        -(bounds.min.z + bounds.max.z) * scale / 2);
      model.root.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.castShadow = true;
        geos.push(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          mats.push(material);
          if (material instanceof THREE.MeshStandardMaterial) {
            material.roughness = 0.95;
            operativeMats.push(material);
          }
        }
      });
      // Keep primitive resources until dispose, but hide them once the model is ready.
      for (const child of body.children) child.visible = false;
      body.add(model.root);
      operative = model;
      model.play("Idle_Gun", { fade: 0 });
    },
    setHp(frac) {
      const f = Math.max(0, Math.min(1, frac));
      fg.scale.x = Math.max(0.001, f);
      fg.position.x = -0.35 * (1 - f);
      barFg.color.set(f > 0.5 ? "#5be36b" : f > 0.25 ? "#f2c14e" : "#ef5350");
      barRoot.visible = f > 0 && f < 1;
    },
    flash() {
      flashT = 0.08;
      if (operative?.clips.has("HitRecieve")) {
        reactionLeft = operative.clips.get("HitRecieve")!.duration;
        operative.play("HitRecieve", { loop: false, restart: true, fade: 0.04 });
      }
    },
    setAlert(v) {
      alert = Math.max(0, Math.min(1, v));
    },
    update(dt, camera) {
      flashT = Math.max(0, flashT - dt);
      pulse += dt * 14;
      const e = flashT > 0 ? 0.9 : 0;
      const red = alert > 0 ? (0.45 + 0.35 * Math.sin(pulse)) * alert : 0;
      suitMat.emissive.setRGB(Math.max(e, red), e, e);
      for (const material of operativeMats) material.emissive.copy(suitMat.emissive);
      if (operative && reactionLeft > 0) {
        reactionLeft = Math.max(0, reactionLeft - dt);
        if (reactionLeft === 0) operative.play("Idle_Gun", { fade: 0.1 });
      }
      operative?.update(dt);
      // the bar faces the camera whatever the body's tumble
      barRoot.quaternion.copy(root.quaternion).invert().multiply(camera.quaternion);
    },
    dispose() {
      operative?.mixer.stopAllAction();
      if (operative) operative.mixer.uncacheRoot(operative.root);
      for (const g of new Set(geos)) g.dispose();
      for (const m of new Set(mats)) m.dispose();
    },
  };
}

// ---- bonk stars --------------------------------------------------------------
export interface Stars {
  root: THREE.Group;
  update(dt: number, visible: boolean): void;
  dispose(): void;
}

function starShape(outer: number, inner: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

/** Five cartoon stars circling a head. */
export function makeStars(count = 5): Stars {
  const root = new THREE.Group();
  const geo = new THREE.ShapeGeometry(starShape(0.11, 0.05));
  const mat = new THREE.MeshBasicMaterial({ color: "#ffd84a", side: THREE.DoubleSide });
  const stars: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mat);
    stars.push(m);
    root.add(m);
  }
  let t = 0;
  root.visible = false;
  return {
    root,
    update(dt, visible) {
      root.visible = visible;
      if (!visible) return;
      t += dt;
      stars.forEach((m, i) => {
        const a = t * 5 + (i / count) * Math.PI * 2;
        m.position.set(Math.cos(a) * 0.4, Math.sin(t * 7 + i) * 0.05, Math.sin(a) * 0.4);
        m.rotation.y = -a;
      });
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
