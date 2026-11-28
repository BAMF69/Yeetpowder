// ---------------------------------------------------------------------------
// weaponIcons.ts
// Purpose : Side-on silhouettes of every weapon for the HUD (the desktop strip, the phone chip, strip and picker).
//           Approved with the HUD concept on 2026-11-28 (docs/mockups/hud/index.html): flat cream paint, muzzle to
//           the left, 64x24 viewBox so every icon shares one baseline and scale.
// Usage   : el.innerHTML = weaponIconSvg("shotgun")   // an <svg> filled with currentColor
// Notes   : Pure strings, no DOM: tests/weaponIcons.test.ts checks every weapon in TUNING.weaponOrder has one.
//           Icons are drawn at a fixed aspect (64:24) everywhere; size them by height or width, never both.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-28
// ---------------------------------------------------------------------------

import type { WeaponId } from "../../core/yeet/tuning";

/** SVG path data per weapon, in a 64x24 box. */
export const WEAPON_ICON_PATHS: Record<WeaponId, string> = {
  shield: "M18 2h20l5 3v8c0 5-7 8.5-15 11-8-2.5-15-6-15-11V5zM45 9h14v3h-3l-1 2h-4l-1 6h-4l1-6h-2z",
  pistol: "M14 6h32l2 2h4v5H30l-1 2h-4l-3 7h-8l3-9h-3l-1-2h-2V8z",
  shotgun: "M1 7h35v2.5H1zM1 10.5h35V13H1zM36 6h10v8h-3l-1 3h-4v-3h-2zM46 7l17 3.5v6.5l-5 .5-12-3z",
  sniper: "M0 11h28v2H0zM26 4h18v3H26zM30 7h3v2h-3zM38 7h3v2h-3zM28 9h18v6h-6v5h-4v-5h-8zM46 9l17 2v7l-6 0-11-3z",
  copter: "M1 6.5h27v2H1zM1 10h27v2H1zM1 13.5h27v2H1zM27 5h18v13H27zM33 1h28v2H33zM45 9h7l3 9h-5l-2-5h-3z",
  // the scythe gunblade: a curved blade over the muzzle end, a long haft, a pistol grip
  reaper: "M2 3c9-1 17 2 21 8-5-3-11-4-17-3zM20 3h4v19h-4zM24 12h37v2.5H24zM40 14.5h5l-1.5 6h-4.5z",
  // the katana revolver: a long curved blade, a guard, a cylinder at the grip
  sakura: "M1 14c13-3 27-4.5 40-5v3c-13 .5-27 2-40 4zM41 6h3v11h-3zM44 8.5h7v6h-7zM51 9.5h11v4H51zM47.5 11.5m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  rocket: "M6 8h40v8H6zM46 7h6l10 5-10 5h-6zM2 6l6 2v8l-6 2zM22 16h5v5h-5z",
  grenade: "M24 14a8 8 0 1 0 16 0a8 8 0 1 0-16 0M28 3h8v4h-8zM36 4l8 3-1 2-7-2z",
  // the rocket axe: an axe head at the front, a launcher tube slung under the haft
  axe: "M3 2h9l4 4v9l-4 4H3l3-8.5zM14 9.5h48V13H14zM18 14h24v5H18zM40 13h4l1 7h-4z",
};

/** An inline SVG of the weapon, filled with the text colour. */
export function weaponIconSvg(id: WeaponId, cls = "wi"): string {
  return `<svg class="${cls}" viewBox="0 0 64 24" aria-hidden="true" focusable="false"><path d="${WEAPON_ICON_PATHS[id]}"/></svg>`;
}

// ---------------------------------------------------------------------------
// End of weaponIcons.ts
// ---------------------------------------------------------------------------
