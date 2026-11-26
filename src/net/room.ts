// ---------------------------------------------------------------------------
// room.ts
// Purpose : One authoritative room, with no sockets in it (so Vitest runs it): 2–8 player slots, a queue of
//           inputs per player, the authoritative YeetSim stepped at a fixed rate, and the snapshots sent back.
// Usage   : const room = new Room("ABCD"); const slot = room.join(); room.push(slot, inputs);
//           every sim step: room.step(); every SNAP_EVERY steps: send(room.snapshot())
// Notes   : The server owns the truth (GDD netcode plan). Each step takes each player's next queued input; with none
//           queued it repeats the last one with its one-shot presses cleared and no look change (so a late packet
//           never fires twice or turns you twice). Look deltas are applied before the step, exactly as the
//           predicting client does (src/net/predict.ts).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { BotBrain, type BotSkill } from "../core/yeet/bot";
import { roomOptions, roomLevel, type RoomOptions, type MatchStatus } from "./roomOptions";
import { NO_INPUT, YeetSim, type TaggedEvent, type YeetInput } from "../core/yeet/sim";
import { TUNING } from "../core/yeet/tuning";
import { MAX_QUEUE, type NetInput, type Snapshot } from "./protocol";
import { HighlightRecorder } from "./highlight";
import { playerProfile, type PlayerProfile } from "./profile";

export const SLOTS = 2;

const quiet = (i: NetInput): NetInput => ({
  ...i, jump: false, firePressed: false, select: -1, reset: false, reload: false, slash: false, heal: false, spawn: false, dYaw: 0, dPitch: 0,
});

/** The held part of an input as a plain YeetInput (no seq or look), for the snapshot's `held`. */
function heldOf(i: NetInput): YeetInput {
  const { seq: _s, dYaw: _y, dPitch: _p, ...rest } = quiet(i);
  return rest;
}

export class Room {
  readonly options: RoomOptions;
  sim: YeetSim;
  readonly profiles: PlayerProfile[];
  round = 1;
  private finishedTick = 0;
  readonly present: boolean[];
  readonly bots: (BotSkill | null)[];
  readonly acks: number[];
  private readonly brains: (BotBrain | null)[];
  private readonly queues: NetInput[][];
  private readonly last: NetInput[];
  private readonly queuedSeq: number[];
  private events: TaggedEvent[] = [];
  private startedAt: number | null = null;
  readonly match: MatchStatus;
  tick = 0;
  readonly legacy: boolean;
  private recorder = new HighlightRecorder();
  private replaySent = false;

  constructor(readonly code: string, options?: Partial<RoomOptions>) {
    this.legacy = options === undefined;
    this.options = roomOptions(options ?? { level: "duel", capacity: 2, botFill: false });
    const n = this.options.capacity;
    this.profiles = Array.from({ length: n }, (_, i) => playerProfile(undefined, `Player ${i + 1}`));
    this.sim = new YeetSim(TUNING, roomLevel(this.options), n);
    this.present = Array(n).fill(false);
    this.bots = Array(n).fill(null);
    this.brains = Array(n).fill(null);
    this.acks = Array(n).fill(0);
    this.queuedSeq = Array(n).fill(0);
    this.queues = Array.from({ length: n }, () => []);
    this.last = Array.from({ length: n }, () => ({ ...NO_INPUT, seq: 0, dYaw: 0, dPitch: 0 }));
    this.match = { phase: "waiting", elapsed: 0, remaining: this.options.minutes * 60,
      lives: Array(n).fill(this.options.lives), winners: [] };
    for (let s = 0; s < n; s++) this.fill(s);
  }

  private fill(slot: number): void {
    const skill: BotSkill = !this.options.botSkill || this.options.botSkill === "mixed" ? (slot % 2 ? "medium" : "easy") : this.options.botSkill;
    this.profiles[slot] = playerProfile({ name: `${skill[0].toUpperCase() + skill.slice(1)} bot ${slot + 1}`, operator: ["navy", "ember", "mint", "violet"][slot % 4] as PlayerProfile["operator"] });
    this.bots[slot] = this.options.botFill ? skill : null;
    this.brains[slot] = this.options.botFill ? new BotBrain(TUNING, slot, skill, this.sim.level.seed * 101 + slot) : null;
    if (!this.options.botFill) { this.sim.players[slot].hp = 0; this.sim.players[slot].dead = 1e9; }
  }

  get active(): boolean[] {
    return this.present.map((human, s) => (human || !!this.bots[s]) && (this.options.mode !== "lives" || this.match.lives[s] > 0));
  }
  get owner(): number { return this.present.indexOf(true); }
  get empty(): boolean { return this.present.every((p) => !p); }
  get full(): boolean { return this.present.every(Boolean); }

