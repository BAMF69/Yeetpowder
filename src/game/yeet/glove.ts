// ---------------------------------------------------------------------------
// glove.ts
// Purpose : The operative's chunky black fingerless glove (the keyframes: leather back and gauntlet, bare fingers
//           and thumb tip), shared by the first-person arms (viewmodel.ts) and the third-person body (operative.ts).
// Usage   : const g = buildGlove(bank, +1, bank.paint("navy")); hand.add(g)
// Notes   : Centred on the grip. Local +Z runs along the forearm toward the knuckles, +Y is the back of the hand;
//           thumbSide (+1 / -1) puts the thumb on local +X or -X (mirrored hands). About 0.074 m wide at scale 1.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { SKIN, type MaterialBank } from "./materials";

const CUFF_SIDES = 6;

export function buildGlove(bank: MaterialBank, thumbSide: number, cuff: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const leather = bank.paint("leather");
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0) => {
    const m = new THREE.Mesh(bank.geo(geo), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = true;
    g.add(m);
  };
  add(new THREE.BoxGeometry(0.074, 0.064, 0.07), leather, 0, 0, 0); // the fist
  add(new THREE.BoxGeometry(0.078, 0.032, 0.03), leather, 0, 0.012, 0.038); // knuckle ridge
  add(new THREE.BoxGeometry(0.024, 0.028, 0.05), leather, thumbSide * 0.042, 0.008, 0.012, thumbSide * 0.35); // thumb
  add(new THREE.BoxGeometry(0.066, 0.058, 0.04), leather, 0, -0.002, -0.05); // the gauntlet
  // fingerless: bare fingers curl round the grip in front of the knuckles and under it, and the thumb tip shows
  const skin = bank.plain(SKIN);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.018;
    add(new THREE.BoxGeometry(0.016, 0.03, 0.022), skin, x, -0.008, 0.044);
    add(new THREE.BoxGeometry(0.016, 0.02, 0.026), skin, x, -0.036, 0.03);
  }
  add(new THREE.BoxGeometry(0.02, 0.022, 0.02), skin, thumbSide * 0.05, 0.01, 0.04, thumbSide * 0.35);
  const c = new THREE.CylinderGeometry(0.044, 0.046, 0.028, CUFF_SIDES);
  c.rotateX(Math.PI / 2);
  add(c, cuff, 0, 0, -0.082); // the rolled sleeve cuff
  return g;
}
