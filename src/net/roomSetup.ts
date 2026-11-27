// ---------------------------------------------------------------------------
// roomSetup.ts
// Purpose : The rules behind the icon room-setup screens (Make a room, Bots, Couch): which map pictures and
//           modes can be picked together, what the "to win" stepper counts in each mode, and the RoomOptions a
//           finished pick turns into.
// Usage   : const d = { ...DEFAULT_DRAFT, family: "island", mode: "ringout" }; familyAllowed("coliseum", d.mode)
//           connectParty({ t: "create", options: draftOptions(d) }, ...)
// Notes   : No DOM (tested in tests/roomSetup.test.ts). roomOptions() still has the last word on every value;
//           these rules only grey out choices so the player never picks something that would be changed behind
//           their back. Replaces the old dropdown form's update() logic (partyScreen.ts).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-26
// ---------------------------------------------------------------------------
import type { LevelId } from "../core/yeet/levels";
import { roomOptions, type MatchMode, type RoomOptions } from "./roomOptions";

export const MAP_FAMILIES = ["coliseum", "island", "industrial", "junkyard"] as const;
export type MapFamily = (typeof MAP_FAMILIES)[number];
export const MODES: readonly MatchMode[] = ["kills", "lives", "timed", "ringout"];
export type BotSkillPick = "easy" | "medium" | "hard" | "mixed";

/** The stepper under the mode: what it counts and its stops. */
export const GOAL: Record<MatchMode, { key: "scoreLimit" | "lives" | "minutes"; values: readonly number[]; icon: string }> = {
  kills: { key: "scoreLimit", values: [5, 10, 15, 20, 30, 50], icon: "trophy" },
  ringout: { key: "scoreLimit", values: [5, 10, 15, 20, 30, 50], icon: "trophy" },
  lives: { key: "lives", values: [1, 3, 5, 10], icon: "heart" },
  timed: { key: "minutes", values: [1, 3, 5, 10, 15], icon: "clock" },
};

export interface Draft {
  family: MapFamily;
  mode: MatchMode;
  /** Seats in the room, you included (2–8). */
  capacity: number;
  scoreLimit: number;
  lives: number;
  minutes: number;
  visibility: "private" | "public";
  botFill: boolean;
  botSkill: BotSkillPick;
}

export const DEFAULT_DRAFT: Draft = { family: "industrial", mode: "kills", capacity: 8, scoreLimit: 10, lives: 5, minutes: 5,
  visibility: "private", botFill: true, botSkill: "mixed" };

/** The level a picture stands for: rooms over two seats need an eight-spawn layout. */
export function levelFor(family: MapFamily, capacity: number): LevelId {
  if (family === "coliseum") return "coliseum";
  return (capacity > 2 ? `${family}-party` : family) as LevelId;
}

/** Ring Out needs water to knock people into: only Shark Island has it. */
export function familyAllowed(family: MapFamily, mode: MatchMode): boolean {
  return mode !== "ringout" || family === "island";
}

/** Public rooms are Quick Play rooms: eight seats, bots filling gaps, no elimination. */
export function publicAllowed(d: Pick<Draft, "capacity" | "botFill" | "mode">): boolean {
  return d.capacity === 8 && d.botFill && d.mode !== "lives";
}

/** Brings a draft back inside the rules after one choice changed (the changed choice wins). */
export function settle(d: Draft): Draft {
  const out = { ...d };
  if (!familyAllowed(out.family, out.mode)) out.family = "island";
  if (!publicAllowed(out)) out.visibility = "private";
  return out;
}

export function draftOptions(d: Draft): RoomOptions {
  const s = settle(d);
  return roomOptions({ level: levelFor(s.family, s.capacity), capacity: s.capacity, mode: s.mode, scoreLimit: s.scoreLimit,
    lives: s.lives, minutes: s.minutes, visibility: s.visibility, botFill: s.botFill, botSkill: s.botSkill });
}

// ---------------------------------------------------------------------------
// End of roomSetup.ts
// ---------------------------------------------------------------------------
