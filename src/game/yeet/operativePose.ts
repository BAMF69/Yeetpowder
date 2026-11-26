// ---------------------------------------------------------------------------
// operativePose.ts
// Purpose : The third-person operative's poses as numbers, from what the player is doing: standing ready, running,
//           aiming, airborne, the Boomstick fling (legs thrown up as you fly), tumbling (limbs flailing), the hero
//           landing (one knee down, a fist on the ground) and knocked out (limp starfish). operative.ts applies them.
//           Also (2026-11-22, so you can read other players): the head and body follow the look up and down, the
//           legs tuck through a Reaper's Kick flip (the world spins the whole figure), and a gunblade slash sweeps
//           the blade across the body.
// Usage   : const t = targetPose(input, timeSeconds)   // joint angles (rad) and where the gun is held (m)
//           inputFromPlayer(pl, simTime, aim, kneel01) // PlayerState -> PoseInput
// Notes   : No three.js: pure maths, unit tested (tests/operativePose.test.ts). Angles follow the rig in
//           operative.ts: limbs hang along -Y; rotation.x < 0 swings a limb forward (+Z), a knee or elbow bends with
//           rotation.x > 0 (shin back) or < 0 (forearm forward); rotation.z > 0 swings a limb toward +X, which is
//           the figure's LEFT (it faces +Z). The gun holder is in torso space, metres, facing +Z (right hand at -X).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import type { PlayerState } from "../../core/yeet/sim";
import type { WeaponId } from "../../core/yeet/tuning";

export interface PoseInput {
  weapon: WeaponId | null;
  /** Horizontal speed, m/s. */
  speed: number;
  onGround: boolean;
  /** 0 (hip) .. 1 (aimed down the sights). */
  aim: number;
  /** Look pitch, rad (+ looks up). */
  pitch: number;
  /** 0..1: the Boomstick launch fling. */
  fling: number;
  tumbling: boolean;
  dead: boolean;
  /** 0..1: how deep into the hero landing kneel. */
  kneel: number;
  /** 0..1 through a Reaper's Kick flip (tucks the legs; the world turns the figure), 0 = none. */
  flip?: number;
  /** 0..1 through a gunblade slash (a forehand sweep, right to left), 0 = none. */
  slash?: number;
  /** Reaper's Kick has an enemy hooked: the gunblade turns on its side (as in first person). */
  hook?: boolean;
  healing?: boolean;
  /** Six-Shot Sakura's reversed hold in the grip preview. */
  stance?: boolean;
}

export type V3 = [number, number, number];

export interface PoseTargets {
  /** Forward lean of the torso (rad, + leans forward) and its twist (rad). */
  lean: number;
  twist: number;
  /** Head tilt (rad, + looks up). */
  head: number;
  /** Left then right leg: hip angles and knee bend (+ bends the shin back). */
  legs: [{ hip: V3; knee: number }, { hip: V3; knee: number }];
  /** Where the gun is held (torso space) and its turn; null hides it (knocked out). */
  gun: { pos: V3; rot: V3 } | null;
  /** The left arm: on the gun's foregrip, or posed freely (shoulder angles, elbow bend: - bends forward). */
  leftArm: "fore" | { shoulder: V3; elbow: number };
  /** The right arm: on the gun's grip, or posed freely (when the gun is hidden). */
  rightArm: "grip" | { shoulder: V3; elbow: number };
}

