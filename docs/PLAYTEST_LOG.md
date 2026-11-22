# Playtest Log

> One entry per session. Newest on top. Use `/playtest-report` to add entries and turn them into tasks.
> Playtest = anyone who is not you playing, or you playing with a specific question.

## Template (copy)
```
### YYYY-MM-DD  Build <version/commit>  Tester: <name or "self">  Duration: <min>
Question being tested: 
What happened (observations, not opinions):
- 
Quotes (exact words):
- 
Pain points (ranked):
1. 
Delight moments:
- 
Metrics (deaths per section, time to first success, quits):
- 
Decisions / tuning changes:
- 
Tasks created (ROADMAP):
- 
```

## Entries
### 2026-11-21  Build duel netcode first build (feat/reload bede7bb)  Tester: self (Elaina the Great)
Question being tested: (requests; multiplayer not tested yet: "I can't test multiplayer right now")
Quotes (exact words):
- "when you land after a reaper's kick backflip your character does a hero landing on one knee that takes a moment to stand up from"
- "make it so sakura dash firing allows you to travel upwards if you are looking up"
Decisions / tuning changes:
- Hero landing after a Reaper backflip: eye drops 0.7 m, no moving or jumping for 0.6 s; shooting and slashing still work
- Sakura dash-fire follows your aim upward (level when looking down). Side effect: it climbs to ~19 m, so the Sakura can reach Fight Back's Gatling tower (asked Elaina whether to keep it Boomstick-only)

### 2026-11-21  Build gunblade hold moves (feat/reload, uncommitted)  Tester: self (Elaina the Great)
Question being tested: Do the hold-F moves work?
Quotes (exact words):
- "the dash stance with the sakura has the blade bouncing around all crazy, not in a static hold position"
- "it shouldn't trigger an ultraslash if you don't dashfire or if you've slowed down to normal running/walking/stopped speeds. if you are still moving fast it should expend all your remaining ammo rapid fire"
- "yeetreap is awesome"
Delight moments:
- YEETREAP
Decisions / tuning changes:
- Bug fixed: the stance added its blade turn every frame instead of setting it (the bouncing blade)
- ULTRASLASH only after a dash-fire and while faster than 12 m/s (above a sprint); it rapid-fires every round left (one wide cut per round, 0.07 s apart, the last knocks hard), then the spin-reload

### 2026-11-21  Build gunblades first pass (feat/reload, uncommitted)  Tester: self (Elaina the Great)
Question being tested: Do the gunblades feel like the skill showcase?
Quotes (exact words):
- "the sakura rush is super satisfying"
- "the reaper's kick is super interesting and I think has the potential for some high skill gameplay"
- "both are fun"
- "if you hold F you can wrap the scythe around an enemy and then fire to do even more damage and trigger a yeetreap"
- "holding F with the katana allows you to execute a dash slash - the player holds the blade backwards and fires to propel themselves forwards and then if they still have at least 1 shot in the chamber when they release F it uses the last shot to perform an ultraslash"
Delight moments:
- The Sakura revolver-cancel rush
- Reaper's Kick flips: room for high-skill play
Decisions / tuning changes:
- F press still slashes at once; holding F past 0.2 s starts the new move
- Reaper hold F: hook the nearest dummy in front (3 m), pinned on the scythe; Fire = YEETREAP (heavy damage, launch); release = drop
- Sakura hold F: blade reversed (dash stance); each Fire propels you forward; release with a round left = ULTRASLASH (spends it)

### 2026-11-21  Build 8d10b5d + playtest-5 changes (feat/reload, uncommitted)  Tester: self (Elaina the Great)
Question being tested: (requests, not a play session)
Quotes (exact words):
- "if you fire the pea shooter or sniper while airborne the knockback and twist should double"
- "change \"copter heat\" to \"copter yeat\""
- "guns should have to reload - pistol can be 9 shots, shotgun 2, sniper 5, gatling 200. for now guns can have infinite ammo"
Decisions / tuning changes:
- Pea Pistol and Spin Doctor: airborne shots kick and twist x2. Their mid-air upward kick stays capped (pistol 1 m/s,
  Spin Doctor 4 m/s): uncapped, chained Spin Doctor floor shots climbed to 72 m, past the Boomstick-only tower
- HUD: COPTER YEAT
- Magazines: 9 / 2 / 5 / 200, infinite reserve; reload 1.0 / 1.4 / 1.8 / 3 s; reloads on its own after the last
  round or on an empty trigger; R reloads early; switching guns cancels a reload. Respawn moved from R to Backspace

### 2026-11-21  Build playtest-3 changes (uncommitted)  Tester: self (Elaina the Great)  Duration: a few minutes
Question being tested: Do the new aiming rules, tumbles and Fight Back work?
Quotes (exact words):
- "if you're holding right click you can zoom back in after the recoil animation without having to click it again"
- "add the ability to sprint for a few seconds by holding shift, firing while sprinting doubles your chances of a tumble"
- "add a tooltip when you're tumbling - \"Plant your feet to avoid getting blown off balance by YEETPOWDER\""
- "replace the landing page with the logo"
- "when scoped firing the spin doctor you should still spin around"
- "many of the gunshot sound effects seem late"
Pain points (ranked):
1. Gunshot sounds feel late
2. Zoom knock-out should come back on its own while right click is held
3. Scoped Spin Doctor should still spin
Decisions / tuning changes:
- Zoom comes back 0.45 s after a shot if right click is still held
- Sprint: Shift, 11 m/s for 3 s, refills after a short rest; firing while sprinting doubles the tumble chance; bonk threshold 9 -> 12 m/s so sprinting into a wall does not stun
- Tumble tip shown while tumbling (her words)
- Title screen is the logo (AI-generated art: logged A-0002, pre-generated)
- Spin Doctor aimed twist 0.15 -> 0.7 of hip
- Late sounds: files start within 1 ms and play the same frame as the shot; requested the lowest audio latency and log it; fixed clicks lost on frames with no sim step (monitors over 120 Hz). Not verified by ear

