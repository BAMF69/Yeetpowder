# Yeetpowder — Game Design Doc

> Markdown export of the living design doc (last updated 2026-11-21). Newer than `Yeetpowder Game Design Doc.pdf`
> beside it: adds the Lore and Future systems sections and the hot-pink muzzle-flash direction.
> Author: Elaina the Great

## Overview

Yeetpowder is a silly first-person party shooter where every gun's recoil throws you across the map. It plays in a browser with no download and no account. Phones and computers share the same matches.

**Pitch:** GoldenEye 64 and Perfect Dark split-screen chaos, but Newton's third law is turned up to eleven.

**Pillars**

1. **Every shot is a move.** Firing is how you travel, dodge and get into trouble.
2. **Funny first.** Failure should be a laugh. Getting blasted into a wall by your own shotgun is a highlight, not a punishment.
3. **Instant play.** From a shared link to a live match in under 15 seconds, with no sign-up.
4. **Easy to pick up, deep to master.** Anyone can flail around and score. Skilled players chain recoil into precise aerial routes.

**Inspirations:** GoldenEye 64 and Perfect Dark (arena feel, weapon variety, couch-party energy), Quake rocket jumping, Gang Beasts (physical comedy), Krunker.io (instant browser play).

**Audience:** Friend groups, streamers and party nights looking for a quick, chaotic game they can share with a link. Ages 13+, with cartoon violence.

## Lore

Yeetpowder is a newly discovered propellant that costs a tenth as much as gunpowder and takes a tenth of the time to make. In a few short years it pushed traditional gunpowder off the market almost entirely. The catch: it releases far more kinetic energy than any gun was designed to handle.

**Two schools of thought**

- **The Stuffers** load yeetpowder into ordinary, existing guns. The extra kick is wildly more than the guns were built for, so shooters get flung across rooms, spun in circles and bounced off walls. This is why every gun in the game launches its user. It isn't a glitch in the world; it's the cost of cheap ammo.
- **The Smiths** build new, heavier weapons designed to channel the extra energy on purpose. Their experiments produced gunblades: weapons that turn recoil into flips, lunges and spinning combos instead of fighting it.

**Signature look:** yeetpowder burns hot pink. Every muzzle flash, explosion and smoke puff in the game is pink, which instantly sets Yeetpowder apart from the orange-yellow flashes of every other shooter. Lime green is the backup color if pink tests poorly with players.

**How lore shows up in play**

- Standard guns are Stuffer weapons: scuffed, taped-up, held together with zip ties.
- Gunblades are Smith weapons: heavy, custom-forged and engraved, with reinforced stocks and recoil vents.
- Killstreaks are the most extreme experiments, such as the Gatling Copter: a Stuffer-style gatling loaded with so much yeetpowder that it flies.
- Map flavor: abandoned gunpowder factories being converted to yeetpowder plants, warning posters ("BRACE BEFORE YOU BLAST"), pink scorch marks everywhere.

**Open lore questions:** who discovered yeetpowder, and how? Is there a corporation selling it? Do the Stuffers and Smiths work as two factions or teams?

## Core mechanic

Every shot pushes you in the opposite direction from your aim. The push grows with the gun's power, so pistols nudge, shotguns launch and snipers spin. Players still run and jump normally. Recoil is added on top of normal movement, not a replacement for it.

**Recoil rules**

- **Impulse.** Each weapon has a recoil force and a spin value. Force moves you; spin rotates your camera and body.
- **Air control.** You get limited steering in the air, so a big launch is committed but not hopeless.
- **Wall bonk.** Hitting a wall at speed causes a short stun (about 0.5 s) with a cartoon splat. It does no damage by default. A "Hard Walls" match option makes impacts hurt.
- **Self-launch.** Aiming at the floor fires you upward. This is the core trick for reaching high ground.
- **Hit knockback.** Getting shot pushes you too, so fights scatter players across the map.

**Ragdoll-lite**

