// ---------------------------------------------------------------------------
// YeetWorld.ts
// Purpose : The toy's play world: runs the engine-free YeetSim at a fixed step and draws it: gray-box room, target
//           dummies (that shoot back in Fight Back), gun pickups, the gun in your hands, tracers, balls, screen shake,
//           the HUD, sounds, and a third-person camera while you tumble or are knocked out.
// Usage   : Registered in src/main.ts as world "main". The menu picks the level (Play = Fight Back, Sandbox =
//           shell.worldOption "sandbox"); ?level=sandbox|fight overrides it. ?play skips the title; ?play&autoplay
//           runs the scripted tour in the Sandbox (src/core/yeet/autoplay.ts) and logs YEET_AUTOPLAY_DONE.
// Notes   : PROTOTYPE (Toy tier). All feel numbers live in src/core/yeet/tuning.ts. The sim owns the rules; this
//           file only turns input into YeetInput and events into effects. Esc frees the mouse and opens pause.
//           Right mouse aims: the view zooms, mouse speed scales with the zoom, and shots fire centred (full push,
//           little twist, tight spread). Firing anything but the Gatling Copter knocks you out of zoom for the
//           recoil (AIM_KNOCK s); still holding right click, you zoom back in. ?aim holds aim during autoplay.
//           Shift sprints (stamina); one-shot presses that land in a frame with no sim step carry to the next.
//           Tumbling (run-and-gun) or knocked out: the camera pops out behind you to watch your body flail
//           (reduce motion keeps first person). Sound: src/game/yeet/sound.ts; audio starts on the first click.
//           DEBUG: ?debug logs sim events on the "yeet" channel; ?weapon=0..3 starts with that gun in hand;
//           ?tumble trips a tumble 1 s in (logs YEET_MARK_tumble 0.4 s later, ?hold=tumble freezes there).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// Updated : 2026-11-21 with Claude (Opus 5.5, claude-opus-5-5): playtest 3: levels, pickups, AI, tumbles, zoom
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { Log } from "../core/log";
import { effectiveShake } from "../core/settings";
import { Shake } from "../core/shake";
import { rayArena } from "../core/yeet/arena";
import { AUTOPLAY_SECONDS, autoplayStep } from "../core/yeet/autoplay";
import { levelById } from "../core/yeet/levels";
import { NO_INPUT, YeetSim, type YeetEvent, type YeetInput } from "../core/yeet/sim";
import { TUNING, type WeaponId } from "../core/yeet/tuning";
import { len, normalize, vec } from "../core/yeet/vec";
import { shell } from "../shell/app";
import { FpsInput, type FpsFrame } from "./fpsInput";
import type { World } from "./threeHost";
import { makeDummy, makeStars, PIVOT, type DummyFigure, type Stars } from "./yeet/figures";
import { Effects } from "./yeet/effects";
import { YeetHud } from "./yeet/hud";
import { PickupViews } from "./yeet/pickups";
import { YeetSound } from "./yeet/sound";
import { buildRoom } from "./yeet/room";
import { Viewmodel } from "./yeet/viewmodel";

// ---- Tunables (presentation only; gameplay numbers are in tuning.ts) ----------
const SUITS: Array<[string, string]> = [
  ["#e53935", "Red"], ["#1e88e5", "Blue"], ["#fdd835", "Yellow"], ["#43a047", "Green"], ["#8e24aa", "Purple"], ["#fb8c00", "Orange"],
];
const PLAYER_SUIT = "#26a69a"; // matches the first-person sleeves
const DOWN_VERB: Record<WeaponId, string> = { pistol: "PEA'D", shotgun: "BLASTED", sniper: "YEETED", copter: "SHREDDED" };
const FIRE_POP: Partial<Record<WeaponId, string>> = { shotgun: "BLAM!", sniper: "KRAK!" };
const FIRE_SOUND: Record<WeaponId, string> = { pistol: "pea", shotgun: "boom", sniper: "krak", copter: "brrt" };
const SHAKE_TO_RAD = 0.0025; // shake offset pixels -> camera wobble radians
const HARD_LANDING = 14; // m/s
const CHASE = { back: 5, up: 2.2, blend: 0.18 };
const AIM_KNOCK = 0.45; // s out of zoom after a shot (the recoil animation), then back in if right click is held // third-person camera: metres behind and above, seconds to swing out

