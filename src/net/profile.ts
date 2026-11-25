export const OPERATORS = {
  navy: { name: "Vanguard", color: "#6286d9" },
  ember: { name: "Ember", color: "#f3a36c" },
  mint: { name: "Riptide", color: "#64d6b1" },
  violet: { name: "Spectre", color: "#c18df2" },
} as const;
export type OperatorId = keyof typeof OPERATORS;
export interface PlayerProfile { name: string; operator: OperatorId }
export function playerProfile(raw?: Partial<PlayerProfile>, fallback = "Player"): PlayerProfile {
  const name = typeof raw?.name === "string" ? raw.name.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069<>]/g, "").trim().slice(0, 20) : "";
  return { name: name || fallback, operator: raw?.operator && Object.hasOwn(OPERATORS, raw.operator) ? raw.operator : "navy" };
}
