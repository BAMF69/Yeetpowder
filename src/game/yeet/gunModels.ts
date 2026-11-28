// ---------------------------------------------------------------------------
// gunModels.ts
// Purpose : The six weapons as low-poly models built in code, matched to the keyframes in docs/concept/keyframes
//           (GDD: "N64 spy action", faceted shapes, painted surfaces; 300-2,500 triangles per held weapon):
//             Pea Pistol      a stubby service pistol with a pea-green stripe and the pea on its muzzle
//             Boomstick       the shotgun keyframe's short double-barrel with a wooden pistol-grip stock
//             Spin Doctor     a bolt rifle with a thumbhole chassis, a turreted scope and a slotted muzzle brake
//             Gatling Copter  the gatling keyframes' minigun: boxy body, rear D-handle, top carry handle, six barrels
//             Reaper's Kick   the reaper keyframes' scoped rifle with a slotted handguard and a giant crescent blade
//             Six-Shot Sakura a curved katana with a brass guard and a six-chamber revolver cylinder
// Usage   : const m = buildWeapon("shotgun", kit)   // kit: materials and geometry tracking (viewmodel.ts)
//           registerWeaponArt(id, build) swaps in a loaded model (meshyArt.ts); buildWeapon then returns it.
//           m.group is in gun space (barrel toward -Z, +Y up); m.grip / m.fore / m.muzzle are where the hands hold
//           it and where shots leave; m.spinner (the Gatling's barrels) spins about Z.
// Notes   : Most parts are side profiles (outlines in the gun's Z-Y plane) extruded through the gun's width with a
//           small bevel, which gives the chamfered N64 silhouettes that stacked boxes could not. No DOM here: the kit
//           supplies materials, so Vitest builds every model and counts its triangles (tests/gunModels.test.ts).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// Updated : 2026-11-22 with Claude (Opus 5.5, claude-opus-5-5): profiles and bevels after the art pass 2 review
//           (the Gatling and the scythe were too small, everything too crude next to the concept art)
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
  /** In gun space: where the right hand holds it, the left hand (null: one-handed), and the barrel's end. */
  grip: THREE.Vector3;
  fore: THREE.Vector3 | null;
  muzzle: THREE.Vector3;
  /** Metres per model unit when held (the models are drawn larger than life; the Gatling is the big one). */
  scale: number;
  spinner?: THREE.Object3D;
  /** Shield only: canonical height of the viewport's centre. */
  viewportY?: number;
}

/** What a builder returns (buildWeapon adds the scale). */
type Built = Omit<WeaponModel, "scale">;
type Rot = [number, number, number];
/** A side-profile point: [z, y] in gun space (z toward the back is +). */
type P = [number, number];

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function outline(pts: P[], into: THREE.Shape | THREE.Path = new THREE.Shape()): THREE.Shape | THREE.Path {
  pts.forEach(([z, y], i) => (i ? into.lineTo(z, y) : into.moveTo(z, y)));
  into.closePath();
  return into;
}

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
    /** A cylinder along X (bolt handles, side turrets). */
    CX: (r: number, len: number, sides: number, key: MatKey, x: number, y: number, z: number) => {
      const g = new THREE.CylinderGeometry(r, r, len, sides);
      g.rotateZ(Math.PI / 2);
      return put(g, key, x, y, z);
    },
    /** A cylinder along Y (top turrets). */
    CY: (r: number, len: number, sides: number, key: MatKey, x: number, y: number, z: number) =>
      put(new THREE.CylinderGeometry(r, r, len, sides), key, x, y, z),
    /** A faceted ball (knobs, charms, the pea); detail 1 is rounder. */
    Ball: (r: number, key: MatKey, x: number, y: number, z: number, detail = 0) =>
      put(new THREE.IcosahedronGeometry(r, detail), key, x, y, z),
    /**
     * A side profile: `pts` ([z, y] in gun space) extruded `width` wide across X, centred on x, edges bevelled by
     * `bevel` (inside the outline, so the outline is the true size). `holes` cut through (slots, trigger guards).
     */
    side: (pts: P[], width: number, key: MatKey, opts: { x?: number; bevel?: number; holes?: P[][] } = {}) => {
      const shape = outline(pts) as THREE.Shape;
      for (const h of opts.holes ?? []) shape.holes.push(outline(h, new THREE.Path()) as THREE.Path);
      const b = Math.min(opts.bevel ?? 0.006, width / 3);
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: width - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 1,
      });
      g.translate(0, 0, -(width - 2 * b) / 2);
      return put(g, key, opts.x ?? 0, 0, 0, [0, -Math.PI / 2, 0]); // shape x -> gun +z, extrusion -> gun x
    },
    /** A flat outline in the gun's X-Y plane (facing the player), `depth` thick along Z, bevelled edges. */
    face: (shape: THREE.Shape, depth: number, key: MatKey, x: number, y: number, z: number, bevel: number, segs = 10) => {
      const g = new THREE.ExtrudeGeometry(shape, {
        depth, bevelEnabled: true, bevelThickness: bevel * 0.5, bevelSize: bevel, bevelSegments: 1, curveSegments: segs,
      });
      g.translate(0, 0, -depth / 2);
      return put(g, key, x, y, z);
    },
  };
}

