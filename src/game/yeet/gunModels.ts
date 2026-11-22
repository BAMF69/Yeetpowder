// ---------------------------------------------------------------------------
// gunModels.ts
// Purpose : The six weapons as low-poly models built in code for the art pass (GDD: "N64 spy action", angular
//           faceted shapes, painted surfaces; 300-1,200 triangles per held weapon): the Pea Pistol (a stubby
//           service pistol with its green pea muzzle), the Boomstick (the keyframe's double-barrel), the Spin
//           Doctor (bolt rifle, scope, muzzle brake), the Gatling Copter (six spinning barrels), Reaper's Kick (a
//           weathered farm scythe with a sniper barrel along the shaft) and the Six-Shot Sakura (a curved katana
//           with a fluted revolver cylinder).
// Usage   : const m = buildWeapon("shotgun", kit)   // kit: materials and geometry tracking (viewmodel.ts)
//           m.group is in gun space (barrel toward -Z); m.spinner (the Gatling's barrels) spins about Z
// Notes   : No DOM here: the kit supplies materials, so Vitest builds every model and counts its triangles
//           (tests/gunModels.test.ts). Shapes are placed around the anchors viewmodel.ts holds them by (grip,
//           foregrip, muzzle), which are unchanged from the toy, so every pose and animation keeps working.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import type { WeaponId } from "../../core/yeet/tuning";

export type MatKey =
  | "gunmetal" | "polymer" | "wood" | "blade" | "wrap" | "bone" | "leather" | "brass" | "pea" | "accent" | "hazard" | "lens";

export interface ModelKit {
  mat(key: MatKey): THREE.Material;
  geo<T extends THREE.BufferGeometry>(g: T): T;
}

export interface WeaponModel {
  group: THREE.Group;
  spinner?: THREE.Object3D;
}

type Rot = [number, number, number];

/** Small modelling helpers bound to a kit and a parent group. */
function tools(kit: ModelKit, parent: THREE.Object3D) {
  const put = (geo: THREE.BufferGeometry, key: MatKey, x: number, y: number, z: number, rot: Rot = [0, 0, 0], to = parent) => {
    const m = new THREE.Mesh(kit.geo(geo), kit.mat(key));
    m.position.set(x, y, z);
    m.rotation.set(...rot);
    to.add(m);
    return m;
  };
  return {
    /** Any geometry (placed and turned like the rest). */
    put,
    /** A box. */
    B: (w: number, h: number, d: number, key: MatKey, x: number, y: number, z: number, rot?: Rot, to?: THREE.Object3D) =>
      put(new THREE.BoxGeometry(w, h, d), key, x, y, z, rot, to),
    /** A cylinder along Z (r1 at the back, r2 at the front), `sides` facets. */
    C: (r1: number, r2: number, len: number, sides: number, key: MatKey, x: number, y: number, z: number, to?: THREE.Object3D) => {
      const g = new THREE.CylinderGeometry(r2, r1, len, sides);
      g.rotateX(Math.PI / 2); // +Y (top radius r2) -> -Z: the front
      return put(g, key, x, y, z, undefined, to);
    },
    /** A cylinder along X (bolt handles, cross pins). */
    CX: (r: number, len: number, sides: number, key: MatKey, x: number, y: number, z: number, to?: THREE.Object3D) => {
      const g = new THREE.CylinderGeometry(r, r, len, sides);
      g.rotateZ(Math.PI / 2);
      return put(g, key, x, y, z, undefined, to);
    },
    /** A faceted ball (knobs, charms, the pea). */
    Ball: (r: number, key: MatKey, x: number, y: number, z: number, to?: THREE.Object3D) =>
      put(new THREE.IcosahedronGeometry(r, 0), key, x, y, z, undefined, to),
    /** An extruded outline: shape in its XY plane, `depth` thick along Z, centred on its thickness. */
    E: (shape: THREE.Shape, depth: number, key: MatKey, x: number, y: number, z: number, rot?: Rot, segs = 8) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: segs });
      g.translate(0, 0, -depth / 2);
      return put(g, key, x, y, z, rot);
    },
  };
}

