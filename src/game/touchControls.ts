// ---------------------------------------------------------------------------
// touchControls.ts
// Purpose : On-screen controls for phones and tablets: a floating move stick on the left half, look by dragging on
//           the right half, and buttons for fire, aim (a toggle), jump, slash (hold for the hook / dash stance),
//           reload, respawn and pause. Weapon slots in the HUD become tap targets (YeetHud.setTouch).
// Usage   : if (TouchControls.wanted(params)) touch = new TouchControls(host, onFirstTouch)
//           each frame: const t = touch.take(); merge into the frame's input; touch.dispose() when leaving
// Notes   : Shown when the main pointer is coarse (a finger) or with ?touch (try it with a mouse on the PC).
//           Pointer events with capture, so each finger keeps its own control however it wanders; touch-action
//           none stops the page scrolling or zooming under the thumbs. Dragging from the Fire button also looks, so
//           the right thumb can hold the Gatling and steer at once. The maths is in src/core/yeet/touch.ts.
//           Slash latches (tablet duel, 2026-11-22: the dash slash needed Slash held and Fire tapped, two right-hand
//           fingers): once the hold move is on (katana stance, scythe hook; the world says so through holdMove), lifting
//           the finger keeps it held, so Fire dashes or YEETREAPs; tapping Slash again lets go (the ULTRASLASH).
//           Sits at z-index 6: over the HUD (5), under the shell's screens (10), so the pause menu covers it.
//           DEBUG: ?debug logs each control's press on the "touch" channel.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { Log } from "../core/log";
import { knobOffset, stickFrom } from "../core/yeet/touch";
import { TUNING } from "../core/yeet/tuning";
import type { ShakeDir } from "../core/yeet/shake";
import { Gyro } from "./gyro";
import { canFullscreen, toggleFullscreen } from "./fullscreen";
import { buildTouchPanel, loadTouchSettings, PANEL_CSS, type TouchSettings } from "./touchSettings";

export interface TouchFrame {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  /** Look drag since the last take, in mouse-equivalent px (lookScale and the player's Look speed applied). */
  dx: number;
  dy: number;
  /** Gyro turn since the last take (rad, + left / + up; gyro tuning and the player's Gyro speed applied). */
  gyroYaw: number;
  gyroPitch: number;
  firePressed: boolean;
  fireHeld: boolean;
  /** The Aim toggle is on. */
  aimHeld: boolean;
  jump: boolean;
  slash: boolean;
  slashHeld: boolean;
  reload: boolean;
  heal?: boolean;
  reset: boolean;
  pause: boolean;
  /** A shake of the device since the last take (Shake moves on), or null. */
  shake: ShakeDir | null;
}

