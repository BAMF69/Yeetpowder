# ADR 0009: Blast Zone HUD

- **Status:** Accepted (Elaina approved the concept 2026-11-28; implemented the same day)
- **Approved reference:** `docs/mockups/hud/index.html` v2 (published privately as the "Yeetpowder HUD Concepts"
  artifact). Its backgrounds are real gameplay captures; the HUD values in it are samples.

## Context
On a phone the old HUD covered about a third of the view: full weapon names wrapped into three rows, comic pops
("GOT THE YEET SHIELD!") ran off screen and covered each other, and with the Spin Doctor scoped the touch buttons
disappeared. Cause of the last one: `setTouch()` lifted the whole HUD layer to z 7 so the name chips could be tapped,
which put the scope's black mask above the touch buttons (z 6). The menus had moved to the grungy Blast Zone look
(ADR 0008 addendum); the HUD still used system fonts, rounded dark boxes, yellow and green.

## Decision
- **Look:** gunmetal plates with cut corners and rivets, the menu set's diamond-plate tread toned down, only on the two
  main desktop plates (small chips are plain metal so tread never sits behind small text). Cream paint informs; hot
  pink `#ff2e88` only for danger (low health, empty mag, hit marker, damage wedge) and the current slot. Fonts already
  bundled (A-0024): Saira Stencil One for words, Teko for numbers (tabular), Black Ops One for stamps.
- **Messages split three ways:** stamps (YEET, BONK, KABOOM, KNOCKOUT): worn rubber-stamp ink, up to three; each new one
  lands in the middle and pushes older ones out to alternate sides, smaller and fading (Elaina's change to v1). Feed:
  knockouts and pickups. Notice line under the crosshair: "LAUNCH CAMERA ON", "+50 HEALTH", the level name. Stamps
  hide while scoped.
- **Desktop:** health plate bottom left (number, rail, three heal pips, V · HEAL / timers); weapon plate bottom right
  (icon, stencil name, ammo, reload bar) with an icon strip of owned weapons above it. Speed shows only during
  launches. Level name and score live in Tab and pause.
- **Touch (landscape first, portrait works):** pause, health chip and Heal chip top left; respawn, settings and
  fullscreen in a small row below; the current-weapon chip top right (tap: picker of every weapon, owned ones
  tappable); a strip of owned weapons at the bottom right between the move area and the buttons (tap switches,
  swipe scrolls). Action buttons are bullet holes in torn steel (Elaina's request), generated per button from a seed.
- **Layers:** `.yh` (z 5, scope and everything non-interactive) < `.yt` touch buttons (z 6) < `.yhT` (z 7, only the
  weapon chip, picker and strip, touch only) < shell screens (z 10). Decorative layers never take input.
- **Hit direction:** the damage wedge sits on the screen edge facing the attacker (`hitBearing`).

## Consequences
- No new dependencies or bought/generated art: icons and bullet holes are original vector art in code
  (`weaponIcons.ts`, `bulletHole.ts`; ASSET_LOG A-0025). The mockup's button art is made by the same code.
- `ArenaWorld` (couch split screen, spectators) still has its own simple overlay; restyling it is separate work.
- Guarded by `tests/hudLook.test.ts` (fonts, tread, colours, layer order, icons, holes, cascade and hit maths) and
  `node tools/test_hud_browser.mjs` (real play: scope under buttons, picker and strip switching, nothing off screen on
  a small phone in landscape and portrait, 150 % text). `?hud-demo` fires sample feedback for captures.
