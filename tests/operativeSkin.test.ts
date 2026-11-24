// ---------------------------------------------------------------------------
// operativeSkin.test.ts
// Purpose : A rigged model worn by the operative (operativeSkin.ts; the Meshy operative, 2026-11-24) follows the
//           code figure's pose: each limb bone points where the code part points, in a T-pose rig, in poses that
//           bend every joint (aim, run, the Boomstick fling), and the code-built parts are hidden.
// Notes   : A small Mixamo-named skeleton in a T-pose stands in for the Meshy file (Node cannot decode its JPEGs).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { MaterialBank } from "../src/game/yeet/materials";
import { bodyTriangles, makeOperative } from "../src/game/yeet/operative";
import type { PoseInput } from "../src/game/yeet/operativePose";

class PlainBank extends MaterialBank {
  override paint(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial();
  }
}

/** A T-pose Mixamo-style rig (facing +Z, left at +X), 1.8 m tall, with a box skinned to it. */
function tposeRig(): { scene: THREE.Group } {
  const bones = new Map<string, THREE.Bone>();
  const bone = (name: string, parent: THREE.Object3D | null, x: number, y: number, z: number) => {
    const b = new THREE.Bone();
    b.name = `mixamorig:${name}`;
    b.position.set(x, y, z);
    parent?.add(b);
    bones.set(name, b);
    return b;
  };
  const hips = bone("Hips", null, 0, 1.0, 0);
  const spine2 = bone("Spine2", bone("Spine1", bone("Spine", hips, 0, 0.1, 0), 0, 0.12, 0), 0, 0.12, 0);
  bone("HeadTop_End", bone("Head", bone("Neck", spine2, 0, 0.18, 0), 0, 0.1, 0), 0, 0.2, 0);
  for (const [name, s] of [["Left", 1], ["Right", -1]] as const) {
    const sh = bone(`${name}Shoulder`, spine2, s * 0.06, 0.14, 0);
    bone(`${name}Hand`, bone(`${name}ForeArm`, bone(`${name}Arm`, sh, s * 0.12, 0, 0), s * 0.28, 0, 0), s * 0.26, 0, 0);
    const up = bone(`${name}UpLeg`, hips, s * 0.1, -0.05, 0);
    bone(`${name}ToeBase`, bone(`${name}Foot`, bone(`${name}Leg`, up, 0, -0.45, 0), 0, -0.42, 0), 0, -0.06, 0.12);
  }
  const geo = new THREE.BoxGeometry(0.4, 1.8, 0.3).translate(0, 0.9, 0);
  const n = geo.getAttribute("position").count;
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0, 0]).flat(), 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial());
  const scene = new THREE.Group();
  scene.add(hips, mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([...bones.values()]));
  return { scene };
}

const base: PoseInput = { weapon: "shotgun", speed: 0, onGround: true, aim: 0, pitch: 0, fling: 0, tumbling: false, dead: false, kneel: 0 };
const camera = new THREE.PerspectiveCamera();

/** World direction from a bone to its first bone child. */
function boneDir(root: THREE.Object3D, name: string): THREE.Vector3 {
  const b = (root.getObjectByName(`mixamorig${name}`) ?? root.getObjectByName(`mixamorig:${name}`))!; // GLTFLoader drops the colon
  const c = b.children.find((o) => (o as THREE.Bone).isBone)!;
  return c.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize();
}

/** World direction a code part hangs along (its local -Y). */
function partDown(o: THREE.Object3D): THREE.Vector3 {
  return new THREE.Vector3(0, -1, 0).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion()));
}

/** The code figure's joint groups, found by walking the tree the way operative.ts builds it. */
function codeLimbs(op: ReturnType<typeof makeOperative>) {
  const body = op.root.children[0];
  const hips = body.children.find((c) => c instanceof THREE.Group)!;
  const groups = (o: THREE.Object3D) => o.children.filter((c) => c instanceof THREE.Group); // bones are not Groups
  const [torso, legL, legR] = groups(hips);
  const [, armL, armR] = groups(torso); // head, then the arms (left built first)
  const elbow = (sh: THREE.Object3D) => groups(sh)[0];
  return { armL, armR, elbowL: elbow(armL), legL, legR, kneeL: groups(legL)[0] };
}

describe("operative skin", () => {
  for (const [label, pose] of [
    ["aiming", { ...base, aim: 1 }],
    ["running", { ...base, speed: 6 }],
    ["the Boomstick fling", { ...base, fling: 1, onGround: false }],
  ] as const) {
    it(`limb bones point where the code parts point (${label})`, () => {
      const op = makeOperative("#3b4a78", new PlainBank());
      const { scene } = tposeRig();
      op.useSkin(scene);
      op.setPose(pose);
      for (let i = 0; i < 30; i++) op.update(1 / 60, camera);
      const code = codeLimbs(op);
      for (const [bone, part] of [
        ["LeftArm", code.armL], ["RightArm", code.armR], ["LeftForeArm", code.elbowL], ["LeftUpLeg", code.legL],
        ["RightUpLeg", code.legR], ["LeftLeg", code.kneeL],
      ] as const) {
        expect(boneDir(op.root, bone).dot(partDown(part)), `${bone} vs the code part`).toBeGreaterThan(0.99);
      }
    });
  }

  it("hides the code-built body and keeps the gun", () => {
    const op = makeOperative("#3b4a78", new PlainBank());
    op.setPose(base);
    op.update(1 / 60, camera);
    const before = bodyTriangles(op);
    op.useSkin(tposeRig().scene);
    op.update(1 / 60, camera);
    expect(bodyTriangles(op)).toBeLessThan(before); // the 12-triangle box and the gun, not the code figure
    let gunVisible = false;
    op.root.traverse((o) => {
      if (o instanceof THREE.Mesh && !(o instanceof THREE.SkinnedMesh) && o.visible && o.parent?.visible) gunVisible = true;
    });
    expect(gunVisible).toBe(true);
  });
});
