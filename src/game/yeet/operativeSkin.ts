// ---------------------------------------------------------------------------
// operativeSkin.ts
// Purpose : Puts a rigged model (Elaina's Meshy operative, Mixamo bone names) on the code-built operative: the
//           code figure keeps computing every pose (aim, the two-hand gun hold, flips, slashes, the hero landing;
//           operativePose.ts) and holding the gun, invisibly, and each frame its joints' rotations are copied onto
//           the matching bones. The Meshy file's own clips (Running, Walking) cannot aim or hold a gun, so they
//           are not used.
// Usage   : const skin = attachSkin(body, joints, gltfScene); each frame after the pose: skin.update()
// Notes   : Retarget by rest offsets: the code figure rests with arms and legs hanging straight down and identity
//           joints; the Meshy rig rests in a T-pose. At attach time each bone's bind rotation is turned so the bone
//           points the way its code part points at rest (down for limbs, up for the spine and neck), and the
//           offset between that and the code part is kept. Then, every frame:
//             bone world rotation = code part world rotation * offset;  bone local = parent world^-1 * that.
//           The hips also follow the code pelvis's movement (crouch, landing squash). A bone with no child to aim
//           at (a hand, a toe) takes its parent's correction. Bones not in MAP (the clavicles, the toes) keep their
//           bind rotation relative to their parent. Facing +Z with the figure's left at +X, as glTF and the code
//           figure both do.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { Log } from "../../core/log";

/** The code figure's joints the skin follows (operative.ts). */
export interface SkinJoints {
  hips: THREE.Object3D;
  torso: THREE.Object3D;
  head: THREE.Object3D;
  arms: { side: 1 | -1; shoulder: THREE.Object3D; elbow: THREE.Object3D; wrist: THREE.Object3D }[];
  legs: { side: 1 | -1; hip: THREE.Object3D; knee: THREE.Object3D; ankle: THREE.Object3D }[];
}

export interface Skin {
  root: THREE.Object3D;
  rightHand: THREE.Bone | undefined;
  positionHand(side: "right" | "left", world: THREE.Vector3 | null): void;
  /** The model's materials (its own copies: the hit flash tints them per figure). */
  materials: THREE.MeshStandardMaterial[];
  /** New rigs may have oversized heads or shorter torsos; fit the third-person gun to their shoulder height. */
  shoulderOffset: THREE.Vector3;
  update(): void;
  dispose(): void;
}

type Dir = "down" | "up" | "forward";
const DIRS: Record<Dir, THREE.Vector3> = {
  down: new THREE.Vector3(0, -1, 0),
  up: new THREE.Vector3(0, 1, 0),
  forward: new THREE.Vector3(0, 0, 1),
};

interface Link {
  bone: THREE.Bone;
  part: THREE.Object3D;
  /** code part world rotation^-1 * the bone's corrected rest rotation (world). */
  offset: THREE.Quaternion;
}

const tq = new THREE.Quaternion();
const tq2 = new THREE.Quaternion();
const tv = new THREE.Vector3();
const tv2 = new THREE.Vector3();

/** Mixamo bone (without the "mixamorig" prefix) -> which code part drives it and where it points at rest. */
function mapFor(j: SkinJoints, spine: readonly [string, string, string]): [string, THREE.Object3D, Dir][] {
  const arm = (side: 1 | -1) => j.arms.find((a) => a.side === side)!;
  const leg = (side: 1 | -1) => j.legs.find((l) => l.side === side)!;
  const out: [string, THREE.Object3D, Dir][] = [
    ["Hips", j.hips, "up"],
    [spine[0], j.torso, "up"],
    [spine[1], j.torso, "up"],
    [spine[2], j.torso, "up"],
    ["Neck", j.head, "up"],
    ["Head", j.head, "up"],
  ];
  for (const [name, side] of [["Left", 1], ["Right", -1]] as const) {
    out.push([`${name}Arm`, arm(side).shoulder, "down"], [`${name}ForeArm`, arm(side).elbow, "down"], [`${name}Hand`, arm(side).wrist, "down"]);
    out.push([`${name}UpLeg`, leg(side).hip, "down"], [`${name}Leg`, leg(side).knee, "down"], [`${name}Foot`, leg(side).ankle, "forward"]);
  }
  return out;
}

