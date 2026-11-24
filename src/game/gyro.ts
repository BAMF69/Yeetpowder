// ---------------------------------------------------------------------------
// gyro.ts
// Purpose : Gyro aiming for phones and tablets: turning the device turns your view (DeviceMotionEvent.rotationRate),
//           added on top of the thumb's look so the thumb does the big turns and the wrist the fine aim.
// Usage   : const g = new Gyro(); await g.enable() (from a tap: iOS asks permission then); each frame
//           const { yaw, pitch } = g.take() (radians since the last take); g.disable(); g.dispose()
// Notes   : Browsers only give motion to secure pages (https or localhost): a game opened as http://192.168.x.x
//           gets nothing, and `blockedReason` says so. The axis mapping for the screen's turn is gyroToLook in
//           src/core/yeet/touch.ts (unit tested). DEBUG: ?debug logs enable results on the "touch" channel.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { Log } from "../core/log";
import { gyroToLook } from "../core/yeet/touch";

type MotionPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

export class Gyro {
  private on = false;
  private yaw = 0;
  private pitch = 0;
  private last = 0;
  private events = 0;
  /** Why it cannot run here, or "" if it can (or might). */
  blockedReason = "";
  /** Cannot ever work on this page (not secure, no API): a later tap does not retry. */
  private hardBlock = false;
  private readonly onMotion = (e: DeviceMotionEvent) => {
    const r = e.rotationRate;
    const now = performance.now();
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    if (!this.on || !r || r.beta === null || r.gamma === null) return;
    this.events++;
    const angle = screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;
    const look = gyroToLook({ beta: r.beta, gamma: r.gamma }, angle);
    this.yaw += look.yaw * dt;
    this.pitch += look.pitch * dt;
  };

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
      if (this.on && this.events === 0) this.blockedReason = "No gyro readings from this device.";
    }, 1500);
    return true;
  }

  disable(): void {
    window.removeEventListener("devicemotion", this.onMotion);
    this.on = false;
    this.yaw = this.pitch = 0;
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
