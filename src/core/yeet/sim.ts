// ---------------------------------------------------------------------------
// sim.ts
// Purpose : Yeetpowder's toy simulation, engine-free: the player's run/jump/recoil movement, the four guns (Pea
//           Pistol, Boomstick, Spin Doctor, Gatling Copter prototype), wall bonks, run-and-gun tumbles, gun pickups,
//           and target dummies that get knocked flying and (in Fight Back) shoot back. The renderer
//           (src/game/YeetWorld.ts) only draws what this produces.
// Usage   : const sim = new YeetSim(TUNING, fightLevel());       // or sandboxLevel() (src/core/yeet/levels.ts)
//           each fixed step: const events = sim.step(input)    // input: YeetInput, events: YeetEvent[]
//           mouse look between steps: sim.look(dYaw, dPitch)
// Notes   : No three import, fixed step (TUNING.step). Chance rolls (tumbles) come from a seeded Park-Miller
//           generator, so the same level + the same inputs give the same run, and a scripted browser run replays
//           exactly in Vitest (tests/yeetSim.test.ts). Every body has mass 1: recoil and knockback are velocity kicks.
//           Yaw going down turns you right; hip fire twists you right (the gun sits right of your centre).
//
// Pseudocode (player step):
//   knocked out? count down, respawn (Fight Back resets your guns and the pickups) ; stunned or tumbling? no control
//   weapon keys -> switch to a gun you own (not while crashing)
//   ground: accelerate toward WASD * runSpeed; above run speed slide down with friction (recoil keeps its speed)
//   air: small air control, light drag ; jump if grounded
//   fire: vel -= aim * recoil (mid-air: * airRecoil) ; grounded: + hop ; spin -= twist (aimed: much less)
//         hitscan pellets -> dummies take damage + knockback ; moving fast? roll for a tumble
//   copter: while held vel -= aim * thrust*dt, heat up, turn right, aim wobbles; overheat -> crash -> landing hurts
//   yaw += spin*dt, spin decays ; gravity ; move through the room ; fast wall hit -> bonk stun + bounce
//   walk over a pickup -> own that gun
// Pseudocode (Fight Back dummy):
//   turn toward you ; can see you, standing still, cooled down -> glow (telegraph) -> throw a ball at your chest
//   knocked about while glowing -> the shot is cancelled ; ball hits you -> damage + knockback ; 0 hp -> knocked out
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// Updated : 2026-11-21 with Claude (Opus 5.5, claude-opus-5-5): playtest 3: levels, pickups, twist, tumbles, AI
// ---------------------------------------------------------------------------
import { moveBody, rayArena, rayBox } from "./arena";
import type { Level } from "./levels";
import type { Tuning, WeaponId, WeaponTuning } from "./tuning";
import { addScaled, aimDir, copy, len, lenXZ, normalize, spreadDir, vec, type Vec3 } from "./vec";

export interface YeetInput {
  /** -1..1: strafe right is +x, forward is +z (WASD / stick). */
  moveX: number;
  moveZ: number;
  jump: boolean;
  /** Fire pressed this step (semi-auto guns). */
  firePressed: boolean;
  /** Fire held (auto guns, the copter). */
  fireHeld: boolean;
  /** 0..3 to switch weapon this step, or -1. */
  select: number;
  /** Respawn the player (R). */
  reset: boolean;
  /** Right mouse held: aimed fire (the gun is centred: full push, little twist, tight spread). */
  aiming: boolean;
  /** Shift held: sprint while stamina lasts. */
  sprint: boolean;
  /** Reload the current gun (R). */
  reload: boolean;
}

export const NO_INPUT: YeetInput = {
  moveX: 0, moveZ: 0, jump: false, firePressed: false, fireHeld: false, select: -1, reset: false, aiming: false, sprint: false, reload: false,
};

export interface Tracer {
  from: Vec3;
  to: Vec3;
  hit: boolean;
}

