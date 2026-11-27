// ---------------------------------------------------------------------------
// botNav.ts
// Purpose : A tiny route planner for bots on maps whose walls a reactive steer cannot get round (a warehouse
//           wall with doorways, rows of car stacks): the level lists a few ground points (doorways, lane mouths);
//           when the straight walk to the goal is blocked, the bot heads for the first point of the shortest
//           visible chain instead (SOP-14: perception, decision, movement; this is movement's planning step).
// Usage   : const via = nextWaypoint(sim.arena, level.nav, bot.pos, goal) ?? goal
// Notes   : No three import, deterministic. Visibility is a ray at knee height (low cover counts as blocking, so
//           bots route round conveyors rather than gambling on hops). Point-to-point visibility is computed once
//           per arena and nav list (WeakMap), so a plan costs 2n rays plus a Dijkstra over n <= ~24 points.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5); 2026-11-26 level pass.
// ---------------------------------------------------------------------------
import { rayArena, type Arena } from "./arena";
import type { Vec3 } from "./vec";

const KNEE = 0.6; // m above the feet: the walk-visibility ray
const GOAL_REACH = 3.5; // m: a goal standing on a box is reached once you are this close to it

function clearWalk(arena: Arena, a: Vec3, b: Vec3, slack = 0.05): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  if (d < 1e-3) return true;
  const dir = { x: (b.x - a.x) / d, y: 0, z: (b.z - a.z) / d };
  return rayArena(arena, { x: a.x, y: a.y + KNEE, z: a.z }, dir, d) >= d - slack;
}

const links = new WeakMap<Arena, WeakMap<readonly Vec3[], boolean[][]>>();
function graph(arena: Arena, nav: readonly Vec3[]): boolean[][] {
  let byNav = links.get(arena);
  if (!byNav) links.set(arena, byNav = new WeakMap());
  let g = byNav.get(nav);
  if (!g) {
    g = nav.map((a) => nav.map((b) => a !== b && clearWalk(arena, a, b)));
    byNav.set(nav, g);
  }
  return g;
}

/**
 * The next point to walk toward on the way to `goal`, or null when the goal is in plain view (walk straight)
 * or no chain of points reaches it (let the reactive steer try).
 */
export function nextWaypoint(arena: Arena, nav: readonly Vec3[] | undefined, from: Vec3, goal: Vec3): Vec3 | null {
  if (!nav?.length || clearWalk(arena, from, goal, GOAL_REACH)) return null;
  const g = graph(arena, nav), n = nav.length;
  const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
  // a goal on a ledge or roof: reaching the foot of its platform (within GOAL_REACH) counts as reaching it
  const toGoal = nav.map((p) => clearWalk(arena, p, goal, GOAL_REACH));
  // Dijkstra from the bot: start edges to every visible point, the goal reachable from points that see it
  const best = nav.map((p) => (clearWalk(arena, from, p) ? dist(from, p) : Infinity));
  const first = nav.map((_, i) => i);
  const done = new Array<boolean>(n).fill(false);
  let goalCost = Infinity, goalFirst = -1;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && best[i] < Infinity && (u < 0 || best[i] < best[u])) u = i;
    if (u < 0 || best[u] >= goalCost) break;
    done[u] = true;
    if (toGoal[u] && best[u] + dist(nav[u], goal) < goalCost) { goalCost = best[u] + dist(nav[u], goal); goalFirst = first[u]; }
    for (let v = 0; v < n; v++) if (g[u][v] && best[u] + dist(nav[u], nav[v]) < best[v]) { best[v] = best[u] + dist(nav[u], nav[v]); first[v] = first[u]; }
  }
  return goalFirst >= 0 ? nav[goalFirst] : null;
}
