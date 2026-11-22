// ---------------------------------------------------------------------------
// viewmodel.ts
// Purpose : What you see of yourself in first person: the operative's navy sleeves and black tactical gloves holding
//           the current gun (low-poly models from gunModels.ts), legs that only show when you are thrown, and the
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
//           2026-11-22 with Claude (Opus 5.5, claude-opus-5-5): art pass 2 (navy sleeves, gloves, gun models)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import type { WeaponId } from "../../core/yeet/tuning";
import { buildGlove } from "./glove";
import { buildWeapon } from "./gunModels";
import { MaterialBank } from "./materials";
import { buildMuzzleFlash } from "./muzzleFlash";

// ---- Tunables (presentation) --------------------------------------------------
/** Sleeve radius at the wrist and at the shoulder (a tapered six-sided tube: the GDD's faceted N64 look). */
const SLEEVE = { wrist: 0.032, shoulder: 0.046, sides: 6 };
/**
 * How each gun is held (the grip, foregrip and muzzle come from its model, gunModels.ts): the gun hand's offset
 * from HAND_R and the gun's tilt about the grip (sizes come from the models). The Gatling is held low by its rear
 * D-handle with the left hand on the carry handle (playtest); the scythe is tilted up and right so its crescent
 * stays clear of the crosshair. `aim` replaces the usual aimed pose (barrel under the crosshair): the Gatling slides
 * to the middle but stays at hip height and straightens, so it never covers what you shoot at (playtest).
 */
