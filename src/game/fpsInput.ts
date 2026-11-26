// ---------------------------------------------------------------------------
// fpsInput.ts
// Purpose : The FPS controls the shell's action map does not cover: pointer-lock mouse look, mouse buttons
//           (left fire, right aim), weapon keys 1-6, F to slash (gunblades), H for the controls list, the wheel, Shift to sprint, R to reload and Backspace to respawn. WASD, Space and Esc stay with the
//           shell (shell.input), so rebinding and pause keep working.
// Usage   : const fps = new FpsInput(canvas); each frame: const f = fps.take(); ... ; fps.dispose() when leaving
// Notes   : Pointer lock needs a click (browser rule). Esc unlocks it; the game then shows "Click to play".
//           While a smoke drive runs (shell.input.scripted) nothing real is read.
//           DEBUG: ?debug logs lock changes on the "fps" channel.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { Log } from "../core/log";

export interface FpsFrame {
  /** Mouse movement since the last take (pixels). */
  dx: number;
  dy: number;
  firePressed: boolean;
  fireHeld: boolean;
  /** Right mouse held: aim down the sights. */
  aimHeld: boolean;
  /** Shift held: sprint. */
  sprintHeld: boolean;
  /** 0..3, or -1. */
  select: number;
  /** -1 / +1 from the wheel, or 0. */
  cycle: number;
  /** Backspace: respawn. */
  reset: boolean;
  /** R: reload. */
  reload: boolean;
  heal?: boolean;
  /** F: gunblade slash (pressed since the last take). */
  slash: boolean;
  /** F held right now (the hold moves). */
  slashHeld: boolean;
  /** C pressed: toggle the launch camera kick-out. */
  cameraToggle: boolean;
  /** H pressed: show or hide the controls list. */
  hintToggle: boolean;
}

const WEAPON_KEYS: Record<string, number> = {
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6, Digit8: 7, Digit9: 8, Digit0: 9,
};

export class FpsInput {
  private dx = 0;
  private dy = 0;
  private firePressed = false;
  private fireHeld = false;
  private aimHeld = false;
  private sprintHeld = false;
  private select = -1;
  private cycle = 0;
  private reset = false;
  private reload = false;
  private heal = false;
  private slash = false;
  private slashHeld = false;
  private cameraToggle = false;
  private hintToggle = false;
  private readonly off: Array<() => void> = [];

  constructor(private readonly canvas: HTMLElement) {
    this.on(document, "pointerlockchange", () => {
      if (!this.locked) this.fireHeld = this.aimHeld = false;
      Log.debug("fps", `pointer lock ${this.locked ? "on" : "off"}`);
    });
    this.on(window, "mousemove", (e) => {
      if (!this.locked) return;
      const m = e as MouseEvent;
      this.dx += m.movementX;
      this.dy += m.movementY;
    });
    this.on(window, "mousedown", (e) => {
      const m = e as MouseEvent;
      if (!this.locked) return;
      if (m.button === 0) {
        this.firePressed = true;
        this.fireHeld = true;
      }
      if (m.button === 2) this.aimHeld = true;
    });
    this.on(window, "mouseup", (e) => {
      const b = (e as MouseEvent).button;
      if (b === 0) this.fireHeld = false;
      if (b === 2) this.aimHeld = false;
    });
    this.on(window, "contextmenu", (e) => {
      if (this.locked) e.preventDefault(); // right click aims; no browser menu mid-fight
    });
    this.on(window, "keyup", (e) => {
      const c = (e as KeyboardEvent).code;
      if (c === "ShiftLeft" || c === "ShiftRight") this.sprintHeld = false;
      if (c === "KeyF") this.slashHeld = false;
    });
    this.on(window, "blur", () => (this.sprintHeld = this.slashHeld = false)); // keys let go while away never send keyup
    this.on(window, "wheel", (e) => {
      if (this.locked) this.cycle = Math.sign((e as WheelEvent).deltaY);
    });
    this.on(window, "keydown", (e) => {
      const k = e as KeyboardEvent;
      if (k.repeat) return;
      if (k.code in WEAPON_KEYS) this.select = WEAPON_KEYS[k.code];
      if (k.code === "KeyR") this.reload = true; // playtest 5: R reloads (respawn moved to Backspace)
      if (k.code === "KeyV") this.heal = true;
      if (k.code === "Backspace") this.reset = true;
      if (k.code === "KeyF") this.slash = this.slashHeld = true;
      if (k.code === "KeyC") this.cameraToggle = true;
      if (k.code === "KeyH") this.hintToggle = true;
      if (k.code === "ShiftLeft" || k.code === "ShiftRight") this.sprintHeld = true;
    });
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  /** Ask for pointer lock (call from a click handler). */
  lock(): void {
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock() as unknown;
      if (p instanceof Promise) p.catch((err: unknown) => Log.warn("fps", `pointer lock refused: ${String(err)}`));
    } catch (err) {
      Log.warn("fps", `pointer lock refused: ${String(err)}`);
    }
  }

  unlock(): void {
    if (this.locked) document.exitPointerLock();
  }

  /** Everything since the last call; one-shot values reset. */
  take(): FpsFrame {
    const f: FpsFrame = {
      dx: this.dx, dy: this.dy, firePressed: this.firePressed, fireHeld: this.fireHeld && this.locked,
      aimHeld: this.aimHeld && this.locked,
      sprintHeld: this.sprintHeld,
      select: this.select, cycle: this.cycle, reset: this.reset, reload: this.reload, slash: this.slash,
      heal: this.heal && this.locked,
      slashHeld: this.slashHeld && this.locked,
      cameraToggle: this.cameraToggle,
      hintToggle: this.hintToggle,
    };
    this.dx = this.dy = 0;
    this.firePressed = false;
    this.select = -1;
    this.cycle = 0;
    this.reset = false;
    this.reload = false;
    this.heal = false;
    this.slash = false;
    this.cameraToggle = false;
    this.hintToggle = false;
    return f;
  }

  dispose(): void {
    this.unlock();
    for (const f of this.off) f();
    this.off.length = 0;
  }

  private on(target: EventTarget, type: string, fn: (e: Event) => void): void {
    target.addEventListener(type, fn);
    this.off.push(() => target.removeEventListener(type, fn));
  }
}
