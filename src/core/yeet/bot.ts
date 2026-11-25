// ---------------------------------------------------------------------------
// bot.ts
// Purpose : Bots that play like real players (easy, medium, hard). A bot is a normal player in the sim; this brain
//           only produces what a person produces: movement keys, jump, sprint, fire, aim (right mouse), weapon
//           switch and a turn of the view. Same guns, recoil, tumbles, bonks, ammo and hp as you; difficulty is how
//           human its hands and judgment are (TUNING.bot): how late it reacts, how fast and steadily it aims, whether
//           it picks the right gun, plants its feet, side-steps, and travels by Boomstick floor launch.
// Usage   : const brain = new BotBrain(TUNING, 1, "medium", seed);
//           each sim step: const out = brain.think(sim); sim.look(out.dYaw, out.dPitch, 1); inputs[1] = out.input
//           brain.debug: its state, target, goal and aim error (the ?debug view)
// Notes   : Guns only for now (gunblades come later): Pea Pistol, Boomstick, Spin Doctor, the Gatling pickup.
//           Three layers (SOP-14): perception (line of sight, a reaction-delayed memory of where others were),
//           decision (an FSM, re-decided every TUNING.bot.decideEvery s), movement (steering with wall probes, plus
//           the launch maneuver). Engine-free and seeded: a bot match replays exactly (tests/bot.test.ts).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
//
// Pseudocode
//   remember where everyone is now (a short history, for the reaction delay)
//   knocked out, tumbling or stunned -> "recover": no input
//   target = nearest living opponent; visible = in range and nothing in the line of sight
//   every decideEvery s: state = retreat (low hp, close) | gun (Gatling worth getting) | engage (visible) | hunt
//     + which gun suits the range, which way to side-step, whether to plant feet, aim down sights, or launch
//   act: goal and where to look from the state; the launch maneuver overrides the look (aim away + down, fire)
//   aim: turn toward the look target (capped turn rate, gain, wobble); fire when the error is inside the cone
//   steer: goal direction -> wall probes -> WASD relative to where it faces; jump low obstacles

import { rayArena } from "./arena";
import { NO_INPUT, type PlayerState, type YeetInput, type YeetSim } from "./sim";
import type { Tuning, WeaponId } from "./tuning";
import type { Vec3 } from "./vec";

export type BotSkill = "easy" | "medium" | "hard";
export type BotState = "recover" | "engage" | "hunt" | "gun" | "retreat";
export const BOT_SKILLS: BotSkill[] = ["easy", "medium", "hard"];

export interface BotOutput {
  input: YeetInput;
  dYaw: number;
  dPitch: number;
}

export interface BotDebug {
  state: BotState;
  target: number;
  visible: boolean;
  goal: Vec3 | null;
  aimError: number;
  launching: boolean;
}

/** The guns a bot uses for now (no gunblades yet). */
const BOT_GUNS: WeaponId[] = ["pistol", "shotgun", "sniper", "copter"];
const CHEST = 1.1; // m above the feet: where it aims
const HALF_WIDTH = 0.45; // m: a player's half width, for the fire cone
const LOW_PROBE = 0.35; // m above the feet: wall probe for steering
const HIGH_PROBE = 1.75; // m: above a low wall (jumpable when this one is clear)
const LAUNCH_PITCH = -0.75; // rad: Boomstick aimed down and back: the push goes up and forward
const LAUNCH_ALIGN = 0.08; // rad: fire the launch when the view is this close
const LAUNCH_TIMEOUT = 1.2; // s: give up a launch that never lines up
const PLANT_SPEED = 2; // m/s: slow enough to fire a heavy gun with planted feet
const AVOID = [0.6, -0.6, 1.2, -1.2, 1.9, -1.9, Math.PI]; // rad: turns tried when the way ahead is blocked

