// ---------------------------------------------------------------------------
// vite.config.ts
// Purpose : Dev server and production build settings.
// Notes   : base "./" keeps every URL relative, so dist/ works from any folder:
//           itch.io HTML5 uploads, GitHub Pages project sites, a plain file server.
//           Files in public/ (public/assets/...) are copied to dist/ as-is.
//           The "ui-assets" plugin lists public/assets/ui/ at build time as `virtual:ui-assets`, so the
//           shell knows which glyph PNGs and theme files exist without requesting a missing one (a 404
//           fails smoke). Restart `dev.py run` after adding files there.
//           The "dotwork-manifests" plugin lists public/assets/dotwork/*.assets.json the same way, as
//           `virtual:dotwork-manifests` (URLs like "assets/dotwork/town.assets.json"; src/game/dotwork/boot.ts).
//           YEET_HTTPS=1 (set by `npm run duel`, ADR 0003): served over https with a self-signed certificate
//           (@vitejs/plugin-basic-ssl; browsers only give the gyro to secure pages), and /duel-ws passes the duel's
//           WebSocket through to the duel server on DUEL_PORT (a secure page may not open a plain ws:// socket).
//           Every other run (dev.py run, smoke, build) stays plain http, as before.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
/// <reference types="node" />
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig, type Plugin } from "vite";

/** `npm run duel` on the home network: https for the gyro, the duel socket through the page's own port. */
const HTTPS = process.env.YEET_HTTPS === "1";
const DUEL_PORT = 7357; // src/net/protocol.ts DUEL_PORT (the config does not import game code)

const UI_DIR = fileURLToPath(new URL("./public/assets/ui/", import.meta.url));
const VIRTUAL_ID = "virtual:ui-assets";
const DOTWORK_DIR = fileURLToPath(new URL("./public/assets/dotwork/", import.meta.url));
const DOTWORK_ID = "virtual:dotwork-manifests";
const DOTWORK_SUFFIX = ".assets.json";

/** Every file under public/assets/ui/, as paths relative to it ("glyphs/key_space.png"). */
function listUiAssets(dir = UI_DIR): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...listUiAssets(full));
    else out.push(relative(UI_DIR, full).split(/[\\/]/).join("/"));
  }
  return out.sort();
}

function uiAssets(): Plugin {
  const resolved = "\0" + VIRTUAL_ID;
  return {
    name: "ui-assets",
    resolveId: (id) => (id === VIRTUAL_ID ? resolved : null),
    load: (id) => (id === resolved ? `export default ${JSON.stringify(listUiAssets())};` : null),
  };
}

/** Dotwork's asset manifests (one per pack), as page-relative URLs, sorted. */
function dotworkManifests(): Plugin {
  const resolved = "\0" + DOTWORK_ID;
  const list = () =>
    existsSync(DOTWORK_DIR)
      ? readdirSync(DOTWORK_DIR).filter((f) => f.endsWith(DOTWORK_SUFFIX)).sort().map((f) => `assets/dotwork/${f}`)
      : [];
  return {
    name: "dotwork-manifests",
    resolveId: (id) => (id === DOTWORK_ID ? resolved : null),
    load: (id) => (id === resolved ? `export default ${JSON.stringify(list())};` : null),
  };
}

export default defineConfig({
  base: "./",
  plugins: [uiAssets(), dotworkManifests(), ...(HTTPS ? [basicSsl({ name: "yeetpowder-duel" })] : [])],
  build: {
    outDir: "dist",
    assetsInlineLimit: 0, // keep game assets as files (easier to cache and to audit)
    chunkSizeWarningLimit: 2000, // Three.js alone is over the 500 kB default
  },
  server: {
    port: 5173,
    open: false,
    proxy: HTTPS ? { "/duel-ws": { target: `ws://localhost:${DUEL_PORT}`, ws: true } } : undefined,
  },
});