/** Rectangular slots along z for a slotted handguard or brake: n holes, each `len` long, from z0 forward. */
function slots(n: number, z0: number, len: number, gap: number, y0: number, y1: number): P[][] {
  const out: P[][] = [];
  for (let i = 0; i < n; i++) {
    const a = z0 - i * (len + gap);
    out.push([[a, y1], [a, y0], [a - len, y0], [a - len, y1]]);
  }
  return out;
}

function pistol(kit: ModelKit): Built {
  const group = new THREE.Group();
  const { B, C, Ball, side } = tools(kit, group);
  // slide: chamfered top edges front and back
  side([[-0.255, 0], [0.035, 0], [0.035, 0.044], [0.02, 0.058], [-0.24, 0.058], [-0.255, 0.044]], 0.056, "gunmetal", { bevel: 0.006 });
  for (const z of [0.004, 0.014, 0.024]) B(0.06, 0.036, 0.004, "polymer", 0, 0.026, z); // rear serrations
  B(0.003, 0.018, 0.05, "polymer", 0.028, 0.04, -0.06); // ejection port
  B(0.059, 0.009, 0.17, "pea", 0, 0.022, -0.13); // the pea-green stripe
  // frame and grip in one outline, the trigger guard cut through
  side([
    [-0.215, 0], [0.04, 0], [0.046, -0.015], [0.098, -0.165], [0.09, -0.18], [0.03, -0.18], [0.0, -0.046], [-0.02, -0.042],
    [-0.03, -0.078], [-0.095, -0.078], [-0.105, -0.04], [-0.215, -0.03],
  ], 0.05, "polymer", { bevel: 0.007, holes: [[[-0.03, -0.036], [-0.034, -0.064], [-0.088, -0.064], [-0.092, -0.036]]] });
  side([[0.044, -0.034], [0.088, -0.162], [0.042, -0.168], [0.01, -0.052]], 0.058, "wood", { bevel: 0.005 }); // grip panels
  B(0.008, 0.026, 0.01, "gunmetal", 0, -0.048, -0.052, [0.3, 0, 0]); // trigger
  B(0.014, 0.022, 0.016, "gunmetal", 0, 0.038, 0.046, [-0.5, 0, 0]); // hammer
  B(0.01, 0.012, 0.012, "polymer", 0, 0.064, -0.235); // front sight
  B(0.034, 0.012, 0.014, "polymer", 0, 0.064, 0.02); // rear sight
  C(0.017, 0.017, 0.025, 12, "gunmetal", 0, 0.03, -0.265); // barrel tip
  Ball(0.032, "pea", 0, 0.03, -0.295, 1); // the pea
  return { group, grip: v(0, -0.09, 0.05), fore: null, muzzle: v(0, 0.03, -0.32) };
}

