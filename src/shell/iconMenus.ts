// ---------------------------------------------------------------------------
// iconMenus.ts
// Purpose : The icon-first front end (approved mockup docs/mockups/menu-redesign.html, Elaina 2026-11-26): the
//           six-choice home screen and its submenus. Home: PLAY · Party · Solo · Couch · Settings · Operator.
//           Party: Make · Join · Watch. Solo: Bots · Duel · Fight Back · Sandbox. Couch: 2 · 3 · 4 players.
//           Settings: Sound · Controls · Display · Access · Language · Credits. No screen offers more than six.
// Usage   : shell.reset(iconMenus.home(shell))   (screens.menu() forwards here)
// Notes   : Browser only (DOM). Built from menuKit.ts; every word goes through tl(). Room rules live in
//           src/net/roomSetup.ts (tested); starting a room is launch.ts (the old form's start logic, unchanged).
//           Every control has a stable data-item id for the browser helpers (tools/test_*_browser.mjs).
//           Text inputs stop key events bubbling (the shell reads keys globally), except Escape.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-26
// ---------------------------------------------------------------------------
import type { Screen, Shell } from "./app";
import { GAME_NAME } from "./meta";
import { icon, mapScene } from "./icons";
import { GridMenu, bar, chip, goButton, group, pick, pictureTile, stepper, tile, toggle } from "./menuKit";
import { el, tl, val } from "./ui";
import { launchRoom, type RoomKind } from "./launch";
import { settingsScreen } from "./settingsScreen";
import { TABS } from "./settingsScreen";
import { creditsScreen, title } from "./screens";
import { DEFAULT_DRAFT, GOAL, MAP_FAMILIES, MODES, familyAllowed, publicAllowed, settle, draftOptions, type Draft, type BotSkillPick } from "../net/roomSetup";
import { OPERATORS, playerProfile, type OperatorId } from "../net/profile";
import { localProfile, saveProfile } from "../game/playerProfile";
import { cleanCode } from "../net/protocol";

type Build = (root: HTMLElement, m: GridMenu, s: Screen) => void;

/** A full-window icon screen; render() rebuilds it and puts focus back on the same control. */
function mkScreen(id: string, build: Build, extra: Partial<Screen> = {}): Screen {
  const root = el("section", "screen mk");
  root.dataset.screen = id;
  const s: Screen = { id, root, ...extra };
  s.render = () => {
    const keep = s.menu?.focused?.id;
    root.replaceChildren();
    const m = new GridMenu();
    s.menu = m;
    build(root, m, s);
    if (!(keep && m.focusId(keep))) m.focusFirst();
  };
  s.render();
  return s;
}

/** Keeps typing in a text field from reaching the shell's global key handling (Escape still goes back). */
function typingGuard(root: HTMLElement): void {
  root.addEventListener("keydown", (e) => { if (e.key !== "Escape" && (e.target as HTMLElement).matches("input")) e.stopPropagation(); });
}

// ---- operators ------------------------------------------------------------------------------------------
export const OPERATOR_IDS = Object.keys(OPERATORS) as OperatorId[];
type Preview = { select(id: OperatorId): void; dispose(): void };

/** A live 3D portrait of an operator in host (the profile screen's renderer, loaded on demand). */
export function livePortrait(host: HTMLElement, op: OperatorId, noart: boolean, alive: () => boolean): { get(): Preview | undefined } {
  let preview: Preview | undefined;
  void import("../game/yeet/operatorPreview").then(({ operatorPreview }) => {
    if (alive()) preview = operatorPreview(host, op, noart);
  }).catch(() => { host.append(icon("person", "mk-icon")); }); // no WebGL: a plain figure, the choice still saves
  return { get: () => preview };
}

