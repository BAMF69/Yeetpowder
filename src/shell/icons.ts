// ---------------------------------------------------------------------------
// icons.ts
// Purpose : The front end's icons: small flat SVG shapes drawn in code, one per idea (play, party, bots, couch,
//           settings, modes, steppers ...), plus the map thumbnails for the room setup screens.
// Usage   : tile.append(icon("party")) ; card.append(mapScene("island-party"))
// Notes   : Original shapes made for Yeetpowder (no icon font, no downloaded asset, nothing to licence). They
//           paint with currentColor, so CSS sets their colour; a few cut-outs use the menu ink (--mk-ink).
//           Icons carry aria-hidden: the tile's one-word label (tl()) is what screen readers and the
//           pseudo-locale check read. Approved in docs/mockups/menu-redesign.html (Elaina, 2026-11-26).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-26
// ---------------------------------------------------------------------------
import type { LevelId } from "../core/yeet/levels";

const INK = "var(--mk-ink,#070d1c)";

/** viewBox 0 0 24 24 unless the entry gives its own. */
const ICONS: Record<string, string | [string, string]> = {
  bolt: `<path fill="currentColor" d="M13 2 4 14h6l-1 8 9-12h-6z"/>`,
  party: `<g fill="currentColor"><circle cx="8" cy="7" r="3"/><circle cx="16.5" cy="8" r="2.5"/><path d="M2 20c0-4 2.7-7 6-7s6 3 6 7z"/><path d="M14.5 20c0-2-.5-3.8-1.6-5.2.9-.8 2.2-1.3 3.6-1.3 3 0 5.5 2.6 5.5 6.5z"/></g>`,
  bot: `<g fill="currentColor"><rect x="4" y="7" width="16" height="12" rx="3"/><rect x="11" y="2" width="2" height="5"/><circle cx="12" cy="2.5" r="1.6"/></g><g fill="${INK}"><circle cx="9" cy="12.5" r="1.8"/><circle cx="15" cy="12.5" r="1.8"/><rect x="8.5" y="15.6" width="7" height="1.6" rx=".8"/></g>`,
  couch: `<path fill="currentColor" d="M5 6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4a3 3 0 0 0-3 3H8a3 3 0 0 0-3-3zM1 12a2 2 0 0 1 4 0v3h14v-3a2 2 0 1 1 4 0v6H1zM3 19h2v2H3zm16 0h2v2h-2z"/>`,
  gear: `<path fill="currentColor" fill-rule="evenodd" d="M10.3 2h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9L2 13.7v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7"/>`,
  back: `<path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M15 4 7 12l8 8"/>`,
  next: `<path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="m9 4 8 8-8 8"/>`,
  plus: `<path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M12 4v16M4 12h16"/>`,
  minus: `<path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M4 12h16"/>`,
  door: `<g fill="currentColor"><path d="M4 3h10v18H4z" opacity=".35"/><path d="M14 3l6 2v16l-6-2z"/></g><path d="M8 12h7m-3-3 3 3-3 3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  eye: `<path fill="currentColor" d="M12 5C6.5 5 2.7 9.3 1.5 12c1.2 2.7 5 7 10.5 7s9.3-4.3 10.5-7C21.3 9.3 17.5 5 12 5m0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8"/><circle cx="12" cy="12" r="2" fill="currentColor"/>`,
  target: `<g fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></g><circle cx="12" cy="12" r="1.6" fill="currentColor"/>`,
  cube: `<path fill="currentColor" d="m12 2 9 5v10l-9 5-9-5V7zm0 2.3L5.4 8 12 11.6 18.6 8zM4.5 9.6v6.5l6.7 3.7v-6.5zm15 0-6.7 3.7v6.5l6.7-3.7z"/>`,
  vs: `<path fill="currentColor" d="M2 5h3l2.5 9L10 5h3l-4 14H6zm17.5 0c2 0 3.2 1 3.5 2.8l-2.6.5c-.1-.7-.5-1-1-1-.6 0-1 .3-1 .8 0 1.6 4.8 1.4 4.8 5.5 0 2.4-1.6 4-4 4-2.3 0-3.7-1.2-4-3.2l2.7-.5c.1.9.6 1.4 1.3 1.4s1.1-.4 1.1-1c0-1.8-4.8-1.5-4.8-5.5C15.5 6.5 17 5 19.5 5"/>`,
  skull: `<path fill="currentColor" fill-rule="evenodd" d="M12 2c5 0 8.5 3.4 8.5 8 0 2.6-1.2 4.4-2.5 5.4V19a2 2 0 0 1-2 2h-1v-2h-1.5v2h-3v-2H9v2H8a2 2 0 0 1-2-2v-3.6C4.7 14.4 3.5 12.6 3.5 10 3.5 5.4 7 2 12 2M8.5 9.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4M12 13.5l-1.3 2.5h2.6z"/>`,
  heart: `<path fill="currentColor" d="M12 21s-8.5-5.3-8.5-11.2A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 3.2C20.5 15.7 12 21 12 21"/>`,
  clock: `<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 6.5V12l3.8 2.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  ring: `<ellipse cx="12" cy="15" rx="10" ry="5" fill="none" stroke="currentColor" stroke-width="2.4"/><path fill="currentColor" d="m12 1 2.5 4h-1.7v6h-1.6V5H9.5z"/>`,
  globe: `<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path fill="none" stroke="currentColor" stroke-width="2" d="M2.5 12h19M12 2.5c3 3 3 16 0 19m0-19c-3 3-3 16 0 19"/>`,
  lock: `<path fill="currentColor" d="M7 10V7a5 5 0 0 1 10 0v3h1.5v11h-13V10zm2.5 0h5V7a2.5 2.5 0 0 0-5 0z"/>`,
  person: [`0 0 14 18`, `<circle cx="7" cy="4" r="3.5" fill="currentColor"/><path fill="currentColor" d="M0 18c0-5 3-8 7-8s7 3 7 8z"/>`],
  pad: `<path fill="currentColor" d="M7 6h10a5 5 0 0 1 5 5l.8 5.6a2.8 2.8 0 0 1-5 2L15.6 16H8.4l-2.2 2.6a2.8 2.8 0 0 1-5-2L2 11a5 5 0 0 1 5-5"/><path stroke="${INK}" stroke-width="1.8" stroke-linecap="round" d="M6 11h4M8 9v4"/><circle cx="16" cy="10" r="1.2" fill="${INK}"/><circle cx="18" cy="12.5" r="1.2" fill="${INK}"/>`,
  keyboard: `<path fill="currentColor" d="M1 6h22v12H1zm3 3v2h2V9zm4 0v2h2V9zm4 0v2h2V9zm4 0v2h4V9zM4 13v2h3v-2zm5 0v2h6v-2zm8 0v2h3v-2z"/>`,
  pencil: `<path fill="currentColor" d="m15.5 3.5 5 5L9 20H4v-5zm-2 3.4L6 14.4V18h3.6l7.5-7.5z"/>`,
  respawn: `<path fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" d="M19.5 12A7.5 7.5 0 1 1 17 6.4"/><path fill="currentColor" d="M21 3v7h-7z"/>`,
  auto: `<path fill="currentColor" d="M13 2 4 14h6l-1 8 9-12h-6z"/><circle cx="19" cy="19" r="4" fill="none" stroke="currentColor" stroke-width="2"/>`,
  trophy: `<path fill="currentColor" d="M7 3h10v2h4v3a4 4 0 0 1-4.3 4A5 5 0 0 1 13 15v3h3v3H8v-3h3v-3a5 5 0 0 1-3.7-3A4 4 0 0 1 3 8V5h4zm-2 4v1a2 2 0 0 0 2 2zm14 0-2 3a2 2 0 0 0 2-2z"/>`,
  gun: [`0 0 36 22`, `<path fill="currentColor" d="M2 4h28l2 3h3v4H22l-2 3h-4l-2 8H7l3-11H2z"/>`],
  sound: `<path fill="currentColor" d="M3 9h4l5-5v16l-5-5H3z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13"/>`,
  screen: `<path fill="currentColor" d="M2 4h20v13H2zm2 2v9h16V6zm4 13h8v2H8z"/>`,
  access: `<circle cx="12" cy="4" r="2.5" fill="currentColor"/><path fill="currentColor" d="M3 7.5 12 9l9-1.5.5 2.3-6.5 1.5V14l2.5 8h-2.6L12 15.5 9.1 22H6.5L9 14v-2.7L2.5 9.8z"/>`,
  info: `<circle cx="12" cy="12" r="10" fill="currentColor"/><path fill="${INK}" d="M11 10h2v8h-2zm0-4h2v2h-2z"/>`,
  quit: `<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M12 3v8m-5.5-5a8 8 0 1 0 11 0"/>`,
  star: `<path fill="currentColor" d="m12 2 3 6.6 7 .7-5.3 4.8 1.6 7L12 17.5 5.7 21l1.6-7L2 9.3l7-.7z"/>`,
  // Blast Zone decoration (iconMenus.ts fx layer): a pink starburst and a bullet hole
  blast: ["0 0 200 200", `<path d="M100 4l12 50 40-36-18 48 52-6-44 30 50 22-54 2 32 44-46-26 4 54-28-46-20 50-4-54-44 30 28-46-54 4 46-26-46-26 54 6-26-46 46 28-2-52 26 44z" fill="#ff2e88" opacity=".9"/><path d="M100 38l8 34 28-22-12 32 34-4-30 20 32 16-36 2 20 28-30-16 2 34-18-30-12 32-4-34-28 18 18-28-34 2 30-18-30-18 34 4-16-30 30 18-2-34 16 30z" fill="#ff8fc0"/><circle cx="100" cy="100" r="22" fill="#fff0f6"/>`],
  hole: ["0 0 40 40", `<g stroke="#0c0a08" stroke-width="1.1" stroke-linecap="round" opacity=".85" fill="none"><path d="M20 20 6 12M20 20l16-5M20 20l-3 18M20 20 4 27M20 20l13 13M20 20l2-17"/></g><g stroke="#d8c7a8" stroke-width=".5" opacity=".35" fill="none"><path d="M20 20 6 13M20 20l16-4M20 20l13 12"/></g><circle cx="20" cy="20" r="8.5" fill="#6b5a46"/><circle cx="20" cy="20" r="7" fill="#b8a286" opacity=".55"/><path d="M20 13.5l2 1.6 2.6-.4.6 2.5 2 1.7-1.2 2.3.6 2.5-2.4 1-1 2.4-2.4-.8-2.3 1.2-1.5-2.1-2.6-.4.3-2.6-1.6-2 1.9-1.8-.1-2.6 2.6-.3z" fill="#1a1410"/><circle cx="20" cy="20" r="3.6" fill="#030202"/>`],
  arenas: `<path fill="currentColor" d="M3 8l9-5 9 5v2H3zm1 3h3v7H4zm6.5 0h3v7h-3zM17 11h3v7h-3zM2 19h20v2H2z"/>`,
};

