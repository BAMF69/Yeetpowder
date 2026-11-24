# Yeetpowder: Game Design Document

> Living document. Short beats complete. Update with `/gdd-sync` when reality diverges from this page.
> Last reviewed: 2026-11-22
>
> The author's full design doc (weapons, gunblades, killstreaks, modes, maps, netcode, art brief) is
> `docs/concept/Yeetpowder Game Design Doc.pdf` (newer Markdown export with Lore and Future systems:
> `docs/concept/Yeetpowder Game Design Doc.md`), with concept art and keyframes beside it in `docs/concept/`.
> This page is the kit's working summary of it. Where they differ, this page wins for scoping; the PDF is the long-term vision.
> Author: Elaina the Great *(from the PDF byline)*

## Identity
- **Working title:** Yeetpowder
- **One-line pitch:** A silly first-person party shooter where every gun's recoil throws you across the map, playable in a browser with no download and no account.
- **Genre:** Arena party FPS / physics comedy
- **Perspective:** 3D first person. On big launches and hero landings the camera briefly kicks out to a dramatic third-person angle, then snaps back (C toggles the launch pops, reduce motion turns all of it off). Third person also shows tumbles and knockouts, and will show replays. No permanent third-person mode.
- **Reference games (2 to 3) and what you borrow from each:** GoldenEye 64 / Perfect Dark for arena feel, weapon variety and map pickups; Quake for rocket jumping; Gang Beasts for physical comedy; Krunker.io for instant browser play. Original art and designs only: the feel, not the assets.
- **The twist:** Newton's third law turned up to eleven. Firing *is* moving: pistols nudge, shotguns launch, snipers spin.
- **Lore (design doc export):** yeetpowder is a cheap new propellant that burns hot pink and kicks far harder than guns were built for. Stuffers load it into ordinary guns (every standard gun launches you); Smiths forge new weapons that channel it (the gunblades). Every muzzle flash, explosion and smoke puff is pink (lime green is the backup).

## Pillars (3 max)
Pillars decide arguments. If a feature does not serve one, it goes to the Parking lot.
1. **Every shot is a move, easy to pick up and deep to master**: firing is how you travel, dodge and get into trouble. Anyone can flail and score; skilled players chain recoil into precise aerial routes. Rules out guns whose recoil does not matter, and movement tech that only experts can trigger at all. *(The PDF's pillars 1 and 4, merged at the author's request.)*
2. **Funny first**: failure is a laugh. Getting blasted into a wall by your own shotgun is a highlight, not a punishment. Rules out harsh penalties for self-launch accidents, gore, and grim realism.
3. **Instant play**: from a shared link to a live match in under 15 seconds, no sign-up. Rules out accounts, big downloads (under 15 MB to first match), long loading and app stores.

## Core loop
```
aim and fire -> get launched, tumble, bonk -> land a hit or a funny wipeout -> pick the next shot (move, fight or escape) -> back to aim and fire
```
Time per loop: 2 to 5 seconds. The fun must be present in this loop before anything else gets built.

| Scale | What the player does | Why they keep going |
|---|---|---|
| Every ~30 seconds | Launches across the map, grabs a gun pickup, gets or gives a kill | The next launch might be the funniest yet |
| Every ~10 minutes | Plays two 5-minute matches, earns killstreaks, sees "Yeet of the Match" | Rematch with friends, map vote, chase the top of the scoreboard |
| Whole session | A party night of rooms and modes from one shared link | Laughing with friends; learning recoil routes |

## Player fantasy and target audience
- Fantasy: a cartoon action hero whose guns are rocket boots. Pinballing off walls, flipping over enemies, surviving ridiculous launches.
- Audience: friend groups, streamers and party nights wanting a quick, chaotic game shared by link. Ages 13+, cartoon violence.
- Comparable games and what we do differently: Krunker.io (instant browser FPS) but movement *is* the guns; Gang Beasts (physical comedy) but readable and competitive; GoldenEye (couch arena) but online by link, with phones and computers in the same match.

