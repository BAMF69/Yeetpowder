/** A held-Tab score view for legacy solo/bot games; Party and couch retain their own live rosters. */
export class ScoreOverlay {
  private readonly root = document.createElement("div");
  private held = false;
  private readonly down = (e: KeyboardEvent) => {
    const play = document.querySelector('[data-screen="play"]:not(.hidden)');
    if (e.code === "Tab" && play) { e.preventDefault(); this.held = true; this.update(); }
  };
  private readonly up = (e: KeyboardEvent) => { if (e.code === "Tab") this.hide(); };
  private readonly blur = () => this.hide();
  constructor(private readonly rows: () => string[]) {
    this.root.className = "ys-scoreboard";
    this.root.style.cssText = "display:none;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:45;background:#101827ee;border:2px solid #ffd84a;border-radius:12px;color:white;font:800 20px system-ui;padding:28px;white-space:pre-line";
    document.body.append(this.root); window.addEventListener("keydown", this.down, true); window.addEventListener("keyup", this.up, true); window.addEventListener("blur", this.blur);
  }
  update(): void { if (this.held) { this.root.style.display = "block"; this.root.textContent = "SCOREBOARD\n\n" + this.rows().join("\n"); } }
  private hide(): void { this.held = false; this.root.style.display = "none"; }
  dispose(): void { this.root.remove(); window.removeEventListener("keydown", this.down, true); window.removeEventListener("keyup", this.up, true); window.removeEventListener("blur", this.blur); }
}