// ---- home -------------------------------------------------------------------------------------------------
export function home(shell: Shell): Screen {
  let portrait: { get(): Preview | undefined } | undefined;
  let open = true;
  const i = shell.i18n;
  const s = mkScreen("menu", (root, m) => {
    const logo = el("div", "mk-logo");
    logo.append(tl(i, "game.title", "mk-name", { name: GAME_NAME }), tl(i, "menu.tagline", "mk-tag"));
    const grid = el("div", "mk-grid mk-home");
    grid.append(
      tile(m, i, { id: "play", icon: "bolt", label: "mk.play", sub: "mk.play_sub", hero: true, accept: () => shell.push(quickScreen(shell)) }).el,
      tile(m, i, { id: "party", icon: "party", label: "mk.party", accept: () => shell.push(partyHub(shell)) }).el,
      tile(m, i, { id: "solo", icon: "bot", label: "mk.solo", accept: () => shell.push(soloHub(shell)) }).el,
      tile(m, i, { id: "couch", icon: "couch", label: "mk.couch", accept: () => shell.push(couchHub(shell)) }).el,
      tile(m, i, { id: "settings", icon: "gear", label: "mk.settings", accept: () => shell.push(settingsHub(shell)) }).el,
    );
    // the operator tile shows who you are now: a live portrait, the operator's name, your name
    const profile = localProfile();
    const op = tile(m, i, { id: "operator", label: "mk.operator", accept: () => shell.push(operatorScreen(shell)) });
    op.el.querySelector(".mk-word")!.classList.add("mk-hidden-label");
    const pic = el("div", "mk-portrait");
    op.el.prepend(pic);
    op.el.append(val(OPERATORS[profile.operator].name, "mk-opname", "operator.name"), val(profile.name, "mk-sub", "player.name"));
    grid.append(op.el);
    portrait?.get()?.dispose();
    portrait = livePortrait(pic, profile.operator, shell.params.has("noart"), () => open);
    root.append(logo, grid);
  }, {
    cancel: () => shell.reset(title(shell)),
    enter: () => { open = true; s.render?.(); }, // back from the operator screen: show the new pick
    leave: () => { open = false; portrait?.get()?.dispose(); portrait = undefined; },
  });
  return s;
}

// ---- hubs -------------------------------------------------------------------------------------------------
function hub(shell: Shell, id: string, heading: string, cols: string, tiles: Parameters<typeof tile>[2][]): Screen {
  return mkScreen(id, (root, m) => {
    const head = bar(m, shell.i18n, heading, () => shell.back());
    const grid = el("div", `mk-grid ${cols}`);
    for (const t of tiles) grid.append(tile(m, shell.i18n, t).el);
    root.append(head.el, grid);
  }, { cancel: () => shell.back() });
}

export function partyHub(shell: Shell): Screen {
  return hub(shell, "party", "mk.party", "mk-cols-3", [
    { id: "make", icon: "plus", label: "mk.make", sub: "mk.make_sub", accept: () => shell.push(roomSetup(shell, "create")) },
    { id: "join", icon: "door", label: "mk.join", sub: "mk.join_sub", accept: () => shell.push(joinScreen(shell, false)) },
    { id: "watch", icon: "eye", label: "mk.watch", sub: "mk.watch_sub", accept: () => shell.push(joinScreen(shell, true)) },
  ]);
}

export function soloHub(shell: Shell): Screen {
  const start = (option: string) => () => { shell.worldOption = option; shell.startGame("main"); };
  const tiles: Parameters<typeof tile>[2][] = [
    { id: "bots", icon: "bot", label: "mk.bots", sub: "mk.bots_sub", accept: () => shell.push(roomSetup(shell, "solo")) },
    { id: "duel", icon: "vs", label: "mk.duel", sub: "mk.duel_sub", accept: () => shell.push(duelSetup(shell)) },
    { id: "fight", icon: "target", label: "mk.fight", sub: "mk.fight_sub", accept: start("") },
    { id: "sandbox", icon: "cube", label: "mk.sandbox", sub: "mk.sandbox_sub", accept: start("sandbox") },
  ];
  if (shell.debugBuild) tiles.push({ id: "juice", icon: "star", label: "mk.juice", accept: () => shell.startGame("juice") });
  return hub(shell, "solo", "mk.solo", tiles.length > 4 ? "mk-cols-3 mk-rows-2" : "mk-cols-4", tiles);
}

export function couchHub(shell: Shell): Screen {
  return mkScreen("couch", (root, m) => {
    const head = bar(m, shell.i18n, "mk.couch", () => shell.back());
    const grid = el("div", "mk-grid mk-cols-3");
    for (const n of [2, 3, 4]) {
      const t = tile(m, shell.i18n, { id: `couch-${n}`, label: `mk.n${n}`, sub: "mk.split", accept: () => shell.push(roomSetup(shell, "couch", n)) });
      const pads = el("span", "mk-pads");
      for (let k = 0; k < n; k++) pads.append(icon("pad", "mk-icon mk-pad"));
      t.el.prepend(pads);
      t.el.querySelector(".mk-word")!.classList.add("mk-bignum");
      grid.append(t.el);
    }
    root.append(head.el, grid);
  }, { cancel: () => shell.back() });
}

