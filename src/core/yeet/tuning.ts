// ---------------------------------------------------------------------------
// tuning.ts
// Purpose : Every number that decides how Yeetpowder's toy feels: movement, recoil per gun, wall bonks, dummies,
//           the Gatling Copter, aiming, run-and-gun tumbles, and the dummies that fight back. One place to tune;
//           nothing in the sim hard-codes these.
// Usage   : import { TUNING } from "./tuning"; sim = new YeetSim(TUNING, level) (tests pass a modified copy).
// Notes   : Units: meters, seconds, m/s (velocity change for recoil: every body has mass 1, so an "impulse" here
//           is a direct velocity kick). Angles in radians; yaw going DOWN turns you right. Vite hot-reloads this
//           file while `dev.py run` is open.
//           GDD targets: no single shot moves a player more than ~25 m; two Boomstick blasts cross a medium room;
//           the Spin Doctor leaves its user disoriented for ~1 s.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// Updated : 2026-11-21 with Claude (Opus 5.5, claude-opus-5-5): playtest 3: twist model, air recoil, tumbles, AI
// ---------------------------------------------------------------------------

export type WeaponId = "pistol" | "shotgun" | "sniper" | "copter";

export interface WeaponTuning {
  /** Shown in the HUD. */
  name: string;
  /** true: holding fire keeps shooting (copter); false: one shot per click. */
  auto: boolean;
  /** Seconds between shots. */
  cooldown: number;
  /** Velocity kick on the shooter, opposite the aim (m/s). The heart of the game. Same aimed or hip. */
  recoil: number;
  /** Fraction of the recoil a shot fired in mid-air gives (the pistol's hover-skip; 1 = full). */
  airRecoil: number;
  /**
   * Mid-air shots cannot push your upward speed past this (m/s): the pistol can slow a fall (hover-skip) but not
   * climb. Big guns: no cap (999).
   */
  airLiftCap: number;
  /**
   * Hip-fire twist (rad/s of yaw, to the RIGHT): the gun sits right of your centre, so its kick turns you.
   * Aimed, the gun is centred and the twist shrinks to aim.braced.twist of this. Decays with player.spinDamping.
   */
  twist: number;
  /** Aimed, the twist is this fraction of the hip twist (the gun is centred). The Spin Doctor still spins you. */
  aimedTwist: number;
  /** Extra upward kick when fired from the ground (m/s), so a small push becomes a visible hop backward. */
  hop: number;
  /** Damage per pellet. */
  damage: number;
  /** Pellets per shot (rays). */
  pellets: number;
  /** Cone half-angle of the pellet pattern (rad). */
  spread: number;
  /** Velocity kick on a dummy per pellet hit, along the shot (m/s). */
  knockback: number;
  /** Max hit distance (m). */
  range: number;
  /** Screen shake trauma added per shot (0..1). */
  trauma: number;
}

