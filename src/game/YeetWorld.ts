// ---------------------------------------------------------------------------
// YeetWorld.ts
// Purpose : The toy's play world (what "Play" starts): runs the engine-free YeetSim at a fixed step and draws it in
//           first person: gray-box room, target dummies, the gun in your hands, tracers, screen shake, and the HUD.
// Usage   : Registered in src/main.ts as world "main". ?play skips the title; ?play&autoplay runs the scripted
//           tour (src/core/yeet/autoplay.ts) and logs YEET_AUTOPLAY_DONE (dev.py smoke --query "play&autoplay").
// Notes   : PROTOTYPE (Toy tier). All feel numbers live in src/core/yeet/tuning.ts. The sim owns the rules; this
//           file only turns input into YeetInput and events into effects. Esc frees the mouse and opens pause.
//           Right mouse aims: the view zooms (TUNING.aim.fov), mouse speed scales with the zoom, and the sim fires
//           braced (less recoil, tighter spread). ?aim holds aim during autoplay (screenshots of aimed fire).
//           Sound: every sim event plays an audio event (src/game/yeet/sound.ts, data/audio_events.json); audio
//           starts on the first click (browser rule).
//           DEBUG: ?debug logs sim events on the "yeet" channel.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { Log } from "../core/log";
import { effectiveShake } from "../core/settings";
import { Shake } from "../core/shake";
import { testRoom } from "../core/yeet/arena";
import { AUTOPLAY_SECONDS, autoplayStep } from "../core/yeet/autoplay";
import { NO_INPUT, YeetSim, type YeetEvent, type YeetInput } from "../core/yeet/sim";
import { TUNING, type WeaponId } from "../core/yeet/tuning";
import { len } from "../core/yeet/vec";
import { shell } from "../shell/app";
import { FpsInput } from "./fpsInput";
import type { World } from "./threeHost";
import { makeDummy, makeStars, PIVOT, type DummyFigure, type Stars } from "./yeet/figures";
import { Effects } from "./yeet/effects";
import { YeetHud } from "./yeet/hud";
import { YeetSound } from "./yeet/sound";
import { buildRoom } from "./yeet/room";
import { Viewmodel } from "./yeet/viewmodel";

// ---- Tunables (presentation only; gameplay numbers are in tuning.ts) ----------
const SUITS: Array<[string, string]> = [
  ["#e53935", "Red"], ["#1e88e5", "Blue"], ["#fdd835", "Yellow"], ["#43a047", "Green"], ["#8e24aa", "Purple"], ["#fb8c00", "Orange"],
];
const DOWN_VERB: Record<WeaponId, string> = { pistol: "PEA'D", shotgun: "BLASTED", sniper: "YEETED", copter: "SHREDDED" };
const FIRE_POP: Partial<Record<WeaponId, string>> = { shotgun: "BLAM!", sniper: "KRAK!" };
const FIRE_SOUND: Record<WeaponId, string> = { pistol: "pea", shotgun: "boom", sniper: "krak", copter: "brrt" };
const SHAKE_TO_RAD = 0.0025; // shake offset pixels -> camera wobble radians
const HARD_LANDING = 14; // m/s

interface DummyView {
  fig: DummyFigure;
  stars: Stars;
  quat: THREE.Quaternion;
  name: string;
  lastWeapon: WeaponId | "crash";
}

const LYING = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const IDENTITY = new THREE.Quaternion();

export class YeetWorld implements World {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly sim = new YeetSim(TUNING, testRoom());
  private readonly room = buildRoom(this.sim.arena);
  private readonly views: DummyView[] = [];
  private readonly vm = new Viewmodel();
  private readonly fx: Effects;
  private readonly sound = new YeetSound();
  private readonly hud: YeetHud;
  private readonly fps: FpsInput;
  private readonly shake = new Shake({ maxOffset: 10, maxAngle: 0.04 });
  private readonly autoplay = shell.params.has("autoplay");
  private readonly canvas: HTMLElement;
  private acc = 0;
  private time = 0;
  /** 0 (hip) .. 1 (aimed), eased toward the right mouse button. */
  private aim = 0;
  private readonly forceAim = shell.params.has("aim");
  private autoplayDone = false;
  /** ?hold=<mark>: the tour stopped at that moment (everything frozen, still drawn). */
  private held = false;
  private readonly marks: Array<[number, string]> = [[1.0, "pistol"], [2.3, "launch"], [4.1, "spin"], [8, "copter"], [15, "crash"]];
  private stats = { hits: 0, top: 0, bonks: 0 };
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly onCanvasDown = () => {
    this.sound.resume(); // a click is what browsers need before audio may start
    if (!this.fps.locked && shell.top?.gameplay) this.fps.lock();
  };
  private readonly onLockChange = () => {
    // Esc frees the mouse: open the pause menu so the game never runs on without you
    if (!this.fps.locked && !this.autoplay && shell.top?.gameplay) shell.pauseGame();
  };