  join(profile?: PlayerProfile): number {
    if (!this.legacy && this.match.phase === "finished") return -1;
    if (!this.legacy && this.options.mode === "lives" && !this.options.botFill && this.match.phase === "playing") return -1;
    const liveSeat = this.present.findIndex((human, s) => !human && (this.options.mode !== "lives" || this.match.lives[s] > 0));
    const slot = liveSeat >= 0 ? liveSeat : this.present.indexOf(false);
    if (slot < 0) return -1;
    this.present[slot] = true;
    this.profiles[slot] = playerProfile(profile?.name === "Player" ? { ...profile, name: `Player ${slot + 1}` } : profile, `Player ${slot + 1}`);
    this.bots[slot] = null; this.brains[slot] = null;
    this.queues[slot].length = 0; this.queuedSeq[slot] = this.acks[slot] = 0;
    this.last[slot] = { ...NO_INPUT, seq: 0, dYaw: 0, dPitch: 0 };
    this.sim.resetSlot(slot); this.sim.kos[slot] = 0;
    return slot;
  }

  /** A seated human renames or swaps operator; the next snapshot's roster carries it to everyone. */
  setProfile(slot: number, profile: unknown): void {
    if (slot < 0 || slot >= this.present.length || !this.present[slot] || !profile || typeof profile !== "object") return;
    this.profiles[slot] = playerProfile(profile as Partial<PlayerProfile>, `Player ${slot + 1}`);
  }

  leave(slot: number): void {
    if (slot < 0 || slot >= this.present.length || !this.present[slot]) return;
    this.present[slot] = false;
    this.queues[slot].length = 0;
    this.last[slot] = { ...NO_INPUT, seq: 0, dYaw: 0, dPitch: 0 };
    this.sim.resetSlot(slot); this.sim.kos[slot] = 0;
    this.fill(slot);
  }

  push(slot: number, inputs: NetInput[]): void {
    if (!this.present[slot]) return;
    const q = this.queues[slot];
    for (const i of inputs.slice(-MAX_QUEUE)) {
      if ((i?.round ?? 1) !== this.round) continue;
      if (!i || !Number.isSafeInteger(i.seq) || i.seq <= this.queuedSeq[slot] ||
          ![i.dYaw, i.dPitch, i.moveX, i.moveZ, i.select].every(Number.isFinite)) continue;
      this.queuedSeq[slot] = i.seq;
      const clean: NetInput = { ...NO_INPUT, round: this.round, seq: i.seq, moveX: Math.max(-1, Math.min(1, i.moveX)), moveZ: Math.max(-1, Math.min(1, i.moveZ)),
        dYaw: Math.max(-Math.PI, Math.min(Math.PI, i.dYaw)), dPitch: Math.max(-Math.PI, Math.min(Math.PI, i.dPitch)),
        select: Math.max(-1, Math.min(TUNING.weaponOrder.length - 1, Math.floor(i.select))), reset: false };
      for (const key of ["jump", "firePressed", "fireHeld", "aiming", "sprint", "reload", "slash", "slashHeld", "touch", "heal", "spawn"] as const) clean[key] = i[key] === true;
      q.push(clean);
    }
    if (q.length > MAX_QUEUE) q.splice(0, q.length - MAX_QUEUE);
  }

