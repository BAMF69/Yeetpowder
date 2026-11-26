// Transport-free public matchmaking. Private rooms can only be joined by code.
import { Room } from "./room";
import { makeCode } from "./protocol";
import { quickOptions, type RoomOptions } from "./roomOptions";
import { PARTY_LEVELS } from "../core/yeet/levelsParty";
const MATCH_LEVELS = [...PARTY_LEVELS, "coliseum"] as const;

export class RoomDirectory {
  readonly rooms = new Map<string, Room>();
  constructor(private readonly random = Math.random) {}

  create(options?: Partial<RoomOptions>): Room {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const code = makeCode(this.random);
      if (this.rooms.has(code)) continue;
      const room = new Room(code, options);
      this.rooms.set(code, room); return room;
    }
    throw new Error("No free room code");
  }

  quick(): Room {
    const matches = [...this.rooms.values()].filter((r) => r.options.visibility === "public" &&
      r.options.capacity === 8 && r.options.botFill && r.options.mode !== "lives" &&
      r.match.phase !== "finished" && !r.full && MATCH_LEVELS.includes(r.options.level as typeof MATCH_LEVELS[number]));
    matches.sort((a, b) => b.present.filter(Boolean).length - a.present.filter(Boolean).length);
    return matches[0] ?? this.create(quickOptions(MATCH_LEVELS[Math.floor(this.random() * MATCH_LEVELS.length)]));
  }
}
