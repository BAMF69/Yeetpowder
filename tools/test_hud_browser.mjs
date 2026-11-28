// ---------------------------------------------------------------------------
// test_hud_browser.mjs
// Purpose : Exercises the Blast Zone HUD (ADR 0009) in real play in Chromium: the custom HUD is present on desktop
//           and phone, the Spin Doctor scope stays UNDER the touch buttons (the 2026-11-28 bug), the weapon chip
//           opens and closes the picker, a strip tap switches guns, a picker tap switches and closes, nothing spills
//           off a small phone in landscape or portrait, and enlarged text still fits the corner chips.
// Usage   : node tools/test_hud_browser.mjs            (starts its own Vite server; ~2 minutes in software WebGL)
//           Stills land in captures/progress/hud-qa-*.png.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-28
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

await mkdir("captures/progress", { recursive: true });
const server = await createServer({ logLevel: "silent", server: { host: "127.0.0.1", port: 4191, hmr: false, open: false } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ headless: true, args: ["--use-gl=swiftshader"] });
const errors = [];

async function open(query, { phone = false, width = 667, height = 375, settings = {} } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, isMobile: phone, hasTouch: phone });
  page.setDefaultTimeout(180000);
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript((s) => localStorage.setItem("yeetpowder/settings.json", JSON.stringify({ telemetry: { consent: "no" }, ...s })), settings);
  await page.goto(`${base}?${query}`);
  const end = Date.now() + 180000;
  while (!(await page.evaluate(() => !!document.querySelector(".yh .yh-wp") && !document.querySelector(".loading, #loading:not([hidden])")))) {
    if (Date.now() > end) throw Error(`HUD never appeared for ${query}`);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(2500); // a few frames of play
  return page;
}

const tap = async (page, sel) => {
  const r = await page.locator(sel).first().boundingBox();
  assert.ok(r, `no box for ${sel}`);
  await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  await page.waitForTimeout(500);
};

/** Every visible HUD piece inside the viewport (nothing clipped off a small phone). */
const offscreen = (page) => page.evaluate(() => {
  const bad = [];
  for (const e of document.querySelectorAll(".yh-hp, .yh-wchip, .yh-tstrip, .yt-btn, .yt-top, .yh-feed, .yh-wp, .yh-strip")) {
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) bad.push(`${e.className} ${JSON.stringify(r.toJSON())}`);
  }
  return bad;
});

try {
  // desktop: plates, strip, no tap layer
  {
    const page = await open("play&level=fightback&weapon=1", { width: 1280, height: 720 });
    const s = await page.evaluate(() => ({
      plate: getComputedStyle(document.querySelector(".yh-wp")).display,
      hp: getComputedStyle(document.querySelector(".yh-hp")).display,
      tread: getComputedStyle(document.querySelector(".yh-wp .yh-plate")).backgroundImage.includes("svg"),
      font: getComputedStyle(document.querySelector(".yh-wp .name")).fontFamily,
      tapLayer: !!document.querySelector(".yhT"),
      name: document.querySelector(".yh-wp .name").textContent,
    }));
    assert.equal(s.plate, "block");
    assert.equal(s.hp, "block");
    assert.ok(s.tread, "weapon plate lost its tread");
    assert.match(s.font, /Saira Stencil One/);
    assert.equal(s.tapLayer, false);
    assert.equal(s.name, "Boomstick");
    assert.deepEqual(await offscreen(page), []);
    await page.screenshot({ path: "captures/progress/hud-qa-desktop.png" });
    await page.close();
  }

  // phone scoped: the scope is drawn, and the buttons are above it
  {
    const page = await open("play&touch&level=sandbox&weapon=2&aim", { phone: true });
    const s = await page.evaluate(() => {
      const fire = document.querySelector(".yt-fire").getBoundingClientRect();
      const st = document.createElement("style");
      st.textContent = "*{pointer-events:auto!important}";
      document.head.append(st);
      const stack = document.elementsFromPoint(fire.x + fire.width / 2, fire.y + fire.height / 2).map((e) => e.className);
      st.remove();
      return { scope: getComputedStyle(document.querySelector(".yh-scope")).display, stack };
    });
    assert.equal(s.scope, "block", "the Spin Doctor scope is not drawn");
    const fireAt = s.stack.findIndex((c) => String(c).includes("yt-fire"));
    const scopeAt = s.stack.findIndex((c) => String(c).includes("yh-scope"));
    assert.ok(fireAt >= 0 && scopeAt > fireAt, `FIRE is under the scope: ${s.stack.join(" > ")}`);
    await page.screenshot({ path: "captures/progress/hud-qa-phone-scoped.png" });
    await page.close();
  }

  // phone: picker opens and closes, strip and picker switch guns
  {
    const page = await open("play&touch&level=sandbox&weapon=1", { phone: true });
    const weapon = () => page.evaluate(() => [...document.querySelectorAll(".yh-ts")].findIndex((e) => e.classList.contains("on")));
    assert.equal(await weapon(), 1);
    await tap(page, ".yh-wchip");
    assert.equal(await page.evaluate(() => document.querySelector(".yh-picker").classList.contains("open")), true, "chip did not open the picker");
    await page.screenshot({ path: "captures/progress/hud-qa-phone-picker.png" });
    await tap(page, ".yh-pk:nth-child(3)"); // Spin Doctor
    assert.equal(await weapon(), 2, "picker tap did not switch");
    assert.equal(await page.evaluate(() => document.querySelector(".yh-picker").classList.contains("open")), false, "picker stayed open");
    await tap(page, ".yh-wchip");
    await page.touchscreen.tap(120, 250); // the move side: closes the picker
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.querySelector(".yh-picker").classList.contains("open")), false, "outside tap did not close");
    await page.evaluate(() => { document.querySelector(".yh-tstrip").scrollLeft = 0; });
    await tap(page, ".yh-ts:nth-child(1)"); // Pea Pistol
    assert.equal(await weapon(), 0, "strip tap did not switch");
    assert.deepEqual(await offscreen(page), []);
    await page.close();
  }

  // portrait (playable, not recommended) and enlarged text: nothing off screen
  {
    const page = await open("play&touch&level=fightback&weapon=1", { phone: true, width: 375, height: 667 });
    assert.deepEqual(await offscreen(page), []);
    await page.screenshot({ path: "captures/progress/hud-qa-phone-portrait.png" });
    await page.close();
  }
  {
    const page = await open("play&touch&level=fightback&weapon=1", { phone: true, settings: { access: { text_scale: 1.5 } } });
    assert.deepEqual(await offscreen(page), []);
    await page.screenshot({ path: "captures/progress/hud-qa-phone-bigtext.png" });
    await page.close();
  }
  assert.deepEqual(errors, [], `page errors: ${errors.join("\n")}`);
  console.log("HUD browser checks passed");
} finally {
  await browser.close();
  await server.close();
}

// ---------------------------------------------------------------------------
// End of test_hud_browser.mjs
// ---------------------------------------------------------------------------
