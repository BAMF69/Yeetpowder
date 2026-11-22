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
