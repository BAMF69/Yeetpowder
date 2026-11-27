// ---------------------------------------------------------------------------
// sceneryJunkyard.ts
// Purpose : Junkyard dressing for the duel map and its Party variant (2026-11-26 level pass): rows of stacked
//           wrecks that make lanes, Rusty Car Stack piles as the walkable way up, oil drums, skips and the crane.
// Usage   : junkyardScenery(false) (duel) / junkyardScenery(true) (Party); levels.ts adds the colliders.
// Notes   : No three import. A stack layer rests on the collider top of the one below, so heights follow the meshes:
//           1 car ~1.4 m, 2 cars ~2.8 m, 3 cars ~4.2 m, 4 cars ~5.6 m. Walkable climbs: pile ledge 0.89 m -> pile
//           top 1.85 m -> a two-car stack; anything taller is a recoil perch. Lanes between stacks are >= 1.9 m.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { place, decor, sceneryTop, type SceneryId, type SceneryPlacement } from "./scenery";

/** Real-world scales: cars 4.2-4.6 m long and ~1.4 m tall (clearly not a hop: stacks are recoil routes); the pile 4.7 m; drums 1 m (a hop). */
const CAR: Record<"wreckedCar" | "charredCar" | "van", number> = { wreckedCar: 2.25, charredCar: 2.35, van: 2.11 };
type CarId = keyof typeof CAR;
export const PILE = 2.4, OIL_DRUM = 1.15, CRANE = 9, SKIP = 1.33;
const ORDER: CarId[] = ["wreckedCar", "charredCar", "wreckedCar", "charredCar"];

/**
 * A stack of `n` wrecks at (x, z), long axis along x (or z), each layer nudged a little like a crane dropped it.
 * `bottom` picks the lowest car (a van makes a taller base); the rest alternate wrecked/charred, turned end for end.
 */
export function carStack(x: number, z: number, n: number, alongX = true, bottom: CarId = "wreckedCar"): SceneryPlacement[] {
  const out: SceneryPlacement[] = [];
  let y = 0;
  for (let i = 0; i < n; i++) {
    const art: SceneryId = i === 0 ? bottom : ORDER[i];
    const o = (i % 2 ? 0.18 : -0.1) * (alongX ? 1 : -1);
    const p = place(art, x + (alongX ? o : 0), y, z + (alongX ? 0 : o), CAR[art as CarId], (alongX ? 0 : 1) + (i % 2 ? 2 : 0));
    out.push(p);
    y = sceneryTop(p);
  }
  return out;
}
export const stackTop = (s: SceneryPlacement[]) => sceneryTop(s[s.length - 1]);
const pile = (x: number, z: number, quarter = 0) => place("carPile", x, 0, z, PILE, quarter);
const drum = (x: number, z: number) => place("oilDrum", x, 0, z, OIL_DRUM);

function duel(): SceneryPlacement[] {
  return [
    // the north row: the pile is the way up onto the two-car walkway; the four-car tower is a recoil perch
    pile(-19, -14), ...carStack(-13.4, -14, 2), ...carStack(-7.5, -14, 4), ...carStack(4, -14, 1),
    ...carStack(10.5, -14, 3), ...carStack(17, -14, 2, true, "van"), drum(19.6, -11.9), drum(20.3, -11.3),
    // the middle: stacks round the crusher's plaza (the crate step by the crusher stays: tests launch from it)
    ...carStack(-20, 0, 2, true, "van"), ...carStack(-14, 1, 1), place("crate", -3.12, 0, 1.5, 1.15),
    ...carStack(9, 0, 2), ...carStack(15, -1, 4), ...carStack(21, 0, 1, true, "charredCar"), pile(9, 4.3, 2),
    // the south row, with a pile behind the two-car stack
    ...carStack(-17, 13, 1, true, "charredCar"), ...carStack(-10, 14, 3), ...carStack(-3, 14, 2), pile(-3.4, 17.8, 2),
    ...carStack(6, 13, 4, true, "van"), ...carStack(13, 14, 1), drum(13, 15.75),
    // along the sides
    ...carStack(-23, -5, 2, false), ...carStack(23, 7, 3, false, "van"), ...carStack(23, 18, 1, false),
    place("skip", -19, 0, 8, SKIP, 1), drum(17, 20.3), drum(18, 20.3), drum(17.5, 21.3),
    // the crane in the north-west corner, its jib over the north row
    place("crane", -15.5, 0, -20.5, CRANE, 2),
  ];
}

