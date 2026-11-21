# Yeetpowder: Game Design Document

> Living document. Short beats complete. Update with `/gdd-sync` when reality diverges from this page.
> Last reviewed: 2026-11-21
>
> The author's full design doc (weapons, gunblades, killstreaks, modes, maps, netcode, art brief) is
> `docs/concept/Yeetpowder Game Design Doc.pdf`, with concept art and keyframes beside it in `docs/concept/`.
> This page is the kit's working summary of it. Where they differ, this page wins for scoping; the PDF is the long-term vision.
> Author: Elaina the Great *(from the PDF byline)*

## Identity
- **Working title:** Yeetpowder
- **One-line pitch:** A silly first-person party shooter where every gun's recoil throws you across the map, playable in a browser with no download and no account.
- **Genre:** Arena party FPS / physics comedy
- **Perspective:** 3D first person. On big launches the camera briefly kicks out to a dramatic third-person angle, then snaps back (option to turn it off for motion-sensitive players). Third person is also used for replays. No permanent third-person mode.
- **Reference games (2 to 3) and what you borrow from each:** GoldenEye 64 / Perfect Dark for arena feel, weapon variety and map pickups; Quake for rocket jumping; Gang Beasts for physical comedy; Krunker.io for instant browser play. Original art and designs only: the feel, not the assets.
- **The twist:** Newton's third law turned up to eleven. Firing *is* moving: pistols nudge, shotguns launch, snipers spin.

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
| **Vertical slice** | The PDF's "Duel": 2 players online (server-authoritative, client prediction), a shared room link, phone vs. laptop, art pass on one small room and the toy's guns, first sounds *(Claude's pick of mapping)* | Smooth on phone vs. laptop over normal Wi-Fi; looks and feels like the final game |
| **MVP / Release** | The PDF's "Party": up to 8 players, all six guns, one real map (Bunker Bonkers suggested), Free-for-all, bots filling empty slots, kill feed, touch controls | Passes `/release-check` |
| **Stretch** | Gunblades (Reaper's Kick, Six-Shot Sakura), the other killstreaks, Team Yeet / Ring Out / Hot Potato, party modifiers, maps 2 and 3, "Yeet of the Match" replay, PWA, public playtest | Only after release scope is locked |

Current tier: **Toy**

Claude scopes work by this line (SOP-08 "Tiers"). Move it with `/next-tier` when the tier's "Done means" is met.

## Content list (MVP)
| Item | Count | Status |
|---|---|---|
| Levels / areas | 1 map (plus the toy test room) | not started |
| Enemies / obstacles | Bots (other players), walls for bonks | not started |
| Player abilities | 6 guns, run, jump, melee slash | not started |
| Music tracks | 1 to 2 (surf-rock / spy-jazz) | not started |
| SFX sets | Guns, launches (slide whistle), bonks, crowd "ooooh", announcer | not started |

## Systems overview
| System | One line | In the vertical slice? |
|---|---|---|
| Recoil movement | Each shot applies an impulse opposite the aim, plus camera/body spin; added on top of normal run/jump; limited air control | yes |
| Hip vs aimed fire | Hip fire is the full yeet; right-click aim zooms in and braces the shot: about half the push, much less spin, a tight spread *(Claude's pick from playtest 2)* | yes |
| Wall bonk | Impact above a speed threshold stuns ~0.5 s with a splat; no damage unless "Hard Walls" | yes |
| Weapons | Per-gun recoil force, spin, damage, fire mode; map pickups, spawn with pistol | toy's 3 guns only |
| Hit knockback | Being shot pushes you too | yes |
| Health and damage | Cartoon damage, respawn | yes |
| Ragdoll-lite | Tumble/flail animation over a physics capsule; full ragdoll only on death (client-side) | yes |
| Multiplayer | Server-authoritative rooms (Colyseus suggested), prediction, ~100 ms interpolation | yes (2 players) |
| Killstreaks | Temporary super weapons earned by kill chains | no (Gatling Copter prototype in the toy only) |
| Gunblades, modes, replay, bots, touch controls | See the PDF | no |

## Controls
| Action | Keyboard/Mouse | Gamepad |
|---|---|---|
| Move | WASD | Left stick |
| Aim | Mouse | Right stick |
| Fire / recoil | Left click | Right trigger |
| Aim (braced: less kick, tighter spread) | Right click (hold) | Left trigger |
| Jump | Space | A |
| Melee / gunblade slash | F (was right click: moved for aiming, playtest 2) | Right bumper |
| Switch weapon | 1–4 / wheel | Y |
| Killstreak | Q | Left bumper |

Touch (MVP): left virtual stick, drag right half to aim, Fire / Jump / Slash buttons, tap weapon icon. Light aim assist for touch. Full table in the PDF.

## Tunables that define feel
Per weapon: recoil force, spin, fire rate, damage. Global: gravity, run speed, jump height, air control, wall-bonk speed threshold and stun time, hit knockback scale, Gatling Copter lift / tilt / heat rate.
Targets from the PDF: no single shot moves a player more than ~25 m; two Boomstick blasts in a row cross a medium room; the Spin Doctor leaves its user disoriented for ~1 s.
These live in data, not code. File: `src/core/yeet/tuning.ts` (one module; Vite hot-reloads it while `dev.py run` is open).

## Art and audio direction
- Style, tone, and the kinds of enemies/NPCs the player sees: "N64 spy movie meets Saturday-morning cartoon": chunky low-poly shapes, bright flat colors, big readable silhouettes. Opponents are other players: stubby, big-headed figures in color-coded jumpsuits with goggles and helmets. Effects: oversized muzzle flashes, comic "BLAM!" / "YEET!" text pops, speed lines on launches, cartoon stars on bonks. No blood or gore. UI: chunky thumb-sized buttons, kill feed verbs "YEETED", "BONKED", "REAPED".
- Art source: code-drawn shapes plus free packs (Kenney, Quaternius, Poly Haven), each license checked (`/asset-intake`).
- Main character: picture: `docs/concept/` (ChatGPT concept images and keyframes): a color-coded jumpsuit figure with goggles and helmet.
- Palette / resolution / camera: saturated primaries on warm, sunny environments; colorblind-safe team colors; under 2,000 triangles per character; first-person camera with launch kick-out.
- Music mood and references (see `RESOURCES.md`): surf-rock and spy-jazz.
- SFX style: punchy, exaggerated cartoon guns; slide-whistle launches; crowd "ooooh" for big airtime.
- Sound source: made in code (Wavesmith) plus free packs. Toy placeholders: `tools/audio/yeet_sounds.py` -> `public/assets/audio/sfx/`, events in `data/audio_events.json`.
- Fill the style fragments in `BRIEFS.md` from this section.

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
| `/shader` | Toon / outline look for the N64 cartoon style | Vertical slice |
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
- Gunblades, the other killstreaks (beyond the toy's Gatling Copter prototype), and modes beyond Free-for-all
- Maps 2 and 3, "Yeet of the Match" replay, map vote, party modifiers
- Accounts, monetization, app-store builds
- Permanent third-person camera

Open questions from the PDF (decide when they come up): wall bonks hurt by default or only with "Hard Walls" (current: no damage); touch-only lobbies or always mixed; free with cosmetics, one-time price or hobby; domain availability; GoldenEye-style pickups vs. chosen loadouts (current: pickups).
