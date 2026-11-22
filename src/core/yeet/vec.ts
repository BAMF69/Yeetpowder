// ---------------------------------------------------------------------------
// vec.ts
// Purpose : The tiny 3D vector math the engine-free sim needs (no three import, so Vitest runs it in Node).
// Usage   : const v = vec(1, 2, 3); addScaled(v, dir, 2)
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const copy = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z });
export const len = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);
export const lenXZ = (v: Vec3): number => Math.hypot(v.x, v.z);

/** a += b * s (in place). */
export function addScaled(a: Vec3, b: Vec3, s: number): Vec3 {
  a.x += b.x * s;
  a.y += b.y * s;
  a.z += b.z * s;
  return a;
}

export function normalize(v: Vec3): Vec3 {
  const l = len(v) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/**
 * Where the player looks. Yaw 0 looks down -Z (Three.js camera default), positive yaw turns left;
 * positive pitch looks up.
 */
export function aimDir(yaw: number, pitch: number): Vec3 {
  const c = Math.cos(pitch);
  return { x: -Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c };
}

/** The aim direction tilted by small angles (pellet spread): dYaw to the side, dPitch up. */
export function spreadDir(yaw: number, pitch: number, dYaw: number, dPitch: number): Vec3 {
  return aimDir(yaw + dYaw, pitch + dPitch);
}
