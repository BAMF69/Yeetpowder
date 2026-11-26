// Run after dev.py build, with npm run duel:server running. Exercise actual room forms and two game clients.
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('captures/progress', { recursive: true });
const server = await preview({ logLevel: 'silent', preview: { host: '127.0.0.1', port: 4173, strictPort: false, open: false } });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ headless: true });
const errors = [];
async function page(query) {
  const p = await browser.newPage({ viewport: { width: 960, height: 600 } });
  p.setDefaultTimeout(90000);
  await p.bringToFront();
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('websocket', (socket) => {
    let roster = '';
    socket.on('framesent', ({ payload }) => {
      try { const m = JSON.parse(String(payload)); if (['quick', 'join', 'create', 'rematch', 'leave'].includes(m.t)) console.log('WS sent:', JSON.stringify(m)); } catch {}
    });
    socket.on('framereceived', ({ payload }) => {
      try { const m = JSON.parse(String(payload)); if (['joined', 'error'].includes(m.t)) console.log('WS received:', JSON.stringify(m)); } catch {}
      try {
        const m = JSON.parse(String(payload));
        if (m.t === 'snap') {
          const next = `${m.present.filter(Boolean).length} humans + ${m.bots?.filter(Boolean).length ?? 0} bots`;
          if (next !== roster) { roster = next; console.log('Roster packet:', next); }
        }
      } catch {}
    });
    socket.on('close', () => { if (socket.url().startsWith('ws://127.0.0.1:7357')) console.log('Room socket closed'); });
  });
  await p.addInitScript(() => localStorage.setItem('party-qa/settings.json', JSON.stringify({ version: 1, display: { frame_cap: 30 }, telemetry: { consent: 'no' } })));
  await p.goto(`${base}?data-dir=party-qa&${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  return p;
}
async function playing(p) {
  await p.locator('.yd-panel h2').filter({ hasText: /player.*bots/ }).waitFor({ timeout: 60000 });
  await p.locator('[data-screen="loading"]').waitFor({ state: 'detached', timeout: 60000 });
}
try {
  const form = await page('make-room');
  await form.locator('select[name=mode]').waitFor();
  await form.selectOption('select[name=mode]', 'ringout');
  assert.equal(await form.locator('select[name=level]').inputValue(), 'island-party');
  assert.equal(await form.locator('select[name=scoreLimit]').isVisible(), true);
  assert.equal(await form.locator('select[name=minutes]').isVisible(), false);
  await form.selectOption('select[name=mode]', 'timed');
  assert.equal(await form.locator('select[name=minutes]').isVisible(), true);
  await form.selectOption('select[name=mode]', 'lives');
  assert.equal(await form.locator('select[name=lives]').isVisible(), true);
  await form.screenshot({ path: 'captures/progress/make-room-options.png' });
  await form.selectOption('select[name=mode]', 'ringout');
  await form.locator('button[type=submit]').click();
  await playing(form);
  assert.match(await form.locator('.yh-level').innerText(), /HP ∞/);
  await form.screenshot({ path: 'captures/progress/ring-out-room.png' });
  await form.close();

  const first = await page('quick'); await playing(first);
  console.log('First client ready:', await first.locator('.yd-panel h2').innerText());
  const firstTitle = await first.locator('.yd-panel h2').innerText();
  assert.match(firstTitle, /1 player \+ 7 bots/);
  const code = /Room ([A-Z]{4})/.exec(firstTitle)[1];
  const second = await page(`online=1&room=${code}`);
  console.log('Joining second client to', code);
  await playing(second);
  await first.bringToFront();
  await first.waitForFunction(() => document.querySelector('.yd-panel h2')?.textContent.includes('2 players + 6 bots'), undefined, { polling: 100 });
  await second.bringToFront();
  await second.getByRole('button', { name: 'Players', exact: true }).click();
  const roster = await second.locator('.yd-panel').innerText();
  assert.match(roster, /Player 2 \(you\)/);
  assert.match(roster, /Easy bot/); assert.match(roster, /Medium bot/);
  await second.screenshot({ path: 'captures/progress/quick-play-online.png' });
  await second.close({ runBeforeUnload: true });
  await first.bringToFront();
  await first.waitForFunction(() => document.querySelector('.yd-panel h2')?.textContent.includes('1 player + 7 bots'), undefined, { polling: 100 });
  await first.close();
  const offline = await page('quick&offline'); await playing(offline);
  assert.match(await offline.locator('.yd-panel h2').innerText(), /Offline · 1 player \+ 7 bots/);
  await offline.screenshot({ path: 'captures/progress/quick-play-eight.png' });
  assert.deepEqual(errors, []);
  console.log('PARTY_BROWSER_OK: four mode controls, authoritative map selection, two clients, bot labels, disconnect fill, offline eight-combatant match');
} catch (error) {
  let index = 0;
  for (const p of browser.contexts().flatMap((c) => c.pages())) {
    console.log('Browser failure state:', (await p.locator('body').innerText()).slice(-1600));
    await p.screenshot({ path: `captures/progress/party-failure-${index++}.png` }).catch(() => {});
  }
  console.log('Page errors:', errors);
  throw error;
} finally {
  await browser.close();
  await server.close();
}
