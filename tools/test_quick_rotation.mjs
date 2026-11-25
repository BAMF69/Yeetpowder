import assert from 'node:assert/strict';
import WebSocket from 'ws';
const clients = [];
const wait = async (test, detail) => { const deadline = Date.now() + 25000; while (!test()) { if (Date.now() > deadline) throw new Error('Timed out: ' + detail); await new Promise(r => setTimeout(r, 20)); } };
async function connect(request) {
  const ws = new WebSocket('ws://127.0.0.1:7357'), c = { ws, joined: null, snap: null, replay: null, round: null };
  clients.push(c); ws.on('message', raw => { const m=JSON.parse(String(raw)); if (m.t==='joined') c.joined=m; if (m.t==='snap') {c.snap=m; if (m.replay) c.replay=m.replay;} if (m.t==='round') {c.round=m;c.snap=null;} if (m.t==='error') throw new Error(m.reason); });
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);}); ws.send(JSON.stringify(request)); await wait(()=>c.joined,'join'); return c;
}
let aimTimer;
try {
  const a=await connect({t:'create',options:{level:'coliseum',capacity:8,visibility:'public',botFill:true,scoreLimit:1},profile:{name:'Alpha',operator:'mint'}});
  for(let i=1;i<8;i++) await connect({t:'join',code:a.joined.code,profile:{name:'Player '+(i+1),operator:'ember'}});
  const watcher=await connect({t:'join',code:a.joined.code,spectate:true});
  await wait(()=>a.snap?.present.every(Boolean),'full roster');
  assert.equal(a.snap.profiles[0].name,'Alpha'); assert.equal(watcher.joined.slot,-1);
  let seq=0;
  aimTimer=setInterval(()=>{
    const s=a.snap; if(!s || s.match.phase!=='playing')return;
    const p=s.state.players[0],q=s.state.players[1],dx=q.pos.x-p.pos.x,dz=q.pos.z-p.pos.z;
    const yaw=Math.atan2(-dx,-dz),pitch=Math.atan2(q.pos.y+1.1-p.pos.y-1.55,Math.hypot(dx,dz));
    a.ws.send(JSON.stringify({t:'in',inputs:[{seq:++seq,round:1,dYaw:Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw)),dPitch:pitch-p.pitch,moveX:0,moveZ:0,select:0,firePressed:true,fireHeld:false,aiming:true}]}));
  },34);
  await wait(()=>a.snap?.match.phase==='finished','pistol knockout'); clearInterval(aimTimer);
  assert(a.replay?.killAt>=0); assert.equal(a.replay.name,'Alpha'); assert.equal(a.replay.winner.name,'Alpha'); assert(a.snap.match.nextRoundIn<=30);
  const oldMap=a.joined.level; a.ws.send(JSON.stringify({t:'next'}));
  await wait(()=>clients.every(c=>c.round?.round===2 && c.snap?.round===2),'all clients and spectator switched round');
  assert.notEqual(a.round.options.level,oldMap); assert.equal(a.snap.profiles[0].name,'Alpha'); assert.equal(a.snap.present.filter(Boolean).length,8);
  a.ws.send(JSON.stringify({t:'in',inputs:[{seq:9000,round:1,dYaw:0,dPitch:0,moveX:1,moveZ:0,select:-1}]}));
  a.ws.send(JSON.stringify({t:'in',inputs:[{seq:1,round:2,dYaw:0,dPitch:0,moveX:0,moveZ:1,select:-1}]}));
  await wait(()=>a.snap?.acks[0]===1,'new-round controls acknowledged');
  console.log('QUICK_ROTATION_NETWORK_OK: eight humans, persisted names/operators, actual credited kill highlight, countdown, new map for every client and spectator, stale input rejection');
} finally { clearInterval(aimTimer); for(const c of clients)c.ws.close(); }