/** Pose numbers (presentation only: gameplay never reads them). */
export const POSE = {
  hookRoll: Math.PI / 2, // Reaper's Kick hooking: the gunblade on its side
  runStride: 0.65, // thigh swing (rad) at full run
  runRate: 1.9, // stride radians per metre travelled
  runFull: 6, // m/s that counts as a full run
  ready: { pos: [-0.16, 0.2, 0.3] as V3, pitch: -0.35 }, // gun at the hip, barrel down
  axeReady: { pos: [-0.16, 0.42, 0.3] as V3 }, // the Rocket Axe from the hip: held up at chest height (playtest)
  axeAimed: { pos: [-0.22, 0.66, 0.12] as V3 }, // the Rocket Axe aimed: up above the right shoulder (right is -x)
  aimed: { pos: [-0.12, 0.38, 0.36] as V3 }, // gun at the shoulder, barrel along the look
  copter: { pos: [-0.17, -0.02, 0.06] as V3, pitch: 0.04 }, // Gatling: rear handle by the hip
  blade: { pos: [-0.2, 0.16, 0.28] as V3, pitch: 0.55 }, // Sakura: blade up and forward
  fling: { pos: [-0.1, 0.55, 0.32] as V3, pitch: 1.2, thigh: -1.35, knee: 0.35 },
  kneel: { lean: 0.45, back: 0.2, backKnee: 1.75, front: -1.45, frontKnee: 1.45 },
  flail: { rate: 9, arm: 0.9, leg: 0.7 },
  look: { head: 0.7, headMax: 0.75, lean: 0.18 }, // share of the look pitch the head and torso follow
  tuck: { thigh: -1.5, knee: 2.1, lean: 0.35 }, // knees to the chest through a flip
  // a forehand sweep: from the right (-X, rot y < 0) across to the left (+X); the torso turns with it
  slash: { from: -1.5, to: 1.5, x: [-0.42, 0.32], y: 0.36, z: 0.34, twist: 0.55, pitch: 0.15, roll: 1.35 }, // roll lays the blade flat
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/** The joint targets for an input at time t (s; drives the run cycle and the flailing). */
export function targetPose(p: PoseInput, t: number, stridePhase: number): PoseTargets {
  if (p.dead) {
    // limp starfish: arms out, legs apart, the gun dropped
    return {
      lean: -0.1, twist: 0, head: 0,
      legs: [{ hip: [0, 0, 0.45], knee: 0.2 }, { hip: [0, 0, -0.45], knee: 0.25 }],
      gun: null,
      leftArm: { shoulder: [0, 0, 1.35], elbow: -0.2 },
      rightArm: { shoulder: [0, 0, -1.35], elbow: -0.25 },
    };
  }
  const run = p.onGround ? Math.min(1, p.speed / POSE.runFull) : 0;
  const swing = Math.sin(stridePhase) * POSE.runStride * run;
  // knees bend most as each leg passes under you
  const kneeL = (0.15 + Math.max(0, Math.sin(stridePhase + Math.PI / 2)) * 0.9) * run;
  const kneeR = (0.15 + Math.max(0, Math.sin(stridePhase - Math.PI / 2)) * 0.9) * run;
  let legs: PoseTargets["legs"] = [
    { hip: [-swing, 0, 0.04], knee: kneeL + 0.05 },
    { hip: [swing, 0, -0.04], knee: kneeR + 0.05 },
  ];
  let lean = 0.15 * run;
  if (!p.onGround) {
    legs = [{ hip: [-0.5, 0, 0.08], knee: 0.7 }, { hip: [-0.1, 0, -0.08], knee: 1.0 }]; // airborne tuck
    lean = 0.05;
  }

  // the gun: ready at the hip, raised to the shoulder when aiming; the Gatling low; the Sakura up
  let gunPos: V3 = POSE.ready.pos;
  let pitch = lerp(POSE.ready.pitch, p.pitch, p.aim);
  // Rocket Axe: from the hip the butt points down at the feet (the blade forward); aimed, level over the shoulder
  if (p.weapon === "axe") pitch = lerp(-1.45, p.pitch, p.aim);
  if (p.weapon === "copter") {
    gunPos = POSE.copter.pos;
    pitch = POSE.copter.pitch + p.pitch * 0.3;
  } else if (p.weapon === "sakura") {
    gunPos = POSE.blade.pos;
    pitch = POSE.blade.pitch;
  } else if (p.weapon === "axe") {
    gunPos = lerp3(POSE.axeReady.pos, POSE.axeAimed.pos, p.aim); // hip: held up high; aimed: up above the right shoulder
  } else {
    gunPos = lerp3(POSE.ready.pos, POSE.aimed.pos, p.aim);
  }
  let gunYaw = 0;
  if (p.stance && p.weapon === "sakura") gunYaw = -Math.PI * 0.85;
  let gunRoll = 0;
  let twist = 0;
  // a gunblade slash: the blade sweeps across, right to left, the shoulders turning with it
  const sl = p.slash ?? 0;
  if (sl > 0 && (p.weapon === "reaper" || p.weapon === "sakura" || p.weapon === "axe")) {
    const s = POSE.slash;
    const e = sl * sl * (3 - 2 * sl);
    gunYaw = lerp(s.from, s.to, e);
    gunPos = [lerp(s.x[0], s.x[1], e), s.y, s.z];
    pitch = s.pitch;
    twist = lerp(-s.twist, s.twist, e);
    gunRoll = s.roll;
  }
  // Reaper's Kick hooking: the gunblade rolled a quarter turn counter-clockwise as its holder sees it (the gun
  // points along +Z, away from them, so that is a negative roll here; first person's is positive)
  if (p.hook && p.weapon === "reaper") gunRoll -= POSE.hookRoll;
  const oneHanded = p.weapon === "pistol" || p.weapon === "sakura";
  let leftArm: PoseTargets["leftArm"] = oneHanded ? { shoulder: [-0.15 - swing * 0.6, 0, 0.12], elbow: -0.35 } : "fore";

  // Boomstick launch: the gun and arms thrown up, the legs swing up in front as you fly
  if (p.fling > 0) {
    gunPos = lerp3(gunPos, POSE.fling.pos, p.fling);
    pitch = lerp(pitch, POSE.fling.pitch, p.fling);
    legs = legs.map((l) => ({
      hip: [lerp(l.hip[0], POSE.fling.thigh, p.fling), l.hip[1], l.hip[2]] as V3,
      knee: lerp(l.knee, POSE.fling.knee, p.fling),
    })) as PoseTargets["legs"];
    lean = lerp(lean, -0.2, p.fling);
  }

  // a Reaper's Kick flip: knees to the chest and back out again
  const fl = p.flip ?? 0;
  if (fl > 0 && fl < 1) {
    const k = Math.sin(Math.PI * fl);
    const u = POSE.tuck;
    legs = legs.map((l, i) => ({
      hip: [lerp(l.hip[0], u.thigh, k), l.hip[1], i === 0 ? 0.12 : -0.12] as V3,
      knee: lerp(l.knee, u.knee, k),
    })) as PoseTargets["legs"];
    lean = lerp(lean, u.lean, k);
  }

  // the look: the head tilts most of the way, the torso a little (not while flailing or down on a knee)
  let head = Math.max(-POSE.look.headMax, Math.min(POSE.look.headMax, p.pitch * POSE.look.head));
  lean -= p.pitch * POSE.look.lean;

  // tumbling: everything flails (the body's head-over-heels spin is the world's)
  if (p.tumbling) {
    const f = POSE.flail;
    const a = Math.sin(t * f.rate);
    const b = Math.sin(t * f.rate * 1.3 + 1);
    legs = [{ hip: [-0.6 + a * f.leg, 0, 0.35], knee: 0.6 + b * 0.4 }, { hip: [-0.2 - a * f.leg, 0, -0.35], knee: 0.5 - b * 0.4 }];
    leftArm = { shoulder: [-1.2 + b * f.arm, 0, 1.0 + a * 0.4], elbow: -0.5 };
    gunPos = [-0.25 + a * 0.08, 0.45 + b * 0.1, 0.2];
    pitch = 0.6 + a * 0.5;
    lean = -0.15;
    head = 0;
  }

  // the hero landing: back knee down, front foot planted, the free fist on the ground
  if (p.kneel > 0) {
    const k = POSE.kneel;
    const n = p.kneel;
    legs = [
      { hip: [lerp(legs[0].hip[0], k.front, n), 0, 0.06], knee: lerp(legs[0].knee, k.frontKnee, n) },
      { hip: [lerp(legs[1].hip[0], k.back, n), 0, -0.06], knee: lerp(legs[1].knee, k.backKnee, n) },
    ];
    lean = lerp(lean, k.lean, n);
    if (oneHanded) leftArm = { shoulder: [lerp(-0.15, -0.55, n), 0, 0.15], elbow: -0.1 };
    gunPos = lerp3(gunPos, [-0.22, 0.2, 0.32], n);
    pitch = lerp(pitch, -0.15, n); // barrel low but clear of the floor
    head = lerp(head, 0, n);
  }

  if (p.healing) return { lean, twist, head, legs, gun: null,
    leftArm: { shoulder: [-1.1, 0, 0.15], elbow: -1.1 }, rightArm: { shoulder: [-1.1, 0, -0.15], elbow: -1.1 } };
  return { lean, twist, head, legs, gun: { pos: gunPos, rot: [pitch, gunYaw, gunRoll] }, leftArm, rightArm: "grip" };
}

/** Seconds a Boomstick fling pose lasts after the shot (rise, hold, fall). */
const FLING_TIME = { rise: 0.08, hold: 0.3, fall: 0.35 };

/** The pose input for a player (their sim state, the sim's clock, how far they aim, the hero-landing kneel 0..1). */
export function inputFromPlayer(pl: PlayerState, simTime: number, aim: number, kneel: number): PoseInput {
  const since = simTime - pl.lastShotAt;
  let fling = 0;
  // the Boomstick, the Rocket Launcher and the Rocket Axe launch you: the legs swing up in front
  if ((pl.weapon === "shotgun" || pl.weapon === "rocket" || pl.weapon === "axe") && since >= 0) { // lastShotAt starts at -99
    const { rise, hold, fall } = FLING_TIME;
    fling = since < rise ? since / rise : since < rise + hold ? 1 : Math.max(0, 1 - (since - rise - hold) / fall);
  }
  return {
    weapon: pl.weapon,
    speed: Math.hypot(pl.vel.x, pl.vel.z),
    onGround: pl.onGround,
    aim: pl.weapon === "shield" ? Number(pl.shielding) : aim,
    healing: pl.healing > 0,
    pitch: pl.pitch,
    fling,
    tumbling: pl.tumbling > 0,
    dead: pl.dead > 0,
    kneel,
    hook: pl.weapon === "reaper" && pl.hook >= 0,
  };
}
