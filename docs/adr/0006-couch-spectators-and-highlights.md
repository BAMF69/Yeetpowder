# Couch play, spectators and fastest-moment highlights

Date: 2026-11-24. Status: implemented; physical-controller and human playtesting remain.

The coliseum is an open-air, 104 m circular arena with three elevated concentric rings and four stairways.
Narrow axis-aligned chords approximate the circle so rendering, collision, hitscan and bots share the existing
deterministic collision model. There is no ceiling. The original three Party variants remain unchanged.

Couch mode uses one local authoritative Room and 2–4 local human seats. Keyboard/mouse can own Player 1, with
one standard-mapping gamepad per remaining player; an all-gamepad option is also available. Input is read per
device, avoiding the menu input layer's merged gamepads. Disconnected devices release controls and show a
connection hint. Two players split horizontally; three/four use a 2×2 layout. One renderer and scene are drawn
through per-player cameras with scissor rectangles, separate guns and HUDs. Bots can fill remaining seats up to
the selected combatant count; disabling bots uses exactly the selected local player count. Couch play is local
to one computer, rather than joining public matchmaking as a group. Phone-controller pairing is future work.

Spectators join by room code with `spectate: true`, receive slot -1, and never call Room.join or occupy a human
seat. Both WebSocket and browser-hosted invite rooms broadcast snapshots to a separate, capped watcher set.
Watcher inputs/rematch requests are ignored. Follow-player and arena-overview cameras expose no combat controls;
the room closes for watchers when all human players leave. `ArenaWorld` interpolates received player transforms.

`HighlightRecorder` inspects authoritative total 3D velocity every physics step. It retains a bounded three-second
history sampled at 10 Hz, the exact fastest instant, and up to two seconds afterward. Only active, living players
qualify; ties retain the first peak. Bots participate. Match scores do not select the highlight. The finished
snapshot carries the clip once; sessions retain it while a world loads. Rematches clear recording and results.
Playback interpolates actor transforms and follows the fastest combatant, slowing down around the peak. It
starts at match end and can be skipped or watched again from results. It is a transform replay: projectile
trajectories, debris and audio events are not reconstructed. It never modifies the live simulation or scores.

All displayed speed uses **yeters per second**, at a 1:1 scale with the existing physics units. Physics constants
and movement balance are unchanged. No new dependencies or third-party assets.

Validation: `tests/coliseumCouchReplay.test.ts`, existing room/prediction regressions,
`tools/test_party_network.mjs` (including a watcher in a full room), and `tools/test_couch_browser.mjs` (virtual
gamepad isolation, split-screen, fastest-player replay, skip/rematch and online spectator cameras).