export function settingsHub(shell: Shell): Screen {
  const tab = (name: (typeof TABS)[number]) => () => { shell.settingsTab = TABS.indexOf(name); shell.push(settingsScreen(shell)); };
  return hub(shell, "settings-hub", "mk.settings", "mk-cols-3 mk-rows-2", [
    { id: "sound", icon: "sound", label: "mk.sound", accept: tab("audio") },
    { id: "controls", icon: "pad", label: "mk.controls", accept: tab("controls") },
    { id: "display", icon: "screen", label: "mk.display", accept: tab("display") },
    { id: "access", icon: "access", label: "mk.access", accept: tab("access") },
    { id: "language", icon: "globe", label: "mk.language", accept: tab("language") },
    { id: "credits", icon: "info", label: "mk.credits", accept: () => shell.push(creditsScreen(shell)) },
  ]);
}

/** Offline duel against one bot: just how hard. */
export function duelSetup(shell: Shell): Screen {
  return hub(shell, "duel-bot", "mk.duel", "mk-cols-3", (["easy", "medium", "hard"] as const).map((skill) => ({
    id: `skill-${skill}`, icon: "bot", label: `mk.skill.${skill}`,
    accept: () => { shell.worldOption = `duel-bot-${skill}`; shell.startGame("main"); },
  })));
}

// ---- room setup (Make a room, Bots, Couch) ------------------------------------------------------------------
type SetupKind = "create" | "solo" | "couch";

export function roomSetup(shell: Shell, kind: SetupKind, couchPlayers = 2): Screen {
  const i = shell.i18n;
  let draft: Draft = kind === "solo" ? { ...DEFAULT_DRAFT, family: "coliseum", capacity: 6, botSkill: "mixed" }
    : kind === "couch" ? { ...DEFAULT_DRAFT, family: "coliseum" } : { ...DEFAULT_DRAFT };
  let keyboard = true;
  let status = "";
  const controller = new AbortController();
  let busy = false, handedOff = false;
  const titleKey = kind === "create" ? "mk.make_room" : kind === "solo" ? "mk.bots" : "mk.couch";

  const go = async () => {
    if (busy) return;
    busy = true; status = i.t("room.connecting"); s.render?.();
    const options = draftOptions(draft);
    const result = await launchRoom(shell, kind as RoomKind, { t: "create", options }, controller.signal,
      kind === "couch" ? { players: couchPlayers, keyboard } : undefined);
    if (result.ok) { handedOff = true; return; }
    busy = false; status = result.reason; s.render?.();
  };
  const change = (next: Partial<Draft>) => { draft = settle({ ...draft, ...next }); s.render?.(); };

  const s = mkScreen(`setup-${kind}`, (root, m) => {
    const head = bar(m, i, titleKey, () => shell.back());
    const goItem = goButton(m, i, "mk.go", "bolt", () => void go());
    goItem.el.classList.toggle("mk-off", busy);
    head.right.append(goItem.el);

    const layout = el("div", "mk-setup");
    // left: the map pictures
    const maps = group(i, "mk.map");
    const mapGrid = el("div", "mk-maps");
    const mapItems = MAP_FAMILIES.map((f) => {
      const it = pictureTile(m, i, `map-${f}`, mapScene(f), `mk.map.${f}`, () => {});
      it.el.classList.toggle("mk-off", !familyAllowed(f, draft.mode));
      mapGrid.append(it.el);
      return it;
    });
    pick(mapItems, MAP_FAMILIES.indexOf(draft.family), (k) => { if (MAP_FAMILIES[k] !== draft.family) change({ family: MAP_FAMILIES[k] }); });
    maps.append(mapGrid);

    // right: mode, then the counts, then the switches
    const opts = group(i, "mk.mode");
    const modes = el("div", "mk-chips");
    const modeIcons = { kills: "skull", lives: "heart", timed: "clock", ringout: "ring" } as const;
    const modeItems = MODES.map((mode) => { const it = chip(m, i, `mode-${mode}`, modeIcons[mode], `mk.mode.${mode}`); modes.append(it.el); return it; });
    pick(modeItems, MODES.indexOf(draft.mode), (k) => { if (MODES[k] !== draft.mode) change({ mode: MODES[k] }); });
    opts.append(modes);

    if (kind === "create") {
      opts.append(stepper(m, i, { id: "players", label: "mk.players", values: [2, 3, 4, 5, 6, 7, 8], value: draft.capacity, people: true,
        onChange: (v) => change({ capacity: v }) }).el);
    } else if (kind === "solo") {
      opts.append(stepper(m, i, { id: "opponents", label: "mk.bots", values: [1, 2, 3, 4, 5, 6, 7], value: draft.capacity - 1, icon: "bot", people: true,
        onChange: (v) => change({ capacity: v + 1 }) }).el);
    }
    const goal = GOAL[draft.mode];
    opts.append(stepper(m, i, { id: "goal", label: "mk.goal", values: goal.values, value: draft[goal.key], icon: goal.icon,
      onChange: (v) => change({ [goal.key]: v }) }).el);

    const switches = el("div", "mk-chips");
    if (kind === "create") {
      const vis = [chip(m, i, "vis-private", "lock", "mk.code"), chip(m, i, "vis-public", "globe", "mk.open")];
      vis[1].el.classList.toggle("mk-off", !publicAllowed(draft));
      pick(vis, draft.visibility === "public" ? 1 : 0, (k) => { const v = k ? "public" : "private"; if (v !== draft.visibility) change({ visibility: v }); });
      switches.append(vis[0].el, vis[1].el);
    }
    if (kind === "solo") {
      const skills: BotSkillPick[] = ["easy", "medium", "hard", "mixed"];
      const items = skills.map((k) => { const it = chip(m, i, `skill-${k}`, k === "mixed" ? "party" : "bot", `mk.skill.${k}`); switches.append(it.el); return it; });
      pick(items, skills.indexOf(draft.botSkill), (k) => { draft.botSkill = skills[k]; });
    } else {
      const bots = chip(m, i, "botfill", "bot", "mk.botfill");
      toggle(bots, draft.botFill, (on) => { if (on !== draft.botFill) change({ botFill: on }); });
      switches.append(bots.el);
    }
    if (kind === "couch") {
      const input = [chip(m, i, "input-keyboard", "keyboard", "mk.keyboard"), chip(m, i, "input-pads", "pad", "mk.pads")];
      pick(input, keyboard ? 0 : 1, (k) => { keyboard = k === 0; });
      switches.append(input[0].el, input[1].el);
      // couch capacity: just the players, or a full eight with bots
      draft.capacity = draft.botFill ? 8 : couchPlayers;
    }
    opts.append(switches);
    if (status) opts.append(val(status, "mk-status", "room.status"));
    layout.append(maps, opts);
    root.append(head.el, layout);
  }, {
    cancel: () => shell.back(),
    leave: () => { if (!handedOff) controller.abort(); },
  });
  return s;
}