function pistol(kit: ModelKit): WeaponModel {
  const group = new THREE.Group();
  const { B, C, put } = tools(kit, group);
  B(0.06, 0.05, 0.27, "gunmetal", 0, 0.025, -0.11); // slide
  B(0.05, 0.012, 0.26, "gunmetal", 0, 0.055, -0.11); // slide top bevel
  for (const z of [0.0, 0.014, 0.028]) B(0.062, 0.04, 0.005, "polymer", 0, 0.025, z); // rear serrations
  B(0.054, 0.03, 0.21, "polymer", 0, -0.012, -0.095); // frame
  B(0.054, 0.13, 0.068, "polymer", 0, -0.085, 0.07, [-0.28, 0, 0]); // grip
  B(0.058, 0.014, 0.075, "gunmetal", 0, -0.148, 0.09, [-0.28, 0, 0]); // magazine base plate
  B(0.012, 0.01, 0.07, "polymer", 0, -0.052, -0.03); // trigger guard
  B(0.012, 0.035, 0.01, "polymer", 0, -0.04, -0.066);
  B(0.008, 0.026, 0.008, "gunmetal", 0, -0.038, -0.018); // trigger
  B(0.016, 0.02, 0.018, "gunmetal", 0, 0.035, 0.03); // hammer
  B(0.012, 0.012, 0.012, "polymer", 0, 0.067, -0.225); // front sight
  B(0.034, 0.012, 0.012, "polymer", 0, 0.067, 0.008); // rear sight
  for (const x of [-0.029, 0.029]) B(0.004, 0.1, 0.05, "gunmetal", x, -0.085, 0.07, [-0.28, 0, 0]); // grip panels
  C(0.016, 0.016, 0.03, 12, "gunmetal", 0, 0.015, -0.255); // muzzle
  put(new THREE.IcosahedronGeometry(0.03, 1), "pea", 0, 0.015, -0.275); // the pea on the muzzle
  return { group };
}

function shotgun(kit: ModelKit): WeaponModel {
  const group = new THREE.Group();
  const { B, C, Ball } = tools(kit, group);
  for (const x of [-0.028, 0.028]) {
    C(0.027, 0.026, 0.6, 12, "gunmetal", x, 0.02, -0.32); // barrels
    B(0.014, 0.03, 0.03, "gunmetal", x * 0.6, 0.04, 0.06, [0.5, 0, 0]); // hammers
    C(0.018, 0.018, 0.006, 8, "polymer", x, 0.02, -0.622); // bores
  }
  B(0.012, 0.008, 0.58, "gunmetal", 0, 0.05, -0.32); // rib
  Ball(0.007, "brass", 0, 0.058, -0.6); // front bead
  B(0.072, 0.036, 0.24, "wood", 0, -0.016, -0.3); // forend
  B(0.078, 0.075, 0.13, "gunmetal", 0, 0.002, 0.0); // receiver
  B(0.08, 0.02, 0.1, "gunmetal", 0, -0.04, 0.01); // receiver floor
  B(0.022, 0.01, 0.045, "gunmetal", 0, 0.043, 0.05); // top lever
  B(0.01, 0.01, 0.065, "gunmetal", 0, -0.062, 0.05); // trigger guard
  B(0.008, 0.024, 0.008, "gunmetal", 0, -0.05, 0.035); // trigger
  B(0.06, 0.1, 0.07, "wood", 0, -0.07, 0.11, [-0.38, 0, 0]); // pistol grip
  B(0.058, 0.075, 0.26, "wood", 0, -0.045, 0.27, [0.1, 0, 0]); // stock
  B(0.062, 0.09, 0.016, "polymer", 0, -0.06, 0.405, [0.1, 0, 0]); // butt pad
  for (const z of [-0.2, -0.43]) B(0.074, 0.006, 0.006, "gunmetal", 0, 0.005, z); // barrel bands
  return { group };
}

function sniper(kit: ModelKit): WeaponModel {
  const group = new THREE.Group();
  const { B, C, CX, Ball } = tools(kit, group);
  C(0.02, 0.015, 0.64, 8, "gunmetal", 0, 0.01, -0.48); // barrel (tapers to the front)
  B(0.046, 0.034, 0.07, "gunmetal", 0, 0.01, -0.81); // muzzle brake
  for (const z of [-0.795, -0.82]) B(0.048, 0.012, 0.008, "polymer", 0, 0.01, z); // brake ports
  B(0.06, 0.06, 0.2, "gunmetal", 0, 0.0, -0.05); // receiver
  CX(0.008, 0.055, 6, "gunmetal", 0.045, 0.012, 0.03); // bolt handle
  Ball(0.014, "gunmetal", 0.075, 0.012, 0.03);
  C(0.022, 0.022, 0.24, 10, "polymer", 0, 0.078, -0.06); // scope tube
  C(0.022, 0.033, 0.06, 10, "polymer", 0, 0.078, -0.21); // objective bell
  C(0.028, 0.022, 0.05, 10, "polymer", 0, 0.078, 0.085); // eyepiece
  C(0.03, 0.03, 0.004, 10, "lens", 0, 0.078, -0.241); // lens
  for (const z of [-0.12, 0.02]) B(0.02, 0.03, 0.02, "gunmetal", 0, 0.045, z); // scope rings
  B(0.06, 0.042, 0.32, "accent", 0, -0.03, -0.25); // forend (the Spin Doctor's purple, muted)
  B(0.05, 0.095, 0.06, "accent", 0, -0.075, 0.1, [-0.3, 0, 0]); // grip
  B(0.06, 0.07, 0.22, "accent", 0, -0.03, 0.26); // stock
  B(0.05, 0.022, 0.13, "accent", 0, 0.016, 0.24); // cheek rest
  B(0.062, 0.08, 0.016, "polymer", 0, -0.035, 0.375); // butt pad
  B(0.01, 0.01, 0.06, "gunmetal", 0, -0.058, 0.04); // trigger guard
  return { group };
}

