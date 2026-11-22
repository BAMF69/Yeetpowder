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
import { GUNBLADES, type Tuning, type WeaponId, type WeaponTuning } from "./tuning";
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
  /** Slash with a gunblade (F pressed this step). */
  slash: boolean;
  /** F held: past a moment it becomes the hold move (scythe hook, katana dash stance). */
  slashHeld: boolean;
}

export const NO_INPUT: YeetInput = {
  moveX: 0, moveZ: 0, jump: false, firePressed: false, fireHeld: false, select: -1, reset: false, aiming: false, sprint: false, reload: false, slash: false, slashHeld: false,
};

export type FlipKind = "backflip" | "frontflip" | "cartwheel";

/** Targets of melee, the hook and the finisher: a dummy index, or PLAYER_CODE + a player index. */
export const PLAYER_CODE = 1000;

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
  | { type: "dry"; weapon: WeaponId }
  | { type: "slash"; weapon: WeaponId; hits: number; reap: boolean; combo: number }
  | { type: "flip"; kind: FlipKind }
  | { type: "lunge" }
  | { type: "finisher"; dummy: number }
  | { type: "hook"; dummy: number }
  | { type: "unhook"; dummy: number }
  | { type: "yeetreap"; dummy: number }
  | { type: "stance"; on: boolean }
  | { type: "dash" }
  | { type: "ultraslash"; hits: number; round: number; last: boolean }
  | { type: "pvpHit"; by: number; target: number; damage: number; at: Vec3 }
  | { type: "pvpDown"; by: number; target: number }
  | { type: "heroLanding" };

/** An event with the index of the player it belongs to (step() tags every player-caused event). */
export type TaggedEvent = YeetEvent & { p?: number };

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
  /** Gunblades: sim time of the last gun shot (Reap window), slash cooldown, the Sakura's swing recovery (a revolver
   * shot during it cancels it and lunges), the combo count and when the last slash landed. */
  lastShotAt: number;
  slashCd: number;
  slashRecover: number;
  combo: number;
  lastSlashAt: number;
  /** How long F has been held (s); whether this hold already tried its move. */
  holdT: number;
  holdUsed: boolean;
  /** Reaper's Kick: the hooked dummy (-1 = none) and for how long. */
  hook: number;
  hookT: number;
  /** Six-Shot Sakura: the reversed-blade dash stance, whether it has dash-fired, and ULTRASLASH rounds still to fire. */
  stance: boolean;
  stanceDashed: boolean;
  ultraLeft: number;
  ultraT: number;
  ultraRound: number;
  /** The dummy this hold's opening slash hit (-1 = none): the hook yanks it back even after the slash shoved it. */
  slashHit: number;
  /** In the air from a Reaper's Kick backflip (the landing will be a hero landing), and the landing's time left. */
  backflipAir: boolean;
  heroLand: number;
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

/** The whole changing state of a run (see YeetSim.exportState). */
export interface SimState {
  time: number;
  seed: number;
  players: PlayerState[];
  dummies: DummyState[];
  balls: Ball[];
  pickups: PickupState[];
  kos: number[];
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
  /** Every player in the room (index 0 = player 1). Single player: one. */
  readonly players: PlayerState[];
  /** Knockouts scored by each player on other players (duels). */
  readonly kos: number[];
  /** The player being stepped right now; between steps, the local player. Most rules read `this.player`. */
  private cur = 0;
  /** Which player is "you" on this screen (online: your slot). `sim.player` and `look()` mean them between steps. */
  localIndex = 0;
  readonly dummies: DummyState[];
  readonly balls: Ball[] = [];
  readonly pickups: PickupState[];
  /** Simulated seconds since start. */
  time = 0;
  private seed: number;

  readonly t: Tuning;
  readonly level: Level;

  constructor(t: Tuning, level: Level, playerCount = 1) {
    this.t = t;
    this.level = level;
    this.seed = Math.max(1, Math.floor(level.seed) % PM_M);
    this.players = [];
    for (let i = 0; i < Math.max(1, playerCount); i++) this.players.push(this.makePlayer(i));
    this.kos = this.players.map(() => 0);
    this.dummies = level.arena.dummySpawns.map((sp, i) => ({
      pos: copy(sp), vel: vec(), spawn: copy(sp), hp: t.dummy.hp, onGround: true, stun: 0, down: 0, tumble: 0,
      face: 0, aiming: 0, aiCooldown: 1.5 + i * 0.45,
    }));
    this.pickups = level.pickups.map((p) => ({ weapon: p.weapon, pos: copy(p.pos), taken: false }));
  }

