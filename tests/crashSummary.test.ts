// ---------------------------------------------------------------------------
// crashSummary.test.ts
// Purpose : The crash screen's text (src/core/userData.ts): a phone player cannot open the crash file, so the screen
//           must show the error in words, the top of its stack and the warnings logged just before it. A library
//           rejecting with a plain object must not show as "[object Object]" (iPhone duel crash, 2026-11-24).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { CRASH_SCREEN_STACK, CRASH_SCREEN_WARNINGS, crashSummary, describeReason } from "../src/core/userData";

describe("describeReason", () => {
  it("keeps an Error's name and message", () => {
    expect(describeReason(new TypeError("x is undefined"))).toBe("TypeError: x is undefined");
  });

  it("spells out a plain object's type and message instead of [object Object]", () => {
    expect(describeReason({ type: "webrtc", message: "Negotiation failed" })).toBe("Object webrtc: Negotiation failed");
  });

  it("names an object with no message by its fields", () => {
    expect(describeReason(Object.create(null))).toBe("{}");
    expect(describeReason({ code: 7 })).toBe("Object");
  });

  it("passes strings and numbers through", () => {
    expect(describeReason("boom")).toBe("boom");
    expect(describeReason(42)).toBe("42");
  });
});

describe("crashSummary", () => {
  const stack = ["TypeError: bad", "    at a (app.js:1:1)", "    at b (app.js:2:2)", "    at c (app.js:3:3)", "    at d (app.js:4:4)"].join("\n");
  const tail = ["[INFO][net] hi", "[WARN][net] guest: webrtc", "[DEBUG][x] y", "[ERROR][core] z", "[WARN][a] 1", "[WARN][a] 2", "[WARN][a] 3"];

  it("shows the error, the top of the stack (without repeating the error) and the last warnings", () => {
    const lines = crashSummary({ header: "Y 0.1", error: "TypeError: bad", stack, tail }).split("\n");
    expect(lines[0]).toBe("TypeError: bad");
    expect(lines.slice(1, 1 + CRASH_SCREEN_STACK)).toEqual(["at a (app.js:1:1)", "at b (app.js:2:2)", "at c (app.js:3:3)"]);
    const warn = lines.slice(2 + CRASH_SCREEN_STACK);
    expect(warn).toHaveLength(CRASH_SCREEN_WARNINGS);
    expect(warn[0]).toBe("[ERROR][core] z");
    expect(warn.at(-1)).toBe("[WARN][a] 3");
  });

  it("is just the error when there is no stack and nothing was warned", () => {
    expect(crashSummary({ header: "Y", error: "boom", tail: ["[INFO][x] fine"] })).toBe("boom");
  });
});
