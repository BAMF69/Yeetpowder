// ---------------------------------------------------------------------------
// meshyArt.ts
// Purpose : Elaina's Meshy models in the game (2026-11-24): the sniper scythe as Reaper's Kick and the katana
//           gunblade as the Six-Shot Sakura, the Rocket Axe (first person and third person), and the rigged tactical character as the operative (your body in third person, duel
//           opponents and bots; operativeSkin.ts drives its bones from the code figure's poses). Loaded during the world's loading screen; until then, or if a file fails, the code-built
//           models stay (gunModels.ts), so nothing depends on the art being there.
// Usage   : await loadMeshyArt(progress)   in a world's load(); then vm.rebuildGun("reaper") for guns already built
//           and op.useSkin(operativeArt()!) for operatives already made
//           ?noart skips it (the code models, e.g. to compare or on a slow phone).
// Notes   : The .glb files are the Meshy exports with their textures shrunk to 1024 px JPEG by tools/slim_glb.mjs
//           (44 MB -> 0.8 MB for the scythe); everything else in them is as Meshy made it. ASSET_LOG A-0012 to A-0015.
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
import { registerHealthPackPreview } from "./healthPack";
import { openShieldViewport, SHIELD_WINDOW } from "./shieldViewport";

const OPERATIVE_URL = "assets/models/meshy/operative.glb";
/** Metres per model unit when held (gunModels' SCALE for every gun but the Gatling). */
const HELD_SCALE = 0.62;

type P3 = readonly [number, number, number];
interface WeaponArt {
  url: string;
  scale?: number;
  /**
   * Which way it lies in Meshy's space: "x-" (default) has its business end toward -x and +y up (the scythe, the
   * katana); "x-blade-down" also points -x forward but turns its blade (hanging toward -y) onto the top (the Rocket
   * Axe: its knobbed -x end is the handle's butt the rockets leave from).
   */
  orient?: "x-" | "x-blade-down" | "upright";
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
  // haft along x (centre y +0.02), the blade hanging under its middle (x -0.5..+0.3), the block with its flared
  // nozzle at the +x end, the knobbed handle butt at -x, where the rockets leave (Elaina, playtest 2026-11-24): in
  // gun space the butt points forward with the blade on top (the over-the-shoulder hold, aimed); from the hip the
  // view tilts it butt-down at your feet, the blade forward and the block up (viewmodel.ts HOLD.axe, operativePose.ts)
  axe: { url: "assets/models/meshy/rocket_axe.glb", fit: 0.7, orient: "x-blade-down", grip: [0.35, 0.02, 0], fore: [-0.25, 0.02, 0], muzzle: [-0.98, 0.06, 0] },
};

let operative: THREE.Object3D | null = null;
let rocketPreview: THREE.Object3D | null = null;
let grenadePreview: (() => WeaponModel) | null = null;
export function rocketPreviewArt(): THREE.Object3D | null {
  return rocketPreview?.clone() ?? null;
}

export function grenadePreviewArt(): THREE.Object3D | null {
  return grenadePreview?.().group ?? null;
}

/** The loaded operative (a glTF scene with the skinned body), or null: keep the code-built figure. */
export function operativeArt(): THREE.Object3D | null {
  return operative;
}

/** The turn from Meshy space to gun space (barrel toward -Z, +Y up) for each way a model lies. */
const ORIENT = {
  upright: new THREE.Matrix4(),
  // -x -> -Z (forward), +y stays up: -90 degrees about Y
  "x-": new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)),
  // -x -> -Z (forward), -y (the blade) -> +Y (on top), and z to keep it a rotation
  "x-blade-down": new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0)),
};

/** A Meshy-space point -> gun space (turned as the model lies, then fitted). */
function toGun([x, y, z]: P3, fit: number, orient: keyof typeof ORIENT = "x-"): THREE.Vector3 {
  return new THREE.Vector3(x, y, z).applyMatrix4(ORIENT[orient]).multiplyScalar(fit);
}

/** A builder for gunModels: a fresh clone (sharing the loaded geometry and materials) in gun space. */
function weaponBuilder(scene: THREE.Object3D, art: WeaponArt): () => WeaponModel {
  return () => {
    const group = new THREE.Group();
    const model = scene.clone();
    const orient = art.orient ?? "x-";
    model.quaternion.setFromRotationMatrix(ORIENT[orient]);
    model.scale.setScalar(art.fit);
    group.add(model);
    return {
      group,
      grip: toGun(art.grip, art.fit, orient),
      fore: art.fore ? toGun(art.fore, art.fit, orient) : null,
      muzzle: toGun(art.muzzle, art.fit, orient),
      scale: art.scale ?? HELD_SCALE,
    };
  };
}

/** The weapons that have art (the first-person view rebuilds these after loading). */
export const ART_WEAPONS = new Set(Object.keys(WEAPONS) as WeaponId[]);

