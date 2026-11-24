// ---------------------------------------------------------------------------
// protocol.ts
// Purpose : The duel's wire format (ADR 0002): what a browser and the duel server (server/main.ts) say to each other
//           over a WebSocket. Inputs go up (one per fixed sim step, with look deltas), snapshots come down.
// Usage   : import { DUEL_PORT, type ClientMsg, type ServerMsg } from "../net/protocol"
// Notes   : JSON for now (a 2-player LAN slice; a binary format is a later optimisation if snapshots get big).
//           Inputs carry look CHANGES (dYaw, dPitch), not angles: the sim turns you too (twist, copter, flips), so
//           only deltas keep the server and the predicting client identical. No three or DOM import: Node and the
//           browser both use this file.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import type { SimState, TaggedEvent, YeetInput } from "../core/yeet/sim";

/** The duel server's port on this PC (the page itself is served by Vite). */
export const DUEL_PORT = 7357;
/** Sim steps per snapshot: 4 at 120 Hz = 30 snapshots a second. */
export const SNAP_EVERY = 4;
/** Most inputs the server keeps queued per player (older ones are dropped: a client far ahead is lagging). */
export const MAX_QUEUE = 120;
/** Letters for room codes: no I or O (they read as 1 and 0). */
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/** One player's input for one sim step, numbered so the server can acknowledge it. */
export interface NetInput extends YeetInput {
  seq: number;
  dYaw: number;
  dPitch: number;
}

export type ClientMsg =
  | { t: "create" }
  | { t: "join"; code: string }
  | { t: "in"; inputs: NetInput[] }
  | { t: "ping"; at: number };

export interface Snapshot {
  t: "snap";
  tick: number;
  /** The last input seq the server has applied, per slot. */
  acks: number[];
  state: SimState;
  /** Everything that happened since the previous snapshot, each tagged with its player (p). */
  events: TaggedEvent[];
  /** Which slots have a connected player. */
  present: boolean[];
  /**
   * What each player is holding down right now (their last input, one-shot presses cleared), so a client's
   * prediction steps the other player the way the server does: still holding F keeps you on their hook.
   */
  held?: YeetInput[];
}

export type ServerMsg =
  | { t: "joined"; code: string; slot: number; level: "duel" }
  | Snapshot
  | { t: "error"; reason: string }
  | { t: "pong"; at: number };

/** A 4-letter room code from a random source in [0, 1). */
export function makeCode(rand: () => number): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_LETTERS[Math.floor(rand() * CODE_LETTERS.length) % CODE_LETTERS.length];
  return s;
}

/** A typed-in code made comparable: upper case, letters only, at most 4. */
export function cleanCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
}
