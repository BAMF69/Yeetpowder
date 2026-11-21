// ---------------------------------------------------------------------------
// sound.ts
// Purpose : Yeetpowder's sound effects: loads every file named in data/audio_events.json (rendered in code by
//           tools/audio/yeet_sounds.py) and plays events through the kit's AudioPlayer, which picks takes, pitch,
//           volume, voice limits and cooldowns (src/core/audioDirector.ts) and applies the player's volume sliders.
// Usage   : const snd = new YeetSound(); await snd.load(progress) in the world's load(); snd.resume() from a click;
//           snd.play("boom"); each frame snd.update(shell.settings.audio); snd.dispose() when the world closes.
// Notes   : Browsers keep audio suspended until a click or key press, so nothing plays before the first click
//           (plays while suspended are dropped, not queued: they would all fire at once on the click).
//           A missing or broken file fails the load loudly (the crash screen; dev.py smoke fails on it).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import eventsJson from "../../../data/audio_events.json";
import type { AudioSliders } from "../../core/audioAccess";
import { Log } from "../../core/log";
import { AudioPlayer, type EventsFile } from "../../shell/audioPlayer";

const EVENTS = eventsJson as unknown as EventsFile;
const AUDIO_ROOT = "assets/audio/"; // relative: works under itch.io and GitHub Pages subfolders

export class YeetSound {
  private ctx: AudioContext | null = null;
  private player: AudioPlayer | null = null;

  /** Fetches and decodes every sound file; progress(0..1) feeds the loading screen. */
  async load(progress: (v: number) => void = () => {}): Promise<void> {
    try {
      this.ctx = new AudioContext();
    } catch (err) {
      Log.warn("audio", `no Web Audio here, the game runs silent: ${String(err)}`);
      return;
    }
    const ctx = this.ctx;
    const files = [...new Set(Object.values(EVENTS.events).flatMap((e) => e.files))];
    const buffers: Record<string, AudioBuffer> = {};
    let done = 0;
    await Promise.all(files.map(async (f) => {
      const res = await fetch(AUDIO_ROOT + f);
      if (!res.ok) throw new Error(`sound ${AUDIO_ROOT + f}: HTTP ${res.status}`);
      buffers[f] = await ctx.decodeAudioData(await res.arrayBuffer());
      progress(++done / files.length);
    }));
    this.player = new AudioPlayer(ctx, EVENTS, buffers);
    Log.info("audio", `${files.length} sound files loaded, ${Object.keys(EVENTS.events).length} events`);
  }

  /** Call from a click or key press: browsers only start audio after one. */
  resume(): void {
    if (this.ctx && this.ctx.state !== "running") void this.ctx.resume();
  }

  play(name: string): void {
    if (!this.player || this.ctx?.state !== "running") return;
    this.player.play(name);
  }

  update(sliders: AudioSliders): void {
    if (!this.player) return;
    this.player.applySettings(sliders);
    this.player.update();
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.player = null;
  }
}
