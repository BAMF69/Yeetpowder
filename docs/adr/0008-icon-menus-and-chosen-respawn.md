# 0008: Icon-first menus and a respawn you choose

Accepted by Elaina, 2026-11-26, from the clickable mockup `docs/mockups/menu-redesign.html`.

## Menus

The front end is graphical and works on a small screen. No screen offers more than six choices. Every choice is an
icon with one word under it. The words are the accessible names and go through the translator (en, fr). The tree:

- **Home:** Play (Quick Play), Party, Solo, Couch, Settings, Operator (a live 3D portrait, the operator's name and
  your name).
- **Party:** Make, Join, Watch. **Solo:** Bots, Duel, Fight Back, Sandbox (plus Juice in debug builds).
- **Couch:** 2, 3 or 4 players. **Settings:** Sound, Controls, Display, Access, Language, Credits.

Room setup (Make, Bots, Couch) uses map pictures, mode chips (Kills, Lives, Timed, Ring), +/- steppers with a
person per seat, and Code/Open and Bots chips. GO sits in the header. Choices that the rules forbid are greyed out
before you can pick them (`src/net/roomSetup.ts`). `roomOptions()` still validates every value. Join is four big
letter boxes. The Operator screen saves as you change it.

The old 15-button list and its Arenas / opponent-count / bot-difficulty lists are gone. Duel (online) and Arenas
were folded into Party, Solo and Bots. Quit was dropped: a browser tab has no quit, and `shell.quit()` remains for
a desktop wrapper.

Implementation: `src/shell/menuKit.ts` (GridMenu with spatial d-pad navigation from `spatialNav.ts`, tiles, chips,
steppers), `icons.ts` (original inline SVG, no icon font or downloaded asset), `iconMenus.ts` (screens),
`launch.ts` (the old form's start logic), and `portrait.ts`. No new dependency or asset.

## Respawn

A knockout no longer respawns you after 2.2 s:

- **SPAWN unlocks** `TUNING.player.respawnUnlock` = 10 s after the knockout. Before that, a press does nothing.
- **Auto-respawn** happens at `respawnAuto` = 30 s if you never press. The KO tumble still lasts `respawnDelay` (2.2 s).
- The sim enforces the timing (`YeetInput.spawn`, `canSpawn()`), so prediction, server, peer host and local
  rooms agree. Bots press SPAWN as soon as it unlocks.

The respawn screen (`src/game/respawnScreen.ts`, timing in core `respawnView.ts`) comes up over the live game. It
shows who got you, the SPAWN ring (filling while locked, then draining toward the auto-respawn), the scores, an
operator carousel, your name and an Auto-spawn toggle (remembered per browser). The mouse is freed without
opening the pause menu. Controls: Jump / Enter / a click spawn, move left/right switch operator, Interact edits the
name. In couch split-screen each player gets a badge in their view: A spawns, LB/RB switch operator.

**Name and operator can change at any time.** A new `{t:"profile"}` client message reaches `Room.setProfile`,
which sanitises it like a join. Every roster follows within a snapshot. This holds in public Quick Play too.

## Consequences

- Deaths cost more time: tune `respawnUnlock` in play if matches drag. Ten seconds at an eight-player kill
  target of 10 is untested with humans.
- The old island-edge test passed only because the fast respawn hid a bot walking into the water. It now
  checks the water entry and fails until the bot's edge avoidance is fixed.
- Browser helpers drive the new screens by `data-item` ids; the shell drives (`menus`, `pseudo`, `display`,
  `content`) go through the new tree.
