// Real keyboard/touch flows and rendered scenery; fixture changes only establish repeatable test situations.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
await mkdir('captures/progress', { recursive: true });
const server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 4186, hmr: false, open: false } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(180000);
const errors = [], failed = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
await page.addInitScript(() => localStorage.setItem('equipment-qa/settings.json', JSON.stringify({ version: 1, display: { frame_cap: 30 }, telemetry: { consent: 'no' } })));
const base = server.resolvedUrls.local[0];
const world = source => page.evaluate(async source => { const { game } = await import('/src/main.ts'); return new Function('w','game',source)(game.world,game); },source);
async function until(read, label) { const end = Date.now()+180000; while(Date.now()<end) { if(await read())return; await page.waitForTimeout(100); } throw new Error(`Timeout: ${label}`); }
async function go(query) {
  console.log('OPEN', query);
  await page.goto(`${base}?data-dir=equipment-qa&play&${query}`, {waitUntil:'domcontentloaded', timeout:180000});
  await until(() => page.evaluate(async()=>{const {game}=await import('/src/main.ts');const {shell}=await import('/src/shell/app.ts');return !!(game.loaded&&game.world&&shell.top?.gameplay);}), 'gameplay loaded');
  await world('w.sim.dummies.forEach(d=>d.down=1e9); return true');
  console.log('READY', query);
}
const shot = name => page.screenshot({path:`captures/progress/${name}.png`});
try {
  if (!process.argv.includes('--scenery-only') && !process.argv.includes('--art-only')) {
  await go('level=industrial&noart');
  await world('w.sim.player.owned.push("shield"); w.sim.player.healthUses=3; w.sim.player.hp=20; return true');
  await page.locator('canvas').click({position:{x:480,y:320},force:true});
  await until(()=>page.evaluate(()=>document.pointerLockElement!==null),'pointer lock');
  await page.keyboard.press('Digit0'); await until(()=>world('return w.sim.player.weapon==="shield"'),'shield selected');
  await page.waitForTimeout(300); await shot('shield-pistol-hip');
  const ammo = await world('return w.sim.player.mag.pistol');
  await page.mouse.click(480,320); await until(()=>world(`return w.sim.player.mag.pistol<${ammo}`),'hip pistol fires');
  await page.mouse.down({button:'right'}); await until(()=>world('return w.sim.player.shielding'),'shield braced');
  const bracedAmmo=await world('return w.sim.player.mag.pistol');
  await page.mouse.click(480,320); await page.waitForTimeout(350);
  assert.equal(await world('return w.sim.player.mag.pistol'),bracedAmmo);
  await shot('shield-viewport-aimed'); await page.mouse.up({button:'right'});
  await world('w.sim.player.vel={x:0,y:0,z:0};w.sim.player.stun=0;w.sim.player.tumbling=0;return true');
  await page.keyboard.press('KeyV'); await until(()=>world('return w.sim.player.healing>0'),'keyboard treatment');
  await world('game.paused=true;return true'); await shot('health-pack-application'); await world('game.paused=false;return true');
  await until(()=>world('return w.sim.player.healCooldown>0'),'treatment completes');
  assert.equal(await world('return w.sim.player.hp'),100); assert.equal(await world('return w.sim.player.healthUses'),2);
  await page.keyboard.press('KeyV'); assert.equal(await world('return w.sim.player.healthUses'),2);
  console.log('KEYBOARD_EQUIPMENT_OK: hip pistol, aimed holster, viewport, V treatment, charges and cooldown');

  await go('level=industrial&noart&touch');
  await world('w.sim.player.healthUses=3;w.sim.player.hp=25;return true');
  await page.locator('.yt-heal').click(); await until(()=>world('return w.sim.player.healing>0'),'touch treatment');
  assert.match(await page.locator('.yt-heal').textContent(),/HEAL/);
  await until(()=>world('return w.sim.player.healCooldown>0'),'touch recovery');
  assert.equal(await world('return w.sim.player.hp'),100);
  console.log('TOUCH_EQUIPMENT_OK');
  }

  if (!process.argv.includes('--art-only')) {
  for (const level of ['industrial','junkyard','island']) {
    await go(`level=${level}`);
    // the 2026-11-26 level pass instances static models (one mesh per model part), so check drawn models exist per art
    assert.equal(await world('const drawn=new Set(w.scenery.group.children.filter(o=>o.name.startsWith("scenery:")).map(o=>o.name.slice(8)));return w.sim.level.scenery.every(p=>drawn.has(p.art))'),true);
    await world(`game.paused=true;w.vm.root.visible=false;w.camera.position.set(${level==='industrial'?'-15,13,12':level==='junkyard'?'-14,12,18':'-5,7,-4'});w.camera.lookAt(${level==='industrial'?'-20,0,-9':level==='junkyard'?'-10,1,5':'-7,0,-10'});return true`);
    await shot(`scenery-${level}-review`);
    console.log(`SCENERY_RENDER_OK ${level}`);
  }
  await go('level=industrial&noart');
  assert.ok(await world('return w.scenery.group.children.filter(o=>o.name.startsWith("scenery-fallback:")).length>20'),'noart draws the colliders');
  // walk east into the hall's conveyor line (x -13.9..-12.9) without jumping: it must stop you
  const collision=await world('w.sim.player.pos={x:-17,y:0,z:1};w.sim.player.vel={x:0,y:0,z:0};w.sim.player.yaw=-Math.PI/2;for(let i=0;i<240;i++)w.sim.step({moveX:0,moveZ:1,jump:false,fireHeld:false,firePressed:false,select:-1,reset:false,aiming:false,sprint:false,reload:false,slash:false,slashHeld:false});game.paused=true;return w.sim.player.pos.x');
  assert.ok(collision<-13.9,'conveyor collision stops forward walking');
  console.log('SCENERY_NOART_COLLISION_OK');
  }
  if (process.argv.includes('--art') || process.argv.includes('--art-only')) {
    await go('level=industrial&art-preview=approved');
    await page.locator('canvas').click({position:{x:320,y:200},force:true});
    await world('w.sim.player.owned.push("shield");w.sim.player.weapon="shield";return true');
    await page.waitForTimeout(500); await shot('approved-shield-pistol-preview');
    await world('w.forceAim=true;return true'); await page.waitForTimeout(600); await shot('approved-shield-viewport-preview');
    for (const aim of [0, 1]) {
      await world(`game.paused=true;w.vm.root.visible=false;const p=w.sim.player;w.body.root.position.set(p.pos.x,p.pos.y+0.9,p.pos.z);w.body.setPose({weapon:"shield",speed:0,onGround:true,aim:${aim},pitch:0,fling:0,tumbling:false,dead:false,kneel:0});w.body.update(1,w.camera);w.body.root.visible=true;w.camera.position.copy(w.body.root.localToWorld(w.camera.position.clone().set(1.6,0.8,2.3)));w.camera.lookAt(w.body.root.position);return true`);
      await shot(`shield-third-person-${aim?'braced':'hip'}`);
    }
    await world('game.paused=false;w.vm.root.visible=true;w.forceAim=false;w.sim.player.healthUses=3;w.sim.player.hp=20;return true');
    await page.keyboard.press('KeyV'); await until(()=>world('return w.sim.player.healing>0'),'approved health pack application');
    await world('game.paused=true;return true'); await shot('approved-health-pack-application');
    console.log('APPROVED_EQUIPMENT_ART_LOADED');
  }
  assert.deepEqual(errors,[]); assert.deepEqual(failed,[]);
  console.log('EQUIPMENT_SCENERY_BROWSER_OK');
} catch(error) { await shot('equipment-scenery-failure').catch(()=>{}); throw error; }
finally { await browser.close(); await server.close(); }
