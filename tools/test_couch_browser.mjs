// Dev server allows inspection of the actual world module without shipping test hooks.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import WebSocket from 'ws';
await mkdir('captures/progress', { recursive: true });
const server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 4180, strictPort: false, open: false, hmr: false } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const errors = [];
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.setDefaultTimeout(120000);
page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem('couch-qa/settings.json', JSON.stringify({ version: 1, display: { frame_cap: 30 }, telemetry: { consent: 'no' } }));
  window.__qaPads = [];
  Object.defineProperty(navigator, 'getGamepads', { value: () => window.__qaPads });
});
const base = server.resolvedUrls.local[0];
const world = (fn) => page.evaluate(async (source) => { const { game } = await import('/src/main.ts'); return new Function('world', source)(game.world); }, fn);
async function poll(read, label) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) { if (await read()) return; await page.waitForTimeout(100); }
  throw new Error('Timed out: ' + label);
}
const waitWorld = (code) => poll(() => world(code), code);
const ready = () => poll(() => page.evaluate(async () => { const { game } = await import('/src/main.ts'); const { shell } = await import('/src/shell/app.ts'); return !!(game.loaded && game.world !== null && shell.top?.gameplay); }), 'gameplay ready');
let host;
try {
  if (!process.argv.includes('--quick-only')) {
  await page.goto(`${base}?data-dir=couch-qa&couch&noart`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.selectOption('select[name=botFill]', 'no');
  await page.locator('button[type=submit]').click();
  await page.locator('[data-screen="loading"]').waitFor({ state: 'detached' });
  await page.locator('[data-player="2"]').waitFor();
  await ready();
  assert.equal(await page.locator('[data-player]').count(), 2);
  assert.match(await page.locator('[data-player="1"]').innerText(), /yeters per second/);
  console.log('Couch room ready: two local humans, no bot interference');
  await world('world.room.sim.players.forEach(p => { p.hp = 10000; }); return true;');
  const before = await world('return world.room.sim.players.map(p => ({...p.pos}));');
  await page.evaluate(() => {
    window.__qaPads = [{ axes: [1, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) }];
  });
  await poll(async () => { const p = await world('return world.room.sim.players[1].pos;'); return Math.hypot(p.x - before[1].x, p.z - before[1].z) > 0.8; }, 'controller movement');
  const after = await world('return world.room.sim.players.map(p => ({...p.pos}));');
  assert(Math.hypot(after[0].x - before[0].x, after[0].z - before[0].z) < 0.05, 'Player 2 pad must not move Player 1');
  await page.screenshot({ path: 'captures/progress/coliseum-couch-two.png' });
  console.log('Independent controller movement passed');
  await page.evaluate(() => { window.__qaPads = []; });
  await world('world.room.sim.players[1].vel = {x:80,y:40,z:0}; return true;');
  await page.waitForTimeout(350);
  await world('const r=world.room,ev=[]; r.sim.cur=1; r.sim.hitTarget(1000,{x:0,y:0,z:1},1e6,0,r.sim.players[0].pos,ev); r.recorder.record(r.sim.time,r.sim.players,r.active,ev); r.sim.kos[0]=r.options.scoreLimit; return true;');
  await page.getByRole('button', { name: 'Skip replay', exact: true }).waitFor();
  await page.getByText(/Yeet of the match · Player 2/).waitFor();
  await page.screenshot({ path: 'captures/progress/yeet-of-the-match.png' });
  assert.match(await page.locator('body').innerText(), /Yeet of the match · Player 2/);
  await page.getByRole('button', { name: 'Skip replay', exact: true }).click();
  await page.getByRole('button', { name: 'Rematch', exact: true }).click();
  console.log('Fastest-player replay and skip passed');
  await waitWorld('return world.room.match.phase === "playing" && world.room.sim.kos.every(n => n === 0);');
  await page.goto(`${base}?data-dir=couch-qa&play&couch=3&noart`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('[data-screen="loading"]').waitFor({ state: 'detached' });
  await page.locator('[data-player="3"]').waitFor();
  await ready();
  assert.equal(await page.locator('[data-player]').count(), 3);
  await page.screenshot({ path: 'captures/progress/coliseum-couch-three.png' });
  await page.goto(`${base}?data-dir=couch-qa&play&couch=4&noart`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('[data-screen="loading"]').waitFor({ state: 'detached' });
  await page.locator('[data-player="4"]').waitFor();
  await ready();
  assert.equal(await page.locator('[data-player]').count(), 4);
  await page.screenshot({ path: 'captures/progress/coliseum-couch-four.png' });
  console.log('Three and four viewport layouts passed');
  }
  await page.goto(`${base}?data-dir=couch-qa&quick&offline&noart`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('[data-screen="loading"]').waitFor({ state: 'detached' });
  await page.locator('.yd-panel h2').waitFor();
  await ready();
  await world('const r=world.partySession.transport.room; r.restart(0); r.options.scoreLimit=100; r.sim.players[0].hp=10000; r.sim.players[0].vel={x:0,y:90,z:0}; return true;');
  await page.waitForTimeout(300);
  await world('const r=world.partySession.transport.room,ev=[]; r.sim.cur=0; r.sim.hitTarget(1001,{x:0,y:0,z:1},1e6,0,r.sim.players[1].pos,ev); r.recorder.record(r.sim.time,r.sim.players,r.active,ev); r.sim.kos[0]=r.options.scoreLimit; return true;');
  await page.getByRole('button', { name: 'Skip replay', exact: true }).waitFor();
  await page.screenshot({ path: 'captures/progress/quick-play-highlight.png' });
  await page.getByRole('button', { name: 'Skip replay', exact: true }).click();
  await page.getByRole('button', { name: 'Rematch', exact: true }).click();
  await waitWorld('return world.partySession.transport.room.match.phase === "playing";');
  console.log('Standard Quick Play end-of-match replay and rematch passed');
  host = new WebSocket('ws://127.0.0.1:7357');
  const joined = new Promise((resolve, reject) => { host.on('message', (raw) => { const m = JSON.parse(String(raw)); if (m.t === 'joined') resolve(m); if (m.t === 'error') reject(new Error(m.reason)); }); });
  await new Promise((r) => host.once('open', r));
  host.send(JSON.stringify({ t: 'create', options: { level: 'coliseum', capacity: 8, botFill: true } }));
  const room = await joined;
  await page.goto(`${base}?data-dir=couch-qa&online=1&room=${room.code}&spectate&noart`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('button', { name: 'Next player', exact: true }).waitFor();
  await ready();
  await page.locator('[data-screen="loading"]').waitFor({ state: 'detached' });
  assert.equal(await world('return world.session.slot;'), -1);
  assert.equal(await world('return world.session.latest.present.filter(Boolean).length;'), 1);
  await page.getByRole('button', { name: 'Next player', exact: true }).click();
  assert.match(await page.locator('body').innerText(), /Spectating .*Player 2/);
  await page.getByRole('button', { name: 'Arena overview', exact: true }).click();
  await page.screenshot({ path: 'captures/progress/coliseum-spectator.png' });
  assert.deepEqual(errors, []);
  console.log(process.argv.includes('--quick-only')
    ? 'QUICK_SPECTATOR_BROWSER_OK: standard Quick Play replay, skip/rematch, read-only spectator and overview'
    : 'COUCH_BROWSER_OK: isolated controller movement, two/three/four viewports, fastest-player and Quick Play replay, skip/rematch, read-only spectator and overview');
} catch (error) {
  console.log('Browser state:', (await page.locator('body').innerText()).slice(-2000));
  await page.screenshot({ path: 'captures/progress/couch-failure.png' }).catch(() => {});
  console.log('Page errors:', errors); throw error;
} finally {
  host?.close(); await browser.close(); await server.close();
}