function shotgun(kit: ModelKit): Built {
  const group = new THREE.Group();
  const { B, C, Ball, side } = tools(kit, group);
  for (const x of [-0.029, 0.029]) {
    C(0.028, 0.027, 0.56, 12, "gunmetal", x, 0.02, -0.34); // barrels
    C(0.031, 0.031, 0.022, 12, "gunmetal", x, 0.02, -0.61); // muzzle rings
    C(0.019, 0.019, 0.004, 10, "polymer", x, 0.02, -0.622); // bores
    B(0.016, 0.03, 0.03, "gunmetal", x * 0.65, 0.058, 0.075, [0.6, 0, 0]); // hammers
  }
  B(0.014, 0.01, 0.54, "gunmetal", 0, 0.052, -0.34); // rib
  Ball(0.007, "brass", 0, 0.06, -0.6); // front bead
  side([[-0.06, 0.052], [0.04, 0.052], [0.085, 0.02], [0.085, -0.035], [0.05, -0.056], [-0.06, -0.056]], 0.112, "gunmetal", { bevel: 0.01 }); // receiver
  B(0.022, 0.01, 0.05, "gunmetal", 0.008, 0.058, 0.05, [0, 0.35, 0]); // top lever
  side([[-0.42, -0.004], [-0.07, -0.004], [-0.06, -0.046], [-0.38, -0.046]], 0.092, "wood", { bevel: 0.012 }); // forend
  // stock with a pistol grip (the keyframe's)
  side([
    [0.08, 0.036], [0.42, -0.02], [0.43, -0.122], [0.36, -0.132], [0.2, -0.075], [0.17, -0.078], [0.145, -0.175], [0.075, -0.175],
    [0.088, -0.06], [0.07, -0.04],
  ], 0.072, "wood", { bevel: 0.012 });
  side([[0.418, -0.016], [0.446, -0.02], [0.456, -0.128], [0.428, -0.132]], 0.076, "polymer", { bevel: 0.006 }); // butt pad
  B(0.074, 0.012, 0.072, "polymer", 0, -0.178, 0.11); // grip cap
  B(0.012, 0.01, 0.075, "gunmetal", 0, -0.09, 0.03); // trigger guard
  B(0.012, 0.04, 0.01, "gunmetal", 0, -0.07, -0.005);
  B(0.008, 0.026, 0.008, "gunmetal", 0, -0.068, 0.03, [0.3, 0, 0]); // trigger
  return { group, grip: v(0, -0.11, 0.11), fore: v(0, -0.025, -0.25), muzzle: v(0, 0.02, -0.63) };
}

function sniper(kit: ModelKit): Built {
  const group = new THREE.Group();
  const { B, C, CX, CY, Ball, side } = tools(kit, group);
  C(0.02, 0.015, 0.62, 10, "gunmetal", 0, 0.012, -0.5); // barrel (tapers to the front)
  side([[-0.88, 0.04], [-0.8, 0.04], [-0.8, -0.016], [-0.88, -0.016]], 0.05, "gunmetal", {
    bevel: 0.006, holes: slots(3, -0.81, 0.012, 0.012, -0.004, 0.028),
  }); // slotted muzzle brake
  side([[-0.2, 0.042], [0.12, 0.042], [0.145, 0.022], [0.145, -0.03], [-0.2, -0.03]], 0.06, "gunmetal", { bevel: 0.007 }); // receiver
  CX(0.008, 0.06, 6, "gunmetal", 0.045, 0.02, 0.06); // bolt handle
  Ball(0.015, "gunmetal", 0.078, 0.02, 0.06);
  side([[-0.06, -0.03], [0.02, -0.03], [0.012, -0.115], [-0.06, -0.105]], 0.04, "polymer", { bevel: 0.005 }); // magazine
  // chassis: forend, grip and a thumbhole stock in one outline (the Spin Doctor's purple)
  side([
    [-0.52, -0.004], [-0.2, -0.02], [0.15, -0.02], [0.2, 0], [0.25, 0.036], [0.46, 0.036], [0.47, -0.112], [0.42, -0.122],
    [0.3, -0.062], [0.24, -0.062], [0.205, -0.165], [0.135, -0.165], [0.13, -0.062], [0.08, -0.05], [-0.2, -0.05], [-0.52, -0.04],
  ], 0.058, "accent", { bevel: 0.009, holes: [[[0.275, 0.012], [0.42, 0.012], [0.42, -0.058], [0.325, -0.04]]] });
  for (const z of [-0.46, -0.4, -0.34, -0.28]) B(0.06, 0.012, 0.03, "polymer", 0, -0.027, z); // forend vents
  B(0.05, 0.022, 0.14, "accent", 0, 0.05, 0.36); // cheek rest
  side([[0.458, 0.04], [0.482, 0.04], [0.492, -0.115], [0.468, -0.122]], 0.062, "polymer", { bevel: 0.006 }); // butt pad
  B(0.012, 0.01, 0.07, "gunmetal", 0, -0.075, 0.095); // trigger guard
  // scope: tube, objective bell, eyepiece, lens, turrets, mounts
  C(0.022, 0.022, 0.26, 12, "polymer", 0, 0.088, -0.06);
  C(0.022, 0.034, 0.07, 12, "polymer", 0, 0.088, -0.225);
  C(0.035, 0.035, 0.02, 12, "polymer", 0, 0.088, -0.27);
  C(0.03, 0.023, 0.06, 12, "polymer", 0, 0.088, 0.1);
  C(0.031, 0.031, 0.004, 12, "lens", 0, 0.088, -0.281);
  CY(0.013, 0.03, 8, "polymer", 0, 0.115, -0.06);
  CX(0.013, 0.03, 8, "polymer", 0.03, 0.088, -0.06);
  for (const z of [-0.13, 0.02]) B(0.026, 0.04, 0.022, "gunmetal", 0, 0.058, z);
  return { group, grip: v(0, -0.11, 0.17), fore: v(0, -0.04, -0.3), muzzle: v(0, 0.012, -0.88) };
}

