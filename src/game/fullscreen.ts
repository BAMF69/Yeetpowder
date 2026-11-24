// ---------------------------------------------------------------------------
// fullscreen.ts
// Purpose : Fullscreen from a tap on touch devices (the ⛶ button on the touch bar): an Android tablet's browser
//           tab or home-screen shortcut kept the browser's bars (Elaina, 2026-11-24). Also turns the screen to
//           landscape where the browser allows it (Android, while fullscreen).
// Usage   : if (canFullscreen()) button.onpointerup = () => toggleFullscreen();
// Notes   : Browsers only allow it from a tap or click, and on touch that is the finger lifting (pointerup), not
//           pointerdown. iPhone Safari has no page fullscreen at all (canFullscreen() is false: the button is not
//           shown); there the home-screen app (manifest.webmanifest, display "fullscreen") is the way.
//           The installed app (Add to Home screen / Install app) opens fullscreen through the manifest.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { Log } from "../core/log";

type WebkitDoc = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type WebkitEl = HTMLElement & { webkitRequestFullscreen?: () => void };
type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

/** True where a page may go fullscreen (Android, iPad, desktop; not iPhone). */
export function canFullscreen(): boolean {
  const d = document as WebkitDoc;
  return Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

/** Already fullscreen: in the page (the API) or as an installed app (the manifest's display mode). */
export function isFullscreen(): boolean {
  const d = document as WebkitDoc;
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement) || matchMedia("(display-mode: fullscreen)").matches;
}

/** Into fullscreen (and landscape where allowed), or back out. Call from a tap's pointerup or a click. */
export function toggleFullscreen(): void {
  const d = document as WebkitDoc;
  const root = document.documentElement as WebkitEl;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      if (d.exitFullscreen) void d.exitFullscreen().catch(() => {});
      else d.webkitExitFullscreen?.();
      return;
    }
    const entered = root.requestFullscreen ? root.requestFullscreen({ navigationUI: "hide" }) : (root.webkitRequestFullscreen?.(), Promise.resolve());
    void entered
      .then(() => (screen.orientation as LockableOrientation | undefined)?.lock?.("landscape"))
      .catch((err: unknown) => Log.debug("touch", `fullscreen or landscape lock refused: ${String(err)}`));
  } catch (err) {
    Log.warn("touch", `fullscreen failed: ${String(err)}`);
  }
}
