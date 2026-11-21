// ---------------------------------------------------------------------------
// hud.ts
// Purpose : The toy's HTML overlay over the 3D view: crosshair and hit marker, weapon slots, copter heat bar, speed,
//           comic text pops ("BLAM!", "YEET!", "BONK!"), stars circling the crosshair while stunned, speed lines on
//           launches, a kill feed with funny verbs, a controls hint, and "Click to play" while the mouse is free.
// Usage   : const hud = new YeetHud(hostEl, weaponNames); hud.pop("YEET!"); hud.update(state) each frame;
//           hud.dispose() when the world closes.
// Notes   : Sits under the shell's screens (z-index 5 < #shell 10), pointer-events off: clicks reach the canvas.
//           Text sizes follow the player's ui_scale through the --ui-scale CSS variable the shell sets on #shell
//           (read here with a fallback of 1). reduce_motion turns the pop wobble and speed lines off.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------

export interface HudState {
  weapon: number;
  heat: number; // 0..1
  overheated: boolean;
  showHeat: boolean;
  speed: number;
  stunned: boolean;
  locked: boolean;
  autoplay: boolean;
  /** 0..1: how strong the speed lines are. */
  rush: number;
  reduceMotion: boolean;
  /** The Spin Doctor's scope covers the view. */
  scoped: boolean;
}

