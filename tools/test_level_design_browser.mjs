// ---------------------------------------------------------------------------
// test_level_design_browser.mjs
// Purpose : Browser playtest for the 2026-11-26 scenery/level pass: every revised map loads its reviewed models
//           (no fallbacks, missing files or console errors), overview and eye-level captures for review, real
//           keyboard climbs up the designed routes, and the ?noart fallback.
// Usage   : node tools/test_level_design_browser.mjs [--maps island,junkyard] [--views-only] [--no-climbs] [--climbs-only]
// Notes   : Software WebGL in headless Chromium: proves loading, placement and traversal, never frame rate.
//           Fixture changes (player position, facing, dummies parked) only set up repeatable viewpoints.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const MAPS = (arg("--maps") ?? "industrial,industrial-party,junkyard,junkyard-party,island,island-party").split(",");
await mkdir("captures/progress", { recursive: true });
const server = await createServer({ logLevel: "silent", server: { host: "127.0.0.1", port: 4191, hmr: false, open: false } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(240000);
let errors = [], failed = [], logs = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { logs.push(m.text()); if (m.type() === "error") errors.push(m.text()); });
page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
await page.addInitScript(() => localStorage.setItem("level-qa/settings.json", JSON.stringify({ version: 1, display: { frame_cap: 30 }, telemetry: { consent: "no" } })));
const base = server.resolvedUrls.local[0];
const world = (source) => page.evaluate(async (source) => { const { game } = await import("/src/main.ts"); return new Function("w", "game", source)(game.world, game); }, source);
async function until(read, label, ms = 240000) { const end = Date.now() + ms; while (Date.now() < end) { if (await read()) return; await page.waitForTimeout(100); } throw new Error(`Timeout: ${label}\n${logs.slice(-10).join("\n")}`); }
async function go(query) {
  errors = []; failed = []; logs = [];
  await page.goto(`${base}?data-dir=level-qa&play&${query}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await until(() => page.evaluate(async () => { const { game } = await import("/src/main.ts"); const { shell } = await import("/src/shell/app.ts"); return !!(game.loaded && game.world && shell.top?.gameplay); }), `gameplay ${query}`);
  await world("w.sim.dummies.forEach(d=>{d.down=1e9;d.pos.y=-500}); return true");
}
/** Puts the player at a spot facing a direction (yaw 0 looks down -Z, + turns left) and waits for a few frames. */
async function view(name, pos, yaw, pitch = -0.08) {
  await world(`const p=w.sim.player;p.pos={x:${pos[0]},y:${pos[1]},z:${pos[2]}};p.vel={x:0,y:0,z:0};p.yaw=${yaw};p.pitch=${pitch};return true`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `captures/progress/level-${name}.png` });
}
const VIEWS = {
  industrial: [["industrial-hall", [-28, 0, 6], -2.1], ["industrial-yard", [30, 0, 4], 1.35], ["industrial-catwalk", [-24, 4.4, -18], -1.75, -0.3],
    ["industrial-doorway", [-6, 0, 0], -1.57]],
  "industrial-party": [["industrial-party-yard", [58, 0, 0], 1.45], ["industrial-party-hall", [-58, 0, -6], -1.8], ["industrial-party-terminal", [28, 0, -12], -0.75]],
  junkyard: [["junkyard-north-row", [-22, 0, -6], -0.55], ["junkyard-walkway", [-13.4, 0, -14], -1.57, -0.15], ["junkyard-crusher", [12, 0, 10], 0.8]],
  "junkyard-party": [["junkyard-party-cross", [0, 0, 44], 0], ["junkyard-party-crane-court", [-12, 0, -12], 0.95], ["junkyard-party-hill-court", [12, 0, 12], -2.4]],
  island: [["island-hill-stair", [11, 0, -6], 1.0], ["island-beach", [-11, 0, 11], -0.75], ["island-platform", [24, 0.5, 0], 1.57]],
  "island-party": [["island-party-rock", [0, 0, 20], 0], ["island-party-coast", [-24, 0, 6], -2.4], ["island-party-causeway", [36, 0.35, 0], 1.57]],
};

try {
  for (const map of process.argv.includes("--climbs-only") ? [] : MAPS) {
    // eye-level review captures with the production art
    await go(`level=${map}`);
    const ready = logs.find((l) => l.includes("SCENERY_READY"));
    assert(ready, `${map}: no SCENERY_READY`);
    assert.match(ready, /fallbacks=0/, `${map}: scenery fell back to boxes: ${ready}`);
    assert(!/instances=0 /.test(ready), `${map}: nothing instanced: ${ready}`);
    for (const [name, pos, yaw, pitch] of VIEWS[map] ?? []) await view(name, pos, yaw, pitch);
    assert.deepEqual(failed, [], `${map}: missing files`); assert.deepEqual(errors, [], `${map}: console errors`);
    console.log(`LEVEL_ART_OK ${map}: ${ready.slice(ready.indexOf("SCENERY_READY"))}`);
    // the overview (cutaway roofs, no HUD)
    await go(`level=${map}&mapview`);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `captures/progress/level-${map}-overview.png` });
  }

  if (!process.argv.includes("--no-climbs") && !process.argv.includes("--views-only")) {
    // Real keyboard input up the designed routes: hold W, tap Space when a riser is ahead (as a player would).
    // footholds: optional [x, z, y] stops to face in turn (a person turns toward the next rock)
    const climb = async (map, from, yaw, targetY, label, footholds = []) => {
      await go(`level=${map}`);
      await page.locator("canvas").click({ position: { x: 400, y: 250 }, force: true });
      await until(() => page.evaluate(() => document.pointerLockElement !== null), "pointer lock", 20000);
      await world(`const p=w.sim.player;p.pos={x:${from[0]},y:${from[1]},z:${from[2]}};p.vel={x:0,y:0,z:0};p.yaw=${yaw};p.pitch=0;return true`);
      await page.keyboard.down("KeyW");
      let best = 0;
      for (let i = 0; i < 70; i++) {
        const next = footholds.find((f) => best < f[2] - 0.05);
        if (next) await world(`const p=w.sim.player;p.yaw=Math.atan2(-(${next[0]}-p.pos.x),-(${next[1]}-p.pos.z));return true`);
        await page.waitForTimeout(160); // sample while landed, before the next jump
        best = Math.max(best, await world("return w.sim.player.onGround ? w.sim.player.pos.y : 0"));
        await page.keyboard.press("Space");
        if (best >= targetY - 0.05) break;
      }
      await page.keyboard.up("KeyW");
      await page.screenshot({ path: `captures/progress/level-route-${label}.png` });
      assert(best >= targetY - 0.05, `${label}: reached ${best.toFixed(2)} of ${targetY}`);
      console.log(`ROUTE_OK ${label}: stood at ${best.toFixed(2)} m with keyboard jumps only`);
    };
    // yaw +pi/2 faces -X (west), -pi/2 faces +X (east), 0 faces -Z (north), pi faces +Z (south)
    await climb("industrial", [-1.45, 0, -14.6], 0, 0.88, "industrial-stair-first");
    await climb("industrial", [-1.45, 0.88, -18], Math.PI / 2, 4.4, "industrial-stair-catwalk");
    await climb("industrial", [14.2, 0, -4.2], -Math.PI / 2, 2.6, "industrial-container-crates");
    await climb("junkyard", [-23.5, 0, -14], -Math.PI / 2, 2.8, "junkyard-pile-walkway");
    await climb("island", [11, 0, -1.6], Math.PI / 2, 2.5, "island-boulder-stair", [[7.6, -1.6, 1.04], [5.6, 0.6, 1.82], [2, 1, 2.5]]);
  }

  // ?noart: the colliders are still drawn (plain boxes) and no scenery model is requested
  await go("level=junkyard&noart");
  const noart = logs.find((l) => l.includes("SCENERY_READY"));
  assert.match(noart, /noart=true/); assert.match(noart, /instances=0 /);
  assert.deepEqual(errors, []);
  await page.waitForTimeout(600);
  await page.screenshot({ path: "captures/progress/level-junkyard-noart.png" });
  console.log(`NOART_OK junkyard: ${noart.slice(noart.indexOf("SCENERY_READY"))}`);
} finally {
  await browser.close();
  await server.close();
}
