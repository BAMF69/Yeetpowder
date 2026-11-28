// Shared arena presentation for couch split-screen and read-only online spectators.
// Couch players use one authoritative Room; each viewport has its own camera, gun and HUD.
import * as THREE from "three";
import { shell } from "../shell/app";
import { Log } from "../core/log";
import { couchViews, type CouchFrame } from "../core/yeet/couch";
import { YeetSim, downFor, type TaggedEvent } from "../core/yeet/sim";
import { TUNING } from "../core/yeet/tuning";
import { buildSurroundings } from "./yeet/surroundings";
import { firearmId } from "../core/yeet/tuning";
import { equipmentStatus } from "../core/yeet/equipment";
import { SceneryViews } from "./yeet/scenery";
import { Room } from "../net/room";
import { roomLevel, type MatchStatus } from "../net/roomOptions";
import type { ReplayClip } from "../net/highlight";
import { PartySession } from "./net/partySession";
import type { CouchSetup } from "./couchSetup";
import { CouchControls } from "./couchControls";
import type { World } from "./threeHost";
import { buildRoom } from "./yeet/room";
import { buildProps } from "./yeet/props";
import { makeOperative, type Operative } from "./yeet/operative";
import { PIVOT } from "./yeet/figures";
import { inputFromPlayer } from "./yeet/operativePose";
import { Viewmodel } from "./yeet/viewmodel";
import { PickupViews } from "./yeet/pickups";
import { Effects } from "./yeet/effects";
import { YeetSound } from "./yeet/sound";
import { loadVinishVfx, disposeVinishVfx } from "./yeet/vinishVfx";
import { loadTerrainTextures } from "./yeet/terrainMaterials";
import { loadMeshyArt, operativeArt, ART_WEAPONS } from "./yeet/meshyArt";
import { MatchReplay, followCamera } from "./yeet/matchReplay";
import { RemoteBuffer, INTERP_MS } from "./net/remote";
import { GrenadeGuide } from "./yeet/grenadeGuide";
import { localProfile, saveProfile } from "./playerProfile";
import { CouchRespawnBadge } from "./respawnScreen";
import { OPERATORS, type PlayerProfile } from "../net/profile";

