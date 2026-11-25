// Circular collision built from narrow chords: scenery and the authoritative sim share every tread.
import { box, type Box } from "./arena";
import type { Level } from "./levels";

export function coliseumLevel(): Level {
  const boxes: Box[] = [];
  const annulus = (inner: number, outer: number, height: number, paint?: Box["paint"]) => {
    for (let z = -outer; z < outer; z += 1) {
      // Cover the curved boundary conservatively: neighboring tiers overlap, leaving no cracks in a tread.
      const near = Math.min(Math.abs(z), Math.abs(z + 1)), far = Math.max(Math.abs(z), Math.abs(z + 1));
      const x = Math.sqrt(Math.max(0, outer * outer - near * near));
      const gap = Math.sqrt(Math.max(0, inner * inner - far * far));
      if (x <= gap) continue;
      const add = (lo: number, hi: number) => boxes.push({ ...box(lo, -1, z, hi, height, z + 1, height === 0 ? "floor" : "block"), paint });
      if (gap > 0) { add(-x, -gap); add(gap, x); } else add(-x, x);
    }
  };
  annulus(0, 52, 0, "sand");
  annulus(32, 38, 2, "concrete");
  annulus(38, 44, 4, "concrete");
  annulus(44, 50, 6, "concrete");
  annulus(50, 52, 12, "rock");
  // Four broad stairways climb all three rings; each 0.5 m riser is jumpable.
  for (let direction = 0; direction < 4; direction++) for (let step = 0; step < 12; step++) {
    const r = 27 + step * 1.5, h = (step + 1) * 0.5;
    if (direction === 0) boxes.push(box(-2, 0, r, 2, h, r + 1.5));
    if (direction === 1) boxes.push(box(r, 0, -2, r + 1.5, h, 2));
    if (direction === 2) boxes.push(box(-2, 0, -r - 1.5, 2, h, -r));
    if (direction === 3) boxes.push(box(-r - 1.5, 0, -2, -r, h, 2));
  }
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) * Math.PI / 4, x = Math.sin(a) * 18, z = Math.cos(a) * 18;
    boxes.push({ ...box(x - 1.5, 0, z - 1.5, x + 1.5, 2.5, z + 1.5), paint: "rock" });
  }
  // Stair treads use the same stone as the rings instead of the generic crate-size heuristic.
  for (const b of boxes) if (!b.paint) b.paint = "concrete";
  const spawns = Array.from({ length: 8 }, (_, i) => {
    const a = (i + 0.5) * Math.PI / 4;
    return { x: Math.sin(a) * 28, y: 0, z: Math.cos(a) * 28 };
  });
  return { id: "coliseum", name: "The Yeet Coliseum", recommendedPlayers: 8,
    arena: { boxes, dummySpawns: [] }, spawn: spawns[0], spawnYaw: Math.PI / 8,
    spawns, spawnYaws: spawns.map((p) => Math.atan2(p.x, p.z)),
    startWeapons: ["pistol", "shotgun"],
    pickups: [
      { weapon: "copter", pos: { x: 0, y: 0, z: 0 } },
      { weapon: "rocket", pos: { x: 35, y: 2, z: 8 } },
      { weapon: "sniper", pos: { x: -41, y: 4, z: 8 } },
      { weapon: "reaper", pos: { x: 8, y: 6, z: 46 } },
      { weapon: "sakura", pos: { x: -8, y: 6, z: -46 } },
      { weapon: "grenade", pos: { x: -12, y: 0, z: 0 } },
      { weapon: "axe", pos: { x: 12, y: 0, z: 0 } },
    ], dummiesFight: false, dummyRespawn: 5, seed: 144, outdoor: true };
}