const CSS = `
.yt { position: fixed; inset: 0; z-index: 6; touch-action: none; user-select: none; -webkit-user-select: none;
  -webkit-touch-callout: none; font-family: system-ui, "Segoe UI", sans-serif; --b: min(15vmin, 96px); }
.yt-zone { position: absolute; top: 0; bottom: 0; }
.yt-left { left: 0; width: 50%; }
.yt-right { left: 50%; right: 0; }
.yt-stick { position: absolute; width: calc(${TUNING.touch.stickRadius * 2}px); height: calc(${TUNING.touch.stickRadius * 2}px);
  margin: -${TUNING.touch.stickRadius}px 0 0 -${TUNING.touch.stickRadius}px; border-radius: 50%; display: none;
  border: 3px solid rgba(255, 255, 255, 0.35); background: rgba(20, 24, 34, 0.25); pointer-events: none; }
.yt-knob { position: absolute; left: 50%; top: 50%; width: 46%; height: 46%; margin: -23% 0 0 -23%; border-radius: 50%;
  background: rgba(255, 255, 255, 0.55); }
.yt-stick.sprint .yt-knob { background: #ffd84a; }
.yt-btn { position: absolute; display: flex; align-items: center; justify-content: center; border-radius: 50%;
  width: calc(var(--b) * 0.68); height: calc(var(--b) * 0.68); background: rgba(20, 24, 34, 0.55); color: #fff;
  border: 3px solid rgba(255, 255, 255, 0.4); font-weight: 900; font-size: calc(var(--b) * 0.15); letter-spacing: 0.5px; }
.yt-btn.down, .yt-btn.on { background: rgba(255, 216, 74, 0.8); color: #1b1b1b; border-color: #ffd84a; }
.yt-fire { width: var(--b); height: var(--b); right: 4vmin; bottom: calc(var(--b) * 0.9); font-size: calc(var(--b) * 0.2);
  background: rgba(255, 63, 164, 0.45); border-color: #ff3fa4; }
.yt-aim { right: calc(4vmin + var(--b) * 0.16); bottom: calc(var(--b) * 2.05); }
.yt-jump { right: calc(4vmin + var(--b) * 1.15); bottom: calc(var(--b) * 0.45); }
.yt-slash { right: calc(4vmin + var(--b) * 1.1); bottom: calc(var(--b) * 1.4); }
.yt-reload { right: calc(4vmin + var(--b) * 1.05); bottom: calc(var(--b) * 2.35); width: calc(var(--b) * 0.55);
  height: calc(var(--b) * 0.55); font-size: calc(var(--b) * 0.12); }
.yt-bar { position: absolute; left: 10px; top: 10px; display: flex; gap: 8px; }
.yt-rotate { display: none; position: fixed; left: 50%; top: 42%; transform: translateX(-50%); padding: 8px 14px;
  border-radius: 10px; background: rgba(20, 24, 34, 0.85); color: #fff; font: 600 15px system-ui, sans-serif;
  pointer-events: none; white-space: nowrap; animation: yt-hint-fade 6s forwards; }
@media (orientation: portrait) { .yt-rotate { display: block; } }
/* fades after a few seconds (showing it again on each turn to portrait restarts the fade) */
@keyframes yt-hint-fade { 0%, 75% { opacity: 1; } 100% { opacity: 0; } }
.yt-top { position: static; border-radius: 12px; width: auto; height: auto; padding: 8px 12px; font-size: 14px; }
/* the shell's "Esc Pause" prompt means nothing on a tablet: the Pause button replaces it */
body.yt-touch .hudbar { display: none; }
${PANEL_CSS}`;

export class TouchControls {
  /** A finger is the main pointer, or ?touch asks for the controls anyway. */
  static wanted(params: URLSearchParams): boolean {
    return params.has("touch") || (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches);
  }

  private readonly style: HTMLStyleElement;
  private readonly root: HTMLDivElement;
  private readonly stick: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly aimBtn: HTMLDivElement;
  private readonly slashBtn: HTMLDivElement;
  private readonly off: Array<() => void> = [];
  private readonly debug: boolean;

  // the move stick's finger and where it landed
  private stickId = -1;
  private stickX = 0;
  private stickY = 0;
  private moveX = 0;
  private moveZ = 0;
  private sprint = false;
  // fingers that look (the right half, or the Fire button): id -> last position
  private readonly lookers = new Map<number, { x: number; y: number }>();
  private dx = 0;
  private dy = 0;
  // buttons
  /** Fingers holding fire: the Fire button, or (Gatling) anywhere on the right half. */
  private readonly fireIds = new Set<number>();
  /** The right half fires while held (the world turns it on while the Gatling is in hand). */
  private zoneFires = false;
  private readonly zoneFireIds = new Set<number>();
  /** The player's options (⚙) and the gyro. */
  readonly settings: TouchSettings = loadTouchSettings();
  private openPanel: () => void = () => {};
  private panelRoot: HTMLElement | null = null;
  private readonly gyro = new Gyro();
  private firePressed = false;
  private aim = false;
  private jump = false;
  private slashId = -1;
  private slash = false;
  /** The hold move is on in the sim (stance or hook), and the Slash finger has lifted: still held. */
  private latched = false;
  private holdActive = false;
  /** The finger whose tap ended the latch: its lift does nothing. */
  private unlatchId = -1;
  private reload = false;
  private heal = false;
  private healButton: HTMLElement | null = null;
  private reset = false;
  private pause = false;