export class ArenaWorld implements World {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly cameras: THREE.PerspectiveCamera[] = [];
  private readonly guns: Viewmodel[] = [];
  private readonly guides: GrenadeGuide[] = [];
  private readonly scoreboard = document.createElement("div");
  private scoresHeld = false;
  private readonly killBanner = document.createElement("div");
  private killUntil = 0;
  private readonly scoreUp = (e: KeyboardEvent) => { if (e.code === "Tab") { this.scoresHeld = false; this.scoreboard.style.display = "none"; } };
  private shownWeapons: string[] = [];
  private readonly actors: Operative[] = [];
  private readonly room: Room | null;
  private readonly session: PartySession | null;
  private readonly sim: YeetSim;
  private readonly controls: CouchControls | null;
  private readonly hud = document.createElement("div");
  private readonly toolbar = document.createElement("div");
  private toolbarTitle: HTMLDivElement | null = null;
  private readonly cards: HTMLDivElement[] = [];
  /** Couch: one respawn badge per local player's view (respawnScreen.ts). */
  private readonly badges: CouchRespawnBadge[] = [];
  private readonly cinema: MatchReplay;
  private readonly sound = new YeetSound();
  private readonly fx: Effects;
  private readonly pickups: PickupViews;
  private readonly props: ReturnType<typeof buildProps>;
  private readonly surroundings: ReturnType<typeof buildSurroundings>;
  private readonly scenery: SceneryViews;
  private readonly roomView: ReturnType<typeof buildRoom>;
  private readonly remote = new RemoteBuffer();
  private match: MatchStatus;
  private active: boolean[];
  private replay: ReplayClip | null = null;
  private acc = 0;
  private seq: number[];
  private pending: CouchFrame[] = [];
  private connected: boolean[] = [];
  private finished = false;
  private target = 0;
  private overview = false;
  private readonly count: number;
  private readonly canvas: HTMLElement;
  private readonly resumeSound = () => this.sound.resume();
  private readonly key = (e: KeyboardEvent) => {
    if (e.code === "Tab" && shell.top?.gameplay) { e.preventDefault(); this.scoresHeld = true; return; }
    if (!this.session || !shell.top?.gameplay) return;
    if (e.code === "ArrowRight") this.cycle(1);
    if (e.code === "ArrowLeft") this.cycle(-1);
  };
  constructor(aspect: number, source: CouchSetup | PartySession) {
    this.session = source instanceof PartySession ? source : null;
    this.room = source instanceof PartySession ? null : new Room("COUCH", source.options);
    this.count = source instanceof PartySession ? 1 : source.players;
    this.sim = this.room?.sim ?? new YeetSim(TUNING, roomLevel(source.options), source.options.capacity);
    this.match = this.room?.match ?? { phase: "waiting", elapsed: 0, remaining: 0, lives: [], winners: [] };
    this.active = Array(source.options.capacity).fill(true);
    this.seq = Array(this.count).fill(0);
    if (this.room) for (let i = 0; i < this.count; i++) this.room.join(i === 0 ? localProfile() : { name: `Player ${i + 1}`, operator: Object.keys(OPERATORS)[i % 4] as PlayerProfile["operator"] });
    this.canvas = document.querySelector("#game canvas") as HTMLElement;
    this.controls = source instanceof PartySession ? null : new CouchControls(this.canvas, source.keyboard);
    this.scene.background = new THREE.Color("#8ec5e8"); this.scene.fog = new THREE.Fog("#b8d8ec", 90, 260);
    this.scene.add(new THREE.HemisphereLight("#d6e2ef", "#4a3f33", 1.3));
    const sun = new THREE.DirectionalLight("#fff1dc", 2.3); sun.position.set(30, 60, 18); this.scene.add(sun);
    this.roomView = buildRoom(this.sim.arena); this.scene.add(this.roomView.group);
    this.props = buildProps(this.sim.level, this.sim.explosives, this.sim.projectiles); this.scene.add(this.props.group);
    this.surroundings = buildSurroundings(this.sim.level); this.scene.add(this.surroundings.group);
    this.scenery = new SceneryViews(this.sim.level, this.sim.explosives, this.props); this.scene.add(this.scenery.group);
    this.pickups = new PickupViews(this.scene, this.sim.pickups); this.fx = new Effects(this.scene);
    for (let i = 0; i < this.count; i++) {
      const camera = new THREE.PerspectiveCamera(80, aspect, 0.05, 350); camera.rotation.order = "YXZ";
      this.scene.add(camera); this.cameras.push(camera);
      if (this.room) { const gun = new Viewmodel(); camera.add(gun.root); this.guns.push(gun); this.guides.push(new GrenadeGuide(this.scene, TUNING.projectile.grenade.blast.radius)); }
    }
    this.camera = this.cameras[0]; this.cinema = new MatchReplay(this.scene, this.camera, this.sim.arena);
    this.sim.players.forEach((_, i) => {
      const op = makeOperative(["#1e88e5", "#fb8c00", "#e53935", "#43a047", "#8e24aa", "#fdd835"][i % 6]);
      this.actors.push(op); this.scene.add(op.root);
    });
    this.hud.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:8;color:white;font:14px system-ui";
    document.body.append(this.hud);
    this.scoreboard.style.cssText = "display:none;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:55;background:#101827ee;border:2px solid #ffd84a;padding:24px;color:white;white-space:pre;font:bold 18px system-ui;border-radius:12px";
    document.body.append(this.scoreboard); window.addEventListener("keyup", this.scoreUp);
    this.killBanner.style.cssText = "display:none;position:fixed;top:25%;left:50%;transform:translateX(-50%);z-index:20;background:#101827dd;color:#ffd84a;font:900 26px system-ui;padding:12px;border:2px solid #ff65c1;pointer-events:none;text-align:center"; document.body.append(this.killBanner);
    if (this.room) couchViews(this.count).forEach((v, i) => {
      const region = document.createElement("div"); region.style.cssText = `position:absolute;box-sizing:border-box;border:1px solid #ffffff55;left:${v.x * 100}%;top:${v.y * 100}%;width:${v.w * 100}%;height:${v.h * 100}%`;
      const cross = document.createElement("span"); cross.textContent = "+"; cross.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:24px monospace";
      const card = document.createElement("div"); card.dataset.player = String(i + 1); card.style.cssText = "position:absolute;bottom:8px;left:10px;padding:6px;background:#141822cc;border-radius:6px;white-space:pre-line";
      region.append(cross, card); this.cards.push(card); this.hud.append(region);
      this.badges.push(new CouchRespawnBadge(region, shell.i18n));
    });
    this.toolbar.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:50;padding:10px;background:#141822e8;border:2px solid #ffd84a;border-radius:12px;color:white;font:16px system-ui;text-align:center;max-height:85vh;overflow:auto";
    document.body.append(this.toolbar);
    this.showToolbar();
    this.canvas.addEventListener("click", this.resumeSound); window.addEventListener("keydown", this.key);
    this.session?.subscribe((m) => {
      if (m.t !== "snap") return;
      this.sim.importState(m.state); this.remote.push(performance.now(), m.state.players);
      this.active = m.active ?? m.present; this.match = m.match ?? this.match;
      if (m.replay !== undefined) this.replay = m.replay;
      if (this.match.phase !== "finished") this.replay = null;
      for (const e of m.events) this.event(e);
      this.matchChanged();
    });
    this.resize(aspect);
  }
  async load(progress: (v: number) => void): Promise<void> {
    await this.scenery.load(shell.params.has("noart"));
    await Promise.all([loadTerrainTextures(), loadVinishVfx(), this.sound.load(progress), loadMeshyArt(() => {}, shell.params.has("noart"), shell.params.get("art-preview"))]);
    const skin = operativeArt(); if (skin) for (const op of this.actors) op.useSkin(skin);
    this.pickups.rebuildModels();
    for (const gun of this.guns) for (const id of ART_WEAPONS) gun.rebuildGun(id);
    for (const gun of this.guns) gun.rebuildHealthPack();
    progress(1); Log.info("yeet", `YEET_LEVEL_READY ${this.sim.level.id} ${this.room ? "couch" : "spectator"}`);
  }
  resize(aspect: number): void {
    const views = this.room ? couchViews(this.count) : [{ w: 1, h: 1 }];
    this.cameras.forEach((c, i) => { c.aspect = aspect * views[i].w / views[i].h; c.updateProjectionMatrix(); });
  }
  update(dt: number): void {
    this.killBanner.style.display = performance.now() < this.killUntil ? "block" : "none";
    if (this.cinema.playing) { this.cinema.update(dt); return; }
    if (this.session) this.matchChanged();
    if (this.scoresHeld) { this.scoreboard.style.display = "block"; this.scoreboard.textContent = "SCOREBOARD\n\n" + this.sim.kos.map((score, i) => `${this.profile(i).name}   ${score} KOs${this.room?.options.mode === "lives" ? " · " + this.match.lives[i] + " lives" : ""}`).join("\n"); }
    if (this.room && !this.finished && this.toolbarTitle) this.toolbarTitle.textContent = `${this.sim.level.name} · Couch · ${this.count} local players · ${this.room.options.mode === "timed" ? Math.ceil(this.match.remaining) + "s left" : this.room.options.mode === "lives" ? this.room.options.lives + " lives" : "First to " + this.room.options.scoreLimit}`;
    if (this.room) {
      const frames = this.controls!.take(this.count, dt);
      frames.forEach(({ frame: f, connected }, i) => {
        this.connected[i] = connected;
        if (f.pause) shell.pauseGame();
        const p = this.sim.players[i];
        // knocked out: A spawns (once it unlocks; the sim decides), LB / RB switch operator instead of weapon
        if (p.dead > 0 && p.dead <= TUNING.player.respawnAuto && p.sharkT === 0) {
          if (f.input.jump) f.input.spawn = true;
          if (f.cycle) this.couchOperator(i, f.cycle);
          f.cycle = 0;
        }
        if (f.cycle) f.input.select = TUNING.weaponOrder.indexOf(p.owned[(p.owned.indexOf(p.weapon) + f.cycle + p.owned.length) % p.owned.length]);
        const old = this.pending[i];
        this.pending[i] = old ? { ...f, dYaw: old.dYaw + f.dYaw, dPitch: old.dPitch + f.dPitch, input: { ...f.input,
          jump: old.input.jump || f.input.jump, spawn: old.input.spawn || f.input.spawn, firePressed: old.input.firePressed || f.input.firePressed,
          reload: old.input.reload || f.input.reload, heal: old.input.heal || f.input.heal, slash: old.input.slash || f.input.slash,
          select: f.input.select >= 0 ? f.input.select : old.input.select } } : f;
      });
      this.acc = Math.min(0.25, this.acc + dt);
      while (this.acc >= TUNING.step) {
        this.acc -= TUNING.step;
        this.pending.forEach((f, i) => {
          this.room!.push(i, [{ ...f.input, seq: ++this.seq[i], dYaw: f.dYaw, dPitch: f.dPitch }]);
          this.pending[i] = { ...f, dYaw: 0, dPitch: 0, input: { ...f.input, jump: false, spawn: false, firePressed: false, reload: false, heal: false, slash: false, select: -1 } };
        });
        this.room.step(); this.active = this.room.active;
        const snap = this.room.snapshot(); for (const e of snap.events) this.event(e);
        if (snap.replay !== undefined) this.replay = snap.replay;
      }
      this.matchChanged();
    }
    this.actors.forEach((op, i) => {
      const p = this.sim.players[i], view = this.session ? this.remote.sample(i, performance.now() - INTERP_MS) : null;
      op.setOperator(this.profile(i).operator);
      const pos = view?.pos ?? p.pos;
      op.root.visible = this.active[i] && !p.swallowed; op.root.position.set(pos.x, pos.y + PIVOT, pos.z);
      op.root.rotation.set(p.dead > 0 ? -Math.PI / 2 : 0, (view?.yaw ?? p.yaw) + Math.PI, 0);
      op.setPose(inputFromPlayer(p, this.sim.time, 0, 0)); op.setHp(this.sim.level.infiniteHp ? 1 : p.hp / TUNING.player.hp); op.update(dt, this.camera);
    });
    this.pickups.update(dt, this.sim.pickups); this.props.update(dt); this.scenery.update(dt); this.fx.update(dt); this.sound.update(shell.settings.audio);
    if (this.room) this.cameras.forEach((c, i) => {
      const p = this.sim.players[i]; c.position.set(p.pos.x, p.pos.y + TUNING.player.eyeHeight, p.pos.z); c.rotation.set(p.pitch, p.yaw, 0);
      if (p.sharkT > 0 || p.swallowed) followCamera(c, this.sim.arena, new THREE.Vector3(p.pos.x, p.pos.y + 1, p.pos.z), new THREE.Vector3(8, 4, 8));
      this.guides[i].update(this.sim, p, !!this.pending[i]?.input.aiming, dt);
      const gun = this.guns[i];
      if (this.shownWeapons[i] !== p.weapon) { gun.show(p.weapon); this.shownWeapons[i] = p.weapon; }
      gun.setAim(this.pending[i]?.input.aiming ? 1 : 0);
      gun.setTreatment(p.healing > 0);
      gun.setReload(p.reloading > 0 ? 1 - p.reloading / TUNING.weapons[firearmId(p.weapon)].reload : 0); gun.update(dt, p.weapon === "copter" && !!this.pending[i]?.input.fireHeld);
      const speed = Math.hypot(p.vel.x, p.vel.y, p.vel.z);
      this.cards[i].textContent = `${this.profile(i).name} · ${this.sim.kos[i]} KOs · Tab scores\n${TUNING.weapons[p.weapon].name} · ${p.mag[firearmId(p.weapon)]}/${TUNING.weapons[firearmId(p.weapon)].mag} · ${this.sim.level.infiniteHp ? `DAMAGE ${Math.round(p.damage)}%` : "HP " + Math.ceil(p.hp)}${this.room!.options.mode === "lives" ? " · " + this.match.lives[i] + " lives" : ""}\n${speed.toFixed(1)} yeters per second${!this.connected[i] ? " · Connect controller " + (i + 1 - Number(this.controls!.keyboard)) : ""}${p.swimT > 0 && p.dead === 0 ? " · SHARK APPROACHING!" : p.dead > 0 ? " · KNOCKED OUT" : ""}`;
      this.cards[i].textContent += "\n" + equipmentStatus(p);
      const down = p.dead > 0 && p.dead <= TUNING.player.respawnAuto && p.sharkT === 0;
      this.badges[i]?.update(down ? { downFor: downFor(p, TUNING), killer: this.lastKiller[i] ?? "", operator: this.profile(i).operator } : null);
    });
    else this.spectatorCamera();
  }
  render(renderer: THREE.WebGLRenderer): void {
    const size = renderer.getSize(new THREE.Vector2());
    if (this.cinema.playing || !this.room) {
      renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y);
      this.camera.aspect = size.x / size.y; this.camera.updateProjectionMatrix();
      this.guns.forEach((g) => g.root.visible = false);
      if (this.cinema.playing) this.actors.forEach((op) => op.root.visible = false);
      renderer.render(this.scene, this.camera); return;
    }
    // Clear the unused fourth quadrant in a three-player game, including after scene changes.
    renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y);
    renderer.setClearColor("#10151f"); renderer.clear(); renderer.setScissorTest(true);
    couchViews(this.count).forEach((v, i) => {
      const x = Math.round(v.x * size.x), y = Math.round((1 - v.y - v.h) * size.y), w = Math.round(v.w * size.x), h = Math.round(v.h * size.y);
      renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h);
      this.cameras[i].aspect = w / h; this.cameras[i].updateProjectionMatrix();
      this.actors.forEach((op, s) => op.root.visible = this.active[s] && (s !== i || this.sim.players[i].sharkT > 0) && !this.sim.players[s].swallowed);
      this.guns.forEach((g, s) => g.root.visible = s === i && this.sim.players[i].dead === 0 && !this.sim.players[i].sharkT && this.active[i]);
      this.guides.forEach((guide, s) => { guide.root.visible = s === i && this.sim.players[i].weapon === "grenade" && !!this.pending[i]?.input.aiming; });
      renderer.render(this.scene, this.cameras[i]);
    });
    renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y);
  }
  private event(e: TaggedEvent): void {
    if (e.type === "sharkApproach") {
      const who = e.p ?? 0;
      this.props.shark(e.at, () => { const v = this.sim.players[who]; return v && (v.swimT > 0 || v.swallowed) ? v.pos : null; });
    }
    if (e.type === "pvpDown") this.lastKiller[e.target] = this.profile(e.by).name;
    if (e.type === "pvpDown") { this.killBanner.textContent = `${this.profile(e.by).name} KNOCKED OUT ${this.profile(e.target).name}`; this.killUntil = performance.now() + 2200; this.sound.play("ko"); }
    if (e.type === "blast" || e.type === "explode") {
      this.fx.explosion(new THREE.Vector3(e.at.x, e.at.y, e.at.z), e.type === "blast" ? e.radius : TUNING.explosive[e.kind].radius * 0.7);
      this.sound.play("kaboom");
    }
    if (e.type === "pvpHit") { this.actors[e.target]?.flash(); this.fx.puff(new THREE.Vector3(e.at.x, e.at.y, e.at.z)); }
    if ((e.type === "slash" || e.type === "ultraslash") && e.p !== undefined) {
      const p = this.sim.players[e.p]; this.fx.slash(new THREE.Vector3(p.pos.x, p.pos.y + 1, p.pos.z)); this.sound.play("swish");
    }
    if (e.type === "fire" && e.p !== undefined) {
      this.actors[e.p]?.fire(e.weapon); this.guns[e.p]?.fired(e.weapon, TUNING.weapons[e.weapon].trauma, e.aimed);
      for (const t of e.tracers) this.fx.tracer(new THREE.Vector3(t.from.x, t.from.y, t.from.z), new THREE.Vector3(t.to.x, t.to.y, t.to.z), t.hit);
      this.sound.play(({ pistol: "pea", shotgun: "boom", sniper: "krak", copter: "brrt", reaper: "krak", sakura: "revolver", rocket: "lob", grenade: "lob", axe: "lob", shield: "bonk" } as const)[e.weapon]);
    }
  }
  private cycle(dir: number): void {
    for (let i = 0; i < this.active.length; i++) { this.target = (this.target + dir + this.active.length) % this.active.length; if (this.active[this.target]) break; }
    this.overview = false; this.showToolbar();
  }
  /** Couch: a knocked-out player's LB / RB steps their operator (player 1 on keyboard also saves it). */
  private couchOperator(i: number, d: number): void {
    const ids = Object.keys(OPERATORS) as PlayerProfile["operator"][];
    const cur = this.profile(i);
    const next = { ...cur, operator: ids[(ids.indexOf(cur.operator) + d + ids.length) % ids.length] };
    this.room?.setProfile(i, next);
    if (i === 0 && this.controls?.keyboard) saveProfile(next);
  }
  private readonly lastKiller: string[] = [];

  private profile(i: number): PlayerProfile { return this.room?.profiles[i] ?? this.session?.latest?.profiles?.[i] ?? { name: `Player ${i + 1}`, operator: "navy" }; }
  private spectatorCamera(): void {
    if (!this.active[this.target]) this.cycle(1);
    const p = this.actors[this.target]?.root.position ?? new THREE.Vector3();
    if (this.overview) { this.camera.position.set(0, 95, 65); this.camera.lookAt(0, 0, 0); }
    else followCamera(this.camera, this.sim.arena, p.clone().add(new THREE.Vector3(0, 0.5, 0)), new THREE.Vector3(9, 6, 9));
  }
  private matchChanged(): void {
    if (this.match.phase === "finished" && !this.finished) {
      this.finished = true; this.showToolbar(); if (this.replay) this.playReplay();
    } else if (this.match.phase !== "finished" && this.finished) { this.finished = false; this.replay = null; this.showToolbar(); }
    if (this.session?.transport.status === "closed" && this.toolbarTitle) this.toolbarTitle.textContent = "Room closed · All players left.";
  }
  private playReplay(): void {
    if (!this.replay) return;
    shell.resumeGame(); this.toolbar.style.display = this.hud.style.display = "none";
    if (document.pointerLockElement) void document.exitPointerLock();
    this.guns.forEach((g) => g.root.visible = false);
    this.cinema.play(this.replay, () => { this.toolbar.style.display = this.hud.style.display = "block"; this.resize(window.innerWidth / window.innerHeight); });
  }
  private showToolbar(): void {
    this.toolbar.replaceChildren();
    const label = document.createElement("div"); this.toolbarTitle = label; label.textContent = this.finished ? `Match complete · ${this.match.winners.length === 1 ? "Player " + (this.match.winners[0] + 1) + " wins" : "Draw"}`
      : this.room ? `${this.sim.level.name} · Couch · ${this.count} local players` : `Spectating ${this.session!.code} · ${this.overview ? "Arena overview" : "Player " + (this.target + 1)}`;
    this.toolbar.append(label);
    const button = (text: string, action: () => void) => { const b = document.createElement("button"); b.textContent = text; b.style.cssText = "font:inherit;padding:5px 10px;margin:4px"; b.onclick = () => { this.sound.resume(); shell.resumeGame(); action(); }; this.toolbar.append(b); };
    if (this.finished) {
      this.sim.kos.forEach((score, i) => { if (!this.active[i] && !this.room?.present[i] && !this.session?.latest?.present[i]) return; const row = document.createElement("div"); row.textContent = `Player ${i + 1} · ${score} KOs`; this.toolbar.append(row); });
      if (this.replay) button("Yeet of the match", () => this.playReplay());
      if (this.room) button("Rematch", () => { this.room!.restart(0); shell.resumeGame(); });
    } else if (this.session) {
      button("Previous player", () => this.cycle(-1)); button("Next player", () => this.cycle(1));
      button("Arena overview", () => { this.overview = true; this.showToolbar(); });
    }
    if (this.session || this.finished) button("Back to menu", () => shell.quitToTitle());
  }
  dispose(): void {
    this.killBanner.remove();
    this.scoreboard.remove(); window.removeEventListener("keyup", this.scoreUp); for (const guide of this.guides) guide.dispose();
    this.session?.close(); this.controls?.dispose(); this.cinema.dispose(); this.hud.remove(); this.toolbar.remove();
    this.sound.dispose(); this.fx.dispose(); this.pickups.dispose(); this.props.dispose(); this.surroundings.dispose(); this.scenery.dispose(); this.roomView.dispose();
    for (const op of this.actors) op.dispose(); for (const gun of this.guns) gun.dispose();
    this.canvas.removeEventListener("click", this.resumeSound); window.removeEventListener("keydown", this.key);
    disposeVinishVfx();
  }
}
