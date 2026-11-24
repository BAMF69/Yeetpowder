// ---------------------------------------------------------------------------
// netClient.ts
// Purpose : The browser end of the duel connection (ADR 0002): a WebSocket to the duel server on the page's host,
//           inputs sent once per frame in a batch, a ping each second for the round-trip time, and an optional
//           simulated lag for testing (?lag=ms adds that delay each way).
// Usage   : const net = new NetClient(url, lagMs, (msg) => ...); net.send({ t: "create" }); net.queue(input);
//           each frame: net.flush();   net.rtt is the last ping time (ms); net.close() when leaving
// Notes   : WebSockets are reliable and ordered, so inputs are sent once (no resends). Messages that are not valid
//           JSON are ignored. DEBUG: ?debug logs the connection on the "net" channel.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { Log } from "../../core/log";
import type { ClientMsg, NetInput, ServerMsg } from "../../net/protocol";
import type { NetStatus, Transport } from "./transport";

export type { NetStatus } from "./transport";

/** The home duel server (npm run duel, ADR 0002) over a WebSocket; ?net=server picks it (ADR 0004). */
export class NetClient implements Transport {
  status: NetStatus = "connecting";
  failReason = "";
  /** Last measured round trip (ms), simulated lag included. */
  rtt = 0;
  private readonly ws: WebSocket;
  private outbox: NetInput[] = [];
  private readonly pinger: number;

  constructor(url: string, private readonly lagMs: number, private readonly onMsg: (m: ServerMsg) => void) {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.status = "open";
      Log.debug("net", `connected to ${url}`);
    };
    this.ws.onclose = () => {
      this.status = "closed";
      this.failReason ||= 'Could not reach the duel server. Start it with "npm run duel" on the PC.';
      Log.debug("net", "connection closed");
    };
    this.ws.onerror = () => Log.warn("net", `could not reach the duel server at ${url} (is "npm run duel" running?)`);
    this.ws.onmessage = (e) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(e.data)) as ServerMsg;
      } catch {
        return;
      }
      if (msg.t === "pong") {
        this.later(() => (this.rtt = performance.now() - msg.at));
        return;
      }
      this.later(() => this.onMsg(msg));
    };
    this.pinger = window.setInterval(() => this.send({ t: "ping", at: performance.now() }), 1000);
  }

  /** Runs fn now, or after the simulated lag. */
  private later(fn: () => void): void {
    if (this.lagMs > 0) window.setTimeout(fn, this.lagMs);
    else fn();
  }

  send(msg: ClientMsg): void {
    const data = JSON.stringify(msg);
    this.later(() => {
      if (this.ws.readyState === WebSocket.OPEN) this.ws.send(data);
    });
  }

  /** Queues one step's input; flush() sends the batch. */
  queue(input: NetInput): void {
    this.outbox.push(input);
  }

  flush(): void {
    if (!this.outbox.length || this.status !== "open") return;
    this.send({ t: "in", inputs: this.outbox });
    this.outbox = [];
  }

  close(): void {
    window.clearInterval(this.pinger);
    this.ws.close();
  }
}
