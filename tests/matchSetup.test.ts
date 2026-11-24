// ---------------------------------------------------------------------------
// matchSetup.test.ts
// Purpose : The new levels' opponent choice (src/core/yeet/matchSetup.ts; Elaina 2026-11-24): still dummies,
//           dummies that fight back, or an easy/medium/hard bot, from the menu's world option or the URL; the old
//           options mean what they meant.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { parseMatch } from "../src/core/yeet/matchSetup";

describe("parseMatch", () => {
  it("reads the menu's options for a new level", () => {
    expect(parseMatch({ world: "island" })).toEqual({ levelId: "island", bot: null, stillDummies: false });
    expect(parseMatch({ world: "island:static" })).toEqual({ levelId: "island", bot: null, stillDummies: true });
    expect(parseMatch({ world: "junkyard:bot-hard" })).toEqual({ levelId: "junkyard", bot: "hard", stillDummies: false });
  });

  it("keeps the old options: Fight Back, the Sandbox, the duel room vs a bot", () => {
    expect(parseMatch({ world: "" })).toEqual({ levelId: "", bot: null, stillDummies: false });
    expect(parseMatch({ world: "duel-bot-easy" })).toEqual({ levelId: "duel", bot: "easy", stillDummies: false });
    expect(parseMatch({ level: "sandbox", world: "" }).levelId).toBe("sandbox");
  });

  it("takes the URL's ?opp and ?bot over the menu", () => {
    expect(parseMatch({ level: "industrial", opp: "static" })).toMatchObject({ levelId: "industrial", stillDummies: true });
    expect(parseMatch({ level: "industrial", opp: "medium" })).toMatchObject({ bot: "medium" });
    expect(parseMatch({ level: "island", bot: "easy" })).toMatchObject({ levelId: "island", bot: "easy" });
  });

  it("a bot only plays in the duel room or a new level", () => {
    expect(parseMatch({ level: "sandbox", bot: "easy" })).toMatchObject({ levelId: "duel", bot: "easy" });
  });
});
