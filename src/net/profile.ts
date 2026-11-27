export const OPERATORS = {
  navy: { name: "Vanguard", color: "#6286d9" },
  ember: { name: "Ember", color: "#f3a36c" },
  mint: { name: "Riptide", color: "#64d6b1" },
  violet: { name: "Spectre", color: "#c18df2" },
  "alien-t-pose": { name: "Alien", color: "#d0dae6" },
  "camo-soldier": { name: "Camo Soldier", color: "#d0dae6" },
  "field-survivor-4000": { name: "Field Survivor", color: "#d0dae6" },
  "ninja": { name: "Ninja", color: "#d0dae6" },
  "samurai-titan": { name: "Viking", color: "#d0dae6" },
  "samurai-warrior": { name: "Samurai", color: "#d0dae6" },
  "shadow-vanguard": { name: "Black Ops", color: "#d0dae6" },
  "soldier": { name: "Soldier", color: "#d0dae6" },
  "t-pose-robot": { name: "Robot", color: "#d0dae6" },
  "tactical-operator": { name: "Tactical Operator", color: "#d0dae6" },
  "tactical-shadow-4000": { name: "Black Widow", color: "#d0dae6" },
} as const;
export type OperatorId = keyof typeof OPERATORS;
export interface PlayerProfile { name: string; operator: OperatorId }
export function playerProfile(raw?: Partial<PlayerProfile>, fallback = "Player"): PlayerProfile {
  const name = typeof raw?.name === "string" ? raw.name.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069<>]/g, "").trim().slice(0, 20) : "";
  return { name: name || fallback, operator: raw?.operator && Object.hasOwn(OPERATORS, raw.operator) ? raw.operator : "navy" };
}

/** Stable model whitelist shared by the picker and renderer; legacy colors use the original Tactical. */
export const OPERATOR_MODELS: Partial<Record<OperatorId, string>> = {
  "alien-t-pose": "alien-t-pose.glb",
  "camo-soldier": "camo-soldier.glb",
  "field-survivor-4000": "field-survivor-4000.glb",
  "ninja": "ninja.glb",
  "samurai-titan": "samurai-titan.glb",
  "samurai-warrior": "samurai-warrior.glb",
  "shadow-vanguard": "shadow-vanguard.glb",
  "soldier": "soldier.glb",
  "t-pose-robot": "t-pose-robot.glb",
  "tactical-operator": "tactical-operator.glb",
  "tactical-shadow-4000": "tactical-shadow-4000.glb",
};