  /** The player being stepped (between steps: the local player). */
  get player(): PlayerState {
    return this.players[this.cur];
  }

  /** Everything that changes during play, as plain data (a server snapshot; the base of client prediction). */
  exportState(): SimState {
    return structuredClone({
      time: this.time, seed: this.seed, players: this.players, dummies: this.dummies, balls: this.balls,
      pickups: this.pickups, kos: this.kos,
    });
  }

  /** Loads a state from exportState (same level and player count). Arrays keep their identity (views hold them). */
  importState(s: SimState): void {
    const c = structuredClone(s);
    this.time = c.time;
    this.seed = c.seed;
    this.players.splice(0, this.players.length, ...c.players);
    this.dummies.splice(0, this.dummies.length, ...c.dummies);
    this.balls.splice(0, this.balls.length, ...c.balls);
    this.pickups.splice(0, this.pickups.length, ...c.pickups);
    this.kos.splice(0, this.kos.length, ...c.kos);
    this.cur = this.localIndex;
  }

  private spawnOf(i: number): { pos: Vec3; yaw: number } {
    const lv = this.level;
    return { pos: copy(lv.spawns?.[i] ?? lv.spawn), yaw: lv.spawnYaws?.[i] ?? lv.spawnYaw };
  }

  private makePlayer(i: number): PlayerState {
    const t = this.t;
    const level = this.level;
    const sp = this.spawnOf(i);
    return {
      pos: sp.pos, vel: vec(), yaw: sp.yaw, pitch: 0, spin: 0, onGround: true, stun: 0,
      weapon: level.startWeapons[0], owned: [...level.startWeapons], cooldown: 0, heat: 0, crashing: false,
      overheated: false, yeeted: false, hp: t.player.hp, dead: 0, tumbling: 0, tumbleAge: 0, tumbleRoll: 0,
      stamina: t.sprint.stamina, sprinting: false, winded: false, sprintRest: 0,
      mag: this.fullMags(), reloading: 0,
      lastShotAt: -99, slashCd: 0, slashRecover: 0, combo: 0, lastSlashAt: -99,
      holdT: 0, holdUsed: false, hook: -1, hookT: 0, stance: false, slashHit: -1,
      stanceDashed: false, ultraLeft: 0, ultraT: 0, ultraRound: 0,
      backflipAir: false, heroLand: 0,
    };
  }

  private fullMags(): Record<WeaponId, number> {
    const out = {} as Record<WeaponId, number>;
    for (const id of this.t.weaponOrder) out[id] = this.t.weapons[id].mag;
    return out;
  }

  get arena() {
    return this.level.arena;
  }

  /** A number in [0, 1) from the run's seeded generator (deterministic). */
  rand(): number {
    this.seed = (this.seed * PM_A) % PM_M;
    return (this.seed - 1) / (PM_M - 1);
  }

  /** Mouse/stick look, applied between steps (rad). `who` = which player (default player 1). */
  look(dYaw: number, dPitch: number, who = this.localIndex): void {
    const pl = this.players[who] ?? this.player;
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
    return vec(p.x, p.y + this.t.player.eyeHeight - this.kneelDepth(), p.z);
  }

  /** How far the eye is down during a hero landing (m): quick drop, then a slower stand-up. */
  kneelDepth(pl: PlayerState = this.player): number {
    const h = this.t.reaper.heroLanding;
    if (pl.heroLand <= 0) return 0;
    const k = 1 - pl.heroLand / h.time; // 0 at touchdown .. 1 standing
    const down = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
    return h.kneel * Math.max(0, Math.min(1, down));
  }

  /** One fixed step. One input (single player) or one per player (a duel). Events carry `p`, their player. */
  step(input: YeetInput | YeetInput[]): TaggedEvent[] {
    const inputs = Array.isArray(input) ? input : [input];
    const ev: TaggedEvent[] = [];
    const dt = this.t.step;
    this.time += dt;
    for (let i = 0; i < this.players.length; i++) {
      this.cur = i;
      const start = ev.length;
      this.stepPlayer(inputs[i] ?? NO_INPUT, dt, ev);
      for (let k = start; k < ev.length; k++) if (ev[k].p === undefined) ev[k].p = i;
    }
    this.cur = this.localIndex;
    this.dummies.forEach((d, i) => this.stepDummy(d, i, dt, ev));
    this.stepBalls(dt, ev);
    return ev;
  }