  constructor(aspect: number) {
    this.scene.background = new THREE.Color("#9fcbea");
    this.scene.fog = new THREE.Fog("#9fcbea", 40, 120);
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.05, 300);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    this.camera.add(this.vm.root);

    this.scene.add(new THREE.HemisphereLight("#e8f3ff", "#6b5a48", 1.3));
    const sun = new THREE.DirectionalLight("#fff4e0", 2.2);
    sun.position.set(12, 30, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -24;
    sc.right = sc.top = 24;
    sc.far = 80;
    this.scene.add(sun);
    this.scene.add(this.room.group);

    this.sim.dummies.forEach((_d, i) => {
      const [color, name] = SUITS[i % SUITS.length];
      const fig = makeDummy(color);
      const stars = makeStars();
      stars.root.position.y = 1.85 - PIVOT;
      fig.root.add(stars.root);
      fig.setHp(1);
      this.scene.add(fig.root);
      this.views.push({ fig, stars, quat: new THREE.Quaternion(), name: `${name} Dummy`, lastWeapon: "pistol" });
    });

    this.fx = new Effects(this.scene);
    const host = document.getElementById("game")!;
    this.canvas = host.querySelector("canvas") ?? host;
    this.hud = new YeetHud(host, TUNING.weaponOrder.map((w) => TUNING.weapons[w].name));
    this.fps = new FpsInput(this.canvas);
    this.canvas.addEventListener("mousedown", this.onCanvasDown);
    document.addEventListener("pointerlockchange", this.onLockChange);
    this.vm.show(this.sim.player.weapon);
    this.placeCamera(0);
    if (this.autoplay) Log.info("yeet", "autoplay tour starting");
  }

  /** Loads the sounds while the loading screen shows. */
  async load(progress: (v: number) => void): Promise<void> {
    await this.sound.load(progress);
  }

