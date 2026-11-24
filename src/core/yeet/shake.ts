// ---------------------------------------------------------------------------
// shake.ts
// Purpose : Shake moves for touch players (Elaina, 2026-11-24: "make the touchscreen experience more fun ... a silly
//           party game", and touch players should be able to beat PC players). Shaking the phone or tablet left/right
//           or up/down plays a short script of the same controls a player could press by hand, so every move follows
//           the sim's own rules:
//             Reaper's Kick  left/right  strafe that way, fire: the cartwheel (sideways faster than forward)
//                            up          fire then slash: a flip and a REAP (a slash just after a shot)
//                            down        tip the aim 35 degrees down, fire, slash: the big backflip and a REAP
//                            any, with an enemy in hook range: hold slash until the hook catches, fire: YEETREAP
//             Six-Shot Sakura left/right turn onto the nearest enemy, slash, fire: the slash and lunge combo
//                            up/down     turn onto them, hold slash into the dash stance, fire (dash), let go: ULTRASLASH
//           After a Reaper flip the view locks onto the nearest enemy for a moment (an easy shot); Sakura moves home
//           in on one. Other guns do nothing on a shake.
// Usage   : const det = new ShakeDetector(TUNING.touch.shake); det.feed(sx, sy, tSec) -> "left" | ... | null
//           const move = planShakeMove(weapon, dir, { reapInRange }, TUNING); runner.start(move)
//           each sim step: input = { ...input, ...runner.step(TUNING.step, player) }; each frame runner.look()
// Notes   : No DOM (Vitest runs it). Accelerations in screen axes: +x right, +y up (deviceToScreen maps the device's
//           own axes for the screen's turn, as gyroToLook does for rotation). Looks are goals the caller turns toward
//           (homing and lock-on are aim help on your own view; online they travel as your look, like a thumb).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import type { YeetInput } from "./sim";
import type { TUNING as TuningValue, WeaponId } from "./tuning";

type Tuning = typeof TuningValue;
export type ShakeTuning = Tuning["touch"]["shake"];
export type ShakeDir = "left" | "right" | "up" | "down";

/**
 * Device acceleration (DeviceMotionEvent axes: x to the portrait right, y to the portrait top) -> screen axes
 * (+x right, +y up as you hold it), for the screen's turn in degrees (screen.orientation.angle).
 */
export function deviceToScreen(a: { x: number; y: number }, angle: number): { x: number; y: number } {
  switch (((Math.round(angle / 90) % 4) + 4) % 4) {
    case 1: return { x: -a.y, y: a.x }; // landscape, device's right side up: up = +x, right = -y
    case 3: return { x: a.y, y: -a.x }; // landscape, left side up: up = -x, right = +y
    case 2: return { x: -a.x, y: -a.y }; // upside down
    default: return { x: a.x, y: a.y };
  }
}

/**
 * Finds shakes in a stream of screen-axis accelerations: a jolt past the threshold along one axis (dominant over the
 * other), then the hand stopping it (the opposite way, at least `reverse` of the threshold) within `window`. The
 * shake goes the way of the first jolt. A slow tilt never gets near the threshold; a bump without the stop is not
 * a shake.
 */
export class ShakeDetector {
  private pending: { axis: "x" | "y"; sign: number; at: number } | null = null;
  private lastShake = -1e9;
  private lastJolt = -1e9;
  /** Strength setting: >1 needs a gentler shake (the threshold is divided by it). */
  strength = 1;

  constructor(private readonly t: ShakeTuning) {}

  /** True for `quiet` s after any jolt past the threshold (the gyro's aiming pauses then). */
  jolting(now: number): boolean {
    return now - this.lastJolt < this.t.quiet;
  }

  feed(x: number, y: number, now: number): ShakeDir | null {
    const th = this.t.threshold / Math.max(0.25, this.strength);
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    if (Math.max(ax, ay) >= th) this.lastJolt = now;
    if (this.pending && now - this.pending.at > this.t.window) this.pending = null;
    if (now - this.lastShake < this.t.cooldown) return null;
    if (this.pending) {
      const v = this.pending.axis === "x" ? x : y;
      if (Math.sign(v) === -this.pending.sign && Math.abs(v) >= th * this.t.reverse) {
        const p = this.pending;
        this.pending = null;
        this.lastShake = now;
        if (p.axis === "x") return p.sign > 0 ? "right" : "left";
        return p.sign > 0 ? "up" : "down";
      }
      return null;
    }
    if (ax >= th && ax >= ay * this.t.dominance) this.pending = { axis: "x", sign: Math.sign(x), at: now };
    else if (ay >= th && ay >= ax * this.t.dominance) this.pending = { axis: "y", sign: Math.sign(y), at: now };
    return null;
  }
}

/** Where a move wants the view: onto the nearest enemy, or a pitch (rad). */
export type LookGoal = { kind: "home" } | { kind: "pitch"; pitch: number };

export interface MoveStep {
  /** Pressed on this step's first sim step only (firePressed, slash). */
  press?: Partial<YeetInput>;
  /** Held for the whole step (moveX, slashHeld, sprint). */
  hold?: Partial<YeetInput>;
  look?: LookGoal;
  /** s it lasts at least. */
  min: number;
  /** Wait for this (the hook catching, the dash stance) up to `max` s; not reached = the move gives up. */
  until?: "hooked" | "stance";
  max?: number;
}

