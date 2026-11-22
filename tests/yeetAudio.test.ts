// ---------------------------------------------------------------------------
// yeetAudio.test.ts
// Purpose : The sound wiring cannot drift: every audio event the play world plays is in data/audio_events.json,
//           every file an event names exists under public/assets/audio, and the kit's audio director accepts the file.
//           Also: non-UI sounds carry captions, announcer lines are written and the dialogue build is current, and
//           the music loop is exactly its bars long.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AudioDirector } from "../src/core/audioDirector";
import dialogue from "../data/dialogue.json";
import built from "../data/dialogue/en.built.json";
import music from "../data/music.json";

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

describe("captions, announcer and music", () => {
  const ev = events.events as Record<string, { caption?: string; files: string[]; bus: string }>;

  it("every sound the world plays is captioned unless it is a UI click", () => {
    for (const m of world.matchAll(/sound\.play\("([a-z_]+)"\)/g)) {
      const e = ev[m[1]];
      if (e && e.bus !== "ui") expect(e.caption, `${m[1]} caption`).toBeTruthy();
    }
  });

  it("every announcer line the world calls is written, and the dialogue build is current", () => {
    const called = [...world.matchAll(/this\.announce\("([a-z_]+)"\)/g)].map((m) => `announcer.${m[1]}`);
    expect(called.length).toBeGreaterThan(3);
    const written = dialogue.lines.map((l) => l.id);
    for (const id of called) expect(written, id).toContain(id);
    const lines = built.lines as Record<string, { text: string }>;
    for (const l of dialogue.lines) expect(lines[l.id]?.text, `${l.id}: rebuild data/dialogue/en.built.json`).toBe(l.text);
    const captions = built.captions as Record<string, unknown>;
    for (const [name, e] of Object.entries(ev)) if (e.caption) expect(captions[name], `${name}: rebuild the dialogue`).toBeDefined();
  });

  it("the music loop is exactly its bars long", () => {
    const t = music.tracks.theme;
    const wav = readFileSync(`public/assets/audio/${t.stems.band}`);
    const rate = wav.readUInt32LE(24);
    let off = 12;
    let frames = 0;
    while (off < wav.length - 8) {
      const id = wav.toString("ascii", off, off + 4);
      const size = wav.readUInt32LE(off + 4);
      if (id === "data") frames = size / 2; // 16-bit mono
      off += 8 + size + (size % 2);
    }
    expect(rate).toBe(music.sample_rate);
    expect(Math.abs(frames - (t.bars * 4 * 60 * rate) / t.bpm)).toBeLessThan(2);
  });
});
