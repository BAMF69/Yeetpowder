// Presentation-only highlight playback; recorded transforms never feed the live simulation.
import * as THREE from "three";
import { replayFrame, type ReplayClip } from "../../net/highlight";
import { makeOperative, type Operative } from "./operative";
import { PIVOT } from "./figures";
import { operativeArt } from "./meshyArt";
import { rayArena, type Arena } from "../../core/yeet/arena";

export function followCamera(camera: THREE.PerspectiveCamera, arena: Arena, target: THREE.Vector3, offset: THREE.Vector3): void {
  const distance = offset.length(), direction = offset.clone().normalize();
  const clear = Math.max(0.2, rayArena(arena, target, direction, distance) - 0.25);
  camera.position.copy(target).addScaledVector(direction, clear); camera.lookAt(target);
}

export class MatchReplay {
  readonly root = new THREE.Group();
  private actors: Operative[] = [];
  private clip: ReplayClip | null = null;
  private time = 0;
  private introTime = 0;
  private title: HTMLDivElement | null = null;
  private readonly overlay = document.createElement("div");
  private done: (() => void) | null = null;
  constructor(scene: THREE.Scene, private readonly camera: THREE.PerspectiveCamera, private readonly arena: Arena) {
    scene.add(this.root); this.root.visible = false;
    this.overlay.style.cssText = "position:fixed;inset:0;z-index:60;pointer-events:none;display:none;color:white;font:bold 20px system-ui;text-align:center";
    document.body.append(this.overlay);
  }
  get playing(): boolean { return !!this.clip; }
  play(clip: ReplayClip, done: () => void): void {
    if (!clip.frames.length) return;
    this.clip = clip; this.done = done; this.time = clip.frames[0].time;
    this.introTime = 0;
    while (this.actors.length < clip.frames[0].actors.length) {
      const op = makeOperative(["#1e88e5", "#fb8c00", "#e53935", "#43a047"][this.actors.length % 4]);
      const skin = operativeArt(); if (skin) op.useSkin(skin);
      this.root.add(op.root); this.actors.push(op);
    }
    this.root.visible = true; this.overlay.style.display = "block";
    this.actors.forEach((actor, slot) => actor.setOperator(clip.operators?.[slot] ?? (slot === clip.slot ? clip.operator : undefined) ?? "navy"));
    this.overlay.replaceChildren();
    const title = document.createElement("div");
    this.title = title;
    title.style.cssText = "margin:20px auto;padding:12px;background:#141822dd;border:2px solid #ffd84a;border-radius:12px;max-width:650px";
    title.textContent = `${clip.winner?.name ?? clip.name ?? "Player " + (clip.slot + 1)} · ${clip.winner?.score ?? 0} KOs`;
    const skip = document.createElement("button"); skip.textContent = "Skip replay";
    skip.style.cssText = "pointer-events:auto;font:inherit;padding:10px;position:absolute;bottom:25px;left:50%;transform:translateX(-50%)";
    skip.onclick = () => this.stop(); this.overlay.append(title, skip);
  }
  update(dt: number): void {
    const clip = this.clip; if (!clip) return;
    // Slow motion around the actual highest-speed instant, ordinary speed for the lead-in.
    const intro = this.introTime < 2; this.introTime += dt;
    if (!intro) this.time += dt * (Math.abs(this.time - clip.peak) < 0.6 ? 0.45 : 1);
    if (this.title) this.title.textContent = intro ? `${clip.winner?.name ?? clip.name ?? "Player " + (clip.slot + 1)} · ${clip.winner?.score ?? 0} KOs`
      : `Yeet of the match · ${clip.name ?? "Player " + (clip.slot + 1)} · ${clip.speed.toFixed(1)} yeters per second`;
    const frame = intro ? clip.intro ?? clip.frames.at(-1)! : replayFrame(clip, this.time);
    frame.actors.forEach((p, i) => {
      const op = this.actors[i]; op.root.visible = !!p && !p.hidden;
      if (!p) return;
      op.root.position.set(p.x, p.y + PIVOT, p.z); op.root.rotation.set(0, p.yaw + Math.PI, 0);
      op.setPose({ weapon: p.weapon, speed: p.speed, onGround: p.ground, aim: 0, pitch: p.pitch, fling: p.ground ? 0 : 1, tumbling: false, dead: p.dead, kneel: 0 });
      op.update(intro ? 0 : dt, this.camera);
    });
    const target = frame.actors[intro ? clip.winner?.slot ?? clip.slot : clip.slot];
    if (target) {
      const orbit = target.yaw + (intro ? this.introTime * 0.7 : 0);
      const backX = Math.sin(orbit) * 9, backZ = Math.cos(orbit) * 9;
      followCamera(this.camera, this.arena, new THREE.Vector3(target.x, target.y + 1, target.z), new THREE.Vector3(backX + 3, 4, backZ));
      this.camera.fov = 70; this.camera.updateProjectionMatrix();
    }
    if (!intro && this.time >= clip.frames.at(-1)!.time + 0.2) this.stop();
  }
  stop(): void {
    this.clip = null; this.root.visible = false; this.overlay.style.display = "none";
    const done = this.done; this.done = null; done?.();
  }
  dispose(): void { this.done = null; this.stop(); this.overlay.remove(); for (const op of this.actors) op.dispose(); }
}