  constructor(host: HTMLElement, private readonly onTouch: () => void, debug = false) {
    this.debug = debug;
    this.style = document.createElement("style");
    this.style.textContent = CSS;
    document.head.append(this.style);
    document.body.classList.add("yt-touch");
    this.root = div("yt", host);
    const left = div("yt-zone yt-left", this.root);
    const right = div("yt-zone yt-right", this.root);
    this.stick = div("yt-stick", this.root);
    this.knob = div("yt-knob", this.stick);

    // left half: the floating stick appears under the thumb
    this.capture(left, (e) => {
      if (this.stickId >= 0) return;
      this.stickId = e.pointerId;
      this.stickX = e.clientX;
      this.stickY = e.clientY;
      this.stick.style.left = `${e.clientX}px`;
      this.stick.style.top = `${e.clientY}px`;
      this.stick.style.display = "block";
      this.moveStick(e);
    });
    this.on(left, "pointermove", (e) => e.pointerId === this.stickId && this.moveStick(e));
    this.release(left, (e) => e.pointerId === this.stickId && this.dropStick());

    // right half: look; with the Gatling, a press there also fires until lifted (playtest 2026-11-22)
    this.capture(right, (e) => {
      this.lookers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.zoneFires) {
        this.fireIds.add(e.pointerId);
        this.zoneFireIds.add(e.pointerId);
        this.firePressed = true;
      }
    });
    this.on(right, "pointermove", (e) => this.look(e));
    this.release(right, (e) => {
      this.lookers.delete(e.pointerId);
      this.fireIds.delete(e.pointerId);
      this.zoneFireIds.delete(e.pointerId);
    });

    // buttons (added after the zones, so they sit on top)
    const fire = this.button("yt-fire", "FIRE", (e) => {
      this.fireIds.add(e.pointerId);
      this.firePressed = true;
      this.lookers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }, (e) => {
      this.fireIds.delete(e.pointerId);
      this.lookers.delete(e.pointerId);
    });
    this.on(fire, "pointermove", (e) => this.look(e));
    this.aimBtn = this.button("yt-aim", "AIM", () => {
      this.aim = !this.aim;
      this.aimBtn.classList.toggle("on", this.aim);
    });
    this.button("yt-jump", "JUMP", () => (this.jump = true));
    this.slashBtn = this.button("yt-slash", "SLASH", (e) => {
      if (this.latched) {
        this.unlatchId = e.pointerId; // the tap that lets go (ULTRASLASH, drop the hooked enemy)
        this.setLatched(false);
        return;
      }
      this.slashId = e.pointerId;
      this.slash = true;
    }, (e) => {
      if (e.pointerId === this.unlatchId) this.unlatchId = -1;
      if (e.pointerId !== this.slashId) return;
      this.slashId = -1;
      if (this.holdActive) this.setLatched(true);
    });
    this.button("yt-reload", "RELOAD", () => (this.reload = true));
    const bar = div("yt-bar", this.root);
    this.button("yt-top", "❚❚ Pause", () => (this.pause = true), undefined, bar);
    this.button("yt-top", "↺ Respawn", () => (this.reset = true), undefined, bar);
    this.healButton = this.button("yt-top yt-heal", "HEAL", () => (this.heal = true), undefined, bar);
    const panel = buildTouchPanel(document.body, this.settings, (s) => this.applySettings(s), () => this.gyro.blockedReason);
    this.button("yt-top", "⚙", () => panel.show(panel.root.style.display === "none"), undefined, bar);
    // fullscreen from a tap (Android, iPad): the finger lifting counts as the tap browsers require
    if (canFullscreen()) this.button("yt-top", "⛶", () => {}, () => toggleFullscreen(), bar);
    // held upright the view is narrow: say so (only shown in portrait, by CSS)
    div("yt-rotate", this.root).textContent = "Turn sideways for the best view";
    this.openPanel = () => panel.show(true);
    this.panelRoot = panel.root;
    this.off.push(() => panel.root.remove());
    this.syncMotion();
    // iOS only grants motion from a tap: the first touch anywhere asks, if gyro aiming or shake moves want it
    const ask = () => {
      if ((this.settings.gyro || this.settings.shake) && !this.gyro.running) void this.gyro.enable();
    };
    this.on(window, "pointerup", ask);

