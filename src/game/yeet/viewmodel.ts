// ---------------------------------------------------------------------------
// viewmodel.ts
// Purpose : What you see of yourself in first person: two arms in the jumpsuit with white cartoon gloves holding
//           the current gun (placeholder models built from shapes), legs that only show when you are thrown, and the
//           recoil poses that sell each gun's kick:
//             Pea Pistol  -> the wrist snaps, then the gun hand whips up and back over your head, swings back
//             Boomstick   -> both arms and both legs fling forward into view as you are thrown backward
//             Spin Doctor -> a hard arm kick;  Gatling Copter -> a constant judder while firing
//           Right-click aim brings the gun to the centre (the Spin Doctor hides it behind its scope); aimed shots
//           are braced, so their poses are smaller (wrist kick only for the pistol, a half fling for the Boomstick).
// Usage   : const vm = new Viewmodel(); camera.add(vm.root); vm.show("shotgun"); vm.fired("shotgun", trauma);
//           vm.update(dt, copterFiring); vm.muzzleWorld(out) is where tracers start.
// Notes   : Everything is in camera space (root sits at the eye). The right arm is one pivot at the shoulder that
//           carries sleeve, glove and gun, so rotating it swings the whole arm. The left arm points at the gun's
//           foregrip every frame (Object3D.lookAt), so it follows any pose. Tracers start at the gun's REST muzzle,
//           not the animated one, so a shot fired while the hand is behind your head still comes from the front.
//           Presentation numbers only: gameplay recoil lives in src/core/yeet/tuning.ts.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// Updated : 2026-11-21 with Claude (Opus 5.5, claude-opus-5-5): arms, legs and per-gun recoil poses (playtest)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import type { WeaponId } from "../../core/yeet/tuning";

// ---- Tunables (presentation) --------------------------------------------------
const SUIT = "#26a69a"; // the player's jumpsuit (teal: no dummy wears it)
const GLOVE = "#f5f5f5";
const BOOT = "#3a3a44";
const GUN_SCALE = 0.62;
const SLEEVE = 0.036; // sleeve radius: thin enough not to hide the room
const SHOULDER_R = new THREE.Vector3(0.32, -0.42, 0.12);
const SHOULDER_L = new THREE.Vector3(-0.26, -0.48, 0.02);
const HAND_R = new THREE.Vector3(0.2, -0.21, -0.38); // rest position of the gun hand
const HIPS_REST = new THREE.Vector3(0, -1.05, 0.15);
const HIPS_FLUNG = new THREE.Vector3(0, -0.55, -0.1); // the body folds as you fly: legs come up into view
const LEFT_FLUNG = new THREE.Vector3(-0.3, -0.05, -0.5);
const ARM_FLUNG_SHIFT = new THREE.Vector3(-0.08, 0.16, -0.2); // the gun arm reaches forward into view

/** Pea Pistol blowback (playtest 2: slow enough to see): the wrist snaps first, then the arm whips over the head. */
const BLOW = { angle: 1.95, twist: -0.5, rise: 0.36, hold: 0.12, back: 4, aimedAngle: 0.35 };
/** First half of the blowback: the hand jerks this far up across the screen (m) before flipping over the head. */
const BLOW_UP = 0.32;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const FLIP = { angle: 1.0, rise: 0.05, hold: 0.06, back: 7 };
/** Boomstick fling: arms up, legs swing forward into view. Aimed: half as much. */
const FLING = { arm: 0.22, leg: 2.0, rise: 0.09, hold: 0.32, back: 3.2, wiggle: 0.22, aimed: 0.5 };
/** Where the gun hand goes when aiming: centred, a little below the eye (the barrel lines up with the crosshair). */
const AIM_Z = -0.42;
const AIM_BELOW = 0.1;
/** Above this much aim the Spin Doctor's scope covers the view and the gun hides. */
const SCOPE_AT = 0.85;
/** Gunblade slash swing: seconds of the cut, how far the arm sweeps (rad), and how far the blade tilts flat. */
const SWING = { time: 0.2, back: 0.14, reaper: 1.5, sakura: 1.1, tilt: 1.0 };