### 2026-11-21  Build 9d0186c (feat/toy)  Tester: self (Elaina the Great)  Duration: a few minutes
Question being tested: Do aiming, the visible kicks and the new sounds work?
What happened (observations, not opinions):
- A second arm appeared to stick out of the guns (bug: the right sleeve was always 1 m long).
Quotes (exact words):
- "it now looks like theres a second arm sticking out of the guns"
- "the pistol should still have more kickback"
- "I don't like the kickback reduction of the scoped in shots ... make sense from a physics standpoint - if hip firing causes your body to swing around to the right then when you're scoped in and the gun is more centered, the blowback doesn't twist you as much"
- "I want there to be a penalty for run-and-gunning so if you fire while moving theres a chance it will send your body spinning - blow the camera out to third person and watch yourself tumble. except for the gatling copter firing while zoomed in should force you out of zoomed mode"
- "keep the current level as a sandbox level and make another level where the target dummys fight back and you only start with pistol and shotgun. you can find the sniper on the ground and you can find the gatling cannon up on a platform you can only access using the shotguns kickback"
Pain points (ranked):
1. Extra arm through the guns (bug)
2. Aimed shots lose too much push; should differ by physics (twist), not by strength
3. Pea Pistol kick still too small
Delight moments:
- (none noted this round)
Metrics (deaths per section, time to first success, quits):
- not recorded
Decisions / tuning changes:
- Sleeve bug fixed (shared scratch vector normalized in place)
- Recoil model: every hip shot twists you right (the gun sits right of your centre); aimed shots keep the full push with little twist; spread stays tighter when aimed
- Pea Pistol recoil up; mid-air pistol shots push less (hover-skip, GDD) so the pistol cannot climb to the Gatling platform
- Run-and-gun: firing while moving fast may knock you into a tumble (third-person camera; first person with reduce motion). The copter is exempt; firing it knocks you out of zoom instead
- New level "Fight Back" (Play) beside the old room (Sandbox): dummies shoot back, start with pistol + shotgun, sniper on the ground, Gatling on a platform only a Boomstick launch reaches
Tasks created (ROADMAP):
- Replay both levels after these changes

### 2026-11-21  Build toy + playtest-1 changes (uncommitted)  Tester: self (Elaina the Great)  Duration: a few minutes
Question being tested: Do the stronger recoil and the visible arms and legs sell the launches?
What happened (observations, not opinions):
- The Boomstick launch with arms and legs flung into view landed.
- The Pea Pistol hand vanishes the instant it fires and then lowers back in; the kick itself is never seen.
Quotes (exact words):
- "hahaha the shotgun is amazing"
- "please add the ability to right click aim to every gun"
- "the pistol should push the player back some and I cant see the hand kick back, it just disappears on firing then lowers back into screen"
- "the gatling copter should be harder to aim and cause the player to rotate right when firing"
- "is there any sound?"
Pain points (ranked):
1. Pea Pistol: no push on the ground, and the blowback is too fast to see
2. Gatling Copter too easy to aim; should turn the player right while firing
3. No aim-down-sights
4. No sound (the toy has none yet)
Delight moments:
- The Boomstick launch
Metrics (deaths per section, time to first success, quits):
- not recorded
Decisions / tuning changes:
- Right click = aim on every gun (zoom, gun to centre, Spin Doctor scope). The GDD had right click as melee: melee moves to F when it arrives
- Pea Pistol: a grounded shot adds a small upward hop so the push carries (the GDD's "small hop backward"); blowback slowed so the arm is seen whipping up, with a wrist flip first
- Gatling Copter: turns you right while firing (yaw torque) and wobbles your aim
- Sound: answered "none yet"; offered placeholder sounds made in code
Tasks created (ROADMAP):
- Replay after these changes

### 2026-11-21  Build toy (uncommitted, after 3c229d3)  Tester: self (Elaina the Great)  Duration: a few minutes
Question being tested: Does launching yourself with recoil feel hilarious within 30 seconds?
What happened (observations, not opinions):
- Played the gray-box room with all four guns.
Quotes (exact words):
- "all the kickbacks are too weak"
- "it will really help sell the effect if you can see the shooter's hands"
- "the pea shooter should blow their hand all the way back behind their head"
- "the shotgun and gatling copter should have twice as much backward force"
- "when the shotgun is fired the shooters hands and legs should swing forwards into view as the player is thrown backwards"
Pain points (ranked):
1. Recoil too weak on every gun (tunables: weapons.*.recoil, copter.thrust)
2. No body in view, so the kick does not read (viewmodel: hands, legs)
Delight moments:
- (none noted yet)
Metrics (deaths per section, time to first success, quits):
- not recorded
Decisions / tuning changes:
- Boomstick recoil 15 -> 30 and copter thrust 26 -> 52 (x2, as asked); Pea Pistol 4.2 -> 7.5 and Spin Doctor 10 -> 16 (Claude's pick for "all too weak")
- Ground slide friction 16 -> 30 so a doubled Boomstick shot stays near the GDD's ~25 m per shot; walls drawn to 24 m since floor launches now clear 12 m
- First-person arms (white gloves, teal jumpsuit sleeves) hold every gun; Pea Pistol shot blows the gun hand up and back over the head; Boomstick shot flings both arms and both legs forward into view
Tasks created (ROADMAP):
- Replay after these changes; next notes decide the following tweak