function copter(kit: ModelKit): WeaponModel {
  const group = new THREE.Group();
  const { B, C } = tools(kit, group);
  C(0.075, 0.07, 0.24, 8, "gunmetal", 0, 0, 0.02); // motor housing
  C(0.077, 0.077, 0.035, 8, "hazard", 0, 0, -0.07); // hazard band
  B(0.075, 0.1, 0.13, "hazard", 0.095, -0.03, 0.05); // ammo box
  B(0.02, 0.06, 0.02, "polymer", 0.06, -0.01, -0.02); // feed chute
  B(0.04, 0.11, 0.06, "polymer", 0, -0.12, 0.12, [-0.2, 0, 0]); // rear grip
  B(0.03, 0.024, 0.15, "polymer", 0, 0.1, -0.02); // carry handle
  for (const z of [-0.08, 0.04]) B(0.024, 0.04, 0.02, "polymer", 0, 0.078, z); // handle posts
  const spinner = new THREE.Group();
  spinner.position.set(0, 0, -0.25);
  group.add(spinner);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    C(0.015, 0.014, 0.42, 6, "gunmetal", Math.cos(a) * 0.047, Math.sin(a) * 0.047, 0, spinner);
  }
  C(0.072, 0.072, 0.02, 8, "gunmetal", 0, 0, -0.19, spinner); // front clamp
  C(0.066, 0.066, 0.02, 8, "gunmetal", 0, 0, 0.0, spinner); // middle clamp
  return { group, spinner };
}

function reaper(kit: ModelKit): WeaponModel {
  const group = new THREE.Group();
  const { B, C, Ball, E } = tools(kit, group);
  C(0.028, 0.024, 1.35, 7, "wood", 0, 0, -0.32); // the shaft
  C(0.032, 0.032, 0.08, 7, "leather", 0, 0, 0.2); // grip wraps
  C(0.031, 0.031, 0.08, 7, "leather", 0, 0, -0.42);
  C(0.015, 0.015, 0.95, 8, "gunmetal", 0, 0.045, -0.5); // the sniper barrel along the shaft
  for (const z of [-0.2, -0.55, -0.88]) B(0.03, 0.05, 0.02, "gunmetal", 0, 0.025, z); // barrel clamps
  B(0.05, 0.085, 0.065, "gunmetal", 0, 0.02, -0.975); // blade collar
  // the blade: a crescent sweeping out to the left, perpendicular to the shaft
  const s = new THREE.Shape();
  s.moveTo(0, 0.065);
  s.quadraticCurveTo(-0.32, 0.11, -0.64, -0.07);
  s.quadraticCurveTo(-0.34, 0.0, 0, -0.04);
  s.closePath();
  E(s, 0.018, "blade", 0, 0.03, -0.98, undefined, 10);
  // bone charms on a leather cord
  B(0.004, 0.08, 0.004, "leather", 0.02, -0.04, -0.9);
  Ball(0.018, "bone", 0.02, -0.085, -0.9);
  Ball(0.013, "bone", 0.02, -0.06, -0.86);
  C(0.032, 0.028, 0.05, 7, "gunmetal", 0, 0, 0.36); // butt cap
  return { group };
}

function sakura(kit: ModelKit): WeaponModel {
  const group = new THREE.Group();
  const { C, Ball, E } = tools(kit, group);
  // the blade: a slight upward curve along -Z (outline in length x height, extruded through its thickness)
  const s = new THREE.Shape();
  s.moveTo(0, 0.026);
  s.quadraticCurveTo(0.5, 0.05, 0.97, 0.075); // spine to the tip
  s.quadraticCurveTo(0.55, 0.015, 0, -0.024); // edge back
  s.closePath();
  E(s, 0.012, "blade", 0, 0, -0.235, [0, Math.PI / 2, 0], 12);
  C(0.064, 0.064, 0.014, 10, "brass", 0, 0, -0.12); // tsuba (the guard)
  C(0.046, 0.046, 0.09, 6, "gunmetal", 0, 0, -0.18); // revolver cylinder (six flutes)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    C(0.008, 0.008, 0.092, 5, "polymer", Math.cos(a) * 0.03, Math.sin(a) * 0.03, -0.18); // chambers
  }
  C(0.026, 0.026, 0.26, 8, "wrap", 0, 0, 0.03); // the wrapped handle
  C(0.029, 0.025, 0.026, 8, "brass", 0, 0, 0.172); // pommel
  Ball(0.02, "accent", 0, -0.045, 0.19); // the sakura tassel
  return { group };
}

const BUILDERS: Record<WeaponId, (kit: ModelKit) => WeaponModel> = { pistol, shotgun, sniper, copter, reaper, sakura };

export function buildWeapon(id: WeaponId, kit: ModelKit): WeaponModel {
  return BUILDERS[id](kit);
}

/** Triangles in an object tree (the GDD's per-weapon budget). */
export function triangleCount(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = o.geometry as THREE.BufferGeometry;
    n += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  });
  return n;
}
