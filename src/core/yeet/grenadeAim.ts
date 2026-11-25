import { moveBody, type Arena } from "./arena";
import type { Tuning } from "./tuning";
import { addScaled, copy, type Vec3 } from "./vec";
/** Static-world prediction through the grenade fuse, including the same bounce and rolling rules as the sim. */
export function grenadeAim(arena: Arena, eye: Vec3, dir: Vec3, t: Tuning, aimed = true): Vec3[] {
  const g = t.projectile.grenade, pos = addScaled(copy(eye), dir, 0.5);
  const speed = aimed ? g.aimedSpeed : g.speed, vel = { x: dir.x * speed, y: dir.y * speed + g.up, z: dir.z * speed };
  const points: Vec3[] = [copy(pos)];
  for (let step = 0; step < Math.ceil(g.fuse / t.step); step++) {
    vel.y -= t.gravity * g.gravity * t.step;
    const before = copy(vel), hit = moveBody(arena, pos, vel, t.step, g.radius, g.radius * 2);
    if (hit.onGround && before.y < -1) { vel.y = -before.y * g.bounce; vel.x *= 0.7; vel.z *= 0.7; }
    else if (hit.onGround) { vel.x *= Math.exp(-4 * t.step); vel.z *= Math.exp(-4 * t.step); }
    if (hit.wallNormal?.x) vel.x = -before.x * g.bounce;
    if (hit.wallNormal?.z) vel.z = -before.z * g.bounce;
    if (step % 6 === 0) points.push(copy(pos));
  }
  points.push(copy(pos)); return points;
}