  // ---- targets: dummies and (in a duel) the other players ------------------------------
  /** Calls fn for every standing target the current player could hit: dummies, then the other live players. */
  private eachTarget(fn: (code: number, pos: Vec3) => void): void {
    this.dummies.forEach((d, i) => {
      if (d.down === 0) fn(i, d.pos);
    });
    this.players.forEach((p, j) => {
      if (j !== this.cur && p.dead === 0) fn(PLAYER_CODE + j, p.pos);
    });
  }

  private bodyOf(code: number): { pos: Vec3; vel: Vec3; alive: boolean } | null {
    if (code >= PLAYER_CODE) {
      const p = this.players[code - PLAYER_CODE];
      return p ? { pos: p.pos, vel: p.vel, alive: p.dead === 0 } : null;
    }
    const d = this.dummies[code];
    return d ? { pos: d.pos, vel: d.vel, alive: d.down === 0 } : null;
  }

  private placeBody(code: number, pos: Vec3, vel: Vec3): void {
    if (code >= PLAYER_CODE) {
      const p = this.players[code - PLAYER_CODE];
      p.pos = pos;
      p.vel = vel;
      p.stun = Math.max(p.stun, 0.2); // hooked: helpless
      p.onGround = false;
      return;
    }
    const d = this.dummies[code];
    d.pos = pos;
    d.vel = vel;
    d.stun = Math.max(d.stun, 0.2);
    d.aiming = 0;
  }

  /** Damage and knock a target (a dummy, or another player in a duel). lift adds upward speed after the knock. */
  private hitTarget(code: number, dir: Vec3, damage: number, knockback: number, at: Vec3, ev: YeetEvent[], lift = 0): void {
    if (code < PLAYER_CODE) {
      this.hitDummy(code, dir, damage, knockback, at, ev);
      this.dummies[code].vel.y += lift;
      return;
    }
    const j = code - PLAYER_CODE;
    const v = this.players[j];
    if (!v || v.dead > 0) return;
    addScaled(v.vel, dir, knockback);
    v.vel.y += this.t.dummy.lift * Math.min(1, knockback / 4) + lift;
    v.onGround = false;
    v.hp -= damage;
    ev.push({ type: "pvpHit", by: this.cur, target: j, damage, at });
    if (v.hp <= 0) {
      this.knockOut(v);
      this.kos[this.cur]++;
      ev.push({ type: "pvpDown", by: this.cur, target: j });
    }
  }

