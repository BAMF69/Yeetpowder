# Handoff

> Rewritten at the end of every session by `/end-session`. Read first by `/start-session`.
> Keep under ~60 lines. It is a baton, not a diary.

**Last updated:** 2026-11-21
**Branch / commit:** (fill in)
**Engine version:** see `docs/ENGINE.md`

## Where we are
The toy is playable (Toy tier, nothing committed yet for it). One gray-box room: Pea Pistol, Boomstick, Spin Doctor and a Gatling Copter prototype, five target dummies that get knocked flying and respawn, wall-bonk stun with stars, comic pops, kill feed. After playtest 1: recoil raised (Boomstick and copter x2), first-person arms and legs with per-gun recoil poses. After playtest 2: right-click aim (braced fire vs full-yeet hip fire, Spin Doctor scope), Pea Pistol hop + visible blowback, copter turns right and wobbles. After playtest 3: levels (Sandbox; Fight Back with shooting dummies, pickups and a Boomstick-only Gatling tower), twist-based aiming with zoom knock-out, run-and-gun tumbles with a third-person camera, arm glitch fixed. check, test (299) and smoke pass.

## What changed last session
- Built the toy: engine-free sim in `src/core/yeet/` (tuning, arena, sim, autoplay) with 16 tests; the play world `src/game/YeetWorld.ts` plus `src/game/yeet/` visuals and `src/game/fpsInput.ts`; `?play` in `src/shell/app.ts`; removed the kit's `src/game/Game.ts` prototype.

## Current task
- Duel netcode first build is in (ROADMAP Now): `npm run duel`, then two windows on `?play&level=duel`. Next: Elaina plays it laptop-vs-laptop, then with the phone (touch controls are still a Next item); then the three duel modes.
- 2026-11-21: moved to the Vertical slice tier ("Move on anyway", no recorded 2-minute playtest). Slice brief agreed (docs/VERTICAL_SLICE.md Decisions). Gunblades first build is in (keys 5/6, F slash; Sandbox has both, Fight Back has them as pickups on the flanks). Hold-F moves added (TUNING.reaper.hook/yeetreap, TUNING.sakura.dash/ultra). Next: Elaina plays them; poses (reversed blade, hook) are not yet checked in a still.
- ROADMAP Now: playtest and tune the toy.

## Next step (specific, first action)
- Elaina plays it (`python tools/dev.py run`, click to lock the mouse) and pastes notes; run `/playtest-report`, then tune `src/core/yeet/tuning.ts` one change at a time.

## Open questions / decisions pending
- Copter now climbs ~100 m in 5 s at full thrust: watch whether hovering still works in play.
- Twist amounts, tumble chances and AI timing are Claude's picks (TUNING.weapons.*.twist, TUNING.tumble, TUNING.ai): confirm in play.
- Decided (Elaina, 2026-11-21): the Gatling Copter never tumbles you when fired on the run.
- Playtest 5 on branch feat/reload (from main 8d10b5d): airborne x2 kick/twist, COPTER YEAT, magazines + reload.
- The ?operative art experiment (Quaternius SWAT model, Meshy trials) lives on its own branch, feat/operative-art,
  built on feat/reload. The raw 265 MB "Modular Men" pack stays local and is gitignored (CC0, re-downloadable).
- "Gunshots seem late" (playtest 4): files and scheduling are immediate; asked for the lowest latency and log it ("audio latency: ..." after the first click, ?debug not needed). Ask Elaina if it is better; if not, check the logged output latency.
- Placeholder sounds are in (Elaina asked): balance by ear in play; tune recipes in tools/audio/yeet_sounds.py and rerun it.
- Pointer lock, mouse look and the feel on a real GPU are not verified by a test (headless smoke cannot click-lock); first human run checks them.

## Known broken or flaky
- Sound captions are not shown yet (the events carry captions; the dialogue build step is not wired).
- The kit's first-run telemetry consent prompt appears once over play; smoke stills use `--data-dir captures/smoke-data` (consent no) to avoid it.

## Commands that matter right now
```
python tools/dev.py run
python tools/dev.py check
python tools/dev.py test
python tools/dev.py smoke --query "play&autoplay" --until YEET_AUTOPLAY_DONE --timeout 90
```

## Context a fresh Claude needs
- Concept art, keyframes and pitch videos live in `docs/concept/` (videos and the zip are gitignored: too big).
- Original designs only: GoldenEye-style feel, never its assets, characters or maps.
- Feel numbers: `src/core/yeet/tuning.ts`. Debug hooks: `docs/ARCHITECTURE.md` "Debug tooling".

- 2026-11-24: Vinish asset intake: four VFX atlases with runtime pink remapping, seven OGG combat sounds, rebuilt captions and visible credits (A-0016/A-0017). Re-download with `python tools/fetch_vinish.py`. New logic/provenance tests in `tests/vinishVfx.test.ts`. Verified: check (types + 11 shader recipes), 467 unit tests, gameplay muzzle capture and impact/explosion/slash browser smoke captures without errors. Build about 13 MB. Sound mix still needs Elaina to judge in play.

