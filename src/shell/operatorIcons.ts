// ---------------------------------------------------------------------------
// operatorIcons.ts
// Purpose : A flat head-and-shoulders icon for every operator, a simplified drawing of that operator's actual model
//           (Elaina, 2026-11-27: "make them look like simplified versions of the actual operators"). Used where a
//           live 3D portrait would be too heavy or too small: the home tile, the respawn screen, the operator strip.
// Usage   : box.append(operatorIcon("ninja")) ; operatorIcon(id, "my-class")
// Notes   : Drawn in code from the reference render captures/progress/operators-ready.png (tools/
//           test_operator_browser.mjs), so nothing to licence. viewBox 100x100: a dark disc, shoulders from y 70,
//           head centred near (50, 42). Two or three flat shades per material, a soft shadow on the right side.
//           Unknown ids fall back to the classic Vanguard, as the renderer does. Each icon has a <title> with the
//           operator's name for screen readers; it is aria-hidden where a word label sits next to it.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-27
// ---------------------------------------------------------------------------
import { OPERATORS, type OperatorId } from "../net/profile";

const BG = `<circle cx="50" cy="50" r="48" fill="#0b1426"/>`;
/** The right-hand shadow over everything drawn before it (one shape, so every icon is lit the same way). */
const SHADE = `<path d="M50 0h50v100H50z" fill="#000" opacity=".16"/>`;
const shoulders = (fill: string, broad = 0) =>
  `<path d="M${8 - broad} 100C${10 - broad} ${80 - broad / 2} ${26 - broad} 69 50 69s${40 + broad} ${11 - broad / 2} ${42 + broad} 31z" fill="${fill}"/>`;
