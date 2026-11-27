import { describe, expect, it } from "vitest";
import { DEFAULT_DRAFT, draftOptions, familyAllowed, levelFor, publicAllowed, settle } from "../src/net/roomSetup";

describe("icon room setup rules", () => {
  it("picks the eight-spawn layout above two seats", () => {
    expect(levelFor("island", 2)).toBe("island");
    expect(levelFor("island", 3)).toBe("island-party");
    expect(levelFor("coliseum", 2)).toBe("coliseum");
  });
  it("Ring Out only on Shark Island; switching to it moves the map there", () => {
    expect(familyAllowed("junkyard", "ringout")).toBe(false);
    expect(settle({ ...DEFAULT_DRAFT, family: "junkyard", mode: "ringout" }).family).toBe("island");
  });
  it("public only for eight seats with bots and no lives", () => {
    expect(publicAllowed({ capacity: 8, botFill: true, mode: "kills" })).toBe(true);
    expect(publicAllowed({ capacity: 6, botFill: true, mode: "kills" })).toBe(false);
    expect(settle({ ...DEFAULT_DRAFT, visibility: "public", mode: "lives" }).visibility).toBe("private");
  });
  it("every draft the screen can make survives roomOptions unchanged", () => {
    for (const family of ["coliseum", "island", "industrial", "junkyard"] as const)
      for (const mode of ["kills", "lives", "timed", "ringout"] as const)
        for (const capacity of [2, 4, 8]) {
          const d = settle({ ...DEFAULT_DRAFT, family, mode, capacity, visibility: "public" });
          const o = draftOptions(d);
          expect(o.level).toBe(levelFor(d.family, capacity));
          expect(o.mode).toBe(mode);
          expect(o.visibility).toBe(d.visibility);
        }
  });
});