You keep control while airborne. Your character visibly tumbles, flails and spins, but that's animation layered over a simple physics capsule. Full floppy ragdoll only happens on death. That keeps matches in sync online and readable for players, while keeping the slapstick.

**Controls**

| Action | Keyboard + mouse | Controller | Touch (phone) |
| --- | --- | --- | --- |
| Move | WASD | Left stick | Left virtual stick |
| Aim | Mouse | Right stick | Drag right half of screen |
| Fire / recoil | Left click | Right trigger | Fire button (right thumb) |
| Jump | Space | A | Jump button |
| Melee / gunblade slash | Right click | Right bumper | Slash button |
| Switch weapon | 1–4 / wheel | Y | Tap weapon icon |
| Killstreak | Q | Left bumper | Glowing streak button |

Touch players get light aim assist and a slightly larger hit radius on gunblade slashes. Inputs are balanced so phones can compete in mixed lobbies, and an optional "touch-only" lobby filter is available.

## Weapons

The standard arsenal is six guns. Each one is defined as much by how it moves you as by its damage. Players spawn with the pistol and pick up the others around the map, GoldenEye-style.

| Weapon | Recoil | Spin | What it does to you | Role |
| --- | --- | --- | --- | --- |
| Pea Pistol | Low | None | Small hop backward; tap-fire to hover-skip | Starter, fine air control |
| Boomstick (shotgun) | Very high | Low | Blasts you backward into walls; aim down for a super jump | Close range, escape tool |
| Spin Doctor (sniper) | High | Very high | Sends you spinning like a top, camera included | Long range, high risk |
| Buzz SMG | Steady | Low | Constant push; hold fire to slide or glide | Mid range, sustained movement |
| Rocket Yeeter | Medium + blast | Medium | Classic rocket jump; the blast tosses everyone nearby | Area denial, vertical routes |
| Plunger Cannon | Medium | None | Sticks to surfaces and yanks you to them | Grapple, map traversal |

Tuning targets: no single shot should move a player more than about 25 m. Two shotgun blasts in a row should be able to cross a medium room. The sniper should leave its user disoriented for about 1 s, which is the price of its one-shot damage.

## Gunblades

Gunblades are rare map pickups that combine a melee weapon with a gun. The gun's recoil powers acrobatic melee moves. They're the skill showcase of the game and the main source of highlight clips.

**Reaper's Kick (scythe + sniper rifle)**

- **Fire** shoots a sniper round. The direction you shoot decides your flip: shoot down to backflip high, shoot behind you to front-flip forward into a slash, shoot sideways for a cartwheel dodge.
- **Slash** is a wide 180° sweep. A slash landed within 0.3 s of a shot does double damage (the "Reap" bonus).
- **Skill ceiling:** chain shot, flip, slash, shot to stay airborne and reap from above.
- **Look:** a weathered farm-scythe and grim-reaper style (wood, rust, bone charms). Avoid red-and-black anime styling so it doesn't read as *RWBY*'s Crescent Rose.

**Six-Shot Sakura (katana + revolver in the handle)**

- **Slash** combos up to six hits. Pressing Fire mid-slash fires the revolver to cancel the swing's recovery and lunge about 4 m forward into the next cut.
- **Six rounds means a six-hit combo maximum,** then a flashy spin-reload (1.2 s) that leaves you open.
- **Finisher:** the sixth shot fired point-blank knocks the target flying.
- **Mobile:** combos chain from well-timed taps of a single slash button; the revolver cancel fires automatically on the beat if "Assist Combos" is on.

**Future gunblade ideas:** chainsaw-shotgun, umbrella-flak cannon, frying-pan blunderbuss, hammer with a cannon in the head (smash and rocket-jump in one).

## Killstreaks

Killstreaks are temporary super weapons earned by getting kills without dying. Each one is loud, visible and counterable, so the rest of the lobby can see it coming and gang up on it.

