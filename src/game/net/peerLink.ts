// ---------------------------------------------------------------------------
// peerLink.ts
// Purpose : Online duels with no game server (ADR 0004): the player who makes the room hosts it in their own
//           browser tab (the same Room the home server runs, stepped at 120 Hz here), and the other player connects
//           to that tab directly over WebRTC. PeerJS's free public broker only introduces the two browsers by room
//           code; the game traffic then goes player to player.
// Usage   : host:  new PeerHost(onMsg)  -> send({ t: "create" }) once status is "open"
//           guest: new PeerGuest(onMsg) -> send({ t: "join", code }) once status is "open"
//           both are Transports (transport.ts) for DuelLink.
// Notes   : The broker knows each room as "yeetpowder-v1-<CODE>". A data channel set reliable and ordered, so inputs
//           are sent once (as on the WebSocket). The host plays with no network delay (their inputs go straight into
//           the room); their prediction still runs, and is exact. The room's clock ticks from a tiny Web Worker:
//           a hidden tab's own timers slow to about once a second (tested: snapshots fell from 30 to 7 per second),
//           a worker's far less. A phone that sleeps the browser still pauses it: the host keeps the game open. Some networks block direct connections
//           (no relay server yet): then joining fails with a message. DEBUG: ?debug logs on the "net" channel.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { Peer, type DataConnection } from "peerjs";
import { Log } from "../../core/log";
import { TUNING } from "../../core/yeet/tuning";
import { makeCode, SNAP_EVERY, type ClientMsg, type NetInput, type ServerMsg } from "../../net/protocol";
import { Room } from "../../net/room";
import type { NetStatus, Transport } from "./transport";

const PREFIX = "yeetpowder-v1-";
const CONNECT = { reliable: true, serialization: "raw" } as const;
const STEP_MS = TUNING.step * 1000;
const MAX_STEPS_PER_TICK = 30; // after a long stall, catch up this much and drop the rest (as the server does)

const parse = (raw: unknown): ClientMsg | ServerMsg | null => {
  try {
    return JSON.parse(String(raw)) as ClientMsg | ServerMsg;
  } catch {
    return null; // not ours: ignore
  }
};

/** Words for a PeerJS error a player might see. */
function reasonFor(type: string): string {
  if (type === "network" || type === "server-error" || type === "socket-error" || type === "socket-closed") {
    return "Could not reach the matchmaking service (check the internet connection).";
  }
  if (type === "browser-incompatible") return "This browser cannot make direct connections (WebRTC).";
  if (type === "webrtc") return "The direct connection failed (some networks block it).";
  return `Connection problem (${type}).`;
}

/**
 * Calls `fn` about every 4 ms from a Web Worker's timer (made from a few lines of code, no file), which a hidden tab
 * slows far less than its own. Falls back to a page timer if workers are blocked.
 */
function tickWorker(fn: () => void): Worker | null {
  try {
    const src = "setInterval(() => postMessage(0), 4);";
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    w.onmessage = fn;
    return w;
  } catch (err) {
    Log.warn("net", `no worker clock (${String(err)}): the room slows while this tab is hidden`);
    window.setInterval(fn, 4);
    return null;
  }
}

// ---- host ----------------------------------------------------------------------------
export class PeerHost implements Transport {
  status: NetStatus = "connecting";
  rtt = 0;
  failReason = "";
  private peer: Peer | null = null;
  private code = "";
  private room: Room | null = null;
  private hostSlot = -1;
  private readonly conns: Array<DataConnection | null> = Array(8).fill(null);
  private readonly watchers = new Set<DataConnection>();
  private clock: Worker | null = null;
  private last = 0;
  private acc = 0;

  constructor(private readonly onMsg: (m: ServerMsg) => void) {
    this.register(0);
  }

  /** Takes a free room code on the broker (a taken one: try another). */
  private register(tries: number): void {
    this.code = makeCode(Math.random);
    const peer = new Peer(PREFIX + this.code);
    this.peer = peer;
    peer.on("open", () => {
      this.status = "open";
      Log.debug("net", `hosting as ${this.code}`);
    });
    peer.on("connection", (conn) => this.accept(conn));
    peer.on("error", (err) => {
      if (err.type === "unavailable-id" && tries < 5 && !this.room) {
        peer.destroy();
        this.register(tries + 1);
        return;
      }
      Log.warn("net", `host: ${err.type} ${String(err.message ?? "")}`);
      if (!this.room) {
        this.failReason = reasonFor(err.type);
        this.status = "closed";
      }
    });
    // the broker dropping us after the room exists does not end the duel (players are already connected)
    peer.on("disconnected", () => Log.debug("net", "host: broker connection dropped (the duel goes on)"));
  }

  send(msg: ClientMsg): void {
    if (msg.t === "rematch") { this.room?.restart(this.hostSlot); return; }
    if (msg.t !== "create" || this.room) return; // the host only ever makes its own room
    this.room = new Room(this.code, msg.options);
    this.hostSlot = this.room.join();
    this.onMsg({ t: "joined", code: this.code, slot: this.hostSlot, level: this.room.options.level, options: this.room.options });
    this.last = performance.now();
    this.clock = tickWorker(() => this.tick());
  }

  queue(input: NetInput): void {
    this.room?.push(this.hostSlot, [input]); // no network between you and your own room
  }

