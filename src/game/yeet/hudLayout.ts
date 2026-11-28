// ---------------------------------------------------------------------------
// hudLayout.ts
// Purpose : The HUD's tunables and the small bits of maths behind it, kept out of the DOM so they are unit tested:
//           where each stamp of the cascade sits, which side a hit came from, and when the speed readout shows.
// Usage   : stampSlot(age, side) -> { x, y, scale, opacity } ; hitBearing(yaw, me, from) -> radians (0 ahead, + right)
// Notes   : Approved concept 2026-11-28 (docs/mockups/hud/index.html, ADR 0009). Numbers live in HUD_TUNING only.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-28
// ---------------------------------------------------------------------------

export const HUD_TUNING = {
  stamp: {
    /** Stamps on screen at once; a new one pushes the oldest off. */
    max: 3,
    /** Seconds a stamp lives (it fades over the last part). */
    life: 1.1,
    /** px each older stamp moves out to its side (the HUD uses min(stepVw x screen width, stepMax)), and up. */
    stepX: 170,
    stepVw: 0.2,
    stepMax: 300,
    stepY: -22,
    /** Each older step shrinks and fades by these factors. */
    scaleStep: 0.72,
    fadeStep: 0.45,
    /** Degrees of tilt, alternating sides. */
    tilt: 6,
  },
  /** The speed readout appears above this many m/s and stays up for `speedHold` s after dropping below. */
  speedShow: 12,
  speedHold: 1.2,
  /** Health at or below this fraction turns the readout pink. */
  lowHp: 0.35,
  /** Seconds a notice line under the crosshair stays. */
  noticeLife: 2.2,
  /** Seconds the damage wedge stays after a hit. */
  hurtLife: 0.45,
  /** Feed lines kept (desktop, touch). */
  feedMax: 4,
  feedMaxTouch: 3,
  /** A finger that moves more than this many px on the weapon strip is scrolling, not tapping. */
  stripTapSlop: 8,
};

export interface StampPose { x: number; y: number; scale: number; opacity: number; rot: number }

/**
 * Where a stamp sits in the cascade. `age` 0 is the newest (centre); each older one steps out to its own `side`
 * (-1 left, +1 right, picked when it was born so stamps alternate) and up, smaller and fainter.
 */
export function stampSlot(age: number, side: -1 | 1, t = HUD_TUNING.stamp): StampPose {
  const k = Math.max(0, age);
  return {
    x: k === 0 ? 0 : side * t.stepX * k,
    y: k === 0 ? 0 : t.stepY * k,
    scale: Math.pow(t.scaleStep, k),
    opacity: k === 0 ? 1 : Math.pow(t.fadeStep, k),
    rot: side * -t.tilt,
  };
}

/**
 * The direction a hit came from, relative to where the player looks: 0 straight ahead, +PI/2 on the right,
 * -PI/2 on the left, +-PI behind. Forward is (-sin yaw, -cos yaw) on x/z, as the sim's aimDir uses.
 */
export function hitBearing(yaw: number, me: { x: number; z: number }, from: { x: number; z: number }): number {
  const dx = from.x - me.x, dz = from.z - me.z;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  return Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
}

/** The ellipse centre (percent of the screen) of the damage wedge for a bearing: on the edge facing the hit. */
export function wedgeAt(bearing: number): { x: number; y: number } {
  return { x: 50 + Math.sin(bearing) * 50, y: 50 - Math.cos(bearing) * 50 };
}

// ---------------------------------------------------------------------------
// End of hudLayout.ts
// ---------------------------------------------------------------------------
