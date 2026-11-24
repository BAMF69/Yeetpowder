// ---------------------------------------------------------------------------
// roomUv.test.ts
// Purpose : Crates and riveted panels show whole copies of their texture on every face, never a cut-off one
//           (src/game/yeet/room.ts fitRepeats; "boxes appear as partial textures", 2026-11-24).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { fitRepeats } from "../src/game/yeet/room";

describe("fitRepeats", () => {
  it("is a whole number near size / tile", () => {
    expect(fitRepeats(1.6, 1.6)).toBe(1);
    expect(fitRepeats(3.2, 1.6)).toBe(2);
    expect(fitRepeats(4.3, 1.6)).toBe(3);
  });

  it("never drops below one copy (a small box shows the whole crate, shrunk)", () => {
    expect(fitRepeats(0.4, 1.6)).toBe(1);
    expect(fitRepeats(0, 1.6)).toBe(1);
  });
});
