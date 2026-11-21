# Handoff

> Rewritten at the end of every session by `/end-session`. Read first by `/start-session`.
> Keep under ~60 lines. It is a baton, not a diary.

**Last updated:** 2026-11-21
**Branch / commit:** (fill in)
**Engine version:** see `docs/ENGINE.md`

## Where we are
The toy is playable (Toy tier, nothing committed yet for it). One gray-box room: Pea Pistol, Boomstick, Spin Doctor and a Gatling Copter prototype, five target dummies that get knocked flying and respawn, wall-bonk stun with stars, comic pops, kill feed. After playtest 1: recoil raised (Boomstick and copter x2), first-person arms and legs with per-gun recoil poses. After playtest 2: right-click aim (braced fire vs full-yeet hip fire, Spin Doctor scope), Pea Pistol hop + visible blowback, copter turns right and wobbles. check, test (278) and smoke pass.

## What changed last session
- Built the toy: engine-free sim in `src/core/yeet/` (tuning, arena, sim, autoplay) with 16 tests; the play world `src/game/YeetWorld.ts` plus `src/game/yeet/` visuals and `src/game/fpsInput.ts`; `?play` in `src/shell/app.ts`; removed the kit's `src/game/Game.ts` prototype.

## Current task
- ROADMAP Now: playtest and tune the toy.

## Next step (specific, first action)
- Elaina plays it (`python tools/dev.py run`, click to lock the mouse) and pastes notes; run `/playtest-report`, then tune `src/core/yeet/tuning.ts` one change at a time.

## Open questions / decisions pending
- Copter now climbs ~100 m in 5 s at full thrust: watch whether hovering still works in play.
- The aimed-vs-hip numbers (TUNING.aim.braced) are Claude's pick: confirm in play.
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
