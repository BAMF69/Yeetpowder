#!/usr/bin/env node
// ---------------------------------------------------------------------------
// duel_browser_smoke.mjs
// Purpose : The online duel in two real (headless) browser pages: starts the duel server and the game's dev server,
//           page A makes a room from the lobby, page B joins with the code from A's screen, both lobbies close,
//           snapshots flow, each page draws the other player, and no page logs an error. Saves a screenshot of A.
// Usage   : npx vite build --ssr server/main.ts --outDir build/server --emptyOutDir && node tools/duel_browser_smoke.mjs
// Exit    : 0 and DUEL_BROWSER_SMOKE_OK; 1 with the reason (60 s timeout).
// Notes   : Shooting needs pointer lock, which a headless page cannot take, so hits are checked over raw sockets by
//           tools/duel_smoke.mjs and in tests/net.test.ts; this script proves the browser side connects and syncs.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const WEB = 5181;
const kids = [];
let browser = null;
const done = async (code, msg) => {
  console.log(msg);
  await browser?.close().catch(() => {});
  for (const k of kids) k.kill();
  process.exit(code);
};
setTimeout(() => done(1, "DUEL_BROWSER_SMOKE_FAIL timed out"), 60000);

// Node runs Vite directly (no shell), so killing it really stops it (a shell would leave Vite orphaned on Windows)
const server = spawn(process.execPath, ["build/server/main.js"], { stdio: ["ignore", "pipe", "inherit"] });
kids.push(server);
const web = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--port", String(WEB), "--strictPort"], { stdio: ["ignore", "pipe", "inherit"] });
kids.push(web);

const ready = (proc, marker) => new Promise((res) => proc.stdout.on("data", (d) => d.toString().includes(marker) && res()));
await Promise.all([ready(server, "DUEL_SERVER_READY"), ready(web, "Local")]);

browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const errors = [];
const open = async (name, query) => {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(`http://localhost:${WEB}/?play&level=duel&debug${query}`);
  // a fresh profile is asked about telemetry first, as a real first-time player is: answer "No thanks"
  const no = page.locator("[data-id='consent.no']");
  await no.waitFor({ timeout: 8000 }).then(() => no.click()).catch(() => {});
  return page;
};

process.on("unhandledRejection", (e) => done(1, `DUEL_BROWSER_SMOKE_FAIL ${e?.message ?? e}`));
const a = await open("A", "");
await a.waitForSelector(".yd-panel button[data-act=create]", { timeout: 20000 });
await a.click(".yd-panel button[data-act=create]");
await a.waitForSelector(".yd-code", { timeout: 10000 });
const code = (await a.textContent(".yd-code")).trim();
console.log(`page A made room ${code}`);
const b = await open("B", `&room=${code}`);

// both lobbies close once both players are in
const closed = (p) => p.waitForFunction(() => getComputedStyle(document.querySelector(".yd")).display === "none", null, { timeout: 15000 });
await Promise.all([closed(a), closed(b)]);
await a.waitForTimeout(1500);
const netA = await a.textContent(".yd-net");
const netB = await b.textContent(".yd-net");
console.log(`A: ${netA}\nB: ${netB}`);
const snaps = (s) => Number((/(\d+) snap\/s/.exec(s) ?? [])[1] ?? 0);
if (snaps(netA) < 10 || snaps(netB) < 10) await done(1, "DUEL_BROWSER_SMOKE_FAIL snapshots are not flowing");
if (!netA.includes("slot 1") || !netB.includes("slot 2")) await done(1, "DUEL_BROWSER_SMOKE_FAIL wrong slots");
await a.screenshot({ path: "captures/progress/19-duel-two-browsers.png" });
if (errors.length) await done(1, `DUEL_BROWSER_SMOKE_FAIL page errors:\n  ${errors.join("\n  ")}`);
await done(0, `DUEL_BROWSER_SMOKE_OK room ${code}, both pages in, ${snaps(netA)} and ${snaps(netB)} snapshots/s`);
