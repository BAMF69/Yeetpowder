# Troubleshooting Log

> Known issues and verified fixes. Future-you and testers should not need to ask how to fix these.
> Add an entry whenever a bug cost more than ~30 minutes or is likely to come back.

## Template (copy)
```
### <Short symptom>
- First seen: YYYY-MM-DD
- Environment: OS, engine version, build type
- Symptom: exact error text or behavior
- Root cause: 
- Fix: 
- How to verify: 
- Related: commit / ADR / issue
```

## Entries
### A guest on home Wi-Fi is stuck at "Joining room" (works on mobile data)
- First seen: 2026-11-24 (Elaina's iPhone, Pages build; her tablet on the same Wi-Fi joined, and earlier the tablet
  could not reach the laptop's dev server at all: ERR_ADDRESS_UNREACHABLE)
- Environment: browser-hosted duel (ADR 0004), both devices on one home Wi-Fi
- Symptom: "Joining room ABCD..." forever; with Wi-Fi off on the iPhone it joined at once
- Root cause: most likely the router keeps Wi-Fi devices from reaching each other (client/AP isolation, or a
  guest or mesh band with its own addresses: the laptop moved between 192.168.0.x and 192.168.1.x). Then no direct
  path exists, and PeerJS's own free relay (turn:*.turn.peerjs.com, best effort) did not carry it. **unverified**
  (the router settings were not checked)
- Fix: the join now shows its steps and gives up after 20 s with advice (src/net/joinStatus.ts). Workaround: one
  device on mobile data. A real fix for strict networks is a relay (TURN) server of our own (ADR 0004 "revisit").
- How to verify: tests/joinStatus.test.ts; on the device, the line under "Joining room" changes and ends in advice
- Related: ADR 0004

### Crash when YEETREAPing the bot (or a player)
- First seen: 2026-11-22 (Elaina: "it crashed after I hooked the bot and tried to ultrareap")
- Environment: Windows 11, three r186, dev build, Duel vs bot
- Symptom: the crash screen; `uncaught: Cannot set properties of undefined (setting 'lastWeapon')`
- Root cause: the YEETREAP event's target is a target code (a dummy index, or PLAYER_CODE + a player index). The
  world's handler looked the code up in the dummy list to note the kill weapon: for a player that is `views[1001]`,
  undefined. The sim was right (tested); no test drove the world's handler with a player target. Online duels had the
  same bug, untried.
- Fix: note the kill weapon only for dummy codes (`e.dummy < PLAYER_CODE`) in YeetWorld's yeetreap handler.
- How to verify: `python tools/dev.py smoke --query "play&level=duel&bot=easy&botseed=1&yeetreap" --until YEET_MARK_yeetreap --timeout 60`
  (failed with the error above before the fix, passes after).
- Related: feat/bots
- Lesson: an event field holding "a dummy or a player" must be checked before it indexes a dummy list.

### Online duel: player 2's landings, pickups and bonks shown to player 1; the scythe hook would not drag
- First seen: 2026-11-22 (Elaina, laptop + tablet duel)
- Symptom: player 1 gets HERO LANDING with the camera kick, pickup and bonk messages when player 2 does them; a
  hooked player is not dragged along (they jitter back to where they stood).
- Root cause: each client's prediction sim steps every player, and stepped the other one with no input. (1) Its
  events (tagged with the other player's index) went to the world as your own; DuelLink.stepLocal only dropped hits.
  (2) With no input the other player's F was "released" every replayed step, so in the victim's copy the attacker let
  go of the hook straight away and each snapshot snapped the victim back.
- Fix: stepLocal keeps only events tagged with your slot; snapshots carry `held` (each player's last input, one-shot
  presses cleared, what the server repeats) and the predictor steps the other player with it. The attacker draws a
  hooked victim from its own prediction instead of the ~100 ms-behind snapshot buffer.
- How to verify: `tests/net.test.ts` "hooked by player 1, player 2's own prediction stays on the hook" (fails without
  the fix, with 100 ms lag each way); then a laptop + tablet duel.
- Lesson: anything the predictor steps that is not yours needs your best guess of its input, and its events are not yours.

### Smoke: "120 frames did not run within ... ms (the page froze?)" on play queries
- First seen: 2026-11-23, while adding browser-hosted duels
- Symptom: `smoke --query "play..."` without `--until` fails the 120-frame check; runs that wait for a marker pass;
  FRAME_TIMES mean ~660 ms (it was ~160 ms the day before).
- Root cause: not the code. The laptop was on battery (Win32_Battery status 1, discharging) with the i3-1215U held at
  1.2 GHz; smoke draws on the CPU (software WebGL), so frames ran ~4x slower and 120 of them missed the timeout.
  Found after a no-network run (`play&level=duel&bot=easy`) and plain `play` failed the same way.
- Fix: plug the laptop in before judging frame-count smokes (or use `--until <marker>` runs).
- How to verify: `Get-CimInstance Win32_Battery` (BatteryStatus 2 = on mains), then rerun the smoke.
- Lesson: when every scene gets slower at once, check the machine (power, clock speed, other load) before the code.

### Bots walk, shoot or launch themselves into the sea on Shark Island
- First seen: 2026-11-26, `tests/soloPlaytest.test.ts` "redirects island retreat controls toward solid ground ..."
  once respawn got slower (a 2.2 s respawn had hidden the fall from the end-state check).
- Symptom: a bot near the island shore gets a `sharkApproach` event (it is in the water) with no enemy touching it.
- Root cause: two separate things.
  1. The test fixture: `{ x: 17.5, z: 0 }` is open water (the island top is x, z in [-13, 13]; the east platform starts
     at x = 21). The bot was airborne from frame 0, so no movement rule could save it. Fixed 2026-11-27: the
     fixture now starts on the shore at x = 12.5. `tests/botFooting.test.ts` uses real shore starts too.
  2. The bot: the old redirect only checked where *walking* led. Found one at a time with a 576-run shore sweep
     (later 1152 runs x 10 s): a Boomstick launch toward the Gatling platform flies ~40 m and overshoots it; hip
     shots at an enemy inland push the shooter out to sea; a mid-air shot kicks twice as hard (`airRecoil`); a jump
     while still sliding turns friction's stop into a flight; a jump and a shot on the same step are an air shot;
     the redirect fed `keysFor` a raw 10 m delta (each key clamps, so it skewed toward the facing); and keys held
     while sliding above run speed only air-steer, so the bot could not turn.
- Fix: `src/core/yeet/botFooting.ts` predicts where a shot's recoil or a jump leaves the bot (same kick, hop, tumble
  pop, gravity, drag and friction as the sim); `BotBrain.keepFooting` drops a jump or shot that ends in the water.
  The redirect normalises its direction and lets go of the keys while sliding above run speed.
- How to verify: `tests/botFooting.test.ts` (its six shore runs fail on the old bot). Remaining falls in the sweep
  all follow a target dummy's shot (`dummiesFight`): being knocked off is the level, not a steering bug.
- Lesson: a test that only checks the end state can be passed by a respawn; assert on events. And check that a
  fixture's start position stands on something before debugging the AI.
