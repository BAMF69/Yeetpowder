// ---------------------------------------------------------------------------
// duelLink.ts
// Purpose : Everything the play world needs for an online duel, in one place: the connection, client prediction
//           (src/net/predict.ts), the other player's snapshot buffer (remote.ts), and the lobby screen ("Make a
//           room" / join by code, then the code and a link to share, then "Waiting for player 2...").
// Usage   : const link = new DuelLink(shell.params); world.sim = link.predictor.sim;
//           each fixed step: const events = link.stepLocal(input, dYaw, dPitch)
//           each frame: link.flush(); for (const e of link.takeServerEvents()) ...; link.remote.sample(...)
// Notes   : The server is the duel server on the page's own host (npm run duel serves both). ?room=ABCD joins at
//           once; ?lag=ms simulates a slow link. Your own predicted pvpHit/pvpDown are dropped: the server's are the
//           real ones. ?debug shows ping, snapshot rate and prediction corrections.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import type { TaggedEvent, YeetInput } from "../../core/yeet/sim";
import { cleanCode, DUEL_PORT, type ServerMsg, type Snapshot } from "../../net/protocol";
import { Predictor } from "../../net/predict";
import { NetClient } from "./netClient";
import { RemoteBuffer } from "./remote";

const CSS = `
.yd { position: fixed; inset: 0; z-index: 8; /* over the touch controls (6) and HUD (7): the lobby needs taps */ display: flex; align-items: center; justify-content: center;
  pointer-events: none; font-family: system-ui, "Segoe UI", sans-serif; color: #fff; }
.yd-panel { pointer-events: auto; background: rgba(20, 24, 34, 0.92); border: 3px solid #ffd84a; border-radius: 18px;
  padding: 22px 26px; min-width: 300px; max-width: 90vw; text-align: center; }
.yd-panel h2 { margin: 0 0 12px; font-size: 26px; }
.yd-panel button { font: inherit; font-weight: 800; font-size: 18px; padding: 10px 18px; margin: 6px; border-radius: 12px;
  border: 0; background: #ffd84a; color: #1b1b1b; cursor: pointer; }
.yd-panel input { font: inherit; font-size: 22px; width: 5.5em; text-align: center; letter-spacing: 4px; text-transform: uppercase;
  padding: 8px; border-radius: 10px; border: 2px solid #fff5; background: #0008; color: #fff; }
.yd-code { font-size: 44px; font-weight: 900; letter-spacing: 8px; color: #ffd84a; margin: 6px 0; }
.yd-link { font-size: 14px; word-break: break-all; opacity: 0.9; user-select: all; }
.yd-err { color: #ff8a80; min-height: 1.3em; margin-top: 8px; }
/* waiting for player 2: tucked in the top right (under the kill feed's row) so you can warm up with a clear view */
.yd.corner { align-items: flex-start; justify-content: flex-end; padding: 56px 14px 0 0; box-sizing: border-box; }
/* with touch controls the weapon slots fill the top middle: sit below them */
body.yt-touch .yd.corner { padding-top: 120px; }
.yd.corner .yd-panel { padding: 10px 14px; min-width: 0; max-width: min(320px, 46vw); text-align: left; }
.yd.corner h2 { font-size: 16px; margin: 0 0 2px; }
.yd.corner .yd-code { font-size: 28px; letter-spacing: 5px; margin: 0 0 4px; }
.yd.corner .yd-link { font-size: 12px; }
.yd.corner .yd-wait { font-size: 13px; margin-top: 6px; opacity: 0.85; }
.yd.corner .yd-err { min-height: 0; }
.yd-net { position: fixed; left: 50%; bottom: 8px; transform: translateX(-50%); z-index: 6; font: 12px monospace;
  background: rgba(0, 0, 0, 0.55); color: #cfd8dc; padding: 3px 8px; border-radius: 6px; pointer-events: none; }
`;

/**
 * The origin to put in the room link. Opened on the PC as localhost, the link would point a phone at itself, so it
 * swaps in the PC's home-network address that `npm run duel` hands Vite (VITE_LAN_HOST), keeping the port.
 */
/**
 * Where the duel server is. On an https page (`npm run duel` serves https for the gyro, ADR 0003) a plain ws://
 * socket is refused, so it goes through the page's own host and port at /duel-ws (Vite passes it on); on http it is
 * the duel server's own port on the same host, as before.
 */
function duelSocketUrl(): string {
  if (location.protocol === "https:") return `wss://${location.host}/duel-ws`;
  return `ws://${location.hostname || "localhost"}:${DUEL_PORT}`;
}

function shareOrigin(): string {
  const lan = import.meta.env.VITE_LAN_HOST as string | undefined;
  const local = ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname);
  return local && lan ? `${location.protocol}//${lan}${location.port ? ":" + location.port : ""}` : location.origin;
}

export class DuelLink {
  readonly predictor = new Predictor(0);
  readonly remote = new RemoteBuffer();
  slot = -1;
  code = "";
  present = [false, false];
  private readonly net: NetClient;
  private serverEvents: TaggedEvent[] = [];
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly panel: HTMLDivElement;
  private readonly netLine: HTMLDivElement | null;
  private snapTimes: number[] = [];
  private corrections: number[] = [];

  constructor(params: URLSearchParams) {
    this.net = new NetClient(duelSocketUrl(), Number(params.get("lag")) || 0, (m) => this.onMsg(m));
    this.style = document.createElement("style");
    this.style.textContent = CSS;
    document.head.append(this.style);
    this.root = document.createElement("div");
    this.root.className = "yd";
    this.panel = document.createElement("div");
    this.panel.className = "yd-panel";
    this.root.append(this.panel);
    document.body.append(this.root);
    this.netLine = params.has("debug") ? this.addNetLine() : null;
    const room = cleanCode(params.get("room") ?? "");
    if (room.length === 4) {
      this.showMessage("Joining room " + room + "...");
      this.whenOpen(() => this.net.send({ t: "join", code: room }));
    } else {
      this.showLobby();
    }
  }

