// ---------------------------------------------------------------------------
// respawnScreen.ts
// Purpose : The respawn screen (mockup docs/mockups/menu-redesign.html, Elaina 2026-11-26): it comes up over the
//           live game while you are knocked out. Who got you, one big SPAWN ring (locked 10 s, then yours to press
//           until the 30 s auto-respawn), the scores, an operator carousel with the operator icons, your name, an
//           Auto-spawn toggle and Leave.
// Usage   : const rs = new RespawnScreen(host, { i18n, noart, onProfile, onLeave });
//           every frame: const press = rs.update(dead ? { downFor, killer, scores, goal } : null)  // true = SPAWN
// Notes   : DOM only, plus the operator preview (three) loaded on demand. Timing comes from core respawnView.ts;
//           the sim enforces the rule, so this only presses. Controls while it is up: Jump / Enter / a click on the
//           ring spawn, move left/right switch operator, Interact (E, pad Y) edits the name. Auto-spawn is
//           remembered per browser (try/catch: storage may be blocked). Debug: ?debug logs RESPAWN_* lines.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-26
// ---------------------------------------------------------------------------
import type { I18n } from "../core/i18n";
import { Log } from "../core/log";
import { TUNING } from "../core/yeet/tuning";
import { respawnView } from "../core/yeet/respawnView";
import { OPERATORS, playerProfile, type OperatorId, type PlayerProfile } from "../net/profile";
import { icon } from "../shell/icons";
import { OPERATOR_IDS } from "../shell/portrait";
import { operatorIcon } from "../shell/operatorIcons";
import { shell } from "../shell/app";
import { localProfile, saveProfile } from "./playerProfile";

const AUTO_KEY = "yeetpowder.autoSpawn";
const RING_R = 46; // the ring's radius in its 100x100 viewBox

export interface ScoreRow { name: string; score: number; me: boolean }
export interface DownState {
  /** Seconds since the knockout (sim.ts downFor). */
  downFor: number;
  killer: string;
  /** The killer's operator (their icon in the chip), when a player got you. */
  killerOperator?: OperatorId;
  scores: ScoreRow[];
  /** "First to 10" and the like, or "" */
  goal: string;
}

export interface RespawnOptions {
  i18n: I18n;
  noart: boolean;
  /** Your name or operator changed: tell the room (online) or the local world. */
  onProfile: (p: PlayerProfile) => void;
  onLeave: () => void;
}

function readAuto(): boolean { try { return localStorage.getItem(AUTO_KEY) === "1"; } catch { return false; } }
function writeAuto(on: boolean): void { try { localStorage.setItem(AUTO_KEY, on ? "1" : "0"); } catch { /* blocked: the toggle still works now */ } }

function div(cls: string, parent?: HTMLElement, text?: string): HTMLDivElement {
  const d = document.createElement("div");
  d.className = cls;
  if (text !== undefined) d.textContent = text;
  parent?.append(d);
  return d;
}

export class RespawnScreen {
  readonly root: HTMLDivElement;
  private open = false;
  private auto = readAuto();
  private pressed = false;
  private profile = localProfile();
  private readonly killer: HTMLElement;
  private readonly killerPic: HTMLElement;
  private shownKiller: string | undefined = "";
  private readonly ring: SVGCircleElement;
  private readonly spawnBtn: HTMLButtonElement;
  private readonly spawnLabel: HTMLElement;
  private readonly scores: HTMLElement;
  private readonly goal: HTMLElement;
  private readonly pic: HTMLElement;
  private readonly opName: HTMLElement;
  private readonly name: HTMLInputElement;
  private readonly autoBtn: HTMLButtonElement;
  private lastScores = "";

