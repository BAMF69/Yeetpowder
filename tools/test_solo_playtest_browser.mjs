// User-flow checks plus direct inspection of the loaded dev world; no production test hooks.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
await mkdir('captures/progress', { recursive: true });
const server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 4184, open: false, hmr: false } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: process.argv.includes('--legacy-only') || process.argv.includes('--quick-only') ? { width: 800, height: 600 } : { width: 1120, height: 720 } });
page.setDefaultTimeout(120000);
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem('solo-report/settings.json', JSON.stringify({ version: 1, display: { frame_cap: 30 }, telemetry: { consent: 'no' } }));
  localStorage.setItem('yeetpowder.playerProfile', JSON.stringify({name:'Elaina',operator:'mint'}));
});
const base = server.resolvedUrls.local[0];
const world = (code) => page.evaluate(async (source) => { const { game } = await import('/src/main.ts'); return new Function('w', source)(game.world); }, code);
async function poll(read, label) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) { if (await read()) return; await page.waitForTimeout(100); }
  throw new Error('Timed out: ' + label);
}
const ready = () => poll(() => page.evaluate(async () => { const { game } = await import('/src/main.ts'); const { shell } = await import('/src/shell/app.ts'); return !!(game.loaded && game.world !== null && shell.top?.gameplay); }), 'gameplay ready');
const until = (code) => poll(() => page.evaluate(async (source) => { const { game } = await import('/src/main.ts'); return !!(game.world && new Function('w', source)(game.world)); }, code), code);
const go = (query) => page.goto(`${base}?data-dir=solo-report&noart&${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
try {
  if (!process.argv.includes('--legacy-only') && !process.argv.includes('--quick-only')) {
  await go('aim');
  await page.locator('[data-screen="title"]').click();
  await page.locator('.yeet-menu').waitFor();
  await page.screenshot({ path: 'captures/progress/party-menu-polish.png' });
  await page.getByText('Player & Operator', { exact: true }).click();
  await page.fill('input[name=playerName]', 'Elaina'); await page.selectOption('select[name=operator]', 'mint');
  await page.screenshot({ path: 'captures/progress/player-operator.png' });
  await page.getByRole('button', { name: 'Save operator', exact: true }).click();
  await page.getByText('Arenas', { exact: true }).click();
  await page.getByText('Industrial Yard — Party (8-spawn layout)', { exact: true }).click();
  await page.getByText('Choose opponent count & rules', { exact: true }).click();
  await page.selectOption('select[name=opponents]', '3');
  await page.selectOption('select[name=botSkill]', 'easy');
  await page.locator('button[type=submit]').click(); await ready();
  assert.equal(await world('return w.sim.players.length;'), 4);
  assert.equal(await world('return w.partySession.latest.profiles[0].name;'), 'Elaina');
  assert.equal(await world('return w.partySession.latest.profiles[0].operator;'), 'mint');
  await page.keyboard.down('Tab'); await page.waitForTimeout(120);
  assert.match(await page.locator('.yd-panel').innerText(), /Elaina.*KOs/);
  await page.screenshot({ path: 'captures/progress/tab-scores.png' }); await page.keyboard.up('Tab');
  assert(await world('return w.pickups.views.filter(v => v.weapon !== "health").every(v => v.gun.children[0]?.children.length > 1);'));
  await world('const r=w.partySession.transport.room; r.brains.fill(null); r.sim.players.forEach((p,i)=>{if(i) p.dead=1e9;}); const hp=r.sim.pickups.find(p=>p.weapon==="health"); r.sim.players[0].hp=25; r.sim.players[0].pos={...hp.pos}; return true;');
  await until('return w.partySession.transport.room.sim.players[0].healthUses === 3;');
  await world('const r=w.partySession.transport.room; r.push(0,[{moveX:0,moveZ:0,jump:false,fireHeld:false,firePressed:false,select:-1,reset:false,aiming:false,sprint:false,reload:false,slash:false,slashHeld:false,heal:true,seq:r.acks[0]+1,dYaw:0,dPitch:0,round:r.round}]);return true;');
  await until('return w.partySession.transport.room.sim.players[0].hp === 100;');
  await world('const p=w.partySession.transport.room.sim.players[0]; p.weapon="grenade"; p.owned.push("grenade"); return true;');
  await until('return w.vm.weapon === "grenade" && w.grenadeGuide.root.visible;');
  await page.screenshot({ path: 'captures/progress/aimed-grenade-guide.png' });
  await world('w.partySession.transport.room.sim.players[0].dead=0.001; return true;');
  await until('return w.sim.player.weapon === "pistol" && w.vm.weapon === "pistol";');
  console.log('PROFILE_SOLO_COMBAT_OK: profile, operator, three opponents, Tab scores, actual pickup models, healing, grenade guide, respawn weapon sync');
  }

  if (!process.argv.includes('--quick-only')) {
  await go('play&level=island&bot=easy'); await ready();
  console.log('Legacy bot world ready');
  await page.keyboard.down('Tab'); await page.locator('.ys-scoreboard').waitFor({ state: 'visible' });
  assert.match(await page.locator('.ys-scoreboard').innerText(), /SCOREBOARD/); await page.keyboard.up('Tab');
  console.log('Legacy Tab scores passed');
  await world('w.sim.player.pos={x:30,y:-2,z:0}; return true;');
  await until('return w.sim.player.sharkT > 0 && w.sim.player.sharkT < 1.3;');
  await world('w.held=true; return true;');
  await page.screenshot({ path: 'captures/progress/shark-approach.png' });
  await world('w.held=false; return true;');
  await until('return w.sim.player.swallowed;');
  assert.equal(await world('return w.body.root.visible;'), false);
  console.log('SHARK_PRESENTATION_OK: approach then disappearance');
  }

  if (!process.argv.includes('--legacy-only')) {
  await go('quick&offline'); await ready();
  const firstMap = await world('return w.sim.level.id;');
  await world('const r=w.partySession.transport.room; r.brains.fill(null); r.options.scoreLimit=5; r.sim.players[0].vel={x:0,y:35,z:0}; return true;');
  await page.waitForTimeout(250);
  await world('const r=w.partySession.transport.room, ev=[]; r.sim.cur=0; r.sim.hitTarget(1001,{x:0,y:0,z:-1},1000,4,r.sim.players[1].pos,ev); r.recorder.record(r.sim.time,r.sim.players,r.active,ev); r.sim.kos[0]=5; return true;');
  await page.getByRole('button', { name: 'Skip replay', exact: true }).waitFor();
  assert.match(await page.locator('body').innerText(), /Elaina · 5 KOs/);
  const introTime = await world('return w.sim.time;');
  await page.waitForTimeout(500); assert.equal(await world('return w.sim.time;'), introTime);
  await page.screenshot({ path: 'captures/progress/winner-introduction.png' });
  await page.getByText(/Yeet of the match · Elaina/).waitFor();
  await page.screenshot({ path: 'captures/progress/kill-qualified-highlight.png' });
  await page.getByRole('button', { name: 'Skip replay', exact: true }).click();
  assert.match(await page.locator('.yd-panel').innerText(), /Next match on a new map in \d+s/);
  await page.getByRole('button', { name: 'Next match · new map', exact: true }).click();
  await until('return w.partySession?.round === 2 && w.partySession.transport.room.match.phase === "playing";');
  await world('const r=w.partySession.transport.room; r.brains.fill(null); r.sim.projectiles.length=0; r.recorder=new r.recorder.constructor(); r.sim.players.forEach(p=>p.hp=10000); return true;');
  await ready();
  assert.notEqual(await world('return w.sim.level.id;'), firstMap);
  assert.equal(await world('return w.partySession.latest.profiles[0].name;'), 'Elaina');
  await world('const r=w.partySession.transport.room; r.sim.kos[0]=r.options.scoreLimit; return true;');
  await until('return w.partySession.transport.room.match.phase === "finished";');
  assert.equal(await world('return w.partySession.transport.room.snapshot(false).replay;'), null);
  await world('w.partySession.transport.room.tick += 3600; return true;');
  await until('return w.partySession?.round === 3;'); await ready();
  console.log('QUICK_ROTATION_REPLAY_OK: kill-qualified clip, frozen two-second winner introduction, name/score, new-map button, automatic countdown, retained profile, no-kill replay rejection');
  }
  assert.deepEqual(errors, []);
  console.log('SOLO_PLAYTEST_BROWSER_OK');
} catch (error) {
  console.log('Browser state:', (await page.locator('body').innerText()).slice(-2200));
  console.log('Page errors:', errors);
  await page.screenshot({ path: 'captures/progress/solo-playtest-failure.png' }).catch(() => {});
  throw error;
} finally { await browser.close(); await server.close(); }