const CSS = `
.yh { position: fixed; inset: 0; pointer-events: none; z-index: 5; font-family: system-ui, "Segoe UI", sans-serif;
  color: #fff; --s: var(--ui-scale, 1); }
.yh-cross { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; transform: translate(-50%, -50%); }
.yh-cross::before, .yh-cross::after { content: ""; position: absolute; background: #fff; box-shadow: 0 0 2px #000; }
.yh-cross::before { left: 10px; top: 2px; width: 2px; height: 18px; }
.yh-cross::after { top: 10px; left: 2px; height: 2px; width: 18px; }
.yh-hit { position: absolute; left: 50%; top: 50%; width: 30px; height: 30px; transform: translate(-50%, -50%) rotate(45deg);
  opacity: 0; transition: opacity 0.12s; }
.yh-hit::before, .yh-hit::after { content: ""; position: absolute; background: #ff5252; }
.yh-hit::before { left: 14px; top: 0; width: 3px; height: 30px; }
.yh-hit::after { top: 14px; left: 0; height: 3px; width: 30px; }
.yh-hit.on { opacity: 1; transition: none; }
.yh-stars { position: absolute; left: 50%; top: 50%; width: 0; height: 0; display: none; }
.yh-stars span { position: absolute; font-size: calc(26px * var(--s)); color: #ffd84a; text-shadow: 0 0 3px #000;
  transform: translate(-50%, -50%); }
.yh-slots { position: absolute; right: 18px; bottom: 18px; display: flex; gap: 8px; }
.yh-slot { background: rgba(20, 24, 34, 0.65); border: 3px solid rgba(255, 255, 255, 0.25); border-radius: 14px;
  padding: 6px 12px; font-weight: 800; font-size: calc(15px * var(--s)); }
.yh-slot b { color: #ffd84a; margin-right: 6px; }
.yh-slot.on { border-color: #ffd84a; background: rgba(60, 50, 10, 0.75); transform: translateY(-4px); }
.yh-heat { position: absolute; left: 50%; bottom: 70px; width: 260px; transform: translateX(-50%); display: none; }
.yh-heat .bar { height: 14px; border-radius: 7px; background: rgba(0, 0, 0, 0.5); overflow: hidden; border: 2px solid #fff5; }
.yh-heat .fill { height: 100%; width: 0; background: linear-gradient(90deg, #ffd84a, #ff7043, #e53935); }
.yh-heat .lbl { text-align: center; font-weight: 800; font-size: calc(14px * var(--s)); text-shadow: 0 0 3px #000; }
.yh-heat.hot .lbl { color: #ff5252; }
.yh-speed { position: absolute; left: 18px; bottom: 18px; font-weight: 800; font-size: calc(18px * var(--s));
  background: rgba(20, 24, 34, 0.65); padding: 6px 12px; border-radius: 14px; }
.yh-hint { position: absolute; left: 18px; top: calc(54px * var(--s)); font-size: calc(13px * var(--s)); opacity: 0.85;
  background: rgba(20, 24, 34, 0.55); padding: 6px 10px; border-radius: 10px; max-width: 46vw; line-height: 1.5; }
.yh-feed { position: absolute; right: 18px; top: 14px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.yh-feed div { background: rgba(20, 24, 34, 0.7); padding: 4px 10px; border-radius: 8px; font-weight: 700;
  font-size: calc(14px * var(--s)); animation: yh-fade 4s forwards; }
.yh-feed em { color: #ffd84a; font-style: normal; }
.yh-pops { position: absolute; inset: 0; }
.yh-pop { position: absolute; left: 50%; top: 38%; font-weight: 900; font-size: calc(64px * var(--s)); color: #ffd84a;
  -webkit-text-stroke: 3px #1b1b1b; paint-order: stroke fill; letter-spacing: 2px; white-space: nowrap;
  animation: yh-pop 0.9s ease-out forwards; }
.yh-pop.red { color: #ff5252; }
.yh-pop.still { animation: yh-fade 0.9s forwards; transform: translate(-50%, -50%); }
.yh-rush { position: absolute; inset: 0; opacity: 0;
  background: repeating-conic-gradient(from 0deg, rgba(255,255,255,0.55) 0deg 1.2deg, transparent 1.2deg 9deg);
  -webkit-mask: radial-gradient(circle, transparent 38%, #000 75%); mask: radial-gradient(circle, transparent 38%, #000 75%); }
.yh-scope { position: absolute; inset: 0; display: none;
  background: radial-gradient(circle at 50% 50%, transparent 0, transparent 33vh, #000 33.4vh); }
.yh-scope::before, .yh-scope::after { content: ""; position: absolute; background: rgba(0, 0, 0, 0.85); }
.yh-scope::before { left: 50%; top: 17vh; width: 2px; height: 66vh; transform: translateX(-1px); }
.yh-scope::after { top: 50%; left: calc(50% - 33vh); height: 2px; width: 66vh; transform: translateY(-1px); }
.yh-click { position: absolute; left: 50%; top: 58%; transform: translateX(-50%); background: rgba(20, 24, 34, 0.8);
  padding: 12px 22px; border-radius: 16px; font-weight: 800; font-size: calc(22px * var(--s)); border: 3px solid #ffd84a; }
@keyframes yh-pop {
  0% { transform: translate(-50%, -50%) scale(0.3) rotate(var(--r)); opacity: 1; }
  20% { transform: translate(-50%, -50%) scale(1.25) rotate(var(--r)); }
  35% { transform: translate(-50%, -50%) scale(1) rotate(var(--r)); }
  80% { opacity: 1; }
  100% { transform: translate(-50%, -70%) scale(1) rotate(var(--r)); opacity: 0; }
}
@keyframes yh-fade { 0%, 75% { opacity: 1; } 100% { opacity: 0; } }
`;

const el = (cls: string, parent: HTMLElement, text = ""): HTMLDivElement => {
  const d = document.createElement("div");
  d.className = cls;
  if (text) d.textContent = text;
  parent.append(d);
  return d;
};

export class YeetHud {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly hit: HTMLDivElement;
  private readonly stars: HTMLDivElement;
  private readonly slots: HTMLDivElement[] = [];
  private readonly heat: HTMLDivElement;
  private readonly heatFill: HTMLDivElement;
  private readonly heatLbl: HTMLDivElement;
  private readonly speed: HTMLDivElement;
  private readonly feed: HTMLDivElement;
  private readonly pops: HTMLDivElement;
  private readonly rush: HTMLDivElement;
  private readonly click: HTMLDivElement;
  private readonly scope: HTMLDivElement;
  private readonly cross: HTMLDivElement;
  private hitT = 0;
  private starT = 0;
  private popN = 0;
  private reduceMotion = false;

