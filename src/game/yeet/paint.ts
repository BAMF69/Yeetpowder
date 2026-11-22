// ---------------------------------------------------------------------------
// paint.ts
// Purpose : The vertical slice's surface look, painted in code (GDD "Shading and textures": small painted colour
//           textures, simple lighting, no heavy outlines; matched to docs/concept/keyframes/01-shotgun-start.png):
//           mottled concrete, a dark worn floor with seams, wooden crates with an X brace, teal riveted steel,
//           yellow/black hazard stripes, an orange wall band, a dark ceiling and fluorescent light panels.
// Usage   : const t = paintedTexture("crate")  // a CanvasTexture, cached per kind, RepeatWrapping, sRGB
//           disposePaint() when the world closes
// Notes   : Seeded (mulberry32), so every launch paints the same pixels. Softly filtered (linear + mipmaps), as the
//           GDD asks to start; tune against the keyframes. 128 px per tile keeps each texture small for phones.
//           Placeholder art made in code (docs/ASSET_LOG.md A-0006); real painted textures can replace these
//           kinds one by one through /asset-intake.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";

export type PaintKind = "concrete" | "floor" | "ceiling" | "crate" | "steel" | "hazard" | "band" | "light";

const SIZE = 128;
const cache = new Map<PaintKind, THREE.CanvasTexture>();

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise: a small random grid drawn up with smoothing, layered `alpha` over the canvas. */
function mottle(g: CanvasRenderingContext2D, rand: () => number, cells: number, alpha: number, dark: string, light: string): void {
  const n = document.createElement("canvas");
  n.width = n.height = cells;
  const ng = n.getContext("2d")!;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ng.fillStyle = rand() < 0.5 ? dark : light;
      ng.globalAlpha = 0.25 + rand() * 0.75;
      ng.fillRect(x, y, 1, 1);
    }
  }
  g.save();
  g.globalAlpha = alpha;
  g.imageSmoothingEnabled = true;
  // draw it 3 x 3 so the noise tiles seamlessly across the canvas edges
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) g.drawImage(n, ox * SIZE, oy * SIZE, SIZE, SIZE);
  g.restore();
}

function speckle(g: CanvasRenderingContext2D, rand: () => number, count: number, color: string, alpha: number): void {
  g.save();
  g.fillStyle = color;
  for (let i = 0; i < count; i++) {
    g.globalAlpha = alpha * rand();
    const s = 1 + Math.floor(rand() * 2);
    g.fillRect(Math.floor(rand() * SIZE), Math.floor(rand() * SIZE), s, s);
  }
  g.restore();
}

function rivets(g: CanvasRenderingContext2D, xs: number[], ys: number[]): void {
  for (const x of xs) {
    for (const y of ys) {
      g.fillStyle = "rgba(0,0,0,0.45)";
      g.fillRect(x, y + 1, 3, 3);
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.fillRect(x, y, 2, 2);
    }
  }
}

