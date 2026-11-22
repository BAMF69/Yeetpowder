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
