// Bounded, authoritative transform recording. Units stay 1:1 with physics; only the displayed name changes.
import type { PlayerState } from "../core/yeet/sim";
import type { WeaponId } from "../core/yeet/tuning";
export interface ReplayActor { x: number; y: number; z: number; yaw: number; pitch: number; speed: number; weapon: WeaponId; dead: boolean; ground: boolean }
export interface ReplayFrame { time: number; actors: (ReplayActor | null)[] }
export interface ReplayClip { slot: number; speed: number; peak: number; frames: ReplayFrame[] }
export const HIGHLIGHT = { interval: 0.1, before: 3, after: 2, minSpeed: 0.1 };
export class HighlightRecorder {
  private history: ReplayFrame[] = [];
  private best: ReplayClip | null = null;
  private next = 0;
  record(time: number, players: PlayerState[], active: boolean[]): void {
    // Inspect every physics step so a short recoil impulse cannot be missed between samples.
    let newPeak = false;
    players.forEach((p, slot) => {
      const speed = Math.hypot(p.vel.x, p.vel.y, p.vel.z);
      if (active[slot] && p.dead === 0 && speed > Math.max(HIGHLIGHT.minSpeed, this.best?.speed ?? 0)) {
        this.best = { slot, speed, peak: time, frames: [...this.history] }; newPeak = true;
      }
    });
    if (time < this.next && !newPeak) return;
    const frame: ReplayFrame = { time, actors: players.map((p, s) => active[s] ? {
      x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch,
      speed: Math.hypot(p.vel.x, p.vel.y, p.vel.z), weapon: p.weapon, dead: p.dead > 0, ground: p.onGround,
    } : null) };
    if (time >= this.next) { this.next = time + HIGHLIGHT.interval; this.history.push(frame); }
    this.history = this.history.filter((f) => time - f.time <= HIGHLIGHT.before);
    if (this.best && time <= this.best.peak + HIGHLIGHT.after) this.best.frames.push(frame);
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
