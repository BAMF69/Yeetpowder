// ---------------------------------------------------------------------------
// gyro.ts
// Purpose : The device's motion for touch play: gyro aiming (turning the device turns your view,
//           DeviceMotionEvent.rotationRate, added on top of the thumb's look) and shake moves (sharp jolts found by
//           ShakeDetector in src/core/yeet/shake.ts from the acceleration).
// Usage   : const g = new Gyro(); await g.enable() (from a tap: iOS asks permission then); g.aim / g.shakes say what
//           is wanted; each frame const { yaw, pitch } = g.take() (radians since the last take) and g.takeShake();
//           g.disable(); g.dispose()
// Notes   : Browsers only give motion to secure pages (https or localhost): a game opened as http://192.168.x.x
//           gets nothing, and `blockedReason` says so. The axis mapping for the screen's turn is gyroToLook in
//           src/core/yeet/touch.ts (unit tested). DEBUG: ?debug logs enable results on the "touch" channel.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { Log } from "../core/log";
import { deviceToScreen, ShakeDetector, type ShakeDir } from "../core/yeet/shake";
import { gyroToLook } from "../core/yeet/touch";
import { TUNING } from "../core/yeet/tuning";

type MotionPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

export class Gyro {
  private on = false;
  private yaw = 0;
  private pitch = 0;
  private last = 0;
  private events = 0;
  /** Gyro aiming is wanted (the setting); listening may be on for shakes alone. */
  aim = true;
  /** Shake moves are wanted (the setting). */
  shakes = false;
  readonly detector = new ShakeDetector(TUNING.touch.shake);
  private shake: ShakeDir | null = null;
  /** Gravity estimated by a low-pass filter, for browsers that only give acceleration including gravity. */
  private grav = { x: 0, y: 0, z: 0, ready: false };
  /** Why it cannot run here, or "" if it can (or might). */
  blockedReason = "";
  /** Cannot ever work on this page (not secure, no API): a later tap does not retry. */
  private hardBlock = false;
  private readonly onMotion = (e: DeviceMotionEvent) => {
    const r = e.rotationRate;
    const now = performance.now();
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    if (!this.on) return;
    this.events++;
    const angle = screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;
    if (this.shakes) this.feedShake(e, angle, now / 1000);
    // the jolt of a shake would throw the aim: gyro aiming rests while one is going on
    if (!this.aim || !r || r.beta === null || r.gamma === null || this.detector.jolting(now / 1000)) return;
    const look = gyroToLook({ beta: r.beta, gamma: r.gamma }, angle);
    this.yaw += look.yaw * dt;
    this.pitch += look.pitch * dt;
  };

  /** Acceleration without gravity, in screen axes, into the shake detector. */
  private feedShake(e: DeviceMotionEvent, angle: number, now: number): void {
    let x: number;
    let y: number;
    const a = e.acceleration;
    if (a && a.x !== null && a.y !== null) {
      x = a.x;
      y = a.y;
    } else {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x === null || g.y === null) return;
      const k = this.grav.ready ? 0.1 : 1; // a slow low-pass is gravity; the rest is the hand
      this.grav.x += (g.x - this.grav.x) * k;
      this.grav.y += (g.y - this.grav.y) * k;
      this.grav.ready = true;
      x = g.x - this.grav.x;
      y = g.y - this.grav.y;
    }
    const s = deviceToScreen({ x, y }, angle);
    const dir = this.detector.feed(s.x, s.y, now);
    if (dir) {
      this.shake = dir;
      Log.debug("touch", `shake ${dir}`);
    }
  }

  constructor() {
    if (!window.isSecureContext) this.blockedReason = "Needs a secure (https) page: the browser hides the gyro on http.";
    else if (typeof DeviceMotionEvent === "undefined") this.blockedReason = "This browser has no motion sensor access.";
    this.hardBlock = this.blockedReason !== "";
  }

  get running(): boolean {
    return this.on;
  }

  /** Starts listening. Call from a tap: iOS shows its permission prompt then. Returns whether it is on. */
  async enable(): Promise<boolean> {
    if (this.hardBlock) return false;
    this.blockedReason = ""; // a refusal or a silent sensor last time: this tap asks again
    this.events = 0;
    const perm = DeviceMotionEvent as unknown as MotionPermission;
    if (typeof perm.requestPermission === "function") {
      try {
        if ((await perm.requestPermission()) !== "granted") {
          this.blockedReason = "Motion access was refused (allow it in the browser's site settings).";
          return false;
        }
      } catch (err) {
        this.blockedReason = `Motion access failed: ${String(err)}`;
        return false;
      }
    }
    if (!this.on) window.addEventListener("devicemotion", this.onMotion);
    this.on = true;
    this.last = 0;
    Log.debug("touch", "gyro on");
    // no events after a second: the device has no gyro (or the browser sends none)
    window.setTimeout(() => {
      if (this.on && this.events === 0) this.blockedReason = "No motion readings from this device.";
    }, 1500);
    return true;
  }

  disable(): void {
    window.removeEventListener("devicemotion", this.onMotion);
    this.on = false;
    this.yaw = this.pitch = 0;
    this.shake = null;
  }

  /** The shake found since the last call, or null. */
  takeShake(): ShakeDir | null {
    const s = this.shake;
    this.shake = null;
    return s;
  }

  /** Radians turned since the last take. */
  take(): { yaw: number; pitch: number } {
    const out = { yaw: this.yaw, pitch: this.pitch };
    this.yaw = this.pitch = 0;
    return out;
  }

  dispose(): void {
    this.disable();
  }
}
