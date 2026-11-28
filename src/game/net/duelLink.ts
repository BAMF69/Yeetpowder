// ---------------------------------------------------------------------------
// duelLink.ts
// Purpose : Everything the play world needs for an online duel, in one place: the connection, client prediction
//           (src/net/predict.ts), the other player's snapshot buffer (remote.ts), and the lobby screen ("Make a
//           room" / join by code, then the code and a link to share, then "Waiting for player 2...").
// Usage   : const link = new DuelLink(shell.params); world.sim = link.predictor.sim;
//           each fixed step: const events = link.stepLocal(input, dYaw, dPitch)
//           each frame: link.flush(); for (const e of link.takeServerEvents()) ...; link.remote.sample(...)
// Notes   : Who runs the room (ADR 0004): by default the player who makes it, in their own browser tab, and the
//           other player connects to them over WebRTC (peerLink.ts) - no game server needed. ?net=server uses the
//           home duel server instead (npm run duel, ADR 0002; ?lag=ms simulates a slow link there). ?room=ABCD joins
//           at once. Your own predicted pvpHit/pvpDown are dropped: the server's are the
//           real ones. ?debug shows ping, snapshot rate and prediction corrections.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import type { BotSkill } from "../../core/yeet/bot";
import type { MatchStatus } from "../../net/roomOptions";
import type { PartySession } from "./partySession";
import { shell } from "../../shell/app";
import type { TaggedEvent, YeetInput } from "../../core/yeet/sim";
import { cleanCode, DUEL_PORT, type ClientMsg, type ServerMsg, type Snapshot } from "../../net/protocol";
import { PeerGuest, PeerHost } from "./peerLink";
import type { Transport } from "./transport";
import { Predictor } from "../../net/predict";
import { NetClient } from "./netClient";
import { RemoteBuffer } from "./remote";
import { roomQrSvg } from "./roomQr";
import { joinStage } from "../../net/joinStatus";
import { Log } from "../../core/log";
import type { ReplayClip } from "../../net/highlight";
import type { PlayerProfile } from "../../net/profile";

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
.yd-note { font-size: 13px; opacity: 0.8; margin-top: 4px; }
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
.yd-qr { width: 132px; height: 132px; margin: 6px 0 2px; border-radius: 4px; overflow: hidden; }
.yd-qr svg { display: block; width: 100%; height: 100%; }
body.yt-touch .yd-qr { width: 104px; height: 104px; }
.yd-net { position: fixed; left: 50%; bottom: 8px; transform: translateX(-50%); z-index: 6; font: 12px monospace;
  background: rgba(0, 0, 0, 0.55); color: #cfd8dc; padding: 3px 8px; border-radius: 6px; pointer-events: none; }
`;

/**
 * Where the duel server is. On an https page (`npm run duel` serves https for the gyro, ADR 0003) a plain ws://
 * socket is refused, so it goes through the page's own host and port at /duel-ws (Vite passes it on); on http it is
 * the duel server's own port on the same host, as before.
 */
function duelSocketUrl(): string {
  if (location.protocol === "https:") return `wss://${location.host}/duel-ws`;
  return `ws://${location.hostname || "localhost"}:${DUEL_PORT}`;
}

/**
 * The origin to put in the room link. Opened on the PC as localhost, the link would point a phone at itself, so it
 * swaps in the PC's home-network address that `npm run duel` hands Vite (VITE_LAN_HOST), keeping the port.
 */
function shareOrigin(): string {
  const lan = import.meta.env.VITE_LAN_HOST as string | undefined;
  const local = ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname);
  return local && lan ? `${location.protocol}//${lan}${location.port ? ":" + location.port : ""}` : location.origin;
}

export class DuelLink {
  readonly predictor: Predictor;
  readonly party: PartySession | null;
  active = [false, false];
  bots: (BotSkill | null)[] = [null, null];
  match: MatchStatus | null = null;
  profiles: PlayerProfile[] = [];
  replay: ReplayClip | null = null;
  onReplay: (() => void) | null = null;
  setReplayPlaying(playing: boolean): void { this.root.style.visibility = playing ? "hidden" : "visible"; }
  private owner = 0;
  private rosterStamp = "";
  private detailsOpen = false;
  private inviteOpen = false;
  private countdownLine: HTMLParagraphElement | null = null;
  private modeLine: HTMLDivElement | null = null;
  private readonly scoreDown = (e: KeyboardEvent) => { if (e.code === "Tab" && shell.top?.gameplay) { e.preventDefault(); this.detailsOpen = true; this.showParty(true); } };
  private readonly scoreUp = (e: KeyboardEvent) => { if (e.code === "Tab") { this.detailsOpen = false; this.showParty(true); } };
  readonly remote = new RemoteBuffer();
  slot = -1;
  code = "";
  present = [false, false];
  /** The connection, made when you host or join (the home server's at once with ?net=server). */
  private net: Transport | null = null;
  private readonly serverMode: boolean;
  private readonly lagMs: number;
  /** Told the player the connection dropped (once). */
  private lostShown = false;
  private serverEvents: TaggedEvent[] = [];
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly panel: HTMLDivElement;
  private readonly netLine: HTMLDivElement | null;
  private snapTimes: number[] = [];
  private corrections: number[] = [];