## Scope tiers
| Tier | Contents | Done means |
|---|---|---|
| **Toy** | Single player, one gray-box test room. Pea Pistol, Boomstick (shotgun) and Spin Doctor (sniper), each with its own recoil force and spin. A Gatling Copter prototype (fire down to hover wobbly, overheat, crash landing). Target dummies built from shapes that get knocked flying when hit. Wall-bonk stun (~0.5 s, cartoon stars). Recoil values in one tunables file. Keyboard + mouse. | Launching yourself feels hilarious within 30 seconds; someone wants to keep playing for 2 minutes |
| **Vertical slice** | The PDF's "Duel": 2 players online (one authoritative room, run by the host's browser since ADR 0004, client prediction), a shared room link, phone vs. laptop, three duel modes (first to 5, timed, Ring Out), both gunblades, art pass on one small room, the guns and the operative, first sounds and music (docs/VERTICAL_SLICE.md) | Smooth on phone vs. laptop over normal Wi-Fi; looks and feels like the final game |
| **MVP / Release** | The PDF's "Party": up to 8 players, all six guns, one real map (Bunker Bonkers suggested), Free-for-all, bots filling empty slots, kill feed, touch controls | Passes `/release-check` |
| **Stretch** | The other killstreaks, Team Yeet / Hot Potato, party modifiers, maps 2 and 3, "Yeet of the Match" replay, PWA, public playtest | Only after release scope is locked |

Current tier: **Vertical slice**

Claude scopes work by this line (SOP-08 "Tiers"). Move it with `/next-tier` when the tier's "Done means" is met.

## Content list (MVP)
| Item | Count | Status |
|---|---|---|
| Levels / areas | 1 release map | Sandbox, Fight Back and the Duel room playable in the painted look; release map pending |
| Enemies / obstacles | Multiplayer opponents, fill-in bots, walls for bonks | Shooting dummies, wall bonks and 2-player duels (first build, not yet played by two people) playable; fill-in bots pending |
| Player abilities | 6 guns, run, jump, melee slash | Pea Pistol, Boomstick, Spin Doctor, Gatling Copter, Reaper's Kick and Six-Shot Sakura, run/jump/sprint and slash playable. The design doc's Buzz SMG, Rocket Yeeter and Plunger Cannon are not built (decide at MVP whether "6 guns" means those) |
| Music tracks | 1 to 2 (surf-rock / spy-jazz) | 1 match loop made in code (surf / spy chiptune, 34 s); a menu track pending |
| SFX sets | Guns, launches (slide whistle), bonks, crowd "ooooh", announcer | Guns, launches, impacts, gunblades, crowd (ooh, cheer, aww) and the yeetpowder fizz made in code; sound captions on; announcer lines written and wired, voices pending |

