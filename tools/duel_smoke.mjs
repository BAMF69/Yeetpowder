#!/usr/bin/env node
// ---------------------------------------------------------------------------
// duel_smoke.mjs
// Purpose : End-to-end check of the duel server over real WebSockets, no browser: starts build/server/main.js,
//           player 1 makes a room, player 2 joins with the code, player 1 fires a Pea Pistol shot across the Duel
//           room (over the centre pedestal) and the server's snapshot must report the hit on player 2.
// Usage   : npx vite build --ssr server/main.ts --outDir build/server --emptyOutDir && node tools/duel_smoke.mjs
// Exit    : 0 and DUEL_SMOKE_OK on success; 1 with the reason otherwise (10 s timeout).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { spawn } from "node:child_process";
import { WebSocket } from "ws";

const PORT = 7357;
const fail = (why) => {
  console.error(`DUEL_SMOKE_FAIL ${why}`);
  server.kill();
  process.exit(1);
};
const server = spawn(process.execPath, ["build/server/main.js"], { stdio: ["ignore", "pipe", "inherit"] });
setTimeout(() => fail("timed out"), 10000);

const input = (seq, extra = {}) => ({
  moveX: 0, moveZ: 0, jump: false, firePressed: false, fireHeld: false, select: -1, reset: false, aiming: false,
  sprint: false, reload: false, slash: false, slashHeld: false, seq, dYaw: 0, dPitch: 0, ...extra,
});

server.stdout.on("data", (d) => {
  const line = d.toString();
  process.stdout.write(line);
  if (!line.includes("DUEL_SERVER_READY")) return;
  const p1 = new WebSocket(`ws://127.0.0.1:${PORT}`);
  let p2 = null;
  let seq = 0;
  p1.on("open", () => p1.send(JSON.stringify({ t: "create" })));
  p1.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.t === "error") fail(`p1: ${msg.reason}`);
    if (msg.t === "joined") {
      console.log(`room ${msg.code}: player 1 in slot ${msg.slot}`);
      p2 = new WebSocket(`ws://127.0.0.1:${PORT}`);
      p2.on("open", () => p2.send(JSON.stringify({ t: "join", code: msg.code.toLowerCase() })));
      p2.on("message", (r) => {
        const m = JSON.parse(r.toString());
        if (m.t === "error") fail(`p2: ${m.reason}`);
        if (m.t === "joined") {
          console.log(`player 2 joined slot ${m.slot}`);
          // player 1 spawns facing player 2: a few idle steps, then one shot, then idle
          const batch = [];
          for (let i = 0; i < 12; i++) batch.push(input(++seq, { firePressed: i === 6 }));
          p1.send(JSON.stringify({ t: "in", inputs: batch }));
        }
      });
    }
    if (msg.t === "snap") {
      const hit = msg.events.find((e) => e.type === "pvpHit" && e.by === 0 && e.target === 1);
      if (!hit) return;
      if (!msg.present.every(Boolean)) fail("a player is missing from the room");
      console.log(`DUEL_SMOKE_OK hit for ${hit.damage}, player 2 at ${msg.state.players[1].hp} hp, ack ${msg.acks[0]}`);
      p1.close();
      p2?.close();
      server.kill();
      process.exit(0);
    }
  });
});
