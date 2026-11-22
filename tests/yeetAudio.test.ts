// ---------------------------------------------------------------------------
// yeetAudio.test.ts
// Purpose : The sound wiring cannot drift: every audio event the play world plays is in data/audio_events.json,
//           every file an event names exists under public/assets/audio, and the kit's audio director accepts the file.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AudioDirector } from "../src/core/audioDirector";

const events = JSON.parse(readFileSync("data/audio_events.json", "utf-8"));
const world = readFileSync("src/game/YeetWorld.ts", "utf-8");

describe("Yeetpowder sounds", () => {
  it("every sound the world plays is an event in data/audio_events.json", () => {
    const played = new Set<string>();
    for (const m of world.matchAll(/sound\.play\("([a-z_]+)"\)/g)) played.add(m[1]);
    const fire = /FIRE_SOUND[^=]*=\s*\{([^}]*)\}/.exec(world);
    expect(fire).not.toBeNull();
    for (const m of fire![1].matchAll(/"([a-z_]+)"/g)) played.add(m[1]);
    expect(played.size).toBeGreaterThan(10);
    for (const name of played) expect(Object.keys(events.events), `event "${name}"`).toContain(name);
  });

  it("every file an event names exists", () => {
    for (const [name, ev] of Object.entries<{ files: string[] }>(events.events)) {
      for (const f of ev.files) expect(existsSync(`public/assets/audio/${f}`), `${name}: ${f}`).toBe(true);
    }
  });

  it("the kit's audio director accepts the events and plays each one", () => {
    const withLengths = Object.fromEntries(
      Object.entries<{ bus: string; files: string[] }>(events.events).map(([k, e]) => [k, { ...e, lengths_ms: e.files.map(() => 300) }]),
    );
    const dir = new AudioDirector({ seed: events.seed, events: withLengths, ducking: events.ducking });
    let t = 0;
    for (const name of Object.keys(events.events)) {
      t += 1000;
      expect(dir.play(name, t).result).toBe("played");
    }
  });
});
