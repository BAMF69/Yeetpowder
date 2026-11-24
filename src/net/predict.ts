// ---------------------------------------------------------------------------
// predict.ts
// Purpose : Client-side prediction for the duel (GDD netcode plan): your own moves happen at once in a local copy of
//           the sim; when the server's snapshot arrives the copy jumps to the server's truth and replays the inputs
//           the server has not applied yet. Because the sim is deterministic (ADR 0001), a correct prediction lands
//           exactly where it already was, so you only see a correction when something really differed.
// Usage   : const pr = new Predictor(slot);
//           each fixed step: const { msg, events } = pr.local(input, dYaw, dPitch); queue msg for sending
//           on a snapshot: const err = pr.onSnapshot(snap)    // metres your player was moved by the correction
// Notes   : Other players are not predicted here: the world draws them from the snapshot buffer, ~100 ms behind and
//           smoothed (src/game/net/remote.ts). Events from a replay are thrown away (they already played once).
//           The local copy still steps them, with what the server says they hold (snapshot `held`), not with nothing:
//           with nothing, their hook let go in your copy every step and you were never dragged (tablet duel, 2026-11-22).
//           Their events from this copy are not yours to play: DuelLink.stepLocal keeps only your own.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { duelLevel } from "../core/yeet/levels";
import { NO_INPUT, YeetSim, type TaggedEvent, type YeetInput } from "../core/yeet/sim";
import { TUNING } from "../core/yeet/tuning";
import type { NetInput, Snapshot } from "./protocol";
import { SLOTS } from "./room";

export class Predictor {
  readonly sim = new YeetSim(TUNING, duelLevel(), SLOTS);
  /** Inputs sent but not yet acknowledged by the server, oldest first. */
  readonly pending: NetInput[] = [];
  private seq = 0;
  /** The last correction's size (m) and the tick of the last snapshot applied. */
  lastError = 0;
  lastTick = -1;
  /** What the other players hold, from the last snapshot (NO_INPUT until one arrives). */
  private others: YeetInput[] = Array(SLOTS).fill(NO_INPUT);

  slot: number;

  constructor(slot: number) {
    this.slot = slot;
    this.sim.localIndex = slot;
  }

  /** What player j holds down, as the last snapshot said (their aim, F held ...), or null before one arrived. */
  heldBy(j: number): YeetInput | null {
    return this.lastTick < 0 ? null : (this.others[j] ?? null);
  }

  /** The server told us our slot (after joining): from now on we predict that player. */
  setSlot(slot: number): void {
    this.slot = slot;
    this.sim.localIndex = slot;
  }

  private stepWith(input: YeetInput): TaggedEvent[] {
    const inputs: YeetInput[] = [...this.others];
    inputs[this.slot] = input;
    return this.sim.step(inputs);
  }

  /** Predicts one step of your own input now; returns it numbered for the server, and the step's events. */
  local(input: YeetInput, dYaw: number, dPitch: number): { msg: NetInput; events: TaggedEvent[] } {
    const msg: NetInput = { ...input, seq: ++this.seq, dYaw, dPitch };
    this.pending.push(msg);
    this.sim.look(dYaw, dPitch, this.slot);
    return { msg, events: this.stepWith(msg) };
  }

  /** Applies a server snapshot: jump to its state, replay unacknowledged inputs. Returns the correction (m). */
  onSnapshot(snap: Snapshot): number {
    if (snap.tick <= this.lastTick) return 0; // an old or repeated snapshot
    this.lastTick = snap.tick;
    if (snap.held) this.others = snap.held.map((h, j) => (snap.present[j] ? h : NO_INPUT));
    const before = { ...this.sim.players[this.slot].pos };
    this.sim.importState(snap.state);
    const ack = snap.acks[this.slot] ?? 0;
    while (this.pending.length && this.pending[0].seq <= ack) this.pending.shift();
    for (const p of this.pending) {
      this.sim.look(p.dYaw, p.dPitch, this.slot);
      this.stepWith(p);
    }
    const after = this.sim.players[this.slot].pos;
    this.lastError = Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z);
    return this.lastError;
  }
}
