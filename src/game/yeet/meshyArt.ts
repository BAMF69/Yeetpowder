// ---------------------------------------------------------------------------
// meshyArt.ts
// Purpose : Elaina's Meshy models in the game (2026-11-24): the sniper scythe as Reaper's Kick and the katana
//           gunblade as the Six-Shot Sakura (first person and third person), and the rigged tactical character as the operative (your body in third person, duel
//           opponents and bots; operativeSkin.ts drives its bones from the code figure's poses). Loaded during the world's loading screen; until then, or if a file fails, the code-built
//           models stay (gunModels.ts), so nothing depends on the art being there.
// Usage   : await loadMeshyArt(progress)   in a world's load(); then vm.rebuildGun("reaper") for guns already built
//           and op.useSkin(operativeArt()!) for operatives already made
//           ?noart skips it (the code models, e.g. to compare or on a slow phone).
// Notes   : The .glb files are the Meshy exports with their textures shrunk to 1024 px JPEG by tools/slim_glb.mjs
//           (44 MB -> 0.8 MB for the scythe); everything else in them is as Meshy made it. ASSET_LOG A-0012 to A-0014.
//           Meshy's weapons lie along X with the business end toward -X, +Y up; gun space is barrel toward -Z, so
//           they turn -90 degrees about Y. Hand points were measured from the vertices (WEAPONS below). The shared geometry, materials and
//           textures live as long as the page (each gun is a clone), so the material banks never dispose them.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { WeaponId } from "../../core/yeet/tuning";
import { Log } from "../../core/log";
import { registerWeaponArt, type WeaponModel } from "./gunModels";

const OPERATIVE_URL = "assets/models/meshy/operative.glb";
/** Metres per model unit when held (gunModels' SCALE for every gun but the Gatling). */
const HELD_SCALE = 0.62;

type P3 = readonly [number, number, number];
interface WeaponArt {
  url: string;
  /** Model units per Meshy unit (sized against the code-built model it replaces). */
  fit: number;
  /** Hand points and the muzzle in Meshy's own space (x along the weapon, its business end toward -x). */
  grip: P3;
  fore: P3 | null;
  muzzle: P3;
}

const WEAPONS: Partial<Record<WeaponId, WeaponArt>> = {
  // pistol grip: the low point at x +0.58; the barrel runs along y 0 out to the blade at x -0.95; grip to muzzle
  // then matches the code-built scythe's (1.15 against 1.11 model units)
  reaper: { url: "assets/models/meshy/reaper_scythe.glb", fit: 0.75, grip: [0.58, -0.17, 0], fore: [-0.3, -0.05, 0], muzzle: [-0.95, -0.03, 0] },
  // handle x +0.6..+0.95, guard and revolver cylinder x +0.3..+0.55, blade from x +0.25 to the tip at -0.95; held
  // one-handed just behind the guard (as the code Sakura), shots leave in front of the cylinder; 1.4 long as before
  sakura: { url: "assets/models/meshy/sakura_katana.glb", fit: 0.74, grip: [0.7, 0, 0], fore: null, muzzle: [0.27, 0, 0] },
};

let operative: THREE.Object3D | null = null;

/** The loaded operative (a glTF scene with the skinned body), or null: keep the code-built figure. */
export function operativeArt(): THREE.Object3D | null {
  return operative;
}

/** A Meshy-space point -> gun space (turned -90 degrees about Y, then fitted). */
function toGun([x, y, z]: P3, fit: number): THREE.Vector3 {
  return new THREE.Vector3(-z, y, x).multiplyScalar(fit);
}

/** A builder for gunModels: a fresh clone (sharing the loaded geometry and materials) in gun space. */
function weaponBuilder(scene: THREE.Object3D, art: WeaponArt): () => WeaponModel {
  return () => {
    const group = new THREE.Group();
    const model = scene.clone();
    model.rotation.y = -Math.PI / 2;
    model.scale.setScalar(art.fit);
    group.add(model);
    return {
      group,
      grip: toGun(art.grip, art.fit),
      fore: art.fore ? toGun(art.fore, art.fit) : null,
      muzzle: toGun(art.muzzle, art.fit),
      scale: HELD_SCALE,
    };
  };
}

/** The weapons that have art (the first-person view rebuilds these after loading). */
export const ART_WEAPONS = Object.keys(WEAPONS) as WeaponId[];

/** Loads the art and registers it with gunModels (a failure logs a warning: the code models stay). */
export async function loadMeshyArt(progress: (v: number) => void = () => {}, skip = false): Promise<void> {
  if (skip) {
    Log.info("art", "?noart: code-built models");
    progress(1);
    return;
  }
  const loader = new GLTFLoader();
  const jobs = [...Object.entries(WEAPONS).map(([id, art]) => () => loadWeapon(loader, id as WeaponId, art!)), () => loadOperative(loader)];
  let done = 0;
  await Promise.all(jobs.map((job) => job().then(() => progress(++done / jobs.length))));
}

async function loadOperative(loader: GLTFLoader): Promise<void> {
  try {
    operative = (await loader.loadAsync(OPERATIVE_URL)).scene;
    Log.info("art", "Meshy operative in (bones driven by the code figure's poses)");
  } catch (err) {
    Log.warn("art", `Meshy operative did not load, the code-built figure stays (${String(err)})`);
  }
}

async function loadWeapon(loader: GLTFLoader, id: WeaponId, art: WeaponArt): Promise<void> {
  try {
    const scene = (await loader.loadAsync(art.url)).scene;
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    registerWeaponArt(id, weaponBuilder(scene, art));
    Log.info("art", `Meshy model in for ${id}`);
  } catch (err) {
    Log.warn("art", `Meshy ${id} did not load, the code-built one stays (${String(err)})`);
  }
}
