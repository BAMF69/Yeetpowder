# Handoff

> Rewritten at the end of every session by `/end-session`. Read first by `/start-session`.
> Keep under ~60 lines. It is a baton, not a diary.

**Last updated:** 2026-11-27 (follow-up: art and grunge pass)
**Branch / commit:** claude/nifty-faraday-7l1db4 (cloud session), pushed; built on main 862f84e
**Engine version:** see `docs/ENGINE.md`

## This session: icon menus and the respawn screen (ADR 0008)
- Elaina approved the clickable mockup `docs/mockups/menu-redesign.html`, then set the rules: SPAWN unlocks 10 s
  after a knockout, auto-respawn at 30 s, name and operator changeable any time (online too), one word per icon.
- Menus: `src/shell/iconMenus.ts` (Home: Play, Party, Solo, Couch, Settings, Operator; no screen over six choices),
  `menuKit.ts` (GridMenu + spatial d-pad nav), `icons.ts`, `roomSetup.ts` rules, `launch.ts`. Old dropdown form and
  profile form deleted; deep links (?quick, ?online&room, ?couch, ?make-room) open the new screens.
- Respawn: `TUNING.player.respawnUnlock/respawnAuto`, `YeetInput.spawn`, `{t:"profile"}` -> `Room.setProfile`;
  overlay `src/game/respawnScreen.ts` (YeetWorld) and per-player couch badges (ArenaWorld).
- Verified: check (types + 11 shaders); 573/574 tests; smoke boot and drives menus, content, display, pseudo
  (--locale pseudo --timeout 120: 35 screens, nothing truncated); pseudo-plant fails only on its planted label (as
  designed). Browser helpers updated and passing: operator, couch, solo playtest; party passed 2 of 4 runs.
  Own checks: phone-landscape/portrait stills of every menu, a full respawn flow (early press ignored, operator
  change reaches the room roster, spawn after unlock, no pause) and couch pad flow (RB operator, A spawn).
- Known failing: `tests/soloPlaytest.test.ts` island-edge bot test. The bot already walked into the water before this
  session; the old 2.2 s respawn hid it. A separate task was suggested for the bot fix.
- Intermittent: `tools/test_party_browser.mjs`. Suspected: a bot knocks out the joining client and the respawn screen
  hides the room card's Players button (by design while down). Not confirmed.
- Not verified: feel with humans (is 10 s too long?), real phone touch on the new menus and the respawn screen, real
  gamepads, GPU frame time. Map tiles are drawn SVG stand-ins, not renders of the maps.
- Cloud container notes: Git LFS assets needed `git lfs pull`; Playwright wanted browser build 1248, linked to the
  installed 1243 under /opt/pw-browsers (container only, nothing in the repo).

## 2026-11-27 follow-up
- Merged the Shark Island bot fix (claude/nifty-carson-za2ptt); the island test now starts on the shore. 588/588 tests.
- Operator icons (`src/shell/operatorIcons.ts`) and renames (Viking, Samurai, Black Ops, Black Widow).
- Grunge pass with Elaina's new art (A-0023): title_burst title, metal menu backdrops, flames/barrel loading screens.
  Verified: check, 588 tests, smoke boot plus the menus and pseudo drives on the production build. Stills:
  captures/progress/mk-00-title, mk-01-home, mk-03-make, mk-06-bots, mk-11-loading-1, rs-02-ready.
- Open: is image 2 or 3 the "hot pink flash" title (3 chosen)? The load_barrel image looks like the Bond gunbarrel
  opening: decide before release. Map tiles are still drawn stand-ins.

## Next step (specific, first action)
- Elaina plays the new menus on a phone and a laptop and dies a few times: is the respawn wait right, are any
  icons unclear? Then `/playtest-report` and tune `TUNING.player.respawnUnlock` / the icons one change at a time.

