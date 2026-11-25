// Native labelled controls for room setup; connection completes before the game constructs its arena.
import type { Screen, Shell } from "./app";
import { connectParty, prepareParty, localParty } from "../game/net/partySession";
import { cleanCode, type ClientMsg } from "../net/protocol";
import { DEFAULT_ROOM, roomOptions, type MatchMode, type RoomOptions } from "../net/roomOptions";
import type { LevelId } from "../core/yeet/levels";
import { Log } from "../core/log";
import { prepareCouch } from "../game/couchSetup";

export function partyScreen(shell: Shell, kind: "quick" | "create" | "join" | "couch" | "spectate" | "solo", level?: LevelId): Screen {
  const root = document.createElement("section"); root.className = "screen dim"; root.dataset.screen = "party-room";
  const panel = document.createElement("form"); panel.className = "panel narrow";
  panel.style.cssText = "display:flex;flex-direction:column;gap:10px;max-height:85vh;overflow:auto;min-width:min(360px,85vw)";
  root.append(panel);
  const t = (key: string) => shell.i18n.t(key);
  const heading = document.createElement("h2"); heading.className = "heading"; heading.textContent = t(`room.${kind}`); panel.append(heading);
  const controller = new AbortController();
  let busy = false, handedOff = false;
  const fields: Record<string, HTMLSelectElement | HTMLInputElement> = {};
  const addSelect = (name: string, values: [string, string][], value: string) => {
    const label = document.createElement("label"); label.textContent = t(`room.${name}`); label.style.display = "grid";
    const select = document.createElement("select"); select.name = name; select.style.cssText = "font:inherit;padding:8px;background:#182332;color:white;border:1px solid #7b8798;border-radius:6px";
    for (const [v, text] of values) { const option = document.createElement("option"); option.value = v; option.textContent = text; select.append(option); }
    select.value = value; label.append(select); panel.append(label); fields[name] = select;
    return select;
  };
  if (kind === "create" || kind === "couch" || kind === "solo") {
    const mapIds: LevelId[] = ["coliseum", "island-party", "industrial-party", "junkyard-party", "duel", "island", "industrial", "junkyard"];
    addSelect("level", mapIds.map((id) => [id, id === "duel" ? t("menu.duel") : t(`level.${id}`)]), DEFAULT_ROOM.level);
    if (kind === "couch") {
      fields.level.value = "coliseum";
      addSelect("players", [2, 3, 4].map((n) => [String(n), String(n)]), "2");
      addSelect("keyboard", [["yes", t("room.keyboardMouse")], ["no", t("room.allGamepads")]], "yes");
    }
    addSelect("capacity", Array.from({ length: 7 }, (_, i) => [String(i + 2), String(i + 2)]), "8");
    if (kind === "solo") {
      fields.level.value = level ?? "coliseum";
      fields.capacity.parentElement!.style.display = "none";
      addSelect("opponents", [1, 2, 3, 4, 5, 6, 7].map((n) => [String(n), String(n)]), "7");
      addSelect("botSkill", [["mixed", "Easy / medium mix"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]], "mixed");
    }
    addSelect("mode", (["kills", "lives", "timed", "ringout"] as MatchMode[]).map((v) => [v, t(`room.mode.${v}`)]), "kills");
    addSelect("scoreLimit", [5, 10, 15, 20, 30, 50].map((v) => [String(v), String(v)]), "10");
    addSelect("lives", [1, 3, 5, 10].map((v) => [String(v), String(v)]), "5");
    addSelect("minutes", [1, 3, 5, 10, 15].map((v) => [String(v), String(v)]), "5");
    addSelect("visibility", [["private", t("room.private")], ["public", t("room.public")]], "private");
    addSelect("botFill", [["yes", t("room.botsOn")], ["no", t("room.botsOff")]], "yes");
    const update = () => {
      if (kind === "solo") { fields.capacity.value = String(Number(fields.opponents.value) + 1); fields.visibility.value = "private"; fields.botFill.value = "yes";
        fields.visibility.parentElement!.style.display = fields.botFill.parentElement!.style.display = "none"; }
      const mode = fields.mode.value;
      fields.scoreLimit.parentElement!.style.display = mode === "lives" || mode === "timed" ? "none" : "grid";
      fields.lives.parentElement!.style.display = mode !== "lives" ? "none" : "grid";
      fields.minutes.parentElement!.style.display = mode !== "timed" ? "none" : "grid";
      const capacity = Number(fields.capacity.value);
      const visibility = fields.visibility as HTMLSelectElement;
      if (kind === "couch") { visibility.value = "private"; visibility.parentElement!.style.display = "none"; }
      visibility.options[1].disabled = capacity !== 8 || fields.botFill.value !== "yes" || mode === "lives";
      if (visibility.selectedOptions[0]?.disabled) visibility.value = "private";
      const select = fields.level as HTMLSelectElement;
      for (const option of select.options) option.disabled = (capacity > 2 && option.value !== "coliseum" && !option.value.endsWith("-party")) || (mode === "ringout" && !option.value.startsWith("island"));
      if (select.selectedOptions[0]?.disabled) select.value = mode === "ringout" ? "island-party" : "industrial-party";
    };
    panel.addEventListener("change", update); update();
  } else if (kind === "join" || kind === "spectate") {
    const label = document.createElement("label"); label.textContent = t("room.code");
    const code = document.createElement("input"); code.name = "code"; code.maxLength = 4; code.autocomplete = "off";
    code.style.cssText = "font:inherit;padding:10px;text-transform:uppercase;width:7em;margin-left:12px";
    code.value = cleanCode(shell.params.get("room") ?? ""); label.append(code); panel.append(label); fields.code = code;
  }
  const status = document.createElement("p"); status.setAttribute("role", "status"); status.style.whiteSpace = "normal";
  status.textContent = kind === "quick" ? t("room.quickHelp") : kind === "couch" ? t("room.couchHelp") : kind === "spectate" ? t("room.spectateHelp") : t("room.help"); panel.append(status);
  const submit = document.createElement("button"); submit.type = "submit"; submit.textContent = t(`room.${kind}`); submit.style.cssText = "font:inherit;padding:12px;background:#ffd84a;border:0;border-radius:8px;font-weight:bold";
  panel.append(submit);
  const back = document.createElement("button"); back.type = "button"; back.textContent = t("credits.back"); back.style.cssText = "font:inherit;padding:10px";
  back.onclick = () => shell.back(); panel.append(back);
  root.addEventListener("keydown", (event) => { if (event.key !== "Escape") event.stopPropagation(); });

  async function start(): Promise<void> {
    if (busy) return;
    let request: ClientMsg;
    if (kind === "quick") request = { t: "quick" };
    else if (kind === "join" || kind === "spectate") {
      const code = cleanCode(fields.code.value);
      if (code.length !== 4) { status.textContent = t("room.codeRequired"); return; }
      request = { t: "join", code, spectate: kind === "spectate" };
    } else {
      const options = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key,
        ["capacity", "scoreLimit", "lives", "minutes"].includes(key) ? Number(input.value) : key === "botFill" ? input.value === "yes" : input.value]));
      request = { t: "create", options: roomOptions(options as Partial<RoomOptions>) };
      if (kind === "solo") {
        const session = localParty(request.options as RoomOptions); prepareParty(session); handedOff = true;
        shell.worldOption = session.options.level; shell.startGame("main"); return;
      }
      if (kind === "couch") {
        const players = Number(fields.players.value);
        const config = roomOptions({ ...request.options, visibility: "private", capacity: request.options?.botFill ? Math.max(players, Number(fields.capacity.value)) : players });
        prepareCouch({ options: config, players, keyboard: fields.keyboard.value === "yes" });
        handedOff = true; shell.worldOption = "couch"; shell.startGame("main"); return;
      }
    }
    busy = true; submit.disabled = true; status.textContent = t("room.connecting");
    for (const input of Object.values(fields)) input.disabled = true;
    try {
      const session = await connectParty(request, controller.signal, shell.params.has("offline"));
      if (controller.signal.aborted) { session.close(); return; }
      handedOff = true; prepareParty(session);
      shell.worldOption = session.options.level;
      Log.info("net", `PARTY_JOINED ${session.code} slot=${session.slot} capacity=${session.options.capacity} mode=${session.options.mode}${session.offline ? " offline" : ""}`);
      shell.startGame("main");
    } catch (error) {
      if (controller.signal.aborted) return;
      status.textContent = error instanceof Error ? error.message : t("room.failed");
      busy = false; submit.disabled = false;
      for (const input of Object.values(fields)) input.disabled = false;
    }
  }
  panel.onsubmit = (event) => { event.preventDefault(); void start(); };
  let entered = false;
  return { id: "party-room", root, cancel: () => shell.back(),
    enter: () => {
      if (entered) return; entered = true;
      if (kind === "quick" || ((kind === "join" || kind === "spectate") && fields.code.value.length === 4)) void start();
      else (fields.code ?? fields.level ?? submit).focus();
    }, leave: () => { if (!handedOff) controller.abort(); } };
}
