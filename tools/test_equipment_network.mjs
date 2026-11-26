// Exercise actual room messages and authoritative equipment state through two real socket clients.
import assert from 'node:assert/strict';
import WebSocket from 'ws';
const clients=[];
const wait=async(test,label)=>{const end=Date.now()+30000;while(!test()){if(Date.now()>end)throw new Error(`Timeout: ${label}`);await new Promise(r=>setTimeout(r,20));}};
const wrap=n=>Math.atan2(Math.sin(n),Math.cos(n));
async function connect(request){const ws=new WebSocket('ws://127.0.0.1:7357'),c={ws,snap:null,joined:null,seq:0};clients.push(c);ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.t==='snap')c.snap=m;if(m.t==='joined')c.joined=m;if(m.t==='error')console.error(m.reason);});await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify(request));await wait(()=>c.joined,'joined');return c;}
function input(c,values={}){c.ws.send(JSON.stringify({t:'in',inputs:[{seq:++c.seq,round:c.snap?.round??1,dYaw:0,dPitch:0,moveX:0,moveZ:0,jump:false,firePressed:false,fireHeld:false,select:-1,reset:false,aiming:false,sprint:false,reload:false,slash:false,slashHeld:false,heal:false,...values}]}));}
function aim(c,target,extra={}){const p=c.snap.state.players[c.joined.slot],q=c.snap.state.players[target];input(c,{dYaw:wrap(Math.atan2(-(q.pos.x-p.pos.x),-(q.pos.z-p.pos.z))-p.yaw),dPitch:-p.pitch,...extra});}
let steer;
try{
  const a=await connect({t:'create',options:{level:'industrial',capacity:2,visibility:'private',botFill:false,scoreLimit:20}});
  const b=await connect({t:'join',code:a.joined.code});
  await wait(()=>a.snap?.match.phase==='playing'&&a.snap.state.players[0].healthUses===3,'health collected at match spawn');
  const p=b.snap.state.players[1];input(b,{dYaw:-p.yaw,dPitch:-p.pitch,moveZ:-1});
  await wait(()=>b.snap.state.players[1].weapon==='shield','walk to shield pickup');input(b);
  await wait(()=>a.snap.state.players[1].weapon==='shield','peer sees shield');
  await wait(()=>b.snap.state.players[1].cooldown===0,'pickup switch cooldown');
  aim(b,0); await new Promise(r=>setTimeout(r,300));
  aim(b,0,{firePressed:true});
  await wait(()=>a.snap.state.players[0].hp<100,'shield carrier hip pistol damages opponent');
  input(a,{heal:true});
  await wait(()=>b.snap.state.players[0].healing>0,'remote treatment visible');
  assert.equal(b.snap.state.players[0].healthUses,2);
  await wait(()=>a.snap.state.players[0].healCooldown>0,'full recovery completes');
  assert.equal(a.snap.state.players[0].hp,100);
  await wait(()=>b.snap.state.players[0].hp===100&&b.snap.state.players[0].healCooldown>0,'peer sees recovery and cooldown');
  const hp=b.snap.state.players[1].hp;aim(a,1,{firePressed:true});
  await new Promise(r=>setTimeout(r,500));assert.equal(b.snap.state.players[1].hp,hp,'hip shield blocks frontal bullet');
  const ammo=b.snap.state.players[1].mag.pistol;aim(b,0,{aiming:true,firePressed:true});
  await wait(()=>a.snap.state.players[1].shielding,'peer sees braced shield');
  await new Promise(r=>setTimeout(r,300));assert.equal(b.snap.state.players[1].mag.pistol,ammo,'braced pistol stays holstered');
  input(a,{heal:true});await new Promise(r=>setTimeout(r,300));assert.equal(a.snap.state.players[0].healthUses,2,'cooldown rejects another use');
  console.log('EQUIPMENT_NETWORK_OK: pickup, hip pistol, frontal bullet block, aimed holster, treatment, uses, full HP and cooldown agree on both clients');
}finally{clearInterval(steer);for(const c of clients)c.ws.close();}