  step(): void {
    this.tick++;
    if (this.match.phase === "finished") {
      if (this.options.visibility === "public") {
        this.match.nextRoundIn = Math.max(0, 30 - (this.tick - this.finishedTick) * TUNING.step);
        if (this.match.nextRoundIn === 0) this.nextRound(this.owner);
      }
      return;
    }
    const active = this.active;
    if (this.match.phase === "waiting" && active.filter(Boolean).length >= 2 && !this.empty && (this.options.botFill || this.full)) {
      if (!this.legacy && !this.options.botFill) {
        // Waiting players can warm up; scores, pickups and health start fresh once all human seats fill.
        this.sim.importState(new YeetSim(TUNING, roomLevel(this.options), this.options.capacity).exportState());
        this.events = [];
      }
      this.match.phase = "playing"; this.startedAt = this.sim.time;
    }
    const alive = this.sim.players.map((p, s) => active[s] && p.dead === 0);
    const inputs: YeetInput[] = [];
    for (let s = 0; s < this.present.length; s++) {
      if (!active[s]) {
        this.sim.players[s].dead = 1e9;
        inputs.push(NO_INPUT); continue;
      }
      if (this.brains[s]) {
        const out = this.brains[s]!.think(this.sim);
        this.sim.look(out.dYaw, out.dPitch, s);
        this.last[s] = { ...out.input, seq: 0, dYaw: out.dYaw, dPitch: out.dPitch };
        inputs.push(out.input); continue;
      }
      const next = this.queues[s].shift();
      const inp = next ?? quiet(this.last[s]);
      if (next) { this.last[s] = next; this.acks[s] = next.seq; }
      this.sim.look(inp.dYaw, inp.dPitch, s);
      inputs.push(inp);
    }
    const stepEvents = this.sim.step(inputs); this.events.push(...stepEvents);
    if (this.legacy) return; // Keep the original unbounded duel flow; configured rooms own match rules.
    if (this.match.phase !== "playing") return;
    this.recorder.record(this.sim.time, this.sim.players, active, stepEvents);
    this.match.elapsed = this.sim.time - this.startedAt!;
    this.match.remaining = Math.max(0, this.options.minutes * 60 - this.match.elapsed);
    if (this.options.mode === "lives") {
      this.sim.players.forEach((p, s) => { if (alive[s] && p.dead > 0) this.match.lives[s] = Math.max(0, this.match.lives[s] - 1); });
      const remaining = this.active.flatMap((yes, s) => yes ? [s] : []);
      if (remaining.length <= 1) this.finish(remaining);
    } else if (this.options.mode === "timed") {
      if (this.match.remaining <= 0) {
        const best = Math.max(...this.sim.kos.filter((_, s) => active[s]));
        this.finish(this.sim.kos.flatMap((score, s) => active[s] && score === best ? [s] : []));
      }
    } else {
      const winners = this.sim.kos.flatMap((score, s) => active[s] && score >= this.options.scoreLimit ? [s] : []);
      if (winners.length) this.finish(winners);
    }
  }

  private finish(winners: number[]): void {
    this.match.phase = "finished"; this.match.winners = winners; this.finishedTick = this.tick;
    if (this.options.visibility === "public") this.match.nextRoundIn = 30;
  }

  nextRound(slot: number): void {
    if (this.options.visibility !== "public" || !this.present[slot] || this.match.phase !== "finished") return;
    const maps = ["island-party", "industrial-party", "junkyard-party", "coliseum"] as const;
    this.options.level = maps[(maps.indexOf(this.options.level as typeof maps[number]) + 1) % maps.length];
    this.options.mode = "kills";
    this.sim = new YeetSim(TUNING, roomLevel(this.options), this.options.capacity);
    this.restart(this.owner); this.round++;
    this.acks.fill(0); this.queuedSeq.fill(0);
  }

  restart(slot: number): void {
    if (slot !== this.owner || this.match.phase !== "finished") return;
    this.sim.importState(new YeetSim(TUNING, roomLevel(this.options), this.options.capacity).exportState());
    this.match.phase = "waiting"; this.match.elapsed = 0; this.match.remaining = this.options.minutes * 60;
    this.match.winners = []; this.match.lives.fill(this.options.lives); this.startedAt = null; this.events = [];
    delete this.match.nextRoundIn;
    this.recorder = new HighlightRecorder(); this.replaySent = false;
    for (let s = 0; s < this.present.length; s++) {
      this.queues[s].length = 0;
      this.last[s] = { ...NO_INPUT, seq: this.acks[s], dYaw: 0, dPitch: 0 };
      if (!this.present[s]) this.fill(s);
    }
  }

  snapshot(clearEvents = true): Snapshot {
    const snap: Snapshot = { t: "snap", tick: this.tick, acks: [...this.acks], state: this.sim.exportState(),
      events: [...this.events], present: [...this.present], bots: [...this.bots], active: this.active,
      held: this.last.map((l, s) => this.active[s] ? heldOf(l) : NO_INPUT),
      match: structuredClone(this.match), owner: this.owner };
    snap.round = this.round; snap.profiles = structuredClone(this.profiles);
    if (this.match.phase === "finished" && (!this.replaySent || !clearEvents)) {
      snap.replay = this.recorder.clip();
      if (snap.replay) {
        const winner = this.match.winners[0] ?? snap.replay.slot;
        snap.replay.name = this.profiles[snap.replay.slot].name;
        snap.replay.operator = this.profiles[snap.replay.slot].operator;
        snap.replay.operators = this.profiles.map(profile => profile.operator);
        snap.replay.winner = { slot: winner, name: this.profiles[winner].name, score: this.sim.kos[winner] };
        snap.replay.intro = { time: this.sim.time, actors: this.sim.players.map((p, i) => this.active[i] ? { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch,
          speed: Math.hypot(p.vel.x, p.vel.y, p.vel.z), weapon: p.weapon, dead: p.dead > 0, ground: p.onGround, hidden: p.swallowed } : null) };
      }
      if (clearEvents) this.replaySent = true;
    }
    if (clearEvents) this.events = [];
    return snap;
  }
}
