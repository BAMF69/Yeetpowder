# Roadmap

> Now is capped at 3 items (SOP-08); one at a time is best. Finishing beats starting. Anything new goes to the Parking lot.
> Claude reads the **Now** section at session start.

## Now (max 3 items)
- [ ] **Duel netcode** (2 players on the home network, server on this PC with `ws` (ADR 0002), room code + link, client prediction and interpolation; ADR 0001 toy physics) | Done when: two browser windows (then laptop + phone) join one room by link and play each other with every slice weapon, smooth on both | Timebox: 4 sessions

## Next
- [ ] Duel modes: first to 5 knockouts, timed round, Ring Out; the duel room with a Gatling pickup
- [ ] Minimal touch controls for the phone
- [ ] Sound captions on screen (the events have captions; wire the kit's dialogue build: SOP-20)
- [ ] Music: surf-rock / spy-jazz loop made in code (Wavesmith chiptune)
- [ ] Art approval sample (GDD): one operative model and one separate shotgun in the painted room, compared with the shotgun keyframe; then figures and guns
- [ ] `/asset-intake` + Wavesmith: free model packs with licences checked for the slice's figures and room; balance the code-made sounds

## Later
- [ ] 

## Parking lot (ideas, no commitment)
- Gatling Copter at x2 thrust climbs ~100 m in 5 s when aimed straight down: maybe a height falloff or more drag if it stops feeling like hovering
- Limited reserve ammo and ammo pickups (magazines are in; reserve is infinite for now)
- Fight Back win condition (knock them all out within a time? waves?) and dummies that move
- 

## Milestones
Scope, not dates. `/next-tier` moves the game from one tier to the next; after the slice, `docs/PRODUCTION.md` holds the
detail.
| Milestone | Definition of done | Status |
|---|---|---|
| M0 Toy (v0.1.0) | Core mechanic playable; someone wants to keep playing | done 2026-11-21 (moved on without the 2-minute playtest) |
| M1 Vertical slice (v0.2.0) | One polished loop with art, audio, UI; the greenlight (`/next-tier`) | |
| M2 Alpha | Every MVP system in and playable | |
| M3 Beta (content complete) | All MVP content in, no known crash | |
| M4 Release candidate (v1.0.0-rc.N, then v1.0.0) | `/release-check` green | |

## Done (recent, newest first)
- 2026-11-22: First art pass (/shader item): painted textures in code, ceilings with light panels, wall band, steel doors, crates, hazard trim, interior lighting; kit shader goldens unchanged (11/11)
- 2026-11-22: Art pass 2: first-person navy sleeves with folded cuffs and black tactical gloves; the six weapons rebuilt as faceted painted low-poly models (gunModels.ts, 300-1,200 triangles each, tested); third-person body and opponents still placeholders
- 2026-11-22: Art pass 2 rework after review: weapons from bevelled profiles to the keyframes, bigger Gatling (left hand on top) and crescent scythe, fingerless gloves; camera pop for big launches (not the Boomstick) and hero landings; budgets raised to 6,000 per character and 2,500 per weapon (Elaina)
- 2026-11-22: Art pass 3: third-person operative built in code (segmented, painted face, vest, gloves, boots; 1,108 triangles) holding every gun with both hands, poses for ready, aim, run, air, Boomstick fling, tumble, hero landing and KO; used for your body and duel opponents; ?showcase&pose=... to review it
- 2026-11-22: Launch camera kick-out (YEET launches swing the camera out to your right for ~0.7 s; C toggles, reduce motion off); Sakura upward dash smaller than forward (tower Boomstick-only again); hero landing after Reaper backflips
- 2026-11-21: Duel netcode first build: multiplayer sim (PvP), Duel room, ws server on this PC (rooms by code), client prediction (exact in tests), lobby + share link, other player interpolated; socket and two-browser smokes pass. Not yet played by two humans
- 2026-11-21: Gunblades single-player done (Elaina: Reap and full Sakura combo landed on purpose; "both are fun", "yeetreap is awesome")
- 2026-11-21: Sakura stance blade fixed (it spun every frame); ULTRASLASH needs a dash-fire and speed, rapid-fires all rounds left
- 2026-11-21: Gunblade hold moves: Reaper's Kick hook + YEETREAP (the hook yanks back the enemy its opening slash shoved), Sakura dash stance + ULTRASLASH; 6 tests
- 2026-11-21: Gunblades first build (single-player): Reaper's Kick (flip by shot direction, 180 degree slash, Reap x2 within 0.3 s) and Six-Shot Sakura (6-hit combo, revolver cancel + lunge, sixth-round finisher, spin-reload); scythe and katana models, swings, camera flips, 3 sounds; 10 tests. Awaiting Elaina's play
- 2026-11-21: Vertical slice brief agreed (docs/VERTICAL_SLICE.md, 7 decisions); ADR 0001 keep the toy's physics
- 2026-11-21: Toy done, now Vertical slice. Moved on without: a recorded "wants to keep playing for 2 minutes" playtest (only the developer has played), reason: "Move on anyway"
- 2026-11-21: Playtest 5 changes: airborne Pea Pistol and Spin Doctor kick and twist x2, COPTER YEAT, magazines and reloading (R; respawn on Backspace)
- 2026-11-21: Playtest 4 changes: auto re-zoom after the recoil, Shift sprint (doubles tumble chance), tumble tip, logo title screen, scoped Spin Doctor spins, lowest audio latency + lost-click fix on fast monitors
- 2026-11-21: Playtest 3 changes: arm glitch fixed; twist-based hip vs aimed fire (same push), zoom knock-out on every gun but the copter; Pea Pistol 11 m/s with a hover-skip that cannot climb; run-and-gun tumbles with a third-person camera; levels (Sandbox + Fight Back: dummies shoot back, pickups, Boomstick-only Gatling tower); 7 more sounds
- 2026-11-21: Placeholder sounds made in code (14 events, 29 WAVs): every gun, copter rotor, slide-whistle launches, bonks, hits, knockouts, overheat, crash
- 2026-11-21: Playtest 2 changes: right-click aim on every gun (zoom, Spin Doctor scope) with braced aimed fire vs full-yeet hip fire; Pea Pistol hop backward and a visible two-part blowback; Gatling Copter turns you right and wobbles the aim
- 2026-11-21: Playtest 1 changes: stronger recoil (Boomstick and copter x2), first-person arms on every gun, Pea Pistol blowback over the head, Boomstick flings arms and legs into view
- 2026-11-21: Toy built: recoil movement, 3 guns + Gatling Copter prototype, target dummies, wall bonk, HUD; 16 sim tests, autoplay tour
- 2026-11-21: Project scaffolded

## Budget and cost log (SOP-12)
| Date | Job | Model and effort | Time | Cost or % of weekly limit | Result |
|---|---|---|---|---|---|
| | | | | | |
