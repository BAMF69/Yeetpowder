# ADR 0001: Keep the toy's own physics for online play (no Rapier yet)

- Status: accepted
- Date: 2026-11-21

## Context
The vertical slice adds two players online with a server-authoritative model and client prediction (GDD netcode
plan). The server and every client must simulate recoil, collision and knockback identically, or prediction keeps
correcting. The design doc suggested Rapier (WebAssembly physics) for exactly that reason.

## Options considered
1. **Keep the toy's physics** (`src/core/yeet/`: fixed 1/120 s step, axis-aligned boxes, mass-1 velocity kicks, no
   three import). Pros: already runs in Node and the browser from the same TypeScript; deterministic (a seeded
   generator for the only chance roll); covered by 50+ rule tests that replay browser runs exactly; no new
   dependency or download. Cons: boxes only (no slopes, rolling or real ragdolls); collision is hand-written.
2. **Rapier**: pros: real rigid bodies, ragdolls, any shape, deterministic builds available. Cons: a new dependency
   (WASM download, against the GDD's 15 MB budget), a rewrite of collision and movement, every rule test redone.
3. **Do nothing**: same as option 1.

## Decision
Keep the toy's physics (Elaina, slice question 5). It already gives identical results on server and client, which
is the property Rapier was suggested for, at no cost.

## Consequences
- Good: the server can run `YeetSim` as is; prediction replays the same code; the tests keep guarding it.
- Bad / costs: arenas stay box-shaped; the full floppy ragdoll on death stays client-side and cosmetic (as the GDD
  already plans).
- What we would need to see to revisit this: a map that needs slopes or moving rigid bodies (Cannery Chaos's
  conveyors and crates), or prediction drift traced to our collision code.

## Notes
- Identical results in Node and the browser: **verified** by `tests/yeetSim.test.ts` replaying the autoplay tour.
- Rapier's cross-platform determinism: **unverified** here (not tried).
