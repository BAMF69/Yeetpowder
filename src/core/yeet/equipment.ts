import type { PlayerState } from "./sim";
import { TUNING } from "./tuning";

/** Shared solo, network and couch feedback, derived from authoritative player state. */
export function equipmentStatus(p: PlayerState): string {
  if (p.healing > 0) return `APPLYING HEALTH ${p.healing.toFixed(1)}s · EQUIPMENT HOLSTERED · HEALTH ${p.healthUses}/${TUNING.supplies.healthUses}`;
  const health = p.healCooldown > 0 ? `HEALTH ${p.healthUses}/${TUNING.supplies.healthUses} · ${Math.ceil(p.healCooldown)}s cooldown` :
    `V / HEAL · HEALTH ${p.healthUses}/${TUNING.supplies.healthUses}`;
  return p.weapon === "shield" ? `${p.shielding ? "SHIELD BRACED · PISTOL HOLSTERED · FRONT BLAST IMMUNE" : "SHIELD + PEA PISTOL · FRONT BLAST 50%"} · ${health}` : health;
}