interface GunModel {
  group: THREE.Group;
  /** In gun space (unscaled): where the right hand holds it, the left hand (or null), and the barrel's end. */
  grip: THREE.Vector3;
  fore: THREE.Vector3 | null;
  muzzle: THREE.Vector3;
  spinner?: THREE.Object3D;
}

type Part =
  | ["box", number, number, number, string, number, number, number]
  | ["cyl", number, number, string, number, number, number]
  | ["sph", number, string, number, number, number];

/** 0 -> 1 (ease-out, or smoothstep when smooth), hold, then ease back to 0: a recoil pose over time t (s). */
function envelope(t: number, rise: number, hold: number, back: number, smooth = false): number {
  if (t < 0) return 0;
  if (t < rise) {
    const k = t / rise;
    return smooth ? k * k * (3 - 2 * k) : 1 - (1 - k) * (1 - k);
  }
  if (t < rise + hold) return 1;
  return Math.exp(-(t - rise - hold) * back);
}

export class Viewmodel {
  readonly root = new THREE.Group();
  private readonly guns = new Map<WeaponId, GunModel>();
  private current: WeaponId = "pistol";
  private readonly armR = new THREE.Group(); // pivot at the right shoulder
  private readonly mount = new THREE.Group(); // at the right hand: the gun hangs here
  private readonly sleeveR: THREE.Mesh;
  private readonly gloveR: THREE.Mesh;
  private readonly hand = new THREE.Vector3(); // the right hand, relative to the shoulder pivot
  private readonly dir = new THREE.Vector3();
  private readonly armL = new THREE.Group(); // at the left shoulder, aimed at the foregrip
  private readonly sleeveL: THREE.Mesh;
  private readonly gloveL: THREE.Mesh;
  private readonly hips = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly flash: THREE.Mesh;
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];
  private kickAmt = 0;
  private flashT = 0;
  private blowT = 99;
  private flingT = 99;
  private blowAmp = BLOW.angle;
  private flingAmp = 1;
  private aim = 0;
  /** Reload progress 0..1 (0 = not reloading): the gun dips and tilts. */
  private reloadP = 0;
  private swingT = 99;
  private swingDir = 1;
  private swingAmp = SWING.sakura;
  /** Hold-move poses, eased 0..1: the Sakura's reversed blade (dash stance) and the scythe pulled in (hook). */
  private stancePose = 0;
  private hookPose = 0;
  private holdKind: "none" | "stance" | "hook" = "none";
  /** True while the Spin Doctor's scope covers the view (the HUD draws the scope). */
  scoped = false;
  private spin = 0;
  private time = 0;
  private readonly tmp = new THREE.Vector3();

  constructor() {
    const suit = this.mat(SUIT);
    const glove = this.mat(GLOVE);

    // right arm: a pivot at the shoulder (it swings the whole arm); inside it the hand moves (aim, the pistol's
    // jerk) and the sleeve is re-stretched from the shoulder to the hand every frame, so the shoulder never moves
    this.armR.position.copy(SHOULDER_R);
    this.root.add(this.armR);
    this.sleeveR = this.limb(1, SLEEVE, suit);
    this.armR.add(this.sleeveR);
    this.gloveR = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.045, 10, 8)), glove);
    this.armR.add(this.gloveR);
    this.armR.add(this.mount);
    this.placeHand(HAND_R.clone().sub(SHOULDER_R));

    // left arm: a unit sleeve stretched to reach the foregrip
    this.armL.position.copy(SHOULDER_L);
    this.root.add(this.armL);
    this.sleeveL = this.limb(1, SLEEVE, suit);
    this.armL.add(this.sleeveL);
    this.gloveL = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.045, 10, 8)), glove);
    this.root.add(this.gloveL);

    // legs: hidden below the view until a Boomstick shot throws them forward
    this.hips.position.copy(HIPS_REST);
    this.root.add(this.hips);
    for (const x of [-0.14, 0.14]) {
      const leg = new THREE.Group();
      leg.position.x = x;
      const thigh = new THREE.Mesh(this.geo(new THREE.CapsuleGeometry(0.075, 0.62, 3, 8)), suit);
      thigh.position.y = -0.38;
      const boot = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.15, 0.11, 0.26)), this.mat(BOOT));
      boot.position.set(0, -0.8, -0.05);
      leg.add(thigh, boot);
      this.hips.add(leg);
      this.legs.push(leg);
    }
    this.hips.visible = false;

    // the guns (unchanged shapes, now held by the hand at their grip)
    this.addGun("pistol", [
      ["box", 0.07, 0.09, 0.22, "#3fbf5a", 0, 0, 0],
      ["cyl", 0.025, 0.12, "#2b8a3e", 0, 0.015, -0.16],
      ["box", 0.05, 0.12, 0.06, "#6b4a2b", 0, -0.08, 0.06],
      ["sph", 0.035, "#b6f5c1", 0, 0.015, -0.23],
    ], new THREE.Vector3(0, -0.08, 0.06), null, new THREE.Vector3(0, 0.015, -0.25));
    this.addGun("shotgun", [
      ["cyl", 0.032, 0.62, "#3a3a44", -0.032, 0.02, -0.3],
      ["cyl", 0.032, 0.62, "#3a3a44", 0.032, 0.02, -0.3],
      ["box", 0.12, 0.1, 0.22, "#8b5a2b", 0, -0.02, 0.05],
      ["box", 0.09, 0.14, 0.2, "#6b4a2b", 0, -0.07, 0.2],
    ], new THREE.Vector3(0, -0.05, 0.1), new THREE.Vector3(0, -0.01, -0.32), new THREE.Vector3(0, 0.02, -0.62));
    this.addGun("sniper", [
      ["cyl", 0.022, 0.8, "#2a2f3a", 0, 0.01, -0.42],
      ["box", 0.08, 0.1, 0.36, "#7a4fd1", 0, -0.02, 0.0],
      ["cyl", 0.04, 0.24, "#1d1f26", 0, 0.1, -0.02],
      ["box", 0.07, 0.12, 0.18, "#5a3a9e", 0, -0.06, 0.22],
    ], new THREE.Vector3(0, -0.06, 0.12), new THREE.Vector3(0, -0.03, -0.22), new THREE.Vector3(0, 0.01, -0.84));
    const copter = this.addGun("copter", [
      ["box", 0.16, 0.14, 0.26, "#f28c28", 0, -0.02, 0.06],
      ["box", 0.05, 0.12, 0.08, "#3a3a44", 0, -0.12, 0.12],
      ["box", 0.04, 0.06, 0.12, "#3a3a44", 0, 0.08, -0.02],
    ], new THREE.Vector3(0, -0.12, 0.12), new THREE.Vector3(0, 0.1, -0.02), new THREE.Vector3(0, 0, -0.5));
    // Reaper's Kick: a weathered farm scythe (wood, rust, bone charm) with a sniper barrel along the shaft,
    // held tilted up so the blade shows above your hand
    const reaper = this.addGun("reaper", [
      ["cyl", 0.026, 1.35, "#7a5a3a", 0, 0, -0.32],
      ["cyl", 0.016, 0.95, "#2a2f3a", 0, 0.045, -0.5],
      ["box", 0.62, 0.11, 0.02, "#8d8a84", -0.27, 0.06, -0.98],
      ["box", 0.2, 0.05, 0.021, "#7a4a2a", -0.5, 0.02, -0.98],
      ["sph", 0.03, "#e8dcc0", 0.03, -0.09, -0.86],
      ["box", 0.06, 0.08, 0.1, "#5a3f2a", 0, -0.04, 0.15],
    ], new THREE.Vector3(0, -0.02, 0.2), new THREE.Vector3(0, 0, -0.42), new THREE.Vector3(0, 0.045, -0.98));
    reaper.group.rotation.set(0.4, -0.32, 0.05); // shaft up and to the right: the blade stays clear of the crosshair
    // Six-Shot Sakura: a katana with a revolver cylinder at the blade's base
    this.addGun("sakura", [
      ["box", 0.016, 0.05, 0.95, "#dfe3e8", 0, 0.01, -0.6],
      ["cyl", 0.026, 0.28, "#2a2a33", 0, 0, 0.02],
      ["cyl", 0.062, 0.016, "#b08a3e", 0, 0, -0.12],
      ["cyl", 0.045, 0.09, "#5a5a66", 0, 0.0, -0.18],
      ["sph", 0.025, "#f48fb1", 0, -0.05, 0.17],
    ], new THREE.Vector3(0, 0, 0.06), null, new THREE.Vector3(0, 0, -0.23));
    const spinner = new THREE.Group();
    spinner.position.set(0, 0, -0.25);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      spinner.add(this.part(["cyl", 0.018, 0.4, "#3a3a44", Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0]));
    }
    copter.group.add(spinner);
    copter.spinner = spinner;

    // muzzle flash: a flat yellow star at the barrel's end
    const s = new THREE.Shape();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? 0.025 : 0.07;
      const a = (i / 16) * Math.PI * 2;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const fm = new THREE.MeshBasicMaterial({ color: "#ffe066", depthTest: false, transparent: true, side: THREE.DoubleSide });
    this.mats.push(fm);
    this.flash = new THREE.Mesh(this.geo(new THREE.ShapeGeometry(s)), fm);
    this.flash.renderOrder = 1001;
    this.mount.add(this.flash);
    this.show("pistol");
  }

  show(id: WeaponId): void {
    this.guns.get(this.current)!.group.visible = false;
    this.current = id;
    const g = this.guns.get(id)!;
    g.group.visible = true;
    this.flash.position.copy(g.muzzle).sub(g.grip).multiplyScalar(GUN_SCALE);
    this.kickAmt = -0.4; // a little dip as the new gun comes up
    this.blowT = this.flingT = 99;
  }

  /** A shot of weapon: the general kick plus that gun's pose (smaller when aimed). trauma ~0..1. */
  fired(weapon: WeaponId, trauma: number, aimed = false): void {
    this.kickAmt = Math.min(1.2, this.kickAmt + (trauma * 1.6 + 0.15) * (aimed ? 0.5 : 1));
    this.flashT = 0.05;
    this.flash.rotation.z = Math.random() * Math.PI; // purely cosmetic randomness: not part of the sim
    if (weapon === "pistol") {
      this.blowT = 0;
      this.blowAmp = aimed ? BLOW.aimedAngle : BLOW.angle;
    }
    if (weapon === "shotgun") {
      this.flingT = 0;
      this.flingAmp = aimed ? FLING.aimed : 1;
    }
  }

  /** A gunblade slash: the arm sweeps across (Sakura cuts alternate direction through a combo). */
  slashed(weapon: WeaponId, combo: number): void {
    this.swingT = 0;
    this.swingAmp = weapon === "reaper" ? SWING.reaper : SWING.sakura;
    this.swingDir = weapon === "sakura" && combo % 2 === 0 ? -1 : 1;
  }

  /** The hold move's pose: "stance" (blade held backwards), "hook" (scythe wrapped round an enemy) or "none". */
  setHold(kind: "none" | "stance" | "hook"): void {
    this.holdKind = kind;
  }

  /** A bigger, slower sweep (the ULTRASLASH). */
  ultra(): void {
    this.swingT = 0;
    this.swingAmp = SWING.reaper * 1.3;
    this.swingDir = 1;
  }

  /** Reload progress 0..1 (0 when not reloading). */
  setReload(p: number): void {
    this.reloadP = Math.max(0, Math.min(1, p));
  }

  /** How far the gun is raised to the sights, 0 (hip) .. 1 (aimed). */
  setAim(a: number): void {
    this.aim = Math.max(0, Math.min(1, a));
  }

  /** The gun hand's aimed position for the current gun (centred so the barrel sits under the crosshair). */
  private aimHand(out: THREE.Vector3): THREE.Vector3 {
    const g = this.guns.get(this.current)!;
    return out.set(0, -(g.muzzle.y - g.grip.y) * GUN_SCALE - AIM_BELOW, AIM_Z);
  }

  /** Where tracers start, in world space: the gun's muzzle at its rest (or aimed) pose, never the animated one. */
  muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    const g = this.guns.get(this.current)!;
    const hand = this.aimHand(new THREE.Vector3()).lerp(HAND_R, 1 - this.aim);
    out.copy(g.muzzle).sub(g.grip).multiplyScalar(GUN_SCALE).add(hand);
    return this.root.localToWorld(out);
  }

  update(dt: number, copterFiring: boolean): void {
    this.time += dt;
    this.blowT += dt;
    this.flingT += dt;
    this.kickAmt *= Math.exp(-10 * dt);
    const k = this.kickAmt;
    const blow = envelope(this.blowT, BLOW.rise, BLOW.hold, BLOW.back, true) * (this.blowAmp / BLOW.angle);
    const flip = this.current === "pistol" ? envelope(this.blowT, FLIP.rise, FLIP.hold, FLIP.back) : 0;
    const fling = envelope(this.flingT, FLING.rise, FLING.hold, FLING.back) * this.flingAmp;
    const wig = Math.sin(this.time * 24) * FLING.wiggle * fling;
    const judder = copterFiring ? Math.sin(this.time * 70) * 0.025 : 0;

    // pistol blowback in two halves: the hand jerks up across the screen, then the arm flips over the head
    const up = Math.min(1, blow / 0.5);
    const over = Math.max(0, (blow - 0.5) / 0.5);
    // right arm: general kick + blowback + Boomstick fling (up and forward)
    // (the general kick is muted while flung, or it would carry the gun up out of view)
    const kick = Math.max(0, k) * 0.3 * (1 - fling);
    this.armR.rotation.set(kick + over * BLOW.angle + fling * FLING.arm + wig + judder, 0, over * BLOW.twist - fling * 0.25);
    this.armR.position.set(SHOULDER_R.x, SHOULDER_R.y - Math.max(0, -k) * 0.12, SHOULDER_R.z + Math.max(0, k) * 0.06 * (1 - fling));
    this.armR.position.addScaledVector(ARM_FLUNG_SHIFT, fling);
    // the hand: rest -> aimed (centre) as the right mouse is held, plus the blowback's upward jerk
    const aimNow = this.aim * (1 - fling); // a Boomstick fling knocks you off your sights
    const hand = this.aimHand(this.tmp).lerp(HAND_R, 1 - aimNow).sub(SHOULDER_R);
    hand.y += up * BLOW_UP;
    hand.z -= up * 0.05;
    this.placeHand(hand);
    // reloading: the gun dips down and rolls over, then comes back up (a placeholder reload)
    const dip = this.reloadP > 0 ? Math.sin(Math.PI * this.reloadP) : 0;
    this.armR.rotation.x -= dip * 0.55;
    // the wrist snaps the barrel up before the arm follows (pistol)
    this.mount.rotation.x = flip * FLIP.angle * (this.blowAmp / BLOW.angle);
    this.mount.rotation.z = dip * 0.9;
    // hold moves: the Sakura's blade turns to point behind you; the scythe is pulled in tight around its catch
    const ease = 1 - Math.exp(-14 * dt);
    this.stancePose += ((this.holdKind === "stance" ? 1 : 0) - this.stancePose) * ease;
    this.hookPose += ((this.holdKind === "hook" ? 1 : 0) - this.hookPose) * ease;
    this.mount.rotation.y = this.stancePose * Math.PI * 0.85; // set, never add: "+=" spun the blade every frame (playtest)
    this.armR.rotation.x -= this.stancePose * 0.25;
    this.armR.rotation.x += this.hookPose * 0.35;
    this.armR.rotation.y += this.hookPose * 0.45;
    // a slash: sweep from right to left (or back), the blade laid flat for the cut, then settle
    this.swingT += dt;
    if (this.swingT < SWING.time + SWING.back) {
      const k = Math.min(1, this.swingT / SWING.time);
      const sweep = this.swingT < SWING.time ? 1 - 2 * (k * k * (3 - 2 * k)) : -1 + (this.swingT - SWING.time) / SWING.back;
      this.armR.rotation.y += this.swingDir * sweep * this.swingAmp * 0.6;
      this.mount.rotation.z += this.swingDir * SWING.tilt * Math.sin(Math.PI * Math.min(1, this.swingT / (SWING.time + SWING.back)));
    }
    this.scoped = this.current === "sniper" && this.aim > SCOPE_AT;
    this.armR.visible = !this.scoped;

    // left hand: on the foregrip, flung loose by the Boomstick; hidden for the one-handed pistol
    const g = this.guns.get(this.current)!;
    const twoHanded = g.fore !== null;
    this.armL.visible = this.gloveL.visible = (twoHanded || fling > 0.05) && !this.scoped;
    if (this.armL.visible) {
      this.root.updateMatrixWorld(true);
      const target = this.tmp;
      if (g.fore) g.group.localToWorld(target.copy(g.fore));
      else this.root.localToWorld(target.copy(LEFT_FLUNG));
      this.root.worldToLocal(target);
      target.lerp(LEFT_FLUNG, fling);
      target.y += Math.cos(this.time * 21) * FLING.wiggle * 0.3 * fling;
      const reach = target.clone().sub(SHOULDER_L);
      this.sleeveL.scale.z = reach.length();
      this.armL.lookAt(this.root.localToWorld(target.clone()));
      this.gloveL.position.copy(target);
    }

    // legs: swing forward into view while flung, kicking a little out of step
    this.hips.visible = fling > 0.02;
    if (this.hips.visible) {
      this.hips.position.lerpVectors(HIPS_REST, HIPS_FLUNG, fling);
      this.legs.forEach((leg, i) => {
        leg.rotation.x = fling * FLING.leg + (i ? 1 : -1) * Math.sin(this.time * 18) * 0.25 * fling;
      });
    }

    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.visible = this.flashT > 0;
    this.flash.scale.setScalar(this.current === "shotgun" ? 2.2 : this.current === "sniper" ? 1.8 : 1);
    this.spin += (copterFiring ? 30 : 0) * dt;
    if (g.spinner) g.spinner.rotation.z = this.spin;
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }

  /** Puts the gun hand at h (relative to the shoulder pivot) and stretches the sleeve to it. */
  private placeHand(h: THREE.Vector3): void {
    // copy first: callers pass this.tmp, and normalizing it in place once made every sleeve 1 m long
    // (the "second arm sticking out of the gun", playtest 3)
    this.hand.copy(h);
    this.mount.position.copy(this.hand);
    this.gloveR.position.copy(this.hand);
    this.sleeveR.scale.z = this.hand.length();
    this.sleeveR.quaternion.setFromUnitVectors(Z_AXIS, this.dir.copy(this.hand).normalize());
  }

  // ---- building --------------------------------------------------------------
  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  private mat(color: string): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    this.mats.push(m);
    return m;
  }

  /** A sleeve from the group's origin along +Z, `length` long. */
  private limb(length: number, radius: number, mat: THREE.Material): THREE.Mesh {
    const g = this.geo(new THREE.CylinderGeometry(radius, radius * 1.15, 1, 10));
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, 0.5);
    const m = new THREE.Mesh(g, mat);
    m.scale.z = length;
    return m;
  }

  private addGun(id: WeaponId, parts: Part[], grip: THREE.Vector3, fore: THREE.Vector3 | null, muzzle: THREE.Vector3): GunModel {
    const group = new THREE.Group();
    for (const p of parts) group.add(this.part(p));
    group.scale.setScalar(GUN_SCALE);
    group.position.copy(grip).multiplyScalar(-GUN_SCALE); // the grip sits in the hand
    group.visible = false;
    this.mount.add(group);
    const gun: GunModel = { group, grip, fore, muzzle };
    this.guns.set(id, gun);
    return gun;
  }

  private part(p: Part): THREE.Mesh {
    let geo: THREE.BufferGeometry;
    let color: string;
    let pos: [number, number, number];
    if (p[0] === "box") {
      geo = new THREE.BoxGeometry(p[1], p[2], p[3]);
      color = p[4];
      pos = [p[5], p[6], p[7]];
    } else if (p[0] === "cyl") {
      geo = new THREE.CylinderGeometry(p[1], p[1], p[2], 10);
      geo.rotateX(Math.PI / 2);
      color = p[3];
      pos = [p[4], p[5], p[6]];
    } else {
      geo = new THREE.SphereGeometry(p[1], 10, 8);
      color = p[2];
      pos = [p[3], p[4], p[5]];
    }
    const m = new THREE.Mesh(this.geo(geo), this.mat(color));
    m.position.set(...pos);
    return m;
  }
}
