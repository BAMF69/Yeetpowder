// ---------------------------------------------------------------------------
// bulletHole.ts
// Purpose : The torn-metal "bullet hole" art behind each touch button (approved HUD concept, 2026-11-28,
//           docs/mockups/hud/index.html): a jagged peeled-steel rim, a cream-painted inner lip that keeps the button
//           readable on black (the Spin Doctor scope) and on bright floors, a see-through dark hole for the label,
//           and a few short cracks. Same seed, same hole, so each button keeps its own shape across reloads.
// Usage   : el.style.backgroundImage = bulletHoleUrl({ seed: 3, tone: "fire" })   // CSS url("data:...")
//           bulletHoleSvg(...) gives the raw SVG text (tests, the mockup page).
// Notes   : Pure string building, no DOM and no three: unit tested in tests/bulletHole.test.ts. The art scales with
//           the button (viewBox units), so it is never stretched: buttons are square and the SVG keeps its aspect.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-28
// ---------------------------------------------------------------------------

/** How a button is lit: "idle" cream lip, "fire" hot pink lip, "on" (pressed or toggled) a filled cream hole. */
export type HoleTone = "idle" | "fire" | "on";

export interface HoleOptions {
  /** Picks the rim's shape; give each button its own. */
  seed: number;
  tone?: HoleTone;
}

/** Palette shared with the HUD (hud.ts): cream paint, hot pink danger, gunmetal. */
export const HOLE_COLOURS = { cream: "#e8dcc4", pink: "#ff2e88", steelHi: "#4a4d53", steel: "#25272b", steelLo: "#121315" };

/** The inner hole's radius in viewBox units (the viewBox is -54..54): labels must fit inside this. */
export const HOLE_INNER_R = 33;

/** Mulberry32: a tiny seeded generator, so the rim is the same on every device. */
function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number): string => n.toFixed(1);

/** A closed jagged ring: `n` points around `r`, alternating long and short by `spike`, with `jitter` noise. */
function jagged(next: () => number, n: number, r: number, spike: number, jitter: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + (next() - 0.5) * 0.5) / n) * Math.PI * 2;
    const rr = r - (i % 2 ? spike * (0.6 + next() * 0.8) : 0) + (next() - 0.5) * jitter;
    pts.push(`${f(Math.cos(a) * rr)},${f(Math.sin(a) * rr)}`);
  }
  return pts.join(" ");
}

export function bulletHoleSvg({ seed, tone = "idle" }: HoleOptions): string {
  const next = rng(seed);
  const c = HOLE_COLOURS;
  const lip = tone === "fire" ? c.pink : c.cream;
  const hole = tone === "on" ? c.cream : tone === "fire" ? "rgba(70,10,36,0.78)" : "rgba(10,10,12,0.78)";
  // peeled petals: long spikes outward, the steel bent back toward the shooter
  const petals = jagged(next, 18, 49, 9, 3);
  const inner = jagged(next, 26, HOLE_INNER_R, 1.6, 1.8);
  const lipRing = jagged(next, 26, HOLE_INNER_R + 3.2, 1.2, 1.4);
  const cracks: string[] = [];
  for (let i = 0; i < 4; i++) {
    const a = next() * Math.PI * 2;
    const r0 = 40 + next() * 4, r1 = 50 + next() * 3.5, bend = (next() - 0.5) * 0.25;
    cracks.push(`M${f(Math.cos(a) * r0)} ${f(Math.sin(a) * r0)}L${f(Math.cos(a + bend) * r1)} ${f(Math.sin(a + bend) * r1)}`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-54 -54 108 108">` +
    `<defs><radialGradient id="s" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="${c.steelHi}"/>` +
    `<stop offset="0.55" stop-color="${c.steel}"/><stop offset="1" stop-color="${c.steelLo}"/></radialGradient></defs>` +
    `<path d="${cracks.join("")}" stroke="#000" stroke-opacity="0.75" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<polygon points="${petals}" fill="url(#s)" fill-opacity="0.92" stroke="#000" stroke-opacity="0.8" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<polygon points="${lipRing}" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="2.2"/>` +
    `<polygon points="${inner}" fill="${hole}" stroke="${lip}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `</svg>`;
}

/** The SVG as a CSS `url(...)` value for background-image. */
export function bulletHoleUrl(o: HoleOptions): string {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(bulletHoleSvg(o))}")`;
}

// ---------------------------------------------------------------------------
// End of bulletHole.ts
// ---------------------------------------------------------------------------