const painters: Record<PaintKind, (g: CanvasRenderingContext2D, r: () => number) => void> = {
  concrete(g, r) {
    g.fillStyle = "#7c7d7c";
    g.fillRect(0, 0, SIZE, SIZE);
    mottle(g, r, 8, 0.5, "#5e605f", "#9a9b98");
    mottle(g, r, 24, 0.35, "#626462", "#8f908d");
    speckle(g, r, 900, "#3c3d3c", 0.5);
    // a faint form-work seam
    g.fillStyle = "rgba(40,40,40,0.25)";
    g.fillRect(0, SIZE - 2, SIZE, 2);
  },
  floor(g, r) {
    g.fillStyle = "#4f5152";
    g.fillRect(0, 0, SIZE, SIZE);
    mottle(g, r, 6, 0.55, "#3a3b3c", "#666867");
    mottle(g, r, 20, 0.3, "#404142", "#5d5f5f");
    speckle(g, r, 1200, "#2a2b2b", 0.6);
    g.fillStyle = "rgba(20,20,20,0.22)"; // slab seams (soft: the keyframe floor barely shows them)
    g.fillRect(0, 0, SIZE, 2);
    g.fillRect(0, 0, 2, SIZE);
  },
  ceiling(g, r) {
    g.fillStyle = "#4c4e51"; // drawn unlit (room.ts): this is the colour you see
    g.fillRect(0, 0, SIZE, SIZE);
    mottle(g, r, 10, 0.5, "#37393b", "#626468");
    speckle(g, r, 700, "#222", 0.5);
  },
  crate(g, r) {
    g.fillStyle = "#8a6a3c";
    g.fillRect(0, 0, SIZE, SIZE);
    // plank grain
    for (let y = 0; y < SIZE; y += 2) {
      g.fillStyle = `rgba(${60 + r() * 30},${40 + r() * 20},${15 + r() * 10},${0.12 + r() * 0.18})`;
      g.fillRect(0, y, SIZE, 1);
    }
    g.fillStyle = "rgba(40,25,10,0.5)"; // plank gaps
    for (let y = 21; y < SIZE; y += 21) g.fillRect(0, y, SIZE, 1);
    // frame and the X brace, lighter boards with dark edges
    const board = (draw: () => void) => {
      g.save();
      g.strokeStyle = "#5a4020";
      g.lineWidth = 15;
      draw();
      g.strokeStyle = "#a07c46";
      g.lineWidth = 11;
      draw();
      g.restore();
    };
    board(() => g.strokeRect(7, 7, SIZE - 14, SIZE - 14));
    board(() => {
      g.beginPath();
      g.moveTo(12, 12);
      g.lineTo(SIZE - 12, SIZE - 12);
      g.stroke();
    });
    mottle(g, r, 12, 0.18, "#3a2810", "#b08850");
    rivets(g, [5, SIZE - 8], [5, SIZE - 8]);
  },
  steel(g, r) {
    g.fillStyle = "#3d6b67";
    g.fillRect(0, 0, SIZE, SIZE);
    mottle(g, r, 10, 0.4, "#2b4d4a", "#5a8a84");
    speckle(g, r, 500, "#6b4a2a", 0.5); // rust flecks
    g.strokeStyle = "rgba(20,35,33,0.7)";
    g.lineWidth = 4;
    g.strokeRect(4, 4, SIZE - 8, SIZE - 8);
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(8, 8);
    g.lineTo(SIZE - 8, SIZE - 8);
    g.moveTo(SIZE - 8, 8);
    g.lineTo(8, SIZE - 8);
    g.stroke();
    const xs: number[] = [];
    for (let x = 8; x < SIZE - 6; x += 15) xs.push(x);
    rivets(g, xs, [7, SIZE - 10]);
    rivets(g, [7, SIZE - 10], xs);
  },
  hazard(g, r) {
    g.fillStyle = "#1d1d1d";
    g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = "#d4ae35";
    for (let k = -SIZE; k < SIZE * 2; k += 32) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + 16, 0);
      g.lineTo(k + 16 - SIZE, SIZE);
      g.lineTo(k - SIZE, SIZE);
      g.closePath();
      g.fill();
    }
    mottle(g, r, 12, 0.3, "#2a2a2a", "#8a8a7a"); // worn
    speckle(g, r, 600, "#000", 0.4);
  },
  band(g, r) {
    g.fillStyle = "#b1542a";
    g.fillRect(0, 0, SIZE, SIZE);
    mottle(g, r, 10, 0.4, "#7e3a1c", "#cf6e3c");
    speckle(g, r, 500, "#3a1a0a", 0.5);
  },
  light(g, r) {
    g.fillStyle = "#3a3c40";
    g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = "#f4f6ef";
    const cell = (SIZE - 16) / 4;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) g.fillRect(8 + x * cell + 2, 8 + y * ((SIZE - 16) / 2) + 2, cell - 4, (SIZE - 16) / 2 - 4);
    speckle(g, r, 80, "#9aa", 0.3);
  },
};

/** The painted texture for a surface kind (cached; repeat it with world-scaled UVs, see room.ts). */
export function paintedTexture(kind: PaintKind): THREE.CanvasTexture {
  const hit = cache.get(kind);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const g = c.getContext("2d")!;
  painters[kind](g, rng(0x5eed + kind.length * 977 + kind.charCodeAt(0) * 131));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(kind, t);
  return t;
}

export function disposePaint(): void {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}