## Current art/gameplay continuation
- Work in `C:/Users/shane/Documents/Claude/Yeetpowder/build/art-integration`. Shane confirmed the parent checkout as his gameplay checkout; its tracked files and untracked art/shopping work are preserved. The main merge is prepared without a commit; props.ts import conflict was resolved keeping projectile previews and static batching. Do not reset this worktree to clear the pending merge.
- ADR 0007 records Shane's confirmed rules: slot 0 left-hand shield + shared hip Pea Pistol, frontal bullet block, half frontal knockback and hip blast damage, aimed two-handed viewport/holstered pistol and no frontal blast damage. V / touch HEAL / D-pad Up spends one of three carried health uses, 3 s full recovery, 10 s cooldown afterward; damage/movement do not interrupt, death cancels and resets to starter gear with no drops. Map pickups retain 6 s weapon / 12 s health timers and refill without stacking. Shared HUD, prediction, snapshots and bots use the same state.
- The accepted weapons/Tactical operative and first-person fits are retained. Source GLBs are preserved. Ten DEV-only texture exports total 5,310,428 bytes instead of 78,885,652, with mesh/node/accessor/material/metadata identity tests. Shield's baked opaque viewport has a runtime cutout aligned to its existing window; health uses the reviewed preview in development and a procedural fallback in release/noart. No grip-editor JSON has arrived: final third-person grip application remains pending.
- A-0019 enables eight verified original Vinish props (2,173,944 bytes total), with embedded metadata/clips retained, hashes and visible credits. Industrial: mixer/conveyor/toilet/skip. Junkyard: skip, jumpable crate step, drums. Island: nonblocking wildlife. Layout/collision data is shared by client/server; primary lanes, spawns, supplies, launch platforms and current shark are preserved. Scenery batches load only needed files. Unmatched Meshy scenery/equipment source chains remain release-blocked and DEV-only (A-0020); no paid generation or new dependency.
- Verified so far: 530 tests / 52 files, types and 11 shader recipes. Real keyboard/touch healing and shield controls; all three rendered scenery batches; noart collision; two real WebSocket clients agree on shield/pistol/health/cooldown. Junkyard step was lowered after its initial height slightly exceeded the actual jump peak, and the grounded-approach jump/recoil route now passes. Production Industrial smoke with an art-preview URL flag passed without fetching gated source art (16,103 KB build before the final crate-scale adjustment); final recheck recorded below.
- Human review still needed: final scenery composition/sightlines/traversal, shield/healing balance, touch/controller feel and target-GPU performance. Browser checks used software rendering; no frame-budget claim. Captures: captures/progress/{approved-shield-pistol-preview,approved-shield-viewport-preview,shield-third-person-hip,shield-third-person-braced,approved-health-pack-application,scenery-industrial-review,scenery-junkyard-review,scenery-island-review,equipment-scenery-production}.png. Source/audit details: ART_GAMEPLAY_REVIEW.md; prepare with tools/prepare_scenery.py and tools/prepare_art_previews.py. The updated local server is run with npm run duel from this art worktree at https://localhost:5180/?art-preview=approved. Work remains uncommitted.

## Earlier project notes (historical)
Final continuation validation: 530 tests / 52 files passed after the jump-route adjustment; final type check and 11 shader recipes passed. tools/test_equipment_scenery_browser.mjs passed keyboard/touch equipment and all three scenery/noart collision cases; its --art-only pass verified accepted shield hip/braced/third-person poses and health-pack application, including the runtime viewport shader without console errors. tools/test_equipment_network.mjs passed again against the restarted final server, and https://localhost:5180/ returned HTTP 200. Production Industrial smoke with art-preview=approved passed without errors; final rebuilt package is 16,103 KB. The treatment HUD now explicitly says equipment is holstered. CREDITS and THIRD_PARTY_LICENSES generation checks and both staged/unstaged diff checks pass. No target-GPU frame-time claim, paid work, commit or push. Server session runs from this art worktree; parent main remains 6983335 with only its original three untracked entries.


## Where we are
The toy is playable (Toy tier, nothing committed yet for it). One gray-box room: Pea Pistol, Boomstick, Spin Doctor and a Gatling Copter prototype, five target dummies that get knocked flying and respawn, wall-bonk stun with stars, comic pops, kill feed. After playtest 1: recoil raised (Boomstick and copter x2), first-person arms and legs with per-gun recoil poses. After playtest 2: right-click aim (braced fire vs full-yeet hip fire, Spin Doctor scope), Pea Pistol hop + visible blowback, copter turns right and wobbles. After playtest 3: levels (Sandbox; Fight Back with shooting dummies, pickups and a Boomstick-only Gatling tower), twist-based aiming with zoom knock-out, run-and-gun tumbles with a third-person camera, arm glitch fixed. check, test (299) and smoke pass.

## What changed last session
- Built the toy: engine-free sim in `src/core/yeet/` (tuning, arena, sim, autoplay) with 16 tests; the play world `src/game/YeetWorld.ts` plus `src/game/yeet/` visuals and `src/game/fpsInput.ts`; `?play` in `src/shell/app.ts`; removed the kit's `src/game/Game.ts` prototype.