  dispose(): void {
    this.sound.dispose();
    document.removeEventListener("pointerlockchange", this.onLockChange);
    this.canvas.removeEventListener("mousedown", this.onCanvasDown);
    this.fps.dispose();
    this.hud.dispose();
    this.fx.dispose();
    this.vm.dispose();
    this.room.dispose();
    for (const v of this.views) {
      v.fig.dispose();
      v.stars.dispose();
    }
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(realDt: number): void {
    if (shell.plantedCrash) {
      shell.plantedCrash = false;
      throw new Error("planted crash (dev.py smoke --drive crash)"); // proves the crash hook end to end
    }
    if (this.held) return;
    const dt = realDt * shell.settings.access.game_speed;
    this.time += dt;

    // input that happens once per frame goes into the first fixed step only
    const f = this.fps.take();
    if (this.forceAim) f.aimHeld = true;
    this.updateAim(f.aimHeld, dt);
    let first = this.frameInput(f);
    // mouse speed follows the zoom, so aimed look feels the same on screen
    const sens = TUNING.mouseSensitivity * this.zoomFactor();
    if (!this.autoplay) this.sim.look(-f.dx * sens, -f.dy * sens * (shell.settings.input.invert_y ? -1 : 1));

    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= TUNING.step) {
      this.acc -= TUNING.step;
      let input = first;
      if (this.autoplay) {
        const s = autoplayStep(this.sim, this.sim.time);
        if (s.aim) {
          this.sim.player.yaw = s.aim.yaw;
          this.sim.player.pitch = s.aim.pitch;
        }
        input = { ...s.input, aiming: f.aimHeld };
      }
      for (const e of this.sim.step(input)) this.onEvent(e);
      first = { ...input, jump: false, firePressed: false, select: -1, reset: false };
      this.stats.top = Math.max(this.stats.top, this.sim.player.pos.y);
    }
    // smoke can stop at these to screenshot a moment: --until YEET_MARK_launch (spin, copter)
    while (this.autoplay && this.marks.length && this.sim.time >= this.marks[0][0]) {
      const mark = this.marks.shift()![1];
      Log.info("yeet", `YEET_MARK_${mark}`);
      if (shell.params.get("hold") === mark) this.held = true; // ?hold=<mark>: freeze here for a screenshot
    }
    if (this.autoplay && !this.autoplayDone && this.sim.time >= AUTOPLAY_SECONDS) {
      this.autoplayDone = true;
      Log.info("yeet", `YEET_AUTOPLAY_DONE hits=${this.stats.hits} top=${this.stats.top.toFixed(1)} bonks=${this.stats.bonks}`);
    }

    this.placeCamera(dt);
    this.drawDummies(dt);
    const pl = this.sim.player;
    const copterFiring = pl.weapon === "copter" && f.fireHeld && !pl.overheated;
    if (copterFiring) this.sound.play("wup"); // its cooldown in the events file sets the chop rate
    this.sound.update(shell.settings.audio);
    this.vm.update(dt, copterFiring);
    this.fx.update(dt);
    const speed = len(pl.vel);
    this.hud.update(dt, {
      weapon: TUNING.weaponOrder.indexOf(pl.weapon),
      heat: pl.heat / TUNING.copter.heatMax,
      overheated: pl.overheated,
      showHeat: pl.weapon === "copter" || pl.heat > 0,
      speed,
      stunned: pl.stun > 0,
      locked: this.fps.locked,
      autoplay: this.autoplay,
      rush: Math.max(0, (speed - 10) / 14),
      reduceMotion: shell.settings.access.reduce_motion,
      scoped: this.vm.scoped,
    });
  }

  // ---- aiming ----------------------------------------------------------------
  private updateAim(held: boolean, dt: number): void {
    const step = dt / TUNING.aim.time;
    this.aim = held ? Math.min(1, this.aim + step) : Math.max(0, this.aim - step);
    const target = TUNING.aim.fov[this.sim.player.weapon];
    const fov = TUNING.aim.hipFov + (target - TUNING.aim.hipFov) * this.aim;
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.vm.setAim(this.aim);
  }

  /** Screen-space zoom relative to hip fire (1 at hip, smaller when zoomed in). */
  private zoomFactor(): number {
    const half = (deg: number) => Math.tan((deg * Math.PI) / 360);
    return half(this.camera.fov) / half(TUNING.aim.hipFov);
  }

  // ---- input -----------------------------------------------------------------
  private frameInput(f: ReturnType<FpsInput["take"]>): YeetInput {
    const inp = shell.input;
    const st = inp.stick();
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    let select = f.select;
    if (select < 0 && f.cycle !== 0) {
      const n = TUNING.weaponOrder.length;
      select = (TUNING.weaponOrder.indexOf(this.sim.player.weapon) + f.cycle + n) % n;
    }
    return {
      ...NO_INPUT,
      moveX: clamp((inp.isDown("move_right") ? 1 : 0) - (inp.isDown("move_left") ? 1 : 0) + st.x),
      moveZ: clamp((inp.isDown("move_up") ? 1 : 0) - (inp.isDown("move_down") ? 1 : 0) - st.y),
      jump: inp.takePress("jump"),
      firePressed: f.firePressed,
      fireHeld: f.fireHeld,
      select,
      reset: f.reset,
      aiming: f.aimHeld,
    };
  }

