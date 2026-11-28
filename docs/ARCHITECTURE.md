# Architecture

> How the code is organized and why. Keep it short and true. Update when structure changes.
> Last reviewed: 2026-11-22

## Big picture
```
main.ts -> shell (title, menus, pause) -> ThreeHost frame loop -> YeetWorld.update(dt)
  YeetWorld: FpsInput (mouse, 1-4, R) + shell.input (WASD, Space, Esc) -> YeetInput
           -> YeetSim.step() at a fixed 1/120 s  (src/core/yeet: rules, no three import)
           -> YeetEvent[] -> effects: viewmodel kick, tracers, shake, HUD pops, kill feed
           -> draw: camera from player state, dummy figures, HUD
```

## Layers (dependency direction: top depends on bottom, never upward)
1. **Game**: gameplay rules, entities, levels, content
2. **Systems**: input, physics helpers, audio, UI, save, camera
3. **Core**: logging, time, math, events, config, RNG
4. **Engine/platform**: provided by Web 3D (Three.js + TypeScript + Vite)

Rule: Core knows nothing about Game. Pure logic in Core and Game should be testable without the engine.

## Directory map
Engine-specific folder layout is documented in `docs/ENGINE.md`. Universal folders:
| Folder | Contents |
|---|---|
| `docs/` | All documentation and SOPs |
| `tools/` | Dev scripts, `dev.py` command wrapper, hooks |
| `tests/` | Automated tests |
| `.claude/` | Claude Code settings, skills, subagents |

## Key systems
Equipment (ADR 0007): the authoritative sim carries health uses/application/cooldown and shield bracing.
`equipment.ts` supplies shared HUD text; `firearmId` maps the shield to the shared pistol magazine.
`healthPack.ts` builds consistent pickup/held treatment visuals. `shieldViewport.ts` opens the development model's
baked viewport without editing the source GLB. Preview exports preserve geometry and anchors and remain DEV-only.
`core/yeet/scenery.ts` is the reviewed-model catalog: measured bounds plus simple multi-box gameplay colliders per
model, and placements (model, position, quarter turn, scale, stack count, optional explosive kind) that expand into
arena boxes shared by server, client and bots. Layouts live in `sceneryIndustrial.ts`, `sceneryJunkyard.ts` and
`sceneryIsland.ts` (duel and Party each designed; `docs/LEVEL_DESIGN.md`). `game/yeet/scenery.ts` instances static
models (one draw call per model part), clones animated and explosive ones (Box Truck -> Burned Out Truck on wreck),
hides props.ts's procedural stand-ins, falls back to collider boxes under ?noart, and disposes per world.
`core/yeet/botNav.ts` plans bot routes through a level's optional `nav` waypoints when walls block the straight walk.
Asset manifests and preparation scripts are in docs/licenses/ and tools/prepare_{scenery,art_previews}.py.