  /** In a room and predicting. */
  get ready(): boolean {
    return this.slot >= 0;
  }

  /** Both players are here: the duel is on. */
  get full(): boolean {
    return this.present.every(Boolean);
  }

  /** Predicts one step of your input and queues it for the server; returns the step's events to play now. */
  stepLocal(input: YeetInput, dYaw: number, dPitch: number): TaggedEvent[] {
    if (!this.ready) return [];
    const { msg, events } = this.predictor.local(input, dYaw, dPitch);
    this.net.queue(msg);
    // only your own moves: the other player's (their landing, pickups, bonks) come from the server, and hits are its call
    return events.filter((e) => e.p === this.slot && e.type !== "pvpHit" && e.type !== "pvpDown");
  }

  /** Sends this frame's inputs and refreshes the debug line. */
  flush(): void {
    this.net.flush();
    if (this.netLine) {
      const now = performance.now();
      this.snapTimes = this.snapTimes.filter((t) => now - t < 1000);
      const worst = this.corrections.length ? Math.max(...this.corrections) : 0;
      this.netLine.textContent = `room ${this.code || "-"} · slot ${this.slot + 1} · ping ${Math.round(this.net.rtt)} ms · ` +
        `${this.snapTimes.length} snap/s · pending ${this.predictor.pending.length} · worst correction ${worst.toFixed(3)} m`;
      this.corrections = [];
    }
  }

  /** The server's events since the last call (every player's, the authoritative hits and knockouts). */
  takeServerEvents(): TaggedEvent[] {
    const e = this.serverEvents;
    this.serverEvents = [];
    return e;
  }

  dispose(): void {
    this.net.close();
    this.root.remove();
    this.netLine?.remove();
    this.style.remove();
  }

  // ---- messages -----------------------------------------------------------------
  private onMsg(m: ServerMsg): void {
    if (m.t === "error") {
      this.showLobby(m.reason);
    } else if (m.t === "joined") {
      this.slot = m.slot;
      this.code = m.code;
      this.predictor.setSlot(m.slot);
      this.showWaiting();
    } else if (m.t === "snap") {
      this.onSnapshot(m);
    }
  }

  private onSnapshot(s: Snapshot): void {
    if (!this.ready) return;
    const now = performance.now();
    this.snapTimes.push(now);
    this.corrections.push(this.predictor.onSnapshot(s));
    this.remote.push(now, s.state.players);
    this.serverEvents.push(...s.events);
    const wasFull = this.full;
    this.present = s.present;
    if (this.full !== wasFull) {
      if (this.full) this.root.style.display = "none";
      else this.showWaiting("The other player left.");
    }
  }

  // ---- lobby screens ------------------------------------------------------------
  private whenOpen(fn: () => void): void {
    const t = window.setInterval(() => {
      if (this.net.status === "open") {
        window.clearInterval(t);
        fn();
      } else if (this.net.status === "closed") {
        window.clearInterval(t);
        this.showLobby('Could not reach the duel server. Start it with "npm run duel" on the PC.');
      }
    }, 50);
  }

  private showLobby(error = ""): void {
    this.root.style.display = "flex";
    this.root.classList.remove("corner");
    this.panel.innerHTML = `<h2>Duel</h2>
      <div><button data-act="create">Make a room</button></div>
      <div style="margin-top:10px">or join: <input maxlength="4" placeholder="CODE" data-act="code"> <button data-act="join">Join</button></div>
      <div class="yd-err"></div>`;
    (this.panel.querySelector(".yd-err") as HTMLDivElement).textContent = error;
    const input = this.panel.querySelector("input") as HTMLInputElement;
    this.panel.querySelector('[data-act="create"]')!.addEventListener("click", () => {
      this.showMessage("Making a room...");
      this.whenOpen(() => this.net.send({ t: "create" }));
    });
    const join = () => {
      const code = cleanCode(input.value);
      if (code.length !== 4) return;
      this.showMessage("Joining room " + code + "...");
      this.whenOpen(() => this.net.send({ t: "join", code }));
    };
    this.panel.querySelector('[data-act="join"]')!.addEventListener("click", join);
    input.addEventListener("keydown", (e) => {
      e.stopPropagation(); // typing a code must not move the player or open the pause menu
      if (e.key === "Enter") join();
    });
  }

  private showMessage(text: string): void {
    this.root.style.display = "flex";
    this.root.classList.remove("corner");
    this.panel.innerHTML = "";
    const h = document.createElement("h2");
    h.textContent = text;
    this.panel.append(h);
  }

  private showWaiting(note = ""): void {
    this.root.style.display = "flex";
    this.root.classList.add("corner");
    const link = `${shareOrigin()}${location.pathname}?play&level=duel&room=${this.code}`;
    this.panel.innerHTML = `<h2>Room</h2><div class="yd-code"></div>
      <div class="yd-link"></div>
      <div class="yd-wait">Waiting for player 2... warm up meanwhile</div><div class="yd-err"></div>`;
    (this.panel.querySelector(".yd-code") as HTMLDivElement).textContent = this.code;
    (this.panel.querySelector(".yd-link") as HTMLDivElement).textContent = link;
    (this.panel.querySelector(".yd-err") as HTMLDivElement).textContent = note;
    this.root.style.pointerEvents = "none"; // you can click past it into the game while you wait
    this.panel.style.pointerEvents = "auto";
  }

  private addNetLine(): HTMLDivElement {
    const d = document.createElement("div");
    d.className = "yd-net";
    document.body.append(d);
    return d;
  }
}
