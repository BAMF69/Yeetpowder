// ---------------------------------------------------------------------------
// spatialNav.ts
// Purpose : Which tile the d-pad / arrow keys move to in a grid of tiles of any shape (the icon menus).
// Usage   : const next = nextInDirection(rects, focusedIndex, "right") // -1 when nothing lies that way
// Notes   : Pure geometry, no DOM (tested in tests/spatialNav.test.ts). A candidate must lie in the pressed
//           direction from the focused tile's centre; among those the score favours small travel along the
//           direction and penalises sideways drift twice as hard, so "right" from a tall tile picks the tile beside
//           it, not one diagonally below. Wrapping is the caller's choice.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-26
// ---------------------------------------------------------------------------

export type NavDir = "up" | "down" | "left" | "right";
export interface NavRect { x: number; y: number; w: number; h: number }

/** Sideways drift costs this much more than distance along the pressed direction. */
const SIDEWAYS_WEIGHT = 2;

export function nextInDirection(rects: readonly NavRect[], from: number, dir: NavDir): number {
  const a = rects[from];
  if (!a) return -1;
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
  let best = -1, bestScore = Infinity;
  rects.forEach((b, i) => {
    if (i === from || b.w <= 0 || b.h <= 0) return; // hidden tiles have no size
    const bx = b.x + b.w / 2, by = b.y + b.h / 2;
    // along: how far the candidate's near edge is past the focused tile's far edge (overlap counts as 0)
    let along: number, side: number;
    if (dir === "right") { if (bx <= ax) return; along = Math.max(0, b.x - (a.x + a.w)); side = gap(a.y, a.h, b.y, b.h); }
    else if (dir === "left") { if (bx >= ax) return; along = Math.max(0, a.x - (b.x + b.w)); side = gap(a.y, a.h, b.y, b.h); }
    else if (dir === "down") { if (by <= ay) return; along = Math.max(0, b.y - (a.y + a.h)); side = gap(a.x, a.w, b.x, b.w); }
    else { if (by >= ay) return; along = Math.max(0, a.y - (b.y + b.h)); side = gap(a.x, a.w, b.x, b.w); }
    const score = along + SIDEWAYS_WEIGHT * side + 0.001 * Math.hypot(bx - ax, by - ay); // tie-break: nearest centre
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

/** Distance between two 1-D spans (0 when they overlap). */
function gap(a0: number, aLen: number, b0: number, bLen: number): number {
  return Math.max(0, b0 - (a0 + aLen), a0 - (b0 + bLen));
}

// ---------------------------------------------------------------------------
// End of spatialNav.ts
// ---------------------------------------------------------------------------
