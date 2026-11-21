# Asset Log

> Every third-party or AI-assisted asset gets a row BEFORE it is used. Use `/asset-intake`.
> Source of truth for credits screens, store disclosures, and license audits.
> Where to find things: `docs/RESOURCES.md` (index into `docs/resources/`).

| ID | Type | File(s) in repo | Source / URL | Author | License | Attribution text (if required) | AI-assisted? | Modified? | Date added | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| A-0001 | SFX (29 WAVs, 14 events) | public/assets/audio/sfx/*.wav; recipes assets_src/audio/*.sfx.json; data/audio_events.json | Made in code: tools/audio/yeet_sounds.py with the kit's Wavesmith synth (tools/audio/wavesmith/sfx_synth.py) | Claude for Elaina the Great | Own work (procedural synthesis, no samples) | none | no | no | 2026-11-21 | PLACEHOLDER toy sounds (pea, boom, krak, brrt, wup, whistle, bonk, thwack, boing, thud, sputter, kaboom, click, popin); re-render with `python tools/audio/yeet_sounds.py` |

## Rules
- "AI-assisted?" uses one of: `no`, `dev-only` (AI helped, nothing AI-made ships), `pre-generated` (AI output ships in the build), `live` (generated at runtime). Steam's disclosure is built from the `pre-generated` and `live` rows (see SOP-04).
- Unknown license means it does not go in. Prototype-only (NC) assets are tagged `PLACEHOLDER` in Notes and replaced before release.
- Store the license text or a screenshot of the license page next to the asset or in `docs/licenses/`.
- AI-assisted: record tool, date, prompt summary, how much was edited by hand. Needed for store disclosure forms.
- Keep `CREDITS.md` generated from this table (see `/release-check`).
