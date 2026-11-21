// ---------------------------------------------------------------------------
// room.ts
// Purpose : Draws the toy's gray-box arena from its collision boxes (src/core/yeet/arena.ts), so what you see is
//           exactly what you collide with: a checkered floor (1 m tiles, to read speed and distance), walls, blocks
//           with dark edges.
// Usage   : const room = buildRoom(arena); scene.add(room.group); ... room.dispose()
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import type { Arena } from "../../core/yeet/arena";

const BLOCK_COLORS = ["#c9b79c", "#9fb4c7", "#c7a09f", "#a9c79f", "#c7c09f"];

function checkerTexture(a: string, b: string, cells: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = a;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = b;
  g.fillRect(0, 0, 32, 32);
  g.fillRect(32, 32, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(cells, cells);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function buildRoom(arena: Arena): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const tex: THREE.Texture[] = [];
  const edgeMat = new THREE.LineBasicMaterial({ color: "#2a2f3a", transparent: true, opacity: 0.55 });
  mats.push(edgeMat);
  let blockN = 0;
  for (const b of arena.boxes) {
    const top = b.kind === "wall" ? Math.min(b.max.y, b.drawTop ?? b.max.y) : b.max.y;
    const sx = b.max.x - b.min.x;
    const sy = top - b.min.y;
    const sz = b.max.z - b.min.z;
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    geos.push(geo);
    let mat: THREE.MeshStandardMaterial;
    if (b.kind === "floor") {
      const t = checkerTexture("#8d939c", "#7c828b", Math.round(sx / 2));
      tex.push(t);
      mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
    } else if (b.kind === "wall") {
      const t = checkerTexture("#b8bec7", "#aeb4bd", 1);
      t.repeat.set(Math.max(sx, sz) / 4, sy / 4);
      tex.push(t);
      mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    } else {
      mat = new THREE.MeshStandardMaterial({ color: BLOCK_COLORS[blockN++ % BLOCK_COLORS.length], roughness: 0.85 });
    }
    mats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((b.min.x + b.max.x) / 2, (b.min.y + top) / 2, (b.min.z + b.max.z) / 2);
    mesh.receiveShadow = true;
    mesh.castShadow = b.kind === "block";
    group.add(mesh);
    if (b.kind !== "floor") {
      const eg = new THREE.EdgesGeometry(geo);
      geos.push(eg);
      const lines = new THREE.LineSegments(eg, edgeMat);
      lines.position.copy(mesh.position);
      group.add(lines);
    }
  }
  return {
    group,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const t of tex) t.dispose();
    },
  };
}
