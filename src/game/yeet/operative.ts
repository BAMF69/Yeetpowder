// ---------------------------------------------------------------------------
// operative.ts
// Purpose : The third-person operative (GDD character design, the keyframes' navy operative): a segmented N64-style
//           figure built in code from faceted, painted parts - a box head with a painted stern face and hair, a
//           tactical vest with pouches over the jumpsuit, a belt, fingerless gloves, chunky boots - holding the
//           current gun. Used for your own body (tumbles, the launch camera) and for duel opponents.
// Usage   : const op = makeOperative("#3b4a78"); scene.add(op.root);
//           each frame: op.setPose(inputFromPlayer(pl, sim.time, aim, kneel)); op.update(dt, camera)
// Notes   : Rigid parts on joints (hips > torso > head and shoulders > elbows; hips > thighs > knees), the way N64
//           characters were built, so poses are rotations (operativePose.ts) and nothing deforms. The gun is held at
//           a pose-driven point in torso space and both arms reach it with a two-bone solve (solveArm), so every
//           gun sits in the hands in every pose. Same DummyFigure interface as the toy dummies (health bar, hit
//           flash, alert glow). Faces +Z; root's origin is the figure's middle (PIVOT) so it tumbles about it.
//           Budget (GDD): under 6,000 triangles plus the held weapon (tests/operative.test.ts).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { OPERATORS, type OperatorId } from "../../net/profile";
import type { WeaponId } from "../../core/yeet/tuning";
import type { DummyFigure } from "./figures";
import { PIVOT } from "./figures";
import { buildGlove } from "./glove";
import { buildWeapon, hasWeaponArt } from "./gunModels";
import { MaterialBank } from "./materials";
import { buildMuzzleFlash } from "./muzzleFlash";
import { POSE, targetPose, type PoseInput, type PoseTargets, type V3 } from "./operativePose";
import { attachSkin, type Skin } from "./operativeSkin";

// ---- Proportions (metres before BODY_SCALE) ------------------------------------
const BODY_SCALE = 0.93; // about 1.73 m tall: the sim's player is 1.7 m
const HIP_Y = 0.92;
const SPINE_Y = 0.08; // torso pivot above the hips
const SHOULDER = { x: 0.265, y: 0.47 };
export const UPPER_ARM = 0.29;
export const FOREARM = 0.27;
const THIGH = 0.44;
const SHIN = 0.4;
const HEAD_Y = 0.6;
const GLOVE_SIZE = 1.25;
/** A worn skin's height in body units (the code figure's top of the head; x BODY_SCALE = about 1.75 m). */
const SKIN_HEIGHT = 1.86;
/** How fast joints ease toward their pose (1/s). */
const EASE = 16;
const BOOT_DARK = "#1c1c1f";
/** Muzzle flash: seconds shown, and size per gun (bigger than first person: it is seen from metres away). */
const FLASH_TIME = 0.06;
const FLASH_SIZE: Partial<Record<WeaponId, number>> = { shotgun: 3, sniper: 2.6, copter: 2, reaper: 2.6 };

export interface Operative extends DummyFigure {
  setOperator(operator: OperatorId): void;
  /** What the operative is doing (operativePose.ts): applied, eased, on the next update. */
  setPose(input: PoseInput): void;
  /** A shot: the pink muzzle flash at the held gun's barrel for a moment. */
  fire(weapon: WeaponId): void;
  /**
   * Wears a rigged model (a loaded glTF scene, Mixamo bones: the Meshy operative) instead of the code-built parts,
   * which stay as its invisible skeleton (operativeSkin.ts). The gun and the muzzle flash stay as they are.
   */
  useSkin(source: THREE.Object3D): void;
}

export interface Arm {
  shoulder: THREE.Group;
  elbow: THREE.Group;
  wrist: THREE.Group;
  side: 1 | -1;
}

interface Leg {
  hip: THREE.Group;
  knee: THREE.Group;
  ankle: THREE.Group;
  side: 1 | -1;
}

interface HeldGun {
  holder: THREE.Group;
  /** Inside the holder, turned round: gun models point their barrels along -Z, the operative faces +Z. */
  mount: THREE.Group;
  grip: THREE.Vector3;
  fore: THREE.Vector3 | null;
  muzzle: THREE.Vector3;
  scale: number;
  /** Built from an art model (meshyArt.ts): when that changes (the art loaded later), the gun is built again. */
  art: boolean;
}

