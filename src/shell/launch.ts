// ---------------------------------------------------------------------------
// launch.ts
// Purpose : Starts a match from a menu: offline solo rooms and couch games locally, Quick Play / Make / Join /
//           Watch through matchmaking. The connection completes before the game builds its arena.
// Usage   : const r = await launchRoom(shell, "create", { t: "create", options }, controller.signal)
//           if (!r.ok) show(r.reason)
// Notes   : The start logic of the old dropdown form (partyScreen.ts start()), moved here unchanged so the icon
//           screens (iconMenus.ts) and any deep link share one path. ?offline turns Quick Play into a local room.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-26
// ---------------------------------------------------------------------------
import type { Shell } from "./app";
import { connectParty, prepareParty, localParty } from "../game/net/partySession";
import { prepareCouch } from "../game/couchSetup";
import { roomOptions, type RoomOptions } from "../net/roomOptions";
import type { ClientMsg } from "../net/protocol";
import { Log } from "../core/log";

export type RoomKind = "quick" | "create" | "join" | "couch" | "spectate" | "solo";
export type LaunchResult = { ok: true } | { ok: false; reason: string };

export async function launchRoom(shell: Shell, kind: RoomKind, request: ClientMsg, signal: AbortSignal,
  couch?: { players: number; keyboard: boolean }): Promise<LaunchResult> {
  if (kind === "solo" && request.t === "create") {
    const session = localParty(roomOptions({ ...request.options, visibility: "private", botFill: true }) as RoomOptions);
    prepareParty(session);
    shell.worldOption = session.options.level; shell.startGame("main");
    return { ok: true };
  }
  if (kind === "couch" && request.t === "create" && couch) {
    const o = request.options ?? {};
    const options = roomOptions({ ...o, visibility: "private", capacity: o.botFill ? Math.max(couch.players, o.capacity ?? 8) : couch.players });
    prepareCouch({ options, players: couch.players, keyboard: couch.keyboard });
    shell.worldOption = "couch"; shell.startGame("main");
    return { ok: true };
  }
  try {
    const session = await connectParty(request, signal, shell.params.has("offline"));
    if (signal.aborted) { session.close(); return { ok: false, reason: "" }; }
    prepareParty(session);
    shell.worldOption = session.options.level;
    Log.info("net", `PARTY_JOINED ${session.code} slot=${session.slot} capacity=${session.options.capacity} mode=${session.options.mode}${session.offline ? " offline" : ""}`);
    shell.startGame("main");
    return { ok: true };
  } catch (error) {
    if (signal.aborted) return { ok: false, reason: "" };
    return { ok: false, reason: error instanceof Error ? error.message : shell.i18n.t("room.failed") };
  }
}

// ---------------------------------------------------------------------------
// End of launch.ts
// ---------------------------------------------------------------------------