// Source files are served by Vite in development until provenance and fit are verified.
const PREVIEW_ROOT = "assets_src/runtime-preview/weapons/";
const PREVIEW_WEAPONS = {
  pistol: { url: PREVIEW_ROOT + "glock-17.glb", fit: 0.18, grip: [0.76, -0.23, 0], fore: null, muzzle: [-1, 0.45, 0] },
  sniper: { url: PREVIEW_ROOT + "sniper.glb", fit: 0.69, grip: [0.43, -0.14, 0], fore: [-0.34, -0.02, 0], muzzle: [-1, 0.09, 0] },
  copter: { url: PREVIEW_ROOT + "minigun.glb", fit: 0.71, scale: 0.88, grip: [0.9, 0.18, 0], fore: [0.15, 0.29, 0], muzzle: [-1, -0.07, 0.01] },
  rocket: { url: PREVIEW_ROOT + "at-2x-launcher.glb", fit: 0.55, grip: [0.19, -0.29, 0], fore: [-0.32, -0.29, 0], muzzle: [-0.99, 0.09, 0] },
  grenade: { url: "assets_src/runtime-preview/equipment/grenade.glb", orient: "upright", fit: 0.09, grip: [0, -0.12, 0], fore: null, muzzle: [0, 0.06, -1.2] },
} satisfies Partial<Record<WeaponId, WeaponArt>>;

export function isArtPreview(value: string | null): value is "approved" | "shotgun-existing" | "weathered-shotgun" {
  return import.meta.env.DEV && (value === "approved" || value === "shotgun-existing" || value === "weathered-shotgun");
}

function previewShotgun(candidate: string): WeaponArt {
  if (candidate === "shotgun-existing") {
    // Palm above the stock neck, with the fingers curled down around it.
    return { url: PREVIEW_ROOT + candidate + ".glb", fit: 0.58, grip: [0.46, 0.17, 0], fore: [-0.26, 0.075, 0], muzzle: [-1, 0.16, 0] };
  }
  return { url: PREVIEW_ROOT + candidate + ".glb", fit: 0.58, grip: [0.38, -0.035, 0], fore: [-0.26, 0.075, 0], muzzle: [-1, 0.16, 0] };
}

/** Loads the art and registers it with gunModels (a failure logs a warning: the code models stay). */
export async function loadMeshyArt(progress: (v: number) => void = () => {}, skip = false, preview: string | null = null): Promise<void> {
  if (skip) {
    Log.info("art", "?noart: code-built models");
    progress(1);
    return;
  }
  const loader = new GLTFLoader();
  const weapons = { ...WEAPONS };
  const jobs = [() => loadOperative(loader)];
  if (isArtPreview(preview)) {
    Object.assign(weapons, PREVIEW_WEAPONS);
    weapons.shotgun = previewShotgun(preview === "approved" ? "shotgun-existing" : preview);
    jobs.push(async () => {
      try { registerHealthPackPreview((await loader.loadAsync("assets_src/runtime-preview/equipment/health-pack.glb")).scene); }
      catch (err) { Log.warn("art", `Health pack preview unavailable; procedural kit stays (${String(err)})`); }
    });
    jobs.push(async () => {
      try {
        const source = (await loader.loadAsync(PREVIEW_ROOT + "ballistic-shield.glb")).scene;
        let bounds = new THREE.Box3().setFromObject(source), size = bounds.getSize(new THREE.Vector3());
        if (size.x < size.z) { source.rotation.y = Math.PI / 2; source.updateMatrixWorld(true); }
        bounds = new THREE.Box3().setFromObject(source); size = bounds.getSize(new THREE.Vector3());
        source.position.sub(bounds.getCenter(new THREE.Vector3()));
        const normalized = new THREE.Group(); normalized.add(source); normalized.scale.setScalar(1.7 / size.y);
        openShieldViewport(normalized);
        registerWeaponArt("shield", () => {
          const group = new THREE.Group(); group.add(normalized.clone());
          return { group, grip: new THREE.Vector3(-0.18, -0.1, 0.18),
            fore: new THREE.Vector3(0.18, -0.1, 0.18), muzzle: new THREE.Vector3(0, 0, -0.2), scale: HELD_SCALE, viewportY: (SHIELD_WINDOW.bottom + SHIELD_WINDOW.top) / 2 };
        });
        ART_WEAPONS.add("shield");
      } catch (err) { Log.warn("art", `Shield preview unavailable; procedural viewport stays (${String(err)})`); }
    });
    jobs.push(async () => {
      try {
        rocketPreview = (await loader.loadAsync(PREVIEW_ROOT + "at-2x-rocket.glb")).scene;
        rocketPreview.rotation.y = -Math.PI / 2;
        rocketPreview.scale.setScalar(0.5);
      } catch (err) {
        Log.warn("art", `AT-2X rocket did not load, the code-built one stays (${String(err)})`);
      }
    });
  }
  for (const [id, art] of Object.entries(weapons)) jobs.push(() => loadWeapon(loader, id as WeaponId, art));
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
    const build = weaponBuilder(scene, art);
    registerWeaponArt(id, build);
    if (import.meta.env.DEV && id === "grenade") grenadePreview = build;
    ART_WEAPONS.add(id);
    Log.info("art", `Meshy model in for ${id}`);
  } catch (err) {
    Log.warn("art", `Meshy ${id} did not load, the code-built one stays (${String(err)})`);
  }
}