interface DummyView {
  fig: DummyFigure;
  stars: Stars;
  quat: THREE.Quaternion;
  name: string;
  lastWeapon: WeaponId | "crash";
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const LYING = new THREE.Quaternion().setFromAxisAngle(X_AXIS, -Math.PI / 2);
/** A figure faces +Z; to face the sim's yaw it turns by yaw + PI. */
const facing = (yaw: number, out = new THREE.Quaternion()) => out.setFromAxisAngle(Y_AXIS, yaw + Math.PI);

export class YeetWorld implements World {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly autoplay = shell.params.has("autoplay");
  private readonly sim = new YeetSim(TUNING, levelById(this.autoplay ? "sandbox" : shell.params.get("level") ?? shell.worldOption));
  private readonly room = buildRoom(this.sim.arena);
  private readonly views: DummyView[] = [];
  private readonly body: DummyFigure; // you, seen from outside while tumbling
  private readonly pickups: PickupViews;
  private readonly balls: THREE.Mesh[] = [];
  private readonly ballGeo = new THREE.SphereGeometry(TUNING.ai.ballRadius, 12, 8);
  private readonly ballMat = new THREE.MeshStandardMaterial({ color: "#ff5722", emissive: "#ff3d00", emissiveIntensity: 0.6 });
  private readonly vm = new Viewmodel();
  private readonly fx: Effects;
  private readonly sound = new YeetSound();
  private readonly hud: YeetHud;
  private readonly fps: FpsInput;
  private readonly shake = new Shake({ maxOffset: 10, maxAngle: 0.04 });
  private readonly canvas: HTMLElement;
  private acc = 0;
  private time = 0;
  /** 0 (hip) .. 1 (aimed), eased toward the right mouse button. */
  private aim = 0;
  /** > 0: a shot knocked you out of zoom for this many more seconds. */
  private aimKnock = 0;
  /** One-shot presses from a frame that ran no sim step (fast monitors): used by the next step. */
  private carry: YeetInput | null = null;
  private readonly forceAim = shell.params.has("aim");
  private readonly debugTumble = shell.params.has("tumble");
  private tumbled = false;
  /** 0 = first person .. 1 = the chase camera (tumbling or knocked out). */
  private third = 0;
  private chaseYaw = 0;
  private bodyRoll = 0;
  private kos = 0;
  private killer = "";
  private autoplayDone = false;
  /** ?hold=<mark>: the tour stopped at that moment (everything frozen, still drawn). */
  private held = false;
  private readonly marks: Array<[number, string]> = [[1.0, "pistol"], [2.3, "launch"], [4.1, "spin"], [8, "copter"], [15, "crash"]];
  private stats = { hits: 0, top: 0, bonks: 0 };
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly qA = new THREE.Quaternion();
  private readonly qB = new THREE.Quaternion();
  private readonly lookM = new THREE.Matrix4();
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
    this.scene.fog = new THREE.Fog("#9fcbea", 45, 130);
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
    sc.left = sc.bottom = -28;
    sc.right = sc.top = 28;
    sc.far = 90;
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
      this.views.push({ fig, stars, quat: facing(0), name: `${name} Dummy`, lastWeapon: "pistol" });
    });
    this.body = makeDummy(PLAYER_SUIT);
    this.body.setHp(1);
    this.body.root.visible = false;
    this.scene.add(this.body.root);
    this.pickups = new PickupViews(this.scene, this.sim.pickups);

    this.fx = new Effects(this.scene);
    const host = document.getElementById("game")!;
    this.canvas = host.querySelector("canvas") ?? host;
    this.hud = new YeetHud(host, TUNING.weaponOrder.map((w) => TUNING.weapons[w].name));
    this.fps = new FpsInput(this.canvas);
    this.canvas.addEventListener("mousedown", this.onCanvasDown);
    document.addEventListener("pointerlockchange", this.onLockChange);
    // ?weapon=0..3 starts with that gun in hand (stills of each gun at rest)
    const startGun = TUNING.weaponOrder[Number(shell.params.get("weapon"))];
    if (shell.params.has("weapon") && startGun) {
      if (!this.sim.player.owned.includes(startGun)) this.sim.player.owned.push(startGun);
      this.sim.player.weapon = startGun;
    }
    this.vm.show(this.sim.player.weapon);
    this.placeCamera(0);
    Log.info("yeet", `level ${this.sim.level.id}${this.autoplay ? " (autoplay tour)" : ""}`);
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
    this.pickups.dispose();
    this.body.dispose();
    this.ballGeo.dispose();
    this.ballMat.dispose();
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
    const pl = this.sim.player;

    // input that happens once per frame goes into the first fixed step only
    const f = this.fps.take();
    if (this.forceAim) f.aimHeld = true;
    this.aimKnock = Math.max(0, this.aimKnock - dt);
    const aiming = f.aimHeld && (this.forceAim || this.aimKnock === 0) && !this.sim.helpless;
    this.updateAim(aiming, dt);
    let first = this.frameInput(f, aiming);
    if (this.carry) {
      const c = this.carry;
      first = { ...first, firePressed: first.firePressed || c.firePressed, jump: first.jump || c.jump,
        reset: first.reset || c.reset, select: first.select >= 0 ? first.select : c.select };
      this.carry = null;
    }
    let stepped = false;
    // mouse speed follows the zoom, so aimed look feels the same on screen; no look while tumbling or knocked out
    const sens = TUNING.mouseSensitivity * this.zoomFactor();
    if (!this.autoplay && this.third < 0.5) this.sim.look(-f.dx * sens, -f.dy * sens * (shell.settings.input.invert_y ? -1 : 1));

    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= TUNING.step) {
      this.acc -= TUNING.step;
      let input = first;
      if (this.autoplay) {
        const s = autoplayStep(this.sim, this.sim.time);
        if (s.aim) {
          pl.yaw = s.aim.yaw;
          pl.pitch = s.aim.pitch;
        }
        input = { ...s.input, aiming };
      }
      for (const e of this.sim.step(input)) this.onEvent(e);
      stepped = true;
      first = { ...input, jump: false, firePressed: false, select: -1, reset: false };
      this.stats.top = Math.max(this.stats.top, pl.pos.y);
    }
    if (!stepped) this.carry = first; // nothing simulated this frame: keep its clicks for the next one
    // ?tumble: trip a tumble 1 s in and mark it 0.4 s later (stills of the third-person camera)
    if (this.debugTumble && this.sim.time >= 1 && !this.tumbled) {
      this.tumbled = true;
      const evs: YeetEvent[] = [];
      this.sim.startTumble(evs);
      for (const e of evs) this.onEvent(e);
      this.marks.push([this.sim.time + 0.4, "tumble"]);
      this.marks.sort((a, b) => a[0] - b[0]);
    }
    // smoke can stop at these to screenshot a moment: --until YEET_MARK_launch (spin, copter)
    while ((this.autoplay || this.debugTumble) && this.marks.length && this.sim.time >= this.marks[0][0]) {
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
    this.drawBalls();
    this.pickups.update(dt, this.sim.pickups);
    const copterFiring = pl.weapon === "copter" && f.fireHeld && !pl.overheated && !this.sim.helpless;
    if (copterFiring) this.sound.play("wup"); // its cooldown in the events file sets the chop rate
    this.sound.update(shell.settings.audio);
    this.vm.update(dt, copterFiring);
    this.fx.update(dt);
    const speed = len(pl.vel);
    const fight = this.sim.level.dummiesFight;
    this.hud.update(dt, {
      weapon: TUNING.weaponOrder.indexOf(pl.weapon),
      heat: pl.heat / TUNING.copter.heatMax,
      overheated: pl.overheated,
      showHeat: pl.weapon === "copter" || pl.heat > 0,
      speed,
      stunned: pl.stun > 0 && this.third < 0.5,
      locked: this.fps.locked,
      autoplay: this.autoplay,
      rush: this.third > 0.5 ? 0 : Math.max(0, (speed - 10) / 14),
      reduceMotion: shell.settings.access.reduce_motion,
      scoped: this.vm.scoped,
      owned: TUNING.weaponOrder.map((w) => pl.owned.includes(w)),
      hp: fight ? pl.hp / TUNING.player.hp : null,
      banner: pl.dead > 0 ? `KNOCKED OUT by ${this.killer}` : "",
      kos: fight ? this.kos : null,
      level: this.sim.level.name,
      stamina: pl.stamina / TUNING.sprint.stamina,
      winded: pl.winded,
      tumbling: pl.tumbling > 0 && pl.dead === 0,
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
  private frameInput(f: FpsFrame, aiming: boolean): YeetInput {
    const inp = shell.input;
    const st = inp.stick();
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    let select = f.select;
    if (select < 0 && f.cycle !== 0) {
      // the wheel skips guns you do not own yet
      const owned = TUNING.weaponOrder.filter((w) => this.sim.player.owned.includes(w));
      const n = owned.length;
      const next = owned[(owned.indexOf(this.sim.player.weapon) + f.cycle + n) % n];
      select = TUNING.weaponOrder.indexOf(next);
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
      aiming,
      sprint: f.sprintHeld,
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
        // every gun but the Gatling Copter knocks you out of zoom (playtest 3)
        if (e.aimed && e.weapon !== "copter") this.aimKnock = AIM_KNOCK;
        const pop = FIRE_POP[e.weapon];
        if (pop) this.hud.pop(pop);
        this.camera.updateMatrixWorld(true);
        const from = this.third > 0.5 ? this.tmpA.set(e.tracers[0].from.x, e.tracers[0].from.y, e.tracers[0].from.z) : this.vm.muzzleWorld(this.tmpA);
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
        this.kos++;
        break;
      }
      case "respawn":
        this.views[e.dummy].fig.setHp(1);
        this.views[e.dummy].quat.copy(facing(this.sim.dummies[e.dummy].face));
        this.sound.play("popin");
        break;
      case "yeet":
        if (this.third < 0.5) this.hud.pop("YEET!");
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
      case "tumble":
        this.hud.pop("WHOA!", true);
        this.sound.play("tumble");
        break;
      case "recover":
        break;
      case "pickup":
        this.vm.show(pl.weapon);
        this.hud.pop(`GOT THE ${TUNING.weapons[e.weapon].name.toUpperCase()}!`);
        this.sound.play("pickup");
        break;
      case "dummyAim":
        this.sound.play("alert");
        break;
      case "dummyFire":
        this.sound.play("lob");
        break;
      case "ballPop":
        this.sound.play("splat");
        this.fx.puff(this.tmpA.set(e.at.x, e.at.y, e.at.z));
        break;
      case "playerHit":
        this.sound.play("ouch");
        this.hud.hurtFlash();
        this.shake.addTrauma(0.35);
        break;
      case "playerDown":
        this.killer = this.views[e.dummy]?.name ?? "a dummy";
        this.hud.feedLine("WAS KNOCKED OUT BY", this.killer);
        this.sound.play("ko");
        break;
      case "playerRespawn":
        this.vm.show(pl.weapon);
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

    // tumbling or knocked out: swing out behind you (from the direction you faced as it began) and watch
    const wantThird = (pl.tumbling > 0 || pl.dead > 0) && !shell.settings.access.reduce_motion;
    if (wantThird && this.third === 0) {
      this.chaseYaw = pl.yaw;
      this.bodyRoll = 0;
    }
    const step = dt / CHASE.blend;
    this.third = wantThird ? Math.min(1, this.third + step) : Math.max(0, this.third - step * 2);
    this.vm.root.visible = this.third < 0.5;
    this.body.root.visible = this.third > 0.05;
    if (this.third === 0) return;

    // your body: facing where you face, flipping head over heels at the sim's tumble rate
    this.bodyRoll += pl.tumbleRoll * dt;
    this.body.root.position.set(pl.pos.x, pl.pos.y + PIVOT, pl.pos.z);
    facing(pl.yaw, this.body.root.quaternion).multiply(this.qA.setFromAxisAngle(X_AXIS, this.bodyRoll));
    this.body.update(dt, this.camera);

    // the chase point, pulled in if a wall is in the way
    const mid = vec(pl.pos.x, pl.pos.y + 1, pl.pos.z);
    const want = vec(mid.x + Math.sin(this.chaseYaw) * CHASE.back, mid.y + CHASE.up, mid.z + Math.cos(this.chaseYaw) * CHASE.back);
    const d = vec(want.x - mid.x, want.y - mid.y, want.z - mid.z);
    const full = len(d);
    const dist = Math.max(0.5, Math.min(full, rayArena(this.sim.arena, mid, normalize(d), full) - 0.3));
    const k = dist / full;
    const chase = this.tmpA.set(mid.x + d.x * k, mid.y + d.y * k, mid.z + d.z * k);
    const blend = this.third * this.third * (3 - 2 * this.third);
    this.qB.copy(this.camera.quaternion);
    this.camera.position.lerp(chase, blend);
    this.lookM.lookAt(this.camera.position, this.tmpB.set(mid.x, mid.y, mid.z), Y_AXIS);
    this.qA.setFromRotationMatrix(this.lookM);
    this.camera.quaternion.copy(this.qB).slerp(this.qA, blend);
  }

  private drawDummies(dt: number): void {
    const axis = this.tmpA;
    const q = new THREE.Quaternion();
    const up = new THREE.Quaternion();
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
        facing(d.face, up);
        if (d.down > 0) up.multiply(LYING);
        v.quat.slerp(up, 1 - Math.exp(-10 * dt));
      }
      v.fig.root.quaternion.copy(v.quat);
      v.fig.setAlert(d.aiming > 0 ? 1 : 0);
      v.fig.update(dt, this.camera);
      v.stars.update(dt, d.stun > 0 && d.down === 0);
      v.stars.root.quaternion.copy(v.quat).invert(); // stars stay level over the head
      v.fig.root.visible = !(d.down > 0 && d.down < 0.4 && Math.floor(this.time * 20) % 2 === 0); // blink before respawn
    });
  }

  /** The dummies' balls: a pool of meshes, one per live ball. */
  private drawBalls(): void {
    const balls = this.sim.balls;
    while (this.balls.length < balls.length) {
      const m = new THREE.Mesh(this.ballGeo, this.ballMat);
      m.castShadow = true;
      this.scene.add(m);
      this.balls.push(m);
    }
    this.balls.forEach((m, i) => {
      m.visible = i < balls.length;
      if (m.visible) m.position.set(balls[i].pos.x, balls[i].pos.y, balls[i].pos.z);
    });
  }
}
