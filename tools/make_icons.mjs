#!/usr/bin/env node
// ---------------------------------------------------------------------------
// make_icons.mjs
// Purpose : The installed app's icons (manifest.webmanifest, apple-touch-icon): a navy tile, a hot-pink yeetpowder
//           burst (GDD Lore) and a hazard-yellow Y, drawn as SVG here and rendered to PNG by the Playwright
//           Chromium that smoke already uses. Android only offers "Install app" (fullscreen) with 192 and 512 px
//           icons; without them it made a shortcut that opened in a browser tab (Elaina, 2026-11-24).
// Usage   : node tools/make_icons.mjs        (writes public/icons/*.png; ASSET_LOG, our own work)
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const OUT = "public/icons";
const SIZES = [
  { file: "icon-192.png", px: 192, pad: 0 },
  { file: "icon-512.png", px: 512, pad: 0 },
  { file: "icon-maskable-512.png", px: 512, pad: 0.1 }, // Android crops maskable icons to a circle: keep the art inside
  { file: "apple-touch-icon.png", px: 180, pad: 0 },
];

/** The burst's spikes: alternating long and short points around the centre. */
function burst(cx, cy, outer, inner, points) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function svg(pad) {
  const s = 100 * (1 - 2 * pad);
  const o = 100 * pad;
  const at = (v) => o + (v / 100) * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
    <rect width="100" height="100" fill="#1b2233"/>
    <polygon points="${burst(at(50), at(52), s * 0.46, s * 0.27, 12)}" fill="#ff3fa4"/>
    <polygon points="${burst(at(50), at(52), s * 0.3, s * 0.2, 12)}" fill="#ff8cc9"/>
    <text x="${at(50)}" y="${at(68)}" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-weight="900"
      font-size="${s * 0.5}" fill="#ffd84a" stroke="#1b2233" stroke-width="${s * 0.035}" paint-order="stroke">Y</text>
  </svg>`;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const { file, px, pad } of SIZES) {
    const page = await browser.newPage({ viewport: { width: px, height: px } });
    await page.setContent(`<html><body style="margin:0">${svg(pad)}</body></html>`);
    await page.screenshot({ path: `${OUT}/${file}` });
    await page.close();
    console.log(`[icons] ${OUT}/${file} (${px} px)`);
  }
} finally {
  await browser.close();
}