    // a finger lifted while the page was away never sends pointerup: let go of everything
    this.on(window, "blur", () => this.letGo());
    this.on(document, "visibilitychange", () => this.letGo());
    // Safety nets (tablet duel, 2026-11-22: Fire stayed held after the finger lifted, so the Gatling kept spinning
    // until a respawn swapped guns). Every lift is seen at the window, wherever the browser delivered it, and frees
    // that finger's control; no finger left on the glass at all frees every control.
    const lift = (e: Event) => this.fingerUp((e as PointerEvent).pointerId);
    window.addEventListener("pointerup", lift, true);
    window.addEventListener("pointercancel", lift, true);
    this.off.push(() => window.removeEventListener("pointerup", lift, true));
    this.off.push(() => window.removeEventListener("pointercancel", lift, true));
    this.on(window, "touchend", (e) => (e as unknown as TouchEvent).touches.length === 0 && this.allFingersUp());
    this.on(window, "touchcancel", (e) => (e as unknown as TouchEvent).touches.length === 0 && this.allFingersUp());
  }

  /** The world, each frame: is the hold move (katana stance, scythe hook) on? It ending by itself ends the latch. */
  holdMove(active: boolean): void {
    this.holdActive = active;
    if (!active && this.latched) this.setLatched(false);
  }

  /** The world, each frame: does a press on the right half fire (the Gatling in hand)? */
  setZoneFires(on: boolean): void {
    this.zoneFires = on;
    if (!on) for (const id of this.zoneFireIds) this.fireIds.delete(id); // switched away: the right half only looks
    if (!on) this.zoneFireIds.clear();
  }

  /** Aim assist is switched on (⚙). */
  get assist(): boolean {
    return this.settings.assist;
  }

  /** Everything since the last call; one-shot presses reset. */
  take(): TouchFrame {
    const scale = TUNING.touch.lookScale * this.settings.look;
    const g = this.gyro.running ? this.gyro.take() : { yaw: 0, pitch: 0 };
    const gs = TUNING.touch.gyro * this.settings.gyroSpeed;
    const f: TouchFrame = {
      moveX: this.moveX, moveZ: this.moveZ, sprint: this.sprint,
      dx: this.dx * scale, dy: this.dy * scale, gyroYaw: g.yaw * gs, gyroPitch: g.pitch * gs,
      shake: this.gyro.running && this.settings.shake ? this.gyro.takeShake() : null,
      firePressed: this.firePressed, fireHeld: this.fireIds.size > 0, aimHeld: this.aim, jump: this.jump,
      slash: this.slash, slashHeld: this.slashId >= 0 || this.latched, reload: this.reload, reset: this.reset, pause: this.pause,
      heal: this.heal,
    };
    this.dx = this.dy = 0;
    this.firePressed = this.jump = this.slash = this.reload = this.reset = this.pause = false;
    this.heal = false;
    return f;
  }

  /** Turns the Aim toggle off (knocked out of aim, weapon switched, respawned). */
  setHealth(uses: number, applying: number, cooldown: number, full: boolean): void {
    if (!this.healButton) return;
    this.healButton.textContent = applying > 0 ? `HEAL ${applying.toFixed(1)}s` : cooldown > 0 ? `HEAL ${Math.ceil(cooldown)}s` : `HEAL ${uses}/3`;
    this.healButton.style.opacity = uses === 0 || cooldown > 0 || applying > 0 || full ? "0.5" : "1";
    this.healButton.setAttribute("aria-label", `Health pack: ${uses} uses, ${Math.ceil(cooldown)} second cooldown`);
  }

  clearAim(): void {
    this.aim = false;
    this.aimBtn.classList.remove("on");
  }

  /** ⚙ changed something: the gyro follows its switch (the tap that flipped it lets iOS ask permission). */
  private applySettings(_s: TouchSettings): void {
    this.syncMotion();
  }

  /** The motion sensor listens while gyro aiming or shake moves want it (asking iOS's permission on a tap). */
  private syncMotion(): void {
    const s = this.settings;
    this.gyro.aim = s.gyro;
    this.gyro.shakes = s.shake;
    this.gyro.detector.strength = s.shakeStrength;
    const wanted = s.gyro || s.shake;
    if (wanted && !this.gyro.running) void this.gyro.enable();
    if (!wanted && this.gyro.running) this.gyro.disable();
  }

  /** A finger lifted (seen at the window): free whatever it held. The latch stays (it outlives the finger). */
  private fingerUp(id: number): void {
    this.fireIds.delete(id);
    this.zoneFireIds.delete(id);
    if (id === this.slashId) {
      this.slashId = -1;
      if (this.holdActive) this.setLatched(true);
    }
    if (id === this.unlatchId) this.unlatchId = -1;
    if (id === this.stickId) this.dropStick();
    this.lookers.delete(id);
  }

  /** No finger on the glass: nothing can still be held (the latch stays). */
  private allFingersUp(): void {
    for (const id of [...this.fireIds, this.slashId, this.stickId, ...this.lookers.keys()]) if (id >= 0) this.fingerUp(id);
    for (const b of this.root.querySelectorAll(".yt-btn.down")) b.classList.remove("down");
  }

  private dropStick(): void {
    this.stickId = -1;
    this.moveX = this.moveZ = 0;
    this.sprint = false;
    this.stick.style.display = "none";
  }

  /** Pause opened: fingers on the glass are no longer ours. */
  letGo(): void {
    this.stickId = this.slashId = this.unlatchId = -1;
    this.fireIds.clear();
    this.zoneFireIds.clear();
    this.setLatched(false);
    this.lookers.clear();
    this.moveX = this.moveZ = 0;
    this.sprint = false;
    this.stick.style.display = "none";
    for (const b of this.root.querySelectorAll(".yt-btn.down")) b.classList.remove("down");
  }

  /** Opens the touch options (the ⚙ panel); the Settings screen's "Touch controls" row calls it. */
  openSettings(): void {
    this.openPanel();
  }

  dispose(): void {
    this.panelRoot?.remove(); // it lives on document.body, outside root
    for (const f of this.off) f();
    this.off.length = 0;
    this.gyro.dispose();
    this.root.remove();
    this.style.remove();
    document.body.classList.remove("yt-touch");
  }

  // ---- helpers ------------------------------------------------------------------
  private setLatched(on: boolean): void {
    this.latched = on;
    this.slashBtn.classList.toggle("on", on);
    this.slashBtn.textContent = on ? "LET GO" : "SLASH";
  }

  private moveStick(e: PointerEvent): void {
    const dx = e.clientX - this.stickX;
    const dy = e.clientY - this.stickY;
    const s = stickFrom(dx, dy, { ...TUNING.touch, deadzone: this.settings.deadzone });
    this.moveX = s.x;
    this.moveZ = s.z;
    this.sprint = s.sprint;
    const k = knobOffset(dx, dy, TUNING.touch.stickRadius);
    this.knob.style.transform = `translate(${k.x}px, ${k.y}px)`;
    this.stick.classList.toggle("sprint", s.sprint);
  }

  private look(e: PointerEvent): void {
    const last = this.lookers.get(e.pointerId);
    if (!last) return;
    this.dx += e.clientX - last.x;
    this.dy += e.clientY - last.y;
    last.x = e.clientX;
    last.y = e.clientY;
  }

  private button(
    cls: string, label: string, down: (e: PointerEvent) => void, up?: (e: PointerEvent) => void, parent: HTMLElement = this.root,
  ): HTMLDivElement {
    const b = div(`yt-btn ${cls}`, parent);
    b.textContent = label;
    this.capture(b, (e) => {
      b.classList.add("down");
      if (this.debug) Log.debug("touch", label);
      down(e);
    });
    this.release(b, (e) => {
      b.classList.remove("down");
      up?.(e);
    });
    return b;
  }

  /** pointerdown that keeps the finger: later moves and the lift come to this element wherever the finger goes. */
  private capture(el: HTMLElement, fn: (e: PointerEvent) => void): void {
    this.on(el, "pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // a synthetic or already-gone pointer: the control still works for this press
      }
      this.onTouch();
      fn(e);
    });
  }

  private release(el: HTMLElement, fn: (e: PointerEvent) => void): void {
    this.on(el, "pointerup", fn);
    this.on(el, "pointercancel", fn);
  }

  private on(target: EventTarget, type: string, fn: (e: PointerEvent) => void): void {
    const h = fn as (e: Event) => void;
    target.addEventListener(type, h);
    this.off.push(() => target.removeEventListener(type, h));
  }
}

function div(cls: string, parent: HTMLElement): HTMLDivElement {
  const d = document.createElement("div");
  d.className = cls;
  parent.append(d);
  return d;
}
