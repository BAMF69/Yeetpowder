// Connect before constructing the world: the authoritative room chooses the map, capacity and mode.
import { NetClient } from "./netClient";
import { PeerGuest, PeerHost } from "./peerLink";
import type { Transport } from "./transport";
import { DUEL_PORT, SNAP_EVERY, type ClientMsg, type NetInput, type ServerMsg, type Snapshot } from "../../net/protocol";
import { Room } from "../../net/room";
import { quickOptions, type RoomOptions } from "../../net/roomOptions";
import { TUNING } from "../../core/yeet/tuning";
import { shell } from "../../shell/app";
import { localProfile } from "../playerProfile";

export class PartySession {
  round = 1;
  private keepForReload = false;
  latest: Snapshot | null = null;
  private listener: ((message: ServerMsg) => void) | null = null;
  constructor(readonly transport: Transport, readonly slot: number, readonly code: string,
    public options: RoomOptions, readonly offline = false) {}
  receive(message: ServerMsg): void {
    if (message.t === "round") {
      this.round = message.round;
      this.options = { ...message.options }; this.latest = null;
      if (this.listener) { this.keepForReload = true; prepareParty(this); shell.worldOption = this.options.level; shell.startGame("main"); }
      return;
    }
    if (message.t === "snap") {
      this.round = message.round ?? this.round;
      this.latest = message.match?.phase === "finished" ? { ...message, replay: message.replay === undefined ? this.latest?.replay : message.replay } : message;
    }
    this.listener?.(message);
  }
  subscribe(listener: (message: ServerMsg) => void): void {
    this.listener = listener;
    if (this.latest) listener({ ...this.latest, events: [] });
  }
  close(): void { this.listener = null; if (this.keepForReload) { this.keepForReload = false; return; } this.transport.close(); }
}

let prepared: PartySession | null = null;
export function peekParty(): PartySession | null { return prepared; }
export function prepareParty(session: PartySession): void { prepared?.close(); prepared = session; }
export function takeParty(): PartySession | null { const result = prepared; prepared = null; return result; }

/** Same authoritative Room locally when Quick Play cannot reach matchmaking. It still has eight combatants. */
class LocalParty implements Transport {
  status = "open" as const;
  rtt = 0;
  failReason = "";
  readonly room: Room;
  readonly slot: number;
  private readonly timer: number;
  private last = performance.now();
  private accumulator = 0;
  private announcedRound = 1;
  onMessage: (message: ServerMsg) => void = () => {};
  constructor(options = quickOptions()) {
    this.room = new Room("LOCAL", options); this.slot = this.room.join(localProfile());
    this.timer = window.setInterval(() => {
      const now = performance.now();
      this.accumulator = Math.min(0.25, this.accumulator + (now - this.last) / 1000); this.last = now;
      while (this.accumulator >= TUNING.step) {
        this.accumulator -= TUNING.step;
        this.room.step();
        if (this.room.round !== this.announcedRound) { this.announcedRound = this.room.round; this.onMessage({ t: "round", options: { ...this.room.options }, round: this.room.round }); }
        if (this.room.tick % SNAP_EVERY === 0) this.onMessage(this.room.snapshot());
      }
    }, 8);
  }
  send(msg: ClientMsg): void {
    if (msg.t === "rematch") this.room.restart(this.slot);
    if (msg.t === "next") this.room.nextRound(this.slot);
    if (msg.t === "profile") this.room.setProfile(this.slot, msg.profile);
  }
  queue(input: NetInput): void { this.room.push(this.slot, [input]); }
  flush(): void {}
  close(): void { window.clearInterval(this.timer); }
}

export function localParty(options = quickOptions()): PartySession {
  const transport = new LocalParty(options);
  const session = new PartySession(transport, transport.slot, "LOCAL", transport.room.options, true);
  transport.onMessage = (m) => session.receive(m);
  session.receive(transport.room.snapshot(false));
  return session;
}

export function partySocketUrl(): string {
  return location.protocol === "https:" ? `wss://${location.host}/duel-ws` : `ws://${location.hostname || "localhost"}:${DUEL_PORT}`;
}

class RoomResponseError extends Error {}

function connect(factory: (receive: (message: ServerMsg) => void) => Transport,
  request: ClientMsg, signal: AbortSignal, timeoutMs: number): Promise<PartySession> {
  return new Promise((resolve, reject) => {
    let session: PartySession | null = null;
    let done = false, sent = false;
    const transport = factory((message) => {
      if (session) { session.receive(message); return; }
      if (done) return;
      if (message.t === "error") { fail(message.reason, true); return; }
      if (message.t !== "joined" || !message.options) return;
      done = true; window.clearInterval(timer); signal.removeEventListener("abort", aborted);
      session = new PartySession(transport, message.slot, message.code, message.options);
      resolve(session);
    });
    const fail = (reason: string, response = false) => {
      if (done) return;
      done = true; window.clearInterval(timer); signal.removeEventListener("abort", aborted);
      transport.close(); reject(response ? new RoomResponseError(reason) : new Error(reason));
    };
    const aborted = () => fail("Cancelled");
    const started = performance.now();
    const timer = window.setInterval(() => {
      if (signal.aborted) { aborted(); return; }
      if (transport.status === "closed") { fail(transport.failReason || "Connection closed"); return; }
      if (!sent && transport.status === "open") { sent = true; transport.send(request); }
      if (performance.now() - started > timeoutMs) fail(sent ? "Joining the room timed out. Please try again." : "Online matchmaking is unavailable.", sent);
    }, 30);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
}

export async function connectParty(request: ClientMsg, signal: AbortSignal, offline = false): Promise<PartySession> {
  if (request.t === "create" || request.t === "quick" || request.t === "join") request = { ...request, profile: localProfile() };
  if (offline && request.t === "quick") return localParty();
  try {
    return await connect((receive) => new NetClient(partySocketUrl(), 0, receive), request, signal,
      request.t === "quick" ? 5000 : 15000);
  } catch (error) {
    if (signal.aborted) throw error;
    if (request.t === "quick") return localParty();
    if (error instanceof RoomResponseError && !(request.t === "join" && error.message.startsWith("No room"))) throw error;
    // Invite-only rooms also retain the existing browser-hosted connection when no room server is available.
    if (request.t === "create" && request.options?.visibility !== "public")
      return connect((receive) => new PeerHost(receive), request, signal, 12000);
    if (request.t === "join") return connect((receive) => new PeerGuest(receive), request, signal, 16000);
    throw error;
  }
}