/** A tapered prism (a limb or torso segment): `sides` facets, radius rTop/rBot, depth squashed by `depth`. */
function prism(rTop: number, rBot: number, h: number, sides: number, depth = 1, hang = false): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, sides);
  g.rotateY(Math.PI / sides); // a flat face to the front
  g.scale(1, 1, depth);
  if (hang) g.translate(0, -h / 2, 0); // the top at the joint, hanging along -Y
  return g;
}

/** bank: where materials come from (a test passes one without painted textures: Node has no canvas). */
export function makeOperative(suit: string, bank = new MaterialBank()): Operative {
  let selectedOperator: OperatorId | null = null;
  const tintSkin = () => {
    if (!worn || !selectedOperator) return;
    for (const m of worn.materials) {
      const base = (m.userData.operatorBase ??= m.color.clone()) as THREE.Color;
      m.color.copy(base).multiply(new THREE.Color(OPERATORS[selectedOperator].color));
    }
  };
  const extraMats: THREE.Material[] = [];
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = -PIVOT;
  body.scale.setScalar(BODY_SCALE);
  root.add(body);

  const cloth = bank.paint("fabric", { tint: suit }).clone(); // its own copy: the hit flash tints it
  extraMats.push(cloth);
  const vest = bank.paint("vest");
  const leather = bank.paint("leather");
  const skin = bank.paint("skin");
  const hair = bank.paint("hair");
  const dark = bank.plain(BOOT_DARK);

  const parts: THREE.Object3D[] = []; // the code-built body (hidden when a skin is worn)
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(bank.geo(geo), mat);
    parts.push(m);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const joint = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const j = new THREE.Group();
    j.position.set(x, y, z);
    parent.add(j);
    return j;
  };

  // hips: pelvis and belt with a buckle and pouches
  const hips = joint(body, 0, HIP_Y, 0);
  mesh(prism(0.19, 0.17, 0.16, 8, 0.66), cloth, hips, 0, -0.03, 0);
  mesh(prism(0.198, 0.196, 0.06, 8, 0.7), leather, hips, 0, 0.04, 0);
  mesh(new THREE.BoxGeometry(0.06, 0.045, 0.02), bank.plain("#8a8d93"), hips, 0, 0.04, 0.14);
  for (const x of [-0.14, 0.14]) mesh(new THREE.BoxGeometry(0.075, 0.085, 0.055), vest, hips, x, 0.0, 0.11);

  // torso: jumpsuit chest, the vest over it with pouches and shoulder straps, collar and neck
  const torso = joint(hips, 0, SPINE_Y, 0);
  mesh(prism(0.245, 0.18, 0.52, 8, 0.62), cloth, torso, 0, 0.26, 0);
  mesh(prism(0.235, 0.195, 0.36, 8, 0.72), vest, torso, 0, 0.27, 0);
  for (const x of [-0.09, 0, 0.09]) mesh(new THREE.BoxGeometry(0.075, 0.095, 0.05), vest, torso, x, 0.2, 0.15);
  mesh(new THREE.BoxGeometry(0.065, 0.075, 0.045), vest, torso, -0.13, 0.34, 0.14); // radio pouch
  for (const x of [-0.15, 0.15]) mesh(new THREE.BoxGeometry(0.08, 0.03, 0.33), vest, torso, x, 0.47, 0);
  mesh(prism(0.08, 0.1, 0.05, 8, 0.9), cloth, torso, 0, 0.54, 0); // collar
  mesh(prism(0.058, 0.064, 0.08, 6), skin, torso, 0, 0.58, 0); // neck

  // head: a box with the painted face on its front, an angular jaw, nose, ears and hair
  const head = joint(torso, 0, HEAD_Y, 0.01);
  const faceMat = bank.paint("face");
  // BoxGeometry face order: +x, -x, +y, -y, +z (front), -z (back)
  mesh(new THREE.BoxGeometry(0.19, 0.23, 0.21), [skin, skin, hair, skin, faceMat, hair], head, 0, 0.125, 0);
  mesh(prism(0.135, 0.085, 0.07, 4, 0.75), skin, head, 0, 0.01, 0.025); // jaw
  mesh(new THREE.BoxGeometry(0.028, 0.05, 0.03), skin, head, 0, 0.11, 0.115); // nose
  for (const x of [-0.1, 0.1]) mesh(new THREE.BoxGeometry(0.02, 0.05, 0.04), skin, head, x, 0.12, -0.01);
  mesh(new THREE.BoxGeometry(0.205, 0.05, 0.225), hair, head, 0, 0.255, -0.005); // hair on top
  const quiff = mesh(new THREE.BoxGeometry(0.17, 0.04, 0.06), hair, head, 0.01, 0.27, 0.085);
  quiff.rotation.x = -0.35;
  mesh(new THREE.BoxGeometry(0.2, 0.15, 0.03), hair, head, 0, 0.18, -0.105); // back of the head

  // arms: sleeve segments with a shoulder cap; the fingerless glove at the wrist
  const arm = (side: 1 | -1): Arm => {
    const shoulder = joint(torso, side * SHOULDER.x, SHOULDER.y, 0);
    mesh(new THREE.IcosahedronGeometry(0.09, 0), cloth, shoulder, 0, -0.02, 0);
    mesh(prism(0.078, 0.066, UPPER_ARM, 6, 1, true), cloth, shoulder);
    const elbow = joint(shoulder, 0, -UPPER_ARM, 0);
    mesh(prism(0.066, 0.055, FOREARM, 6, 1, true), cloth, elbow);
    const wrist = joint(elbow, 0, -FOREARM - 0.03, 0);
    const glove = buildGlove(bank, side, cloth);
    glove.rotation.set(Math.PI / 2, 0, 0); // knuckles along the forearm
    glove.scale.setScalar(GLOVE_SIZE);
    wrist.add(glove);
    parts.push(glove);
    return { shoulder, elbow, wrist, side };
  };
  // facing +Z, the figure's left is +X
  const armL = arm(1);
  const armR = arm(-1);

  // legs: trouser segments, knee pads, boots with soles
  const leg = (side: 1 | -1): Leg => {
    const hip = joint(hips, side * 0.11, -0.02, 0);
    mesh(prism(0.108, 0.085, THIGH, 6, 1, true), cloth, hip);
    const knee = joint(hip, 0, -THIGH, 0);
    mesh(new THREE.BoxGeometry(0.11, 0.11, 0.04), leather, knee, 0, -0.02, 0.08); // knee pad
    mesh(prism(0.084, 0.07, SHIN, 6, 1, true), cloth, knee);
    const ankle = joint(knee, 0, -SHIN, 0);
    mesh(prism(0.078, 0.082, 0.11, 6), leather, ankle, 0, 0.025, 0); // boot cuff
    mesh(new THREE.BoxGeometry(0.135, 0.11, 0.28), leather, ankle, 0, -0.01, 0.05);
    mesh(new THREE.BoxGeometry(0.145, 0.035, 0.295), dark, ankle, 0, -0.065, 0.05);
    return { hip, knee, ankle, side };
  };
  const legs = [leg(1), leg(-1)]; // left, right

  // guns: built on first use, held at a pose-driven point in torso space
  const guns = new Map<WeaponId, HeldGun>();
  const gunFor = (id: WeaponId): HeldGun => {
    let g = guns.get(id);
    if (g && g.art !== hasWeaponArt(id)) {
      g.holder.removeFromParent(); // its art arrived after it was built (the world poses while it loads)
      guns.delete(id);
      g = undefined;
    }
    if (!g) {
      const m = buildWeapon(id, bank.gunKit(id));
      const holder = joint(torso, 0, 0, 0);
      const mount = joint(holder, 0, 0, 0);
      mount.rotation.y = Math.PI;
      m.group.scale.setScalar(m.scale);
      m.group.position.copy(m.grip).multiplyScalar(-m.scale); // the grip at the holder's origin
      m.group.traverse((o) => (o.castShadow = true));
      mount.add(m.group);
      g = { holder, mount, grip: m.grip, fore: m.fore, muzzle: m.muzzle, scale: m.scale, art: hasWeaponArt(id) };
      guns.set(id, g);
    }
    return g;
  };

  // ---- animated pink muzzle flash (a billboard reads from any side) ----
  const muzzle = buildMuzzleFlash(bank, { crossed: true });
  extraMats.push(...muzzle.materials);
  let muzzleT = 0;

  // ---- health bar (as the toy dummies) ----
  const barRoot = new THREE.Group();
  barRoot.position.y = 1.15;
  root.add(barRoot);
  const barBg = new THREE.MeshBasicMaterial({ color: "#222", depthTest: false, transparent: true, opacity: 0.6 });
  const barFg = new THREE.MeshBasicMaterial({ color: "#5be36b", depthTest: false });
  extraMats.push(barBg, barFg);
  const barGeo = bank.geo(new THREE.PlaneGeometry(0.7, 0.08));
  const bg = new THREE.Mesh(barGeo, barBg);
  const fg = new THREE.Mesh(barGeo, barFg);
  fg.position.z = 0.001;
  bg.renderOrder = fg.renderOrder = 10;
  barRoot.add(bg, fg);

  // ---- pose state ----
  let input: PoseInput = { weapon: "pistol", speed: 0, onGround: true, aim: 0, pitch: 0, fling: 0, tumbling: false, dead: false, kneel: 0 };
  let time = 0;
  let stride = 0;
  let flashT = 0;
  let alert = 0;
  let pulse = 0;
  let first = true;
  let worn: Skin | null = null;
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  const easeEuler = (o: THREE.Object3D, to: V3, k: number) => {
    o.rotation.x += (to[0] - o.rotation.x) * k;
    o.rotation.y += (to[1] - o.rotation.y) * k;
    o.rotation.z += (to[2] - o.rotation.z) * k;
  };

  const apply = (t: PoseTargets, k: number) => {
    torso.rotation.x += (t.lean - torso.rotation.x) * k;
    torso.rotation.y += (t.twist - torso.rotation.y) * k;
    head.rotation.x += (-t.head - head.rotation.x) * k; // + head looks up: x < 0 tips the face up
    legs.forEach((l, i) => {
      easeEuler(l.hip, t.legs[i].hip, k);
      l.knee.rotation.x += (t.legs[i].knee - l.knee.rotation.x) * k;
    });
    // the gun: show the current one where the pose holds it
    let held: HeldGun | null = null;
    for (const [id, g] of guns) g.holder.visible = id === input.weapon && t.gun !== null;
    if (input.weapon && t.gun) {
      held = gunFor(input.weapon);
      held.holder.visible = true;
      const p = held.holder.position;
      p.x += (t.gun.pos[0] - p.x) * k;
      p.y += (t.gun.pos[1] - p.y) * k;
      p.z += (t.gun.pos[2] - p.z) * k;
      // pose pitch is + up; with the barrel along the holder's +Z, a positive x turn points it down: negate
      easeEuler(held.holder, [-t.gun.rot[0], t.gun.rot[1], t.gun.rot[2]], k);
    }
    body.updateMatrixWorld(true);
    // arms: onto the gun (two-bone solve) or posed freely
    if (held && t.rightArm === "grip") solveArm(armR, held.holder.localToWorld(tmpA.set(0, 0, 0)), torso);
    else if (t.rightArm !== "grip") freeArm(armR, t.rightArm, k);
    if (held && t.leftArm === "fore" && held.fore) {
      const fore = tmpB.copy(held.fore).sub(held.grip).multiplyScalar(held.scale);
      solveArm(armL, held.mount.localToWorld(fore), torso);
    } else if (t.leftArm !== "fore") freeArm(armL, t.leftArm, k);
    else freeArm(armL, { shoulder: [-0.15, 0, -0.12], elbow: -0.35 }, k);
  };

  return {
    root,
    setOperator(operator) { if (selectedOperator === operator) return; selectedOperator = operator; cloth.color.set(OPERATORS[operator].color); tintSkin(); },
    setPose(p) {
      input = p;
    },
    useSkin(source) {
      if (worn) return;
      // the skin binds to the code figure at rest: its joints as built (no pose has run, or put them back)
      for (const j of [hips, torso, head, ...[armL, armR].flatMap((a) => [a.shoulder, a.elbow, a.wrist]), ...legs.flatMap((l) => [l.hip, l.knee, l.ankle])]) {
        j.quaternion.identity();
      }
      const posed = !first;
      worn = attachSkin(body, { hips, torso, head, arms: [armL, armR], legs }, source, SKIN_HEIGHT);
      tintSkin();
      for (const p of parts) p.visible = false;
      if (posed) first = true; // snap back into the current pose on the next update
    },
    fire(weapon) {
      const g = gunFor(weapon);
      g.mount.add(muzzle.group);
      muzzle.group.position.copy(g.muzzle).sub(g.grip).multiplyScalar(g.scale);
      muzzle.group.scale.setScalar(FLASH_SIZE[weapon] ?? 1.6);
      muzzle.group.rotation.z = Math.random() * Math.PI; // cosmetic only, never part of the sim
      muzzleT = FLASH_TIME;
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
    },
    setAlert(v) {
      alert = Math.max(0, Math.min(1, v));
    },
    update(dt, camera) {
      time += dt;
      stride += input.speed * POSE.runRate * dt;
      apply(targetPose(input, time, stride), first ? 1 : 1 - Math.exp(-EASE * dt));
      first = false;
      worn?.update();
      flashT = Math.max(0, flashT - dt);
      muzzle.group.visible = muzzleT > 0 && input.weapon !== null && !input.dead; // shown before the countdown:
      muzzle.update(FLASH_TIME - muzzleT);
      muzzleT = Math.max(0, muzzleT - dt); // a shot always gets at least one drawn frame
      pulse += dt * 14;
      const e = flashT > 0 ? 0.9 : 0;
      const red = alert > 0 ? (0.45 + 0.35 * Math.sin(pulse)) * alert : 0;
      cloth.emissive.setRGB(Math.max(e, red), e, e);
      if (worn) for (const m of worn.materials) m.emissive.copy(cloth.emissive);
      barRoot.quaternion.copy(root.quaternion).invert().multiply(camera.quaternion);
    },
    dispose() {
      worn?.dispose();
      bank.dispose();
      for (const m of extraMats) m.dispose();
    },
  };
}