  // ---- events -> effects -------------------------------------------------------
  private onEvent(e: YeetEvent): void {
    Log.debug("yeet", e.type);
    const pl = this.sim.player;
    switch (e.type) {
      case "fire": {
        const w = TUNING.weapons[e.weapon];
        this.vm.fired(e.weapon, w.trauma, e.aimed);
        this.sound.play(FIRE_SOUND[e.weapon]);
        this.shake.addTrauma(w.trauma * (e.aimed ? 0.6 : 1));
        const pop = FIRE_POP[e.weapon];
        if (pop) this.hud.pop(pop);
        this.camera.updateMatrixWorld(true);
        const from = this.vm.muzzleWorld(this.tmpA);
        for (const t of e.tracers) {
          const to = this.tmpB.set(t.to.x, t.to.y, t.to.z);
          this.fx.tracer(from, to, t.hit);
          const dist = Math.hypot(t.to.x - t.from.x, t.to.y - t.from.y, t.to.z - t.from.z);
          if (dist < w.range - 0.01) this.fx.puff(to);
        }
        break;
      }
      case "hit": {
        const v = this.views[e.dummy];
        v.fig.flash();
        v.fig.setHp(this.sim.dummies[e.dummy].hp / TUNING.dummy.hp);
        v.lastWeapon = pl.crashing || e.damage === TUNING.copter.crashDamage ? "crash" : pl.weapon;
        this.hud.hitMarker();
        this.sound.play("thwack");
        this.stats.hits++;
        break;
      }
      case "down": {
        const v = this.views[e.dummy];
        this.hud.feedLine(v.lastWeapon === "crash" ? "SQUASHED" : DOWN_VERB[v.lastWeapon], v.name);
        this.sound.play("boing");
        break;
      }
      case "respawn":
        this.views[e.dummy].fig.setHp(1);
        this.views[e.dummy].quat.identity();
        this.sound.play("popin");
        break;
      case "yeet":
        this.hud.pop("YEET!");
        this.sound.play("whistle");
        break;
      case "bonk":
        this.stats.bonks++;
        this.sound.play("bonk");
        if (e.who === "player") {
          this.hud.pop("BONK!");
          this.shake.addTrauma(TUNING.bonk.trauma);
        } else {
          this.hud.feedLine("BONKED", this.views[e.who].name);
        }
        break;
      case "land":
        if (e.speed > HARD_LANDING) {
          this.shake.addTrauma(0.3);
          this.sound.play("thud");
        }
        break;
      case "overheat":
        this.hud.pop("OVERHEAT!", true);
        this.sound.play("sputter");
        break;
      case "crash":
        this.hud.pop("KABOOM!", true);
        this.sound.play("kaboom");
        this.shake.addTrauma(TUNING.copter.crashTrauma);
        this.fx.puff(this.tmpA.set(e.at.x, e.at.y + 0.3, e.at.z), true);
        break;
      case "switch":
        this.vm.show(e.weapon);
        this.sound.play("click");
        break;
      case "playerRespawn":
        break;
    }
  }

  // ---- drawing -----------------------------------------------------------------
  private placeCamera(dt: number): void {
    const pl = this.sim.player;
    const eye = this.sim.eye();
    const s = this.shake.update(dt, effectiveShake(shell.settings));
    let roll = s.angle;
    if (pl.stun > 0 && !shell.settings.access.reduce_motion) roll += Math.sin(this.time * 22) * 0.07 * (pl.stun / TUNING.bonk.stun);
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.camera.rotation.set(pl.pitch + s.y * SHAKE_TO_RAD, pl.yaw + s.x * SHAKE_TO_RAD, roll);
  }

  private drawDummies(dt: number): void {
    const axis = this.tmpA;
    const q = new THREE.Quaternion();
    this.sim.dummies.forEach((d, i) => {
      const v = this.views[i];
      v.fig.root.position.set(d.pos.x, d.pos.y + PIVOT, d.pos.z);
      const flying = !d.onGround || Math.abs(d.tumble) > 1.5;
      if (flying) {
        // tumble about the axis across the direction of travel: it reads as being knocked head over heels
        axis.set(d.vel.z, 0, -d.vel.x);
        if (axis.lengthSq() < 1e-4) axis.set(1, 0, 0);
        axis.normalize();
        q.setFromAxisAngle(axis, d.tumble * dt);
        v.quat.premultiply(q);
      } else {
        v.quat.slerp(d.down > 0 ? LYING : IDENTITY, 1 - Math.exp(-10 * dt));
      }
      v.fig.root.quaternion.copy(v.quat);
      v.fig.update(dt, this.camera);
      v.stars.update(dt, d.stun > 0 && d.down === 0);
      v.stars.root.quaternion.copy(v.quat).invert(); // stars stay level over the head
      v.fig.root.visible = !(d.down > 0 && d.down < 0.4 && Math.floor(this.time * 20) % 2 === 0); // blink before respawn
    });
  }
}