interface Hold {
  hand: THREE.Vector3;
  tilt: THREE.Euler;
  aim?: { hand: THREE.Vector3; tilt: THREE.Euler };
}
const HOLD: Partial<Record<WeaponId, Hold>> = {
  copter: {
    hand: new THREE.Vector3(0.1, -0.2, 0.12),
    tilt: new THREE.Euler(0.1, 0.18, 0),
    aim: { hand: new THREE.Vector3(0, -0.43, -0.3), tilt: new THREE.Euler(0.08, 0, 0) },
  },
  reaper: { hand: new THREE.Vector3(0.02, -0.05, 0.06), tilt: new THREE.Euler(0.12, -0.22, 0) },
};
/** Glove size: chunky, but small enough that the Pea Pistol still shows in the fist. */
const GLOVE_SCALE = 0.85;
const SOLE = "#2b2d32";
/** The right glove's turn in the hand (rad): fingers forward, the cuff angled back toward the sleeve. */
const GLOVE_R_TILT = new THREE.Euler(0.45, Math.PI - 0.25, 0);
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
/** The wrist snap that throws the barrel up. Aimed shots keep most of it (playtest: the aimed pistol felt dead). */
const FLIP = { angle: 1.0, rise: 0.05, hold: 0.06, back: 7, aimed: 0.75 };
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
  /** At the hand: carries the gun's tilt (HOLD), eased toward the aimed tilt while aiming. */
  pivot: THREE.Group;
  /** Model units to metres (from the model). */
  scale: number;
  spinner?: THREE.Object3D;
}

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
  private readonly gloveR: THREE.Group;
  private readonly hand = new THREE.Vector3(); // the right hand, relative to the shoulder pivot
  private readonly dir = new THREE.Vector3();
  private readonly armL = new THREE.Group(); // at the left shoulder, aimed at the foregrip
  private readonly sleeveL: THREE.Mesh;
  private readonly gloveL: THREE.Group;
  /** Shared materials and the geometry they are built on (materials.ts). */
  private readonly bank = new MaterialBank();
  private readonly hips = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly flash: THREE.Group;
  private readonly flashMats: THREE.Material[];
  private kickAmt = 0;
  private flashT = 0;
  private blowT = 99;
  private flingT = 99;
  private blowAmp = BLOW.angle;
  private flingAmp = 1;
  private flipAmp = 1;
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
  private readonly tmp2 = new THREE.Vector3();
  private readonly qRest = new THREE.Quaternion();
  private readonly qAim = new THREE.Quaternion();

  constructor() {
    const suit = this.bank.paint("navy");

    // right arm: a pivot at the shoulder (it swings the whole arm); inside it the hand moves (aim, the pistol's
    // jerk) and the sleeve is re-stretched from the shoulder to the hand every frame, so the shoulder never moves.
    // The glove rides in the mount with the gun, so wrist flicks and slashes turn the fist with the grip.
    this.armR.position.copy(SHOULDER_R);
    this.root.add(this.armR);
    this.sleeveR = this.limb(suit);
    this.armR.add(this.sleeveR);
    this.armR.add(this.mount);
    this.gloveR = this.glove(1);
    this.gloveR.rotation.copy(GLOVE_R_TILT);
    this.mount.add(this.gloveR);
    this.placeHand(HAND_R.clone().sub(SHOULDER_R));

    // left arm: a unit sleeve stretched to reach the foregrip; the glove turns with the forearm each frame
    this.armL.position.copy(SHOULDER_L);
    this.root.add(this.armL);
    this.sleeveL = this.limb(suit);
    this.armL.add(this.sleeveL);
    this.gloveL = this.glove(-1);
    this.root.add(this.gloveL);

    // legs: hidden below the view until a Boomstick shot throws them forward
    this.hips.position.copy(HIPS_REST);
    this.root.add(this.hips);
    for (const x of [-0.14, 0.14]) {
      const leg = new THREE.Group();
      leg.position.x = x;
      const thigh = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.068, 0.085, 0.76, 6)), suit);
      thigh.position.y = -0.38;
      const boot = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.15, 0.13, 0.27)), this.bank.paint("leather"));
      boot.position.set(0, -0.8, -0.05);
      const sole = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.16, 0.035, 0.29)), this.bank.plain(SOLE));
      sole.position.set(0, -0.875, -0.05);
      leg.add(thigh, boot, sole);
      this.hips.add(leg);
      this.legs.push(leg);
    }
    this.hips.visible = false;

    // the guns: low-poly models (gunModels.ts) held by the hand at their grip
    for (const id of ["pistol", "shotgun", "sniper", "copter", "reaper", "sakura"] as WeaponId[]) this.addGun(id);

    // muzzle flash: yeetpowder's pink star at the barrel's end, over everything (muzzleFlash.ts)
    const flash = buildMuzzleFlash(this.bank, { overlay: true });
    this.flash = flash.group;
    this.flashMats = flash.materials;
    this.mount.add(this.flash);
    this.show("pistol");
  }

  show(id: WeaponId): void {
    this.guns.get(this.current)!.group.visible = false;
    this.current = id;
    const g = this.guns.get(id)!;
    g.group.visible = true;
    this.flash.position.copy(g.muzzle).sub(g.grip).multiplyScalar(g.scale);
    const tilt = HOLD[id]?.tilt;
    if (tilt) this.flash.position.applyEuler(tilt); // the gun is tilted about the grip
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
      this.flipAmp = aimed ? FLIP.aimed : 1;
    }
    if (weapon === "shotgun") {
      this.flingT = 0;
      this.flingAmp = aimed ? FLING.aimed : 1;
    }
  }

  /** Debug (?flash): keeps the muzzle flash showing, for stills. */
  holdFlash(): void {
    this.flashT = Math.max(this.flashT, 0.05);
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
    const own = HOLD[this.current]?.aim;
    if (own) return out.copy(own.hand);
    return out.set(0, -(g.muzzle.y - g.grip.y) * g.scale - AIM_BELOW, AIM_Z);
  }

  /** Where tracers start, in world space: the gun's muzzle at its rest (or aimed) pose, never the animated one. */
  muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    const g = this.guns.get(this.current)!;
    const hand = this.aimHand(new THREE.Vector3()).lerp(this.restHand(this.tmp2), 1 - this.aim);
    out.copy(g.muzzle).sub(g.grip).multiplyScalar(g.scale).applyQuaternion(g.pivot.quaternion).add(hand);
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
    const flung = envelope(this.flingT, FLING.rise, FLING.hold, FLING.back);
    const fling = flung * this.flingAmp; // the arms: half as much when aimed (braced)
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
    const hand = this.aimHand(this.tmp).lerp(this.restHand(this.tmp2), 1 - aimNow).sub(SHOULDER_R);
    hand.y += up * BLOW_UP;
    hand.z -= up * 0.05;
    this.placeHand(hand);
    this.tiltGun(aimNow);
    // reloading: the gun dips down and rolls over, then comes back up (a placeholder reload)
    const dip = this.reloadP > 0 ? Math.sin(Math.PI * this.reloadP) : 0;
    this.armR.rotation.x -= dip * 0.55;
    // the wrist snaps the barrel up before the arm follows (pistol)
    this.mount.rotation.x = flip * FLIP.angle * this.flipAmp;
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
      this.gloveL.quaternion.copy(this.armL.quaternion); // the fist points along the forearm
    }

    // legs: swing forward into view while flung, kicking a little out of step (always in full, aimed or not:
    // the legs are what sells a Boomstick launch)
    this.hips.visible = flung > 0.02;
    if (this.hips.visible) {
      this.hips.position.lerpVectors(HIPS_REST, HIPS_FLUNG, flung);
      this.legs.forEach((leg, i) => {
        leg.rotation.x = flung * FLING.leg + (i ? 1 : -1) * Math.sin(this.time * 18) * 0.25 * flung;
      });
    }

    // visible first, then count down: a shot always shows for at least one drawn frame, even when a frame takes
    // longer than the flash (slow devices, the headless smoke browser)
    this.flash.visible = this.flashT > 0;
    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.scale.setScalar(this.current === "shotgun" ? 2.2 : this.current === "sniper" ? 1.8 : 1);
    this.spin += (copterFiring ? 30 : 0) * dt;
    if (g.spinner) g.spinner.rotation.z = this.spin;
  }

  dispose(): void {
    this.bank.dispose();
    for (const m of this.flashMats) m.dispose();
  }

  /** Puts the gun hand at h (relative to the shoulder pivot) and stretches the sleeve to it. */
  private placeHand(h: THREE.Vector3): void {
    // copy first: callers pass this.tmp, and normalizing it in place once made every sleeve 1 m long
    // (the "second arm sticking out of the gun", playtest 3)
    this.hand.copy(h);
    this.mount.position.copy(this.hand);
    this.sleeveR.scale.z = this.hand.length();
    this.sleeveR.quaternion.setFromUnitVectors(Z_AXIS, this.dir.copy(this.hand).normalize());
  }

  // ---- building --------------------------------------------------------------
  private geo<T extends THREE.BufferGeometry>(g: T): T {
    return this.bank.geo(g);
  }

  /** A sleeve from the group's origin along +Z, 1 m long (scale.z stretches it), tapering to the wrist. */
  private limb(mat: THREE.Material): THREE.Mesh {
    const g = this.geo(new THREE.CylinderGeometry(SLEEVE.wrist, SLEEVE.shoulder, 1, SLEEVE.sides));
    g.rotateX(Math.PI / 2); // +Y (the wrist end) -> +Z
    g.translate(0, 0, 0.5);
    return new THREE.Mesh(g, mat);
  }

  /** The operative's fingerless glove (glove.ts), a little smaller in first person so the Pea Pistol shows. */
  private glove(thumbSide: number): THREE.Group {
    const g = buildGlove(this.bank, thumbSide, this.bank.paint("navy"));
    g.scale.setScalar(GLOVE_SCALE);
    return g;
  }

  /** The gun hand's rest position for the current gun (HAND_R plus its HOLD offset). */
  private restHand(out: THREE.Vector3): THREE.Vector3 {
    out.copy(HAND_R);
    const h = HOLD[this.current];
    return h ? out.add(h.hand) : out;
  }

  private addGun(id: WeaponId): void {
    const model = buildWeapon(id, this.bank.gunKit(id));
    const { group, grip, fore, muzzle } = model;
    // a pivot at the hand carries the gun's tilt, so a tilted gun still sits in the hand by its grip
    const pivot = new THREE.Group();
    const tilt = HOLD[id]?.tilt;
    if (tilt) pivot.rotation.copy(tilt);
    const scale = model.scale;
    group.scale.setScalar(scale);
    group.position.copy(grip).multiplyScalar(-scale); // the grip sits in the hand
    group.visible = false;
    pivot.add(group);
    this.mount.add(pivot);
    this.guns.set(id, { group, grip, fore, muzzle, pivot, scale, spinner: model.spinner });
  }

  /** Eases the current gun's tilt from its rest hold to its aimed hold (only guns with HOLD.aim change). */
  private tiltGun(aim: number): void {
    const h = HOLD[this.current];
    if (!h?.aim) return;
    const g = this.guns.get(this.current)!;
    this.qRest.setFromEuler(h.tilt);
    this.qAim.setFromEuler(h.aim.tilt);
    g.pivot.quaternion.slerpQuaternions(this.qRest, this.qAim, aim);
  }
}
