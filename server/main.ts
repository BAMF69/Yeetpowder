// ---------------------------------------------------------------------------
// server/main.ts
// Purpose : The duel server (vertical slice, ADR 0002): runs on this PC, holds rooms by 4-letter code, steps each
//           room's authoritative YeetSim at 120 Hz and sends snapshots at 30 Hz over plain WebSockets (`ws`).
// Usage   : npm run duel        (builds this file, starts it, and starts the game reachable over Wi-Fi)
//           npm run duel:server (only this server)          Logs DUEL_SERVER_READY with the LAN addresses.
// Notes   : All the rules live in src/net/room.ts and src/core/yeet/ (tested in Vitest); this file is sockets,
//           codes and the clock. Windows may ask once to let Node through the firewall on private networks: allow
//           it, or the phone cannot connect. DEBUG: YEET_DEBUG=1 logs every join and leave with timings.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
/// <reference types="node" />
import { networkInterfaces } from "node:os";
import { WebSocketServer, type WebSocket } from "ws";
import { TUNING } from "../src/core/yeet/tuning";
import { cleanCode, DUEL_PORT, SNAP_EVERY, type ClientMsg, type ServerMsg } from "../src/net/protocol";
import { Room } from "../src/net/room";
import { RoomDirectory } from "../src/net/roomDirectory";
import type { PlayerProfile } from "../src/net/profile";

const STEP_MS = TUNING.step * 1000;
const MAX_STEPS_PER_TICK = 30; // after a long stall, catch up this much and drop the rest
const debug = process.env.YEET_DEBUG === "1";

interface Seat {
  room: Room;
  slot: number;
}

const directory = new RoomDirectory();
const rooms = directory.rooms;
const sockets = new Map<Room, Array<WebSocket | null>>();
const seats = new Map<WebSocket, Seat>();
const spectators = new Map<Room, Set<WebSocket>>();
const announcedRounds = new WeakMap<Room, number>();

const send = (ws: WebSocket, msg: ServerMsg) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
};

function seat(ws: WebSocket, room: Room, spectate = false, profile?: PlayerProfile): void {
  if (spectate) {
    const watchers = spectators.get(room) ?? new Set<WebSocket>();
    if (watchers.size >= 16) { send(ws, { t: "error", reason: "That room has enough spectators." }); return; }
    watchers.add(ws); spectators.set(room, watchers); seats.set(ws, { room, slot: -1 });
    send(ws, { t: "joined", code: room.code, slot: -1, level: room.options.level, options: room.options });
    send(ws, { ...room.snapshot(false), events: [] }); return;
  }
  const slot = room.join(profile);
  if (slot < 0) {
    send(ws, { t: "error", reason: room.match.phase === "finished" ? "That match has ended. Join after the host starts a rematch."
      : !room.full && room.options.mode === "lives" ? "That elimination round has started. Join after the rematch." : "That room is full." });
    return;
  }
  const list = sockets.get(room) ?? Array(room.options.capacity).fill(null);
  list[slot] = ws;
  sockets.set(room, list);
  seats.set(ws, { room, slot });
  send(ws, { t: "joined", code: room.code, slot, level: room.options.level, options: room.options });
  send(ws, { ...room.snapshot(false), events: [] });
  if (debug) console.log(`[duel] ${room.code}: player ${slot + 1} joined`);
}

function leave(ws: WebSocket): void {
  const s = seats.get(ws);
  if (!s) return;
  seats.delete(ws);
  if (s.slot < 0) { spectators.get(s.room)?.delete(ws); return; }
  s.room.leave(s.slot);
  const list = sockets.get(s.room);
  if (list) list[s.slot] = null;
  if (debug) console.log(`[duel] ${s.room.code}: player ${s.slot + 1} left`);
  if (s.room.empty) {
    for (const watcher of spectators.get(s.room) ?? []) watcher.close(1000, "All players left");
    spectators.delete(s.room);
    rooms.delete(s.room.code);
    sockets.delete(s.room);
  }
}

function onMessage(ws: WebSocket, raw: string): void {
  let msg: ClientMsg;
  try {
    msg = JSON.parse(raw) as ClientMsg;
  } catch {
    return; // not ours: ignore
  }
  if (!msg || typeof msg !== "object") return;
  if (msg.t === "ping") return send(ws, { t: "pong", at: msg.at });
  if (msg.t === "leave") { leave(ws); ws.close(1000); return; }
  if (msg.t === "in") {
    const s = seats.get(ws);
    if (s && s.slot >= 0 && Array.isArray(msg.inputs)) s.room.push(s.slot, msg.inputs);
    return;
  }
  if (msg.t === "rematch") { const s = seats.get(ws); if (s && s.slot >= 0) s.room.restart(s.slot); return; }
  if (msg.t === "next") { const s = seats.get(ws); if (s && s.slot >= 0) s.room.nextRound(s.slot); return; }
  if (seats.has(ws)) return; // already in a room
  if (msg.t === "create") {
    seat(ws, directory.create(msg.options), false, msg.profile);
  } else if (msg.t === "quick") {
    seat(ws, directory.quick(), false, msg.profile);
  } else if (msg.t === "join") {
    const room = rooms.get(cleanCode(String(msg.code ?? "")));
    if (!room) send(ws, { t: "error", reason: "No room with that code." });
    else seat(ws, room, msg.spectate === true, msg.profile);
  }
}

// ---- the clock: every room steps at 120 Hz; snapshots every SNAP_EVERY steps -----------------------------
let last = performance.now();
let acc = 0;
setInterval(() => {
  // A close handshake can outlive its player. Do not hold a human seat while the socket is closing.
  for (const ws of seats.keys()) if (ws.readyState !== ws.OPEN) leave(ws);
  const now = performance.now();
  acc += now - last;
  last = now;
  let steps = 0;
  while (acc >= STEP_MS && steps < MAX_STEPS_PER_TICK) {
    acc -= STEP_MS;
    steps++;
    for (const room of rooms.values()) {
      room.step();
      if (room.round !== (announcedRounds.get(room) ?? 1)) {
        announcedRounds.set(room, room.round);
        const message = JSON.stringify({ t: "round", options: room.options, round: room.round } satisfies ServerMsg);
        for (const ws of [...(sockets.get(room) ?? []), ...(spectators.get(room) ?? [])]) if (ws && ws.readyState === ws.OPEN) ws.send(message);
      }
      if (room.tick % SNAP_EVERY !== 0) continue;
      const snap = JSON.stringify(room.snapshot());
      for (const ws of sockets.get(room) ?? []) if (ws && ws.readyState === ws.OPEN) ws.send(snap);
      for (const ws of spectators.get(room) ?? []) if (ws.readyState === ws.OPEN) ws.send(snap);
    }
  }
  if (steps === MAX_STEPS_PER_TICK) acc = 0;
}, 4);

const wss = new WebSocketServer({ port: DUEL_PORT, host: "0.0.0.0", maxPayload: 64 * 1024 });
wss.on("connection", (ws) => {
  ws.on("message", (data) => onMessage(ws, data.toString()));
  ws.on("close", () => leave(ws));
  ws.on("error", () => leave(ws));
});
wss.on("listening", () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === "IPv4" && !n.internal)
    .map((n) => n!.address);
  console.log(`DUEL_SERVER_READY port ${DUEL_PORT}; on this Wi-Fi: ${lan.map((a) => `ws://${a}:${DUEL_PORT}`).join(", ") || "(no network found)"}`);
});
wss.on("error", (err) => {
  console.error(`[duel] server error: ${String(err)}`);
  process.exitCode = 1;
});
