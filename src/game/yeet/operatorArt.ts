import type * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OPERATOR_MODELS, type OperatorId } from "../../net/profile";
import { Log } from "../../core/log";

let enabled = false;
const pending = new Map<string, Promise<THREE.Object3D | null>>();
/** Set at world load, including subsequent worlds opened with ?noart. */
export function enableOperatorArt(value: boolean): void { enabled = value; }
export function operatorArtEnabled(): boolean { return enabled; }
/** One download per chosen model, shared by every clone. Failures retain the current fallback. */
export function loadOperatorArt(id: OperatorId): Promise<THREE.Object3D | null> {
  const file = OPERATOR_MODELS[id] ? `assets/models/operators/${OPERATOR_MODELS[id]}` : "assets/models/meshy/operative.glb";
  if (!enabled) return Promise.resolve(null);
  let request = pending.get(file);
  if (!request) {
    request = new GLTFLoader().loadAsync(file).then(gltf => gltf.scene).catch(error => {
      Log.warn("art", `Operator ${id} unavailable; fallback stays (${String(error)})`);
      return null;
    });
    pending.set(file, request);
  }
  return request;
}
