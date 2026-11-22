# Vertical Slice Brief

> The smallest playable build that tests the assumptions in `GDD.md`. Not the whole game.
> Why this works: a design doc is the source of truth, and a small slice gets real feedback before you scale (F2, F4 in `docs/EVIDENCE.md`).
> Worked example from a creator series: `docs/resources/pipelines.md`; raw notes: `docs/evidence/field-reports.md`.

## Why a brief
"Build me a Zelda-like" makes the AI fill every gap with its own assumptions, so you get its game, not yours.
The GDD plus this brief gives it the context to build the one thing you want to test.

## Fill this in
> Drafted by Claude from `docs/GDD.md` ("Vertical slice" tier = the design doc's "Duel" stage) and agreed with
> Elaina on 2026-11-21 (Decisions below).

- **Slice name:** Duel: two players, one room, one link.
- **Assumptions it tests (copy from GDD):**
  - Recoil movement is fun on its own, and stays fun against a real opponent (not just dummies).
  - The Spin Doctor's spin is funny, not nauseating (now with another human watching you spin).
  - The art style works: players read who is who mid-air at a glance.
  - *(added by Elaina, 2026-11-21)* The gunblades are the skill showcase: recoil-powered melee moves (Reaper's Kick
    flips, Six-Shot Sakura lunge combos) feel learnable, readable to the opponent, and make highlight moments.
  - *(added by the tier itself)* Big recoil launches stay smooth online: phone vs. laptop over normal Wi-Fi, with
    client prediction and the server owning the truth.
- **In scope (be stingy):**
  - 2 players online in one room: server-authoritative (Colyseus suggested, needs an ADR), client prediction for your
    own movement, the other player shown ~100 ms in the past and smoothed (GDD netcode plan).
  - A shared room link and 4-letter code; join from any device with no account; a random silly name.
  - One small duel room: a cut-down Fight Back or a new room built for two (corners to bonk, one launch ledge).
  - The three standard guns (Pea Pistol, Boomstick, Spin Doctor) with today's recoil, aiming, twist, airborne kick,
    sprint, tumbles and magazines. Hit knockback and health between players; respawn at a spawn point.
  - Art pass on that one room, the two player figures and the three guns, to the keyframes' look (`/shader`; models
    via `/asset-intake`, budget 2,000 triangles per character). The sounds already made in code, balanced.
  - Phone controls good enough to play the duel (virtual stick, drag to aim, fire / jump / aim / slash buttons).
  - The Gatling Copter as one rare pickup in the duel room.
  - Three duel modes to try: first to 5 knockouts, a timed round, and Ring Out; a rematch button.
  - **The two gunblades (Elaina, 2026-11-21)**, as rare pickups in the duel room, melee on F (right click is aim):
    - *Reaper's Kick* (scythe + sniper): fire decides the flip (shoot down = high backflip, shoot behind = front-flip
      forward into a slash, shoot sideways = cartwheel dodge); Slash is a wide 180 degree sweep; a slash within 0.3 s
      of a shot does double damage ("Reap"). Look: weathered farm scythe, wood, rust, bone charms (never red-and-black
      anime styling).
    - *Six-Shot Sakura* (katana + revolver in the handle): slash combos up to 6 hits; Fire mid-slash fires the revolver
      to cancel the swing's recovery and lunge ~4 m into the next cut; six rounds = six-hit maximum, then a 1.2 s
      spin-reload that leaves you open; the sixth shot point-blank knocks the target flying.
- **Out of scope:** killstreaks, future gunblades (chainsaw-shotgun and the rest), bots, more than 2 players, Team Yeet and Hot Potato,
  Quick Play and matchmaking, maps 2 and 3, "Yeet of the Match" replay, accounts, controller support, reserve ammo
  and ammo pickups, cloud hosting in several regions (one server is enough for the slice).
- **Debug tools in scope:** a network panel (ping, prediction corrections per second, snapshot rate); simulated lag
  and packet loss; a second local client in a browser tab; god mode; speed multiplier; teleport to named spots. All
  behind `?debug`.
