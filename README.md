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