// ---- join / watch -----------------------------------------------------------------------------------------
export function joinScreen(shell: Shell, spectate: boolean): Screen {
  const i = shell.i18n;
  const controller = new AbortController();
  let busy = false, handedOff = false, status = "";
  let code = cleanCode(shell.params.get("room") ?? "");
  const go = async () => {
    if (busy) return;
    if (code.length !== 4) { status = i.t("room.codeRequired"); s.render?.(); return; }
    busy = true; status = i.t("room.connecting"); s.render?.();
    const result = await launchRoom(shell, spectate ? "spectate" : "join", { t: "join", code, spectate }, controller.signal);
    if (result.ok) { handedOff = true; return; }
    busy = false; status = result.reason; s.render?.();
  };
  const s = mkScreen(spectate ? "watch" : "join", (root, m) => {
    const head = bar(m, i, spectate ? "mk.watch" : "mk.join", () => shell.back());
    const body = el("div", "mk-group");
    body.style.cssText = "flex:1;justify-content:center;align-items:center;gap:1.4em";
    const boxes = el("div", "mk-code");
    boxes.setAttribute("aria-label", i.t("mk.code_hint"));
    const inputs = [0, 1, 2, 3].map((k) => {
      const box = el("input");
      box.id = `code-${k}`; box.name = `code-${k}`; box.maxLength = 1; box.autocomplete = "off"; box.value = code[k] ?? "";
      box.setAttribute("aria-label", `${i.t("mk.code_hint")} ${k + 1}`);
      box.addEventListener("input", () => {
        const all = cleanCode(inputs.map((b) => b.value).join(""));
        code = all;
        inputs.forEach((b, n) => { b.value = all[n] ?? ""; });
        inputs[Math.min(all.length, 3)].focus();
        if (all.length === 4) void go();
      });
      box.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !box.value && k > 0) inputs[k - 1].focus(); if (e.key === "Enter") void go(); });
      boxes.append(box);
      return box;
    });
    const codeItem = m.add({ id: "code", el: boxes, accept: () => inputs[Math.min(code.length, 3)].focus() });
    codeItem.el.classList.add("mk-codeitem");
    const goItem = goButton(m, i, spectate ? "mk.watch" : "mk.join", spectate ? "eye" : "door", () => void go());
    body.append(boxes, goItem.el);
    if (status) body.append(val(status, "mk-status", "room.status"));
    root.append(head.el, body);
    queueMicrotask(() => { if (!busy && root.isConnected) inputs[Math.min(code.length, 3)].focus(); });
  }, {
    cancel: () => shell.back(),
    enter: () => { if (code.length === 4) void go(); },
    leave: () => { if (!handedOff) controller.abort(); },
  });
  typingGuard(s.root);
  return s;
}

