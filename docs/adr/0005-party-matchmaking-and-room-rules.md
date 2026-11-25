# Party matchmaking and room rules

Date: 2026-11-24. Status: implemented; production hosting and internet playtesting remain separate.

Quick Play needs a searchable room directory, which the PeerJS invite-code broker does not provide. Extend the
existing authoritative WebSocket room server (ADR 0002) for public matchmaking. Keep browser-hosted WebRTC
for invite-only rooms when the room server is unavailable (ADR 0004).

Quick Play joins a public eight-seat room with bot fill, preferring the room with the most humans. Full rooms,
finished matches, private rooms and limited-lives elimination matches are excluded. If none qualifies, create
a public kill-target Deathmatch on a Party arena. Vacancies are controlled by deterministic easy/medium
BotBrain instances through the same inputs as humans. Joining replaces a bot; leaving immediately restores
one. The authoritative roster always contains eight combatants. If matchmaking cannot be reached, Quick Play
starts an explicitly labelled offline match with one human and seven bots.

Custom rooms select an arena, 2–8 combatants, bot fill, visibility and match rules. More than two combatants
requires a Party arena. Public Quick Play rooms require eight seats and bot fill; limited-lives rooms are
private. Invite-only rooms with bot fill disabled wait for their human seats to fill before the match begins.

The shared Room owns kill targets, limited lives, timed scores, winners and owner-authorized rematches. Ring
Out uses Shark Island and a per-level infiniteHp rule: weapon/blast damage cannot remove HP, knockback is
unchanged, and water knockouts still count. Lives are lost on any knockout, including self-inflicted falls.
Room settings are normalized on the authority. Empty seats without bots and eliminated players are inactive.

The client completes the room handshake before constructing its world, so the server's map, capacity and mode
also configure prediction and scenery. Snapshots distinguish humans, bots and active seats, carry bot-held
inputs, and include authoritative match results. Legacy two-player duels retain their original unlimited flow.

No new dependencies. `npm run duel` supplies the existing home-network page and server; public internet
matchmaking needs that backend deployed and the HTTPS `/duel-ws` route wired. Static-only hosting supports the
offline Quick Play fallback and existing peer invitations, not a global public room directory.

Validation: `tests/partyRooms.test.ts`, existing net/prediction regressions, `tools/test_party_network.mjs`
(live WebSockets), and `tools/test_party_browser.mjs` (room controls, two clients, disconnect fill and offline play).