function copter(kit: ModelKit): Built {
  const group = new THREE.Group();
  const { B, C, side } = tools(kit, group);
  // the body: a chamfered box like the keyframe's, with the "||" vents on each side
  side([[-0.16, 0.08], [-0.12, 0.11], [0.27, 0.11], [0.3, 0.08], [0.3, -0.1], [0.27, -0.13], [-0.12, -0.13], [-0.16, -0.1]], 0.2, "gunmetal", { bevel: 0.02 });
  for (const x of [-0.101, 0.101]) for (const z of [0.04, 0.07]) B(0.004, 0.06, 0.014, "polymer", x, -0.01, z);
  B(0.18, 0.2, 0.025, "gunmetal", 0, -0.01, 0.31); // rear plate
  C(0.095, 0.095, 0.07, 10, "gunmetal", 0, 0, -0.19); // barrel shroud
  // rear D-handle (the right hand) and the top carry handle (the left hand): concave outlines, not boxes
  side([[0.3, 0.06], [0.49, 0.06], [0.51, 0.04], [0.51, -0.16], [0.49, -0.18], [0.3, -0.18], [0.3, -0.14], [0.47, -0.14], [0.47, 0.02], [0.3, 0.02]], 0.036, "gunmetal", { bevel: 0.006 });
  side([[-0.1, 0.1], [-0.1, 0.25], [0.2, 0.25], [0.2, 0.1], [0.17, 0.1], [0.17, 0.215], [-0.07, 0.215], [-0.07, 0.1]], 0.032, "gunmetal", { bevel: 0.006 });
  // ammo box on the right and a brass belt into the body
  side([[0.0, -0.04], [0.2, -0.04], [0.2, -0.2], [0.0, -0.2]], 0.1, "polymer", { x: 0.16, bevel: 0.012 });
  for (let i = 0; i < 4; i++) B(0.03, 0.012, 0.03, "brass", 0.115 - i * 0.002, -0.035 + i * 0.03, 0.1, [0, 0, 0.6]);
  // six barrels with two clamps (the spinner turns while firing)
  const spinner = new THREE.Group();
  spinner.position.set(0, 0, -0.22);
  group.add(spinner);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    C(0.022, 0.02, 0.68, 8, "gunmetal", Math.cos(a) * 0.068, Math.sin(a) * 0.068, -0.34, spinner);
  }
  C(0.1, 0.1, 0.035, 10, "gunmetal", 0, 0, -0.26, spinner);
  C(0.1, 0.1, 0.035, 10, "gunmetal", 0, 0, -0.6, spinner);
  return { group, spinner, grip: v(0, -0.06, 0.49), fore: v(0, 0.232, 0.02), muzzle: v(0, 0, -0.9) }; // right hand on the back, left on top
}

