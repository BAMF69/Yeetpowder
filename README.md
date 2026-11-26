# Yeetpowder

Yeetpowder is a game made with Web 3D (Three.js + TypeScript + Vite). One-line pitch lives in `docs/GDD.md`.

## Quick start
```
python tools/dev.py -h        # see every command and what it does
python tools/dev.py check     # fast sanity pass
python tools/dev.py test      # run tests
python tools/dev.py run       # launch the game
```
Engine-specific setup (install, versions, env vars): **`docs/ENGINE.md`**.

## Quick Play and rooms

- **Quick Play** always uses eight combatants. Vacant seats are easy/medium bots; humans replace bots when they
  join and bots return when humans leave. If online matchmaking is unavailable, it starts an explicitly labelled
  offline match with seven bots.
- **Make a Room** selects arena, 2–8 combatants, bot fill and visibility. Modes: kill-target Deathmatch, limited
  lives (last player standing), Timed (highest score, ties allowed), and Ring Out (unlimited HP, water knockouts).
  Ring Out uses Shark Island. Public Quick Play rooms need eight seats with bot fill; elimination rooms are private.
- **Join a Room** accepts a code; the in-game **Invite** button provides a link and QR code. The authority's map
  and rules are loaded before joining play. The owner can start a rematch after results.
- Run `npm run duel` for human matchmaking on the home network. A static web build alone cannot discover public
  rooms; the backend and secure `/duel-ws` route must also be hosted for internet matchmaking. Private invitations
  retain the browser-hosted fallback.

Developer checks: `?quick&offline` starts the deterministic offline fallback; `?make-room` opens setup.
After a production build, `node tools/test_party_network.mjs` and `node tools/test_party_browser.mjs` exercise a
running room server. See `docs/adr/0005-party-matchmaking-and-room-rules.md`.

**Couch Mode** supports 2–4 split-screen players: keyboard/mouse for Player 1 and gamepads for the others, or
gamepads for everyone. Choose a map, rules and bot fill. Standard gamepads use left stick to move, right stick
to look, RT to fire, LT to aim, A to jump, X to reload, Y to slash, bumpers to change weapon and left-stick click
to sprint. Two players split horizontally; three/four use a four-quadrant layout.

**The Yeet Coliseum** is a large circular, open-air arena with three raised perimeter rings and stairways.
**Spectate a Room** watches by code without taking a combatant seat, with player switching and an overview.
At the end of configured room and couch matches, **Yeet of the match** replays the highest-speed moment;
skip it or watch again from the results. Speed now reads **yeters per second** (same numerical scale).
Developer entry points: `?couch`, `?play&couch=2` (also 3/4), `?play&level=coliseum&mapview`,
`?online=1&room=ABCD&spectate`. Design and limits: `docs/adr/0006-couch-spectators-and-highlights.md`.

Playtest improvements: **Player & Operator** saves your name and one of four operator color variants, shared with
the room. **Arenas → Choose opponent count & rules** starts a local match against 1–7 bots. Hold **Tab** for scores.
Public Quick Play results count down 30 seconds to a new map, or use **Next match · new map** immediately.
Highlights now need a credited knockout in the recorded moment and begin with a two-second frozen winner orbit,
showing the winner's name and score.

Green health packs refill three carried uses. **V**, touch **HEAL**, or gamepad **D-pad Up** applies one use for
three seconds, restoring full health; damage does not interrupt it, and a ten-second cooldown follows. Map packs
return after 12 seconds. Death restores starter gear with no dropped equipment. Weapon pickups return after six
seconds. The **Yeet Shield** (slot **0**) sits in the left hand with a hip-fired Pea Pistol. It blocks frontal bullets
and halves frontal knockback and blast damage. Aim holds the shield in both hands, holsters the pistol and prevents
all frontal explosion damage while you look through its viewport. Rear attacks remain dangerous. Aimed grenades show a static-world
trajectory and predicted blast area. Grenade blasts and the shotgun cone are wider. Shark attacks have a two-second
visible approach before the victim disappears. Respawns choose varied, unoccupied starting points.

## For contributors and testers
1. Read `docs/ENGINE.md` for setup.
2. Run `python tools/dev.py doctor` (or `python tools/doctor.py`) to verify your environment.
3. Known problems and fixes: `docs/TROUBLESHOOTING.md`.
4. How we work: `docs/sop/`.

## Working with Claude Code
This repo is set up for Claude Code. Open it in the repo root and run `claude`.
- `CLAUDE.md` is loaded automatically. Skills in `.claude/skills/`, subagents in `.claude/agents/`.
- Start with `/start-session`, end with `/end-session`.
- Full guide: `docs/sop/SOP-07-claude-code-hygiene.md`.

## Layout
See `docs/ARCHITECTURE.md` and `docs/ENGINE.md`.

## Credits and licenses
Third-party assets and licenses: `docs/ASSET_LOG.md`.

<sub>Set up with the Claude Code Game Kit.</sub>