/** The first bone child (where a bone points), or null for a leaf. */
function boneChild(b: THREE.Object3D): THREE.Object3D | null {
  return b.children.find((c) => (c as THREE.Bone).isBone) ?? null;
}

/** Fit differing Meshy limb lengths to the code wrist targets without stretching the mesh. */
function armReach(upper: THREE.Bone, lower: THREE.Bone, hand: THREE.Bone, target: SkinJoints["arms"][number], handLink: Link): () => void {
  const s = new THREE.Vector3(), e = new THREE.Vector3(), w = new THREE.Vector3(), t = new THREE.Vector3();
  const axis = new THREE.Vector3(), pole = new THREE.Vector3(), goal = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const q = new THREE.Quaternion(), world = new THREE.Quaternion(), parent = new THREE.Quaternion();
  const rotateToward = (bone: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
    bone.getWorldPosition(origin); child.getWorldPosition(to); to.sub(origin).normalize(); from.copy(point).sub(origin).normalize();
    q.setFromUnitVectors(to, from); bone.getWorldQuaternion(world).premultiply(q);
    bone.parent!.getWorldQuaternion(parent).invert(); bone.quaternion.copy(parent.multiply(world)); bone.updateMatrixWorld(true);
  };
  return () => {
    upper.getWorldPosition(s); lower.getWorldPosition(e); hand.getWorldPosition(w); target.wrist.getWorldPosition(t);
    const a = s.distanceTo(e), b = e.distanceTo(w);
    axis.copy(t).sub(s); const distance = Math.max(Math.abs(a - b) + 1e-5, Math.min(axis.length(), a + b - 1e-5)); axis.normalize();
    target.elbow.getWorldPosition(pole).sub(s); pole.addScaledVector(axis, -pole.dot(axis));
    if (pole.lengthSq() < 1e-8) { pole.copy(e).sub(s); pole.addScaledVector(axis, -pole.dot(axis)); }
    pole.normalize();
    const along = (a * a + distance * distance - b * b) / (2 * distance);
    goal.copy(s).addScaledVector(axis, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    rotateToward(upper, lower, goal);
    goal.copy(s).addScaledVector(axis, distance); rotateToward(lower, hand, goal);
    target.wrist.getWorldQuaternion(world).multiply(handLink.offset); hand.parent!.getWorldQuaternion(parent).invert();
    hand.quaternion.copy(parent.multiply(world)); hand.updateMatrixWorld(true);
  };
}

/**
 * Clones `source` (a loaded glTF scene with a skinned mesh), sizes it to `height` (in `parent`'s units, feet at y 0)
 * and binds its bones to the code figure's joints. Call with the code figure at rest (before its first pose).
 */
export function attachSkin(parent: THREE.Object3D, joints: SkinJoints, source: THREE.Object3D, height: number): Skin {
  const root = cloneSkinned(source);
  const box = new THREE.Box3().setFromObject(source);
  const s = height / Math.max(box.max.y - box.min.y, 1e-3);
  root.scale.setScalar(s);
  root.position.set(-(box.min.x + box.max.x) * s / 2, -box.min.y * s, -(box.min.z + box.max.z) * s / 2);
  parent.add(root);

  const materials: THREE.MeshStandardMaterial[] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = true;
    o.frustumCulled = false; // a skinned mesh's bounds are its bind pose: a flip would cull it wrongly
    const m = (o.material as THREE.MeshStandardMaterial).clone();
    // Meshy's glow map is almost black and multiplies the emissive colour: without it the hit flash and the alert
    // glow (both set through emissive) show on the whole body, as on the code figure
    m.emissiveMap = null;
    m.emissive.setRGB(0, 0, 0);
    o.material = m;
    materials.push(m);
  });

  parent.updateMatrixWorld(true);
  const bones = new Map<string, THREE.Bone>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.set(o.name.replace(/^mixamorig:?/i, "").toLowerCase(), o as THREE.Bone);
  });
  const spine: [string, string, string] = bones.has("spine02") && bones.has("spine01")
    ? ["spine02", "spine01", "spine"]
    : ["spine", "spine1", "spine2"];
  const torsoChain = ["hips", ...spine, "neck", "head"];

  // rest offsets, worked out in parent space so the figure's place in the world does not matter
  const parentQ = parent.getWorldQuaternion(new THREE.Quaternion());
  const parentQi = parentQ.clone().invert();
  const links: Link[] = [];
  const corrections = new Map<THREE.Object3D, THREE.Quaternion>();
  for (const [name, part, dir] of mapFor(joints, spine)) {
    const key = name.toLowerCase();
    const bone = bones.get(key);
    if (!bone) {
      Log.warn("art", `skin: no bone ${name} (the code figure's part stays unmatched)`);
      continue;
    }
    const bindQ = parentQi.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    const chainIndex = torsoChain.indexOf(key);
    const next = chainIndex >= 0 ? bones.get(torsoChain[chainIndex + 1]) : undefined;
    const child = next?.parent === bone ? next : boneChild(bone);
    let correction: THREE.Quaternion;
    if (child) {
      const from = parent.worldToLocal(bone.getWorldPosition(tv));
      const to = parent.worldToLocal(child.getWorldPosition(tv2));
      const d = to.sub(from).normalize();
      correction = new THREE.Quaternion().setFromUnitVectors(d, DIRS[dir]);
    } else {
      correction = corrections.get(bone.parent!)?.clone() ?? new THREE.Quaternion();
    }
    corrections.set(bone, correction);
    const restQ = correction.clone().multiply(bindQ); // the bone pointing the code way, in parent space
    const partQ = parentQi.clone().multiply(part.getWorldQuaternion(new THREE.Quaternion()));
    links.push({ bone, part, offset: partQ.invert().multiply(restQ) });
  }

  const shoulderOffset = new THREE.Vector3();
  if (bones.has("spine02")) for (const arm of joints.arms) {
    const bone = bones.get(arm.side === 1 ? "leftarm" : "rightarm")!;
    const actual = parent.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
    const reference = parent.worldToLocal(arm.shoulder.getWorldPosition(new THREE.Vector3()));
    shoulderOffset.add(actual.sub(reference).multiplyScalar(0.5));
  }

  // Keep the accepted classic rig unchanged; the new rigs have different arm proportions.
  const reaches = bones.has("spine02") ? joints.arms.map(arm => {
    const side = arm.side === 1 ? "Left" : "Right";
    const hand = bones.get(`${side}hand`.toLowerCase())!;
    return armReach(bones.get(`${side}arm`.toLowerCase())!, bones.get(`${side}forearm`.toLowerCase())!, hand, arm, links.find(link => link.bone === hand)!);
  }) : [];

  // the hips follow the pelvis's movement too
  const hipsBone = bones.get("hips");
  const pelvisRest = parent.worldToLocal(joints.hips.getWorldPosition(new THREE.Vector3()));
  const hipsRest = hipsBone ? parent.worldToLocal(hipsBone.getWorldPosition(new THREE.Vector3())) : null;
  const handBones = { right: bones.get("righthand"), left: bones.get("lefthand") };
  const handRest = { right: handBones.right?.position.clone(), left: handBones.left?.position.clone() };

  return {
    root,
    rightHand: handBones.right,
    positionHand(side, world) {
      const hand = handBones[side];
      const rest = handRest[side];
      if (!hand?.parent || !rest) return;
      if (reaches.length && world) return; // New rigs fit arm reach without stretching their forearms.
      hand.position.copy(world ? hand.parent.worldToLocal(tv.copy(world)) : rest);
      hand.updateMatrixWorld(true);
    },
    materials,
    shoulderOffset,
    update() {
      parent.updateMatrixWorld(true); // the code figure's pose of this frame
      if (hipsBone && hipsRest) {
        const now = parent.worldToLocal(joints.hips.getWorldPosition(tv));
        const target = tv2.copy(hipsRest).add(now.sub(pelvisRest));
        hipsBone.parent!.worldToLocal(parent.localToWorld(target));
        hipsBone.position.copy(target);
      }
      for (const l of links) {
        // world target = part world * offset; local = parent bone world^-1 * target
        l.part.getWorldQuaternion(tq).multiply(l.offset);
        l.bone.parent!.getWorldQuaternion(tq2).invert();
        l.bone.quaternion.copy(tq2.multiply(tq));
        l.bone.updateMatrixWorld(true);
      }
      for (const reach of reaches) reach();
    },
    dispose() {
      root.removeFromParent();
      root.traverse((o) => { if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose(); });
      for (const m of materials) m.dispose(); // geometry and textures are shared with the loaded model
    },
  };
}