interface Snap {
  t: number;
  pos: Vec3;
  vel: Vec3;
}

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Park-Miller, like the sim's: seeded, so a bot match replays exactly. */
function rng(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Yaw and pitch that look from `from` at `to` (the sim's convention: yaw 0 faces -Z, pitch + is up). */
export function lookAngles(from: Vec3, to: Vec3): { yaw: number; pitch: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

/** WASD (strafe x, forward z, each -1..1) that walks in world direction (dx, dz) while facing `yaw`. */
export function keysFor(dx: number, dz: number, yaw: number): { moveX: number; moveZ: number } {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  return { moveX: clamp(dx * rx + dz * rz, -1, 1), moveZ: clamp(dx * fx + dz * fz, -1, 1) };
}

export class BotBrain {
  readonly debug: BotDebug = { state: "hunt", target: -1, visible: false, goal: null, aimError: 0, launching: false };
  private readonly rand: () => number;
  private state: BotState = "hunt";
  private nextDecision = 0;
  private readonly history = new Map<number, Snap[]>();
  private lastSeen: { pos: Vec3; t: number } | null = null;
  private seenSince = -1;
  private wantGun: WeaponId = "pistol";
  private strafeDir = 1;
  private strafeUntil = 0;
  private plant = false;
  private aimDown = false;
  private launch: { yaw: number; until: number } | null = null;
  private roam: Vec3 | null = null;
  private roamUntil = 0;
  private readonly wobble: [number, number, number, number];

  constructor(private readonly t: Tuning, readonly me: number, readonly skill: BotSkill, seed: number) {
    this.rand = rng(seed * 7919 + me * 104729 + BOT_SKILLS.indexOf(skill) * 31);
    // two slow drifts per axis, at rates and phases of their own: a hand on a mouse, not a sine wave
    this.wobble = [0.7 + this.rand() * 0.6, this.rand() * 6.28, 0.9 + this.rand() * 0.7, this.rand() * 6.28];
  }

  private get k() {
    return this.t.bot.skills[this.skill];
  }

  think(sim: YeetSim): BotOutput {
    const now = sim.time;
    const pl = sim.players[this.me];
    this.remember(sim, now);
    if (!pl || pl.dead > 0 || pl.tumbling > 0 || pl.stun > 0) {
      this.state = this.debug.state = "recover";
      this.launch = null;
      this.seenSince = -1;
      return { input: { ...NO_INPUT }, dYaw: 0, dPitch: 0 };
    }
    const eye = v3(pl.pos.x, pl.pos.y + this.t.player.eyeHeight, pl.pos.z);
    const target = this.nearestOpponent(sim, pl);
    const tp = target >= 0 ? sim.players[target] : null;
    const visible = !!tp && this.canSee(sim, eye, tp);
    if (visible && tp) {
      if (this.seenSince < 0) this.seenSince = now;
      this.lastSeen = { pos: { ...tp.pos }, t: now };
    } else {
      this.seenSince = -1;
    }
    const seen = target >= 0 ? this.perceived(target, now) : null;
    const dist = seen ? Math.hypot(seen.pos.x - pl.pos.x, seen.pos.z - pl.pos.z) : Infinity;

    if (now >= this.nextDecision) {
      this.nextDecision = now + this.t.bot.decideEvery;
      this.decide(sim, pl, visible, dist, now);
    }

    // where to go and where to look
    const goal = this.goalFor(sim, pl, seen, dist, now);
    let look = seen && visible ? lookAngles(eye, v3(seen.pos.x, seen.pos.y + CHEST, seen.pos.z)) : null;
    if (!look && goal) look = { yaw: Math.atan2(-(goal.x - pl.pos.x), -(goal.z - pl.pos.z)), pitch: 0 };
    if (!look) look = { yaw: pl.yaw, pitch: 0 };

    const input: YeetInput = { ...NO_INPUT };
    let gun = this.wantGun;
    let firing = false;
    if (this.launch) {
      // the launch: Boomstick, aimed away from the goal and down; fire once lined up, then fly
      gun = "shotgun";
      look = { yaw: this.launch.yaw, pitch: LAUNCH_PITCH };
      const lined = Math.abs(wrap(look.yaw - pl.yaw)) < LAUNCH_ALIGN && Math.abs(look.pitch - pl.pitch) < LAUNCH_ALIGN;
      if (lined && pl.weapon === "shotgun" && pl.cooldown <= 0 && pl.mag.shotgun > 0 && pl.reloading === 0 && pl.onGround) {
        input.firePressed = true;
        this.launch = null;
      } else if (now > this.launch.until) {
        this.launch = null;
      }
    } else if ((this.state === "engage" || this.state === "retreat") && visible && seen) {
      firing = this.shouldFire(pl, eye, seen, dist, now);
    }
    this.debug.launching = !!this.launch || input.firePressed;

    // weapon switch (a key press, like a player's 1-4)
    if (pl.weapon !== gun && pl.owned.includes(gun)) input.select = this.t.weaponOrder.indexOf(gun);

    // aim: turn toward the look target with this difficulty's hands
    const k = this.k;
    const w = this.wobble;
    const wob = this.launch ? 0 : k.wobble;
    const wantYaw = look.yaw + wob * Math.sin(w[0] * now + w[1]);
    const wantPitch = clamp(look.pitch + wob * 0.6 * Math.sin(w[2] * now + w[3]), -this.t.player.maxPitch, this.t.player.maxPitch);
    const dt = this.t.step;
    const maxTurn = k.turnRate * dt;
    const yawErr = wrap(wantYaw - pl.yaw);
    const pitchErr = wantPitch - pl.pitch;
    const dYaw = clamp(yawErr * Math.min(1, k.aimGain * dt), -maxTurn, maxTurn);
    const dPitch = clamp(pitchErr * Math.min(1, k.aimGain * dt), -maxTurn, maxTurn);
    this.debug.aimError = Math.hypot(yawErr, pitchErr);

    // fire: semi-auto guns need a press, the Gatling is held
    if (firing && !input.firePressed) {
      if (this.t.weapons[pl.weapon].auto) input.fireHeld = true;
      else input.firePressed = true;
      input.aiming = this.aimDown;
    } else if (this.aimDown && visible && (pl.weapon === "sniper" || pl.weapon === "pistol")) {
      input.aiming = true;
    }

    // move: steer toward the goal (planting the feet for a heavy shot, if this bot does that)
    const holdStill = this.plant && visible && (pl.weapon === "shotgun" || pl.weapon === "sniper") && this.state === "engage";
    if (goal && !holdStill) {
      const steer = this.steer(sim, pl, goal);
      if (steer) {
        const keys = keysFor(steer.dx, steer.dz, pl.yaw);
        input.moveX = keys.moveX;
        input.moveZ = keys.moveZ;
        input.jump = steer.jump;
      }
      const far = Math.hypot(goal.x - pl.pos.x, goal.z - pl.pos.z) > 8;
      input.sprint = k.sprint && far && (this.state === "hunt" || this.state === "gun");
    }
    if (holdStill && input.firePressed && Math.hypot(pl.vel.x, pl.vel.z) > PLANT_SPEED && pl.onGround) {
      input.firePressed = false; // still sliding: wait a moment so the shot does not tumble it
    }
    // Retreat and strafe are checked in world space too: backing away from an enemy must not mean backing into water.
    if (sim.level.water && pl.onGround) {
      const safe = (x: number, z: number) => sim.arena.boxes.some((b) => b.max.y >= sim.level.water!.y + 0.2 && b.max.y <= pl.pos.y + 0.7 && b.min.x <= x - 0.6 && b.max.x >= x + 0.6 && b.min.z <= z - 0.6 && b.max.z >= z + 0.6);
      const yaw = pl.yaw + dYaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const dx = Math.cos(yaw) * input.moveX + fx * input.moveZ, dz = -Math.sin(yaw) * input.moveX + fz * input.moveZ;
      if (!safe(pl.pos.x + dx * 2.5 + pl.vel.x * 0.25, pl.pos.z + dz * 2.5 + pl.vel.z * 0.25)) {
        const retreat = sim.level.spawns?.filter((p) => safe(p.x, p.z)).sort((a, b) => Math.hypot(a.x - pl.pos.x, a.z - pl.pos.z) - Math.hypot(b.x - pl.pos.x, b.z - pl.pos.z))[0] ?? sim.level.spawn;
        const keys = keysFor(retreat.x - pl.pos.x, retreat.z - pl.pos.z, yaw);
        input.moveX = keys.moveX; input.moveZ = keys.moveZ; input.sprint = false; input.jump = false;
        // A recoil-heavy shot near the edge can be as dangerous as walking backwards.
        input.firePressed = false; input.fireHeld = false; this.launch = null;
      }
    }

    this.debug.state = this.state;
    this.debug.target = target;
    this.debug.visible = visible;
    this.debug.goal = goal;
    return { input, dYaw, dPitch };
  }

  // ---- perception ------------------------------------------------------------------
  private remember(sim: YeetSim, now: number): void {
    const keep = this.k.reaction + 0.2;
    sim.players.forEach((p, i) => {
      if (i === this.me) return;
      let h = this.history.get(i);
      if (!h) this.history.set(i, (h = []));
      h.push({ t: now, pos: { ...p.pos }, vel: { ...p.vel } });
      while (h.length > 2 && h[1].t <= now - keep) h.shift();
    });
  }

  /** Where it believes player i is: where they were `reaction` s ago (hard leads by that much). */
  private perceived(i: number, now: number): Snap | null {
    const h = this.history.get(i);
    if (!h || h.length === 0) return null;
    const at = now - this.k.reaction;
    let s = h[0];
    for (const x of h) if (x.t <= at) s = x;
    if (!this.k.lead) return s;
    const lag = now - s.t;
    return { t: s.t, vel: s.vel, pos: v3(s.pos.x + s.vel.x * lag, s.pos.y + s.vel.y * lag * 0.5, s.pos.z + s.vel.z * lag) };
  }

  private nearestOpponent(sim: YeetSim, pl: PlayerState): number {
    let best = -1;
    let bestD = Infinity;
    sim.players.forEach((p, i) => {
      if (i === this.me || p.dead > 0) return;
      const d = Math.hypot(p.pos.x - pl.pos.x, p.pos.z - pl.pos.z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  private canSee(sim: YeetSim, eye: Vec3, p: PlayerState): boolean {
    const to = v3(p.pos.x - eye.x, p.pos.y + CHEST - eye.y, p.pos.z - eye.z);
    const d = Math.hypot(to.x, to.y, to.z);
    if (d > this.t.bot.sightRange || d < 1e-3) return d < 1e-3;
    const dir = v3(to.x / d, to.y / d, to.z / d);
    return rayArena(sim.arena, eye, dir, d) >= d - 0.3;
  }

  // ---- decision ----------------------------------------------------------------------
  private decide(sim: YeetSim, pl: PlayerState, visible: boolean, dist: number, now: number): void {
    const k = this.k;
    const hp = pl.hp / this.t.player.hp;
    const gatling = sim.pickups.find((p) => p.weapon === "copter" && !p.taken);
    if (k.retreatHp > 0 && hp < k.retreatHp && visible && dist < 12) this.state = "retreat";
    else if (k.gatling && gatling && !pl.owned.includes("copter") && (!visible || dist > 16)) this.state = "gun";
    else if (visible) this.state = "engage";
    else this.state = "hunt";

    if (this.rand() < k.switchSkill || !pl.owned.includes(this.wantGun)) this.wantGun = this.bestGun(pl, dist);
    if (now >= this.strafeUntil) {
      this.strafeDir = this.rand() < 0.5 ? -1 : 1;
      this.strafeUntil = now + 0.4 + this.rand() * 1.2;
    }
    this.plant = this.rand() < k.plantFeet;
    if (!visible) this.aimDown = this.rand() < k.aimed;

    // travel by recoil: a Boomstick floor launch toward a far goal
    if (!this.launch && (this.state === "hunt" || this.state === "gun") && pl.onGround && pl.owned.includes("shotgun")
        && pl.mag.shotgun > 0 && this.rand() < k.launch * this.t.bot.decideEvery * 10) {
      const goal = this.goalFor(sim, pl, null, dist, now);
      if (goal && Math.hypot(goal.x - pl.pos.x, goal.z - pl.pos.z) >= this.t.bot.launchFrom) {
        // the push is opposite the aim: face away from the goal to fly toward it
        const away = Math.atan2(goal.x - pl.pos.x, goal.z - pl.pos.z);
        this.launch = { yaw: away, until: now + LAUNCH_TIMEOUT };
      }
    }
  }

  /** The gun this bot would pick for a fight at this range (from the guns it owns). */
  private bestGun(pl: PlayerState, dist: number): WeaponId {
    const r = this.t.bot.ranges;
    const owns = (w: WeaponId) => pl.owned.includes(w) && BOT_GUNS.includes(w);
    if (dist < r.shotgun && owns("shotgun")) return "shotgun";
    if (dist < 30 && owns("copter")) return "copter";
    if (dist < r.pistol && owns("pistol")) return "pistol";
    if (owns("sniper")) return "sniper";
    return owns("pistol") ? "pistol" : pl.weapon;
  }

  private goalFor(sim: YeetSim, pl: PlayerState, seen: Snap | null, dist: number, now: number): Vec3 | null {
    const k = this.k;
    if (this.state === "gun") {
      const g = sim.pickups.find((p) => p.weapon === "copter" && !p.taken);
      if (g) return g.pos;
    }
    if ((this.state === "engage" || this.state === "retreat") && seen) {
      const dx = seen.pos.x - pl.pos.x;
      const dz = seen.pos.z - pl.pos.z;
      const d = Math.max(0.01, Math.hypot(dx, dz));
      const hold = this.t.bot.hold[pl.weapon as keyof typeof this.t.bot.hold] ?? 10;
      // in or out along the line to the target, plus a side-step
      const radial = this.state === "retreat" ? -1 : clamp((d - hold) / 4, -1, 1);
      const side = this.strafeDir * k.strafe;
      const mx = (dx / d) * radial + (-dz / d) * side;
      const mz = (dz / d) * radial + (dx / d) * side;
      return v3(pl.pos.x + mx * 4, pl.pos.y, pl.pos.z + mz * 4);
    }
    if (this.lastSeen && now - this.lastSeen.t < this.t.bot.eyeMemory) return this.lastSeen.pos;
    // nothing to chase: roam between the places a player would check (spawns, pickups, the middle)
    if (!this.roam || now > this.roamUntil || Math.hypot(this.roam.x - pl.pos.x, this.roam.z - pl.pos.z) < 2) {
      const spots: Vec3[] = [v3(0, 0, 0), ...(sim.level.spawns ?? [sim.level.spawn]), ...sim.pickups.map((p) => p.pos)];
      this.roam = spots[Math.floor(this.rand() * spots.length) % spots.length];
      this.roamUntil = now + 4 + this.rand() * 3;
    }
    void dist;
    return this.roam;
  }

  // ---- action --------------------------------------------------------------------------
  private shouldFire(pl: PlayerState, eye: Vec3, seen: Snap, dist: number, now: number): boolean {
    const w = this.t.weapons[pl.weapon];
    if (!BOT_GUNS.includes(pl.weapon)) return false;
    if (now - this.seenSince < this.k.reaction) return false; // still taking in what it just saw
    if (pl.cooldown > 0 || pl.reloading > 0 || pl.mag[pl.weapon] <= 0 || dist > w.range) return false;
    const want = lookAngles(eye, v3(seen.pos.x, seen.pos.y + CHEST, seen.pos.z));
    const err = Math.hypot(wrap(want.yaw - pl.yaw), want.pitch - pl.pitch);
    const cone = this.k.fireCone * Math.atan2(HALF_WIDTH, Math.max(1, dist));
    return err < cone;
  }

  /** The direction to walk toward `goal`, turned away from walls; jump when a low wall is in the way. */
  private steer(sim: YeetSim, pl: PlayerState, goal: Vec3): { dx: number; dz: number; jump: boolean } | null {
    let dx = goal.x - pl.pos.x;
    let dz = goal.z - pl.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.6) return null;
    dx /= d;
    dz /= d;
    const probe = Math.min(this.t.bot.probe, d);
    const blocked = (ax: number, az: number, h: number) =>
      rayArena(sim.arena, v3(pl.pos.x, pl.pos.y + h, pl.pos.z), v3(ax, 0, az), probe) < probe - 0.05;
    if (!blocked(dx, dz, LOW_PROBE)) return { dx, dz, jump: false };
    if (!blocked(dx, dz, HIGH_PROBE) && pl.onGround) return { dx, dz, jump: true }; // a low wall: hop it
    for (const a of AVOID) {
      const c = Math.cos(a * this.strafeDir);
      const s = Math.sin(a * this.strafeDir);
      const ax = dx * c - dz * s;
      const az = dx * s + dz * c;
      if (!blocked(ax, az, LOW_PROBE)) return { dx: ax, dz: az, jump: false };
    }
    return { dx, dz, jump: pl.onGround };
  }
}
