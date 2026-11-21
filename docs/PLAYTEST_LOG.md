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