/** An icon as an inline <svg> (aria-hidden; its label lives next to it). Unknown names fail loudly. */
export function icon(name: string, cls = "mk-icon"): SVGSVGElement {
  const entry = ICONS[name];
  if (!entry) throw new Error(`icons: no icon named "${name}"`);
  const [box, body] = typeof entry === "string" ? ["0 0 24 24", entry] : entry;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", box);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", cls);
  svg.innerHTML = body;
  return svg;
}

export function hasIcon(name: string): boolean { return Object.hasOwn(ICONS, name); }

/** Which picture a map's tile shows. Party layouts share their base map's picture. */
export function sceneKind(level: LevelId | string): "coliseum" | "island" | "industrial" | "junkyard" | "duel" {
  if (level.startsWith("island")) return "island";
  if (level.startsWith("industrial")) return "industrial";
  if (level.startsWith("junkyard")) return "junkyard";
  if (level === "coliseum") return "coliseum";
  return "duel";
}

const SCENES: Record<ReturnType<typeof sceneKind>, string> = {
  coliseum: `<rect width="160" height="100" fill="#2b2140"/><ellipse cx="80" cy="64" rx="74" ry="30" fill="#5a4a6e"/><ellipse cx="80" cy="64" rx="56" ry="22" fill="#77628e"/><ellipse cx="80" cy="64" rx="36" ry="13" fill="#c8a56c"/><g fill="#9b86b5">${[20, 44, 68, 92, 116, 140].map((x) => `<rect x="${x - 4}" y="22" width="8" height="22"/>`).join("")}</g>`,
  island: `<rect width="160" height="100" fill="#2b74a8"/><ellipse cx="80" cy="58" rx="52" ry="22" fill="#e3c27e"/><ellipse cx="80" cy="54" rx="34" ry="13" fill="#4f9a55"/><path d="M118 82l6-12 6 12z" fill="#cfd8e2"/><path d="M30 26c10-4 20 4 30 0" stroke="#ffffff55" stroke-width="2" fill="none"/>`,
  industrial: `<rect width="160" height="100" fill="#3a4555"/><rect y="70" width="160" height="30" fill="#55606e"/><rect x="14" y="44" width="40" height="26" fill="#d9534f"/><rect x="58" y="50" width="34" height="20" fill="#e0a04a"/><rect x="100" y="12" width="5" height="58" fill="#ffd84a"/><rect x="100" y="12" width="46" height="5" fill="#ffd84a"/><rect x="138" y="17" width="2" height="18" fill="#cfd8e2"/>`,
  junkyard: `<rect width="160" height="100" fill="#4a3b2d"/><rect y="72" width="160" height="28" fill="#6b5640"/><rect x="18" y="56" width="44" height="16" rx="4" fill="#5d8aa8"/><rect x="24" y="42" width="40" height="14" rx="4" fill="#a85d5d"/><rect x="92" y="52" width="48" height="20" rx="3" fill="#7a7f6a"/><circle cx="104" cy="74" r="5" fill="#222"/><circle cx="130" cy="74" r="5" fill="#222"/>`,
  duel: `<rect width="160" height="100" fill="#26303f"/><rect y="66" width="160" height="34" fill="#3d4a5c"/><rect x="20" y="40" width="26" height="26" fill="#5a6b80"/><rect x="114" y="40" width="26" height="26" fill="#5a6b80"/><circle cx="58" cy="56" r="7" fill="#6286d9"/><circle cx="102" cy="56" r="7" fill="#f3a36c"/>`,
};

/** The map's picture, filling its tile. */
export function mapScene(level: LevelId | string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 160 100");
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "mk-scene");
  svg.innerHTML = SCENES[sceneKind(level)];
  return svg;
}

// ---------------------------------------------------------------------------
// End of icons.ts
// ---------------------------------------------------------------------------
