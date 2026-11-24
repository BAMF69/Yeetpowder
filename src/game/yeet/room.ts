// ---------------------------------------------------------------------------
// room.ts
// Purpose : Draws a level from its collision boxes (src/core/yeet/arena.ts), so what you see is exactly what you
//           collide with, in the vertical slice's look (docs/GDD.md art direction, the shotgun corridor keyframe):
//           painted concrete walls with an orange band, a dark worn floor, a ceiling with fluorescent panels,
//           wooden crates, teal riveted steel and hazard-striped trim on tall blocks.
// Usage   : const room = buildRoom(arena); scene.add(room.group); ... room.dispose()
// Notes   : Every surface is an axis-aligned box, so each face gets UVs from its world position (metres / tile
//           size): textures never stretch and line up across boxes. Crates, riveted steel and lights are pictures
//           of a whole object instead, so their faces show whole copies (fittedUVs), stretched a little to fit. This gives the kit's triplanar recipe's result
//           without a custom shader, so three.js lighting, shadows and fog keep working (SOP-24: the triplanar
//           recipe is for models with poor UVs). Textures: src/game/yeet/paint.ts. No outlines (GDD).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// Updated : 2026-11-22 with Claude (Opus 5.5, claude-opus-5-5): the painted vertical-slice look (was gray boxes)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import type { Arena, Box } from "../../core/yeet/arena";
import { disposePaint, paintedTexture, type PaintKind } from "./paint";

/** Metres per texture repeat, per surface. */
const TILE: Partial<Record<PaintKind, number>> = {
  concrete: 3, floor: 2, ceiling: 3, crate: 1.6, steel: 2, hazard: 0.8, band: 2, light: 1,
};
const BAND = { bottom: 1.15, top: 1.6, inset: 0.02 }; // the orange wall stripe (m above the floor)
const HAZARD_H = 0.45; // hazard trim round the foot of tall blocks
const LIGHT_EVERY = 8; // m between ceiling light panels
const DOOR = { width: 4.2, height: 4.2, depth: 0.08 }; // a riveted steel door in the middle of each wall (decoration)

/** Which painted surface a block gets, from its size. */
function blockKind(b: Box): PaintKind {
  const h = b.max.y - b.min.y;
  const w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
  const thin = Math.min(b.max.x - b.min.x, b.max.z - b.min.z);
  if (h <= 1.7 && thin <= 1.2) return "steel"; // low cover walls
  if (h <= 3.6 && w <= 4.5) return "crate";
  return "concrete";
}

/**
 * Surfaces painted as a whole object (a crate's frame and X-brace, a riveted panel, a light): each face shows a
 * whole number of copies, never a cut-off one (Elaina, 2026-11-24: "boxes appear as partial textures").
 */
const FITTED = new Set<PaintKind>(["crate", "steel", "light"]);

/** Copies of a texture across a face `size` metres wide: the nearest whole number to size / tile, at least one. */
export function fitRepeats(size: number, tile: number): number {
  return Math.max(1, Math.round(size / tile));
}

/** Rewrites a box geometry's UVs so each face runs 0..n in whole copies (fitRepeats) from its edge. */
function fittedUVs(geo: THREE.BufferGeometry, size: THREE.Vector3, tile: number): void {
  const pos = geo.getAttribute("position");
  const nrm = geo.getAttribute("normal");
  const uv = geo.getAttribute("uv");
  const f = (p: number, s: number) => (p + s / 2) / Math.max(s, 1e-6) * fitRepeats(s, tile); // 0..n across the face
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.abs(nrm.getX(i)) > 0.5) uv.setXY(i, f(z, size.z), f(y, size.y));
    else if (Math.abs(nrm.getY(i)) > 0.5) uv.setXY(i, f(x, size.x), f(z, size.z));
    else uv.setXY(i, f(x, size.x), f(y, size.y));
  }
  uv.needsUpdate = true;
}

/** Rewrites a box geometry's UVs from world positions: x/z/y metres over the tile size, per face direction. */
function worldUVs(geo: THREE.BufferGeometry, center: THREE.Vector3, tile: number): void {
  const pos = geo.getAttribute("position");
  const nrm = geo.getAttribute("normal");
  const uv = geo.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + center.x;
    const y = pos.getY(i) + center.y;
    const z = pos.getZ(i) + center.z;
    const nx = Math.abs(nrm.getX(i));
    const ny = Math.abs(nrm.getY(i));
    let u: number;
    let v: number;
    if (nx > 0.5) {
      u = z;
      v = y;
    } else if (ny > 0.5) {
      u = x;
      v = z;
    } else {
      u = x;
      v = y;
    }
    uv.setXY(i, u / tile, v / tile);
  }
  uv.needsUpdate = true;
}