  /** A player at 0 hp: knocked out, flying off in a tumble the third-person camera can watch, respawn later. */
  private knockOut(v: PlayerState): void {
    v.hp = 0;
    v.dead = this.t.player.respawnDelay;
    v.crashing = false;
    v.tumbling = this.t.player.respawnDelay;
    v.tumbleAge = 1e-6;
    v.tumbleRoll = this.t.tumble.roll;
    v.vel.y += 5;
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
        this.endHolds(ev);
        pl.cooldown = Math.max(pl.cooldown, 0.1);
        ev.push({ type: "switch", weapon: w });
      }
    }

    const speedBefore = lenXZ(pl.vel);
    if (pl.heroLand > 0) pl.heroLand = Math.max(0, pl.heroLand - dt);
    // a hero landing: no moving, sprinting or jumping until you are back up (shooting and slashing still work)
    const legs = control && pl.heroLand === 0 ? input : NO_INPUT;
    this.updateSprint(legs, dt);
    this.runAndJump(legs, dt);
    this.fireWeapons(control ? input : NO_INPUT, speedBefore, dt, ev);
    this.melee(control ? input : NO_INPUT, dt, ev);

    // recoil twist: the camera and body turn, then settle
    pl.yaw += pl.spin * dt;
    pl.spin *= Math.exp(-t.player.spinDamping * dt);
    if (Math.abs(pl.spin) < 0.01) pl.spin = 0;

    pl.vel.y -= t.gravity * dt;
    const res = moveBody(this.arena, pl.pos, pl.vel, dt, t.player.halfWidth, t.player.height);
    if (res.onGround && !pl.onGround && res.landSpeed > 4) ev.push({ type: "land", speed: res.landSpeed });
    if (res.onGround && !pl.onGround && pl.backflipAir) {
      pl.backflipAir = false;
      pl.heroLand = t.reaper.heroLanding.time;
      pl.vel.x *= 0.2; // the knee takes the landing
      pl.vel.z *= 0.2;
      ev.push({ type: "heroLanding" });
    }
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
      this.look(Math.cos(n * 5.7 + 1) * wob, (Math.sin(n * 7.3) + Math.sin(n * 12.1) * 0.5) * wob, this.cur);
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
    const velBefore = vec(pl.vel.x, 0, pl.vel.z);
    // Six-Shot Sakura: a shot during a slash's recovery cancels it and lunges you forward into the next cut
    const dash = pl.weapon === "sakura" && pl.stance;
    const lunge = pl.weapon === "sakura" && pl.slashRecover > 0 && !dash;
    const kick = addScaled(vec(), aim, lunge || dash ? 0 : -w.recoil * (aimed ? b.recoil : 1) * (grounded ? 1 : w.airRecoil));
    if (pl.weapon === "reaper" && aim.y < -t.reaper.downAim && kick.y > 0) kick.y *= t.reaper.backflipLift;
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

    // Reaper's Kick with an enemy hooked: the YEETREAP lands first (the bullet would otherwise knock them out)
    if (pl.weapon === "reaper" && pl.hook >= 0) this.yeetreap(ev);
    const from = this.eye();
    const tracers: Tracer[] = [];
    const spread = w.spread * (aimed ? b.spread : 1);
    for (let i = 0; i < w.pellets; i++) {
      const dir = this.pelletDir(w, i, spread);
      tracers.push(this.castPellet(from, dir, w, ev));
    }
    ev.push({ type: "fire", weapon: pl.weapon, tracers, aimed });
    pl.lastShotAt = this.time;
    if (pl.weapon === "reaper") {
      const kind = this.flipKind(aim, velBefore);
      if (kind === "backflip") pl.backflipAir = true;
      ev.push({ type: "flip", kind });
    }
    if (dash) {
      // the blade held backwards: the revolver fires behind you and throws you forward
      // full speed forward; looking up adds an upward push, always smaller than the forward one
      const f = aimDir(pl.yaw, 0);
      const d = t.sakura.dash;
      pl.vel.x = f.x * d.speed;
      pl.vel.z = f.z * d.speed;
      pl.vel.y = Math.max(Math.sin(Math.max(0, pl.pitch)) * d.speed * d.up, 2);
      pl.onGround = false;
      pl.stanceDashed = true;
      ev.push({ type: "dash" });
    }
    if (lunge) {
      const f = aimDir(pl.yaw, 0);
      pl.vel.x = f.x * t.sakura.lungeSpeed;
      pl.vel.z = f.z * t.sakura.lungeSpeed;
      pl.vel.y = Math.max(pl.vel.y, 1);
      pl.onGround = false;
      pl.slashRecover = 0;
      pl.slashCd = 0;
      ev.push({ type: "lunge" });
    }
    if (pl.weapon === "sakura" && pl.mag.sakura === 0) this.finisher(ev); // the sixth round (the mag is counted down before the shot)

    // run-and-gun: firing while moving may send you tumbling (not the copter: it kicks you out of zoom instead)
    const moving = speedBefore >= t.tumble.minSpeed && Math.abs(input.moveX) + Math.abs(input.moveZ) > 0.1;
    // (the copter and the gunblades never tumble you: they are made to be used on the move)
    if (moving && pl.weapon !== "copter" && !GUNBLADES.includes(pl.weapon) && pl.tumbling === 0) {
      const chance = this.tumbleChance(w, speedBefore, aimed, pl.sprinting);
      if (this.rand() < chance) this.startTumble(ev);
    }
  }

  /** Which flip a Reaper's Kick shot gives: aimed down = backflip; pushing you along your run = front-flip;
   * across it = cartwheel; against it or from a standstill = backflip. */
  private flipKind(aim: Vec3, velBefore: Vec3): FlipKind {
    if (aim.y < -this.t.reaper.downAim) return "backflip";
    const push = normalize(vec(-aim.x, 0, -aim.z));
    const speed = lenXZ(velBefore);
    if (speed < 2) return "backflip";
    const along = (push.x * velBefore.x + push.z * velBefore.z) / speed;
    if (along > 0.5) return "frontflip";
    if (along > -0.5) return "cartwheel";
    return "backflip";
  }

  // ---- gunblade melee (F) ---------------------------------------------------------
  private melee(input: YeetInput, dt: number, ev: YeetEvent[]): void {
    const t = this.t;
    const pl = this.player;
    pl.slashCd = Math.max(0, pl.slashCd - dt);
    pl.slashRecover = Math.max(0, pl.slashRecover - dt);
    this.ultraFlurry(dt, ev);
    this.holdMoves(input, dt, ev);
    if (pl.stance || pl.hook >= 0) return; // a hold move owns F until it is released
    if (!input.slash || !GUNBLADES.includes(pl.weapon) || pl.slashCd > 0) return;
    if (pl.weapon === "sakura" && pl.reloading > 0) return; // the spin-reload leaves you open
    if (pl.weapon === "reaper") {
      const s = t.reaper.slash;
      const reap = this.time - pl.lastShotAt <= t.reaper.reapWindow;
      const hits = this.meleeHits(s.range, s.arc, s.damage * (reap ? t.reaper.reapMult : 1), s.knockback, s.lift, ev);
      pl.slashHit = this.lastMeleeHit;
      pl.slashCd = s.cooldown;
      ev.push({ type: "slash", weapon: "reaper", hits, reap, combo: 1 });
      return;
    }
    const s = t.sakura.slash;
    pl.combo = this.time - pl.lastSlashAt <= t.sakura.comboWindow && pl.combo < t.sakura.comboMax ? pl.combo + 1 : 1;
    pl.lastSlashAt = this.time;
    const hits = this.meleeHits(s.range, s.arc, s.damage, s.knockback, s.lift, ev);
    pl.slashRecover = s.recovery;
    pl.slashCd = pl.combo === t.sakura.comboMax ? s.recovery * 1.6 : s.recovery; // the last cut of a full combo lingers
    ev.push({ type: "slash", weapon: "sakura", hits, reap: false, combo: pl.combo });
  }

  /** Hold F: past holdTime the scythe hooks an enemy / the katana goes into its dash stance; release ends it. */
  private holdMoves(input: YeetInput, dt: number, ev: YeetEvent[]): void {
    const t = this.t;
    const pl = this.player;
    const gunblade = GUNBLADES.includes(pl.weapon);
    if (!input.slashHeld || !gunblade) {
      if (pl.holdT > 0) this.releaseHold(ev);
      pl.holdT = 0;
      pl.holdUsed = false;
      pl.slashHit = -1;
      return;
    }
    pl.holdT += dt;
    if (pl.weapon === "reaper") {
      if (pl.hook < 0 && !pl.holdUsed && pl.holdT >= t.reaper.hook.holdTime) {
        pl.holdUsed = true;
        const h = t.reaper.hook;
        // the enemy your opening slash just hit (shoved away by it) is yanked back with extra reach
        const hit = pl.slashHit >= 0 ? this.bodyOf(pl.slashHit) : null;
        const yank = !!hit && hit.alive && Math.hypot(hit.pos.x - pl.pos.x, hit.pos.z - pl.pos.z) <= h.range * h.yankReach;
        const target = yank ? pl.slashHit : this.nearestInFront(h.range, h.arc);
        if (target >= 0) {
          pl.hook = target;
          pl.hookT = 0;
          ev.push({ type: "hook", dummy: target });
        }
      }
      if (pl.hook >= 0) this.holdHooked(dt, ev);
    } else if (pl.weapon === "sakura" && !pl.stance && !pl.holdUsed && pl.holdT >= t.sakura.dash.holdTime && pl.reloading === 0) {
      pl.holdUsed = true;
      pl.stance = true;
      pl.stanceDashed = false;
      ev.push({ type: "stance", on: true });
    }
  }

  /** Keeps the hooked dummy pinned at the scythe's end, moving with you; it cannot act. */
  private holdHooked(dt: number, ev: YeetEvent[]): void {
    const h = this.t.reaper.hook;
    const pl = this.player;
    const body = this.bodyOf(pl.hook);
    pl.hookT += dt;
    if (!body || !body.alive || pl.hookT > h.maxTime) {
      this.unhook(ev);
      return;
    }
    const f = aimDir(pl.yaw, 0);
    this.placeBody(pl.hook, vec(pl.pos.x + f.x * h.distance, pl.pos.y, pl.pos.z + f.z * h.distance), copy(pl.vel));
  }

  private unhook(ev: YeetEvent[]): void {
    const pl = this.player;
    const body = this.bodyOf(pl.hook);
    if (body && body.alive) {
      const f = aimDir(pl.yaw, 0);
      addScaled(body.vel, f, this.t.reaper.hook.release); // let go: a small shove away
    }
    ev.push({ type: "unhook", dummy: pl.hook });
    pl.hook = -1;
  }

  /** Fire with an enemy wrapped in the scythe: the shot goes through them point-blank. */
  private yeetreap(ev: YeetEvent[]): void {
    const y = this.t.reaper.yeetreap;
    const pl = this.player;
    const code = pl.hook;
    const body = this.bodyOf(code);
    pl.hook = -1;
    if (!body || !body.alive) return;
    const f = aimDir(pl.yaw, 0);
    const at = vec(body.pos.x, body.pos.y + 1, body.pos.z);
    this.hitTarget(code, vec(f.x, 0.25, f.z), y.damage, y.knockback, at, ev, y.lift);
    ev.push({ type: "yeetreap", dummy: code });
  }

  /** F let go: drop a hooked enemy; leave the dash stance with an ULTRASLASH if a round is left. */
  private releaseHold(ev: YeetEvent[]): void {
    const t = this.t;
    const pl = this.player;
    if (pl.hook >= 0) this.unhook(ev);
    if (!pl.stance) return;
    pl.stance = false;
    ev.push({ type: "stance", on: false });
    // ULTRASLASH only after a dash-fire, while still faster than a sprint, with rounds left
    const fast = lenXZ(pl.vel) >= t.sakura.ultra.minSpeed;
    if (pl.weapon !== "sakura" || !pl.stanceDashed || !fast || pl.reloading > 0 || pl.mag.sakura < 1) return;
    pl.ultraLeft = pl.mag.sakura;
    pl.ultraRound = 0;
    pl.ultraT = 0; // the first cut lands this step
    this.ultraFlurry(0, ev);
  }

  /** The ULTRASLASH flurry: every round left, one wide cut each, `interval` apart; reload after the last. */
  private ultraFlurry(dt: number, ev: YeetEvent[]): void {
    const pl = this.player;
    if (pl.ultraLeft <= 0) return;
    if (pl.weapon !== "sakura") {
      pl.ultraLeft = 0;
      return;
    }
    pl.ultraT -= dt;
    if (pl.ultraT > 0) return;
    const u = this.t.sakura.ultra;
    pl.ultraT = u.interval;
    pl.ultraLeft--;
    pl.ultraRound++;
    pl.mag.sakura = Math.max(0, pl.mag.sakura - 1);
    const last = pl.ultraLeft === 0;
    const f = aimDir(pl.yaw, 0);
    pl.vel.x += f.x * u.lunge;
    pl.vel.z += f.z * u.lunge;
    pl.vel.y = Math.max(pl.vel.y, 1);
    pl.onGround = false;
    const hits = this.meleeHits(u.range, u.arc, u.damage, last ? u.lastKnockback : u.knockback, u.lift, ev);
    pl.slashCd = this.t.sakura.slash.recovery;
    ev.push({ type: "ultraslash", hits, round: pl.ultraRound, last });
    if (last) this.startReload(ev);
  }

  /** Ends any hold move (switching weapons, respawning) without its release effect. */
  private endHolds(ev: YeetEvent[]): void {
    const pl = this.player;
    if (pl.hook >= 0) this.unhook(ev);
    if (pl.stance) ev.push({ type: "stance", on: false });
    pl.stance = false;
    pl.ultraLeft = 0;
    pl.holdT = 0;
    pl.holdUsed = true; // the key is probably still held: wait for a fresh press
  }

  /** The nearest standing target in front within range and the arc (a target code), or -1. */
  private nearestInFront(range: number, arc: number): number {
    const pl = this.player;
    const face = aimDir(pl.yaw, 0);
    let best = -1;
    let bestD = range + this.t.player.halfWidth;
    this.eachTarget((code, pos) => {
      const dx = pos.x - pl.pos.x;
      const dz = pos.z - pl.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > bestD || Math.abs(pos.y - pl.pos.y) > 1.9) return;
      const cos = dist < 0.01 ? 1 : (dx * face.x + dz * face.z) / dist;
      if (Math.acos(Math.max(-1, Math.min(1, cos))) > arc / 2) return;
      best = code;
      bestD = dist;
    });
    return best;
  }

  /** The first target the last meleeHits call hit (-1 = none): the scythe hook yanks it back. */
  private lastMeleeHit = -1;

  /** Hits every standing target in front of you within range and the arc (radians, centred on where you face). */
  private meleeHits(range: number, arc: number, damage: number, knockback: number, lift: number, ev: YeetEvent[]): number {
    const pl = this.player;
    const face = aimDir(pl.yaw, 0);
    const hit: Array<[number, Vec3, Vec3]> = [];
    this.lastMeleeHit = -1;
    this.eachTarget((code, pos) => {
      const dx = pos.x - pl.pos.x;
      const dz = pos.z - pl.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range + this.t.player.halfWidth || Math.abs(pos.y - pl.pos.y) > 1.9) return;
      const cos = dist < 0.01 ? 1 : (dx * face.x + dz * face.z) / dist;
      if (Math.acos(Math.max(-1, Math.min(1, cos))) > arc / 2) return;
      const dir = dist < 0.01 ? vec(face.x, 0, face.z) : vec(dx / dist, 0, dz / dist);
      hit.push([code, dir, vec(pos.x, pos.y + 1, pos.z)]);
    });
    for (const [code, dir, at] of hit) {
      if (this.lastMeleeHit < 0) this.lastMeleeHit = code;
      this.hitTarget(code, dir, damage, knockback, at, ev, lift);
    }
    return hit.length;
  }

  /** The Sakura's sixth round fired point-blank: the nearest dummy in front within reach is knocked flying. */
  private finisher(ev: YeetEvent[]): void {
    const t = this.t.sakura;
    const pl = this.player;
    const face = aimDir(pl.yaw, 0);
    let best = -1;
    let bestPos: Vec3 | null = null;
    let bestD = t.finisherRange + this.t.player.halfWidth;
    this.eachTarget((code, pos) => {
      const dx = pos.x - pl.pos.x;
      const dz = pos.z - pl.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > bestD || Math.abs(pos.y - pl.pos.y) > 1.9) return;
      if (dist > 0.01 && (dx * face.x + dz * face.z) / dist < 0.5) return; // roughly in front
      best = code;
      bestPos = pos;
      bestD = dist;
    });
    if (best < 0 || !bestPos) return;
    const bp: Vec3 = bestPos;
    const dir = normalize(vec(bp.x - pl.pos.x || face.x, 0, bp.z - pl.pos.z || face.z));
    this.hitTarget(best, dir, 0, t.finisherKnockback, vec(bp.x, bp.y + 1, bp.z), ev, t.finisherLift);
    ev.push({ type: "finisher", dummy: best });
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
    // other players in a duel
    this.players.forEach((p, j) => {
      if (j === this.cur || p.dead > 0) return;
      const hw = t.player.halfWidth;
      const hitT = rayBox(from, dir, vec(p.pos.x - hw, p.pos.y, p.pos.z - hw), vec(p.pos.x + hw, p.pos.y + t.player.height, p.pos.z + hw));
      if (hitT < dist) {
        dist = hitT;
        target = PLAYER_CODE + j;
      }
    });
    const to = addScaled(copy(from), dir, dist);
    if (target >= 0) this.hitTarget(target, dir, w.damage, w.knockback, to, ev);
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
    const under: Array<[number, Vec3, Vec3]> = [];
    this.eachTarget((code, pos) => {
      const dx = pos.x - pl.pos.x;
      const dz = pos.z - pl.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > c.crashRadius || Math.abs(pos.y - pl.pos.y) > 2.5) return;
      under.push([code, dist > 0.01 ? vec(dx / dist, 0.6, dz / dist) : vec(0, 1, 0), copy(pos)]);
    });
    for (const [code, dir, at] of under) this.hitTarget(code, dir, c.crashDamage, c.crashKnockback, at, ev);
    const hits = under.length;
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
    const sp = this.spawnOf(this.cur);
    pl.pos = sp.pos;
    pl.vel = vec();
    pl.yaw = sp.yaw;
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
    pl.slashCd = pl.slashRecover = 0;
    pl.combo = 0;
    pl.hook = -1;
    pl.stance = false;
    pl.ultraLeft = 0;
    pl.holdT = 0;
    pl.backflipAir = false;
    pl.heroLand = 0;
    if (fullReset) {
      pl.owned = [...lv.startWeapons];
      if (!pl.owned.includes(pl.weapon)) pl.weapon = pl.owned[0];
      pl.heat = 0;
      pl.overheated = false;
      if (this.players.length === 1) {
        // single player: the level resets with you (in a duel the pickups belong to everyone)
        for (const p of this.pickups) p.taken = false;
        this.balls.length = 0;
      }
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
    const pl = this.players[this.nearestPlayer(d)];
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
    if (d.aiCooldown <= 0 && this.sees(d, this.nearestPlayer(d))) {
      d.aiming = ai.telegraph;
      ev.push({ type: "dummyAim", dummy: i });
    }
  }

  private dummyEye(d: DummyState): Vec3 {
    return vec(d.pos.x, d.pos.y + 1.4, d.pos.z);
  }

  /** The live player nearest a dummy (its target). */
  private nearestPlayer(d: DummyState): number {
    let best = 0;
    let bestD = Infinity;
    this.players.forEach((p, j) => {
      const dist = p.dead > 0 ? Infinity : Math.hypot(p.pos.x - d.pos.x, p.pos.z - d.pos.z);
      if (dist < bestD) {
        bestD = dist;
        best = j;
      }
    });
    return best;
  }

  private playerChest(j = 0): Vec3 {
    const p = this.players[j].pos;
    return vec(p.x, p.y + 1.0, p.z);
  }

  /** In range of player j (default player 1) and nothing solid in between. */
  sees(d: DummyState, j = 0): boolean {
    const from = this.dummyEye(d);
    const to = this.playerChest(j);
    const delta = vec(to.x - from.x, to.y - from.y, to.z - from.z);
    const dist = len(delta);
    if (dist > this.t.ai.range || dist < 0.01) return false;
    return rayArena(this.arena, from, normalize(delta), dist) >= dist - 0.01;
  }

  private throwBall(d: DummyState, i: number, ev: YeetEvent[]): void {
    const ai = this.t.ai;
    const from = this.dummyEye(d);
    const to = this.playerChest(this.nearestPlayer(d));
    const dir = normalize(vec(to.x - from.x, to.y - from.y, to.z - from.z));
    this.balls.push({ pos: addScaled(copy(from), dir, 0.6), vel: addScaled(vec(), dir, ai.ballSpeed), life: ai.ballLife, owner: i });
    d.aiCooldown = ai.cooldown + ((i * 0.37) % 0.8);
    ev.push({ type: "dummyFire", dummy: i });
  }

  private stepBalls(dt: number, ev: YeetEvent[]): void {
    const t = this.t;
    const r = t.ai.ballRadius;
    const hw = t.player.halfWidth + r;
    for (let k = this.balls.length - 1; k >= 0; k--) {
      const b = this.balls[k];
      addScaled(b.pos, b.vel, dt);
      b.life -= dt;
      const p = b.pos;
      // any player (a box grown by the ball's radius)
      const j = this.players.findIndex((pl) => pl.dead === 0 && Math.abs(p.x - pl.pos.x) < hw && Math.abs(p.z - pl.pos.z) < hw && p.y > pl.pos.y - r && p.y < pl.pos.y + t.player.height + r);
      if (j >= 0) {
        this.hitPlayer(b, j, ev);
        this.balls.splice(k, 1);
        continue;
      }
      const solid = this.arena.boxes.some((bx) => p.x > bx.min.x && p.x < bx.max.x && p.y > bx.min.y && p.y < bx.max.y && p.z > bx.min.z && p.z < bx.max.z);
      if (solid) ev.push({ type: "ballPop", at: copy(p) });
      if (solid || b.life <= 0) this.balls.splice(k, 1);
    }
  }

  private hitPlayer(b: Ball, j: number, ev: TaggedEvent[]): void {
    const ai = this.t.ai;
    const pl = this.players[j];
    const dir = normalize(b.vel);
    addScaled(pl.vel, dir, ai.knockback);
    pl.vel.y += 1.5;
    pl.onGround = false;
    pl.hp -= ai.damage;
    ev.push({ type: "playerHit", dummy: b.owner, damage: ai.damage, at: copy(b.pos), p: j });
    if (pl.hp <= 0) {
      this.knockOut(pl);
      addScaled(pl.vel, dir, ai.knockback);
      ev.push({ type: "playerDown", dummy: b.owner, p: j });
    }
  }
}