- 2026-11-24: Level aesthetics/Party layouts: CC0 Poly Haven sand, rock, asphalt, corrugated iron and concrete (15 optimised 512 px PBR maps, A-0018). Original duel geometry retained; `island-party`, `industrial-party`, `junkyard-party` selectable in Arenas, eight spawns each, 3.79–3.85x ground footprint. Static rooms/cars batched; lane markings and overview/cutaway via `?mapview`. Verified check (types + 11 shaders), 479 tests, browser smoke of all three Party levels and original Shark Island, credits current. Build 13,904 KB. Next: traversal/sightline playtest. Preview captures: captures/progress/{island,industrial,junkyard}-party-overview.png.

- 2026-11-24: Quick Play/Make a Room: public directory with exactly eight combatants, alternating easy/medium vacancy bots, human replacement and disconnect refill. Custom map, 2–8 capacity, visibility, bot fill, kill target, limited lives, timer and Ring Out infinite HP (Shark Island); authoritative results and owner rematch. Room handshake precedes world loading. Existing duels keep their original behavior. New ADR 0005; frontend options localized in en/fr. Fixed input validation, warm-up score reset, eliminated-player prediction backlog, explicit page-leave cleanup, and room controls being covered by the pause overlay after switching tabs. No new dependencies.
  Validation: 490 unit tests pass; type/shader checks pass; production build 13,923 KB; live eight-client socket test passes (full-room overflow, replacement, disconnect fill, private isolation, malformed messages). Chromium room-flow check passes: four modes, authoritative Ring Out map/HP, two clients in one room, bot labels, disconnect refill and offline eight-combatant play, with no page errors. Browser helper uses a 960×600 viewport and 30 fps setting to reduce load; initial attempts stalled under memory pressure and exposed the pause-overlay issue above. Credits current. Screenshots: captures/progress/{make-room-options,ring-out-room,quick-play-online,quick-play-eight}.png. Public internet matchmaking still requires deploying the backend and HTTPS `/duel-ws`; use `npm run duel` locally. Static-only hosting falls back to labelled offline Quick Play, with private PeerJS invitations retained. Human game-feel, mobile and internet network playtests remain.
  Final wrapper smoke: `python tools/dev.py smoke --query "quick&offline" --until YEET_LEVEL_READY --timeout 90` reached the boot and level-ready markers without errors.

- 2026-11-24: Coliseum/couch/spectators/highlights implemented (ADR 0006). New `coliseum` map: 104 m circular open-air layout, three raised concentric perimeter rings, four stairs and eight spawns; selectable in room setup, Arenas and public matchmaking. User approved 2–4 player split-screen, keyboard/mouse for Player 1 and gamepads for others; all-gamepad option also available. Couch setup reuses map/rule/bot-fill controls, runs one local authoritative Room, and uses separate device input, cameras, guns and HUDs. Three-player games clear the unused quadrant. `ArenaWorld` also supplies read-only spectator player-follow/overview views; WebSocket and peer rooms keep watchers separate from combatant slots and cap them at 16. Watcher inputs/rematches are ignored.
  `HighlightRecorder` chooses the greatest actual 3D speed across active, living combatants, with a bounded 10 Hz transform history and exact peak. Configured rooms and couch games automatically play a skippable slow-motion “Yeet of the match” at the end, with a rewatch button and rematch reset. Replay does not reconstruct projectile trajectories, debris or sound events. HUD/replay speed reads “yeters per second”, using the previous numerical scale. Physical movement tuning is unchanged. No new dependencies/assets or deployment.
  Verified: 498 tests, including full-circumference ring continuity; type check and 11 shader recipes; real WebSocket test including a spectator in a full eight-human room; Chromium virtual-pad isolation, couch replay/skip/rematch, 2/3/4 viewport setup, standard Quick Play end replay/rematch and spectator switching/overview. The final Quick Play/spectator checks ran with `node tools/test_couch_browser.mjs --quick-only`; hot reload is disabled and the helper now waits for the actual world to finish loading before inspecting it. Initial test attempts exposed bot interference in the input-isolation fixture and development reload/readiness races; these were corrected in the helper. Visual QA closed narrow chord seams between ring tiers. Final production smoke `python tools/dev.py smoke --query "play&couch=4&noart" --until YEET_LEVEL_READY --timeout 90 --data-dir captures/smoke-data --screenshot captures/progress/coliseum-couch-four.png` passed without errors; build 13,945 KB. The data directory suppresses the first-run consent dialog for capture. `git diff --check` passes. Captures: captures/progress/{coliseum-couch-two,coliseum-couch-three,coliseum-couch-four,coliseum-spectator,yeet-of-the-match,quick-play-highlight}.png.
  Remaining human validation: physical controllers, four-player performance on the target TV/laptop, camera feel and arena traversal. Tests use virtual standard-mapping pads; frame-time/minimum-hardware performance was not measured. Phone-as-controller pairing and grouped online couch matchmaking are future work. The local test server started for verification was stopped afterward; run `npm run duel` for network rooms.