  constructor(host: HTMLElement, weaponNames: string[]) {
    this.style = document.createElement("style");
    this.style.textContent = CSS;
    document.head.append(this.style);
    this.root = el("yh", host);
    this.rush = el("yh-rush", this.root);
    this.scope = el("yh-scope", this.root);
    this.cross = el("yh-cross", this.root);
    this.hit = el("yh-hit", this.root);
    this.stars = el("yh-stars", this.root);
    for (let i = 0; i < 5; i++) {
      const s = document.createElement("span");
      s.textContent = "★";
      this.stars.append(s);
    }
    const slots = el("yh-slots", this.root);
    weaponNames.forEach((n, i) => {
      const s = el("yh-slot", slots);
      s.innerHTML = `<b>${i + 1}</b>`;
      s.append(n);
      this.slots.push(s);
    });
    this.heat = el("yh-heat", this.root);
    this.heatLbl = el("lbl", this.heat, "HEAT");
    const bar = el("bar", this.heat);
    this.heatFill = el("fill", bar);
    this.speed = el("yh-speed", this.root);
    el("yh-hint", this.root,
      "WASD move · Space jump · Left click fire (aim at the floor to launch!) · Right click aim (steadier, less kick) · 1-4 or wheel switch guns · R respawn · Esc pause");
    this.feed = el("yh-feed", this.root);
    this.pops = el("yh-pops", this.root);
    this.click = el("yh-click", this.root, "Click to play");
  }

  /** A comic text pop in the middle of the screen. */
  pop(text: string, red = false): void {
    const p = el(`yh-pop${red ? " red" : ""}${this.reduceMotion ? " still" : ""}`, this.pops, text);
    this.popN++;
    p.style.setProperty("--r", `${(this.popN % 2 ? -1 : 1) * (4 + (this.popN % 3) * 3)}deg`);
    p.style.marginLeft = `${((this.popN % 5) - 2) * 30}px`;
    p.addEventListener("animationend", () => p.remove());
    while (this.pops.childElementCount > 4) this.pops.firstElementChild?.remove();
  }

  /** A kill feed line: "YOU <em>verb</em> who". */
  feedLine(verb: string, who: string): void {
    const d = el("", this.feed);
    d.innerHTML = `YOU <em>${verb}</em> `;
    d.append(who);
    d.addEventListener("animationend", () => d.remove());
    while (this.feed.childElementCount > 5) this.feed.firstElementChild?.remove();
  }

  hitMarker(): void {
    this.hitT = 0.12;
  }

  update(dt: number, s: HudState): void {
    this.reduceMotion = s.reduceMotion;
    this.hitT = Math.max(0, this.hitT - dt);
    this.hit.classList.toggle("on", this.hitT > 0);
    this.slots.forEach((el, i) => el.classList.toggle("on", i === s.weapon));
    this.heat.style.display = s.showHeat ? "block" : "none";
    this.heatFill.style.width = `${Math.round(s.heat * 100)}%`;
    this.heat.classList.toggle("hot", s.overheated);
    this.heatLbl.textContent = s.overheated ? "OVERHEATED: cooling down" : "COPTER HEAT";
    this.speed.textContent = `${s.speed.toFixed(1)} m/s`;
    this.rush.style.opacity = s.reduceMotion ? "0" : String(Math.min(0.85, s.rush));
    this.click.style.display = s.locked || s.autoplay ? "none" : "block";
    this.scope.style.display = s.scoped ? "block" : "none";
    this.cross.style.display = s.scoped ? "none" : "block";
    this.stars.style.display = s.stunned ? "block" : "none";
    if (s.stunned) {
      this.starT += dt;
      [...this.stars.children].forEach((c, i) => {
        const a = this.starT * 6 + (i / 5) * Math.PI * 2;
        (c as HTMLElement).style.left = `${Math.cos(a) * 48}px`;
        (c as HTMLElement).style.top = `${Math.sin(a) * 20 - 30}px`;
      });
    }
  }

  dispose(): void {
    this.root.remove();
    this.style.remove();
  }
}