// ---- PLAY: Quick Play ---------------------------------------------------------------------------------------
export function quickScreen(shell: Shell): Screen {
  const i = shell.i18n;
  const controller = new AbortController();
  let handedOff = false, status = i.t("room.connecting"), started = false;
  const s = mkScreen("quick", (root, m) => {
    const head = bar(m, i, "mk.find", () => shell.back());
    const body = el("div", "mk-group");
    body.style.cssText = "flex:1;justify-content:center;align-items:center;gap:1em";
    const seats = el("div", "mk-people mk-seats");
    for (let k = 0; k < 8; k++) seats.append(icon("person", "mk-person"));
    body.append(seats, tl(i, "mk.quick_status", "mk-status", {}, "div"), val(status, "mk-status", "room.status"));
    root.append(head.el, body);
  }, {
    cancel: () => shell.back(),
    enter: () => {
      if (started) return; started = true;
      void launchRoom(shell, "quick", { t: "quick" }, controller.signal).then((r) => {
        if (r.ok) { handedOff = true; return; }
        status = r.reason; s.render?.();
      });
    },
    leave: () => { if (!handedOff) controller.abort(); },
  });
  return s;
}

// ---- operator -------------------------------------------------------------------------------------------------
/** Pick an operator (arrows) and type a name; both save as you change them. */
export function operatorScreen(shell: Shell): Screen {
  const i = shell.i18n;
  let profile = localProfile();
  let open = true;
  let portrait: { get(): Preview | undefined } | undefined;
  const save = () => saveProfile(profile);
  const s = mkScreen("player-profile", (root, m) => {
    const head = bar(m, i, "mk.operator", () => shell.back());
    const stage = el("div", "mk-opstage");
    const prev = m.add({ id: "op-prev", el: el("div", "mk-arrow"), accept: () => step(-1) });
    prev.el.append(icon("back"), tl(i, "mk.prev", "mk-hidden-label"));
    const next = m.add({ id: "op-next", el: el("div", "mk-arrow"), accept: () => step(1) });
    next.el.append(icon("next"), tl(i, "mk.next", "mk-hidden-label"));
    const center = el("div", "mk-opcenter");
    const pic = el("div", "mk-portrait mk-bigportrait");
    const name = val(OPERATORS[profile.operator].name, "mk-opname", "operator.name");
    const dots = el("div", "mk-dots");
    const drawDots = () => dots.replaceChildren(...OPERATOR_IDS.map((id) => { const d = el("i"); if (id === profile.operator) d.className = "on"; return d; }));
    drawDots();
    const chipEl = el("label", "mk-namechip");
    const input = el("input");
    input.id = "player-name"; input.name = "playerName"; input.maxLength = 20; input.value = profile.name; input.setAttribute("autocomplete", "nickname");
    input.setAttribute("aria-label", i.t("mk.name"));
    input.addEventListener("input", () => { profile = playerProfile({ ...profile, name: input.value }); save(); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
    chipEl.append(input, icon("pencil"));
    m.add({ id: "name", el: chipEl, accept: () => input.focus() });
    center.append(pic, name, dots, chipEl);
    stage.append(prev.el, center, next.el);
    const step = (d: number) => {
      const k = (OPERATOR_IDS.indexOf(profile.operator) + d + OPERATOR_IDS.length) % OPERATOR_IDS.length;
      profile = { ...profile, operator: OPERATOR_IDS[k] }; save();
      name.textContent = OPERATORS[profile.operator].name; drawDots();
      portrait?.get()?.select(profile.operator);
    };
    // the d-pad's left/right on the portrait row changes the operator directly
    prev.left = next.left = () => step(-1); prev.right = next.right = () => step(1);
    portrait?.get()?.dispose();
    portrait = livePortrait(pic, profile.operator, shell.params.has("noart"), () => open);
    root.append(head.el, stage);
  }, {
    cancel: () => shell.back(),
    enter: () => { open = true; },
    leave: () => { open = false; portrait?.get()?.dispose(); portrait = undefined; },
  });
  typingGuard(s.root);
  return s;
}

// ---------------------------------------------------------------------------
// End of iconMenus.ts
// ---------------------------------------------------------------------------
