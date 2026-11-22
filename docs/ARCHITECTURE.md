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
| System | Responsibility | Entry point | Tests |
|---|---|---|---|
| Tuning | Every feel number (movement, recoil per gun, bonk, dummies, copter) | `src/core/yeet/tuning.ts` | via sim tests |
| Arena | Gray-box room as AABBs; body movement with sub-steps; ray casts | `src/core/yeet/arena.ts` | `tests/yeetSim.test.ts` |
| Levels | Sandbox and Fight Back as data: boxes, spawn, start guns, pickups, dummies fight or not, seed | `src/core/yeet/levels.ts` | `tests/yeetSim.test.ts` (spawns, tower reach) |
| Sim | Player run/jump/recoil/twist, guns and hitscan, wall bonk, run-and-gun tumbles (seeded rolls), pickups, health, dummies and their AI (face, telegraph, throw balls), Gatling Copter | `src/core/yeet/sim.ts` | `tests/yeetSim.test.ts` |
| Autoplay | Scripted tour of every mechanic (browser `?play&autoplay` and Vitest) | `src/core/yeet/autoplay.ts` | `tests/yeetSim.test.ts` |
| Play world | Fixed-step loop, input to YeetInput, events to effects, camera | `src/game/YeetWorld.ts` | smoke `--query "play&autoplay"` |
| FPS input | Pointer lock, mouse look and buttons, weapon keys, R | `src/game/fpsInput.ts` | manual (pointer lock needs a real click) |
| Visuals | Room from the arena boxes in the painted slice look (world-scaled UVs, ceiling panels, wall band, doors, hazard trim; textures painted in code in `paint.ts`), dummy figures and stars, first-person viewmodel (navy sleeves, gloves; the six weapon models are built in `gunModels.ts` from bevelled side profiles, each with its grip/foregrip/muzzle anchors; per-gun hold (hand offset, tilt) in `viewmodel.ts` HOLD; the third-person operative (`operative.ts`: rigid parts on joints, two-bone arm solve onto the held gun; poses as pure maths in `operativePose.ts`, tested) for your body and duel opponents; shared materials and the glove in `materials.ts` and `glove.ts`, triangle budget tested), tracers, HUD | `src/game/yeet/` | smoke screenshots |
| Bots | Engine-free brain per bot: perception (line of sight, a reaction-delayed memory), an FSM (engage, hunt, gun, retreat, recover) re-decided every 0.1 s, steering with wall probes and the Boomstick launch maneuver; outputs only a YeetInput and a look turn, so a bot is a normal player in the sim; difficulties in TUNING.bot | `src/core/yeet/bot.ts`; offline duel in `src/game/YeetWorld.ts` (routeBotMatch, drawBot); menu `botScreen` in `src/shell/screens.ts` | `tests/bot.test.ts` (controls, replay, no stuck bots, hard > easy over seeds, launch) |
| Duel netcode | Protocol (inputs with look deltas up, 30 Hz snapshots down), socket-free Room (queues, acks, 120 Hz authoritative sim), client Predictor (replay unacked inputs) | `src/net/protocol.ts`, `src/net/room.ts`, `src/net/predict.ts` | `tests/net.test.ts` |
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
- `?play`: skip the title, straight into the play world. `?play&autoplay`: the scripted tour; logs `YEET_MARK_<moment>`
  (pistol, launch, spin, copter, crash) and `YEET_AUTOPLAY_DONE hits=.. top=.. bonks=..`. Screenshot a moment with
  `python tools/dev.py smoke --query "play&autoplay&hold=launch" --until YEET_MARK_launch --screenshot captures/progress/x.png`
  (`hold=<mark>` freezes the game at that moment, so the slow headless renderer cannot drift past it).
- Duel: `npm run duel` starts the duel server and the game on the home network; open `?play&level=duel` (menu: Duel
  (online)); `&room=ABCD` joins a room at once; `&lag=120` adds 120 ms each way; `&debug` shows ping, snapshots per
  second, pending inputs and the worst prediction correction.
- YEETREAP on a player (regression check for the 2026-11-22 crash): `python tools/dev.py smoke --query "play&level=duel&bot=easy&botseed=1&yeetreap" --until YEET_MARK_yeetreap --timeout 60` hooks the bot with Reaper's Kick and YEETREAPs it; any error fails the run.
- Bots: `?level=duel&bot=easy|medium|hard` (the menu's Duel vs bot), `&botseed=N` replays a match, `&debug` draws the bot's aim line (pink, grey when it cannot see you), its goal line (cyan) and a label with its difficulty, state and aim error.
- Touch: `?touch` shows the phone/tablet controls on the PC (mouse acts as a finger; they show by themselves on a coarse pointer); `src/game/touchControls.ts`, maths in `src/core/yeet/touch.ts`; aim assist `src/core/yeet/aimAssist.ts`; gyro `src/game/gyro.ts`; the ⚙ panel's options `src/game/touchSettings.ts` (saved per device in localStorage, outside the kit settings). H opens the controls list on PC.
- Art review: `?showcase` holds the camera in front of your operative (`&pose=kneel|fling|tumble|run|aim|ko|look|flip|slash`, `&side=<rad>`, 3.14 is in front); `?flash` holds the pink muzzle flash on; `?hero` fires Reaper's Kick straight down 1 s in and logs `YEET_MARK_hero` mid hero landing (`?hold=hero` freezes there).
- `?level=sandbox|fight|duel` picks the level (the menu: Play = fight, Sandbox = sandbox via `shell.worldOption`).
- `?weapon=0..5` starts with that weapon in hand; the tour logs `YEET_MARK_kick` mid kick-out (`hold=kick`); `?tumble` trips a tumble 1 s in (`YEET_MARK_tumble`, `hold=tumble`).
- `?aim` holds right-click aim during autoplay (stills of aimed fire, e.g. `play&autoplay&aim&hold=spin` for the scope).
- `?debug`: log channels `yeet` (sim events) and `fps` (pointer lock).
- R respawns the player.

## Open questions
- 
