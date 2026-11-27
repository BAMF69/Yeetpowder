# Story & Tutorial Campaign: "Brace Before You Blast"

> Design draft, 2026-11-27. Not yet scheduled: the current tier is Vertical slice, so building this
> goes through the Parking lot / `/next-tier`. Answers the GDD's open lore questions with *proposals*
> for Elaina to accept, change or cut. Pillars check: every level teaches one shot-as-move skill (P1),
> failure is the joke (P2), each level is under 3 minutes and skippable (P3).

## The story in one paragraph
Yeetpowder was discovered by accident at **Pinkwell Munitions**, a failing gunpowder plant on Shark
Island, when night-shift janitor **Dot Kowalczyk** swept spilled saltpetre into a vat of bubblegum
dye. Pinkwell's CEO, **Mr. Grandall Pinkwell**, patented it, flooded the market and shut every rival
factory. Nobody told the customers it kicks ten times harder. The player is a **new hire at Pinkwell's
"Recoil Safety Certification" programme** (a liability dodge: sign the waiver, survive the course).
Dot, now the grumpy course instructor nobody credits, talks you through it over a crackly PA. As you
progress you learn Pinkwell is stockpiling a batch so strong it will fling the island itself, and that
the **Stuffers** (cheap, taped guns) and **Smiths** (forged gunblades) are two worker crews he's
playing against each other. The finale: you and Dot ride the Gatling Copter into the plant's core and
yeet Pinkwell out of the Coliseum he built to sell the stuff. Funny-first tone throughout: no gore,
every death is a "certification failure" stamp.

**Proposed answers to the open questions:** discovered by Dot (accident); sold by Pinkwell Munitions;
Stuffers and Smiths are worker crews, not enemy armies, so they can become optional team colours later.

## How a level is built
Each level = **one new verb + one story beat + one funny failure**.
- Intro (≤10 s): Dot's PA line, a warning poster that names the verb ("BRACE BEFORE YOU BLAST").
- Practice room: the verb with zero risk (fall into foam, instant retry).
- Test: a short course or fight that needs the verb, timed with 3 medals (Certified / Overqualified / Yeetmaster).
- Story reward: an audio log, a poster, or a Pinkwell memo found at the end, *never* a cutscene longer than 15 s.
- Failure: a rubber "FAILED" stamp slams the screen and the retry is instant. Funniest failures get saved as a
  mini "Yeet of the Level" clip (reuses `HighlightRecorder`).

## Act 1: Orientation (Pinkwell Training Wing, gray-box room reused)
| # | Level | Mechanic taught | Weapon | Story beat |
|---|---|---|---|---|
| 1 | **Sign Here** | Walk, jump, look, pick up | none | Waiver signing; Dot: "Initial where it says 'not Pinkwell's fault'." |
| 2 | **Little Nudges** | Hip fire pushes you opposite your aim; shoot down to hop | Pea Pistol | First poster: the recoil arrow. Dot mentions she "invented this stuff. Allegedly." |
| 3 | **Brace Yourself** | Right-click aim = braced fire (less kick, more accuracy) vs full-yeet hip fire | Pea Pistol | Targets are Pinkwell's competitors' logos. |
| 4 | **Reload Discipline** | Magazines and reload timing while airborne | Pea Pistol | Memo: "Ammo budget cut 90%. Ammo costs 90% less. Balanced!" |
| 5 | **Dummy Day** | Knock dummies flying, wall-bonk stun, comic pops | Pea Pistol | Dummies wear Pinkwell's face. Dot is *not* sorry. |

