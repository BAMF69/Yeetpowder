# Asset Log

> Every third-party or AI-assisted asset gets a row BEFORE it is used. Use `/asset-intake`.
> Source of truth for credits screens, store disclosures, and license audits.
> Where to find things: `docs/RESOURCES.md` (index into `docs/resources/`).

| ID | Type | File(s) in repo | Source / URL | Author | License | Attribution text (if required) | AI-assisted? | Modified? | Date added | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| A-0001 | SFX (43 WAVs, 24 events) | public/assets/audio/sfx/*.wav; recipes assets_src/audio/*.sfx.json; data/audio_events.json | Made in code: tools/audio/yeet_sounds.py with the kit's Wavesmith synth (tools/audio/wavesmith/sfx_synth.py) | Claude for Elaina the Great | Own work (procedural synthesis, no samples) | none | no | no | 2026-11-21 | PLACEHOLDER toy sounds (pea, boom, krak, brrt, wup, whistle, bonk, thwack, boing, thud, sputter, kaboom, click, popin; Fight Back: lob, splat, ouch, ko, pickup, tumble, alert; reload, loaded, dry); re-render with `python tools/audio/yeet_sounds.py` |
| A-0002 | Logo / title art | public/assets/ui/title_logo.jpg (from docs/concept/keyframes/09 yeetpowder logo.png, JPEG q86) | Made by Elaina the Great with ChatGPT image generation (2026-11-19) | Elaina the Great (AI-assisted) | Own work; check OpenAI's terms for commercial use before release | none | pre-generated | yes (re-encoded to JPEG) | 2026-11-21 | Title screen. AI-generated art that ships: list it in the store AI disclosure (SOP-04) |

| A-0003 | Character reference (experiment) | assets_src/experiments/operative_01/front-v1.png | Built-in OpenAI image generation, based on docs/concept/keyframes/01-shotgun-start.png | Elaina the Great (AI-assisted with Codex) | AI-generated reference; no third-party model license granted or assumed | none specified | dev-only | no | 2026-11-21 | Unarmed front A-pose; navy operative, angular low-poly style, neutral gray background. Reference only; not shipped. Tripo output and redistribution terms must be logged separately. |

| A-0004 | Animated character (optional preview) | public/assets/models/quaternius/modular_men/Swat.gltf; License.txt | https://quaternius.com/packs/ultimatemodularcharacters.html | Quaternius | CC0 1.0 Universal; included archive License.txt | none required; credit Quaternius | no | no (runtime scale and roughness only) | 2026-11-21 | 8,794 triangles, 24 clips; above character budget. Enable with ?play&operative; preview only, not approved release art. |
| A-0005 | 3D model trials (experiment) | Meshy_AI_Tactical_Sentinel_1122004834_generate.glb, ..._generate-quads.glb, ..._generate-quads (1).glb (repo root) | Meshy AI text/image-to-3D (verify: who generated them, plan and terms) | Elaina the Great (AI-assisted, verify) | Meshy terms (verify before any use) | none specified | dev-only | no | 2026-11-21 | Not loaded by the game, not shipped. Check Meshy's licence for your plan before using in a build. |

## Rules
- "AI-assisted?" uses one of: `no`, `dev-only` (AI helped, nothing AI-made ships), `pre-generated` (AI output ships in the build), `live` (generated at runtime). Steam's disclosure is built from the `pre-generated` and `live` rows (see SOP-04).
- Unknown license means it does not go in. Prototype-only (NC) assets are tagged `PLACEHOLDER` in Notes and replaced before release.
- Store the license text or a screenshot of the license page next to the asset or in `docs/licenses/`.
- AI-assisted: record tool, date, prompt summary, how much was edited by hand. Needed for store disclosure forms.
- Keep `CREDITS.md` generated from this table (see `/release-check`).
