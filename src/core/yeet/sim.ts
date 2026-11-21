// ---------------------------------------------------------------------------
// sim.ts
// Purpose : Yeetpowder's toy simulation, engine-free: the player's run/jump/recoil movement, the four guns (Pea
//           Pistol, Boomstick, Spin Doctor, Gatling Copter prototype), wall bonks, and target dummies that get
//           knocked flying. The renderer (src/game/YeetWorld.ts) only draws what this produces.
// Usage   : const sim = new YeetSim(TUNING, testRoom());
//           each fixed step: const events = sim.step(input)    // input: YeetInput, events: YeetEvent[]
//           mouse look between steps: sim.look(dYaw, dPitch)
// Notes   : No three import, fixed step (TUNING.step), no randomness: the same inputs give the same run, so a
//           scripted run in the browser replays exactly in Vitest (tests/yeetSim.test.ts).
//           Every body has mass 1, so recoil and knockback are direct velocity kicks.
//
// Pseudocode (player step):
//   stunned? count down, ignore move and fire
//   weapon keys -> switch (not while crashing)
//   ground: accelerate toward WASD * runSpeed; above run speed slide down with friction (recoil keeps its speed)
//   air: small air control, light drag
//   jump if grounded
//   fire: vel -= aim * recoil ; spin += weapon spin ; hitscan pellets -> dummies take damage + knockback
//         aimed (right mouse) = braced: less recoil, spin and hop, tighter spread (TUNING.aim.braced)
//   copter: while held vel -= aim * thrust*dt, heat up; overheat -> crash (forced spin) -> landing hurts nearby
//   yaw += spin*dt, spin decays ; gravity ; move through the room ; fast wall hit -> bonk stun + bounce
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { moveBody, rayArena, rayBox, type Arena } from "./arena";
import type { Tuning, WeaponId, WeaponTuning } from "./tuning";
import { addScaled, aimDir, copy, len, lenXZ, spreadDir, vec, type Vec3 } from "./vec";

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
  /** Right mouse held: aimed (braced) fire instead of hip fire. */
  aiming: boolean;
}

