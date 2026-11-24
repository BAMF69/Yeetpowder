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

/** The four guns, then the two gunblades (melee + gun, the slice's skill showcase). */
export type WeaponId = "pistol" | "shotgun" | "sniper" | "copter" | "reaper" | "sakura" | "rocket" | "grenade" | "axe";

export const GUNBLADES: readonly WeaponId[] = ["reaper", "sakura", "axe"];

export interface WeaponTuning {
  /** Shown in the HUD. */
  name: string;
  /** true: holding fire keeps shooting (copter); false: one shot per click. */
  auto: boolean;
  /** Seconds between shots. */
  cooldown: number;
  /** Velocity kick on the shooter, opposite the aim (m/s). The heart of the game. Same aimed or hip. */
  recoil: number;
  /** Multiplier on the recoil of a shot fired in mid-air (playtest 5: Pea Pistol and Spin Doctor double). */
  airRecoil: number;
  /** Multiplier on the twist of a shot fired in mid-air. */
  airTwist: number;
  /** Rounds per magazine; reserve ammo is infinite for now (playtest 5). */
  mag: number;
  /** Seconds to reload a magazine. */
  reload: number;
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
  /** Fires a projectile instead of hitscan pellets (TUNING.projectile): the Rocket Launcher, Grenades, the axe's rocket. */
  projectile?: "rocket" | "grenade";
  /** Screen shake trauma added per shot (0..1). */
  trauma: number;
}

/**
 * The airborne Spin Doctor's lift cap (m/s): its doubled air kick chained floor shots up to 72 m (tests), past the
 * Boomstick-only Gatling tower. Up to 4 m/s, a mid-air floor shot only slows a fall; sideways kicks still double.
 */