function reaper(kit: ModelKit): Built {
  const group = new THREE.Group();
  const { B, C, Ball, side, face } = tools(kit, group);
  // the rifle: receiver, stock, pistol grip, magazine, a slotted handguard over the barrel, a slotted collar
  side([[-0.2, 0.046], [0.12, 0.046], [0.145, 0.026], [0.145, -0.036], [-0.2, -0.036]], 0.066, "gunmetal", { bevel: 0.008 });
  side([[0.14, 0.032], [0.46, 0.032], [0.472, -0.1], [0.42, -0.112], [0.3, -0.062], [0.2, -0.046], [0.14, -0.036]], 0.06, "polymer", { bevel: 0.01 });
  side([[0.075, -0.034], [0.14, -0.034], [0.2, -0.175], [0.135, -0.185]], 0.05, "polymer", { bevel: 0.008 });
  side([[-0.085, -0.034], [0.02, -0.034], [0.0, -0.145], [-0.085, -0.135]], 0.046, "polymer", { bevel: 0.006 });
  C(0.016, 0.016, 0.66, 8, "gunmetal", 0, 0, -0.52); // barrel
  side([[-0.82, 0.042], [-0.2, 0.042], [-0.2, -0.042], [-0.82, -0.042]], 0.072, "gunmetal", {
    bevel: 0.007, holes: slots(7, -0.25, 0.055, 0.025, -0.014, 0.016),
  });
  side([[-0.96, 0.054], [-0.82, 0.054], [-0.82, -0.054], [-0.96, -0.054]], 0.084, "gunmetal", {
    bevel: 0.008, holes: slots(3, -0.84, 0.022, 0.016, -0.032, 0.032),
  });
  // scope
  C(0.024, 0.024, 0.28, 12, "polymer", 0, 0.094, -0.05);
  C(0.024, 0.036, 0.07, 12, "polymer", 0, 0.094, -0.225);
  C(0.032, 0.025, 0.06, 12, "polymer", 0, 0.094, 0.12);
  C(0.033, 0.033, 0.004, 12, "lens", 0, 0.094, -0.262);
  for (const z of [-0.12, 0.04]) B(0.028, 0.04, 0.024, "gunmetal", 0, 0.062, z);
  // the crescent: a moon-shaped blade facing you, rising from the collar and curling in at the tip
  const s = new THREE.Shape();
  s.moveTo(0.02, -0.36);
  s.quadraticCurveTo(0.66, 0.26, -0.26, 1.18); // the back of the blade
  s.quadraticCurveTo(0.3, 0.3, 0.02, -0.36); // the cutting edge
  face(s, 0.016, "blade", 0, 0, -0.9, 0.012, 14);
  B(0.11, 0.08, 0.03, "gunmetal", 0.05, 0, -0.9); // tang into the collar
  // a bone charm on a leather cord under the collar
  B(0.004, 0.08, 0.004, "leather", 0.03, -0.09, -0.86);
  Ball(0.018, "bone", 0.03, -0.135, -0.86);
  return { group, grip: v(0, -0.11, 0.15), fore: v(0, -0.045, -0.45), muzzle: v(0, 0, -0.96) };
}

function sakura(kit: ModelKit): Built {
  const group = new THREE.Group();
  const { B, C, Ball, put } = tools(kit, group);
  // the blade: a slight upward curve along -Z (outline in length x height), bevelled to an edge
  const s = new THREE.Shape();
  s.moveTo(0, 0.026);
  s.quadraticCurveTo(0.5, 0.05, 0.97, 0.075); // spine to the tip
  s.quadraticCurveTo(0.55, 0.015, 0, -0.024); // edge back
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 12 });
  g.translate(0, 0, -0.003);
  put(g, "blade", 0, 0, -0.235, [0, Math.PI / 2, 0]);
  B(0.02, 0.06, 0.03, "brass", 0, 0.001, -0.225); // habaki (the blade collar)
  C(0.064, 0.064, 0.014, 10, "brass", 0, 0, -0.12); // tsuba (the guard)
  C(0.046, 0.046, 0.09, 6, "gunmetal", 0, 0, -0.18); // revolver cylinder (six flutes)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    C(0.008, 0.008, 0.092, 5, "polymer", Math.cos(a) * 0.03, Math.sin(a) * 0.03, -0.18); // chambers
  }
  C(0.026, 0.026, 0.26, 8, "wrap", 0, 0, 0.03); // the wrapped handle
  C(0.029, 0.025, 0.026, 8, "brass", 0, 0, 0.172); // pommel
  Ball(0.02, "accent", 0, -0.045, 0.19); // the sakura tassel
  return { group, grip: v(0, 0, 0.06), fore: null, muzzle: v(0, 0, -0.23) };
}

/** Rocket Launcher: a fat tube over the shoulder grip, a sight, the pink warhead showing at the front. */
function rocket(kit: ModelKit): Built {
  const group = new THREE.Group();
  const { B, C, Ball } = tools(kit, group);
  C(0.085, 0.085, 1.0, 12, "polymer", 0, 0.02, -0.2); // the tube
  C(0.095, 0.095, 0.08, 12, "gunmetal", 0, 0.02, -0.7); // the muzzle ring
  C(0.095, 0.11, 0.1, 12, "gunmetal", 0, 0.02, 0.3); // the flared back
  Ball(0.06, "accent", 0, 0.02, -0.66); // the warhead in the tube
  B(0.05, 0.14, 0.06, "polymer", 0, -0.1, 0.06); // grip
  B(0.05, 0.12, 0.06, "polymer", 0, -0.09, -0.28); // front grip
  B(0.03, 0.07, 0.12, "gunmetal", 0.07, 0.1, -0.1); // the sight
  return { group, grip: v(0, -0.14, 0.06), fore: v(0, -0.12, -0.28), muzzle: v(0, 0.02, -0.72) };
}

