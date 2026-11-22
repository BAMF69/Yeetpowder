#!/usr/bin/env node
// ---------------------------------------------------------------------------
// duel.mjs
// Purpose : One command for an online duel test on your home network: builds and starts the duel server
//           (server/main.ts) and the game's dev server reachable from other devices (vite --host), then prints the
//           address to open on the laptop and the phone.
// Usage   : npm run duel           (Ctrl+C stops both)
// Notes   : Served over https with a self-signed certificate (ADR 0003: the gyro needs a secure page); each device
//           warns once about it. The duel socket goes through the page's port at /duel-ws (vite.config.ts).
//           Both devices must be on the same Wi-Fi. Windows may ask to let Node through the firewall: allow it on
//           private networks. The game page finds the duel server on the same host, port 7357 (src/net/protocol.ts).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { spawn, spawnSync } from "node:child_process";
import { networkInterfaces } from "node:os";

// Node runs Vite directly (no shell): Ctrl+C then really stops it (a shell leaves Vite orphaned on Windows)
const VITE = "node_modules/vite/bin/vite.js";
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
  spawn(process.execPath, [VITE, "--host", "--port", "5180", "--strictPort"], {
    stdio: "inherit",
    env: { ...process.env, VITE_LAN_HOST: home, YEET_HTTPS: "1" }, // https for the gyro (ADR 0003)
  }),
];
setTimeout(() => {
  console.log("\n  Duel ready. Open on this PC:  https://localhost:5180/?play&level=duel");
  for (const a of lan) console.log(`  On the phone (same Wi-Fi):   https://${a}:5180/?play&level=duel`);
  console.log("  First visit on each device the browser warns about the certificate (made on this PC):");
  console.log("  choose Advanced, then Continue / Proceed. HTTPS is what lets the gyro work (ADR 0003).");
  console.log("  Ctrl+C stops both.\n");
}, 2500);
const stop = () => {
  for (const k of kids) k.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const k of kids) k.on("exit", (code) => code && code !== 0 && console.error(`[duel] a process stopped (${code})`));
