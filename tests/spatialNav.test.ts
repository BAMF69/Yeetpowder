import { describe, expect, it } from "vitest";
import { nextInDirection, type NavRect } from "../src/shell/spatialNav";

// The home screen: a tall PLAY tile, a 2x2 block, a tall Operator tile.
//  [PLAY][Party][Solo ][OP]
//  [PLAY][Couch][Gear ][OP]
const home: NavRect[] = [
  { x: 0, y: 0, w: 135, h: 210 },   // 0 PLAY
  { x: 145, y: 0, w: 100, h: 100 }, // 1 Party
  { x: 255, y: 0, w: 100, h: 100 }, // 2 Solo
  { x: 145, y: 110, w: 100, h: 100 }, // 3 Couch
  { x: 255, y: 110, w: 100, h: 100 }, // 4 Settings
  { x: 365, y: 0, w: 100, h: 210 }, // 5 Operator
];

describe("spatial navigation over icon tiles", () => {
  it("moves between neighbours in the 2x2 block", () => {
    expect(nextInDirection(home, 1, "right")).toBe(2);
    expect(nextInDirection(home, 1, "down")).toBe(3);
    expect(nextInDirection(home, 4, "up")).toBe(2);
    expect(nextInDirection(home, 4, "left")).toBe(3);
  });
  it("enters and leaves the tall tiles", () => {
    expect(nextInDirection(home, 3, "left")).toBe(0);
    expect(nextInDirection(home, 0, "right")).toBe(1); // both touch it; the nearer centre (top) wins
    expect(nextInDirection(home, 4, "right")).toBe(5);
    expect(nextInDirection(home, 5, "left")).toBe(2);
  });
  it("returns -1 at an edge and skips hidden tiles", () => {
    expect(nextInDirection(home, 0, "left")).toBe(-1);
    expect(nextInDirection(home, 1, "up")).toBe(-1);
    const hidden = home.map((r, i) => (i === 2 ? { ...r, w: 0, h: 0 } : r));
    expect(nextInDirection(hidden, 1, "right")).toBe(4); // the nearer diagonal beats the far tall tile
  });
});
