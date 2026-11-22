#!/usr/bin/env node
// ---------------------------------------------------------------------------
// duel.mjs
// Purpose : One command for an online duel test on your home network: builds and starts the duel server
//           (server/main.ts) and the game's dev server reachable from other devices (vite --host), then prints the
//           address to open on the laptop and the phone.
// Usage   : npm run duel           (Ctrl+C stops both)
// Notes   : Both devices must be on the same Wi-Fi. Windows may ask to let Node through the firewall: allow it on
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
const kids = [
  spawn(process.execPath, ["build/server/main.js"], { stdio: "inherit" }),
  spawn(process.execPath, [VITE, "--host", "--port", "5180", "--strictPort"], { stdio: "inherit" }),
];
const lan = Object.values(networkInterfaces()).flat().filter((n) => n && n.family === "IPv4" && !n.internal).map((n) => n.address);
setTimeout(() => {
  console.log("\n  Duel ready. Open on this PC:  http://localhost:5180/?play&level=duel");
  for (const a of lan) console.log(`  On the phone (same Wi-Fi):   http://${a}:5180/?play&level=duel`);
  console.log("  Ctrl+C stops both.\n");
}, 2500);
const stop = () => {
  for (const k of kids) k.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const k of kids) k.on("exit", (code) => code && code !== 0 && console.error(`[duel] a process stopped (${code})`));
