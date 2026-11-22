# ADR 0002: Plain WebSockets (`ws`) for the duel netcode, not Colyseus

- Status: accepted
- Date: 2026-11-21

## Context
The vertical slice needs 2 players online: a server-authoritative game on this PC (slice decision 2), client
prediction for your own movement, the other player interpolated ~100 ms behind (GDD netcode plan). The simulation is
deterministic and runs the same in Node and the browser (ADR 0001), so the natural model is: clients send inputs,
the server steps the same `YeetSim`, clients predict with the same code and reconcile against server snapshots.

## Options considered
1. **`ws` 8.23.0** (MIT): pros: tiny, the de-facto Node WebSocket server, nothing to fight: our own small protocol
   (input frames up, snapshots down) fits input-based prediction exactly. Browsers use their built-in WebSocket, so
   nothing new ships to players. Cons: rooms, codes and reconnection are ours to write (small for 2 players).
2. **Colyseus** (the design doc's suggestion): pros: rooms, matchmaking, reconnection, schema state sync built in.
   Cons: much heavier; its state-sync model sends state patches, which we would bend around input prediction; more
   to learn and debug for a 2-player slice.
3. **Do nothing**: no slice.

## Decision
`ws` (Elaina, 2026-11-21): the smallest piece that fits our deterministic, input-based design.

## Consequences
- Good: one simulation everywhere; a protocol we can test in Vitest; nothing added to the client bundle.
- Bad / costs: we write room codes, joining and timeouts ourselves.
- What we would need to see to revisit this: Quick Play matchmaking, 8-player rooms across regions, or reconnection
  needs that grow past a few hundred lines: then Colyseus (or similar) earns its weight.

## Notes
- Versions pinned exactly in package.json: `ws` 8.23.0 (server only), `@types/ws` 8.18.2 (dev). Licence MIT
  (**verified** with `npm view ws license`).
- The server bundles with Vite's SSR build (no extra TypeScript runner) and runs on Node 26.