## Current task
- Duel netcode first build is in (ROADMAP Now): `npm run duel`, then two windows on `?play&level=duel`. Next: Elaina plays it laptop-vs-laptop, then with the phone (touch controls are still a Next item); then the three duel modes.
- 2026-11-21: moved to the Vertical slice tier ("Move on anyway", no recorded 2-minute playtest). Slice brief agreed (docs/VERTICAL_SLICE.md Decisions). Gunblades first build is in (keys 5/6, F slash; Sandbox has both, Fight Back has them as pickups on the flanks). Hold-F moves added (TUNING.reaper.hook/yeetreap, TUNING.sakura.dash/ultra). Next: Elaina plays them; poses (reversed blade, hook) are not yet checked in a still.
- ROADMAP Now: playtest and tune the toy.

## Earlier next step (historical)
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

- 2026-11-24: Solo Party playtest pass (report in PLAYTEST_LOG.md). Fixed industrial fence/warehouse coplanar faces, authoritative grenade/pistol viewmodel resync, pickup starvation (weapons respawn in 6 s, extra Party supplies), seeded safer randomized spawns, and island bot retreat/recoil edge checks. Added green health packs (50 HP, 12 s respawn) and the Yeet Shield (slot 0; aim guards frontal damage/force, fire bashes; flanks remain vulnerable). Grenade radius 4.2→8 m; aimed throws 27 vs hip 16, with a static-world fuse/bounce trajectory and blast-area guide. Shotgun cone 0.09→0.15 rad. Pickups spin the actual existing weapon models, rebuilt after art loads. Shark victims freeze visibly for 2 s while a shark approaches, then disappear until respawn; credit is captured on entry. Knockout feedback explicitly says KNOCKOUT/KNOCKED OUT with a distinct sound.
  Added sanitized names (20 characters) and four cosmetic operator color variants in Player & Operator, persisted locally and shared in authoritative rosters. Arenas → Choose opponent count & rules supports 1–7 bots and difficulty. Tab exposes scores in Party/couch and the legacy solo/bot views. Main menu has the existing title art, a neon treatment and two-column actions. Public Quick Play results count down 30 s and offer Next match · new map. The room retains its code/seats/profiles while replacing the sim; transports announce the new round, PartySession hands the live connection to a fresh world, and round-epoch inputs reject stale controls. Private rematches stay owner-controlled. Highlights require a credited kill in the recorded moment; a faster no-kill launch cannot win. Playback opens on a frozen two-second orbit of the actual winner with name/score, then runs the qualifying clip. It remains a transform replay, not reconstructed projectiles/audio.
  Verified: 510 unit tests, types and 11 shader recipes; tools/test_solo_playtest_browser.mjs passed the profile/menu/opponent/score/pickup/heal/grenade/respawn/shark/winner/replay/manual-next/automatic-next flows; tools/test_quick_rotation.mjs passed eight actual human sockets plus a spectator through a credited pistol kill, profile persistence, synchronized map rotation and rejection of previous-round inputs. Initial browser readiness was tightened to wait for the actual gameplay screen, rather than just completion of asset loading. Additional legacy-score/screenshot checks are recorded below. Production Quick Play smoke with real art passed (13,966 KB build before the legacy overlay follow-up), no page errors. Existing helper tools/test_couch_browser.mjs now creates credited kills for replay fixtures. No new dependencies or downloaded assets; separate Meshy work was preserved. New work is uncommitted.
  Human follow-up: replay grenade/shotgun/shield balance, shark timing/readability and island AI on the local server. The last testing session started `npm run duel` for the updated backend and page at https://localhost:5180/; backend port 7357. Frame-time/minimum-hardware performance was not measured.
  2026-11-25 validation follow-up: the awaited-readiness browser run confirmed the profile/solo-combat flow, legacy Tab scores and shark disappearance. The installed Playwright waitForFunction polls a returned Promise as truthy, so async predicates can finish while the game is still loading; both playtest helpers now use Node polling of explicitly awaited page.evaluate booleans. This was verified by the outside-view diagnostic in ignored build/tab-diagnosis.mjs; native Tab events and the score handler were correct. Results clock text now updates in place rather than replacing buttons every second, preserving new-map button stability and focus on slow renderers. The new helper's --quick-only / --legacy-only switches isolate the remaining flows.
  Final verification (2026-11-25): the robust --quick-only browser run passed kill-qualified playback, the frozen two-second winner introduction/name/score, manual new-map rotation, automatic countdown rotation, retained profile and no-kill replay rejection. Final check passed types and all 11 shader recipes; all 510 tests in 50 files passed again. Production Quick Play smoke with real art reached YEET_LEVEL_READY without errors, build 13,967 KB, capture captures/progress/solo-fixes-production.png. Frame time remains unmeasured. The local multiplayer test server was restarted with npm run duel for this handoff; new changes remain uncommitted.