| System | Responsibility | Entry point | Tests |
|---|---|---|---|
| Tuning | Every feel number (movement, recoil per gun, bonk, dummies, copter) | `src/core/yeet/tuning.ts` | via sim tests |
| Arena | Gray-box room as AABBs; body movement with sub-steps; ray casts | `src/core/yeet/arena.ts` | `tests/yeetSim.test.ts` |
| Levels | Sandbox and Fight Back as data: boxes, spawn, start guns, pickups, dummies fight or not, seed | `src/core/yeet/levels.ts` | `tests/yeetSim.test.ts` (spawns, tower reach) |
| Sim | Player run/jump/recoil/twist, guns and hitscan, wall bonk, run-and-gun tumbles (seeded rolls), pickups, health, dummies and their AI (face, telegraph, throw balls), Gatling Copter | `src/core/yeet/sim.ts` | `tests/yeetSim.test.ts` |
| Autoplay | Scripted tour of every mechanic (browser `?play&autoplay` and Vitest) | `src/core/yeet/autoplay.ts` | `tests/yeetSim.test.ts` |
| Play world | Fixed-step loop, input to YeetInput, events to effects, camera | `src/game/YeetWorld.ts` | smoke `--query "play&autoplay"` |
| FPS input | Pointer lock, mouse look and buttons, weapon keys, R | `src/game/fpsInput.ts` | manual (pointer lock needs a real click) |
| Icon menus | Six-choice home and submenus, picture/icon room setup, Operator screen; spatial d-pad navigation (ADR 0008) | `src/shell/iconMenus.ts`, `menuKit.ts`, `icons.ts`, rules `src/net/roomSetup.ts`, start `src/shell/launch.ts` | `tests/spatialNav.test.ts`, `tests/roomSetup.test.ts`; smoke `--drive menus` / `pseudo`; `tools/test_party_browser.mjs` |
| Respawn screen | Chosen respawn (unlock 10 s, auto 30 s), operator/name changes mid-match, couch badges | `src/game/respawnScreen.ts`, timing `src/core/yeet/respawnView.ts`, rule `sim.ts` canSpawn, `Room.setProfile` | `tests/respawnView.test.ts`, `tests/yeetSim.test.ts`, `tests/partyRooms.test.ts` |
| Visuals | Room from the arena boxes in the painted slice look (world-scaled UVs, ceiling panels, wall band, doors, hazard trim; textures painted in code in `paint.ts`), dummy figures and stars, first-person viewmodel (navy sleeves, gloves; the six weapon models are built in `gunModels.ts` from bevelled side profiles, each with its grip/foregrip/muzzle anchors; per-gun hold (hand offset, tilt) in `viewmodel.ts` HOLD; the third-person operative (`operative.ts`: rigid parts on joints, two-bone arm solve onto the held gun; poses as pure maths in `operativePose.ts`, tested) for your body and duel opponents; Elaina's Meshy art (`meshyArt.ts`, loaded on the loading screen, `?noart` skips it): the scythe replaces the code-built Reaper's Kick through `registerWeaponArt` in `gunModels.ts`, and the rigged Meshy operative is worn over the code figure, whose joints drive its Mixamo bones every frame (`operativeSkin.ts`, rest-offset retarget, tested); shared materials and the glove in `materials.ts` and `glove.ts`, triangle budget tested), tracers, HUD | `src/game/yeet/` | smoke screenshots |
| Bots | Engine-free brain per bot: perception (line of sight, a reaction-delayed memory), an FSM (engage, hunt, gun, retreat, recover) re-decided every 0.1 s, steering with wall probes (hopping only what the jump clears), waypoint routing on maps that list `nav` points (`botNav.ts`) and the Boomstick launch maneuver (also a near-vertical pop onto a close ledge); outputs only a YeetInput and a look turn, so a bot is a normal player in the sim; difficulties in TUNING.bot | `src/core/yeet/bot.ts`; offline duel in `src/game/YeetWorld.ts` (routeBotMatch, drawBot); menu: Solo → Duel (`duelSetup` in `src/shell/iconMenus.ts`) | `tests/bot.test.ts` (controls, replay, no stuck bots, hard > easy over seeds, launch); `tests/levelDesign.test.ts` (bots keep moving and find each other on every revised map) |
| Duel netcode | Protocol (inputs with look deltas up, 30 Hz snapshots down), socket-free Room (queues, acks, 120 Hz authoritative sim), client Predictor (replay unacked inputs). Who runs the Room (ADR 0004): by default the host's browser tab, the guest connecting over WebRTC (PeerJS broker for introductions, Worker clock); `?net=server` uses the home duel server (ADR 0002) | `src/net/protocol.ts`, `src/net/room.ts`, `src/net/predict.ts`, `src/game/net/transport.ts`, `src/game/net/peerLink.ts`, `src/game/net/netClient.ts` | `tests/net.test.ts`; peer connection tested by hand (ADR 0004 Notes) |
| Duel server | `ws` rooms by 4-letter code on this PC, port 7357 (ADR 0002) | `server/main.ts` (`npm run duel`, `npm run duel:server`) | `tools/duel_smoke.mjs` (sockets), `tools/duel_browser_smoke.mjs` (two headless pages) |
| Duel client | Connection, lobby (make / join a room, share link), other player drawn 100 ms behind from snapshots, server events for hits and knockouts | `src/game/net/` (`duelLink.ts`, `netClient.ts`, `remote.ts`) | the browser smoke |
| Sound | Sim events -> audio events through the kit's AudioPlayer/AudioDirector (takes, pitch, voices, cooldowns, sliders); crowd reactions and the yeetpowder fizz; match music through the kit's MusicPlayer on the music bus; sound captions (throttled) and announcer lines through the subtitle bar (`data/dialogue.json` built to `data/dialogue/en.built.json`; the announcer stays silent until voice files `vo_<id>` exist); files rendered in code | `src/game/yeet/sound.ts`, `data/audio_events.json`, `data/music.json`, `data/dialogue.json`, `tools/audio/yeet_sounds.py`, `tools/audio/crowd.py`, `tools/audio/yeet_music.py`, `tools/audio/announcer.py` (recorded announcer lines in) | `tests/yeetAudio.test.ts`; smoke loads every sound and the music |

## Data flow and events
The sim returns a list of `YeetEvent`s from each `step()`; `YeetWorld.onEvent` is the only place that turns them into
effects and HUD (and, later, sound). The sim never calls the renderer.

## State and save data
- What persists, format, version field, migration plan.
- Rule: save files carry a version number from day one.

## Determinism and randomness
- The sim's only randomness is the run-and-gun tumble roll, from a Park-Miller generator seeded by the level
  (`Level.seed`); shotgun pellets use a fixed ring pattern and the copter's wobble cycles with the step count. Same
  level + same inputs = same run, so a scripted run replays exactly in Vitest. Cosmetic randomness (muzzle flash angle) lives only in
  `src/game/`.

