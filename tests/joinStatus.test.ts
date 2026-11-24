// ---------------------------------------------------------------------------
// joinStatus.test.ts
// Purpose : A guest's join shows where it is and gives up with advice instead of hanging (src/net/joinStatus.ts;
//           iPhone on home Wi-Fi stuck at "Joining room", 2026-11-24).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { JOIN_TIMEOUT_MS, SAME_WIFI_ADVICE, joinStage } from "../src/net/joinStatus";

describe("joinStage", () => {
  it("walks through the steps while it is still in time", () => {
    expect(joinStage({ brokerOpen: false, elapsedMs: 0 })).toEqual({ text: "Reaching the matchmaking service...", failed: false });
    expect(joinStage({ brokerOpen: true, elapsedMs: 500 }).text).toBe("Finding the host...");
    expect(joinStage({ brokerOpen: true, ice: "checking", elapsedMs: 900 }).text).toBe("Connecting to the host...");
    expect(joinStage({ brokerOpen: true, ice: "connected", elapsedMs: 1200 }).failed).toBe(false);
  });

  it("fails at once when the direct connection fails, with the same-Wi-Fi advice", () => {
    expect(joinStage({ brokerOpen: true, ice: "failed", elapsedMs: 3000 })).toEqual({ text: SAME_WIFI_ADVICE, failed: true });
  });

  it("gives up after the timeout: the advice if the matchmaker answered, the internet if not", () => {
    expect(joinStage({ brokerOpen: true, ice: "checking", elapsedMs: JOIN_TIMEOUT_MS })).toEqual({ text: SAME_WIFI_ADVICE, failed: true });
    const offline = joinStage({ brokerOpen: false, elapsedMs: JOIN_TIMEOUT_MS });
    expect(offline.failed).toBe(true);
    expect(offline.text).toMatch(/internet/);
  });
});
