// ---------------------------------------------------------------------------
// touch.ts
// Purpose : The maths of the touch controls, kept apart from the DOM so a test can check it: the floating move
//           stick (where the thumb landed to where it is now -> move and sprint) and the look drag scale.
// Usage   : const s = stickFrom(dx, dy, TUNING.touch); input.moveX = s.x; input.moveZ = s.z; input.sprint = s.sprint
// Notes   : Screen y grows downward, so pushing the thumb up (dy < 0) walks forward (+z), like W.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------

export interface TouchTuning {
  stickRadius: number;
  deadzone: number;
  sprintAt: number;
  lookScale: number;
}

export interface StickOut {
  /** -1..1, right is +. */
  x: number;
  /** -1..1, forward is +. */
  z: number;
  /** Pushed nearly to the rim: sprint. */
  sprint: boolean;
  /** 0..1 how far it leans after the deadzone (draws the knob). */
  amount: number;
}

/**
 * The thumb's offset in px from where it landed -> a move vector. Radial deadzone, rescaled so the stick starts at 0
 * just past it (no jump), and clamped to the rim: dragging further than the radius stays full speed.
 */
export function stickFrom(dx: number, dy: number, t: TouchTuning): StickOut {
  const len = Math.hypot(dx, dy);
  const raw = Math.min(1, len / t.stickRadius);
  if (raw <= t.deadzone || len === 0) return { x: 0, z: 0, sprint: false, amount: 0 };
  const amount = (raw - t.deadzone) / (1 - t.deadzone);
  return { x: (dx / len) * amount, z: (-dy / len) * amount, sprint: raw >= t.sprintAt, amount };
}

/** Where to draw the knob: the offset clamped to the rim (px). */
export function knobOffset(dx: number, dy: number, radius: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len <= radius || len === 0) return { x: dx, y: dy };
  return { x: (dx / len) * radius, y: (dy / len) * radius };
}

/**
 * The phone's gyro (DeviceMotionEvent.rotationRate, degrees per second about the device's own axes: beta about its
 * x, gamma about its y, as held in portrait) -> look rates (rad/s) for the screen as it is turned
 * (screen.orientation.angle 0, 90, 180 or 270). Turning the device left turns you left (+yaw); tilting its top edge
 * toward you looks up (+pitch). Right-handed rotations: + is anticlockwise looking down the axis.
 */
export function gyroToLook(rate: { beta: number; gamma: number }, angle: number): { yaw: number; pitch: number } {
  const d = Math.PI / 180;
  const b = rate.beta * d; // about device x (portrait right)
  const g = rate.gamma * d; // about device y (portrait up)
  switch (((Math.round(angle / 90) % 4) + 4) % 4) {
    case 1: return { yaw: b, pitch: -g }; // landscape, device's right side up: up = +x, right = -y
    case 3: return { yaw: -b, pitch: g }; // landscape, left side up: up = -x, right = +y
    case 2: return { yaw: -g, pitch: -b }; // upside down
    default: return { yaw: g, pitch: b }; // portrait: up = +y, right = +x
  }
}
