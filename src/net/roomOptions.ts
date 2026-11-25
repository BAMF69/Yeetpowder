// Shared, validated room settings. Quick Play's eight combatants are a rule, not a UI default.
import { levelById, type LevelId } from "../core/yeet/levels";
import { PARTY_LEVELS } from "../core/yeet/levelsParty";

export type MatchMode = "kills" | "lives" | "timed" | "ringout";
export interface RoomOptions {
  level: LevelId;
  capacity: number;
  visibility: "public" | "private";
  botFill: boolean;
  mode: MatchMode;
  scoreLimit: number;
  lives: number;
  minutes: number;
}
export const DEFAULT_ROOM: RoomOptions = { level: "industrial-party", capacity: 8, visibility: "private",
  botFill: true, mode: "kills", scoreLimit: 10, lives: 5, minutes: 5 };
const LEVELS: LevelId[] = ["duel", "island", "industrial", "junkyard", "coliseum", ...PARTY_LEVELS];
const integer = (v: unknown, fallback: number, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : fallback;

export function roomOptions(raw: Partial<RoomOptions> = {}): RoomOptions {
  const p = raw && typeof raw === "object" ? raw : {};
  const capacity = integer(p.capacity, DEFAULT_ROOM.capacity, 2, 8);
  let level = LEVELS.includes(p.level as LevelId) ? p.level! : DEFAULT_ROOM.level;
  if (capacity > 2 && level !== "coliseum" && !PARTY_LEVELS.includes(level as typeof PARTY_LEVELS[number])) {
    level = level === "island" ? "island-party" : level === "junkyard" ? "junkyard-party" : "industrial-party";
  }
  const mode: MatchMode = ["kills", "lives", "timed", "ringout"].includes(p.mode ?? "") ? p.mode! : "kills";
  const botFill = typeof p.botFill === "boolean" ? p.botFill : true;
  if (mode === "ringout" && !levelById(level).water) level = capacity > 2 ? "island-party" : "island";
  return { level, capacity, mode, visibility: p.visibility === "public" && capacity === 8 && botFill && mode !== "lives" ? "public" : "private",
    botFill,
    scoreLimit: integer(p.scoreLimit, 10, 1, 100), lives: integer(p.lives, 5, 1, 20), minutes: integer(p.minutes, 5, 1, 30) };
}

export function quickOptions(level: LevelId = "industrial-party"): RoomOptions {
  return roomOptions({ ...DEFAULT_ROOM, level, capacity: 8, visibility: "public", botFill: true, mode: "kills" });
}

export function roomLevel(options: RoomOptions) {
  const level = levelById(options.level);
  level.arena.dummySpawns = [];
  level.dummiesFight = false;
  level.infiniteHp = options.mode === "ringout";
  return level;
}

export interface MatchStatus {
  phase: "waiting" | "playing" | "finished";
  elapsed: number;
  remaining: number;
  lives: number[];
  winners: number[];
}
