import { padFrame, type CouchFrame } from "../core/yeet/couch";
import { NO_INPUT } from "../core/yeet/sim";
import { TUNING } from "../core/yeet/tuning";
import { FpsInput } from "./fpsInput";

export class CouchControls {
  private keys = new Set<string>();
  private jump = false;
  private readonly fps: FpsInput;
  private old: boolean[][] = [];
  private readonly down = (e: KeyboardEvent) => { this.keys.add(e.code); if (e.code === "Space" && !e.repeat) this.jump = true; };
  private readonly up = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private readonly blur = () => { this.keys.clear(); this.jump = false; };
  private readonly lock = () => this.fps.lock();
  constructor(private readonly canvas: HTMLElement, readonly keyboard: boolean) {
    this.fps = new FpsInput(canvas);
    window.addEventListener("keydown", this.down); window.addEventListener("keyup", this.up); window.addEventListener("blur", this.blur);
    if (keyboard) canvas.addEventListener("click", this.lock);
  }
  take(count: number, dt: number): { frame: CouchFrame; connected: boolean }[] {
    const pads = Array.from(navigator.getGamepads?.() ?? []);
    const f = this.fps.take();
    return Array.from({ length: count }, (_, slot) => {
      if (slot === 0 && this.keyboard) {
        const frame: CouchFrame = { input: { ...NO_INPUT,
          moveX: Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA")), moveZ: Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS")),
          jump: this.jump, sprint: f.sprintHeld, firePressed: f.firePressed, fireHeld: f.fireHeld, aiming: f.aimHeld,
          select: f.select, reload: f.reload, heal: f.heal, slash: f.slash, slashHeld: f.slashHeld },
          dYaw: -f.dx * TUNING.mouseSensitivity, dPitch: -f.dy * TUNING.mouseSensitivity, cycle: f.cycle, pause: false };
        this.jump = false; return { frame, connected: true };
      }
      const index = slot - Number(this.keyboard), pad = pads[index] ?? null;
      const frame = padFrame(pad, this.old[index] ?? [], dt);
      this.old[index] = pad?.buttons.map((b) => b.pressed || b.value > 0.5) ?? [];
      return { frame, connected: !!pad };
    });
  }
  dispose(): void {
    this.fps.dispose(); this.canvas.removeEventListener("click", this.lock);
    window.removeEventListener("keydown", this.down); window.removeEventListener("keyup", this.up); window.removeEventListener("blur", this.blur);
  }
}