## Budgets
| Budget | Target | Measured on | Last measured |
|---|---|---|---|
| Frame time | e.g. 16.6 ms (60 FPS) | min-spec machine, release build | |
| Smoke frame time (p95) | e.g. 20 ms | `dev.py smoke` on the dev machine | |
| Memory ceiling | e.g. 2 GB | | |
| Load time | e.g. under 5 s to menu | | |
| Triangles per asset class | see `docs/sop/SOP-11-3d-pipeline.md` (prop, kit, hero, NPC) | `tools/blender/validate_asset.py` | |
| Min-spec hardware | CPU, GPU, RAM | | |
Set these early (`SOP-10`), measure before optimizing, update the last column when you measure.
`dev.py smoke` prints the run's frame times (mean, p95, p99, worst) and fails when the p95 is over the
"Smoke frame time" target once it holds a number (replace the `e.g.` text, e.g. `20 ms`; `smoke --frame-budget MS`
overrides it for one run). It is a guard for this machine's smoke runs, not the min-spec target above: a headless run
draws nothing (a logic budget), and a browser run cannot go below its 60 Hz frame (about 16.7 ms).

## Debug tooling
- HUD (ADR 0009): `src/game/yeet/hud.ts` (two layers: `.yh` under the touch buttons holds the scope and plates; `.yhT` above them holds the touch weapon chip, picker and strip), `hudLayout.ts` (HUD_TUNING, stamp cascade, hit direction), `weaponIcons.ts`, `bulletHole.ts`. `?play&hud-demo` fires sample stamps, feed lines, a notice and a hit every 2 s and keeps the stamps up for captures. `node tools/test_hud_browser.mjs` checks it in real play.
- Solo Party playtest follow-up: `profile.ts` validates names/operator IDs; `playerProfile.ts` persists the local choice. Room snapshots carry profiles. Public results rotate after 30 s or a `next` request; a `round` message hands the existing PartySession into a fresh world. Input epochs reject delayed previous-round controls. `grenadeAim.ts` shares static-world bounce rules with the grenade simulation; `GrenadeGuide` shows the aimed fuse/blast prediction. Health/weapon pickup timers and shield guards live in the deterministic sim. `tools/test_solo_playtest_browser.mjs` covers the report's user flow (`--legacy-only` isolates old solo/bot Tab scores and shark rendering); `tools/test_quick_rotation.mjs` checks an actual eight-human knockout and map transition, including a spectator.
- Couch/spectator presentation: `ArenaWorld.ts` shares one scene across 2–4 scissored camera views for couch play, or interpolates read-only room snapshots for spectators. `CouchControls` reads devices separately; pure `couch.ts` maps standard pads and viewports. `ThreeHost.World.render` permits split-screen while retaining the shell's lifecycle and screenshots. `?couch` opens setup; `?play&couch=2|3|4` starts a default coliseum couch match; `?online=1&room=ABCD&spectate` watches by code.
- `levelColiseum.ts` builds circular chord collision, three rings and four stairs. `?play&level=coliseum&mapview` reviews its layout. `HighlightRecorder` records the authority's fastest living combatant, bounded transforms and 3 s before/2 s after; finished snapshots deliver one replay clip. `MatchReplay` plays it without stepping the simulation, supports skip/replay and collision-aware follow cameras. See ADR 0006. `node tools/test_couch_browser.mjs` uses virtual pads and the Vite world module for integration checks, without production test hooks.
- Party rooms: `?quick`, `?make-room`, `?online=1&room=ABCD`; `?quick&offline` forces the labelled one-human/seven-bot fallback. `partySession.ts` completes the handshake before constructing the world, then configures prediction and scenery with the authority's options. `roomDirectory.ts` matches public eight-seat rooms; `room.ts` owns bot inputs, match rules, results and owner rematches. Snapshots include human/bot/active masks and match state. Vacancies and eliminated seats are distinct; inactive players stop predicting inputs. See ADR 0005.
- Party public matchmaking uses the WebSocket backend started by `npm run duel`; HTTPS hosting needs the `/duel-ws` route. Private invites retain PeerJS fallback. `YEET_DEBUG=1` on the room server logs joins/leaves. After building, `node tools/test_party_network.mjs` checks real sockets; `node tools/test_party_browser.mjs` checks setup and gameplay in Chromium (both need the server running).
- Level art/layout review: `?play&level=island-party&opp=static&mapview` (also `industrial-party`, `junkyard-party`) shows an elevated view, hides the HUD and cuts away warehouse ceilings. `YEET_LEVEL_READY <id>` means models and terrain maps have loaded; use `--until YEET_LEVEL_READY` for smoke captures.
- Terrain PBR maps live in `public/assets/textures/terrain/`, managed by `terrainMaterials.ts`; room UVs set metres per repeat. Static room surfaces and crushed cars are batched by material/shadow state (`staticBatch.ts`); explosive vehicles stay separate for wreck animation.
- Vinish combat VFX: `?play&vfx=impact|explosion|slash&hold=vfx` previews an effect ahead of the camera and logs `YEET_MARK_vfx`. `?flash` holds the muzzle flash. Atlases load during the world loading screen; each effect owns its frame uniform, all share four textures (disposed with the world).
- `?play`: skip the title, straight into the play world. `?play&autoplay`: the scripted tour; logs `YEET_MARK_<moment>`
  (pistol, launch, spin, copter, crash) and `YEET_AUTOPLAY_DONE hits=.. top=.. bonks=..`. Screenshot a moment with
  `python tools/dev.py smoke --query "play&autoplay&hold=launch" --until YEET_MARK_launch --screenshot captures/progress/x.png`
  (`hold=<mark>` freezes the game at that moment, so the slow headless renderer cannot drift past it).
