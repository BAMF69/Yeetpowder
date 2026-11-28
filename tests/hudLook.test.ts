// ---------------------------------------------------------------------------
// hudLook.test.ts
// Purpose : Guards the approved Blast Zone HUD (2026-11-28, ADR 0009, docs/mockups/hud/index.html) so a later scene
//           or HUD change cannot silently drop it: the fonts, the tread and plates, the two-layer stacking that keeps
//           the scope mask under the touch buttons, the bullet-hole button art, every weapon icon, and the stamp
//           cascade and hit-direction maths.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-28
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { TUNING } from "../src/core/yeet/tuning";
import { shieldStatus } from "../src/core/yeet/equipment";
import { bulletHoleSvg, HOLE_COLOURS } from "../src/game/yeet/bulletHole";
import { HUD_TUNING, hitBearing, stampSlot, wedgeAt } from "../src/game/yeet/hudLayout";
import { WEAPON_ICON_PATHS, weaponIconSvg } from "../src/game/yeet/weaponIcons";
import { HUD_CSS } from "../src/game/yeet/hud";
import { TOUCH_STRIP_RIGHT } from "../src/game/touchControls";

const rule = (css: string, selector: string): string => {
  const i = css.indexOf(`\n${selector} {`);
  expect(i, `rule ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf("}", i));
};

describe("HUD look (approved concept)", () => {
  it("uses the game's three faces: stencil words, Teko numbers, Black Ops One stamps", () => {
    expect(HUD_CSS).toContain('"Saira Stencil One"');
    expect(HUD_CSS).toContain("Teko");
    expect(HUD_CSS).toContain('"Black Ops One"');
    expect(HUD_CSS).toContain("font-variant-numeric: tabular-nums");
  });

  it("draws plates with diamond-plate tread and cut corners, not rounded boxes", () => {
    const plate = rule(HUD_CSS, ".yh-plate");
    expect(plate).toContain("data:image/svg+xml");
    expect(plate).toContain("clip-path: polygon(");
    expect(HUD_CSS).not.toMatch(/border-radius:\s*(1[0-9]|[6-9])px/); // no soft rounded panels
  });

  it("keeps hot pink for danger and the old yellow and green out", () => {
    expect(HUD_CSS).toContain("#ff2e88");
    expect(HUD_CSS.toLowerCase()).not.toContain("#ffd84a");
    expect(HUD_CSS.toLowerCase()).not.toContain("#43a047");
  });

  it("puts the scope mask in the low layer (z 5) and the tap targets in the top layer (z 7), around the buttons (z 6)", () => {
    expect(rule(HUD_CSS, ".yh")).toContain("z-index: 5");
    expect(rule(HUD_CSS, ".yhT")).toContain("z-index: 7");
    expect(HUD_CSS).not.toContain(".yhT .yh-scope");
    expect(HUD_CSS).toContain(".yhT .yh-wchip");
    expect(HUD_CSS).toContain(".yhT .yh-tstrip");
    expect(rule(HUD_CSS, ".yhT .yh-tstrip")).toContain("touch-action: pan-x");
  });

  it("ends the touch weapon strip where the touch buttons begin", () => {
    expect(TOUCH_STRIP_RIGHT).toMatch(/^calc\(/);
    expect(HUD_CSS).toContain(TOUCH_STRIP_RIGHT);
  });

  it("respects safe areas and the player's ui and text scale", () => {
    expect(HUD_CSS).toContain("env(safe-area-inset-left");
    expect(HUD_CSS).toContain("var(--ui-scale, 1)");
    expect(HUD_CSS).toContain("var(--text-scale, 1)");
  });
});

describe("weapon icons", () => {
  it("has a silhouette for every weapon in the order", () => {
    for (const w of TUNING.weaponOrder) {
      expect(WEAPON_ICON_PATHS[w], w).toMatch(/^M/);
      expect(weaponIconSvg(w)).toContain('viewBox="0 0 64 24"');
    }
  });
});

describe("bullet-hole buttons", () => {
  it("is the same hole for the same seed and a different one for another", () => {
    expect(bulletHoleSvg({ seed: 41 })).toBe(bulletHoleSvg({ seed: 41 }));
    expect(bulletHoleSvg({ seed: 41 })).not.toBe(bulletHoleSvg({ seed: 42 }));
  });

  it("lights the lip cream when idle, pink for Fire, and fills the hole when pressed", () => {
    expect(bulletHoleSvg({ seed: 1 })).toContain(`stroke="${HOLE_COLOURS.cream}"`);
    expect(bulletHoleSvg({ seed: 1, tone: "fire" })).toContain(`stroke="${HOLE_COLOURS.pink}"`);
    expect(bulletHoleSvg({ seed: 1, tone: "on" })).toContain(`fill="${HOLE_COLOURS.cream}"`);
  });

  it("keeps every point inside the viewBox (never clipped)", () => {
    for (let seed = 1; seed < 60; seed++) {
      const nums = [...bulletHoleSvg({ seed }).matchAll(/-?\d+\.\d/g)].map((m) => Math.abs(Number(m[0])));
      expect(Math.max(...nums)).toBeLessThanOrEqual(54);
    }
  });
});

describe("stamp cascade", () => {
  it("lands the newest in the middle at full size", () => {
    expect(stampSlot(0, -1)).toMatchObject({ x: 0, y: 0, scale: 1, opacity: 1 });
  });

  it("pushes older stamps out to their own side, up, smaller and fainter", () => {
    const l = stampSlot(1, -1), r = stampSlot(1, 1), older = stampSlot(2, 1);
    expect(l.x).toBeLessThan(0);
    expect(r.x).toBeGreaterThan(0);
    expect(r.y).toBeLessThan(0);
    expect(older.x).toBeGreaterThan(r.x);
    expect(older.scale).toBeLessThan(r.scale);
    expect(older.opacity).toBeLessThan(r.opacity);
  });

  it("keeps at most three on screen and lets them fade within about a second", () => {
    expect(HUD_TUNING.stamp.max).toBe(3);
    expect(HUD_TUNING.stamp.life).toBeLessThan(2);
  });
});

describe("hit direction", () => {
  const me = { x: 0, z: 0 };
  it("reads a hit from ahead as 0 and from the right as +90 degrees (yaw 0 looks down -z)", () => {
    expect(hitBearing(0, me, { x: 0, z: -5 })).toBeCloseTo(0);
    expect(hitBearing(0, me, { x: 5, z: 0 })).toBeCloseTo(Math.PI / 2);
    expect(hitBearing(0, me, { x: -5, z: 0 })).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(hitBearing(0, me, { x: 0, z: 5 }))).toBeCloseTo(Math.PI);
  });

  it("turns with the player", () => {
    // facing -x (yaw +90 degrees), an enemy at -x is straight ahead
    expect(hitBearing(Math.PI / 2, me, { x: -5, z: 0 })).toBeCloseTo(0);
  });

  it("puts the wedge on the screen edge facing the hit", () => {
    expect(wedgeAt(Math.PI / 2)).toMatchObject({ x: 100, y: 50 });
    const left = wedgeAt(-Math.PI / 2);
    expect(left.x).toBeCloseTo(0);
  });
});

describe("shield line", () => {
  it("says nothing for other weapons and the stance for the shield", () => {
    const base = { weapon: "pistol", shielding: false } as Parameters<typeof shieldStatus>[0];
    expect(shieldStatus(base)).toBe("");
    expect(shieldStatus({ ...base, weapon: "shield" })).toContain("50%");
    expect(shieldStatus({ ...base, weapon: "shield", shielding: true })).toContain("IMMUNE");
  });
});
