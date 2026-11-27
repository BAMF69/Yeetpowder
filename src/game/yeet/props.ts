// ---------------------------------------------------------------------------
// props.ts
// Purpose : The new levels' things, drawn (levelsOutdoor.ts): crushed cars, trucks, tanks and fuel drums over their
//           collision boxes (explosives turn into charred wrecks while hazards.ts says so), palms, rocks and a crane
//           as scenery, the sea round Shark Island with a shark that lunges up to eat whoever falls in, and the pink
//           yeetpowder fireball of an explosion (GDD Lore: every explosion is pink).
// Usage   : const props = buildProps(level, sim.explosives); scene.add(props.group);
//           each frame props.update(dt); events: props.explode(at, radius); props.shark(at); props.dispose()
// Notes   : PLACEHOLDER shapes made of boxes, cylinders and cones (crude on purpose: the levels are judged on play
//           first; Meshy or CC0 models replace them, docs/ROADMAP.md). Each prop fills its collision box, so what
//           you see is what you hit. Materials are shared per colour; everything is freed by dispose().
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { TUNING } from "../../core/yeet/tuning";
import type { Box } from "../../core/yeet/arena";
import type { ExplosiveState } from "../../core/yeet/hazards";
import type { Decor, Level } from "../../core/yeet/levels";
import type { Projectile } from "../../core/yeet/sim";
import { grenadePreviewArt, rocketPreviewArt } from "./meshyArt";
import { batchStaticMeshes } from "./staticBatch";

const CAR_COLOURS = ["#8a3b2b", "#3b5a7a", "#7a7a3b", "#5d6b5e", "#a06a2c", "#6b4a6b", "#8c8c86"];
const WATER = { colour: "#2a7fa8", opacity: 0.86, size: 4000 }; // to the haze in every direction, even from the copter
/** Shark lunge: s rising out of the water, s at the top, s sinking back. */
const SHARK = { rise: 0.32, hold: 0.12, sink: 0.55, height: 2.2 };
const FIREBALL = { grow: 0.18, life: 0.75 };

export interface Props {
  group: THREE.Group;
  update(dt: number): void;
  explode(at: { x: number; y: number; z: number }, radius: number): void;
  /** The shark swims in toward `at` and bites after TUNING.shark.approach s; `track` (if given) moves the target
   *  with a swimmer each frame, and returning null calls the shark off (they climbed out). */
  shark(at: { x: number; y: number; z: number }, track?: () => { x: number; z: number } | null): void;
  /** Hides the procedural stand-ins for these arena boxes (scenery.ts drew the reviewed model instead). */
  hide(boxIndices: number[]): void;
  dispose(): void;
}