  /** The respawn screen is up: tuck the room card away (never the results, which need their buttons). */
  cover(on: boolean): void { if (this.match?.phase !== "finished") this.root.style.visibility = on ? "hidden" : ""; }

  /** Rename or swap operator mid-match (the respawn screen): the room sanitises it and every roster follows. */
  sendProfile(profile: PlayerProfile): void { this.net?.send({ t: "profile", profile }); }

  constructor(params: URLSearchParams, party: PartySession | null = null) {
    window.addEventListener("keydown", this.scoreDown); window.addEventListener("keyup", this.scoreUp);
    this.party = party;
    this.predictor = new Predictor(0, party?.options);
    this.serverMode = params.get("net") === "server";
    this.lagMs = Number(params.get("lag")) || 0;
    if (this.serverMode && !party) this.net = new NetClient(duelSocketUrl(), this.lagMs, (m) => this.onMsg(m));
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
    if (party) {
      this.net = party.transport; this.slot = party.slot; this.code = party.code;
      this.predictor.setSlot(party.slot);
      this.present = Array(party.options.capacity).fill(false);
      this.active = Array(party.options.capacity).fill(false);
      this.bots = Array(party.options.capacity).fill(null);
      party.subscribe((m) => this.onMsg(m));
      this.showParty();
      return;
    }
    const room = cleanCode(params.get("room") ?? "");
    if (room.length === 4) {
      this.showMessage("Joining room " + room + "...");
      this.whenOpen("guest", { t: "join", code: room });
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
    return this.party ? this.active.every(Boolean) : this.present.every(Boolean);
  }

  /** Predicts one step of your input and queues it for the server; returns the step's events to play now. */
  stepLocal(input: YeetInput, dYaw: number, dPitch: number): TaggedEvent[] {
    if (!this.ready || this.net?.status !== "open" || this.party && (this.match?.phase === "finished" || !this.active[this.slot])) return [];
    const { msg, events } = this.predictor.local(input, dYaw, dPitch);
    msg.round = this.party?.round ?? 1;
    this.net?.queue(msg);
    // only your own moves: the other player's (their landing, pickups, bonks) come from the server, and hits are its call
    return events.filter((e) => e.p === this.slot && e.type !== "pvpHit" && e.type !== "pvpDown");
  }

  /** Sends this frame's inputs and refreshes the debug line. */
  flush(): void {
    this.net?.flush();
    if (this.ready && this.net?.status === "closed" && !this.lostShown) {
      this.lostShown = true; // the host left, or the connection dropped: say so instead of freezing silently
      this.showMessage(this.net.failReason || "Connection lost.");
    }
    if (this.netLine) {
      const now = performance.now();
      this.snapTimes = this.snapTimes.filter((t) => now - t < 1000);
      const worst = this.corrections.length ? Math.max(...this.corrections) : 0;
      this.netLine.textContent = `room ${this.code || "-"} · slot ${this.slot + 1} · ping ${Math.round(this.net?.rtt ?? 0)} ms · ` +
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
    window.removeEventListener("keydown", this.scoreDown); window.removeEventListener("keyup", this.scoreUp);
    if (this.party) this.party.close(); else this.net?.close();
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
    this.profiles = s.profiles ?? [];
    this.bots = s.bots ?? s.present.map(() => null);
    this.active = s.active ?? s.present;
    const wasFinished = this.match?.phase === "finished";
    this.match = s.match ?? null;
    if (s.replay !== undefined) this.replay = s.replay;
    if (this.match?.phase !== "finished") this.replay = null;
    this.owner = s.owner ?? 0;
    if (this.party) {
      this.showParty();
      if (!wasFinished && this.match?.phase === "finished" && this.replay) this.onReplay?.();
      return;
    }
    if (this.full !== wasFull) {
      if (this.full) this.root.style.display = "none";
      else this.showWaiting("The other player left.");
    }
  }

  // ---- lobby screens ------------------------------------------------------------
  /**
   * Sends `msg` once the connection is up, making the connection first: you host the room in this tab, or join
   * someone else's (ADR 0004); with ?net=server both go to the home duel server.
   */
  private whenOpen(role: "host" | "guest", msg: ClientMsg): void {
    if (!this.serverMode) {
      const want = role === "host" ? PeerHost : PeerGuest;
      if (!(this.net instanceof want) || this.net.status === "closed") {
        this.net?.close();
        this.net = new want((m) => this.onMsg(m));
      }
    }
    const net = this.net!;
    const started = performance.now();
    let sent = false;
    const t = window.setInterval(() => {
      if (net !== this.net || this.ready) {
        window.clearInterval(t); // joined (or replaced by another try)
        return;
      }
      if (net.status === "closed") {
        window.clearInterval(t);
        this.showLobby(net.failReason || "Could not connect.");
        return;
      }
      if (net.status === "open" && !sent) {
        sent = true;
        net.send(msg);
      }
      if (!net.joinProgress) {
        if (sent) window.clearInterval(t); // the home server and the host answer at once
        return;
      }
      // a guest: say where the join is, and give up with advice instead of hanging (iPhone on home Wi-Fi)
      const stage = joinStage({ ...net.joinProgress(), elapsedMs: performance.now() - started });
      if (stage.failed) {
        window.clearInterval(t);
        Log.warn("net", `join gave up: ${stage.text} (${JSON.stringify(net.joinProgress())})`);
        net.close();
        this.net = null;
        this.showLobby(stage.text);
      } else {
        this.setSubline(stage.text);
      }
    }, 50);
  }

  /** The small line under a message ("Joining room ABCD..."): where the join is. */
  private setSubline(text: string): void {
    let line = this.panel.querySelector(".yd-note") as HTMLDivElement | null;
    if (!line) {
      line = document.createElement("div");
      line.className = "yd-note";
      this.panel.append(line);
    }
    if (line.textContent !== text) line.textContent = text;
  }

  private showLobby(error = ""): void {
    this.root.style.display = "flex";
    this.root.classList.remove("corner");
    this.panel.innerHTML = `<h2>Duel</h2>
      <div><button data-act="create">Host a room</button></div>
      <div class="yd-note">${this.serverMode ? "On the home duel server." : "Your game hosts it: keep this tab open and in front."}</div>
      <div style="margin-top:10px">or join: <input maxlength="4" placeholder="CODE" data-act="code"> <button data-act="join">Join</button></div>
      <div class="yd-err"></div>`;
    (this.panel.querySelector(".yd-err") as HTMLDivElement).textContent = error;
    const input = this.panel.querySelector("input") as HTMLInputElement;
    this.panel.querySelector('[data-act="create"]')!.addEventListener("click", () => {
      this.showMessage("Making a room...");
      this.whenOpen("host", { t: "create" });
    });
    const join = () => {
      const code = cleanCode(input.value);
      if (code.length !== 4) return;
      this.showMessage("Joining room " + code + "...");
      this.whenOpen("guest", { t: "join", code });
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
      <div class="yd-qr" title="Scan to join"></div><div class="yd-link"></div>
      <div class="yd-wait">Waiting for player 2... warm up meanwhile</div><div class="yd-err"></div>`;
    (this.panel.querySelector(".yd-code") as HTMLDivElement).textContent = this.code;
    (this.panel.querySelector(".yd-link") as HTMLDivElement).textContent = link;
    const qr = this.panel.querySelector(".yd-qr") as HTMLDivElement;
    qr.innerHTML = roomQrSvg(link); // made here from our own link text, never from a message
    if (!qr.innerHTML) qr.remove();
    (this.panel.querySelector(".yd-err") as HTMLDivElement).textContent = note;
    this.root.style.pointerEvents = "none"; // you can click past it into the game while you wait
    this.panel.style.pointerEvents = "auto";
  }

  private showParty(force = false): void {
    const party = this.party;
    if (!party) return;
    const humans = this.present.filter(Boolean).length;
    const bots = this.bots.filter(Boolean).length;
    const finished = this.match?.phase === "finished";
    const mode = { kills: "Deathmatch", lives: "Last player standing", timed: "Timed", ringout: "Ring Out · unlimited HP" }[party.options.mode];
    const modeText = `${mode} · ${this.match?.phase === "waiting" ? "Waiting for players" : party.options.mode === "timed" ? Math.ceil(this.match?.remaining ?? party.options.minutes * 60) + "s left" : party.options.mode === "lives" ? party.options.lives + " lives" : "First to " + party.options.scoreLimit}`;
    const countdownText = `Next match on a new map in ${Math.ceil(this.match?.nextRoundIn ?? 0)}s`;
    if (this.modeLine) this.modeLine.textContent = modeText;
    if (this.countdownLine) this.countdownLine.textContent = countdownText;
    // Clock ticks must preserve the buttons and keyboard focus, even on a slow renderer.
    const state = JSON.stringify([humans, bots, this.bots, this.match?.phase,
      this.predictor.sim.kos, this.match?.lives, this.detailsOpen, this.inviteOpen, this.owner, this.profiles]);
    if (!force && state === this.rosterStamp) return;
    this.rosterStamp = state;
    this.root.style.display = "flex";
    this.root.classList.toggle("corner", !finished);
    // Room controls stay usable after focus loss opens the shell's pause overlay (z-index 10).
    this.root.style.zIndex = finished ? "50" : "12";
    this.panel.replaceChildren();
    this.countdownLine = null;
    const title = document.createElement("h2");
    title.textContent = finished ? "Match complete" : `${party.offline ? "Offline" : "Room " + this.code} · ${humans} player${humans === 1 ? "" : "s"} + ${bots} bots`;
    this.panel.append(title);
    const note = document.createElement("div"); note.className = "yd-note"; this.modeLine = note;
    note.textContent = modeText;
    this.panel.append(note);
    if (finished) {
      const result = document.createElement("p");
      result.textContent = this.match!.winners.length === 1 ? `Winner: ${this.name(this.match!.winners[0])}` : "Draw";
      this.panel.append(result);
      if (this.match?.nextRoundIn !== undefined) { const countdown = document.createElement("p"); this.countdownLine = countdown; countdown.textContent = countdownText; this.panel.append(countdown); }
    }
    const button = (label: string, action: () => void) => {
      const b = document.createElement("button"); b.textContent = label; b.onclick = action; this.panel.append(b);
    };
    if (finished && this.replay) button("Yeet of the match", () => { shell.resumeGame(); this.onReplay?.(); });
    if (finished && party.options.visibility === "public") button("Next match · new map", () => { this.net?.send({ t: "next" }); shell.resumeGame(); });
    if (!finished) button(this.detailsOpen ? "Hide players" : "Players", () => { this.detailsOpen = !this.detailsOpen; this.showParty(true); });
    if (this.detailsOpen || finished) {
      this.predictor.sim.players.forEach((_, slot) => {
        if (!this.present[slot] && !this.bots[slot]) return;
        const row = document.createElement("div");
        row.textContent = `${this.name(slot)}${slot === this.slot ? " (you)" : ""} · ${this.predictor.sim.kos[slot]} KOs${party.options.mode === "lives" ? " · " + this.match?.lives[slot] + " lives" : ""}`;
        this.panel.append(row);
      });
    }
    if (!party.offline && !finished) {
      const url = new URL(location.pathname, shareOrigin());
      url.search = new URLSearchParams({ online: "1", room: this.code, level: party.options.level }).toString();
      button("Invite", () => {
        this.inviteOpen = !this.inviteOpen; this.showParty(true);
        void navigator.clipboard?.writeText(url.href).catch(() => {});
      });
      if (this.inviteOpen) {
        const link = document.createElement("div"); link.className = "yd-link"; link.textContent = url.href;
        const qr = document.createElement("div"); qr.className = "yd-qr"; qr.innerHTML = roomQrSvg(url.href);
        this.panel.append(link, qr);
      }
    }
    if (finished && this.slot === this.owner) button("Rematch", () => { this.net?.send({ t: "rematch" }); shell.resumeGame(); });
    if (finished) button("Back to menu", () => shell.quitToTitle());
    if (finished && document.pointerLockElement) void document.exitPointerLock();
  }

  name(slot: number): string {
    if (this.profiles[slot]) return this.profiles[slot].name;
    const skill = this.bots[slot];
    return skill ? `${skill === "easy" ? "Easy" : "Medium"} bot ${slot + 1}` : `Player ${slot + 1}`;
  }

  private addNetLine(): HTMLDivElement {
    const d = document.createElement("div");
    d.className = "yd-net";
    document.body.append(d);
    return d;
  }
}
