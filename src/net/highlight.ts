// Bounded, authoritative transform recording. Units stay 1:1 with physics; only the displayed name changes.
import type { PlayerState, TaggedEvent } from "../core/yeet/sim";
import type { OperatorId } from "./profile";
import type { WeaponId } from "../core/yeet/tuning";
export interface ReplayActor { x: number; y: number; z: number; yaw: number; pitch: number; speed: number; weapon: WeaponId; dead: boolean; ground: boolean; hidden?: boolean }
export interface ReplayFrame { time: number; actors: (ReplayActor | null)[] }
export interface ReplayClip { slot: number; speed: number; peak: number; frames: ReplayFrame[]; killAt?: number; name?: string; operator?: OperatorId; winner?: { slot: number; name: string; score: number }; intro?: ReplayFrame }
export const HIGHLIGHT = { interval: 0.1, before: 3, after: 2, minSpeed: 0.1 };
export class HighlightRecorder {
  private history: ReplayFrame[] = [];
  private best: ReplayClip | null = null;
  private next = 0;
  private recent: ReplayFrame[] = [];
  record(time: number, players: PlayerState[], active: boolean[], events: TaggedEvent[] = []): void {
    const frame: ReplayFrame = { time, actors: players.map((p, s) => active[s] ? {
      x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch,
      speed: Math.hypot(p.vel.x, p.vel.y, p.vel.z), weapon: p.weapon, dead: p.dead > 0, ground: p.onGround, hidden: p.swallowed,
    } : null) };
    this.recent.push(frame); this.recent = this.recent.filter((f) => time - f.time <= HIGHLIGHT.after);
    const sampled = time >= this.next;
    if (sampled) { this.next = time + HIGHLIGHT.interval; this.history.push(frame); }
    this.history = this.history.filter((f) => time - f.time <= HIGHLIGHT.before + HIGHLIGHT.after);
    for (const event of events) {
      const slot = event.type === "pvpDown" ? event.by : event.type === "down" ? event.p : undefined;
      if (slot === undefined || slot < 0) continue;
      const peak = this.recent.filter((f) => f.actors[slot] && !f.actors[slot]!.dead).sort((a, b) => b.actors[slot]!.speed - a.actors[slot]!.speed)[0];
      const speed = peak?.actors[slot]?.speed ?? 0;
      if (!peak || speed <= Math.max(HIGHLIGHT.minSpeed, this.best?.speed ?? 0)) continue;
      const frames = [...this.history.filter((f) => f.time >= peak.time - HIGHLIGHT.before), peak, frame]
        .sort((a, b) => a.time - b.time).filter((f, i, all) => i === 0 || f.time !== all[i - 1].time);
      this.best = { slot, speed, peak: peak.time, killAt: time, frames };
    }
    if (sampled && this.best && time <= this.best.peak + HIGHLIGHT.after && time > this.best.frames.at(-1)!.time) this.best.frames.push(frame);
  }
  clip(): ReplayClip | null { return this.best ? structuredClone(this.best) : null; }
}

/** Interpolate recorded transforms, never resimulate combat or change the match result. */
export function replayFrame(clip: ReplayClip, time: number): ReplayFrame {
  const a = [...clip.frames].reverse().find((f) => f.time <= time) ?? clip.frames[0];
  const b = clip.frames.find((f) => f.time >= time) ?? clip.frames.at(-1)!;
  const k = a === b ? 0 : (time - a.time) / (b.time - a.time);
  return { time, actors: a.actors.map((p, i) => {
    const q = b.actors[i]; if (!p || !q) return p;
    const angle = Math.atan2(Math.sin(q.yaw - p.yaw), Math.cos(q.yaw - p.yaw));
    return { ...p, x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, z: p.z + (q.z - p.z) * k,
      yaw: p.yaw + angle * k, pitch: p.pitch + (q.pitch - p.pitch) * k, speed: p.speed + (q.speed - p.speed) * k };
  }) };
}