export const NO_INPUT: YeetInput = {
  moveX: 0, moveZ: 0, jump: false, firePressed: false, fireHeld: false, select: -1, reset: false, aiming: false,
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
  | { type: "playerRespawn" };

export interface PlayerState {
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  pitch: number;
  /** Yaw spin rate (rad/s) from recoil. */
  spin: number;
  onGround: boolean;
  stun: number;
  weapon: WeaponId;
  cooldown: number;
  heat: number;
  /** Overheated: crashing until landed, then locked out until fully cooled. */
  crashing: boolean;
  overheated: boolean;
  /** "YEET!" fired for this launch already (re-arms once speed drops). */
  yeeted: boolean;
  /** Alternates spin direction shot to shot. */
  spinSign: number;
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
}

export class YeetSim {
  readonly player: PlayerState;
  readonly dummies: DummyState[];
  /** Simulated seconds since start. */
  time = 0;

  constructor(
    readonly t: Tuning,
    readonly arena: Arena,
  ) {
    const p = t.player;
    this.player = {
      pos: vec(p.respawn.x, p.respawn.y, p.respawn.z), vel: vec(), yaw: p.respawnYaw, pitch: 0, spin: 0,
      onGround: true, stun: 0, weapon: "pistol", cooldown: 0, heat: 0, crashing: false, overheated: false,
      yeeted: false, spinSign: 1,
    };
    this.dummies = arena.dummySpawns.map((s) => ({
      pos: copy(s), vel: vec(), spawn: copy(s), hp: t.dummy.hp, onGround: true, stun: 0, down: 0, tumble: 0,
    }));
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
    return ev;
  }

  // ---- player ----------------------------------------------------------------
  private stepPlayer(input: YeetInput, dt: number, ev: YeetEvent[]): void {
    const t = this.t;
    const pl = this.player;
    if (input.reset) {
      this.respawnPlayer();
      ev.push({ type: "playerRespawn" });
      return;
    }
    const stunned = pl.stun > 0;
    if (stunned) pl.stun = Math.max(0, pl.stun - dt);

    if (input.select >= 0 && input.select < t.weaponOrder.length && !pl.crashing) {
      const w = t.weaponOrder[input.select];
      if (w !== pl.weapon) {
        pl.weapon = w;
        pl.cooldown = Math.max(pl.cooldown, 0.1);
        ev.push({ type: "switch", weapon: w });
      }
    }

    this.runAndJump(stunned ? NO_INPUT : input, dt);
    this.fireWeapons(stunned ? NO_INPUT : input, dt, ev);

    // recoil spin: the camera and body turn, then settle
    pl.yaw += pl.spin * dt;
    pl.spin *= Math.exp(-t.player.spinDamping * dt);
    if (Math.abs(pl.spin) < 0.01) pl.spin = 0;

    pl.vel.y -= t.gravity * dt;
    const res = moveBody(this.arena, pl.pos, pl.vel, dt, t.player.halfWidth, t.player.height);
    if (res.onGround && !pl.onGround && res.landSpeed > 4) ev.push({ type: "land", speed: res.landSpeed });
    pl.onGround = res.onGround;

    if (res.wallImpact >= t.bonk.speed && res.wallNormal) {
      pl.stun = t.bonk.stun;
      addScaled(pl.vel, res.wallNormal, res.wallImpact * t.bonk.bounce);
      ev.push({ type: "bonk", who: "player", at: copy(pl.pos), speed: res.wallImpact });
    }

    if (pl.crashing && pl.onGround) this.crashLand(ev);

    const speed = len(pl.vel);
    if (!pl.yeeted && speed >= t.yeetSpeed) {
      pl.yeeted = true;
      ev.push({ type: "yeet", speed });
    } else if (pl.yeeted && speed < t.yeetSpeed * 0.5) {
      pl.yeeted = false;
    }

    if (pl.pos.y < -30) {
      this.respawnPlayer();
      ev.push({ type: "playerRespawn" });
    }
  }

  private runAndJump(input: YeetInput, dt: number): void {
    const t = this.t.player;
    const pl = this.player;
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
      if (h > t.runSpeed + 0.01) {
        // sliding from a launch: bleed speed, steer a little
        const drop = Math.min(h - t.runSpeed, t.groundFriction * dt);
        const k = (h - drop) / h;
        pl.vel.x *= k;
        pl.vel.z *= k;
        this.airSteer(wx, wz, t.airAccel * 2, dt);
      } else {
        const tx = wx * t.runSpeed;
        const tz = wz * t.runSpeed;
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

  private fireWeapons(input: YeetInput, dt: number, ev: YeetEvent[]): void {
    const t = this.t;
    const pl = this.player;
    const w = this.weaponTuning;
    pl.cooldown = Math.max(0, pl.cooldown - dt);

    const copterFiring = pl.weapon === "copter" && input.fireHeld && !pl.crashing && !pl.overheated;
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
    if (pl.crashing) pl.spin = t.copter.crashSpin * pl.spinSign;

    const wants = w.auto ? input.fireHeld : input.firePressed;
    if (!wants || pl.cooldown > 0) return;
    if (pl.weapon === "copter" && !copterFiring) return;
    pl.cooldown = w.cooldown;
    this.shoot(w, input.aiming, ev);
  }

  /** One shot of the current gun: recoil on the shooter, hitscan pellets into the room and dummies. */
  private shoot(w: WeaponTuning, aimed: boolean, ev: YeetEvent[]): void {
    const pl = this.player;
    const b = this.t.aim.braced;
    const aim = aimDir(pl.yaw, pl.pitch);
    const recoil = w.recoil * (aimed ? b.recoil : 1);
    addScaled(pl.vel, aim, -recoil);
    const hop = w.hop * (aimed ? b.hop : 1);
    if (hop > 0 && pl.onGround) {
      pl.vel.y = Math.max(pl.vel.y, 0) + hop;
      pl.onGround = false;
    }
    if (w.recoil > 0 && pl.onGround && aim.y < 0) pl.onGround = false; // a floor shot leaves the floor this step
    if (w.spin) {
      pl.spin += w.spin * (aimed ? b.spin : 1) * pl.spinSign;
      pl.spinSign = -pl.spinSign;
    }
    const from = this.eye();
    const tracers: Tracer[] = [];
    const spread = w.spread * (aimed ? b.spread : 1);
    for (let i = 0; i < w.pellets; i++) {
      const dir = this.pelletDir(w, i, spread);
      tracers.push(this.castPellet(from, dir, w, ev));
    }
    ev.push({ type: "fire", weapon: this.player.weapon, tracers, aimed });
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
      d.down = this.t.dummy.respawnDelay;
      d.vel.y += 4; // one last comedic hop
      d.tumble += 10;
      ev.push({ type: "down", dummy: i });
    }
  }

  private crashLand(ev: YeetEvent[]): void {
    const c = this.t.copter;
    const pl = this.player;
    pl.crashing = false;
    pl.spin = c.crashSpin * 0.5 * pl.spinSign;
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

  respawnPlayer(): void {
    const p = this.t.player;
    const pl = this.player;
    pl.pos = vec(p.respawn.x, p.respawn.y, p.respawn.z);
    pl.vel = vec();
    pl.yaw = p.respawnYaw;
    pl.pitch = 0;
    pl.spin = 0;
    pl.stun = 0;
    pl.crashing = false;
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
  }
}
