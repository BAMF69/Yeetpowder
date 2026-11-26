import source from "../../../data/yeet/third-person-grips.json";
import { readEditorPresets, type GripAdjustment, type HandAdjustment } from "./gripEditor";
import type { PoseInput, V3 } from "./operativePose";

export const THIRD_PERSON_GRIPS = readEditorPresets(source.poses);
/** Version-4 editor coordinates: weapon/torso metres, rotations in degrees; no first-person consumers. */
export function calibratedGrip(input: PoseInput): GripAdjustment | null {
  if (!input.weapon || input.weapon === "shield" || input.dead || input.healing) return null;
  const id = input.weapon, aim = Math.max(0, Math.min(1, input.aim));
  const state = input.flip ? "reap" : input.hook ? "hook" : input.slash ? "slash" : input.stance ? "stance" : "";
  const special = THIRD_PERSON_GRIPS.special?.[state];
  const ready = {...THIRD_PERSON_GRIPS.ready[id], ...special?.ready[id]}, aimed = {...THIRD_PERSON_GRIPS.aimed[id], ...special?.aimed[id]};
  const out: GripAdjustment = {};
  const keys = new Set([...Object.keys(ready), ...Object.keys(aimed)] as (keyof GripAdjustment)[]);
  for (const key of keys) {
    const a = ready[key], b = aimed[key];
    if (aim === 0) { if (a) out[key] = a; continue; }
    if (aim === 1) { if (b) out[key] = b; continue; }
    const mix = (x: V3, y: V3): V3 => x.map((v,i)=>v+(y[i]-v)*aim) as V3;
    if (!a || !b || a.pinned !== b.pinned || a.rotationSpace !== b.rotationSpace) {
      const value = aim < 0.5 ? a : b;
      if (value) out[key] = value;
    } else out[key] = {...a, position:mix(a.position,b.position), rotation:mix(a.rotation,b.rotation)} satisfies HandAdjustment;
  }
  return Object.keys(out).length ? out : null;
}