  flush(): void {}

  close(): void {
    this.clock?.terminate();
    for (const c of this.conns) c?.close();
    for (const c of this.watchers) c.close();
    this.peer?.destroy();
    this.status = "closed";
  }

  private accept(conn: DataConnection): void {
    let slot = -1;
    let watching = false;
    conn.on("data", (raw) => {
      const msg = parse(raw) as ClientMsg | null;
      if (!msg || !this.room) return;
      if (msg.t === "ping") conn.send(JSON.stringify({ t: "pong", at: msg.at } satisfies ServerMsg));
      else if (msg.t === "in" && slot >= 0 && Array.isArray(msg.inputs)) this.room.push(slot, msg.inputs);
      else if (msg.t === "join" && slot < 0 && !watching) {
        if (msg.spectate) {
          if (this.watchers.size >= 16) { conn.send(JSON.stringify({ t: "error", reason: "Too many spectators." } satisfies ServerMsg)); return; }
          watching = true; this.watchers.add(conn);
          conn.send(JSON.stringify({ t: "joined", code: this.code, slot: -1, level: this.room.options.level, options: this.room.options } satisfies ServerMsg));
          conn.send(JSON.stringify({ ...this.room.snapshot(false), events: [] })); return;
        }
        slot = this.room.join();
        if (slot < 0) {
          conn.send(JSON.stringify({ t: "error", reason: "That room is full." } satisfies ServerMsg));
          return;
        }
        this.conns[slot] = conn;
        conn.send(JSON.stringify({ t: "joined", code: this.code, slot, level: this.room.options.level, options: this.room.options } satisfies ServerMsg));
        Log.debug("net", `player ${slot + 1} joined`);
      }
    });
    const gone = () => {
      if (watching) { this.watchers.delete(conn); watching = false; return; }
      if (slot < 0 || !this.room) return;
      this.room.leave(slot);
      this.conns[slot] = null;
      Log.debug("net", `player ${slot + 1} left`);
      slot = -1;
    };
    conn.on("close", gone);
    conn.on("error", gone);
  }

  /** The room's clock, as the server's: fixed 120 Hz steps, a snapshot every SNAP_EVERY to you and the guest. */
  private tick(): void {
    const room = this.room;
    if (!room) return;
    const now = performance.now();
    this.acc += now - this.last;
    this.last = now;
    let steps = 0;
    while (this.acc >= STEP_MS && steps < MAX_STEPS_PER_TICK) {
      this.acc -= STEP_MS;
      steps++;
      room.step();
      if (room.tick % SNAP_EVERY !== 0) continue;
      const snap = room.snapshot();
      const json = JSON.stringify(snap);
      for (const c of this.conns) if (c?.open) c.send(json);
      for (const c of this.watchers) if (c.open) c.send(json);
      this.onMsg(snap);
    }
    if (steps === MAX_STEPS_PER_TICK) this.acc = 0;
  }
}

// ---- guest ---------------------------------------------------------------------------
export class PeerGuest implements Transport {
  status: NetStatus = "connecting";
  rtt = 0;
  failReason = "";
  private readonly peer: Peer;
  private conn: DataConnection | null = null;
  private outbox: NetInput[] = [];
  private readonly pinger: number;

  constructor(private readonly onMsg: (m: ServerMsg) => void) {
    this.peer = new Peer();
    this.peer.on("open", () => (this.status = "open"));
    this.peer.on("error", (err) => {
      Log.warn("net", `guest: ${err.type} ${String(err.message ?? "")}`);
      if (err.type === "peer-unavailable") {
        this.conn = null;
        this.onMsg({ t: "error", reason: "No room with that code (is the host's game still open?)." });
        return;
      }
      this.failReason = reasonFor(err.type);
      if (!this.conn?.open) this.status = "closed";
    });
    this.pinger = window.setInterval(() => this.send({ t: "ping", at: performance.now() }), 1000);
  }

  send(msg: ClientMsg): void {
    if (msg.t === "join") {
      this.conn?.close();
      const conn = this.peer.connect(PREFIX + msg.code, CONNECT);
      this.conn = conn;
      conn.on("open", () => conn.send(JSON.stringify(msg)));
      conn.on("data", (raw) => this.receive(raw));
      conn.on("close", () => {
        if (this.conn !== conn) return;
        this.failReason = "The host left (their game closed).";
        this.status = "closed";
      });
      return;
    }
    if (this.conn?.open) this.conn.send(JSON.stringify(msg));
  }

  queue(input: NetInput): void {
    this.outbox.push(input);
  }

  joinProgress(): { brokerOpen: boolean; ice?: string } {
    return { brokerOpen: this.status === "open", ice: this.conn?.peerConnection?.iceConnectionState };
  }

  flush(): void {
    if (!this.outbox.length || !this.conn?.open) return;
    this.send({ t: "in", inputs: this.outbox });
    this.outbox = [];
  }

  close(): void {
    window.clearInterval(this.pinger);
    this.conn?.close();
    this.peer.destroy();
    this.status = "closed";
  }

  private receive(raw: unknown): void {
    const msg = parse(raw) as ServerMsg | null;
    if (!msg) return;
    if (msg.t === "pong") {
      this.rtt = performance.now() - msg.at;
      return;
    }
    this.onMsg(msg);
  }
}