const SNIPER_AIR_LIFT = 4;

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
      airRecoil: 2, airTwist: 2, // playtest 5: airborne shots kick and twist twice as hard
      airLiftCap: 1, // ... but mid-air pistol shots never add climb (no jetpack; keeps the tower shotgun-only)
      mag: 9, reload: 1.0,
      twist: 1.2, aimedTwist: 0.15, hop: 4.5, damage: 15, pellets: 1,
      spread: 0, knockback: 2.5, range: 80, trauma: 0.14,
    },
    shotgun: {
      name: "Boomstick", auto: false, cooldown: 0.75, recoil: 30, airRecoil: 1, airTwist: 1, airLiftCap: 999, mag: 2, reload: 1.4,
      twist: 3, aimedTwist: 0.15, hop: 0, damage: 9, pellets: 9,
      spread: 0.09, knockback: 2.2, range: 30, trauma: 0.5,
    },
    sniper: {
      name: "Spin Doctor", auto: false, cooldown: 1.1, recoil: 16, airRecoil: 2, airTwist: 2, airLiftCap: SNIPER_AIR_LIFT, mag: 5, reload: 1.8,
      twist: 14, aimedTwist: 0.7, hop: 0, damage: 100, pellets: 1, // a top from the hip; scoped, still a spin (playtest 4)
      spread: 0, knockback: 16, range: 200, trauma: 0.55,
    },
    copter: {
      name: "Gatling Copter", auto: true, cooldown: 0.06, recoil: 0, airRecoil: 1, airTwist: 1, airLiftCap: 999, mag: 200, reload: 3, twist: 0, aimedTwist: 0, hop: 0, damage: 5,
      pellets: 1, spread: 0.03, knockback: 1.2, range: 60, trauma: 0.06,
    },
    // ---- gunblades (vertical slice): Fire is the gun, F is the slash (see `reaper` and `sakura` below) ----
    reaper: {
      name: "Reaper's Kick", auto: false, cooldown: 0.7, recoil: 17, airRecoil: 1, airTwist: 1, airLiftCap: 999,
      mag: 4, reload: 1.8, twist: 0, aimedTwist: 0, hop: 0, damage: 55, pellets: 1, // the kick is the flip, not a twist
      spread: 0, knockback: 12, range: 120, trauma: 0.45,
    },
    sakura: {
      name: "Six-Shot Sakura", auto: false, cooldown: 0.12, recoil: 5, airRecoil: 1, airTwist: 1, airLiftCap: 999,
      mag: 6, reload: 1.2, twist: 0.8, aimedTwist: 0.15, hop: 0, damage: 15, pellets: 1, // reload = the spin-reload
      spread: 0, knockback: 3, range: 40, trauma: 0.18,
    },
    // ---- explosives (Elaina, 2026-11-24): projectiles that blow up (TUNING.projectile); your own blast launches you ----
    rocket: {
      name: "Rocket Launcher", auto: false, cooldown: 0.85, recoil: 28, airRecoil: 2, airTwist: 2, airLiftCap: 999,
      mag: 3, reload: 1.7, twist: 0.5, aimedTwist: 0.15, hop: 0, damage: 0, pellets: 0, // the blast does the damage
      spread: 0, knockback: 0, range: 0, trauma: 0.4, projectile: "rocket",
    },
    grenade: {
      name: "Grenades", auto: false, cooldown: 0.5, recoil: 3, airRecoil: 2, airTwist: 2, airLiftCap: 999,
      mag: 3, reload: 1.5, twist: 0.3, aimedTwist: 0.1, hop: 0, damage: 0, pellets: 0,
      spread: 0, knockback: 0, range: 0, trauma: 0.15, projectile: "grenade",
    },
    // the third gunblade (TUNING.axe): from the hip the nozzle points at your feet (the rocket launches you up);
    // aimed it is held like a bazooka (the rocket goes forward, the kick throws you back like the Boomstick)
    axe: {
      name: "Rocket Axe", auto: false, cooldown: 0.8, recoil: 28, airRecoil: 2, airTwist: 2, airLiftCap: 999,
      mag: 3, reload: 1.8, twist: 0, aimedTwist: 0, hop: 0, damage: 0, pellets: 0,
      spread: 0, knockback: 0, range: 0, trauma: 0.45, projectile: "rocket",
    },
  } satisfies Record<WeaponId, WeaponTuning>,

  /**
   * Projectiles (sim.ts stepProjectiles; Elaina 2026-11-24): rockets fly straight at `speed` m/s and blow up on the
   * first thing they touch (or after `life` s); grenades are thrown at `speed` plus `up` m/s, fall at `gravity` x the
   * world's, bounce keeping `bounce` of their speed, and blow up after `fuse` s or on touching someone. The blast is
   * hazards.ts's (push away and up, damage, both falling off to nothing at the radius). In your own blast you take
   * `self.damage` of the damage and `self.force` of the push: a rocket jump hurts a little and launches a lot.
   */
  projectile: {
    rocket: { speed: 34, life: 4, radius: 0.25, blast: { radius: 4.5, force: 20, lift: 9, damage: 80 }, self: { damage: 0.35, force: 1.3 } },
    grenade: {
      speed: 16, up: 4, gravity: 1, bounce: 0.45, fuse: 1.5, radius: 0.15,
      blast: { radius: 4.2, force: 36, lift: 20, damage: 70 }, self: { damage: 0.5, force: 1 }, // x2 push (playtest 2026-11-24)
    },
  },

  /**
   * Rocket Axe (Elaina, playtest 2026-11-24): hip fire points the nozzle at your feet: the rocket goes straight down
   * and you get `hipRecoil` m/s up (x the weapon's airRecoil in the air) on top of its blast; aimed, the rocket goes
   * forward and the weapon's `recoil` throws you back. F is a heavy cleave. Hold F and fire for the grenade slash: a
   * cleave, a leap forward (`leap` m/s, `leapUp` up) in a front flip, a grenade fired out behind you at
   * `grenadeSpeed`; it pops the camera out (third person) for `camera` s.
   */
  axe: {
    hipRecoil: 12,
    slash: { damage: 30, range: 2.8, arc: 2.4, knockback: 9, lift: 3, cooldown: 0.3 },
    leap: 14,
    leapUp: 7,
    grenadeSpeed: 10,
    grenadeCooldown: 0.9,
    camera: 0.9,
  },

  /**
   * Reaper's Kick (scythe + sniper rifle): the shot decides your flip. Aimed 30+ degrees down = the big backflip;
   * otherwise your main direction of travel, seen from where you look: faster sideways than forward or back =
   * cartwheel, still moving forward after the kick = front-flip, else a (small) backflip; F is a wide 180 degree sweep; a slash within reapWindow of a
   * shot does reapMult damage ("REAP!").
   */
  reaper: {
    // the big backflip (extra lift, then a hero landing) needs the shot aimed at least bigBackflipDeg below level
    // (playtest 2026-11-22: was ~33 degrees, and any backward flip, even a flat one from standing, counted as big)
    backflipLift: 1.35,
    bigBackflipDeg: 30,
    flipTime: 0.5, // s of the visual flip
    slash: { damage: 32, range: 2.8, arc: Math.PI, cooldown: 0.45, knockback: 9, lift: 3 },
    reapWindow: 0.3,
    reapMult: 2,
    /** Hold F (past holdTime): wrap the scythe around the nearest enemy in front; Fire while hooked = YEETREAP. */
    hook: { holdTime: 0.2, range: 3, arc: (2 * Math.PI) / 3, distance: 1.4, maxTime: 2, release: 3, yankReach: 1.8 },
    yeetreap: { damage: 120, knockback: 26, lift: 10 },
    /** Landing from a backflip: down on one knee (the eye drops `kneel` m), no moving or jumping for `time` s. */
    heroLanding: { time: 0.6, kneel: 0.7 },
  },

  /**
   * Six-Shot Sakura (katana + revolver in the handle): F slashes chain into a combo of up to comboMax hits (each within
   * comboWindow of the last); Fire mid-slash fires the revolver, cancels the swing's recovery and lunges you
   * lungeSpeed toward where you face (~4 m); the sixth round fired point-blank (within finisherRange) knocks the target
   * flying; then a 1.2 s spin-reload (weapons.sakura.reload) with no slashing: it leaves you open.
   */
  sakura: {
    slash: { damage: 18, range: 2.5, arc: (2 * Math.PI) / 3, recovery: 0.36, knockback: 4, lift: 1.5 },
    comboMax: 6,
    comboWindow: 0.65,
    lungeSpeed: 15, // m/s along the floor: ~4 m with ground friction
    finisherRange: 3,
    finisherKnockback: 22,
    finisherLift: 8,
    /** Hold F (past holdTime): blade reversed; each Fire propels you `speed` forward, plus `up` of it upward as you
     * look up (playtest: the upward push stays smaller than the forward one; never down into the floor). */
    dash: { holdTime: 0.2, speed: 22, up: 0.4 },
    /**
     * ULTRASLASH (playtest): letting go of the stance after a dash-fire, while still faster than minSpeed (above a
     * sprint), rapid-fires every round left: one wide cut per round, `interval` apart, each nudging you forward; the
     * last cut knocks hard. No dash-fire, or slowed to a run, walk or stop: letting go just lowers the blade.
     */
    ultra: { minSpeed: 12, interval: 0.07, damage: 24, range: 3.6, arc: Math.PI, knockback: 5, lastKnockback: 18, lift: 3, lunge: 4 },
  },

  weaponOrder: ["pistol", "shotgun", "sniper", "copter", "reaper", "sakura", "rocket", "grenade", "axe"] as WeaponId[],

  /** Pick up a gun by walking within this distance of it (m, from your middle). */
  pickupRadius: 1.4,

  /** Right-click aim: field of view per gun (degrees; hip fire is 75) and how fast the zoom moves (s). */
  aim: {
    hipFov: 75,
    /** Screens narrower than this (width / height) widen the view so the sides stay in sight (view.ts). 4:3 keeps
     *  every landscape phone and tablet as it was; a phone held upright sees what a 4:3 screen sees. */
    minAspect: 4 / 3,
    fov: { pistol: 55, shotgun: 60, sniper: 18, copter: 62, reaper: 30, sakura: 60, rocket: 55, grenade: 62, axe: 60 } satisfies Record<WeaponId, number>,
    time: 0.12,
    /**
     * Aimed fire (playtest 3: physics, not a weaker gun): the gun is centred, so the kick goes straight back
     * (full recoil and hop) and hardly twists you; the pellets group tighter. The copter still judders, less.
     */
    braced: { recoil: 1, hop: 1, spread: 0.3, copterTurn: 0.5, copterWobble: 0.4 }, // twist: per gun (aimedTwist)
  },

  /** Mouse look (rad per pixel of mouse movement). Scaled down while aiming, with the zoom. */
  mouseSensitivity: 0.0022,

  /**
   * Touch controls (src/game/touchControls.ts, maths in src/core/yeet/touch.ts), phones and tablets.
   *   stickRadius  px a thumb travels from where it landed to full speed; deadzone the share of it that does nothing
   *   sprintAt     the stick past this share of full travel also sprints (no Shift on a tablet)
   *   lookScale    x mouseSensitivity per px of finger drag (a thumb covers fewer px than a mouse sweep); the
   *                player's own Look speed (touch settings panel, 0.5x..3x) multiplies it. Playtest 2026-11-22: 1.6 slow
   *   recoil       touch players' Gatling: its random aim wobble and its turn to the right are scaled by these
   *                (a thumb cannot fight it the way a mouse hand does; mouse players keep the full kick)
   *   assist       aim assist (src/core/yeet/aimAssist.ts): cone (rad) and range (m) a target must be in; friction
   *                0..1 slows your look over it; pull (rad/s) eases you onto it while you play
   *   gyro         look rad per rad the device turns, before the player's Gyro speed
   */
  touch: {
    stickRadius: 64, deadzone: 0.15, sprintAt: 0.92, lookScale: 2.6,
    recoil: { wobble: 0.35, copterTurn: 0.6 },
    assist: { cone: 0.16, range: 45, friction: 0.45, pull: 0.9 },
    gyro: 1,
    /**
     * Shake moves (src/core/yeet/shake.ts; Elaina 2026-11-24: touch should be silly and able to beat PC players).
     * A jolt along the screen's left/right or up/down axis (m/s2, gravity removed) above `threshold` (divided by the
     * player's Shake strength setting), reversed within `window` s by at least `reverse` of it, `dominance` x the
     * other axis, at most one per `cooldown` s. The gyro's aiming pauses for `quiet` s after a jolt.
     *   strafe     s of sideways run before a shake cartwheel's shot (the cartwheel needs side speed >= 2 m/s)
     *   dipPitch   rad: a down shake tips the aim this far for Reaper's big backflip (it needs 30 degrees down)
     *   flipToSlash s from the flip shot to its slash (a slash within reapWindow of a shot is a REAP)
     *   lockOn     s the view stays locked onto the nearest enemy after a shake flip; lockRate rad/s it turns
     *   homeTime   s a Sakura shake move turns toward its target first; homeRate rad/s; homeCone rad; homeRange m
     *   slashToFire s from a Sakura shake slash to its lunge shot; ultraHold s of dash before letting go (ULTRASLASH)
     */
    shake: {
      threshold: 13, reverse: 0.5, window: 0.3, dominance: 1.5, cooldown: 0.6, quiet: 0.35,
      strafe: 0.22, dipPitch: -0.62, dipTime: 0.06, flipToSlash: 0.06,
      lockOn: 1.2, lockRate: 9,
      homeTime: 0.1, homeRate: 16, homeCone: 2.4, homeRange: 25,
      slashToFire: 0.1, ultraHold: 0.12,
    },
    /** Touch Gatling: bullets bend onto an enemy within `cone` rad of the crosshair and `range` m (the aim, and so
     *  the flight, is left alone: Elaina, "if it autoaims at players its harder to control the movement"). */
    copterBend: { cone: 0.1, range: 60 },
  },

  /**
   * Explosive vehicles and drums (hazards.ts; the Industrial yard, Elaina 2026-11-24): shots wear down `hp`; at 0
   * the blast pushes everyone within `radius` m away and up (`force` and `lift` m/s at the centre, falling to 0 at
   * the edge) and hurts them (`damage` hp at the centre), sets off other explosives in reach, and leaves a wreck
   * `wreck` m tall that stays as cover; it is whole again after `respawn` s (once nobody stands in it).
   */
  explosive: {
    drum: { hp: 25, radius: 4.5, force: 16, lift: 8, damage: 35, wreck: 0.3 },
    truck: { hp: 120, radius: 7, force: 22, lift: 10, damage: 60, wreck: 1.3 },
    tank: { hp: 220, radius: 9, force: 28, lift: 13, damage: 90, wreck: 1.6 },
    respawn: 25,
  },
  /** Shark Island: who falls below the water is eaten (a knockout, credited to whoever hit them within `credit` s). */
  water: { credit: 8, sink: 3 },

  /**
   * Bots (src/core/yeet/bot.ts): full players driven by a brain that only presses what a player can press. Each
   * difficulty is how human its hands and judgment are, never a cheat (same guns, recoil, tumbles, ammo, hp).
   *   reaction    s between seeing something and acting on it (it aims at where you were that long ago)
   *   turnRate    rad/s the most it can turn its view; aimGain how hard it chases the target angle (1/s)
   *   wobble      rad of slow aim drift (a hand on a mouse); fireCone x the target's angular size: fires inside it
   *   lead        aims ahead by its own reaction time (a good player tracks motion)
   *   switchSkill chance per decision to switch to the right gun for the range
   *   aimed       chance to aim down the sights (braced: less twist and spread) with the pistol and Spin Doctor
   *   plantFeet   chance to stop moving for a heavy shot (fewer run-and-gun tumbles)
   *   launch      chance per decision to travel by Boomstick floor launch when far from its target
   *   strafe      0..1 how much it side-steps while fighting; sprint: whether it sprints to reach you
   *   retreatHp   below this fraction of hp it backs off (0: never); gatling: whether it goes for the Gatling
   */
  bot: {
    decideEvery: 0.1, // s between decisions (aim and steering run every step)
    sightRange: 60, // m
    eyeMemory: 3, // s it keeps hunting where it last saw you
    probe: 1.6, // m: wall check ahead when steering
    ranges: { shotgun: 8, pistol: 22 }, // m: the Boomstick inside 8, the Pea Pistol to 22, the Spin Doctor past that
    hold: { shotgun: 5, pistol: 12, sniper: 24, copter: 10 }, // m it tries to keep from its target, per gun
    launchFrom: 14, // m: only launches toward a target at least this far
    skills: {
      easy: {
        reaction: 0.6, turnRate: 2.4, aimGain: 4, wobble: 0.09, fireCone: 4.5, lead: false, switchSkill: 0.15,
        aimed: 0, plantFeet: 0, launch: 0.03, strafe: 0.25, sprint: false, retreatHp: 0, gatling: false,
      },
      medium: {
        reaction: 0.35, turnRate: 4.5, aimGain: 7, wobble: 0.045, fireCone: 1.6, lead: false, switchSkill: 0.6,
        aimed: 0.35, plantFeet: 0.5, launch: 0.25, strafe: 0.6, sprint: true, retreatHp: 0.25, gatling: true,
      },
      hard: {
        reaction: 0.18, turnRate: 8, aimGain: 11, wobble: 0.018, fireCone: 1.0, lead: true, switchSkill: 1,
        aimed: 0.75, plantFeet: 1, launch: 0.5, strafe: 1, sprint: true, retreatHp: 0.35, gatling: true,
      },
    },
  },
};

export type Tuning = typeof TUNING;