- Duel: open `?play&level=duel` (menu: Duel (online)); "Host a room" makes this tab the host (WebRTC, ADR 0004),
  `&room=ABCD` joins one at once. `npm run duel` serves the game on the home network over https (and starts the
  home duel server, used only with `&net=server`); `&lag=120` adds 120 ms each way; `&debug` shows ping, snapshots per
  second, pending inputs and the worst prediction correction.
- YEETREAP on a player (regression check for the 2026-11-22 crash): `python tools/dev.py smoke --query "play&level=duel&bot=easy&botseed=1&yeetreap" --until YEET_MARK_yeetreap --timeout 60` hooks the bot with Reaper's Kick and YEETREAPs it; any error fails the run.
- Bots: `?level=duel&bot=easy|medium|hard` (the menu's Duel vs bot), `&botseed=N` replays a match, `&debug` draws the bot's aim line (pink, grey when it cannot see you), its goal line (cyan) and a label with its difficulty, state and aim error.
- Touch: `?touch` shows the phone/tablet controls on the PC (mouse acts as a finger; they show by themselves on a coarse pointer); `src/game/touchControls.ts`, maths in `src/core/yeet/touch.ts`; aim assist `src/core/yeet/aimAssist.ts`; gyro `src/game/gyro.ts`; the ⚙ panel's options `src/game/touchSettings.ts` (saved per device in localStorage, outside the kit settings). H opens the controls list on PC.
- Projectiles: rockets and grenades live in `sim.projectiles` (stepProjectiles: rockets straight, grenades fall and bounce; `blastAt` is the one blast for projectiles and explosive vehicles, with a self-scale for rocket jumps), drawn in flight by props.ts; weapons with `projectile` in TUNING.weapons fire them.
- New levels: `src/core/yeet/levelsOutdoor.ts` (island, industrial, junkyard; boxes with a `prop` are cars/trucks/tanks/drums, `paint` picks a tinted surface, `hidden` bounds), hazards in `src/core/yeet/hazards.ts` (explosives: health, blast, chain, wreck and respawn; water knockouts in the sim; tests/hazards.test.ts), drawn by `src/game/yeet/props.ts` (placeholder shapes, the sea, the shark, pink fireballs); `?boom=<i>` blows up explosive i 1 s in (`YEET_MARK_boom`); `?bot=<skill>&level=island|industrial|junkyard` plays a bot match there (no dummies).
- Touch shake moves: `?touch&shake=left|right|up|down` plays one shake 1 s in (`YEET_MARK_shake`, `&hold=shake` freezes); the rules are `src/core/yeet/shake.ts` (detector, moves, runner; tests/shake.test.ts) and `TUNING.touch.shake`; `?debug` logs each shake on the touch channel.
- Art review: `?showcase` holds the camera in front of your operative (`&pose=kneel|fling|tumble|run|aim|ko|look|flip|slash`, `&side=<rad>`, 3.14 is in front); `?flash` holds the pink muzzle flash on; `?hero` fires Reaper's Kick straight down 1 s in and logs `YEET_MARK_hero` mid hero landing (`?hold=hero` freezes there).
- `?level=sandbox|fight|duel` picks the level (the menu: Play = fight, Sandbox = sandbox via `shell.worldOption`).
- `?weapon=0..5` starts with that weapon in hand; the tour logs `YEET_MARK_kick` mid kick-out (`hold=kick`); `?tumble` trips a tumble 1 s in (`YEET_MARK_tumble`, `hold=tumble`).
- `?aim` holds right-click aim during autoplay (stills of aimed fire, e.g. `play&autoplay&aim&hold=spin` for the scope).
- `?debug`: log channels `yeet` (sim events) and `fps` (pointer lock).
- R respawns the player.

## Open questions
- 
