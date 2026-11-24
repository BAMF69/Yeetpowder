// ---------------------------------------------------------------------------
// transport.ts
// Purpose : What DuelLink needs from a duel connection, whichever kind it is: the home duel server over a WebSocket
//           (netClient.ts, ADR 0002), or a browser-hosted room over WebRTC (peerLink.ts, ADR 0004: one player's tab
//           runs the room, the other connects by code). Same messages either way (src/net/protocol.ts).
// Usage   : const t: Transport = ...; t.send({ t: "create" }); each step t.queue(input); each frame t.flush()
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import type { ClientMsg, NetInput } from "../../net/protocol";

export type NetStatus = "connecting" | "open" | "closed";

export interface Transport {
  status: NetStatus;
  /** Last measured round trip (ms). */
  rtt: number;
  /** Why it closed or could not connect, in words for the player (empty while fine). */
  failReason: string;
  send(msg: ClientMsg): void;
  /** Queues one step's input; flush() sends the batch. */
  queue(input: NetInput): void;
  flush(): void;
  close(): void;
  /** While joining (a peer guest only): is the matchmaker answering, and the direct connection's ICE state. */
  joinProgress?(): { brokerOpen: boolean; ice?: string };
}