## Act 2: The Stuffers (Industrial Yard)
| # | Level | Mechanic taught | Weapon | Story beat |
|---|---|---|---|---|
| 6 | **Boomstick 101** | Shotgun self-launch; shoot the floor to clear a gap | Boomstick | Meet the Stuffers' foreman, who tapes guns together on the conveyor. |
| 7 | **Pinball Wizard** | Bounce off walls on purpose; chain two blasts mid-air (airborne x2 kick) | Boomstick | Find a crate labelled BATCH 0: "DO NOT LOAD." |
| 8 | **Run and Gun** | Firing while running can tumble you; how to recover | Pea Pistol + Boomstick | Pinkwell PA ad interrupts Dot. |
| 9 | **Spin Cycle** | Spin Doctor twist; scope to steady; zoom knock-out | Spin Doctor | You snipe a Pinkwell drone filming the trainees. Why is he filming? |
| 10 | **Fight Back** (existing level) | Shooting dummies, pickups, choosing a gun for the situation | all three | Dummies now shoot back: Pinkwell "upgraded" the course. |

## Act 3: The Smiths (Junkyard)
| # | Level | Mechanic taught | Weapon | Story beat |
|---|---|---|---|---|
| 11 | **Grenade Arc** | Aimed vs hip throws, the trajectory guide, 8 m blast, blast-jumping | Grenade | The Smiths' forge is hidden in the scrap. |
| 12 | **Hold the Line** | Yeet Shield: frontal block, halved knockback; flanks are open | Shield + Pea Pistol | Smiths test shields on you. "Good. You only died a bit." |
| 13 | **Patch Up** | Carried health uses, 3 s heal, cooldown, map packs | Health pack | Smith medic: Pinkwell sold them faulty barrels; they're why gunblades exist. |
| 14 | **Reaper's Hook** | Gunblade slash, hook, Yeetreap | Reaper | You're handed a forged blade. The Smiths want you inside the plant. |
| 15 | **Sakura Dash** | Dash and ultra; combine with gun recoil for routes | Sakura | Dot and the Smiths' leader turn out to be old friends. Plan forms. |

## Act 4: The Plant (Shark Island → Coliseum)
| # | Level | Mechanic taught | Weapon | Story beat |
|---|---|---|---|---|
| 16 | **Shark Week** | Ring Out: knockback, water hazards, sharks | any | Sneak onto Pinkwell's island past the "security" sharks. |
| 17 | **Free Sample** | Bot fight on Party layout, pickups respawning, score target | loadout choice | Stuffers and Smiths fight each other; you can stop them only by out-yeeting both. |
| 18 | **Copter Up** | Gatling Copter: hover by firing down, overheat, crash landing | Gatling Copter | Steal Batch 0's prototype gatling. It flies. Obviously. |
| 19 | **Grand Opening** (boss) | Everything: Pinkwell in a mech-ish recoil rig, three phases (pistol, shotgun, copter) on the Coliseum rings | all | Ring him out of his own arena. Dot finally gets the credit on a giant pink sign. |

**Epilogue:** a short card unlocks Party/Quick Play framed as "Certified. Now go yeet your friends."

## Tutorial rules (keep it Instant Play)
- Online/Quick Play is never locked behind the campaign. Level 1–3 are offered once as a 90-second
  "Basic Certification" from the main menu; everything else is optional.
- One prompt on screen at a time, showing the *player's* bound key (keyboard, touch, gamepad via the shell's prompts).
- Teach by space, not text: a gap you can only cross with a downward shot says more than a tooltip.
- Every hard skill has a fallback route so flailers still finish (P1: easy to pick up, deep to master);
  medals reward the expert route.
- Dot's lines are short subtitles (captions system), skippable, ≤ 2 lines.

## Build cost and reuse
Reuses: arena/level system, dummies and bots (`src/core/yeet/`), Party maps, Coliseum, HighlightRecorder,
captions. New: a level-script runner (objective, triggers, medal timer), ~20 PA lines, poster decals.
Suggested prototype order: levels 2, 6, 9 (the three core recoil verbs) as a mini-campaign to playtest
before writing the rest.

## Open questions for Elaina
1. Keep the player silent, or a named character?
2. Is Pinkwell the right villain tone (corporate cartoon), or should the threat be the powder itself?
3. Voice acting for Dot, or text + gibberish voice (cheaper, funnier, smaller download)?
4. Should Stuffers vs Smiths become a team mode once the story establishes them?
