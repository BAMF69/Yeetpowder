// ---------------------------------------------------------------------------
// remote.ts
// Purpose : How the other player is drawn in a duel (GDD netcode plan): from the server's snapshots, shown slightly
//           in the past (INTERP_MS) and smoothed between them, so their movement looks continuous at 30 snapshots a
//           second instead of stepping.
// Usage   : buf.push(nowMs, snap.state.players); each frame: const v = buf.sample(slot, nowMs - INTERP_MS)
// Notes   : No three import (Vitest can run it). Positions and yaw blend linearly between the two snapshots around
//           the render time (yaw along the short way round); everything else comes from the newer one.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import type { PlayerState } from "../../core/yeet/sim";
import type { Vec3 } from "../../core/yeet/vec";

/** How far behind the newest snapshot other players are drawn (ms). */
export const INTERP_MS = 100;
const KEEP = 24;

export interface RemoteView {
  pos: Vec3;
  yaw: number;
  state: PlayerState;
}

export class RemoteBuffer {
  private readonly snaps: Array<{ t: number; players: PlayerState[] }> = [];

  push(t: number, players: PlayerState[]): void {
    this.snaps.push({ t, players });
    if (this.snaps.length > KEEP) this.snaps.shift();
  }

  /** Player `slot` as of time t (ms), blended between the snapshots around it; null before any snapshot. */
  sample(slot: number, t: number): RemoteView | null {
    const s = this.snaps;
    if (!s.length || !s[s.length - 1].players[slot]) return null;
    let i = s.length - 1;
    while (i > 0 && s[i - 1].t > t) i--;
    const b = s[i];
    const a = i > 0 ? s[i - 1] : b;
    const pa = a.players[slot] ?? b.players[slot];
    const pb = b.players[slot];
    const span = b.t - a.t;
    const k = span > 0 ? Math.max(0, Math.min(1, (t - a.t) / span)) : 1;
    const dyaw = Math.atan2(Math.sin(pb.yaw - pa.yaw), Math.cos(pb.yaw - pa.yaw));
    return {
      pos: { x: pa.pos.x + (pb.pos.x - pa.pos.x) * k, y: pa.pos.y + (pb.pos.y - pa.pos.y) * k, z: pa.pos.z + (pb.pos.z - pa.pos.z) * k },
      yaw: pa.yaw + dyaw * k,
      state: pb,
    };
  }
}
