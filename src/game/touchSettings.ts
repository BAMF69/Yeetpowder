// ---------------------------------------------------------------------------
// touchSettings.ts
// Purpose : The touch player's own options, set from the ⚙ button on the touch controls: Look speed, Aim assist,
//           Gyro aiming and Gyro speed. Saved on this device (localStorage), so a tablet keeps its own.
// Usage   : const s = loadTouchSettings(); ... saveTouchSettings(s); openTouchPanel(host, s, onChange, gyro)
// Notes   : Kept out of the kit's settings file on purpose (its defaults are covered by golden tests and every
//           platform shares it; these only mean something on a touch screen). Storage can be blocked (private
//           windows): then the defaults hold for the session.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { Log } from "../core/log";

export interface TouchSettings {
  /** x TUNING.touch.lookScale for finger drags. */
  look: number;
  assist: boolean;
  gyro: boolean;
  /** x TUNING.touch.gyro. */
  gyroSpeed: number;
}

const KEY = "yeetpowder.touch";
const DEFAULTS: TouchSettings = { look: 1, assist: true, gyro: false, gyroSpeed: 1 };
const clamp = (v: unknown, lo: number, hi: number, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;

export function loadTouchSettings(): TouchSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<TouchSettings>;
    return {
      look: clamp(raw.look, 0.5, 3, DEFAULTS.look),
      assist: typeof raw.assist === "boolean" ? raw.assist : DEFAULTS.assist,
      gyro: typeof raw.gyro === "boolean" ? raw.gyro : DEFAULTS.gyro,
      gyroSpeed: clamp(raw.gyroSpeed, 0.5, 3, DEFAULTS.gyroSpeed),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveTouchSettings(s: TouchSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (err) {
    Log.warn("touch", `settings not saved (storage blocked): ${String(err)}`);
  }
}

export const PANEL_CSS = `
/* over the HUD (7) and the duel panel (8), under the shell's screens (10) */
.yt-panel { position: fixed; left: 10px; top: 56px; z-index: 9; touch-action: manipulation; background: rgba(20, 24, 34, 0.94); color: #fff;
  border: 3px solid #ffd84a; border-radius: 14px; padding: 12px 14px; width: min(320px, 80vw); font-size: 15px; }
.yt-panel h3 { margin: 0 0 8px; font-size: 17px; }
.yt-panel label { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 10px 0; }
.yt-panel input[type=range] { flex: 1; max-width: 150px; }
.yt-panel input[type=checkbox] { width: 26px; height: 26px; }
.yt-panel .note { font-size: 12px; opacity: 0.8; margin: -4px 0 6px; }
.yt-panel button { font: inherit; font-weight: 800; padding: 8px 16px; border-radius: 10px; border: 0;
  background: #ffd84a; color: #1b1b1b; margin-top: 6px; }
`;

/**
 * Builds the panel inside `parent` (hidden until shown). `onChange` gets the new settings after every change;
 * `gyroNote` is the line under the gyro switch (why it cannot work here, or nothing).
 */
export function buildTouchPanel(
  parent: HTMLElement, s: TouchSettings, onChange: (s: TouchSettings) => void, gyroNote: () => string,
): { root: HTMLDivElement; show: (on: boolean) => void } {
  const root = document.createElement("div");
  root.className = "yt-panel";
  root.style.display = "none";
  root.innerHTML = `<h3>Touch controls</h3>
    <label>Look speed <input type="range" min="0.5" max="3" step="0.1" data-k="look"><span data-v="look"></span></label>
    <label>Aim assist <input type="checkbox" data-k="assist"></label>
    <label>Gyro aiming <input type="checkbox" data-k="gyro"></label>
    <div class="note" data-note></div>
    <label>Gyro speed <input type="range" min="0.5" max="3" step="0.1" data-k="gyroSpeed"><span data-v="gyroSpeed"></span></label>
    <button data-close>Done</button>`;
  parent.append(root);
  // the panel's own taps must not reach the look zone or the game behind it
  for (const t of ["pointerdown", "pointermove", "pointerup"]) root.addEventListener(t, (e) => e.stopPropagation());
  const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const refresh = () => {
    q<HTMLInputElement>('[data-k="look"]').value = String(s.look);
    q<HTMLInputElement>('[data-k="gyroSpeed"]').value = String(s.gyroSpeed);
    q<HTMLInputElement>('[data-k="assist"]').checked = s.assist;
    q<HTMLInputElement>('[data-k="gyro"]').checked = s.gyro;
    q('[data-v="look"]').textContent = `${s.look.toFixed(1)}x`;
    q('[data-v="gyroSpeed"]').textContent = `${s.gyroSpeed.toFixed(1)}x`;
    q("[data-note]").textContent = gyroNote();
  };
  root.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    const k = el.dataset.k as keyof TouchSettings | undefined;
    if (!k) return;
    if (k === "look" || k === "gyroSpeed") s[k] = Number(el.value);
    else s[k] = el.checked;
    saveTouchSettings(s);
    onChange(s);
    refresh();
  });
  q("[data-close]").addEventListener("click", () => (root.style.display = "none"));
  return {
    root,
    show: (on) => {
      refresh();
      root.style.display = on ? "block" : "none";
    },
  };
}