export const TUNING = {
  /** Fixed simulation step (s). The render loop runs as many steps as real time needs. */
  step: 1 / 120,
  gravity: 22,

  player: {
    halfWidth: 0.4,
    height: 1.7,
    eyeHeight: 1.55,
    runSpeed: 7,
    groundAccel: 70, // reaching run speed: ~0.1 s
    airAccel: 9, // limited air control: a big launch is committed but not hopeless
    /** Above run speed on the ground, slide down at this rate (m/s^2): recoil slides, it does not stop dead. */
    groundFriction: 30, // playtest 1: 16 -> 30 so a doubled Boomstick shot stays near ~25 m
    /** Light air drag so stacked launches stay under the GDD's ~25 m per shot. */
    airDrag: 0.15,
    jumpSpeed: 7.5,
    /** Yaw spin decay (1/s): sniper spin ~14 rad/s fades in about a second. */
    spinDamping: 3.2,
    maxPitch: 1.55,
    hp: 100,
    /** Seconds from being knocked out to respawning (Fight Back). */
    respawnDelay: 2.2,
  },

  bonk: {
    /** Hitting a wall faster than this (m/s, into the wall) stuns. Above sprint speed, so only launches bonk. */
    speed: 12, // playtest 4: 9 -> 12 (sprinting at 11 m/s into a wall must not stun you)
    stun: 0.5,
    /** Fraction of the into-wall speed kept as a bounce. */
    bounce: 0.25,
    trauma: 0.6,
  },

  /** A big launch: speed over this pops "YEET!" (m/s). */
  yeetSpeed: 13,

  /**
   * Run-and-gun penalty (playtest 3): a shot fired while moving may knock you into a tumble (no control, the camera
   * pops out to third person). Chance = base * (recoil / 15) * (speed / runSpeed), at most max; aimed shots
   * multiply it by aimed. The Gatling Copter never tumbles you (it kicks you out of zoom instead).
   */
  tumble: {
    minSpeed: 3, // m/s: slower than this is not "moving"
    base: 0.3,
    max: 0.55,
    aimed: 0.5,
    duration: 1.3, // s of no control (then until you land, at most maxDuration)
    maxDuration: 3,
    pop: 4, // m/s upward when it starts
    spin: 9, // rad/s yaw (to the right) when it starts
    roll: 11, // rad/s of head-over-heels tumble for the third-person body
  },

  /** Hold Shift to sprint for a few seconds (playtest 4). Firing while sprinting doubles the tumble chance. */
  sprint: {
    speed: 11, // m/s (run is 7)
    stamina: 3, // s of sprint when full
    regenDelay: 0.8, // s after you stop before it refills
    regen: 1, // s of stamina back per s
    winded: 0.3, // emptied: no sprint again until it is back above this fraction
    tumbleMult: 2,
  },

  dummy: {
    hp: 100,
    /** Extra upward kick per hit so knocked dummies leave the floor (m/s). */
    lift: 2.5,
  },

  /** Fight Back: dummies that shoot back. Readable and dodgeable on purpose (GDD: loud, visible, counterable). */
  ai: {
    range: 38, // m: farther than this they ignore you
    telegraph: 0.8, // s of glowing red before each shot
    cooldown: 2.4, // s between shots (each dummy is offset a little so they do not all fire at once)
    ballSpeed: 20, // m/s: a ball you can sidestep or recoil away from
    ballRadius: 0.2,
    ballLife: 3,
    damage: 14,
    knockback: 6, // m/s on you, along the ball's path (+1.5 up)
    turnRate: 4, // rad/s they turn to face you
  },

  copter: {
    /** Upward-capable push while firing (m/s^2), opposite the aim; must beat gravity to hover when aimed down. */
    thrust: 52, // playtest 1: x2 (was 26)
    /** Extra drag on every axis while the copter fires (1/s): caps climb and drift so it hovers, not rockets. */
    drag: 1.2,
    /** While firing, the copter turns you right (rad/s^2 of yaw; settles at torque / player.spinDamping rad/s). */
    torque: 6,
    /** While firing, the aim wanders (rad/s of drift on yaw and pitch): hard to aim on purpose. */
    wobble: 1.4,
    /** Heat gained per second of fire; at heatMax the copter overheats and crashes. */
    heatPerSecond: 1,
    heatMax: 5,
    coolPerSecond: 1.6,
    /** While crashing: forced spin (rad/s, to the right) and no firing until landed and fully cooled. */
    crashSpin: 9,
    crashDamage: 60,
    crashRadius: 3.5,
    crashKnockback: 12,
    crashTrauma: 0.9,
  },

  weapons: {
    pistol: {
      name: "Pea Pistol", auto: false, cooldown: 0.16,
      recoil: 11, // playtest 3: 7.5 -> 11 ("still more kickback")
      airRecoil: 0.32, // mid-air taps roughly cancel gravity: hover-skip, not a jetpack (keeps the tower shotgun-only)
      airLiftCap: 1, // ... and they can slow a fall but never add climb
      twist: 1.2, aimedTwist: 0.15, hop: 4.5, damage: 15, pellets: 1,
      spread: 0, knockback: 2.5, range: 80, trauma: 0.14,
    },
    shotgun: {
      name: "Boomstick", auto: false, cooldown: 0.75, recoil: 30, airRecoil: 1, airLiftCap: 999,
      twist: 3, aimedTwist: 0.15, hop: 0, damage: 9, pellets: 9,
      spread: 0.09, knockback: 2.2, range: 30, trauma: 0.5,
    },
    sniper: {
      name: "Spin Doctor", auto: false, cooldown: 1.1, recoil: 16, airRecoil: 1, airLiftCap: 999,
      twist: 14, aimedTwist: 0.7, hop: 0, damage: 100, pellets: 1, // a top from the hip; scoped, still a spin (playtest 4)
      spread: 0, knockback: 16, range: 200, trauma: 0.55,
    },
    copter: {
      name: "Gatling Copter", auto: true, cooldown: 0.06, recoil: 0, airRecoil: 1, airLiftCap: 999, twist: 0, aimedTwist: 0, hop: 0, damage: 5,
      pellets: 1, spread: 0.03, knockback: 1.2, range: 60, trauma: 0.06,
    },
  } satisfies Record<WeaponId, WeaponTuning>,

  weaponOrder: ["pistol", "shotgun", "sniper", "copter"] as WeaponId[],

  /** Pick up a gun by walking within this distance of it (m, from your middle). */
  pickupRadius: 1.4,

  /** Right-click aim: field of view per gun (degrees; hip fire is 75) and how fast the zoom moves (s). */
  aim: {
    hipFov: 75,
    fov: { pistol: 55, shotgun: 60, sniper: 18, copter: 62 } satisfies Record<WeaponId, number>,
    time: 0.12,
    /**
     * Aimed fire (playtest 3: physics, not a weaker gun): the gun is centred, so the kick goes straight back
     * (full recoil and hop) and hardly twists you; the pellets group tighter. The copter still judders, less.
     */
    braced: { recoil: 1, hop: 1, spread: 0.3, copterTurn: 0.5, copterWobble: 0.4 }, // twist: per gun (aimedTwist)
  },

  /** Mouse look (rad per pixel of mouse movement). Scaled down while aiming, with the zoom. */
  mouseSensitivity: 0.0022,
};

export type Tuning = typeof TUNING;