/** Grenades: one in the hand, a ribbed pink yeetpowder grenade with its lever and pin. */
function grenade(kit: ModelKit): Built {
  const group = new THREE.Group();
  const { B, C, Ball } = tools(kit, group);
  const body = Ball(0.06, "accent", 0, 0.02, -0.04);
  body.scale.set(1, 1.2, 1);
  C(0.028, 0.028, 0.04, 8, "gunmetal", 0, 0.1, -0.04); // the fuse head
  B(0.016, 0.1, 0.02, "gunmetal", 0.02, 0.06, 0.01); // the lever
  C(0.018, 0.018, 0.006, 8, "brass", -0.035, 0.11, -0.04); // the pin's ring
  return { group, grip: v(0, 0, 0), fore: null, muzzle: v(0, 0.06, -0.12) };
}

/**
 * Kaboomerax (until the Meshy model loads), drawn in its aimed (over the shoulder) pose: the block at the back by
 * the hand, the haft running forward to the knobbed butt the rockets leave from, the blade on top along the haft.
 * From the hip the view tilts it butt-down (viewmodel.ts HOLD.axe).
 */
function axe(kit: ModelKit): Built {
  const group = new THREE.Group();
  const { B, C } = tools(kit, group);
  C(0.022, 0.022, 0.95, 8, "wood", 0, 0, -0.4); // the haft
  B(0.09, 0.12, 0.16, "gunmetal", 0, 0, 0.12); // the block at the back
  C(0.04, 0.05, 0.08, 10, "gunmetal", 0, 0, -0.9); // the knobbed butt (the rocket's exit)
  B(0.02, 0.26, 0.5, "blade", 0, 0.15, -0.4); // the blade along the haft (edge up: forward once tilted)
  return { group, grip: v(0, 0, 0.02), fore: v(0, 0, -0.35), muzzle: v(0, 0, -0.95) };
}

function shield(kit: ModelKit): Built {
  const group = new THREE.Group();
  const { B } = tools(kit, group);
  // A real opening, rather than an opaque pane, keeps the aimed viewport usable in noart too.
  B(0.95, 1.05, 0.1, "gunmetal", 0, -0.325, 0);
  B(0.95, 0.2, 0.1, "gunmetal", 0, 0.75, 0);
  for (const x of [-0.36, 0.36]) B(0.23, 0.5, 0.1, "gunmetal", x, 0.4, 0);
  B(0.75, 0.12, 0.11, "accent", 0, -0.3, -0.015);
  for (const x of [-0.18, 0.18]) B(0.08, 0.27, 0.18, "leather", x, -0.1, 0.12);
  return { group, grip: v(-0.18, -0.1, 0.18), fore: v(0.18, -0.1, 0.18), muzzle: v(0, 0, -0.2), viewportY: 0.425 };
}
const BUILDERS: Record<WeaponId, (kit: ModelKit) => Built> = { pistol, shotgun, sniper, copter, reaper, sakura, rocket, grenade, axe, shield };

/** Metres per model unit for every gun but the Gatling, which is held bigger (playtest: "too small"). */
const SCALE = 0.62;
const COPTER_SCALE = 0.88;

/**
 * Art models that replace a code-built gun once loaded (meshyArt.ts: the Meshy scythe for Reaper's Kick). A builder
 * returns a fresh copy in gun space (barrel toward -Z) with its hand points; null: use the code model.
 */
const ART: Partial<Record<WeaponId, () => WeaponModel>> = {};

/** Registers (or with null, removes) the art model for a gun; guns built after this use it. */
export function registerWeaponArt(id: WeaponId, build: (() => WeaponModel) | null): void {
  if (build) ART[id] = build;
  else delete ART[id];
}

/** True while an art model replaces this gun's code model. */
export function hasWeaponArt(id: WeaponId): boolean {
  return id in ART;
}

export function buildWeapon(id: WeaponId, kit: ModelKit): WeaponModel {
  const art = ART[id];
  if (art) return art();
  return { scale: id === "copter" ? COPTER_SCALE : SCALE, ...BUILDERS[id](kit) };
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
