// ---------------------------------------------------------------------------
// room.ts
// Purpose : One duel room on the server, with no sockets in it (so Vitest runs it): two player slots, a queue of
//           inputs per player, the authoritative YeetSim stepped at a fixed rate, and the snapshots sent back.
// Usage   : const room = new Room("ABCD"); const slot = room.join(); room.push(slot, inputs);
//           every sim step: room.step(); every SNAP_EVERY steps: send(room.snapshot())
// Notes   : The server owns the truth (GDD netcode plan). Each step takes each player's next queued input; with none
//           queued it repeats the last one with its one-shot presses cleared and no look change (so a late packet
//           never fires twice or turns you twice). Look deltas are applied before the step, exactly as the
//           predicting client does (src/net/predict.ts).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { duelLevel } from "../core/yeet/levels";
import { NO_INPUT, YeetSim, type TaggedEvent, type YeetInput } from "../core/yeet/sim";
import { TUNING } from "../core/yeet/tuning";
import { MAX_QUEUE, type NetInput, type Snapshot } from "./protocol";

export const SLOTS = 2;

const quiet = (i: NetInput): NetInput => ({
  ...i, jump: false, firePressed: false, select: -1, reset: false, reload: false, slash: false, dYaw: 0, dPitch: 0,
});

/** The held part of an input as a plain YeetInput (no seq or look), for the snapshot's `held`. */
function heldOf(i: NetInput): YeetInput {
  const { seq: _s, dYaw: _y, dPitch: _p, ...rest } = quiet(i);
  return rest;
}

export class Room {
  readonly sim = new YeetSim(TUNING, duelLevel(), SLOTS);
  readonly present: boolean[] = Array(SLOTS).fill(false);
  private readonly queues: NetInput[][] = Array.from({ length: SLOTS }, () => []);
  private readonly last: NetInput[] = Array.from({ length: SLOTS }, () => ({ ...NO_INPUT, seq: 0, dYaw: 0, dPitch: 0 }));
  /** The highest input seq queued per slot (duplicates and resends are ignored). */
  private readonly queuedSeq: number[] = Array(SLOTS).fill(0);
  readonly acks: number[] = Array(SLOTS).fill(0);
  private events: TaggedEvent[] = [];
  tick = 0;

  constructor(readonly code: string) {}

  /** Takes the first free slot (0 or 1), or -1 when the room is full. */
  join(): number {
    const slot = this.present.indexOf(false);
    if (slot < 0) return -1;
    this.present[slot] = true;
    this.queues[slot].length = 0;
    this.queuedSeq[slot] = 0;
    this.acks[slot] = 0;
    this.last[slot] = { ...NO_INPUT, seq: 0, dYaw: 0, dPitch: 0 };
    return slot;
  }

  leave(slot: number): void {
    if (slot >= 0 && slot < SLOTS) this.present[slot] = false;
  }

  get empty(): boolean {
    return this.present.every((p) => !p);
  }

  /** Queues a player's inputs in seq order, skipping ones already queued (clients may resend). */
  push(slot: number, inputs: NetInput[]): void {
    if (!this.present[slot]) return;
    const q = this.queues[slot];
    for (const i of inputs) {
      if (i.seq <= this.queuedSeq[slot]) continue;
      this.queuedSeq[slot] = i.seq;
      q.push(i);
    }
    if (q.length > MAX_QUEUE) q.splice(0, q.length - MAX_QUEUE);
  }

  /** One authoritative sim step with each player's next input. */
  step(): void {
    const inputs: YeetInput[] = [];
    for (let s = 0; s < SLOTS; s++) {
      const next = this.present[s] ? this.queues[s].shift() : undefined;
      const inp = next ?? quiet(this.last[s]);
      if (next) {
        this.last[s] = next;
        this.acks[s] = next.seq;
      }
      if (!this.present[s]) {
        inputs.push(NO_INPUT);
        continue;
      }
      this.sim.look(inp.dYaw, inp.dPitch, s);
      inputs.push(inp);
    }
    this.events.push(...this.sim.step(inputs));
    this.tick++;
  }

  /** The snapshot for every client: state, acks, and the events since the last snapshot. */
  snapshot(): Snapshot {
    const snap: Snapshot = {
      t: "snap", tick: this.tick, acks: [...this.acks], state: this.sim.exportState(), events: this.events,
      present: [...this.present], held: this.last.map((l, s) => (this.present[s] ? heldOf(l) : NO_INPUT)),
    };
    this.events = [];
    return snap;
  }
}
