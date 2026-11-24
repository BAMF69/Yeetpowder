// ---------------------------------------------------------------------------
// joinStatus.ts
// Purpose : What a guest sees while joining a browser-hosted room (ADR 0004), and when to give up. Before this a
//           join that could not connect said "Joining room ABCD..." forever (iPhone on home Wi-Fi, 2026-11-24: it
//           worked on mobile data; the router most likely keeps Wi-Fi devices from reaching each other).
// Usage   : const s = joinStage({ brokerOpen, ice, elapsedMs }); show s.text; if (s.failed) give up with s.text
// Notes   : No DOM, no PeerJS (Vitest runs it). `ice` is RTCPeerConnection.iceConnectionState, undefined before
//           the connection to the host exists.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------

/** A join that has not reached the host by now gives up with advice (a working one takes 1 to 5 s). */
export const JOIN_TIMEOUT_MS = 20_000;

export const SAME_WIFI_ADVICE =
  "Could not reach the host's game. On the same Wi-Fi, some routers keep devices apart: " +
  "turn Wi-Fi off on one device (mobile data), or try another network.";

export type JoinInfo = { brokerOpen: boolean; ice?: string; elapsedMs: number };
export type JoinStage = { text: string; failed: boolean };

/** The line under "Joining room ABCD..." and whether the join has failed. */
export function joinStage({ brokerOpen, ice, elapsedMs }: JoinInfo): JoinStage {
  if (ice === "failed") return { text: SAME_WIFI_ADVICE, failed: true };
  if (elapsedMs >= JOIN_TIMEOUT_MS) {
    return brokerOpen
      ? { text: SAME_WIFI_ADVICE, failed: true }
      : { text: "Could not reach the matchmaking service (check the internet connection).", failed: true };
  }
  if (!brokerOpen) return { text: "Reaching the matchmaking service...", failed: false };
  if (!ice || ice === "new") return { text: "Finding the host...", failed: false };
  if (ice === "checking") return { text: "Connecting to the host...", failed: false };
  if (ice === "disconnected") return { text: "Connection unsteady, retrying...", failed: false };
  return { text: "Connected, entering the room...", failed: false };
}