// ---- arms ----------------------------------------------------------------------
const sv = { s: new THREE.Vector3(), d: new THREE.Vector3(), pole: new THREE.Vector3(), u: new THREE.Vector3(), x: new THREE.Vector3(), z: new THREE.Vector3() };
const basis = new THREE.Matrix4();

/** Poses an arm by angles (eased). */
function freeArm(a: Arm, pose: { shoulder: V3; elbow: number }, k: number): void {
  a.shoulder.rotation.x += (pose.shoulder[0] - a.shoulder.rotation.x) * k;
  a.shoulder.rotation.y += (pose.shoulder[1] - a.shoulder.rotation.y) * k;
  a.shoulder.rotation.z += (pose.shoulder[2] - a.shoulder.rotation.z) * k;
  a.elbow.rotation.x += (pose.elbow - a.elbow.rotation.x) * k;
}

/**
 * Two-bone solve: turns the shoulder and bends the elbow so the wrist lands on `target` (world space), with the
 * elbow pointing down and out (the pole). Works in the torso's space, where the arm lengths are defined.
 */
export function solveArm(a: Arm, target: THREE.Vector3, torso: THREE.Object3D): void {
  const s = sv.s.copy(a.shoulder.position);
  const d = torso.worldToLocal(sv.d.copy(target)).sub(s);
  const reach = UPPER_ARM + FOREARM + 0.03;
  const dist = Math.min(Math.max(d.length(), 0.05), reach * 0.999);
  d.normalize();
  // the upper arm leans off the shoulder-to-hand line toward the pole by angle A (law of cosines)
  const cosA = (UPPER_ARM * UPPER_ARM + dist * dist - (FOREARM + 0.03) ** 2) / (2 * UPPER_ARM * dist);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const cosB = (UPPER_ARM * UPPER_ARM + (FOREARM + 0.03) ** 2 - dist * dist) / (2 * UPPER_ARM * (FOREARM + 0.03));
  const bend = Math.PI - Math.acos(Math.max(-1, Math.min(1, cosB)));
  // pole: down, out to the arm's side and a little back; its part across the reach line
  const pole = sv.pole.set(a.side * 0.6, -1, -0.4);
  pole.addScaledVector(d, -pole.dot(d)).normalize();
  const u = sv.u.copy(d).multiplyScalar(Math.cos(A)).addScaledVector(pole, Math.sin(A)); // upper arm direction
  // shoulder frame: local -Y along the upper arm, local +Z toward where the forearm bends (away from the pole)
  const z = sv.z.copy(pole).negate().addScaledVector(u, pole.dot(u)).normalize();
  const y = u.negate(); // -Y along the arm
  const x = sv.x.crossVectors(y, z);
  basis.makeBasis(x, y, z);
  a.shoulder.quaternion.setFromRotationMatrix(basis);
  a.elbow.rotation.set(-bend, 0, 0);
}

/** Triangles in the figure (the GDD budget check): everything but the held guns. */
export function bodyTriangles(op: Operative): number {
  let n = 0;
  op.root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.visible) return;
    const g = o.geometry as THREE.BufferGeometry;
    n += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  });
  return n;
}

