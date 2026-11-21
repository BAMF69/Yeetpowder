// ---------------------------------------------------------------------------
// tuning.ts
// Purpose : Every number that decides how Yeetpowder's toy feels: movement, recoil per gun, wall bonks, dummies,
//           the Gatling Copter. One place to tune; nothing in the sim hard-codes these.
// Usage   : import { TUNING } from "./tuning"; sim = new YeetSim(TUNING) (tests pass a modified copy).
// Notes   : Units: meters, seconds, m/s (velocity change for recoil: every body has mass 1, so an "impulse" here
//           is a direct velocity kick). Angles in radians. Vite hot-reloads this file while `dev.py run` is open.
//           GDD targets: no single shot moves a player more than ~25 m; two Boomstick blasts cross a medium room;
//           the Spin Doctor leaves its user disoriented for ~1 s.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------

export type WeaponId = "pistol" | "shotgun" | "sniper" | "copter";

export interface WeaponTuning {
  /** Shown in the HUD. */
  name: string;
  /** true: holding fire keeps shooting (copter); false: one shot per click. */
  auto: boolean;
  /** Seconds between shots. */
  cooldown: number;
  /** Velocity kick on the shooter, opposite the aim (m/s). The heart of the game. */
  recoil: number;
  /** Yaw spin kick on the shooter (rad/s), decays with player.spinDamping. */
  spin: number;
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
    groundFriction: 30, // playtest 2026-11-21: 16 -> 30 so a doubled Boomstick shot stays near ~25 m
    /** Light air drag so stacked launches stay under the GDD's ~25 m per shot. */
    airDrag: 0.15,
    jumpSpeed: 7.5,
    /** Yaw spin decay (1/s): sniper spin ~14 rad/s fades in about a second. */
    spinDamping: 3.2,
    maxPitch: 1.55,
    respawn: { x: 0, y: 0, z: 14 },
    respawnYaw: 0,
  },

  bonk: {
    /** Hitting a wall faster than this (m/s, into the wall) stuns. */
    speed: 9,
    stun: 0.5,
    /** Fraction of the into-wall speed kept as a bounce. */
    bounce: 0.25,
    trauma: 0.6,
  },

  /** A big launch: speed over this pops "YEET!" (m/s). */
  yeetSpeed: 13,

  dummy: {
    hp: 100,
    respawnDelay: 2.5,
    /** Extra upward kick per hit so knocked dummies leave the floor (m/s). */
    lift: 2.5,
  },

  copter: {
    /** Upward-capable push while firing (m/s^2), opposite the aim; must beat gravity to hover when aimed down. */
    thrust: 52, // playtest 2026-11-21: x2 (was 26)
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
    /** While crashing: forced spin (rad/s) and no firing until landed and fully cooled. */
    crashSpin: 9,
    crashDamage: 60,
    crashRadius: 3.5,
    crashKnockback: 12,
    crashTrauma: 0.9,
  },

  weapons: {
    pistol: {
      name: "Pea Pistol", auto: false, cooldown: 0.16, recoil: 7.5, // playtest: 4.2 -> 7.5
      hop: 3.5, // playtest 2: the push now carries (GDD: "small hop backward")
      spin: 0, damage: 15, pellets: 1,
      spread: 0, knockback: 2.5, range: 80, trauma: 0.12,
    },
    shotgun: {
      name: "Boomstick", auto: false, cooldown: 0.75, recoil: 30, // playtest: x2 (was 15)
      hop: 0, spin: 0.8, damage: 9, pellets: 9,
      spread: 0.09, knockback: 2.2, range: 30, trauma: 0.5,
    },
    sniper: {
      name: "Spin Doctor", auto: false, cooldown: 1.1, recoil: 16, // playtest: 10 -> 16
      hop: 0, spin: 14, damage: 100, pellets: 1,
      spread: 0, knockback: 16, range: 200, trauma: 0.55,
    },
    copter: {
      name: "Gatling Copter", auto: true, cooldown: 0.06, recoil: 0, hop: 0, spin: 0, damage: 5, pellets: 1,
      spread: 0.03, knockback: 1.2, range: 60, trauma: 0.06,
    },
  } satisfies Record<WeaponId, WeaponTuning>,

  weaponOrder: ["pistol", "shotgun", "sniper", "copter"] as WeaponId[],

  /** Right-click aim: field of view per gun (degrees; hip fire is 75) and how fast the zoom moves (s). */
  aim: {
    hipFov: 75,
    fov: { pistol: 55, shotgun: 60, sniper: 18, copter: 62 } satisfies Record<WeaponId, number>,
    time: 0.12,
    /**
     * Aimed fire is braced (Claude's pick, playtest 2): hip fire is the full yeet; aiming trades movement for
     * accuracy. Multipliers on the gun's recoil, spin, hop and spread, and on the copter's turn and wobble.
     */
    braced: { recoil: 0.55, spin: 0.35, hop: 0.5, spread: 0.3, copterTurn: 0.5, copterWobble: 0.4 },
  },

  /** Mouse look (rad per pixel of mouse movement). Scaled down while aiming, with the zoom. */
  mouseSensitivity: 0.0022,
};

export type Tuning = typeof TUNING;