export function buildProps(level: Level, explosives: ExplosiveState[], projectiles: Projectile[] = []): Props {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats = new Map<string, THREE.Material>();
  const mat = (colour: string, rough = 0.85, metal = 0.1): THREE.Material => {
    const key = `${colour}|${rough}|${metal}`;
    let m = mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: colour, roughness: rough, metalness: metal, flatShading: true });
      mats.set(key, m);
    }
    return m;
  };
  const geo = <T extends THREE.BufferGeometry>(g: T): T => {
    geos.push(g);
    return g;
  };
  const part = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo(g), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const wheel = (parent: THREE.Object3D, r: number, w: number, x: number, y: number, z: number) => {
    const m = part(parent, new THREE.CylinderGeometry(r, r, w, 10), mat("#1d1d20", 0.95, 0), x, y, z);
    m.rotation.x = Math.PI / 2;
  };

  /** A prop group placed over a box, its length along local x (turned when the box is longer along z). */
  const over = (b: Box): { g: THREE.Group; l: number; h: number; w: number } => {
    const g = new THREE.Group();
    const sx = b.max.x - b.min.x;
    const sz = b.max.z - b.min.z;
    g.position.set((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2);
    if (sz > sx) g.rotation.y = Math.PI / 2;
    group.add(g);
    return { g, l: Math.max(sx, sz), h: b.max.y - b.min.y, w: Math.min(sx, sz) };
  };

  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const car = (b: Box) => {
    const { g, l, h, w } = over(b);
    const body = mat(CAR_COLOURS[Math.floor(rnd() * CAR_COLOURS.length)], 0.8, 0.25);
    part(g, new THREE.BoxGeometry(l, h * 0.55, w), body, 0, h * 0.3, 0);
    const cab = part(g, new THREE.BoxGeometry(l * 0.5, h * 0.4, w * 0.92), body, -l * 0.05, h * 0.75, 0);
    cab.rotation.z = (rnd() - 0.5) * 0.12; // crushed a little crooked
    part(g, new THREE.BoxGeometry(l * 0.46, h * 0.28, w * 0.94), mat("#2b3540", 0.3, 0.4), -l * 0.05, h * 0.78, 0); // windows
    for (const x of [-l * 0.32, l * 0.32]) for (const z of [-w * 0.45, w * 0.45]) wheel(g, h * 0.22, w * 0.12, x, h * 0.2, z);
    return g;
  };

  const truck = (b: Box) => {
    const { g, l, h, w } = over(b);
    part(g, new THREE.BoxGeometry(l * 0.68, h * 0.78, w), mat("#b8b4a8", 0.9, 0.15), -l * 0.15, h * 0.53, 0); // cargo box
    part(g, new THREE.BoxGeometry(l * 0.28, h * 0.62, w * 0.96), mat("#2f5d8a", 0.6, 0.3), l * 0.35, h * 0.45, 0); // cab
    part(g, new THREE.BoxGeometry(l * 0.04, h * 0.25, w * 0.86), mat("#2b3540", 0.3, 0.4), l * 0.49, h * 0.58, 0); // windscreen
    part(g, new THREE.BoxGeometry(l * 0.66, h * 0.08, w * 1.01), mat("#d64b2f"), -l * 0.15, h * 0.5, 0); // a red stripe
    for (const x of [-l * 0.38, -l * 0.18, l * 0.36]) for (const z of [-w * 0.42, w * 0.42]) wheel(g, h * 0.15, w * 0.16, x, h * 0.15, z);
    return g;
  };

  const tank = (b: Box) => {
    const { g, l, h, w } = over(b);
    const olive = mat("#5b6440", 0.85, 0.2);
    part(g, new THREE.BoxGeometry(l * 0.92, h * 0.42, w * 0.82), olive, 0, h * 0.42, 0); // hull
    for (const z of [-w * 0.42, w * 0.42]) part(g, new THREE.BoxGeometry(l, h * 0.3, w * 0.18), mat("#2a2b26", 0.95, 0.1), 0, h * 0.15, z); // tracks
    part(g, new THREE.CylinderGeometry(w * 0.3, w * 0.34, h * 0.3, 8), olive, -l * 0.05, h * 0.78, 0); // turret
    const gun = part(g, new THREE.CylinderGeometry(h * 0.06, h * 0.07, l * 0.55, 8), olive, l * 0.3, h * 0.82, 0);
    gun.rotation.z = Math.PI / 2;
    return g;
  };

  const drum = (b: Box) => {
    const { g, h, w } = over(b);
    part(g, new THREE.CylinderGeometry(w / 2, w / 2, h, 12), mat("#c2361f", 0.7, 0.3), 0, h / 2, 0);
    for (const y of [h * 0.3, h * 0.7]) part(g, new THREE.CylinderGeometry(w / 2 + 0.01, w / 2 + 0.01, 0.06, 12), mat("#e2b23a"), 0, y, 0);
    return g;
  };

  /** ?noart stand-in for an explosive compressor or mixer: a steel cabinet with a warning stripe. */
  const machine = (b: Box) => {
    const { g, l, h, w } = over(b);
    part(g, new THREE.BoxGeometry(l, h, w), mat("#6d7479", 0.6, 0.5), 0, h / 2, 0);
    part(g, new THREE.BoxGeometry(l + 0.02, 0.12, w + 0.02), mat("#e2b23a"), 0, h * 0.8, 0);
    return g;
  };

  // ---- the boxes that are props ----
  const views = new Map<number, THREE.Group>();
  const staticCars: THREE.Group[] = [];
  level.arena.boxes.forEach((b, i) => {
    const g = b.prop === "car" ? car(b) : b.prop === "truck" ? truck(b) : b.prop === "tank" ? tank(b) : b.prop === "drum" ? drum(b) : b.prop === "machine" ? machine(b) : null;
    if (g) views.set(i, g);
    if (g && b.prop === "car") staticCars.push(g);
  });
  // Cars never become wrecks; explosive vehicles retain their own groups and materials.
  geos.push(...batchStaticMeshes(group, staticCars));
  // a wreck: the prop squashed down to its wreck box and charred
  const charred = mat("#2a2522", 1, 0);
  const whole = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  for (const g of views.values()) g.traverse((o) => o instanceof THREE.Mesh && whole.set(o, o.material));
  const showWreck = (g: THREE.Group, b: Box, ex: ExplosiveState, on: boolean) => {
    g.scale.y = on ? Math.max(0.05, (b.max.y - b.min.y) / (ex.top - b.min.y)) : 1;
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = on ? charred : whole.get(o)!;
    });
  };

  // ---- scenery ----
  const decor = (d: Decor) => {
    const g = new THREE.Group();
    g.position.set(d.pos.x, d.pos.y, d.pos.z);
    g.rotation.y = d.yaw ?? 0;
    g.scale.setScalar(d.scale ?? 1);
    group.add(g);
    if (d.kind === "palm") {
      const trunk = part(g, new THREE.CylinderGeometry(0.16, 0.26, 6, 7), mat("#8a6a46", 0.95, 0), 0.5, 3, 0);
      trunk.rotation.z = -0.17; // a lean
      for (let i = 0; i < 7; i++) {
        const leaf = part(g, new THREE.ConeGeometry(0.5, 3.2, 4), mat("#3f8a3a", 0.8, 0), 1, 6, 0);
        leaf.geometry.translate(0, 1.6, 0);
        leaf.rotation.set(1.25, (i / 7) * Math.PI * 2, 0, "YXZ");
        leaf.scale.set(1, 1, 0.25);
      }
    } else if (d.kind === "rock") {
      const r = part(g, new THREE.IcosahedronGeometry(1.2, 0), mat("#8e8577", 0.95, 0), 0, 0.5, 0);
      r.scale.set(1.4, 0.8, 1.1);
    } else if (d.kind === "crane") {
      const yellow = mat("#e0b02e", 0.7, 0.35);
      part(g, new THREE.BoxGeometry(1.4, 22, 1.4), yellow, 0, 11, 0); // tower
      part(g, new THREE.BoxGeometry(20, 1, 1), yellow, -6, 22.5, 0); // jib
      part(g, new THREE.BoxGeometry(3, 2, 1.6), mat("#4a4a4f"), 4.5, 22, 0); // counterweight
      part(g, new THREE.CylinderGeometry(0.04, 0.04, 9, 4), mat("#222"), -14, 18, 0); // cable
      part(g, new THREE.BoxGeometry(1.2, 0.6, 1.2), mat("#4a4a4f"), -14, 13.5, 0); // magnet
    }
    // "crusher": its block is in the arena (drawn by room.ts)
  };
  for (const d of level.decor ?? []) decor(d);

  // Worn lane paint distinguishes routes at ground level without adding collision edges.
  if (level.id.startsWith("industrial") || level.id.startsWith("junkyard")) {
    const paint = new THREE.MeshBasicMaterial({ color: "#cbb76f", transparent: true, opacity: 0.65, depthWrite: false });
    mats.set("lane-paint", paint);
    const markings: THREE.Mesh[] = [];
    const dash = (x: number, z: number, alongX: boolean) => {
      const mesh = new THREE.Mesh(geo(new THREE.PlaneGeometry(alongX ? 3 : 0.12, alongX ? 0.12 : 3)), paint);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.015, z);
      group.add(mesh); markings.push(mesh);
    };
    const party = level.id.endsWith("-party");
    if (level.id.startsWith("industrial")) {
      for (const z of party ? [-22, 0, 22] : [0]) for (let x = 3; x < (party ? 59 : 28); x += 6) dash(x, z + 2, true);
    } else {
      const edge = party ? 46 : 21;
      for (let n = -edge; n <= edge; n += 6) if (Math.abs(n) > 8) { dash(n, 0, true); dash(0, n, false); }
    }
    geos.push(...batchStaticMeshes(group, markings));
  }

  // ---- water and the shark ----
  let water: THREE.Mesh | null = null;
  if (level.water) {
    const m = new THREE.MeshStandardMaterial({ color: WATER.colour, roughness: 0.25, metalness: 0.1, transparent: true, opacity: WATER.opacity });
    mats.set("water", m);
    water = new THREE.Mesh(geo(new THREE.PlaneGeometry(WATER.size, WATER.size)), m);
    water.rotation.x = -Math.PI / 2;
    water.position.y = level.water.y;
    water.receiveShadow = true;
    group.add(water);
  }
  const sharkG = new THREE.Group();
  {
    const grey = mat("#6f7d86", 0.6, 0.1);
    const belly = mat("#d9dde0", 0.7, 0);
    const body = part(sharkG, new THREE.SphereGeometry(0.6, 10, 8), grey, 0, 0, 0);
    body.scale.set(0.9, 3, 0.9); // long along y: it comes up nose first
    part(sharkG, new THREE.ConeGeometry(0.25, 0.9, 4), grey, 0, -0.2, -0.7).rotation.x = -Math.PI / 2; // dorsal fin
    const tail = part(sharkG, new THREE.ConeGeometry(0.4, 1, 4), grey, 0, -2.1, 0);
    tail.rotation.x = Math.PI;
    tail.scale.set(1, 1, 0.3);
    const jaw = part(sharkG, new THREE.ConeGeometry(0.5, 0.9, 6), belly, 0, 1.4, 0.35); // the open mouth
    jaw.rotation.x = 0.5;
    for (const x of [-0.25, 0.25]) part(sharkG, new THREE.SphereGeometry(0.07, 6, 4), mat("#111"), x, 1.25, -0.4); // eyes
  }
  sharkG.visible = false;
  group.add(sharkG);
  let sharkT = 99;
  const sharkAt = new THREE.Vector3();
  let sharkTrack: (() => { x: number; z: number } | null) | null = null;

  // ---- explosions ----
  const fire = new THREE.MeshBasicMaterial({ color: "#ff3fa4", transparent: true, opacity: 0.9, depthWrite: false });
  const core = new THREE.MeshBasicMaterial({ color: "#ffd0ec", transparent: true, opacity: 1, depthWrite: false });
  mats.set("fire", fire);
  mats.set("core", core);
  const ball = geo(new THREE.IcosahedronGeometry(1, 1));
  const blasts: { outer: THREE.Mesh; inner: THREE.Mesh; t: number; r: number }[] = [];

  // ---- rockets and grenades in flight (a small pool, reused frame to frame) ----
  const rocketGeo = geo(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8).rotateX(Math.PI / 2));
  const noseGeo = geo(new THREE.ConeGeometry(0.07, 0.18, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.34));
  const flameGeo = geo(new THREE.ConeGeometry(0.09, 0.45, 8).rotateX(Math.PI / 2).translate(0, 0, 0.45));
  const grenadeGeo = geo(new THREE.IcosahedronGeometry(0.12, 1));
  const pink = new THREE.MeshBasicMaterial({ color: "#ff3fa4" });
  mats.set("pink", pink);
  const pool: { rocket: THREE.Group; grenade: THREE.Object3D }[] = [];
  const shell = (i: number) => {
    while (pool.length <= i) {
      const rocket = new THREE.Group();
      const art = rocketPreviewArt();
      if (art) {
        rocket.add(art);
      } else {
        part(rocket, rocketGeo, mat("#6d7178", 0.5, 0.5));
        part(rocket, noseGeo, mat("#ff3fa4", 0.5, 0.2));
      }
      rocket.add(new THREE.Mesh(flameGeo, pink)); // yeetpowder exhaust
      const grenade = grenadePreviewArt() ?? new THREE.Mesh(grenadeGeo, mat("#ff3fa4", 0.6, 0.1));
      grenade.castShadow = true;
      rocket.visible = grenade.visible = false;
      group.add(rocket, grenade);
      pool.push({ rocket, grenade });
    }
    return pool[i];
  };
  const look = new THREE.Vector3();

  return {
    group,
    update(dt) {
      // explosives: whole or a wreck, as the sim says
      explosives.forEach((ex) => {
        const g = views.get(ex.box);
        if (!g) return;
        const wrecked = ex.wreckT > 0;
        if ((g.userData.wrecked ?? false) !== wrecked) {
          showWreck(g, level.arena.boxes[ex.box], ex, wrecked);
          g.userData.wrecked = wrecked;
        }
      });
      if (water) water.position.y = level.water!.y + Math.sin(performance.now() / 900) * 0.03; // a slow swell
      projectiles.forEach((p, i) => {
        const s = shell(i);
        const r = p.kind === "rocket";
        s.rocket.visible = r;
        s.grenade.visible = !r;
        if (r) {
          s.rocket.position.set(p.pos.x, p.pos.y, p.pos.z);
          s.rocket.lookAt(look.set(p.pos.x - p.vel.x, p.pos.y - p.vel.y, p.pos.z - p.vel.z)); // nose (-Z) along the flight
        } else {
          s.grenade.position.set(p.pos.x, p.pos.y + 0.12, p.pos.z);
          s.grenade.rotation.x += dt * 12;
        }
      });
      for (let i = projectiles.length; i < pool.length; i++) pool[i].rocket.visible = pool[i].grenade.visible = false;
      // the shark: up out of the water, a moment at the top, back down
      sharkT += dt;
      if (sharkTrack && sharkT < TUNING.shark.approach) {
        const p = sharkTrack();
        if (p) sharkAt.set(p.x, sharkAt.y, p.z); else { sharkT = 99; sharkTrack = null; }
      }
      const total = TUNING.shark.approach + SHARK.rise + SHARK.hold + SHARK.sink;
      sharkG.visible = sharkT < total;
      if (sharkG.visible) {
        const biteT = Math.max(0, sharkT - TUNING.shark.approach);
        const k = biteT < SHARK.rise ? biteT / SHARK.rise : biteT < SHARK.rise + SHARK.hold ? 1 : 1 - (biteT - SHARK.rise - SHARK.hold) / SHARK.sink;
        const e = k * k * (3 - 2 * k);
        sharkG.position.set(sharkAt.x, sharkAt.y - 2.5 + e * (SHARK.height + 2.5), sharkAt.z);
        sharkG.rotation.z = (1 - e) * 0.5;
        sharkG.rotation.x = 0; sharkG.rotation.y = 0;
        if (sharkT < TUNING.shark.approach) {
          const remaining = 1 - sharkT / TUNING.shark.approach;
          sharkG.position.set(sharkAt.x + remaining * 10, sharkAt.y + 0.05, sharkAt.z + remaining * 10);
          sharkG.rotation.set(Math.PI / 2, Math.PI * 1.25, 0);
        }
      }
      // fireballs: grow fast, fade out
      for (let i = blasts.length - 1; i >= 0; i--) {
        const b = blasts[i];
        b.t += dt;
        const grow = Math.min(1, b.t / FIREBALL.grow);
        const fade = Math.max(0, 1 - b.t / FIREBALL.life);
        b.outer.scale.setScalar(b.r * 0.55 * (0.3 + 0.7 * grow));
        b.inner.scale.setScalar(b.r * 0.3 * (0.3 + 0.7 * grow) * fade);
        (b.outer.material as THREE.MeshBasicMaterial).opacity = 0.9 * fade;
        if (b.t >= FIREBALL.life) {
          group.remove(b.outer, b.inner);
          (b.outer.material as THREE.Material).dispose();
          blasts.splice(i, 1);
        }
      }
    },
    explode(at, radius) {
      const outer = new THREE.Mesh(ball, fire.clone()); // its own copy: each fades on its own
      const inner = new THREE.Mesh(ball, core);
      outer.position.set(at.x, at.y, at.z);
      inner.position.copy(outer.position);
      group.add(outer, inner);
      blasts.push({ outer, inner, t: 0, r: radius });
    },
    shark(at, track) {
      sharkAt.set(at.x, at.y, at.z);
      sharkT = 0;
      sharkTrack = track ?? null;
    },
    hide(boxIndices) {
      for (const i of boxIndices) { const g = views.get(i); if (g) g.visible = false; }
    },
    dispose() {
      for (const b of blasts) (b.outer.material as THREE.Material).dispose();
      for (const g of geos) g.dispose();
      for (const m of mats.values()) m.dispose();
    },
  };
}
