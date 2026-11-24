// ---------------------------------------------------------------------------
// matchSetup.ts
// Purpose : What a run is: which level and who you play against. The new levels let you pick (Elaina, 2026-11-24):
//           dummies that stand still, dummies that fight back, or an easy, medium or hard bot.
// Usage   : const m = parseMatch({ level: params.get("level"), world: shell.worldOption, bot: params.get("bot"),
//                                  opp: params.get("opp") })   -> { levelId, bot, stillDummies }
//           the menu's world option: "island" (fight back), "island:static", "island:bot-hard"; "duel-bot-easy"
//           (the duel room vs a bot); URL: ?level=island&opp=static|fight|easy|medium|hard (or ?bot=hard)
// Notes   : No DOM. A bot plays only in the duel room or the new levels (BOT_LEVELS); anywhere else asking for one
//           gives the duel room, as before.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { BOT_SKILLS, type BotSkill } from "./bot";
import { BOT_LEVELS, type LevelId } from "./levels";

export interface MatchSetup {
  levelId: string;
  /** A bot opponent (no dummies then), or null. */
  bot: BotSkill | null;
  /** The level's dummies stand still (they do not fight back). */
  stillDummies: boolean;
}

/** The opponent choices the new levels offer, in menu order (the world option's part after the colon). */
export const OPPONENTS = ["static", "fight", "bot-easy", "bot-medium", "bot-hard"] as const;
export type Opponent = (typeof OPPONENTS)[number];

const asSkill = (s: string | null | undefined): BotSkill | null => (BOT_SKILLS.includes(s as BotSkill) ? (s as BotSkill) : null);

export function parseMatch(p: { level?: string | null; world?: string | null; bot?: string | null; opp?: string | null }): MatchSetup {
  let id = p.level ?? p.world ?? "";
  let bot: BotSkill | null = null;
  let still = false;
  if (id.startsWith("duel-bot-")) {
    bot = asSkill(id.slice("duel-bot-".length));
    id = "duel";
  } else if (id.includes(":")) {
    const [lv, mode] = id.split(":");
    id = lv;
    if (mode === "static") still = true;
    else if (mode.startsWith("bot-")) bot = asSkill(mode.slice(4));
  }
  // URL overrides: ?opp=static|fight|easy|medium|hard, ?bot=<skill>
  if (p.opp === "static") still = true;
  else if (p.opp === "fight") still = false;
  else if (asSkill(p.opp)) bot = asSkill(p.opp);
  if (asSkill(p.bot)) bot = asSkill(p.bot);
  if (bot && !BOT_LEVELS.includes(id as LevelId)) id = "duel";
  return { levelId: id, bot, stillDummies: still && !bot };
}
