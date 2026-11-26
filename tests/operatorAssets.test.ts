import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { OPERATOR_MODELS, playerProfile, type OperatorId } from "../src/net/profile";
import { makeOperative } from "../src/game/yeet/operative";
import { attachSkin } from "../src/game/yeet/operativeSkin";
import { MaterialBank } from "../src/game/yeet/materials";

class PlainBank extends MaterialBank { override paint() { return new THREE.MeshStandardMaterial(); } }
async function rig(file: string): Promise<THREE.Group> {
  const b = readFileSync(`assets_src/approved-art/operators/rigged/${file}`), n = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + n).toString());
  // Node cannot decode images; test the actual untouched mesh, skin, transforms and clips with plain materials.
  delete json.images; delete json.textures;
  json.materials = [{ pbrMetallicRoughness: {} }];
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) primitive.material = 0;
  let text = Buffer.from(JSON.stringify(json)); text = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 32)]);
  const bin = b.subarray(20 + n), header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + text.length + bin.length, 8);
  header.writeUInt32LE(text.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const glb = Buffer.concat([header, text, bin]);
  return (await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), "")).scene;
}
describe("approved rigged operators", () => {
  it("validates stable IDs and rejects arbitrary model paths", () => {
    for (const id of Object.keys(OPERATOR_MODELS)) expect(playerProfile({operator: id as OperatorId}).operator).toBe(id);
    expect(playerProfile({operator: "../../evil" as OperatorId}).operator).toBe("navy");
  });
  for (const [id, file] of Object.entries(OPERATOR_MODELS)) it(`${id} retargets the actual skeleton and safely replaces a posed skin`, async () => {
    const source = await rig(file), op = makeOperative("#6286d9", new PlainBank()), camera = new THREE.PerspectiveCamera();
    op.setOperator(id as OperatorId); op.useSkin(source);
    // Actual hand endpoints must reach a feasible target, including short-armed Alien.
    const parent = new THREE.Group(), part = () => { const g = new THREE.Group(); parent.add(g); return g; };
    const joints = { hips:part(), torso:part(), head:part(), arms:([1,-1] as const).map(side=>({side,shoulder:part(),elbow:part(),wrist:part()})), legs:([1,-1] as const).map(side=>({side,hip:part(),knee:part(),ankle:part()})) };
    const fitted = attachSkin(parent,joints,source,1.86); parent.updateMatrixWorld(true);
    for (const arm of joints.arms) {
      const side = arm.side === 1 ? "Left" : "Right", shoulder = fitted.root.getObjectByName(`${side}Arm`)!;
      const goal = shoulder.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,-0.12,0.18));
      arm.wrist.position.copy(goal); arm.elbow.position.copy(goal).add(new THREE.Vector3(arm.side*0.2,-0.2,-0.1));
    }
    fitted.update(); parent.updateMatrixWorld(true);
    for (const arm of joints.arms) {
      const hand = fitted.root.getObjectByName(arm.side === 1 ? "LeftHand" : "RightHand")!;
      expect(hand.getWorldPosition(new THREE.Vector3()).distanceTo(arm.wrist.getWorldPosition(new THREE.Vector3()))).toBeLessThan(0.005);
    }
    fitted.dispose();
    const posed: THREE.Quaternion[] = [];
    for (const input of [{aim:0,speed:0}, {aim:1,speed:0}, {aim:0,speed:7}, {aim:1,speed:4}]) {
      op.setPose({weapon:"shotgun",onGround:true,pitch:0.2,fling:0,tumbling:false,dead:false,kneel:0,...input}); op.update(1,camera);
      const arm = op.root.getObjectByName("RightArm")!; expect(arm).toBeTruthy(); posed.push(arm.quaternion.clone());
      const box = new THREE.Box3().setFromObject(op.root);
      for (const value of [...box.min.toArray(), ...box.max.toArray()]) expect(Number.isFinite(value)).toBe(true);
      expect(box.max.y - box.min.y).toBeLessThan(4);
      for (const name of ["Hips","Spine02","Spine01","Spine","neck","Head","LeftArm","RightArm","LeftLeg","RightLeg"]) {
        const bone = op.root.getObjectByName(name)!; expect(bone).toBeTruthy(); expect(bone.quaternion.length()).toBeCloseTo(1);
      }
    }
    expect(posed[0].angleTo(posed[1])).toBeGreaterThan(0.01);
    const replacement = await rig(file); op.useSkin(replacement); op.update(1,camera);
    let hips = 0; op.root.traverse(o => { if (o.name === "Hips") hips++; }); expect(hips).toBe(1);
    expect(op.root.getObjectByName("RightArm")).toBeTruthy(); op.dispose();
  });
});