## Systems overview
| System | One line | In the vertical slice? |
|---|---|---|
| Recoil movement | Each shot applies an impulse opposite the aim, plus camera/body spin; added on top of normal run/jump; limited air control | yes |
| Hip vs aimed fire | Same push either way. Hip fire twists you right (the gun sits right of your centre); aimed, the gun is centred: little twist, tight spread. Firing any gun but the Gatling Copter knocks you out of zoom for the recoil (0.45 s), then back in if you still hold right click; a scoped Spin Doctor shot still spins you *(playtests 3, 4)* | yes |
| Magazines | Pea Pistol 9, Boomstick 2, Spin Doctor 5, Gatling 200; reserve infinite for now; auto reload when empty, R to reload early *(playtest 5)* | yes |
| Airborne kick | Pea Pistol and Spin Doctor shots in mid-air kick and twist twice as hard (upward kick capped, so the Gatling tower stays Boomstick-only) *(playtest 5)* | yes |
| Sprint | Shift: 11 m/s for 3 s, refills after a rest; firing while sprinting doubles the tumble chance *(playtest 4)* | yes |
| Run-and-gun tumble | A shot fired while moving may knock you into a tumble (no control; the camera pops out to third person to watch). Chance grows with speed and recoil, halves when aimed; the copter never tumbles you (Elaina's call) *(playtest 3)* | yes |
| Levels | Shark Island, Industrial Yard and Junkyard (first builds 2026-11-24, placeholder props: water knockouts, exploding vehicles, car stacks); Sandbox (the open test room, every gun), Fight Back (dummies shoot back; start with Pea Pistol + Boomstick; Spin Doctor on the ground; Gatling Copter on an 11 m tower only a Boomstick launch reaches) *(playtest 3)* and the Duel room (30 x 30 m, two spawns, Gatling and gunblade pickups) | yes |
| Wall bonk | Impact above a speed threshold stuns ~0.5 s with a splat; no damage unless "Hard Walls" | yes |
| Weapons | Per-gun recoil force, spin, damage, fire mode; map pickups, spawn with pistol; explosives since 2026-11-24: Rocket Launcher, Grenades and the Rocket Axe gunblade (projectiles, blasts, rocket jumps) | 3 standard guns + the Gatling Copter as one rare pickup (Elaina) |
| Hit knockback | Being shot pushes you too | yes |
| Health and damage | Cartoon damage, respawn | yes |
| Ragdoll-lite | Tumble/flail animation over a physics capsule; full ragdoll only on death (client-side) | yes |
| Multiplayer | Server-authoritative rooms on this PC (`ws`, ADR 0002), client prediction, the other player ~100 ms behind; first build 2026-11-21 (`npm run duel`) | yes (2 players) |
| Killstreaks | Temporary super weapons earned by kill chains | no (Gatling Copter prototype in the toy only) |
| Gunblades (Smith weapons in the Lore) | Reaper's Kick and Six-Shot Sakura: recoil-powered melee movesets (see the PDF), F to slash, keys 5 and 6; rare pickups in Fight Back, always available in the Sandbox; exempt from run-and-gun tumbles. Reaper's Kick flips: aimed 30+ degrees down = the big backflip, which ends in a hero landing (a moment on one knee); otherwise you flip the way you mainly travel as you see it (faster sideways than forward or back = cartwheel) *(Elaina, 2026-11-22)*. Other players' flips, cartwheels, slashes and look direction show on their figures. Hold F: Reaper's Kick hooks an enemy (Fire = YEETREAP: heavy damage and a launch); the Sakura reverses its blade (each Fire dashes you along your aim, upward too; releasing after a dash-fire while still faster than a sprint = ULTRASLASH, rapid-firing every round left) *(Elaina, 2026-11-21)* | yes (both) |
| Bots | Easy, medium and hard bots that play like people: full players (same guns, recoil, tumbles, ammo) whose brain only presses player controls; difficulty is reaction time, aim steadiness, gun choice, planting feet, side-stepping and travelling by Boomstick floor launch (TUNING.bot). Offline Duel vs bot from the menu; guns only for now, gunblades next; later they fill empty online slots *(Elaina, 2026-11-22)* | yes (duel vs bot) |
| Modes, replay, touch controls | See the PDF | no |

## Controls
| Action | Keyboard/Mouse | Gamepad |
|---|---|---|
| Move | WASD | Left stick |
| Aim | Mouse | Right stick |
| Fire / recoil | Left click | Right trigger |
| Aim (braced: same push, less twist, tighter spread) | Right click (hold) | Left trigger |
| Jump | Space | A |
| Melee / gunblade slash | F (was right click: moved for aiming, playtest 2) | Right bumper |
| Gunblades | 5 Reaper's Kick, 6 Six-Shot Sakura | |
| Sprint (a few seconds) | Shift (hold) | |
| Reload | R | |
| Respawn (toy) | Backspace (was R) | |
| Switch weapon | 1–6 / wheel | Y |
| Launch camera on/off | C | |
| Killstreak | Q | Left bumper |

Keyboard/mouse controls are implemented except the killstreak (Q); gamepad bindings are planned.

Touch (MVP): left virtual stick, drag right half to aim, Fire / Jump / Slash buttons, tap weapon icon. Light aim assist for touch. Full table in the PDF.

## Tunables that define feel
Per weapon: recoil force, spin, fire rate, damage. Global: gravity, run speed, jump height, air control, wall-bonk speed threshold and stun time, hit knockback scale, Gatling Copter lift / tilt / heat rate.
Targets from the PDF: no single shot moves a player more than ~25 m; two Boomstick blasts in a row cross a medium room; the Spin Doctor leaves its user disoriented for ~1 s.
These live in data, not code. File: `src/core/yeet/tuning.ts` (one module; Vite hot-reloads it while `dev.py run` is open).

## Art and audio direction
- **Visual target:** N64-inspired spy action, using the keyframes in `docs/concept/keyframes/` as the primary visual reference. Angular low-poly people, painted surface detail, industrial architecture and restrained lighting. Match the reference at gameplay distance; literal N64 hardware limits are not required.
- **Character design:** Human-proportioned operatives with strong angular faces, chunky hands and boots, simple hair, tactical vests and utility clothing. The navy operative and olive guards in the keyframes establish the direction. The toy's stubby figures with helmets and goggles are placeholders, not the final character brief.
- **Environment:** Concrete bunkers, steel doors, warehouses, shipping containers, tanks, catwalks, chain-link fences and wooden crates. Use modular geometry and repeating painted textures for grime, rivets, seams and grates. Maintain clear routes, ledges and silhouettes for recoil movement.
- **Palette:** Muted navy, olive, concrete gray, rusty brown and worn teal; yellow hazard markings and warm lights provide accents. Hot-pink yeetpowder muzzle flashes, tracers and impact puffs (the Lore; built 2026-11-22), readable pickups and accessible team identifiers stand out against the subdued scenery. Identify teams through shape or symbols as well as color.
- **First art pass (2026-11-22):** the rooms now use painted textures made in code (`src/game/yeet/paint.ts`): concrete walls with the orange band and steel doors, a dark floor, a ceiling with fluorescent panels, wooden crates, teal steel cover and hazard trim; dark interior lighting. Rooms have a solid ceiling at 24 m (ceilings stop you without a bonk). Art passes 2 and 3 (same day): first-person arms and all six guns modelled in code to the keyframes, and the third-person operative (segmented, painted face, vest, fingerless gloves) for your body and duel opponents. The target dummies are still the toy figures. Next: the art approval comparison against the shotgun keyframe.
- **Shading and textures:** Small painted color textures, selectively hard edges and simple lighting. Preserve readable faces and silhouettes. Avoid making untextured flat colors, heavy outlines or glossy materials the default look. Start with softly filtered textures; tune filtering against the keyframes in engine.
- **Asset budgets:** Fewer than 6,000 exported triangles per character, including clothing and accessories but excluding the separately budgeted held weapon. Start with a 256×256 character color atlas; allow 512×512 only when close-view readability justifies it. Starting targets: 300–2,500 triangles per held weapon and 12–200 per simple prop. (Raised 2026-11-22 from 2,000 and 1,200 by Elaina: the keyframes are "N64-inspired HD", more detailed than real N64 models; the look stays faceted with painted textures.) These are production targets, subject to gameplay and mobile profiling. Generic pipeline hero/NPC presets do not override this game's budget.
- **Asset workflow:** Create clean, consistent A-pose references from the approved character design; generate or model the character without a weapon. Build weapons separately so they can swap, recoil and animate. Use the existing Bozzetto/Blender pipeline for drafts, cleanup, UVs, rigging and GLB export. Prefer a reusable modeled kit for industrial scenery. Inspect silhouettes, hidden surfaces and shoulder/elbow/hip/knee deformation before accepting generated characters. Record asset sources and licenses in `ASSET_LOG.md`.
- **Art approval:** First match the shotgun corridor keyframe with one operative, one separate shotgun and a small modular room. Compare proportions, palette, texture scale and lighting in game, then inspect the character during a launch and tumble. Approve this sample before producing the full asset set. This defines the vertical-slice art target; it does not advance the current scope tier.
- **Tone and effects:** Physical comedy comes from absurd recoil, flips, bonks and reactions within the spy-action setting. Oversized muzzle flashes, speed trails, comic "BLAM!" / "YEET!" pops and bonk stars remain readable accents. No blood or gore. UI uses chunky, readable controls and kill-feed verbs "YEETED", "BONKED", "REAPED".
- **Camera:** First-person play; third person for tumbles and knockouts; a big launch (18 m/s or more) kicks the camera out to your right, low, for ~0.7 s (at most every 6 s, never while zoomed, never for the Boomstick, whose first-person legs sell it; C toggles); a hero landing always pops out for the kneel; reduce motion turns all of it off *(playtests, 2026-11-22)*. Replays remain planned; preserve the motion-reduction option as the presentation develops.
- **Music:** Surf-rock and spy-jazz. The first match loop is a chiptune written in code (`tools/audio/yeet_music.py`: a tremolo-picked surf melody and a walking-bass spy bridge, original); a menu track and stingers come later.
- **SFX:** Punchy exaggerated guns, slide-whistle launches, crowd "ooooh" for airtime and comic impacts. Made in code: `tools/audio/yeet_sounds.py` (guns, impacts and a pink yeetpowder fizz on every shot) and `tools/audio/crowd.py` (the crowd: "ooooh" after 1.1 s of airtime, cheers on knockouts, hero landings and YEETREAPs, "awww" on your wipeouts) → `public/assets/audio/sfx/`, events in `data/audio_events.json`. Sound captions follow the access setting. The announcer's lines are in `data/dialogue.json` and play once voice files exist: Elaina records them, `tools/audio/announcer.py` brings them in (trim, level, optional PA and arena echo).

## First-time user experience (FTUE, from E05 in `docs/EVIDENCE.md`)
| Lesson | Mechanic taught | How we know they got it |
|---|---|---|
| 1 | Fire the pistol: you hop backward | They fire a few times and move with it |
| 2 | Aim at the floor with the Boomstick to launch up to a ledge | They reach the high ledge |
| 3 | Shoot a dummy; recoil + knockback scatter you both | They knock a dummy off something |

## Platform and engine target
- Engine: see `ENGINE.md` (web-3d: Three.js + TypeScript + Vite). Later layers suggested by the PDF: Rapier (WebAssembly physics) and Colyseus (Node.js rooms over WebSockets). Storefront: web, shared by link (itch.io or own host).
- Input: keyboard + mouse for the toy; controller and touch later (phones and computers share matches).
- Languages: English only *(Claude's pick)*.
- Performance budget: 60 fps on a 3-year-old mid-range phone; under 15 MB to first match.

## Kit tools for this game
| Tool | Why (the part of the plan that calls for it) | Tier |
|---|---|---|
| `/game-feel` | Launches, screen shake, bonks and hits must feel punchy | Toy |
| `/shader` | Painted low-resolution textures, simple lighting and selective hard edges matched to the keyframes | Vertical slice |
| `docs/sop/SOP-20-accessibility.md`, `tools/access/colour_check.py` | Colorblind-safe team colors, reduced camera-spin option, subtitles | Vertical slice |
| `/asset-intake`, Wavesmith (`tools/audio/wavesmith/`) | Free model packs; sounds and music made in code | Vertical slice |
| `/game-ai` | Bots fill empty slots so a match always feels busy | MVP |
| `python tools/dev.py ship` | Share a link to play (SOP-06 "Putting it online") | MVP |

## Assumptions to test (feeds the vertical slice)
| Assumption | How we will know (observable) |
|---|---|
| Recoil movement is fun on its own | A player keeps launching around the empty test room for fun, unprompted |
| The sniper's spin is funny, not nauseating | Playtesters laugh rather than look away; if not, lower the spin |
| The Gatling Copter's wobbly steering is fun, not frustrating | A player can hover over a chosen dummy within a few tries |
| The art style works | Players read who is who mid-air at a glance |

## Risks and unknowns
| Risk | Why it matters | How we test it cheaply |
|---|---|---|
| Online sync of big impulses on phones | Core of the Duel tier; bad netcode kills a movement game | Two browsers on one Wi-Fi at the Duel tier, before any content |
| Motion sickness from spin and camera kick-out | Could drive players away | Reduced-spin option and playtest feedback from the toy on |
| Phone performance (60 fps, under 15 MB) | Instant play and crossplay depend on it | `dev.py smoke` frame times and build size at every tier |

## Out of scope (explicit)
- The other killstreaks (beyond the Gatling Copter), and modes beyond the duel's three and Free-for-all
- Maps 2 and 3, "Yeet of the Match" replay, map vote, party modifiers
- Accounts, monetization, app-store builds
- Permanent third-person camera

Open questions from the PDF (decide when they come up): wall bonks hurt by default or only with "Hard Walls" (current: no damage); touch-only lobbies or always mixed; free with cosmetics, one-time price or hobby; domain availability; GoldenEye-style pickups vs. chosen loadouts (current: pickups).