| Streak | Kills | Duration | Effect | Counter |
| --- | --- | --- | --- | --- |
| Bouncy Boots | 3 | 20 s | Every landing is a trampoline bounce; stomping a player is a kill | Shoot them mid-bounce |
| Leaf Blower of Doom | 4 | 12 s | A huge cone of air that pushes players off ledges | Get behind the user |
| Gatling Copter | 5 | 10 s or until overheat | Fire downward to lift off and hover like an out-of-control helicopter, raining bullets | The user glows and can't dodge well; everyone shoots up |
| Cannonball Mode | 7 | 8 s | You become the ammo: you fire yourself across the map in a cannon and explode on impact | Dodge the telegraphed arc |

**Gatling Copter details:** firing at the ground generates lift. Aiming off-vertical tilts you and sends you drifting, so steering is wobbly by design. Heat builds while you fire. Overheating ends the streak with a spinning crash landing that damages anyone underneath. Ending on a laugh is the point.

Streaks reset on death. Assists count as half a kill, so support players can still earn them.

## Modes, maps and match flow

Matches are short (5 minutes), with 2–8 players, and anyone can join from a link with no account.

**Joining**

1. A host taps "Make a room" and gets a short link and a 4-letter code.
2. Friends open the link on any device, pick a random silly name (or type one), and land in the lobby.
3. Or press "Quick Play" to drop into a public match in progress.

No accounts. Name, color and settings are saved on the device. Bots fill empty slots so a match always feels busy.

**Modes**

- **Free-for-all:** most kills in 5 minutes.
- **Team Yeet:** 2 teams, first to 25 kills.
- **Ring Out:** no damage; knock players off the map with recoil and knockback (Smash Bros. style).
- **Hot Potato Bomb:** one player holds a bomb that drains time; shoot the holder to steal it.
- **Party modifiers:** low gravity, all snipers, double recoil, "slappers only" melee, big-head mode.

**Maps (launch set of 3)**

| Map | Theme | Why it's fun with recoil |
| --- | --- | --- |
| Bunker Bonkers | Retro spy facility | Tight corridors for pinball-style shotgun bounces |
| Rooftop Rumble | City rooftops at sunset | Gaps to cross by recoil; falling is a ring-out |
| Cannery Chaos | Factory with conveyors and crates | Moving platforms, explosive barrels, launch pads |

After each match: a 10-second "Yeet of the Match" replay of the funniest launch, then vote for the next map.

## Art and audio direction

The look is "N64 spy movie meets Saturday-morning cartoon": chunky low-poly shapes, bright flat colors and big readable silhouettes. Low-poly keeps the game fast on phones and nods to GoldenEye without copying it.