export function buildRoom(arena: Arena): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats = new Map<PaintKind, THREE.Material>();
  const mat = (kind: PaintKind): THREE.Material => {
    let m = mats.get(kind);
    if (!m) {
      // light panels glow, and the ceiling (facing away from every light) shows as painted: both unlit
      m = kind === "light" || kind === "ceiling"
        ? new THREE.MeshBasicMaterial({ map: paintedTexture(kind) })
        : new THREE.MeshStandardMaterial({ map: paintedTexture(kind), roughness: 0.92, metalness: kind === "steel" ? 0.15 : 0 });
      mats.set(kind, m);
    }
    return m;
  };
  /** Adds a textured box (world-space min/max) to the group. */
  const addBox = (min: THREE.Vector3, max: THREE.Vector3, kind: PaintKind, shadows: { cast: boolean; receive: boolean }) => {
    const size = new THREE.Vector3().subVectors(max, min);
    const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    if (FITTED.has(kind)) fittedUVs(geo, size, TILE[kind] ?? 1);
    else worldUVs(geo, center, TILE[kind] ?? 1);
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, mat(kind));
    mesh.position.copy(center);
    mesh.castShadow = shadows.cast;
    mesh.receiveShadow = shadows.receive;
    group.add(mesh);
    return mesh;
  };
  const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  for (const b of arena.boxes) {
    const top = b.kind === "wall" ? Math.min(b.max.y, b.drawTop ?? b.max.y) : b.max.y;
    const min = v3(b.min.x, b.min.y, b.min.z);
    const max = v3(b.max.x, top, b.max.z);
    if (b.kind === "floor") {
      addBox(min, max, "floor", { cast: false, receive: true });
    } else if (b.kind === "ceiling") {
      addBox(min, max, "ceiling", { cast: false, receive: false });
      // fluorescent panels on a grid just under the ceiling
      for (let x = Math.ceil(b.min.x / LIGHT_EVERY) * LIGHT_EVERY; x < b.max.x - 1; x += LIGHT_EVERY) {
        for (let z = Math.ceil(b.min.z / LIGHT_EVERY) * LIGHT_EVERY; z < b.max.z - 1; z += LIGHT_EVERY) {
          addBox(v3(x - 1.2, b.min.y - 0.1, z - 0.6), v3(x + 1.2, b.min.y, z + 0.6), "light", { cast: false, receive: false });
        }
      }
    } else if (b.kind === "wall") {
      addBox(min, max, "concrete", { cast: false, receive: true });
      addWallBand(b, addBox, v3);
    } else {
      const kind = blockKind(b);
      addBox(min, max, kind, { cast: true, receive: true });
      if (kind === "concrete" && b.min.y === 0) {
        // hazard stripes round the foot of tall concrete blocks (pillars, ledges, the tower)
        const e = 0.015;
        addBox(v3(b.min.x - e, 0, b.min.z - e), v3(b.max.x + e, HAZARD_H, b.max.z + e), "hazard", { cast: false, receive: true });
      }
    }
  }
  return {
    group,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats.values()) m.dispose();
      disposePaint();
    },
  };
}

/** The orange band along a wall's inner face (the face toward the room's middle). */
function addWallBand(
  b: Box,
  addBox: (min: THREE.Vector3, max: THREE.Vector3, kind: PaintKind, s: { cast: boolean; receive: boolean }) => unknown,
  v3: (x: number, y: number, z: number) => THREE.Vector3,
): void {
  const sx = b.max.x - b.min.x;
  const sz = b.max.z - b.min.z;
  const s = { cast: false, receive: true };
  const hw = DOOR.width / 2;
  if (sx < sz) {
    // a wall along z: its inner face is the x face nearer x = 0
    const x = Math.abs(b.min.x) < Math.abs(b.max.x) ? b.min.x : b.max.x;
    const dir = x === b.min.x ? -1 : 1;
    const mz = (b.min.z + b.max.z) / 2;
    addBox(v3(Math.min(x, x + dir * BAND.inset), BAND.bottom, b.min.z), v3(Math.max(x, x + dir * BAND.inset), BAND.top, b.max.z), "band", s);
    addBox(v3(Math.min(x, x + dir * DOOR.depth), 0, mz - hw), v3(Math.max(x, x + dir * DOOR.depth), DOOR.height, mz + hw), "steel", s);
  } else {
    const z = Math.abs(b.min.z) < Math.abs(b.max.z) ? b.min.z : b.max.z;
    const dir = z === b.min.z ? -1 : 1;
    const mx = (b.min.x + b.max.x) / 2;
    addBox(v3(b.min.x, BAND.bottom, Math.min(z, z + dir * BAND.inset)), v3(b.max.x, BAND.top, Math.max(z, z + dir * BAND.inset)), "band", s);
    addBox(v3(mx - hw, 0, Math.min(z, z + dir * DOOR.depth)), v3(mx + hw, DOOR.height, Math.max(z, z + dir * DOOR.depth)), "steel", s);
  }
}