export type YeetEvent =
  | { type: "fire"; weapon: WeaponId; tracers: Tracer[]; aimed: boolean }
  | { type: "yeet"; speed: number }
  | { type: "bonk"; who: "player" | number; at: Vec3; speed: number }
  | { type: "land"; speed: number }
  | { type: "hit"; dummy: number; damage: number; at: Vec3 }
  | { type: "down"; dummy: number }
  | { type: "respawn"; dummy: number }
  | { type: "overheat" }
  | { type: "crash"; at: Vec3; hits: number }
  | { type: "switch"; weapon: WeaponId }
  | { type: "playerRespawn" }
  | { type: "tumble" }
  | { type: "recover" }
  | { type: "pickup"; weapon: WeaponId }
  | { type: "dummyAim"; dummy: number }
  | { type: "dummyFire"; dummy: number }
  | { type: "ballPop"; at: Vec3 }
  | { type: "playerHit"; dummy: number; damage: number; at: Vec3 }
  | { type: "playerDown"; dummy: number }
  | { type: "reload"; weapon: WeaponId }
  | { type: "reloaded"; weapon: WeaponId }
  | { type: "dry"; weapon: WeaponId };

export interface PlayerState {
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  pitch: number;
  /** Yaw spin rate (rad/s) from recoil twist; negative turns right. */
  spin: number;
  onGround: boolean;
  stun: number;
  weapon: WeaponId;
  /** Guns you can switch to (Fight Back starts you with two). */
  owned: WeaponId[];
  cooldown: number;
  heat: number;
  /** Overheated: crashing until landed, then locked out until fully cooled. */
  crashing: boolean;
  overheated: boolean;
  /** "YEET!" fired for this launch already (re-arms once speed drops). */
  yeeted: boolean;
  hp: number;
  /** > 0 while knocked out: seconds until you respawn. */
  dead: number;
  /** > 0 while tumbling (run-and-gun): seconds of no control left. */
  tumbling: number;
  tumbleAge: number;
  /** Head-over-heels rate (rad/s) for the third-person body while tumbling. */
  tumbleRoll: number;
  /** Seconds of sprint left, and whether you are sprinting this step. */
  stamina: number;
  sprinting: boolean;
  /** Emptied the stamina: no sprint until it refills past sprint.winded. */
  winded: boolean;
  sprintRest: number;
  /** Rounds left in each gun's magazine (reserve is infinite). */
  mag: Record<WeaponId, number>;
  /** > 0 while reloading the current gun: seconds left. */
  reloading: number;
}

export interface DummyState {
  pos: Vec3;
  vel: Vec3;
  spawn: Vec3;
  hp: number;
  onGround: boolean;
  stun: number;
  /** > 0 while down (seconds until respawn). */
  down: number;
  /** Visual tumble rate (rad/s), set by hits, decays. */
  tumble: number;
  /** Which way it faces (yaw, the player's convention). */
  face: number;
  /** > 0 while glowing before a shot (seconds left). */
  aiming: number;
  aiCooldown: number;
}

export interface Ball {
  pos: Vec3;
  vel: Vec3;
  life: number;
  owner: number;
}

export interface PickupState {
  weapon: WeaponId;
  pos: Vec3;
  taken: boolean;
}