- **Characters:** stubby, big-headed figures in color-coded jumpsuits with goggles and helmets. They're easy to spot mid-air and their tumbling looks funny.
- **Effects:** oversized hot-pink muzzle flashes, pink explosions and pink smoke (yeetpowder's signature color; see Lore), comic-book "BLAM!" and "YEET!" text pops, speed lines on launches, cartoon stars on wall bonks.
- **Camera:** first person by default. On a big launch, the camera briefly kicks out to a dramatic angle, then snaps back. This can be turned off for motion-sensitive players.
- **UI:** chunky, thumb-sized buttons; a kill feed with funny verbs ("YEETED", "BONKED", "REAPED").
- **Audio:** punchy, exaggerated gun sounds; slide-whistle launches; a crowd "ooooh" for big airtime; surf-rock and spy-jazz music.
- **Accessibility:** colorblind-safe team colors, reduced camera spin option, subtitles for announcer lines.

## Tech approach

The game is a web app built on WebGL with a server-authoritative multiplayer setup. Crossplay comes free because every device runs the same browser build.

| Layer | Suggested choice | Why |
| --- | --- | --- |
| Rendering | Three.js or Babylon.js | Mature, fast WebGL engines that run on phones |
| Physics | Rapier (WebAssembly) | Fast and deterministic; runs the same on server and client |
| Networking | Colyseus (Node.js) over WebSockets | Rooms, matchmaking and state sync built in |
| Hosting | Small cloud servers in 2–3 regions | Keeps ping low for fast movement |
| App shell | Progressive web app | "Add to home screen" on phones, full-screen, no app store |

**Netcode plan**

- The server owns the truth: it runs physics at 30–60 ticks per second and applies every recoil impulse.
- Each client predicts its own movement instantly, then corrects smoothly when the server disagrees. Big launches are easy to predict because they're one known impulse.
- Other players are shown slightly in the past (about 100 ms) and smoothed between updates.
- Ragdolls on death are client-side only, since they don't affect gameplay.

**Performance budget:** 60 fps on a 3-year-old mid-range phone; under 15 MB to first match; under 2,000 triangles per character.

## Future systems

The Stuffer and Smith lore opens up two systems for after launch: heavy Smith-built guns that trade mobility for control, and weapon durability for scavenging modes.

**Smith heavy guns**

Smiths rebuild traditional guns as oversized, reinforced versions that absorb most of yeetpowder's kick. They create a clear choice: chaos and mobility, or control and stability.

| Version | Recoil | Movement | Feel |
| --- | --- | --- | --- |
| Stuffer (standard) | Full launch | Run, jump, fly by recoil | Wild, mobile, hard to aim |
| Smith (heavy) | About 25% of standard | Walk only; no sprint, short hop | Planted, accurate, slow |

- Examples: the Anvil Shotgun, the Bank Vault Sniper, a tripod-mounted Smith SMG.
- **Counterplay:** heavy-gun users are easy targets for flanking and for knockback. Blasting them off a ledge is their main weakness.
- **Ditch it:** dropping a heavy gun instantly restores full speed, creating "panic drop" moments.
- **Look:** chunky, riveted and bolted together, like a gun built inside a safe.

**Weapon durability (optional modes only)**

Yeetpowder shakes Stuffer guns apart. In specific modes, guns wear out with use and must be repaired or replaced.

- **Wear:** each shot adds strain. A worn gun rattles, smokes pink and its recoil becomes erratic before it breaks.
- **Breaking:** at zero, the gun either jams or blows up in your hands with one last big launch. That's the comedy payoff.
- **Scavenge:** broken guns drop scrap parts. Players grab replacement guns from crates or other players' drops.
- **Repair:** Smith workbenches on the map repair guns, using scrap and a few seconds of standing still, which leaves you exposed.
- **Smith guns last longer;** gunblades last longest. Durability can also act as a soft balance limit on the strongest weapons.

**Modes that use durability**

- **Scrapyard:** a longer survival mode in which everyone starts with a worn pistol and must scavenge, repair and upgrade.
- **Junk Wars:** a team mode where each team defends a workbench; destroying the other team's bench stops their repairs.
- **Standard modes** (Free-for-all, Team Yeet) keep durability off so drop-in matches stay simple.

## Prototype roadmap and open questions

The first goal is to prove the recoil is fun with one gun in one room before building anything else.

1. **Toy (single player, gray boxes):** pistol, shotgun and sniper recoil in one test room. Goal: launching yourself feels hilarious within 30 seconds.
2. **Duel (2 players online):** server, prediction and a shared room link. Goal: smooth on phone vs. laptop over normal Wi-Fi.
3. **Party (8 players):** all six guns, one real map, Free-for-all, bots, kill feed.
4. **Showcase:** both gunblades, Gatling Copter, art pass, "Yeet of the Match" replay.
5. **Public playtest:** share the link, watch clips, tune recoil values.

**Open questions**

- [ ] Should wall bonks hurt by default, or only in the "Hard Walls" option?
- [ ] Do touch players get their own lobbies, or always mix?
- [ ] Free with cosmetics, a one-time price, or a hobby project?
- [ ] Is yeetpowder.com / .io available?
- [ ] Keep the GoldenEye-style pickup model, or let players choose loadouts?

## Appendix: art agent handoff prompt

The prompt lives in `docs/concept/art-agent-mockup-prompt.md`. Paste it into an art or video agent to get mockup gameplay clips for pitching and art direction; it tells the agent not to build the game.
