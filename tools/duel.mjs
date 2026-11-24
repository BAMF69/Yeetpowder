#!/usr/bin/env node
// ---------------------------------------------------------------------------
// duel.mjs
// Purpose : One command for an online duel test on your home network: builds and starts the duel server
//           (server/main.ts) and the game's dev server reachable from other devices (vite --host), then prints the
//           address to open on the laptop and the phone.
// Usage   : npm run duel           (Ctrl+C stops both)
// Notes   : Served over https with a self-signed certificate (ADR 0003: the gyro needs a secure page); each device
//           warns once about it. Duels are hosted in a player's browser by default (ADR 0004); the duel server
//           started here is only used with &net=server (its socket goes through the page's port at /duel-ws).
//           Port 5180 is a small front door (frontDoor below): a browser that opens the address without https://
//           gets sent to the https one (before, it got an empty page, ERR_EMPTY_RESPONSE); everything else goes
//           through to Vite on INNER_PORT, which listens on this PC only.
//           The page is served from this PC, so the other device must be on the same Wi-Fi to load it. The duel's
//           own traffic needs no shared Wi-Fi (WebRTC); playing someone elsewhere needs the page hosted online. Windows may ask to let Node through the firewall: allow it on
//           private networks. The game page finds the duel server on the same host, port 7357 (src/net/protocol.ts).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { spawn, spawnSync } from "node:child_process";
import { createServer, connect } from "node:net";
import { networkInterfaces } from "node:os";

// Node runs Vite directly (no shell): Ctrl+C then really stops it (a shell leaves Vite orphaned on Windows)
const VITE = "node_modules/vite/bin/vite.js";
const PORT = 5180; // what players open
const INNER_PORT = 5182; // Vite itself, this PC only (behind frontDoor)
const build = spawnSync(process.execPath, [VITE, "build", "--ssr", "server/main.ts", "--outDir", "build/server", "--emptyOutDir"], {
  stdio: "inherit",
});
if (build.status !== 0) {
  console.error("[duel] the server did not build");
  process.exit(1);
}
const lan = Object.values(networkInterfaces()).flat().filter((n) => n && n.family === "IPv4" && !n.internal).map((n) => n.address);
// the home-network address the room link should show (a page opened as localhost cannot know it): 192.168.x first,
// then the other private ranges, skipping link-local; the game reads it as import.meta.env.VITE_LAN_HOST
const rank = (a) => (a.startsWith("192.168.") ? 0 : a.startsWith("10.") ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(a) ? 2 : 9);
const home = lan.filter((a) => rank(a) < 9).sort((a, b) => rank(a) - rank(b))[0] ?? "";
const kids = [
  spawn(process.execPath, ["build/server/main.js"], { stdio: "inherit" }),
  spawn(process.execPath, [VITE, "--host", "127.0.0.1", "--port", String(INNER_PORT), "--strictPort"], {
    stdio: "inherit",
    // https for the gyro (ADR 0003); YEET_PUBLIC_PORT: the page's hot reload connects to the front door's port
    env: { ...process.env, VITE_LAN_HOST: home, YEET_HTTPS: "1", YEET_PUBLIC_PORT: String(PORT) },
  }),
];

/**
 * Port 5180 for players. A TLS connection starts with byte 0x16 (handshake): it is passed to Vite untouched (the
 * certificate, the page, hot reload and /duel-ws all ride inside it). Anything else is a plain http request, which
 * Vite's https server would drop with no reply: answer it with a redirect to the same address over https.
 */
const frontDoor = createServer((sock) => {
  sock.on("error", () => {}); // a device going to sleep mid-request is not our problem
  sock.once("data", (first) => {
    sock.pause(); // hold the rest until we know where it goes
    if (first[0] === 0x16) {
      const inner = connect(INNER_PORT, "127.0.0.1", () => {
        inner.write(first);
        sock.pipe(inner).pipe(sock);
        sock.resume();
      });
      inner.on("error", () => sock.destroy());
      sock.on("close", () => inner.destroy());
      return;
    }
    const head = first.toString("latin1");
    const host = /\r\nhost:[ \t]*([^\r\n]+)/i.exec(head)?.[1]?.trim() || `localhost:${PORT}`;
    const path = /^[A-Z]+ (\/\S*)/.exec(head)?.[1] ?? "/";
    const reply = ["HTTP/1.1 301 Moved Permanently", `Location: https://${host}${path}`, "Content-Length: 0", "Connection: close"];
    sock.end(reply.join("\r\n") + "\r\n\r\n");
  });
});
frontDoor.on("error", (err) => {
  console.error(`[duel] port ${PORT} is busy (${err.message}): is another duel or dev server running?`);
  stop();
});
frontDoor.listen(PORT);
setTimeout(() => {
  console.log(`\n  Duel ready. Open on this PC:  https://localhost:${PORT}/?play&level=duel`);
  for (const a of lan) console.log(`  On the phone (same Wi-Fi):   https://${a}:${PORT}/?play&level=duel`);
  console.log("  (typing the address without https:// works too: it is sent on to https)");
  console.log("  First visit on each device the browser warns about the certificate (made on this PC):");
  console.log("  choose Advanced, then Continue / Proceed. HTTPS is what lets the gyro work (ADR 0003).");
  console.log("  Ctrl+C stops both.\n");
}, 2500);
const stop = () => {
  for (const k of kids) k.kill();
  frontDoor.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const k of kids) k.on("exit", (code) => code && code !== 0 && console.error(`[duel] a process stopped (${code})`));