  constructor(host: HTMLElement, private readonly o: RespawnOptions) {
    const t = (k: string, a: Record<string, unknown> = {}) => o.i18n.t(k, a);
    this.root = div("rs");
    this.root.hidden = true;
    this.root.dataset.screen = "respawn";

    const top = div("rs-killer", this.root);
    this.killerPic = div("rs-killerpic", top);
    top.append(icon("gun", "rs-gun"));
    this.killer = div("rs-killername", top);
    div("rs-yeeted", top, t("mk.yeeted"));

    const main = div("rs-main", this.root);
    // left: scores
    const left = div("rs-side", main);
    this.scores = div("rs-scores", left);
    this.goal = div("rs-goal", left);
    // centre: the SPAWN ring
    this.spawnBtn = document.createElement("button");
    this.spawnBtn.className = "rs-spawn"; this.spawnBtn.type = "button"; this.spawnBtn.dataset.item = "spawn";
    this.spawnBtn.setAttribute("aria-label", t("mk.spawn"));
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg"); svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("class", "rs-ring");
    const track = document.createElementNS(ns, "circle");
    for (const c of [track]) { c.setAttribute("cx", "50"); c.setAttribute("cy", "50"); c.setAttribute("r", String(RING_R)); c.setAttribute("class", "rs-track"); }
    this.ring = document.createElementNS(ns, "circle");
    this.ring.setAttribute("cx", "50"); this.ring.setAttribute("cy", "50"); this.ring.setAttribute("r", String(RING_R));
    this.ring.setAttribute("class", "rs-arc"); this.ring.setAttribute("pathLength", "100");
    svg.append(track, this.ring);
    const face = div("rs-face");
    face.append(icon("respawn", "rs-icon"));
    div("rs-word", face, t("mk.spawn"));
    this.spawnLabel = div("rs-count", face);
    this.spawnBtn.append(svg, face);
    this.spawnBtn.addEventListener("click", () => { this.pressed = true; });
    main.append(this.spawnBtn);
    // right: operator carousel and name
    const right = div("rs-side", main);
    const car = div("rs-car", right);
    const prev = this.iconButton("back", t("mk.prev"), "op-prev", () => this.stepOperator(-1));
    this.pic = div("rs-portrait");
    const next = this.iconButton("next", t("mk.next"), "op-next", () => this.stepOperator(1));
    car.append(prev, this.pic, next);
    this.opName = div("rs-opname", right);
    const chip = document.createElement("label"); chip.className = "mk-namechip rs-name";
    this.name = document.createElement("input");
    this.name.id = "respawn-name"; this.name.name = "playerName"; this.name.maxLength = 20;
    this.name.setAttribute("aria-label", t("mk.name"));
    this.name.addEventListener("input", () => this.setProfile({ ...this.profile, name: this.name.value }, false));
    this.name.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" || e.key === "Escape") this.name.blur(); });
    chip.append(this.name, icon("pencil", "mk-icon"));
    right.append(chip);

    // bottom row: auto-spawn, control hints, leave
    const bottom = div("rs-bottom", this.root);
    this.autoBtn = this.iconButton("auto", t("mk.autospawn"), "auto", () => this.setAuto(!this.auto), true);
    this.autoBtn.classList.add("rs-toggle");
    const hints = div("rs-hints", bottom);
    for (const [keys, word] of [["Space · A", "mk.spawn"], ["A D · ◀ ▶", "mk.operator"], ["E · Y", "mk.name"]] as const) {
      const h = div("rs-hint", hints); div("rs-keys", h, keys); div("", h, t(word));
    }
    const leave = this.iconButton("door", t("mk.leave"), "leave", () => o.onLeave(), true);
    bottom.prepend(this.autoBtn); bottom.append(leave);
    this.setAuto(this.auto);
    host.append(this.root);
  }

  private iconButton(name: string, label: string, id: string, onClick: () => void, withWord = false): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button"; b.className = "rs-btn"; b.dataset.item = id;
    b.setAttribute("aria-label", label);
    b.append(icon(name, "rs-btnicon"));
    if (withWord) div("rs-btnword", b, label);
    b.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
    return b;
  }

  private setAuto(on: boolean): void {
    this.auto = on; writeAuto(on);
    this.autoBtn.setAttribute("aria-pressed", String(on));
  }

  private stepOperator(d: number): void {
    const k = (OPERATOR_IDS.indexOf(this.profile.operator) + d + OPERATOR_IDS.length) % OPERATOR_IDS.length;
    this.setProfile({ ...this.profile, operator: OPERATOR_IDS[k] }, true);
  }

  private setProfile(p: PlayerProfile, redrawName: boolean): void {
    this.profile = playerProfile(p);
    saveProfile(this.profile);
    this.opName.textContent = OPERATORS[this.profile.operator].name;
    if (redrawName) this.name.value = this.profile.name;
    this.pic.replaceChildren(operatorIcon(this.profile.operator));
    Log.debug("ui", `RESPAWN_PROFILE ${this.profile.operator} "${this.profile.name}"`);
    this.o.onProfile(this.profile);
  }

  /** Call every frame with the down state (null while alive). Returns true when SPAWN should be pressed. */
  update(state: DownState | null): boolean {
    if (!state) { if (this.open) this.close(); return false; }
    if (!this.open) this.show();
    const v = respawnView(state.downFor, TUNING.player, this.auto);
    this.killer.textContent = state.killer;
    this.killer.hidden = !state.killer; // a fall or the shark: no name, just "yeeted you"
    if (state.killerOperator !== this.shownKiller) {
      this.shownKiller = state.killerOperator;
      this.killerPic.replaceChildren(...(state.killerOperator ? [operatorIcon(state.killerOperator)] : []));
    }
    this.spawnBtn.classList.toggle("ready", !v.locked);
    this.spawnBtn.disabled = v.locked;
    this.ring.setAttribute("stroke-dasharray", `${(v.ring * 100).toFixed(1)} 100`);
    this.spawnLabel.textContent = v.locked ? String(v.seconds) : this.o.i18n.t("mk.auto_in", { n: v.seconds });
    const rows = JSON.stringify(state.scores);
    if (rows !== this.lastScores) {
      this.lastScores = rows;
      this.scores.replaceChildren(...state.scores.map((r) => { const row = div(r.me ? "rs-row me" : "rs-row"); div("", row, r.name); div("rs-score", row, String(r.score)); return row; }));
    }
    this.goal.textContent = state.goal;
    // controls (the name field has the keyboard while it is focused)
    if (document.activeElement !== this.name) {
      const input = shell.input;
      if (input.takePress("move_left")) this.stepOperator(-1);
      if (input.takePress("move_right")) this.stepOperator(1);
      if (input.takePress("interact")) { this.name.focus(); this.name.select(); }
      if (input.takePress("jump") || input.takePress("ui_accept")) this.pressed = true;
    }
    const press = (this.pressed && !v.locked) || v.spawnNow;
    if (this.pressed && v.locked) this.pressed = false; // too early: forget it (the ring shows why)
    if (press) { this.pressed = false; Log.debug("ui", `RESPAWN_PRESS at ${state.downFor.toFixed(1)}s${v.spawnNow ? " (auto)" : ""}`); }
    return press;
  }

  get visible(): boolean { return this.open; }

  private show(): void {
    this.open = true;
    this.root.hidden = false;
    this.profile = localProfile();
    this.name.value = this.profile.name;
    this.opName.textContent = OPERATORS[this.profile.operator].name;
    this.pressed = false;
    this.pic.replaceChildren(operatorIcon(this.profile.operator));
    Log.debug("ui", "RESPAWN_OPEN");
  }

  private close(): void {
    this.open = false;
    this.root.hidden = true;
    this.name.blur();
    Log.debug("ui", "RESPAWN_CLOSE");
  }

  dispose(): void {
    this.close();
    this.root.remove();
  }
}