/** One salvage court of the Party map, themed so the four corners read differently. */
function court(cx: number, cz: number, sx: number, sz: number, theme: "crane" | "vans" | "burnt" | "hill"): SceneryPlacement[] {
  const out: SceneryPlacement[] = [];
  const back = cz + 9 * sz, front = cz - 9 * sz; // back row toward the outer fence, front row toward the centre
  if (theme === "crane") {
    out.push(pile(cx - 7, back), ...carStack(cx - 1, back, 2), ...carStack(cx + 6, back, 4),
      ...carStack(cx - 7, front, 2), ...carStack(cx + 7, front, 3), ...carStack(cx + sx * 11, cz, 2, false),
      place("crane", cx - sx * 2, 0, cz + sz * 1, CRANE, sx > 0 ? 0 : 2), drum(cx + 2, cz - sz * 4), drum(cx + 2.8, cz - sz * 4.6));
  } else if (theme === "vans") {
    out.push(...carStack(cx - 7, back, 3, true, "van"), pile(cx, back), ...carStack(cx + 7, back, 2, true, "van"),
      ...carStack(cx - 7, front, 2, true, "van"), ...carStack(cx + 7, front, 3, true, "van"), ...carStack(cx + sx * 11, cz, 2, false, "van"),
      place("skip", cx, 0, cz, SKIP, 1));
  } else if (theme === "burnt") {
    out.push(...carStack(cx - 7, back, 3, true, "charredCar"), ...carStack(cx, back, 2, true, "charredCar"), pile(cx + 7, back),
      ...carStack(cx - 7, front, 2, true, "charredCar"), ...carStack(cx + 7, front, 4, true, "charredCar"),
      ...carStack(cx + sx * 11, cz, 1, false, "charredCar"), drum(cx - 2, cz), drum(cx - 2.6, cz + 0.8), drum(cx - 1.4, cz + 0.9));
  } else {
    // a hill of piles: three walkable piles step up to a two-car crest, the four-car tower behind is a recoil perch
    out.push(pile(cx - 7, back), ...carStack(cx - 1.2, back, 2), ...carStack(cx + 6, back, 4),
      pile(cx - 7, front), pile(cx + 7, front), ...carStack(cx + sx * 11, cz, 2, false),
      drum(cx + 2, cz + sz * 2), drum(cx - 3, cz - sz * 3));
  }
  return out;
}

function party(): SceneryPlacement[] {
  return [
    ...court(-25, -24, -1, -1, "crane"), ...court(25, -24, 1, -1, "vans"),
    ...court(-25, 24, -1, 1, "burnt"), ...court(25, 24, 1, 1, "hill"),
    // four launch steps round the elevated crossing (a two-car stack, then recoil up to the 4.4 m slab)
    ...carStack(-11, -7, 2), ...carStack(11, 7, 2), ...carStack(-7, 11, 2, false), ...carStack(7, -11, 2, false),
    // wrecks lying along the cross lanes as low cover
    ...carStack(-34, 3, 1, true, "charredCar"), ...carStack(34, -3, 1), ...carStack(3, 34, 1, false, "charredCar"), ...carStack(-3, -34, 1, false),
    drum(-20, 3.5), drum(20, -3.5), drum(-3.5, -20), drum(3.5, 20),
    // container walls shielding the east and west spawns (12 m, 2.6 m tall)
    place("container", -42, 0, -3.07, 3.1, 1), place("container", -42, 0, 3.07, 3.1, 1),
    place("container", 42, 0, -3.07, 3.1, 3), place("container", 42, 0, 3.07, 3.1, 3),
    decor("fuelCan", -49.2, 0, 10), decor("fuelCan", 49.2, 0, -10),
  ];
}

export function junkyardScenery(isParty: boolean): SceneryPlacement[] {
  return isParty ? party() : duel();
}
