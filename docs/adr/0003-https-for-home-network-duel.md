# ADR 0003: HTTPS for the home-network duel (gyro aiming)

- Status: accepted
- Date: 2026-11-22

## Context
Touch players asked for gyro aiming (playtest 2026-11-22). Browsers only give `DeviceMotionEvent` readings to
secure pages (https, or localhost). The duel is played from a tablet or phone at `http://<PC address>:5180`, which is
not secure, so the gyro never reports. A secure page also may not open a plain `ws://` socket to the duel server.

## Options considered
1. **`@vitejs/plugin-basic-ssl` 2.3.0 (MIT, from the Vite team)**: one dev dependency with no dependencies of its
   own; makes a self-signed certificate and serves https. Each device warns once ("not private") and must be clicked
   through. The socket goes through Vite's proxy at `/duel-ws`, so no second certificate is needed.
2. **A certificate made by hand (mkcert or openssl)**: no browser warning once its root is installed on each
   device, but installing a root certificate on a tablet is fiddly, and the project rules keep key files out of
   Claude's hands.
3. **A tunnel service (a public https URL)**: no warning, but the game leaves the home network through someone
   else's server, and it needs an account.
4. **Do nothing**: no gyro on phones and tablets.

## Decision
Option 1, only for `npm run duel` (env `YEET_HTTPS=1`): the smallest change that makes the gyro work on the home
network. `dev.py run`, `smoke` and `build` stay plain http.

## Consequences
- Good: gyro aiming works on the duel; one dev dependency (never shipped to players: dev server only).
- Bad / costs: a one-time certificate warning per device; the plugin writes its certificate to its cache folder under
  `node_modules/.vite/` (git-ignored, regenerated as needed).
- What we would need to see to revisit this: the warning confusing players at playtests (then option 2), or a
  hosted build (a real certificate from the host instead).

## Notes
- License and version checked with `npm view @vitejs/plugin-basic-ssl` (2.3.0, MIT, peer vite ^6 || ^7 || ^8, last
  modified 2026-05-07). **verified**
- Secure-context requirement for device motion: Chrome and Safari both hide it on http. **verified** in this
  project only for desktop Chromium (localhost counts as secure); on the tablet **unverified** until Elaina tries it.