- **Done when (observable):** a laptop and a phone on normal Wi-Fi join the same room from a link, play a first-to-5
  duel with every slice gun and both gunblades, and finish it; a player can pull off a Reap and a full six-hit Sakura
  combo on purpose; launches look smooth on both screens (no visible snapping beyond the
  debug panel's correction budget); the room and figures look like the keyframes; it holds 60 fps on the laptop and is
  measured on the phone.
- **How we judge it:** do two people laugh at each other's launches; is the duel fun for 5 minutes; does the
  phone player have a fair chance; does the art read mid-air; does prediction hide the network.
- **When it is done:** run `/next-tier`. It checks the evidence and, on a yes, starts production (`docs/PRODUCTION.md`).

### Decisions (Elaina, 2026-11-21)
1. Phone: minimal touch controls in the slice (virtual stick, drag to aim, fire / jump / aim / slash buttons).
2. Server: on this PC, over the home network (phone and laptop on the same Wi-Fi). No cloud server yet.
3. Modes: try all three: first to 5 knockouts, a timed round, and Ring Out (no damage; knock them off the map).
4. Gatling Copter: one rare pickup in the duel room.
5. Physics: keep the toy's own (`docs/adr/0001-keep-toy-physics-for-online-play.md`); no Rapier.
6. Order: gunblades first, single-player against the dummies, then the netcode.
7. Gunblades are rare pickups in normal play; in the Sandbox every weapon (gunblades included) is always available
   for testing.

## Prompt to paste (adapt the brackets)
```
Before you write any code, read docs/GDD.md, docs/CONCEPTS.md and docs/VERTICAL_SLICE.md. If anything is unclear or you
would have to assume something, ask me questions first. Wait for my answers.

Then build the vertical slice described there, and ONLY that. Use placeholder art: 3D figures built from shapes or logged free models (2,000 triangles per character), never bare boxes.
Follow docs/sop/SOP-01.
Test as you go with `python tools/dev.py check`, `test`, and `smoke` after each step. Do not add systems that are out of scope.
Include the debug tools listed in the brief, behind a debug flag.
When it runs, play it yourself where you can, take screenshots from several angles, and run the SOP-09 interaction smoke checklist.

When done: list what is built, what you assumed, what is NOT built, how to run it, and a proposed next step.
```

## Answering the clarifying questions
- Getting questions back is good: the AI understood the assignment. Answer fast; it is a prototype.
- Say "use your best judgment" where you do not care. Be precise only where the test depends on it, above all **controls** (keys and gamepad).
- **Death rule:** prefer "restart the current room" unless the death rule is what you are testing. Full resets feel bad in play (tip, E09).

## First build review
- Expect crude placeholder art and code-made sounds. Judge the loop, not the look.
- Typical first-pass problems: enemies too tough, no health drops, weak puzzle, death sends you too far back.
- Take notes while you play, then `/playtest-report` turns them into tasks.

## Art in parallel with mechanics
Mechanics feedback and art generation are independent. Ask Claude for the **asset pack request** in `docs/BRIEFS.md` (character first, then actions,
enemies, tiles, UI), paste each block into the generator, bring results back through `/asset-intake`.
Integration: one `assets/` folder by type, file names exactly as in the prompt pack, `tools/art/chroma_key.py` for magenta backgrounds,
log every file in `ASSET_LOG.md`, then ask Claude to wire it in and **playtest immediately**: animations, draw order, and difficulty usually break here.

## The loop after the slice
1. Play it. Log notes with `/playtest-report`.
2. Mark each GDD assumption confirmed, refuted, or unknown in the table below.
3. Describe each gap as an observable problem ("needed two more rooms to feel progression").
4. Send gaps back, patch, repeat. Plan several rounds before scaling.
5. Only then expand systems, art, and music (`SOP-08`), one mechanic at a time: add it, play until the game is fun
   again, and find how it combines with what is there before adding the next (tip, E49). Art and animation come last.

## Results log
| Round | Date | Assumptions confirmed | Assumptions refuted | Next change |
|---|---|---|---|---|
| 1 | 2026-11-21 | | | |
