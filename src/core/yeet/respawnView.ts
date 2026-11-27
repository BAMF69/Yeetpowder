// ---------------------------------------------------------------------------
// respawnView.ts
// Purpose : What the respawn screen shows each frame while you are knocked out: locked (the ring fills toward
//           the unlock), ready (the ring drains toward the auto-respawn), and whether to press SPAWN for you.
// Usage   : const v = respawnView(downFor(pl, TUNING), TUNING.player, autoSpawn)
//           ring.dash = v.ring ; label = v.locked ? v.seconds.toFixed(0) : `AUTO ${v.seconds}` ; if (v.spawnNow) input.spawn = true
// Notes   : No DOM, no three (tests/respawnView.test.ts). The sim enforces the rule (sim.ts canSpawn); this only
//           presents it, so a late or early SPAWN press is harmless. Rules: Elaina 2026-11-26, unlock 10 s, auto 30 s.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-26
// ---------------------------------------------------------------------------

export interface RespawnRules { respawnUnlock: number; respawnAuto: number }
export interface RespawnView {
  locked: boolean;
  /** 0..1: how full the ring is (filling while locked, draining while ready). */
  ring: number;
  /** Whole seconds to the next change: until unlock while locked, until auto-respawn while ready. */
  seconds: number;
  /** Auto-spawn is on and the button just unlocked: press SPAWN now. */
  spawnNow: boolean;
}

export function respawnView(downFor: number, rules: RespawnRules, autoSpawn: boolean): RespawnView {
  const t = Math.max(0, downFor);
  const { respawnUnlock: unlock, respawnAuto: auto } = rules;
  if (t < unlock) return { locked: true, ring: unlock > 0 ? t / unlock : 1, seconds: Math.ceil(unlock - t), spawnNow: false };
  const left = Math.max(0, auto - t);
  return { locked: false, ring: auto > unlock ? left / (auto - unlock) : 0, seconds: Math.ceil(left), spawnNow: autoSpawn };
}

// ---------------------------------------------------------------------------
// End of respawnView.ts
// ---------------------------------------------------------------------------