// ---------------------------------------------------------------------------
// End of respawnScreen.ts
// ---------------------------------------------------------------------------

/**
 * Couch split-screen: a compact respawn badge in one player's quarter of the screen (no mouse, no keyboard
 * per player). The ring and count are the same as the full screen; A spawns and LB / RB switch operator,
 * handled by ArenaWorld through that player's pad.
 */
export class CouchRespawnBadge {
  readonly root = div("rs-couch");
  private readonly ring: SVGCircleElement;
  private readonly count: HTMLElement;
  private readonly killer: HTMLElement;
  private readonly op: HTMLElement;
  private readonly opPic: HTMLElement;
  private shownOp = "";
  private readonly face: HTMLElement;

  constructor(parent: HTMLElement, private readonly i18n: I18n) {
    this.root.hidden = true;
    this.killer = div("rs-yeeted", this.root);
    const ns = "http://www.w3.org/2000/svg";
    const wrap = div("rs-couchring", this.root);
    const svg = document.createElementNS(ns, "svg"); svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("class", "rs-ring");
    const track = document.createElementNS(ns, "circle");
    this.ring = document.createElementNS(ns, "circle");
    for (const c of [track, this.ring]) { c.setAttribute("cx", "50"); c.setAttribute("cy", "50"); c.setAttribute("r", String(RING_R)); }
    track.setAttribute("class", "rs-track"); this.ring.setAttribute("class", "rs-arc"); this.ring.setAttribute("pathLength", "100");
    svg.append(track, this.ring);
    this.face = div("rs-face");
    div("rs-word", this.face, i18n.t("mk.spawn"));
    this.count = div("rs-count", this.face);
    wrap.append(svg, this.face);
    this.opPic = div("rs-couchpic", this.root);
    this.op = div("rs-opname", this.root);
    div("rs-hints rs-couchhint", this.root, `A · ${i18n.t("mk.spawn")}   LB RB · ${i18n.t("mk.operator")}`);
    parent.append(this.root);
  }

  update(state: { downFor: number; killer: string; operator: OperatorId } | null): void {
    this.root.hidden = !state;
    if (!state) return;
    const v = respawnView(state.downFor, TUNING.player, false);
    this.root.classList.toggle("ready", !v.locked);
    this.ring.setAttribute("stroke-dasharray", `${(v.ring * 100).toFixed(1)} 100`);
    this.count.textContent = v.locked ? String(v.seconds) : this.i18n.t("mk.auto_in", { n: v.seconds });
    this.killer.textContent = state.killer ? `${state.killer} · ${this.i18n.t("mk.yeeted")}` : this.i18n.t("mk.yeeted");
    this.op.textContent = `◀ ${OPERATORS[state.operator].name} ▶`;
    if (state.operator !== this.shownOp) { this.shownOp = state.operator; this.opPic.replaceChildren(operatorIcon(state.operator)); }
  }
}