const PM_M = 2147483647; // Park-Miller modulus (2^31 - 1)
const PM_A = 16807;
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class YeetSim {
  readonly player: PlayerState;
  readonly dummies: DummyState[];
  readonly balls: Ball[] = [];
  readonly pickups: PickupState[];
  /** Simulated seconds since start. */
  time = 0;
  private seed: number;

  constructor(
    readonly t: Tuning,
    readonly level: Level,
  ) {
    this.seed = Math.max(1, Math.floor(level.seed) % PM_M);
    const s = level.spawn;
    this.player = {
      pos: copy(s), vel: vec(), yaw: level.spawnYaw, pitch: 0, spin: 0, onGround: true, stun: 0,
      weapon: level.startWeapons[0], owned: [...level.startWeapons], cooldown: 0, heat: 0, crashing: false,
      overheated: false, yeeted: false, hp: t.player.hp, dead: 0, tumbling: 0, tumbleAge: 0, tumbleRoll: 0,
      stamina: t.sprint.stamina, sprinting: false, winded: false, sprintRest: 0,
      mag: this.fullMags(), reloading: 0,
    };
    this.dummies = level.arena.dummySpawns.map((sp, i) => ({
      pos: copy(sp), vel: vec(), spawn: copy(sp), hp: t.dummy.hp, onGround: true, stun: 0, down: 0, tumble: 0,
      face: 0, aiming: 0, aiCooldown: 1.5 + i * 0.45,
    }));
    this.pickups = level.pickups.map((p) => ({ weapon: p.weapon, pos: copy(p.pos), taken: false }));
  }

  private fullMags(): Record<WeaponId, number> {
    const w = this.t.weapons;
    return { pistol: w.pistol.mag, shotgun: w.shotgun.mag, sniper: w.sniper.mag, copter: w.copter.mag };
  }

  get arena() {
    return this.level.arena;
  }

  /** A number in [0, 1) from the run's seeded generator (deterministic). */
  rand(): number {
    this.seed = (this.seed * PM_A) % PM_M;
    return (this.seed - 1) / (PM_M - 1);
  }

  /** Mouse/stick look, applied between steps (rad). */
  look(dYaw: number, dPitch: number): void {
    const pl = this.player;
    pl.yaw += dYaw;
    pl.pitch = Math.max(-this.t.player.maxPitch, Math.min(this.t.player.maxPitch, pl.pitch + dPitch));
  }

  get weaponTuning(): WeaponTuning {
    return this.t.weapons[this.player.weapon];
  }

  /** No control right now (stunned, tumbling or knocked out). */
  get helpless(): boolean {
    const pl = this.player;
    return pl.stun > 0 || pl.tumbling > 0 || pl.dead > 0;
  }

  eye(): Vec3 {
    const p = this.player.pos;
    return vec(p.x, p.y + this.t.player.eyeHeight, p.z);
  }

  step(input: YeetInput): YeetEvent[] {
    const ev: YeetEvent[] = [];
    const dt = this.t.step;
    this.time += dt;
    this.stepPlayer(input, dt, ev);
    this.dummies.forEach((d, i) => this.stepDummy(d, i, dt, ev));
    this.stepBalls(dt, ev);
    return ev;
  }

  // ---- player ----------------------------------------------------------------
  private stepPlayer(input: YeetInput, dt: number, ev: YeetEvent[]): void {
    const t = this.t;
    const pl = this.player;
    if (input.reset && pl.dead === 0) {
      this.respawnPlayer(false);
      ev.push({ type: "playerRespawn" });
      return;
    }
    if (pl.dead > 0) {
      pl.dead -= dt;
      if (pl.dead <= 0) {
        this.respawnPlayer(true);
        ev.push({ type: "playerRespawn" });
        return;
      }
    }
    if (pl.stun > 0) pl.stun = Math.max(0, pl.stun - dt);
    if (pl.tumbling > 0) {
      pl.tumbling = Math.max(0, pl.tumbling - dt);
      pl.tumbleAge += dt;
      pl.tumbleRoll *= Math.exp(-0.8 * dt);
    }
    const control = !this.helpless;

    if (control && input.select >= 0 && input.select < t.weaponOrder.length && !pl.crashing) {
      const w = t.weaponOrder[input.select];
      if (w !== pl.weapon && pl.owned.includes(w)) {
        pl.weapon = w;
        pl.reloading = 0; // switching guns drops a reload in progress
        pl.cooldown = Math.max(pl.cooldown, 0.1);
        ev.push({ type: "switch", weapon: w });
      }
    }

    const speedBefore = lenXZ(pl.vel);
    this.updateSprint(control ? input : NO_INPUT, dt);
    this.runAndJump(control ? input : NO_INPUT, dt);
    this.fireWeapons(control ? input : NO_INPUT, speedBefore, dt, ev);

    // recoil twist: the camera and body turn, then settle
    pl.yaw += pl.spin * dt;
    pl.spin *= Math.exp(-t.player.spinDamping * dt);
    if (Math.abs(pl.spin) < 0.01) pl.spin = 0;

    pl.vel.y -= t.gravity * dt;
    const res = moveBody(this.arena, pl.pos, pl.vel, dt, t.player.halfWidth, t.player.height);
    if (res.onGround && !pl.onGround && res.landSpeed > 4) ev.push({ type: "land", speed: res.landSpeed });
    pl.onGround = res.onGround;

    if (res.wallImpact >= t.bonk.speed && res.wallNormal) {
      pl.stun = Math.max(pl.stun, t.bonk.stun);
      addScaled(pl.vel, res.wallNormal, res.wallImpact * t.bonk.bounce);
      ev.push({ type: "bonk", who: "player", at: copy(pl.pos), speed: res.wallImpact });
    }

    if (pl.crashing && pl.onGround) this.crashLand(ev);

    // a tumble ends once its time is up and you are back on your feet (or it has gone on too long)
    if (pl.tumbleAge > 0 && pl.dead === 0 && ((pl.tumbling === 0 && pl.onGround) || pl.tumbleAge >= t.tumble.maxDuration)) {
      pl.tumbling = 0;
      pl.tumbleAge = 0;
      pl.tumbleRoll = 0;
      ev.push({ type: "recover" });
    }

    const speed = len(pl.vel);
    if (!pl.yeeted && speed >= t.yeetSpeed) {
      pl.yeeted = true;
      ev.push({ type: "yeet", speed });
    } else if (pl.yeeted && speed < t.yeetSpeed * 0.5) {
      pl.yeeted = false;
    }

    if (pl.dead === 0) this.checkPickups(ev);

    if (pl.pos.y < -30) {
      this.respawnPlayer(false);
      ev.push({ type: "playerRespawn" });
    }
  }

  /** Shift + moving forward on the ground: sprint while stamina lasts; it refills after a short rest. */
  private updateSprint(input: YeetInput, dt: number): void {
    const s = this.t.sprint;
    const pl = this.player;
    pl.sprinting = input.sprint && input.moveZ > 0.1 && pl.onGround && !pl.winded && pl.stamina > 0;
    if (pl.sprinting) {
      pl.stamina = Math.max(0, pl.stamina - dt);
      pl.sprintRest = 0;
      if (pl.stamina === 0) pl.winded = true;
    } else {
      pl.sprintRest += dt;
      if (pl.sprintRest >= s.regenDelay) pl.stamina = Math.min(s.stamina, pl.stamina + s.regen * dt);
      if (pl.winded && pl.stamina >= s.stamina * s.winded) pl.winded = false;
    }
  }

  private runAndJump(input: YeetInput, dt: number): void {
    const t = this.t.player;
    const pl = this.player;
    const runSpeed = pl.sprinting ? this.t.sprint.speed : t.runSpeed;
    // WASD relative to where the player faces (yaw only)
    const fx = -Math.sin(pl.yaw);
    const fz = -Math.cos(pl.yaw);
    let wx = fx * input.moveZ + -fz * input.moveX;
    let wz = fz * input.moveZ + fx * input.moveX;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) {
      wx /= wl;
      wz /= wl;
    }
    const h = lenXZ(pl.vel);
    if (pl.onGround) {
      if (h > runSpeed + 0.01) {
        // sliding from a launch: bleed speed, steer a little
        const drop = Math.min(h - runSpeed, t.groundFriction * this.t.step);
        const k = (h - drop) / h;
        pl.vel.x *= k;
        pl.vel.z *= k;
        this.airSteer(wx, wz, t.airAccel * 2, dt);
      } else {
        const tx = wx * runSpeed;
        const tz = wz * runSpeed;
        const dx = tx - pl.vel.x;
        const dz = tz - pl.vel.z;
        const dl = Math.hypot(dx, dz);
        const maxStep = t.groundAccel * dt;
        if (dl <= maxStep) {
          pl.vel.x = tx;
          pl.vel.z = tz;
        } else {
          pl.vel.x += (dx / dl) * maxStep;
          pl.vel.z += (dz / dl) * maxStep;
        }
      }
      if (input.jump) {
        pl.vel.y = Math.max(pl.vel.y, t.jumpSpeed);
        pl.onGround = false;
      }
    } else {
      this.airSteer(wx, wz, t.airAccel, dt);
      const k = Math.exp(-t.airDrag * dt);
      pl.vel.x *= k;
      pl.vel.z *= k;
      if (pl.vel.y > 0) pl.vel.y *= k;
    }
  }

  /** Quake-style air control: add speed along the wish direction only up to run speed along it. */
  private airSteer(wx: number, wz: number, accel: number, dt: number): void {
    if (wx === 0 && wz === 0) return;
    const pl = this.player;
    const along = pl.vel.x * wx + pl.vel.z * wz;
    const add = Math.min(this.t.player.runSpeed - along, accel * dt);
    if (add <= 0) return;
    pl.vel.x += wx * add;
    pl.vel.z += wz * add;
  }

  private fireWeapons(input: YeetInput, speedBefore: number, dt: number, ev: YeetEvent[]): void {
    const t = this.t;
    const pl = this.player;
    const w = this.weaponTuning;
    pl.cooldown = Math.max(0, pl.cooldown - dt);
    // reloading: count down, then a full magazine (reserve ammo is infinite for now)
    if (pl.reloading > 0) {
      pl.reloading = Math.max(0, pl.reloading - dt);
      if (pl.reloading === 0) {
        pl.mag[pl.weapon] = w.mag;
        ev.push({ type: "reloaded", weapon: pl.weapon });
      }
    } else if (input.reload && pl.mag[pl.weapon] < w.mag && !pl.crashing) {
      this.startReload(ev);
    }
    const loaded = pl.reloading === 0 && pl.mag[pl.weapon] > 0;

    const copterFiring = pl.weapon === "copter" && input.fireHeld && !pl.crashing && !pl.overheated && loaded;
    if (copterFiring) {
      // continuous push opposite the aim: aim at the floor to lift, tilt to drift (wobbly by design)
      addScaled(pl.vel, aimDir(pl.yaw, pl.pitch), -t.copter.thrust * dt);
      const k = Math.exp(-t.copter.drag * dt);
      pl.vel.x *= k;
      pl.vel.y *= k;
      pl.vel.z *= k;
      // it fights you: turns you right and makes the aim wander (smooth, deterministic noise)
      const b = t.aim.braced;
      pl.spin -= t.copter.torque * (input.aiming ? b.copterTurn : 1) * dt;
      const n = this.time;
      const wob = t.copter.wobble * (input.aiming ? b.copterWobble : 1) * dt;
      this.look(Math.cos(n * 5.7 + 1) * wob, (Math.sin(n * 7.3) + Math.sin(n * 12.1) * 0.5) * wob);
      pl.heat += t.copter.heatPerSecond * dt;
      if (pl.heat >= t.copter.heatMax) {
        pl.heat = t.copter.heatMax;
        pl.crashing = true;
        pl.overheated = true;
        ev.push({ type: "overheat" });
      }
    } else if (!pl.crashing) {
      pl.heat = Math.max(0, pl.heat - t.copter.coolPerSecond * dt);
      if (pl.overheated && pl.heat === 0) pl.overheated = false;
    }
    if (pl.crashing) pl.spin = -t.copter.crashSpin;

    const wants = w.auto ? input.fireHeld : input.firePressed;
    if (!wants || pl.cooldown > 0) return;
    if (!loaded) {
      // pulling the trigger on an empty gun: click, and start reloading
      if (pl.reloading === 0 && !pl.crashing && (input.firePressed || pl.weapon !== "copter")) {
        ev.push({ type: "dry", weapon: pl.weapon });
        this.startReload(ev);
      }
      return;
    }
    if (pl.weapon === "copter" && !copterFiring) return;
    pl.cooldown = w.cooldown;
    pl.mag[pl.weapon]--;
    this.shoot(w, input, speedBefore, ev);
    if (pl.mag[pl.weapon] === 0) this.startReload(ev); // the last round: reload on its own
  }

  private startReload(ev: YeetEvent[]): void {
    const pl = this.player;
    pl.reloading = this.weaponTuning.reload;
    ev.push({ type: "reload", weapon: pl.weapon });
  }

  /** One shot of the current gun: recoil and twist on the shooter, hitscan pellets, maybe a run-and-gun tumble. */
  private shoot(w: WeaponTuning, input: YeetInput, speedBefore: number, ev: YeetEvent[]): void {
    const t = this.t;
    const pl = this.player;
    const b = t.aim.braced;
    const aimed = input.aiming;
    const aim = aimDir(pl.yaw, pl.pitch);
    const grounded = pl.onGround;
    const kick = addScaled(vec(), aim, -w.recoil * (aimed ? b.recoil : 1) * (grounded ? 1 : w.airRecoil));
    // mid-air, a small gun can slow your fall but not lift you past airLiftCap (no pistol jetpack)
    if (!grounded && kick.y > 0) kick.y = Math.min(kick.y, Math.max(0, w.airLiftCap - pl.vel.y));
    addScaled(pl.vel, kick, 1);
    const hop = grounded ? w.hop * (aimed ? b.hop : 1) : 0;
    if (hop > 0) {
      pl.vel.y = Math.max(pl.vel.y, 0) + hop;
      pl.onGround = false;
    }
    if (w.recoil > 0 && pl.onGround && aim.y < 0) pl.onGround = false; // a floor shot leaves the floor this step
    // hip fire twists you right; aimed, the gun is centred; in mid-air, some guns twist harder (airTwist)
    pl.spin -= w.twist * (aimed ? w.aimedTwist : 1) * (grounded ? 1 : w.airTwist);

    const from = this.eye();
    const tracers: Tracer[] = [];
    const spread = w.spread * (aimed ? b.spread : 1);
    for (let i = 0; i < w.pellets; i++) {
      const dir = this.pelletDir(w, i, spread);
      tracers.push(this.castPellet(from, dir, w, ev));
    }
    ev.push({ type: "fire", weapon: pl.weapon, tracers, aimed });

    // run-and-gun: firing while moving may send you tumbling (not the copter: it kicks you out of zoom instead)
    const moving = speedBefore >= t.tumble.minSpeed && Math.abs(input.moveX) + Math.abs(input.moveZ) > 0.1;
    if (moving && pl.weapon !== "copter" && pl.tumbling === 0) {
      const chance = this.tumbleChance(w, speedBefore, aimed, pl.sprinting);
      if (this.rand() < chance) this.startTumble(ev);
    }
  }

  /** The chance a shot fired at speed (m/s) knocks you into a tumble. */
  tumbleChance(w: WeaponTuning, speed: number, aimed: boolean, sprinting = false): number {
    const tt = this.t.tumble;
    const c = Math.min(tt.max, tt.base * (w.recoil / 15) * (speed / this.t.player.runSpeed));
    return Math.min(0.95, c * (aimed ? tt.aimed : 1) * (sprinting ? this.t.sprint.tumbleMult : 1));
  }

  /** Knocks the player into a tumble now (run-and-gun; also the ?tumble debug hook). */
  startTumble(ev: YeetEvent[]): void {
    const tt = this.t.tumble;
    const pl = this.player;
    pl.tumbling = tt.duration;
    pl.tumbleAge = 1e-6;
    pl.tumbleRoll = tt.roll;
    pl.vel.y = Math.max(pl.vel.y, 0) + tt.pop;
    pl.spin -= tt.spin;
    pl.onGround = false;
    ev.push({ type: "tumble" });
  }

  /** Deterministic pellet pattern: the centre, then two rings (no randomness, so runs replay). */
  private pelletDir(w: WeaponTuning, i: number, spread: number): Vec3 {
    const pl = this.player;
    if (i === 0 || spread === 0) {
      if (spread === 0) return aimDir(pl.yaw, pl.pitch);
      // auto guns: a small fixed wobble cycling with time, so the stream looks like a stream
      const k = Math.floor(this.time / this.t.step);
      return spreadDir(pl.yaw, pl.pitch, Math.sin(k * 2.39) * spread * 0.5, Math.cos(k * 1.71) * spread * 0.5);
    }
    const n = w.pellets - 1;
    const a = ((i - 1) / n) * Math.PI * 2;
    const r = spread * (i % 2 ? 1 : 0.55);
    return spreadDir(pl.yaw, pl.pitch, Math.cos(a) * r, Math.sin(a) * r);
  }

  private castPellet(from: Vec3, dir: Vec3, w: WeaponTuning, ev: YeetEvent[]): Tracer {
    const t = this.t;
    let dist = rayArena(this.arena, from, dir, w.range);
    let target = -1;
    this.dummies.forEach((d, i) => {
      if (d.down > 0) return;
      const hw = t.player.halfWidth;
      const hitT = rayBox(from, dir, vec(d.pos.x - hw, d.pos.y, d.pos.z - hw), vec(d.pos.x + hw, d.pos.y + t.player.height, d.pos.z + hw));
      if (hitT < dist) {
        dist = hitT;
        target = i;
      }
    });
    const to = addScaled(copy(from), dir, dist);
    if (target >= 0) this.hitDummy(target, dir, w.damage, w.knockback, to, ev);
    return { from, to, hit: target >= 0 };
  }

  private hitDummy(i: number, dir: Vec3, damage: number, knockback: number, at: Vec3, ev: YeetEvent[]): void {
    const d = this.dummies[i];
    addScaled(d.vel, dir, knockback);
    d.vel.y += this.t.dummy.lift * Math.min(1, knockback / 4);
    d.onGround = false;
    d.tumble += knockback * 0.8;
    d.hp -= damage;
    ev.push({ type: "hit", dummy: i, damage, at });
    if (d.hp <= 0 && d.down === 0) {
      d.down = this.level.dummyRespawn;
      d.aiming = 0;
      d.vel.y += 4; // one last comedic hop
      d.tumble += 10;
      ev.push({ type: "down", dummy: i });
    }
  }

  private crashLand(ev: YeetEvent[]): void {
    const c = this.t.copter;
    const pl = this.player;
    pl.crashing = false;
    pl.spin = -c.crashSpin * 0.5;
    let hits = 0;
    this.dummies.forEach((d, i) => {
      if (d.down > 0) return;
      const dx = d.pos.x - pl.pos.x;
      const dz = d.pos.z - pl.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > c.crashRadius || Math.abs(d.pos.y - pl.pos.y) > 2.5) return;
      const dir = dist > 0.01 ? vec(dx / dist, 0.6, dz / dist) : vec(0, 1, 0);
      this.hitDummy(i, dir, c.crashDamage, c.crashKnockback, copy(d.pos), ev);
      hits++;
    });
    ev.push({ type: "crash", at: copy(pl.pos), hits });
  }

  private checkPickups(ev: YeetEvent[]): void {
    const pl = this.player;
    const mid = vec(pl.pos.x, pl.pos.y + 0.85, pl.pos.z);
    for (const p of this.pickups) {
      if (p.taken) continue;
      const d = Math.hypot(mid.x - p.pos.x, mid.y - (p.pos.y + 0.5), mid.z - p.pos.z);
      if (d > this.t.pickupRadius) continue;
      p.taken = true;
      if (!pl.owned.includes(p.weapon)) pl.owned.push(p.weapon);
      pl.mag[p.weapon] = this.t.weapons[p.weapon].mag;
      if (!pl.crashing) {
        pl.weapon = p.weapon;
        pl.cooldown = Math.max(pl.cooldown, 0.15);
      }
      ev.push({ type: "pickup", weapon: p.weapon });
    }
  }

  /** Back to the start. fullReset (after being knocked out): your guns and the level's pickups reset too. */
  respawnPlayer(fullReset: boolean): void {
    const pl = this.player;
    const lv = this.level;
    pl.pos = copy(lv.spawn);
    pl.vel = vec();
    pl.yaw = lv.spawnYaw;
    pl.pitch = 0;
    pl.spin = 0;
    pl.stun = 0;
    pl.crashing = false;
    pl.tumbling = 0;
    pl.tumbleAge = 0;
    pl.tumbleRoll = 0;
    pl.dead = 0;
    pl.hp = this.t.player.hp;
    pl.onGround = true;
    pl.stamina = this.t.sprint.stamina;
    pl.winded = false;
    pl.reloading = 0;
    pl.mag = this.fullMags();
    if (fullReset) {
      pl.owned = [...lv.startWeapons];
      if (!pl.owned.includes(pl.weapon)) pl.weapon = pl.owned[0];
      pl.heat = 0;
      pl.overheated = false;
      for (const p of this.pickups) p.taken = false;
      this.balls.length = 0;
    }
  }

  // ---- dummies ---------------------------------------------------------------
  private stepDummy(d: DummyState, i: number, dt: number, ev: YeetEvent[]): void {
    const t = this.t;
    if (d.down > 0) {
      d.down -= dt;
      if (d.down <= 0) {
        d.down = 0;
        d.pos = copy(d.spawn);
        d.vel = vec();
        d.hp = t.dummy.hp;
        d.tumble = 0;
        d.stun = 0;
        d.aiming = 0;
        d.aiCooldown = 1.5;
        ev.push({ type: "respawn", dummy: i });
        return;
      }
    }
    d.stun = Math.max(0, d.stun - dt);
    d.tumble *= Math.exp(-2.5 * dt);
    if (d.onGround) {
      const h = lenXZ(d.vel);
      if (h > 0) {
        const k = Math.max(0, h - t.player.groundFriction * 1.5 * dt) / h;
        d.vel.x *= k;
        d.vel.z *= k;
      }
    } else {
      const k = Math.exp(-t.player.airDrag * dt);
      d.vel.x *= k;
      d.vel.z *= k;
    }
    d.vel.y -= t.gravity * dt;
    const res = moveBody(this.arena, d.pos, d.vel, dt, t.player.halfWidth, t.player.height);
    d.onGround = res.onGround;
    if (res.wallImpact >= t.bonk.speed && res.wallNormal) {
      d.stun = t.bonk.stun * 2; // dummies stay dizzy a bit longer: it reads better from across the room
      addScaled(d.vel, res.wallNormal, res.wallImpact * t.bonk.bounce);
      ev.push({ type: "bonk", who: i, at: copy(d.pos), speed: res.wallImpact });
    }
    if (d.pos.y < -30) {
      d.pos = copy(d.spawn);
      d.vel = vec();
    }
    if (this.level.dummiesFight && d.down === 0) this.think(d, i, dt, ev);
  }

  /** Fight Back: face the player, telegraph, throw a ball. Knocked about while glowing cancels the shot. */
  private think(d: DummyState, i: number, dt: number, ev: YeetEvent[]): void {
    const ai = this.t.ai;
    const pl = this.player;
    const tx = pl.pos.x - d.pos.x;
    const tz = pl.pos.z - d.pos.z;
    const want = Math.atan2(-tx, -tz);
    const diff = wrapAngle(want - d.face);
    d.face = wrapAngle(d.face + Math.sign(diff) * Math.min(Math.abs(diff), ai.turnRate * dt));
    d.aiCooldown -= dt;
    const steady = d.onGround && d.stun === 0 && len(d.vel) < 2;
    if (pl.dead > 0 || !steady) {
      if (d.aiming > 0) d.aiCooldown = Math.max(d.aiCooldown, 1);
      d.aiming = 0;
      return;
    }
    if (d.aiming > 0) {
      d.aiming -= dt;
      if (d.aiming <= 0) {
        d.aiming = 0;
        this.throwBall(d, i, ev);
      }
      return;
    }
    if (d.aiCooldown <= 0 && this.sees(d)) {
      d.aiming = ai.telegraph;
      ev.push({ type: "dummyAim", dummy: i });
    }
  }

  private dummyEye(d: DummyState): Vec3 {
    return vec(d.pos.x, d.pos.y + 1.4, d.pos.z);
  }

  private playerChest(): Vec3 {
    const p = this.player.pos;
    return vec(p.x, p.y + 1.0, p.z);
  }

  /** In range and nothing solid in between. */
  sees(d: DummyState): boolean {
    const from = this.dummyEye(d);
    const to = this.playerChest();
    const delta = vec(to.x - from.x, to.y - from.y, to.z - from.z);
    const dist = len(delta);
    if (dist > this.t.ai.range || dist < 0.01) return false;
    return rayArena(this.arena, from, normalize(delta), dist) >= dist - 0.01;
  }

  private throwBall(d: DummyState, i: number, ev: YeetEvent[]): void {
    const ai = this.t.ai;
    const from = this.dummyEye(d);
    const to = this.playerChest();
    const dir = normalize(vec(to.x - from.x, to.y - from.y, to.z - from.z));
    this.balls.push({ pos: addScaled(copy(from), dir, 0.6), vel: addScaled(vec(), dir, ai.ballSpeed), life: ai.ballLife, owner: i });
    d.aiCooldown = ai.cooldown + ((i * 0.37) % 0.8);
    ev.push({ type: "dummyFire", dummy: i });
  }

  private stepBalls(dt: number, ev: YeetEvent[]): void {
    const t = this.t;
    const pl = this.player;
    const r = t.ai.ballRadius;
    const hw = t.player.halfWidth + r;
    for (let k = this.balls.length - 1; k >= 0; k--) {
      const b = this.balls[k];
      addScaled(b.pos, b.vel, dt);
      b.life -= dt;
      const p = b.pos;
      // the player (a box grown by the ball's radius)
      if (pl.dead === 0 && Math.abs(p.x - pl.pos.x) < hw && Math.abs(p.z - pl.pos.z) < hw && p.y > pl.pos.y - r && p.y < pl.pos.y + t.player.height + r) {
        this.hitPlayer(b, ev);
        this.balls.splice(k, 1);
        continue;
      }
      const solid = this.arena.boxes.some((bx) => p.x > bx.min.x && p.x < bx.max.x && p.y > bx.min.y && p.y < bx.max.y && p.z > bx.min.z && p.z < bx.max.z);
      if (solid) ev.push({ type: "ballPop", at: copy(p) });
      if (solid || b.life <= 0) this.balls.splice(k, 1);
    }
  }

  private hitPlayer(b: Ball, ev: YeetEvent[]): void {
    const ai = this.t.ai;
    const pl = this.player;
    const dir = normalize(b.vel);
    addScaled(pl.vel, dir, ai.knockback);
    pl.vel.y += 1.5;
    pl.onGround = false;
    pl.hp -= ai.damage;
    ev.push({ type: "playerHit", dummy: b.owner, damage: ai.damage, at: copy(b.pos) });
    if (pl.hp <= 0) {
      pl.hp = 0;
      pl.dead = this.t.player.respawnDelay;
      pl.crashing = false;
      // knocked out: fly off in a tumble the third-person camera can watch
      pl.tumbling = this.t.player.respawnDelay;
      pl.tumbleAge = 1e-6;
      pl.tumbleRoll = this.t.tumble.roll;
      addScaled(pl.vel, dir, ai.knockback);
      pl.vel.y += 5;
      ev.push({ type: "playerDown", dummy: b.owner });
    }
  }
}
