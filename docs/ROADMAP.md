# Roadmap

> Now is capped at 3 items (SOP-08); one at a time is best. Finishing beats starting. Anything new goes to the Parking lot.
> Claude reads the **Now** section at session start.

## Now (max 3 items)
- [ ] **Bots: easy / medium / hard** (full players driven by a brain that only presses player controls; offline Duel vs bot from the menu; guns only, gunblades next) | Done when: Elaina plays each difficulty and easy feels beatable, hard feels like a good player, none feel like cheats | First build 2026-11-22: `src/core/yeet/bot.ts`, TUNING.bot, 7 tests
- [ ] **Duel netcode** (2 players, room code + link, client prediction and interpolation; ADR 0001 toy physics). Since 2026-11-23 the host's browser runs the room and the guest connects over WebRTC (ADR 0004, PeerJS broker); the home server (ADR 0002) stays behind `?net=server`. Still to do for play over the internet: a hosted build of the page, and a relay (TURN) for strict networks | Done when: two browser windows (then laptop + phone) join one room by link and play each other with every slice weapon, smooth on both | Timebox: 4 sessions

## Next
- [ ] Party arena art/layout pass (Elaina, 2026-11-24): original three duel layouts retained; separate island-party, industrial-party, junkyard-party have eight spawns, about 3.8x ground area, added routes and pickups. CC0 Poly Haven terrain materials installed. Next: playtest traversal, sightlines and weapon distribution with eight combatants.
- [ ] Quick Play and custom rooms (2026-11-24): implemented authoritative eight-seat matchmaking with easy/medium bot fill; room map/capacity/visibility/fill controls; kills, lives, timed and infinite-HP Ring Out rules; results/rematch. Automated and local network/browser checks cover the implementation. Next: human playtest and production backend hosting for public internet matchmaking (ADR 0005).
- [ ] Duel modes: first to 5 knockouts, timed round, Ring Out; the duel room with a Gatling pickup
- [ ] Coliseum, couch and spectators (2026-11-24): implemented circular open-air arena with three raised rings, 2–4 split-screen local players (keyboard/mouse + gamepads or all gamepads, approved by user), read-only room spectators, and fastest-speed “Yeet of the match” playback. Speed reads yeters per second. Next: physical-controller, four-player performance and human replay/camera playtests (ADR 0006). Earlier phone-as-controller pairing remains future work.
- [ ] Touch controls (first build in, 2026-11-22): floating move stick (full push sprints), drag right half to look, Fire (drag it to look too), Aim toggle, Jump, Slash (hold), Reload, Pause, Respawn, tap weapon slots; tunables `TUNING.touch`. Slash latches once the stance or hook is on (lift, tap Fire to dash or YEETREAP, tap LET GO). Playtest 2026-11-22 ("hard to control, less satisfying"): Gatling fires while you hold anywhere on the right half; touch players get a gentler Gatling wobble and turn; faster look; ⚙ panel (Look speed, Aim assist on by default, Gyro aiming off by default, Gyro speed). `npm run duel` now serves https (ADR 0003) so the gyro can work; each device warns once about the certificate. Shake moves (Elaina, 2026-11-24: silly, and touch should beat PC): shake left/right or up/down for Reaper cartwheels, flip reaps and YEETREAPs in hook range, Sakura slash-lunge and dash ULTRASLASH that home in; a lock-on after Reaper shake flips; touch Gatling bullets bend onto enemies near the crosshair (the aim stays yours); ⚙ Shake moves (on) and Shake strength (`src/core/yeet/shake.ts`, `TUNING.touch.shake`, `?shake=<dir>` to try without a phone). Done when: Elaina plays a duel on the tablet and the phone and it feels playable
- [ ] Announcer voices: Elaina records the 8 lines (`python tools/audio/announcer.py --list`) as WAV into `assets_src/voice/announcer/`, then `python tools/audio/announcer.py` (add `--pa --echo` for the stadium sound) imports, levels and wires them. The local voice tool does not fit this laptop (no NVIDIA GPU, 7.7 GB RAM)
- [ ] Level: Junkyard (first build in 2026-11-24: placeholder car stacks in rows, crusher with the Gatling, crane, fence; `?play&level=junkyard`, menu New levels) (Elaina, 2026-11-24; maps 2 and 3 are GDD Stretch, past the slice tier: her call): stacks of crushed cars to climb and launch off, narrow lanes between the stacks, a crane or crusher landmark; cars as box colliders with Meshy car models over them (or community CC0 ones). Done when: a duel and Fight Back play there and the stacks give launch routes the floor does not
- [ ] Level: Industrial yard (first build in 2026-11-24: hall with catwalk, doorway to an open-sky yard, 2 trucks, a tank and 6 drums that explode and chain, wrecks respawn after 25 s; `src/core/yeet/hazards.ts`, `TUNING.explosive`, `?boom=<i>`) (Elaina, 2026-11-24): a factory hall that opens onto an outdoor yard with no roof (sky, sunlight), trucks and tanks that take damage and explode (a knockback blast that launches anyone near: a new hazard system, `src/core/yeet/`, tested), fuel drums and barriers. Done when: a truck explodes from gunfire, its blast yeets a bot, and the wreck stays as cover
- [ ] Level: Shark Island (first build in 2026-11-24: sand island, rock hill, four platforms over the sea, water knockouts credited to who knocked you in, a placeholder shark lunge; Ring Out mode still to come; bot matches: `?bot=easy&level=island`) (Elaina, 2026-11-24): a knock-out map for Ring Out: a small island and floating platforms over water; landing in the water is a knockout with a shark lunging up to eat you (water plane, a kill volume, a shark model and a short bite animation; the kill feed says EATEN). Done when: Ring Out plays there against a bot and every water landing gets the shark
- [ ] More operators (Elaina, 2026-11-24): CC0 Meshy community characters in the operative's style (T- or A-pose, empty hands: Tactical Operator, Camouflage Soldier, Shadow Vanguard, Undercover Mercenary), rigged in Meshy, slimmed with tools/slim_glb.mjs, worn through operativeSkin.ts; a different one per duel player solves "every opponent looks the same". Done when: a duel shows two different operators
- [ ] Explosive weapons, first build in 2026-11-24 (keys 7, 8, 9; Sandbox has all; pickups in the new levels): Rocket Launcher (rockets blow up on impact; at your feet a rocket jump that hurts a little), Grenades (thrown, bounce, 1.5 s fuse or on touch), Rocket Axe (Meshy model, ASSET_LOG A-0015) as below; projectiles and blasts in `src/core/yeet/sim.ts`, `TUNING.projectile`, `TUNING.axe`, tests/projectiles.test.ts. Playtest 2026-11-24 changes: the axe from the hip points its nozzle at your feet (the rocket launches you up; haft up, blade forward), aimed it is a bazooka (rocket forward, Boomstick-size kick back); the launcher kicks like the Boomstick; all three kick x2 in mid-air; plain axe slashes are a cleave, F held + Fire is the grenade slash (front flip, forward leap, grenade behind, third-person camera). Second pass: the axe's knobbed end is the handle's butt the rockets leave from (hip: butt down, block up, blade forward; aimed: up by the right shoulder, butt forward, blade on top); the grenade slash front-flips your body in the third-person camera; launcher and axe shots swing the legs up like the Boomstick; grenade blasts push twice as hard. The new levels pick their opponents (still dummies, dummies that fight back, easy/medium/hard bot: menu New levels, or ?opp=). To check in play: the 9-slot weapon bar on small screens, bots with the new weapons. Done when: Elaina rocket-jumps and fights with each
- [ ] Gunblade 3: the rocket axe (Elaina, 2026-11-24, future development): rockets fire out of the handle's butt and throw you forwards and up (a recoil launch like the other guns, aimed by where you look); grenades fire out of the back of the blade, so each throw whips the axe round fast: chained, they make quick swings and flip slashes (the Reaper flip rules, operativePose flip). Needs: a rocket and a grenade projectile (sim, tested), blast knockback, the axe model (Meshy), a first-person swing set, a bot that uses it. Done when: Elaina chains a rocket launch into a grenade flip slash and lands a hit
- [ ] Menu music and stingers
- [ ] Art approval sample (GDD): one operative model and one separate shotgun in the painted room, compared with the shotgun keyframe; then figures and guns
- [ ] `/asset-intake` + Wavesmith: free model packs with licences checked for the slice's figures and room; balance the code-made sounds

## Later
- [ ] 

## Parking lot (ideas, no commitment)
- Gatling Copter at x2 thrust climbs ~100 m in 5 s when aimed straight down: maybe a height falloff or more drag if it stops feeling like hovering
- Limited reserve ammo and ammo pickups (magazines are in; reserve is infinite for now)
- Fight Back win condition (knock them all out within a time? waves?) and dummies that move
- Smith heavy guns: oversized versions of standard guns, ~25% recoil, walk only (design doc "Future systems")
- Weapon durability, scavenging and Smith workbench repair, for Scrapyard / Junk Wars modes only (design doc "Future systems")
- Armor and damage types (bullet, slash, blast, bonk): Modern vest, Medium brigandine, Chainmail, Plate; heavier armor cuts recoil and knockback, total recoil cut capped ~75% (design doc "Future systems")
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
- 2026-11-22: Sound pass: crowd reactions (ooh, cheer, aww) and a yeetpowder fizz made in code; match music (surf / spy chiptune loop) on the music bus; sound captions through the subtitle bar; announcer lines written and wired (voices pending); pink muzzle flashes, tracers and puffs (design doc Lore); GDD and design doc export synced to the game (gdd-sync)
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
