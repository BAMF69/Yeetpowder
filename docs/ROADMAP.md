# Roadmap

> Now is capped at 3 items (SOP-08); one at a time is best. Finishing beats starting. Anything new goes to the Parking lot.
> Claude reads the **Now** section at session start.

## Now (max 3 items)
- [ ] **Playtest and tune the toy** (pistol, Boomstick, Spin Doctor, Gatling Copter prototype, dummies, wall bonk) | Done when: launching yourself feels hilarious within 30 seconds and you want to keep playing for 2 minutes | Timebox: 2 sessions

## Next
- [ ] 

## Later
- [ ] 

## Parking lot (ideas, no commitment)
- Camera kick-out to third person on big launches (GDD; after the toy's feel is right)
- Gatling Copter at x2 thrust climbs ~100 m in 5 s when aimed straight down: maybe a height falloff or more drag if it stops feeling like hovering
- Sound captions on screen (the events have captions; they need the kit's dialogue build to show: SOP-20, Vertical slice)
- Music (surf-rock / spy-jazz, Wavesmith chiptune) once the sound effects feel right
- Melee / gunblade slash on F (right click is aim now)
- Fight Back win condition (knock them all out within a time? waves?) and dummies that move
- Next tier: Fight Back's shooting dummies are MVP-style bots; consider /next-tier once the toy's fun is proven
- Smith heavy guns: oversized versions of standard guns, ~25% recoil, walk only (design doc "Future systems")
- Weapon durability, scavenging and Smith workbench repair, for Scrapyard / Junk Wars modes only (design doc "Future systems")
- Armor and damage types (bullet, slash, blast, bonk): Modern vest, Medium brigandine, Chainmail, Plate; heavier armor cuts recoil and knockback, total recoil cut capped ~75% (design doc "Future systems")
- Couch mode: TV/laptop browser renders up to 4 split-screen panes from game state; phones join by QR code as controllers (WebRTC on same Wi-Fi, gyro aim); no video streaming, too much delay (design doc "Future systems")
- Quick Play: best ping first, then most players; join mid-match below 8; auto-requeue after each match; rotate levels and modes (design doc "Modes, maps and match flow")
- Room creation options: pick game mode, level, public or private (design doc "Modes, maps and match flow")
- 8-player matches (launch target)
- Cosmetic skin store with moderated player submissions and creator revenue share; accounts optional, only for buying or submitting (design doc "Future systems")
- Level designer: browser editor, test-as-you-build, share by link, featured levels join Quick Play (design doc "Future systems")
- Tutorial (skippable, under 5 min) and lore-based story mode with cosmetic rewards (design doc "Future systems")
- 

## Milestones
Scope, not dates. `/next-tier` moves the game from one tier to the next; after the slice, `docs/PRODUCTION.md` holds the
detail.
| Milestone | Definition of done | Status |
|---|---|---|
| M0 Toy (v0.1.0) | Core mechanic playable; someone wants to keep playing | |
| M1 Vertical slice (v0.2.0) | One polished loop with art, audio, UI; the greenlight (`/next-tier`) | |
| M2 Alpha | Every MVP system in and playable | |
| M3 Beta (content complete) | All MVP content in, no known crash | |
| M4 Release candidate (v1.0.0-rc.N, then v1.0.0) | `/release-check` green | |

## Done (recent, newest first)
- 2026-11-21: Playtest 4 changes: auto re-zoom after the recoil, Shift sprint (doubles tumble chance), tumble tip, logo title screen, scoped Spin Doctor spins, lowest audio latency + lost-click fix on fast monitors
- 2026-11-21: Playtest 3 changes: arm glitch fixed; twist-based hip vs aimed fire (same push), zoom knock-out on every gun but the copter; Pea Pistol 11 m/s with a hover-skip that cannot climb; run-and-gun tumbles with a third-person camera; levels (Sandbox + Fight Back: dummies shoot back, pickups, Boomstick-only Gatling tower); 7 more sounds
- 2026-11-21: Placeholder sounds made in code (14 events, 29 WAVs): every gun, copter rotor, slide-whistle launches, bonks, hits, knockouts, overheat, crash
- 2026-11-21: Playtest 2 changes: right-click aim on every gun (zoom, Spin Doctor scope) with braced aimed fire vs full-yeet hip fire; Pea Pistol hop backward and a visible two-part blowback; Gatling Copter turns you right and wobbles the aim
- 2026-11-21: Playtest 1 changes: stronger recoil (Boomstick and copter x2), first-person arms on every gun, Pea Pistol blowback over the head, Boomstick flings arms and legs into view
- 2026-11-21: Toy built: recoil movement, 3 guns + Gatling Copter prototype, target dummies, wall bonk, HUD; 16 sim tests, autoplay tour
- 2026-11-21: Project scaffolded

## Budget and cost log (SOP-12)
| Date | Job | Model and effort | Time | Cost or % of weekly limit | Result |
|---|---|---|---|---|---|
| | | | | | |
