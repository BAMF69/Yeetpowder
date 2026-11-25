// CC BY 4.0 Vinish flipbooks. Shared originals; independent frame uniforms and runtime pink recolouring.
import * as THREE from "three";
import muzzle from "../../../public/assets/vfx/vinish/muzzle_flash_front_loop.json";
import impact from "../../../public/assets/vfx/vinish/hit_star_flash.json";
import explosion from "../../../public/assets/vfx/vinish/explosion_cartoon.json";
import slash from "../../../public/assets/vfx/vinish/sword_slash_arc.json";

export const VFX_PRESETS = { muzzle, impact, explosion, slash };
export type VfxKind = keyof typeof VFX_PRESETS;
// The impact's last 29 cells and slash's last 16 cells are empty; omit that dead time in combat.
export const VFX_PLAYBACK_FRAMES: Record<VfxKind, number> = { muzzle: 4, impact: 35, explosion: 64, slash: 48 };
const textures = new Map<VfxKind, THREE.Texture>();
let loading: Promise<void> | undefined;

function texture(kind: VfxKind): THREE.Texture {
  let tex = textures.get(kind);
  if (!tex) {
    tex = new THREE.Texture();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false; // whole-sheet mipmaps would bleed between cells
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    textures.set(kind, tex);
  }
  return tex;
}

export function loadVinishVfx(): Promise<void> {
  return loading ??= Promise.all((Object.keys(VFX_PRESETS) as VfxKind[]).map(async (kind) => {
    const target = texture(kind);
    const loaded = await new THREE.TextureLoader().loadAsync(`assets/vfx/vinish/${VFX_PRESETS[kind].sheets["1024"]}`);
    target.image = loaded.image;
    target.needsUpdate = true;
    loaded.dispose();
  })).then(() => {});
}

/** Called after all world effect materials have been disposed. */
export function disposeVinishVfx(): void {
  for (const tex of textures.values()) tex.dispose();
  textures.clear();
  loading = undefined;
}

/** Row-major atlas, top row first; texture UVs start at the bottom. */
export function atlasCell(frame: number): [number, number] {
  const f = Math.max(0, Math.min(63, Math.floor(frame)));
  return [f % 8, 7 - Math.floor(f / 8)];
}

export function animationFrame(age: number, duration: number, frames = 64): number {
  return Math.min(frames - 1, Math.max(0, Math.floor(age / duration * frames)));
}

export class VinishFlipbook {
  readonly material: THREE.SpriteMaterial;
  private readonly cell = { value: new THREE.Vector2() };

  constructor(kind: VfxKind, overlay = false) {
    this.material = new THREE.SpriteMaterial({
      map: texture(kind), transparent: true, depthWrite: false, depthTest: !overlay,
      blending: VFX_PRESETS[kind].blending === "additive" ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: false,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.vinishCell = this.cell;
      shader.uniforms.vinishPink = { value: new THREE.Color("#ff3fa4") };
      shader.uniforms.vinishCore = { value: new THREE.Color("#ffd6ec") };
      shader.fragmentShader = `uniform vec2 vinishCell; uniform vec3 vinishPink; uniform vec3 vinishCore;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
        vec2 sheetUv = (vinishCell + clamp(vMapUv, vec2(0.00390625), vec2(0.99609375))) / 8.0;
        vec4 sampleFx = texture2D(map, sheetUv);
        float light = max(sampleFx.r, max(sampleFx.g, sampleFx.b));
        float whiteCore = smoothstep(0.65, 1.0, min(sampleFx.r, min(sampleFx.g, sampleFx.b)));
        diffuseColor *= vec4(mix(vinishPink * light, vinishCore, whiteCore), sampleFx.a);
      `);
    };
    this.material.customProgramCacheKey = () => "vinish-pink-atlas-v1";
    this.frame(0);
  }

  frame(frame: number): void { this.cell.value.set(...atlasCell(frame)); }
  dispose(): void { this.material.dispose(); }
}