export interface ShakeMove {
  name: "cartwheel" | "flip-reap" | "backflip-reap" | "yeetreap" | "slash-lunge" | "dash-ultraslash";
  steps: MoveStep[];
  /** Look goal for every step that has none of its own. */
  look?: LookGoal;
  /** s of lock-on onto the nearest enemy once the move is done. */
  lockOn: number;
}

/** What the move needs to know about the world. */
export interface ShakeContext {
  /** An enemy is close and in sight enough for the scythe's hook (TUNING.reaper.hook.range). */
  reapInRange: boolean;
}

/** The move a shake makes with this gun, or null (guns without shake moves). */
export function planShakeMove(weapon: WeaponId, dir: ShakeDir, ctx: ShakeContext, t: Tuning): ShakeMove | null {
  const s = t.touch.shake;
  const step = t.step;
  if (weapon === "reaper") {
    if (ctx.reapInRange) {
      return {
        name: "yeetreap",
        look: { kind: "home" },
        lockOn: 0,
        steps: [
          { press: { slash: true }, hold: { slashHeld: true }, min: step, until: "hooked", max: t.reaper.hook.holdTime + 0.35 },
          { press: { firePressed: true }, hold: { slashHeld: true }, min: step },
        ],
      };
    }
    if (dir === "left" || dir === "right") {
      const side = { moveX: dir === "right" ? 1 : -1, moveZ: 0 };
      return {
        name: "cartwheel",
        lockOn: s.lockOn,
        steps: [
          { hold: { ...side, sprint: true }, min: s.strafe },
          { press: { firePressed: true }, hold: side, min: step },
        ],
      };
    }
    const dip: LookGoal | undefined = dir === "down" ? { kind: "pitch", pitch: s.dipPitch } : undefined;
    return {
      name: dir === "down" ? "backflip-reap" : "flip-reap",
      lockOn: s.lockOn,
      steps: [
        ...(dip ? [{ look: dip, min: s.dipTime }] : []),
        { press: { firePressed: true }, look: dip, min: s.flipToSlash },
        { press: { slash: true }, min: step },
      ],
    };
  }
  if (weapon === "sakura") {
    const home: LookGoal = { kind: "home" };
    if (dir === "left" || dir === "right") {
      return {
        name: "slash-lunge",
        look: home,
        lockOn: 0,
        steps: [{ min: s.homeTime }, { press: { slash: true }, min: s.slashToFire }, { press: { firePressed: true }, min: step }],
      };
    }
    return {
      name: "dash-ultraslash",
      look: home,
      lockOn: 0,
      steps: [
        { min: s.homeTime },
        { press: { slash: true }, hold: { slashHeld: true }, min: step, until: "stance", max: t.sakura.dash.holdTime + 0.3 },
        { press: { firePressed: true }, hold: { slashHeld: true }, min: s.ultraHold },
        // then the script ends: slash is let go, and the stance leaves with the ULTRASLASH
      ],
    };
  }
  return null;
}

/** Plays a shake move over sim steps, then holds the lock-on for its time. */
export class ShakeRunner {
  private move: ShakeMove | null = null;
  private index = 0;
  private stepT = 0;
  private fresh = true;
  private lockT = 0;

  get active(): boolean {
    return this.move !== null;
  }

  get name(): ShakeMove["name"] | null {
    return this.move?.name ?? null;
  }

  /** Seconds of lock-on left (after a move). */
  get locking(): number {
    return this.lockT;
  }

  start(move: ShakeMove): void {
    this.move = move;
    this.index = 0;
    this.stepT = 0;
    this.fresh = true;
    this.lockT = 0;
  }

  /** Stops the lock-on (you fired your easy shot). */
  cancelLock(): void {
    this.lockT = 0;
  }

  /** Stops everything (respawn, knocked out). */
  stop(): void {
    this.move = null;
    this.lockT = 0;
  }

  /** Counts the lock-on down (once per frame). */
  update(dt: number): void {
    if (!this.move) this.lockT = Math.max(0, this.lockT - dt);
  }

  /** Where the view should go this frame, or null. */
  look(): LookGoal | null {
    if (this.move) return this.move.steps[this.index]?.look ?? this.move.look ?? null;
    return this.lockT > 0 ? { kind: "home" } : null;
  }

  /**
   * One sim step: the controls to lay over the player's own (or null when no move runs). `state` is the player's
   * hook (-1 = none) and dash stance, for steps that wait on them.
   */
  step(dt: number, state: { hook: number; stance: boolean }): Partial<YeetInput> | null {
    const move = this.move;
    if (!move) return null;
    let s = move.steps[this.index];
    // move on past finished steps (a wait that is met, or a minimum served)
    while (s) {
      const met = s.until === "hooked" ? state.hook >= 0 : s.until === "stance" ? state.stance : true;
      if (this.stepT >= s.min - 1e-9 && met) {
        this.index++;
        this.stepT = 0;
        this.fresh = true;
        s = move.steps[this.index];
        continue;
      }
      if (s.until && s.max !== undefined && this.stepT >= s.max - 1e-9) {
        this.move = null; // the hook missed or the stance never came: give up, no lock-on
        return null;
      }
      break;
    }
    if (!s) {
      this.lockT = move.lockOn;
      this.move = null;
      return null;
    }
    const out: Partial<YeetInput> = { ...(s.hold ?? {}), ...(this.fresh ? (s.press ?? {}) : {}) };
    this.fresh = false;
    this.stepT += dt;
    return out;
  }
}