const neck = (fill: string) => `<path d="M42 54h16v18H42z" fill="${fill}"/>`;
const face = (fill: string, rx = 14, ry = 17, cy = 42) => `<ellipse cx="50" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
const eyes = (fill = "#1a1410", y = 42) => `<path d="M42 ${y}h5v2.4h-5zM53 ${y}h5v2.4h-5z" fill="${fill}"/>`;
const brows = (fill = "#2a1d14", y = 38) => `<path d="M41 ${y}l7 1v1.6l-7-.6zM59 ${y}l-7 1v1.6l7-.6z" fill="${fill}"/>`;
/** The classic tactical vest: two dark panels over the suit. */
const vest = (fill = "#1c2230") => `<path d="M28 100l4-24 10-5 8 8 8-8 10 5 4 24z" fill="${fill}"/><path d="M42 71l8 8 8-8" stroke="#0e121b" stroke-width="2" fill="none"/>`;

/** The four classic colourways share one model: slick dark hair, pale face, a suit in their colour, a black vest. */
function classic(suit: string): string {
  return BG + shoulders(suit) + vest() + neck("#b9c3d6") + face("#c9d2e2") +
    `<path d="M36 38c0-14 8-19 15-19 9 0 14 6 14 16l-3-6c-5 2-14 2-21-1z" fill="#1d2027"/>` + eyes("#2b3445") + brows("#1d2027") +
    `<path d="M46 52h8" stroke="#8d97ab" stroke-width="1.6"/>` + SHADE;
}

const ICONS: Record<OperatorId, string> = {
  navy: classic("#2c3d7c"),
  ember: classic("#b5602f"),
  mint: classic("#2a8a6c"),
  violet: classic("#6f45a8"),

  // big round lime head, narrow chin, huge black almond eyes with a highlight, thin body
  "alien-t-pose": BG + `<path d="M30 100c2-14 9-22 20-22s18 8 20 22z" fill="#8fd61f"/>` + `<path d="M46 62h8v18h-8z" fill="#7cc219"/>` +
    `<path d="M50 14c17 0 26 11 26 24 0 15-13 30-26 30S24 53 24 38c0-13 9-24 26-24z" fill="#a6e82a"/>` +
    `<path d="M30 38c4-6 12-6 15 1 1 6-4 9-9 8-5-1-8-4-6-9zM70 38c-4-6-12-6-15 1-1 6 4 9 9 8 5-1 8-4 6-9z" fill="#0c0f0a"/>` +
    `<circle cx="35" cy="39" r="1.8" fill="#fff"/><circle cx="61" cy="39" r="1.8" fill="#fff"/>` +
    `<path d="M47 60q3 1.5 6 0" stroke="#5f9614" stroke-width="1.4" fill="none"/>` + SHADE,

  // camo jacket and cap, a camo scarf over the lower face: only a strip of skin at the eyes
  "camo-soldier": BG + shoulders("#5d6448") +
    `<path d="M18 92c6-4 10-2 14-6M64 84c5 2 9 0 14 4M36 78c4 2 8 0 10 3M54 90c3-2 7-1 9-4" stroke="#3e4430" stroke-width="5" stroke-linecap="round" fill="none"/>` +
    neck("#4d5340") + face("#b08868") +
    `<path d="M34 46c4 2 28 2 32 0v8c-2 9-9 14-16 14s-14-5-16-14z" fill="#6b7252"/><path d="M40 52c3 1 6 0 8 2M54 56c3-1 6 0 8-2" stroke="#474d36" stroke-width="3" fill="none"/>` +
    `<path d="M33 36c0-12 8-17 17-17s17 5 17 17c-2-2-30-2-34 0z" fill="#646b4c"/><path d="M30 37h40v4H30z" fill="#555b40"/><path d="M42 26c4-2 8 0 10-2" stroke="#424832" stroke-width="3" fill="none"/>` +
    eyes("#1d1a14", 43) + SHADE,

  // swept dark hair, stubble, olive jacket, a grey-green scarf
  "field-survivor-4000": BG + shoulders("#454a39") + `<path d="M30 100l6-26 6-3v29zM70 100l-6-26-6-3v29z" fill="#353a2c"/>` +
    neck("#a37a5b") + face("#b98a66") +
    `<path d="M37 49c3 11 8 15 13 15s10-4 13-15c-4 4-22 4-26 0z" fill="#5a4636" opacity=".55"/>` +
    `<path d="M35 36c-1-12 7-18 16-18 10 0 15 6 14 15-3-5-8-6-12-6-6 0-14 2-18 9z" fill="#2a211b"/>` +
    eyes("#24180f") + brows() + `<path d="M34 66c6 6 26 6 32 0l2 8c-8 6-28 6-36 0z" fill="#6d7462"/>` + SHADE,

  // black gi with a crossed collar, black hood: an eye slit with skin
  ninja: BG + shoulders("#15161b") + `<path d="M40 70l10 18 10-18" stroke="#2a2c33" stroke-width="3" fill="none"/>` +
    neck("#111216") + face("#16171c", 16, 19) + `<path d="M36 38h28v8H36z" fill="#c69a7a"/>` + eyes("#120d0a", 40) +
    `<path d="M34 38c0-11 7-18 16-18s16 7 16 18z" fill="#1c1d23"/>` + SHADE,

  // Viking: huge fur-mantled shoulders, long dark beard, topknot
  "samurai-titan": BG + shoulders("#3a2c22", 10) +
    `<path d="M4 88c4-10 10-14 18-14 5-6 12-6 16-2M96 88c-4-10-10-14-18-14-5-6-12-6-16-2" stroke="#2a1f17" stroke-width="9" stroke-linecap="round" fill="none"/>` +
    `<path d="M22 80c4-3 8-2 10 1M66 81c3-3 8-3 11 0" stroke="#4d3b2d" stroke-width="3" fill="none"/>` +
    neck("#6e4a33") + face("#8a5e41", 15, 17, 40) +
    `<path d="M35 44c2 18 9 30 15 30s13-12 15-30c-4 5-26 5-30 0z" fill="#2b211c"/>` +
    `<path d="M36 34c0-10 6-15 14-15s14 5 14 15c-4-4-24-4-28 0z" fill="#241b16"/><ellipse cx="50" cy="16" rx="5" ry="4" fill="#241b16"/>` +
    eyes("#1a110b", 39) + brows("#1a120d", 35) + SHADE,

  // Samurai: dark kabuto helmet with a gold crest and a flaring neck guard, blue lamellar armour, gold band
  "samurai-warrior": BG + shoulders("#3b4f86") +
    `<path d="M16 84h68M14 92h72" stroke="#2c3b66" stroke-width="3"/><path d="M30 72h40v5H30z" fill="#c9a24a"/>` +
    `<path d="M22 64c4-14 14-22 28-22s24 8 28 22c-8-4-16-6-28-6s-20 2-28 6z" fill="#1d2230"/>` +
    neck("#8f6a4c") + face("#b2865f", 13, 15, 45) + eyes("#1d140d", 45) + brows("#1d140d", 41) +
    `<path d="M32 38c0-12 8-18 18-18s18 6 18 18c-4-3-32-3-36 0z" fill="#262c3b"/><path d="M30 37h40v4H30z" fill="#1d2230"/>` +
    `<path d="M50 24c-6-6-12-8-16-7 3 3 8 6 16 9 8-3 13-6 16-9-4-1-10 1-16 7z" fill="#d8b04e"/><circle cx="50" cy="18" r="3" fill="#d8b04e"/>` + SHADE,

  // Black Ops: black armour, a rounded black helmet with twin yellow goggles
  "shadow-vanguard": BG + shoulders("#1f2227") + `<path d="M14 82c6-8 14-11 22-11M86 82c-6-8-14-11-22-11" stroke="#2e3239" stroke-width="7" stroke-linecap="round" fill="none"/>` +
    vest("#272b31") + neck("#16181c") + face("#1b1d22", 16, 19) +
    `<path d="M34 38c0-12 7-19 16-19s16 7 16 19z" fill="#262a30"/>` +
    `<ellipse cx="43" cy="42" rx="6" ry="5" fill="#d6c63a"/><ellipse cx="57" cy="42" rx="6" ry="5" fill="#d6c63a"/><path d="M49 42h2" stroke="#16181c" stroke-width="2"/>` +
    `<ellipse cx="41.5" cy="40.5" rx="2" ry="1.4" fill="#fff6a8"/><ellipse cx="55.5" cy="40.5" rx="2" ry="1.4" fill="#fff6a8"/>` +
    `<path d="M40 52h20v6H40z" fill="#111317"/>` + SHADE,

  // Soldier: green helmet, stern face with stubble, green camo uniform and pouches
  soldier: BG + shoulders("#5e7a3e") + `<path d="M20 90c5-3 9-1 12-5M66 84c4 2 8 0 12 4M38 80c4 2 7 0 9 3" stroke="#46602c" stroke-width="5" stroke-linecap="round" fill="none"/>` +
    `<path d="M36 100V80h10v20zM54 100V80h10v20z" fill="#4c6331"/>` + neck("#a8805f") + face("#bf9068") +
    `<path d="M38 50c3 9 7 13 12 13s9-4 12-13c-3 3-21 3-24 0z" fill="#6a4f3a" opacity=".45"/>` + eyes("#22170f", 43) + brows("#2a1d14", 39) +
    `<path d="M31 38c0-13 8-20 19-20s19 7 19 20z" fill="#5b7a3c"/><path d="M28 37h44v4H28z" fill="#4b6830"/><path d="M40 26c4-1 7 1 10-1M54 30c3 0 5-2 8-1" stroke="#43602a" stroke-width="3" fill="none"/>` + SHADE,

  // Robot: white boxy head with rust, square orange eyes, a mouth grille, boxy shoulders
  "t-pose-robot": BG + `<path d="M14 100V78l10-6h52l10 6v22z" fill="#d9dde2"/><path d="M20 84l6 4M72 82l5 6M38 92l5-2" stroke="#c46a2c" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M44 60h12v14H44z" fill="#3a3f47"/>` + `<path d="M31 22h38v38H31z" fill="#e6e9ec"/><path d="M31 22h38v6H31z" fill="#c7ccd2"/>` +
    `<path d="M37 36h8v7h-8zM55 36h8v7h-8z" fill="#ff7a2e"/><path d="M39 38h3v3h-3zM57 38h3v3h-3z" fill="#ffd2a8"/>` +
    `<path d="M41 50h18M41 54h18" stroke="#6a7079" stroke-width="2"/><path d="M33 30c3 1 4 4 3 6M64 52c2-1 3 1 3 3" stroke="#c46a2c" stroke-width="2.4" stroke-linecap="round" fill="none"/>` + SHADE,

  // Tactical Operator: tan helmet with goggles pushed up, a dark mask, an olive plate carrier
  "tactical-operator": BG + shoulders("#8a8a62") + vest("#5a5e4a") + neck("#2c2e2b") + face("#33363a", 15, 18) +
    `<path d="M38 44l12-3 12 3-2 10-10 4-10-4z" fill="#22252a"/>` + `<path d="M40 41h20v3H40z" fill="#4a4e55"/>` +
    `<path d="M33 37c0-12 8-18 17-18s17 6 17 18c-4-3-30-3-34 0z" fill="#9b8a5e"/>` +
    `<path d="M38 28h24v6H38z" fill="#2a2c30"/><ellipse cx="44" cy="31" rx="4" ry="2.6" fill="#55606c"/><ellipse cx="56" cy="31" rx="4" ry="2.6" fill="#55606c"/>` + SHADE,

  // Black Widow: pale skin, black bob with bangs, black tank top on bare shoulders, a pendant
  "tactical-shadow-4000": BG + shoulders("#e7d6cc") + `<path d="M34 100c0-14 4-24 8-28h16c4 4 8 14 8 28z" fill="#15161a"/>` +
    `<path d="M40 72l2-6M60 72l-2-6" stroke="#15161a" stroke-width="2.4"/><path d="M45 70q5 6 10 0" stroke="#9aa0a8" stroke-width="1.2" fill="none"/><circle cx="50" cy="76" r="1.6" fill="#9aa0a8"/>` +
    neck("#dcc8bc") + face("#efe0d6", 13, 16, 43) +
    `<path d="M33 46c-3-18 6-28 17-28s20 10 17 28c-2-7-4-10-6-12-6 3-16 3-22 0-3 3-4 7-6 12z" fill="#141418"/>` +
    `<path d="M33 44c-1 8 1 14 5 18l-2-14zM67 44c1 8-1 14-5 18l2-14z" fill="#141418"/>` +
    eyes("#1b1618", 43) + `<path d="M47 53q3 1.5 6 0" stroke="#b9737a" stroke-width="1.6" fill="none"/>` + SHADE,
};

let clipCount = 0;

/** The operator's icon as an inline <svg>. */
export function operatorIcon(id: OperatorId | string, cls = "op-icon"): SVGSVGElement {
  const key = (Object.hasOwn(ICONS, id) ? id : "navy") as OperatorId;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", cls);
  svg.setAttribute("role", "img");
  // clipped to the disc, so the right-hand shadow never shows past the circle; ids are per icon (many share a page)
  const clip = `opclip${++clipCount}`;
  svg.innerHTML = `<title>${OPERATORS[key].name}</title><clipPath id="${clip}"><circle cx="50" cy="50" r="48"/></clipPath><g clip-path="url(#${clip})">${ICONS[key]}</g>`;
  return svg;
}

/** Every operator has an icon (tests/operatorIcons.test.ts). */
export function hasOperatorIcon(id: string): boolean { return Object.hasOwn(ICONS, id); }

// ---------------------------------------------------------------------------
// End of operatorIcons.ts
// ---------------------------------------------------------------------------
