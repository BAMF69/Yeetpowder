# ADR 0004: Browser-hosted duels over WebRTC (PeerJS)

- Status: accepted
- Date: 2026-11-23

## Context
Online duels ran on a Node duel server on Elaina's PC (ADR 0002). Fine on one Wi-Fi, but over the internet every host
would need Node, a terminal and an open router port, and a rented server costs money and upkeep. The duel's rules
(`src/net/room.ts`) have no sockets in them, so they can run anywhere, a browser tab included. Elaina chose one player
hosting (2026-11-23), and the PeerJS free broker for introductions. Couch mode (phones as controllers for a TV, design
doc "Future systems") needs the same browser-to-browser connection next.

## Options considered
1. **One player's browser hosts; WebRTC data channels via PeerJS 1.5.5 (MIT) and its free public broker**: no server
   to run or pay for; the room code is the broker id. Costs: a third-party broker we do not control (it only passes
   connection setup, not game traffic); the host plays with no network delay (a small edge); the host leaving ends the
   match; some networks block direct connections (needs a relay/TURN server, not set up yet).
2. **Rented server running the existing duel server** (SOP-06): fair to both players, survives a drop; costs about
   $5 a month and upkeep, plus a certificate for wss.
3. **Our own signalling server on a free host** (e.g. a Cloudflare Worker): we control the introductions; needs an
   account first. Can replace the PeerJS broker later without touching the game (PeerJS takes a host option).
4. **Keep the home server only**: online play stays limited to one Wi-Fi.

## Decision
Option 1, as the default for duels (`src/game/net/peerLink.ts`); the home duel server stays behind `?net=server`.
It puts "online by link" (GDD) in reach with no cost and no server to run.

## Consequences
- Good: a duel needs only the game page and a room code; the same Room, protocol, prediction and snapshot code as the
  server (one rule set); couch mode can reuse the connection.
- Bad / costs: one runtime dependency shipped to players: `peerjs` 1.5.5 (MIT) with `@msgpack/msgpack` 2.8.0 (ISC),
  `eventemitter3` 4.0.7 (MIT), `peerjs-js-binarypack` 2.1.0 (MIT), `webrtc-adapter` 9.0.6 (BSD-3-Clause), `sdp` 3.2.3
  (MIT). The public broker at 0.peerjs.com sees each player's IP address while it introduces them (any WebRTC
  matchmaker does); players on strict networks cannot connect until a relay server is added. A hidden host tab:
  the room's clock runs in a Web Worker so it keeps time (tested: 30 snapshots/s with the host tab hidden, against 7
  on a page timer); a phone that sleeps the browser still pauses the host.
- The game page itself still has to be reachable by the guest: the PC's dev server on the home network now, a hosted
  build (itch.io or GitHub Pages, free) for play over the internet.
- What we would need to see to revisit this: players unable to connect (add a TURN relay), the broker being down or
  slow (own signalling, option 3), or cheating/fairness complaints (option 2).

## Notes
- Versions and licences: `npm view peerjs` (1.5.5, MIT, published 2025-06-07) and each installed dependency's
  package.json. **verified**
- 2026-11-23: the waiting panel shows the room link as a QR code (Elaina asked), made in the page by
  `qrcode-generator` 2.0.4 (MIT, Kazuhiko Arase, no dependencies, `npm view`: published 2025-08-07). **verified**
  An online QR service was rejected: it would see every room link. `src/game/net/roomQr.ts`, tests/roomQr.test.ts.
- Tested 2026-11-23 in the desktop app's browser, two tabs on this PC through the public broker: host made room PTSS,
  guest joined by link as player 2 (ping 2 ms, 31 snapshots/s, no prediction corrections), the guest's inputs were
  acknowledged by the host's room, rejoining after a reload worked, and the guest was told when the host left.
  **verified** on one PC only; across two devices and two networks **unverified** until Elaina tries it.
