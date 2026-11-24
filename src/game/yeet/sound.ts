// ---------------------------------------------------------------------------
// sound.ts
// Purpose : Yeetpowder's sound: loads every file named in data/audio_events.json (rendered in code by
//           tools/audio/yeet_sounds.py and crowd.py) and plays events through the kit's AudioPlayer, which picks
//           takes, pitch, volume, voice limits and cooldowns (src/core/audioDirector.ts) and applies the player's
//           volume sliders; and the match music (data/music.json, tools/audio/yeet_music.py) through the kit's
//           MusicPlayer on the music bus, so the music slider and dialogue ducking apply to it.
// Usage   : const snd = new YeetSound(); await snd.load(progress) in the world's load(); snd.resume() from a click;
//           snd.play("boom"); each frame snd.update(shell.settings.audio); snd.dispose() when the world closes.
//           The music starts with the first resume() (a click) and loops.
// Notes   : Browsers keep audio suspended until a click or key press, so nothing plays before the first click
//           (plays while suspended are dropped, not queued: they would all fire at once on the click).
//           A missing or broken file fails the load loudly (the crash screen; dev.py smoke fails on it).
//           music.json declares its WAV's own rate (22050, for the validator); decoding resamples to the context, so
//           the player is given the context's rate: bar points come from the tempo and are right at any rate.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import eventsJson from "../../../data/audio_events.json";
import type { AudioSliders } from "../../core/audioAccess";
import { Log } from "../../core/log";
import musicJson from "../../../data/music.json";
import type { MusicFile } from "../../core/musicDirector";
import { AudioPlayer, type EventsFile } from "../../shell/audioPlayer";
import { MusicPlayer } from "../../shell/musicPlayer";
import { shell } from "../../shell/app";

const EVENTS = eventsJson as unknown as EventsFile;
const MUSIC = musicJson as unknown as MusicFile;
const AUDIO_ROOT = "assets/audio/"; // relative: works under itch.io and GitHub Pages subfolders
/** A sound's caption ("[BOOM]") shows at most this often (s): a Gatling burst would flood the bar otherwise. */
const CAPTION_EVERY = 1.2;

export class YeetSound {
  private ctx: AudioContext | null = null;
  private player: AudioPlayer | null = null;
  private music: MusicPlayer | null = null;
  private musicStarted = false;
  /** When each event last showed its caption (performance.now ms). */
  private readonly captionAt = new Map<string, number>();

  /** Fetches and decodes every sound file; progress(0..1) feeds the loading screen. */
  async load(progress: (v: number) => void = () => {}): Promise<void> {
    try {
      // the lowest output delay the browser allows (gunshots must land with the muzzle flash, playtest 4)
      this.ctx = new AudioContext({ latencyHint: 0 });
    } catch (err) {
      Log.warn("audio", `no Web Audio here, the game runs silent: ${String(err)}`);
      return;
    }
    const ctx = this.ctx;
    const musicFiles = Object.values(MUSIC.tracks).flatMap((t) => Object.values(t.stems));
    const files = [...new Set([...Object.values(EVENTS.events).flatMap((e) => e.files), ...musicFiles])];
    const buffers: Record<string, AudioBuffer> = {};
    let done = 0;
    await Promise.all(files.map(async (f) => {
      const res = await fetch(AUDIO_ROOT + f);
      if (!res.ok) throw new Error(`sound ${AUDIO_ROOT + f}: HTTP ${res.status}`);
      buffers[f] = await ctx.decodeAudioData(await res.arrayBuffer());
      progress(++done / files.length);
    }));
    this.player = new AudioPlayer(ctx, EVENTS, buffers);
    this.music = new MusicPlayer(ctx, { ...MUSIC, sample_rate: ctx.sampleRate }, buffers, this.player.bus("music"));
    Log.info("audio", `${files.length} sound files loaded, ${Object.keys(EVENTS.events).length} events`);
  }

  /** Call from a click or key press: browsers only start audio after one. */
  resume(): void {
    if (this.ctx && this.ctx.state !== "running") {
      const ctx = this.ctx;
      void ctx.resume().then(() => {
        this.startMusic();
        const out = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
        Log.info("audio", `latency: base ${(ctx.baseLatency * 1000).toFixed(1)} ms, output ${(out * 1000).toFixed(1)} ms`);
      });
    }
  }

  /** The match music, once (it loops on its own). */
  private startMusic(): void {
    if (this.musicStarted || !this.music || !MUSIC.start) return;
    this.musicStarted = true;
    this.music.start(MUSIC.start);
    Log.info("audio", `music: ${MUSIC.start}`);
  }

  play(name: string): void {
    if (!this.player || this.ctx?.state !== "running") return;
    this.player.play(name);
    // sound captions (Settings: access.captions_sfx, off by default; SOP-20), throttled per sound
    const now = performance.now();
    if (now - (this.captionAt.get(name) ?? -1e9) >= CAPTION_EVERY * 1000) {
      this.captionAt.set(name, now);
      shell.subtitles.caption(name);
    }
  }

  /** True if the events file has this sound (voice lines exist only once they are recorded or generated). */
  has(name: string): boolean {
    return name in EVENTS.events;
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
