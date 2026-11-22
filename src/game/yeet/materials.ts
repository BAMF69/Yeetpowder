// ---------------------------------------------------------------------------
// materials.ts
// Purpose : One place that makes the faceted, painted materials the characters and guns share, so the first-person
//           view (viewmodel.ts) and the third-person operative (operative.ts) paint a gun or a glove the same way.
// Usage   : const bank = new MaterialBank(); bank.paint("navy"); bank.plain("#c68a5c");
//           buildWeapon(id, bank.gunKit(id)); bank.geo(new THREE.BoxGeometry(...)); bank.dispose()
// Notes   : Materials are shared per key inside one bank; the bank also tracks geometries so dispose() frees both.
//           Textures come from paint.ts (cached there and freed with disposePaint() when the world closes).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import * as THREE from "three";
import type { WeaponId } from "../../core/yeet/tuning";
import type { MatKey, ModelKit } from "./gunModels";
import { paintedTexture, type PaintKind } from "./paint";

/** Flat colours for the parts with no painted texture; each gun's accent colour. */
const PLAIN: Record<string, string> = { polymer: "#2b2d32", brass: "#b08a3e", lens: "#24476b" };
const ACCENT: Partial<Record<WeaponId, string>> = { sniper: "#5b3f8f", sakura: "#f48fb1" };
const DEFAULT_ACCENT = "#c0392b";
/** Skin, as painted on the operative's face and showing through the fingerless gloves. */
export const SKIN = "#c68a5c";

export class MaterialBank {
  private readonly mats = new Map<string, THREE.Material>();
  private readonly geos: THREE.BufferGeometry[] = [];

  /** A faceted material with a painted texture; `tint` multiplies it (the "fabric" suit colours). */
  paint(kind: PaintKind, opts: { metal?: number; tint?: string } = {}): THREE.MeshStandardMaterial {
    const key = `paint:${kind}:${opts.metal ?? 0}:${opts.tint ?? ""}`;
    return this.cached(key, () => new THREE.MeshStandardMaterial({
      map: paintedTexture(kind), color: opts.tint ?? "#ffffff", roughness: 0.75, metalness: opts.metal ?? 0, flatShading: true,
    })) as THREE.MeshStandardMaterial;
  }

  /** A faceted flat-colour material; glow > 0 makes it emit its own colour. */
  plain(color: string, glow = 0): THREE.MeshStandardMaterial {
    return this.cached(`plain:${color}:${glow}`, () => new THREE.MeshStandardMaterial({
      color, roughness: 0.6, flatShading: true, emissive: color, emissiveIntensity: glow,
    })) as THREE.MeshStandardMaterial;
  }

  /** Tracks a geometry for dispose(). */
  geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  /** The kit a gun model is built with (gunModels.ts), with that gun's accent colour. */
  gunKit(id: WeaponId): ModelKit {
    const accent = ACCENT[id] ?? DEFAULT_ACCENT;
    return {
      geo: (g) => this.geo(g),
      mat: (key: MatKey) => {
        switch (key) {
          case "gunmetal": return this.paint("gunmetal", { metal: 0.1 });
          case "blade": return this.paint("blade", { metal: 0.35 });
          case "wood": case "wrap": case "bone": case "leather": case "hazard": return this.paint(key);
          case "pea": return this.plain("#7ed957", 0.35);
          case "lens": return this.plain(PLAIN.lens, 0.4);
          case "accent": return this.plain(accent);
          default: return this.plain(PLAIN[key]);
        }
      },
    };
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats.values()) m.dispose();
    this.geos.length = 0;
    this.mats.clear();
  }

  private cached(key: string, make: () => THREE.Material): THREE.Material {
    let m = this.mats.get(key);
    if (!m) {
      m = make();
      this.mats.set(key, m);
    }
    return m;
  }
}
